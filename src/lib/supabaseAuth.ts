// ────────────────────────────────────────────────────────────────────────────
// Adaptateur d'authentification Supabase (email + mot de passe).
//
// Actif uniquement quand isSupabaseConfigured. La création de comptes et la
// modification des mots de passe d'AUTRES utilisateurs passent par la fonction
// Edge « admin-users » (service_role côté serveur, réservée aux super-admins) —
// jamais depuis le navigateur. Le changement de SON propre mot de passe se fait
// directement via supabase.auth.updateUser.
//
// Câblage restant (voir docs/SUPABASE.md) : Login (formulaire e-mail), session
// dans App, et branchement de la page Comptes / MonCompte sur ces fonctions.
// ────────────────────────────────────────────────────────────────────────────

import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { User, UserRole, Feature } from './auth'

/** Ligne de public.profiles renvoyée par la base / la fonction Edge. */
export interface RemoteProfile {
  id: string
  email: string | null
  username: string | null
  display_name: string | null
  role: UserRole
  disabled: boolean
  features: Feature[] | null
  created_at?: string
}

/** Convertit un profil serveur vers le modèle User de l'interface. */
export function profileToUser(p: RemoteProfile): User {
  return {
    id: p.id,
    username: p.username ?? p.email ?? p.id,
    email: p.email ?? undefined,
    password: '',                       // jamais exposé côté client
    role: p.role,
    displayName: p.display_name || p.email || p.id,
    createdAt: p.created_at ?? '',
    disabled: p.disabled,
    features: p.features ?? undefined,
  }
}

/** Demande de démo (auto-inscription en attente de validation). */
export interface DemoRequest {
  id: string
  user_id: string | null
  name: string | null
  email: string | null
  company: string | null
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

function client() {
  if (!supabase) throw new Error('Supabase non configuré')
  return supabase
}

export async function signInEmail(email: string, password: string): Promise<{ error?: string }> {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password })
  return error ? { error: error.message } : {}
}

/**
 * Connexion par e-mail OU identifiant. Un identifiant est résolu en e-mail via
 * la fonction email_for_login avant le sign-in (Supabase s'authentifie par e-mail).
 */
export async function signInWithIdentifier(identifier: string, password: string): Promise<{ error?: string }> {
  const id = identifier.trim()
  if (!id) return { error: 'invalid' }
  let email = id
  if (!id.includes('@')) {
    const { data, error } = await client().rpc('email_for_login', { identifier: id })
    if (error) return { error: error.message }
    if (!data) return { error: 'invalid' } // identifiant inconnu → erreur générique
    email = data as string
  }
  return signInEmail(email, password)
}

/** Envoie un e-mail de réinitialisation de mot de passe. */
export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  })
  return error ? { error: error.message } : {}
}

/** Auto-inscription (« Demander une démo ») : crée un compte en attente. */
export async function submitDemoRequest(input: {
  name: string; email: string; password: string; company?: string; message?: string
}): Promise<{ error?: string }> {
  const { data, error } = await client().functions.invoke('demo-signup', { body: input })
  if (error) return { error: error.message }
  if (data && typeof data === 'object' && 'error' in data) return { error: String((data as { error: unknown }).error) }
  return {}
}

export async function signOutRemote(): Promise<void> {
  await client().auth.signOut()
}

/** Utilisateur courant (session + son profil), ou null si non connecté. */
export async function currentProfileUser(): Promise<User | null> {
  const { data } = await client().auth.getUser()
  if (!data.user) return null
  const { data: p } = await client().from('profiles').select('*').eq('id', data.user.id).single()
  return p ? profileToUser(p as RemoteProfile) : null
}

/**
 * S'abonne aux changements de session. Émet aussi l'état initial (INITIAL_SESSION)
 * au moment de l'abonnement : unique source de vérité pour le cycle de vie.
 */
export function onAuthChange(
  cb: (event: AuthChangeEvent, session: SupabaseSession | null) => void,
): () => void {
  const { data } = client().auth.onAuthStateChange((event, session) => cb(event, session))
  return () => data.subscription.unsubscribe()
}

/** Changement de son propre mot de passe. */
export async function changeOwnPasswordRemote(password: string): Promise<{ error?: string }> {
  const { error } = await client().auth.updateUser({ password })
  return error ? { error: error.message } : {}
}

// ── Opérations d'administration (fonction Edge, super-admin uniquement) ───────

async function callAdmin<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<{ data?: T; error?: string }> {
  const { data, error } = await client().functions.invoke('admin-users', { body: { action, ...payload } })
  if (error) return { error: error.message }
  if (data && typeof data === 'object' && 'error' in data) return { error: String((data as { error: unknown }).error) }
  return { data: data as T }
}

export async function adminListUsers(): Promise<User[]> {
  const { data } = await callAdmin<{ users: RemoteProfile[] }>('list')
  return (data?.users ?? []).map(profileToUser)
}
export const adminCreateUser = (p: { email: string; password: string; display_name?: string; role?: UserRole; features?: Feature[]; username?: string }) =>
  callAdmin('create', p)
export const adminSetPassword = (id: string, password: string) => callAdmin('setPassword', { id, password })
export const adminUpdateUser = (id: string, patch: Partial<{ display_name: string; role: UserRole; disabled: boolean; features: Feature[]; username: string }>) =>
  callAdmin('update', { id, patch })
export const adminDeleteUser = (id: string) => callAdmin('delete', { id })

// ── Demandes de démo (super-admin, via RLS directe sur demo_requests) ─────────

export async function listDemoRequests(): Promise<DemoRequest[]> {
  const { data, error } = await client().from('demo_requests').select('*').order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as DemoRequest[]
}

/** Valide une demande : active le compte + ouvre les modules choisis. */
export async function approveDemoRequest(req: DemoRequest, features: Feature[]): Promise<{ error?: string }> {
  if (!req.user_id) return { error: 'compte introuvable' }
  const { error } = await adminUpdateUser(req.user_id, { disabled: false, features })
  if (error) return { error }
  await client().from('demo_requests').update({ status: 'approved' }).eq('id', req.id)
  return {}
}

/** Rejette une demande : supprime le compte en attente (la ligne casse en cascade). */
export async function rejectDemoRequest(req: DemoRequest): Promise<{ error?: string }> {
  if (req.user_id) {
    const { error } = await adminDeleteUser(req.user_id)
    if (error) return { error }
  } else {
    await client().from('demo_requests').delete().eq('id', req.id)
  }
  return {}
}
