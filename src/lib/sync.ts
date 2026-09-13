// ────────────────────────────────────────────────────────────────────────────
// Synchronisation des données avec Supabase (table public.app_state).
//
// Modèle : miroir clé-valeur 1:1 du modèle local. localStorage reste le cache
// SYNCHRONE (les lectures des composants ne changent pas) ; le serveur est la
// copie durable, partagée entre appareils.
//
//   • hydrateFromRemote(uid) — à la connexion : recopie l'état serveur dans
//     localStorage (le serveur fait autorité), après avoir purgé le cache local
//     pour ne jamais mélanger les données de deux comptes sur le même navigateur.
//   • enableSync(uid) — active le write-through : chaque saveState/removeState
//     est répercuté (débouncé) en upsert/delete sur app_state.
//   • disableSync() — à la déconnexion.
//
// Sécurité : seules l'URL et la clé publiable vivent côté client ; RLS limite
// chaque ligne à son user_id (= auth.uid()). Jamais de service_role ici.
// ────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import { onStateWrite, onStateRemove } from './storage'

const TABLE = 'app_state'
const FLUSH_MS = 800

/** Clés gérées par Supabase Auth / profiles — jamais synchronisées ici. */
const EXCLUDE = new Set(['sc-users-v1', 'sc-session-v1'])

/** Préfixe commun à toutes les clés applicatives (cache à purger au besoin). */
const APP_PREFIX = 'sc-'

let userId: string | null = null
let enabled = false
let listenersBound = false

const pendingWrites = new Map<string, string>() // clé → valeur sérialisée (raw)
const pendingDeletes = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let failures = 0 // compteur d'échecs consécutifs pour le backoff

/** Purge du cache local toutes les clés applicatives (changement de compte). */
export function clearLocalAppState(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(APP_PREFIX) && !EXCLUDE.has(key)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // indisponible — ignore
  }
}

/**
 * Recopie l'état serveur de l'utilisateur dans localStorage. Le serveur fait
 * autorité : les valeurs locales divergentes (édition hors-ligne) sont écrasées.
 * Retourne le nombre de clés hydratées.
 */
export async function hydrateFromRemote(uid: string): Promise<number> {
  if (!supabase) return 0
  const { data, error } = await supabase.from(TABLE).select('k, v').eq('user_id', uid)
  if (error || !data) return 0
  for (const row of data as { k: string; v: unknown }[]) {
    if (EXCLUDE.has(row.k)) continue
    try {
      // v est l'objet JSON (marqueurs {__date} sous forme d'objets simples) :
      // re-sérialisé tel quel, loadState ravive les dates au prochain accès.
      localStorage.setItem(row.k, JSON.stringify(row.v))
    } catch {
      // storage plein — on continue
    }
  }
  return data.length
}

/** Active le write-through pour cet utilisateur. */
export function enableSync(uid: string): void {
  userId = uid
  enabled = true
  if (!listenersBound) {
    onStateWrite(onLocalWrite)
    onStateRemove(onLocalRemove)
    listenersBound = true
  }
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
  schedule()
}

function onLocalRemove(key: string): void {
  if (!enabled || !userId || EXCLUDE.has(key)) return
  pendingWrites.delete(key)
  pendingDeletes.add(key)
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

  // Les entrées envoyées ne sont retirées des files qu'en cas de succès : un
  // échec réseau les conserve pour une nouvelle tentative (avec backoff), sans
  // écraser les écritures survenues pendant l'appel.
  if (pendingWrites.size) {
    const sent = [...pendingWrites.entries()]
    const now = new Date().toISOString()
    const rows = sent.map(([k, raw]) => ({ user_id: uid, k, v: safeParse(raw), updated_at: now }))
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'user_id,k' })
    if (error) failed = true
    else for (const [k, raw] of sent) if (pendingWrites.get(k) === raw) pendingWrites.delete(k)
  }

  if (pendingDeletes.size) {
    const sent = [...pendingDeletes]
    const { error } = await supabase.from(TABLE).delete().eq('user_id', uid).in('k', sent)
    if (error) failed = true
    else for (const k of sent) pendingDeletes.delete(k)
  }

  if (failed) {
    // Backoff exponentiel plafonné (800 ms → 30 s) pour ne pas marteler le serveur.
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
