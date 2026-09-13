// ────────────────────────────────────────────────────────────────────────────
// Synchronisation des données avec Supabase (table public.app_state).
//
// Modèle : miroir clé-valeur 1:1 du modèle local. localStorage reste le cache
// SYNCHRONE (les lectures des composants ne changent pas) ; le serveur est la
// copie durable, partagée entre appareils.
//
//   • initRemoteSession(uid) — à la connexion / au rechargement :
//       – purge le cache si le navigateur appartenait à un AUTRE compte
//         (pas de fuite entre comptes) ;
//       – récupère l'état serveur et FUSIONNE clé par clé (dernière écriture
//         gagne, via un horodatage local) — une édition hors-ligne n'est donc
//         plus écrasée, et un rechargement hors-ligne ne vide plus le cache ;
//       – active le write-through et pousse les clés locales plus récentes.
//   • disableSync() — à la déconnexion.
//
// Write-through : chaque saveState/removeState (observé via storage.ts) est
// répercuté (débouncé) en upsert/delete sur app_state.
//
// Sécurité : seules l'URL et la clé publiable vivent côté client ; RLS limite
// chaque ligne à son user_id (= auth.uid()). Jamais de service_role ici.
// ────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import { onStateWrite, onStateRemove } from './storage'

const TABLE = 'app_state'
const FLUSH_MS = 800
const APP_PREFIX = 'sc-'

/** Clés d'auth locales : jamais synchronisées, jamais purgées. */
const AUTH_KEYS = new Set(['sc-users-v1', 'sc-session-v1'])
/** Métadonnées de sync (horodatages locaux) et propriétaire du cache. */
const META_KEY = 'sc-sync-meta-v1'
const OWNER_KEY = 'sc-sync-owner-v1'
/** Clés jamais poussées sur le serveur. */
const EXCLUDE = new Set([...AUTH_KEYS, META_KEY, OWNER_KEY])

let userId: string | null = null
let enabled = false
let listenersBound = false

const pendingWrites = new Map<string, string>() // clé → valeur sérialisée (raw)
const pendingDeletes = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let failures = 0 // échecs consécutifs (backoff)

// Horodatage de dernière écriture LOCALE par clé (dernière-écriture-gagne).
let meta: Record<string, string> = {}

function readMeta(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') } catch { return {} }
}
function persistMeta(): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)) } catch { /* plein */ }
}

/** Clés applicatives présentes dans le cache local (hors auth/méta). */
function appStateKeys(): string[] {
  const out: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(APP_PREFIX) && !EXCLUDE.has(key)) out.push(key)
    }
  } catch { /* indisponible */ }
  return out
}

/** Purge le cache applicatif local (y compris méta/propriétaire, hors auth). */
export function clearLocalAppState(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(APP_PREFIX) && !AUTH_KEYS.has(key)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch { /* indisponible */ }
  meta = {}
}

/**
 * Recopie brute de l'état serveur dans localStorage (serveur autoritaire, sans
 * fusion). Conservé comme brique bas niveau ; initRemoteSession lui préfère la
 * fusion clé par clé. Retourne le nombre de clés écrites.
 */
export async function hydrateFromRemote(uid: string): Promise<number> {
  if (!supabase) return 0
  const { data, error } = await supabase.from(TABLE).select('k, v').eq('user_id', uid)
  if (error || !data) return 0
  for (const row of data as { k: string; v: unknown }[]) {
    if (EXCLUDE.has(row.k)) continue
    try { localStorage.setItem(row.k, JSON.stringify(row.v)) } catch { /* plein */ }
  }
  return data.length
}

/**
 * Établit la session de synchronisation pour cet utilisateur : purge éventuelle
 * (changement de compte), fusion dernière-écriture-gagne avec le serveur, puis
 * activation du write-through. Sans réseau, conserve le cache local intact.
 */
