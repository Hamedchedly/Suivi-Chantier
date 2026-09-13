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

import { supabase } from './supabase'
import type { User, UserRole, Feature } from './auth'

/** Ligne de public.profiles renvoyée par la base / la fonction Edge. */
export interface RemoteProfile {
  id: string
  email: string | null
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
    username: p.email ?? p.id,
    email: p.email ?? undefined,
    password: '',                       // jamais exposé côté client
    role: p.role,
    displayName: p.display_name || p.email || p.id,
    createdAt: p.created_at ?? '',
    disabled: p.disabled,
    features: p.features ?? undefined,
  }
}

function client() {
  if (!supabase) throw new Error('Supabase non configuré')
  return supabase
}

export async function signInEmail(email: string, password: string): Promise<{ error?: string }> {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password })
  return error ? { error: error.message } : {}
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

export function onAuthChange(cb: () => void): () => void {
  const { data } = client().auth.onAuthStateChange(() => cb())
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
export const adminCreateUser = (p: { email: string; password: string; display_name?: string; role?: UserRole; features?: Feature[] }) =>
  callAdmin('create', p)
export const adminSetPassword = (id: string, password: string) => callAdmin('setPassword', { id, password })
export const adminUpdateUser = (id: string, patch: Partial<{ display_name: string; role: UserRole; disabled: boolean; features: Feature[] }>) =>
  callAdmin('update', { id, patch })
export const adminDeleteUser = (id: string) => callAdmin('delete', { id })
