// Stockage de la visite v2 : cache local synchrone + envoi distant (table visit_sessions_v2).
// Le cache est lu immédiatement à l'ouverture ; l'envoi se fait à la sortie d'un lot,
// d'un logement, de la page ou à la clôture (voir pages/VisiteV2.tsx).

import { supabase } from '../supabase'
import { mergeSessions, type V2Session } from './model'

const TABLE = 'visit_sessions_v2'
const cacheKey = (projectId: string) => `visit-v2-sessions:${projectId}`

export function loadCache(projectId: string): V2Session[] {
  try {
    const raw = localStorage.getItem(cacheKey(projectId))
    return raw ? (JSON.parse(raw) as V2Session[]) : []
  } catch {
    return []
  }
}

export function saveCache(projectId: string, sessions: V2Session[]): void {
  try {
    localStorage.setItem(cacheKey(projectId), JSON.stringify(sessions))
  } catch {
    // quota ou navigation privée : le distant reste la copie de référence
  }
}

export type SyncResult = 'synced' | 'offline' | 'error'

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function pushSession(projectId: string, s: V2Session): Promise<SyncResult> {
  const uid = await currentUserId()
  if (!supabase || !uid) return 'offline'
  const { error } = await supabase.from(TABLE).upsert(
    { user_id: uid, id: s.id, project_id: projectId, data: s, updated_at: s.updatedAt },
    { onConflict: 'user_id,id' },
  )
  return error ? 'error' : 'synced'
}

/** Sessions distantes du projet fusionnées avec le cache ; null si indisponible. */
export async function pullSessions(projectId: string): Promise<V2Session[] | null> {
  const uid = await currentUserId()
  if (!supabase || !uid) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', uid)
    .eq('project_id', projectId)
  if (error || !data) return null
  return mergeSessions(loadCache(projectId), data.map(r => r.data as V2Session))
}