export async function initRemoteSession(uid: string): Promise<void> {
  // 1. Navigateur appartenant à un autre compte → purge (aucune fuite).
  let owner: string | null = null
  try { owner = localStorage.getItem(OWNER_KEY) } catch { /* indisponible */ }
  if (owner !== uid) {
    clearLocalAppState()
    try { localStorage.setItem(OWNER_KEY, uid) } catch { /* plein */ }
  }
  meta = readMeta()
  userId = uid
  bindListeners()

  // 2. État serveur. Hors-ligne (ou erreur) → on garde le cache local tel quel.
  if (!supabase) { enabled = true; return }
  const { data, error } = await supabase.from(TABLE).select('k, v, updated_at').eq('user_id', uid)
  if (error || !data) { enabled = true; return }

  // 3. Fusion clé par clé : la dernière écriture (horodatage) gagne.
  const serverKeys = new Set<string>()
  for (const row of data as { k: string; v: unknown; updated_at: string }[]) {
    if (EXCLUDE.has(row.k)) continue
    serverKeys.add(row.k)
    const localTs = meta[row.k]
    if (localTs && localTs > row.updated_at) continue // local plus récent → poussé en 4
    try { localStorage.setItem(row.k, JSON.stringify(row.v)) } catch { /* plein */ }
    meta[row.k] = row.updated_at
  }

  // 4. Active la sync, puis pousse les clés locales plus récentes ou absentes
  //    du serveur (créées / modifiées hors-ligne).
  enabled = true
  for (const key of appStateKeys()) {
    const localTs = meta[key]
    const newerThanServer = localTs && (!serverKeys.has(key) || !metaMatchesServer(key, data, localTs))
    if (!serverKeys.has(key) || newerThanServer) {
      let raw: string | null = null
      try { raw = localStorage.getItem(key) } catch { /* indisponible */ }
      if (raw != null) { pendingWrites.set(key, raw); schedule() }
    }
  }
  persistMeta()
}

/** Vrai si l'horodatage local correspond (≤) à celui du serveur pour cette clé. */
function metaMatchesServer(
  key: string,
  rows: { k: string; updated_at: string }[],
  localTs: string,
): boolean {
  const row = rows.find(r => r.k === key)
  return !!row && localTs <= row.updated_at
}

function bindListeners(): void {
  if (listenersBound) return
  onStateWrite(onLocalWrite)
  onStateRemove(onLocalRemove)
  listenersBound = true
}

/** Active le write-through pour cet utilisateur (brique bas niveau / tests). */
export function enableSync(uid: string): void {
  userId = uid
  enabled = true
  meta = readMeta()
  bindListeners()
}

/** Coupe la synchronisation (déconnexion) et vide les files d'attente. */
export function disableSync(): void {
  enabled = false
  userId = null
  failures = 0
  pendingWrites.clear()
  pendingDeletes.clear()
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
}

function onLocalWrite(key: string, raw: string): void {
  if (!enabled || !userId || EXCLUDE.has(key)) return
  pendingDeletes.delete(key)
  pendingWrites.set(key, raw)
  meta[key] = new Date().toISOString()
  schedule()
}

function onLocalRemove(key: string): void {
  if (!enabled || !userId || EXCLUDE.has(key)) return
  pendingWrites.delete(key)
  pendingDeletes.add(key)
  delete meta[key]
  schedule()
}

function schedule(delay = FLUSH_MS): void {
  if (!flushTimer) flushTimer = setTimeout(() => { void flush() }, delay)
}

async function flush(): Promise<void> {
  flushTimer = null
  if (!supabase || !userId) return
  const uid = userId
  let failed = false

  // Les entrées ne sont retirées des files qu'en cas de succès : un échec réseau
  // les conserve pour une nouvelle tentative (backoff), sans écraser les
  // écritures survenues pendant l'appel.
  if (pendingWrites.size) {
    const sent = [...pendingWrites.entries()]
    const now = new Date().toISOString()
    const rows = sent.map(([k, raw]) => ({ user_id: uid, k, v: safeParse(raw), updated_at: now }))
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'user_id,k' })
    if (error) failed = true
    else for (const [k, raw] of sent) {
      if (pendingWrites.get(k) === raw) { pendingWrites.delete(k); meta[k] = now }
    }
  }

  if (pendingDeletes.size) {
    const sent = [...pendingDeletes]
    const { error } = await supabase.from(TABLE).delete().eq('user_id', uid).in('k', sent)
    if (error) failed = true
    else for (const k of sent) pendingDeletes.delete(k)
  }

  persistMeta()

  if (failed) {
    // Backoff exponentiel plafonné (800 ms → 30 s).
    failures = Math.min(failures + 1, 6)
    schedule(Math.min(FLUSH_MS * 2 ** failures, 30_000))
  } else {
    failures = 0
    if (pendingWrites.size || pendingDeletes.size) schedule()
  }
}

function safeParse(raw: string): unknown {
  try { return JSON.parse(raw) } catch { return null }
}
