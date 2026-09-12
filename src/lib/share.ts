import LZString from 'lz-string'
import { GanttTask } from '../types/gantt'
import { Reserve } from './reserves'
import { Marche, Avenant, Situation } from './finance'
import { serialize, deserialize } from './storage'
import { getGanttTasks, getReserves, getMarches, getAvenants, getSituations, getProjects, getCurrentProjectId, getZoneRefs } from './repo'
import { findProject } from './projects'

export interface ShareProject {
  name: string
  ref: string
  address: string
}

export interface Snapshot {
  v: 1
  createdAt: string
  project: ShareProject
  tasks: GanttTask[]
  reserves: Reserve[]
  marches: Marche[]
  avenants: Avenant[]
  situations: Situation[]
  /** Libellés des zones (refId → libellé), pour situer les réserves côté MOA. */
  zones?: Record<string, string>
}

/** En-tête du lien partagé : l'opération active, ou un libellé neutre si aucune. */
function shareProject(): ShareProject {
  const p = findProject(getProjects(), getCurrentProjectId())
  if (!p) return { name: 'Opération', ref: '', address: '' }
  return { name: p.name, ref: p.reference ?? '', address: p.address ?? '' }
}

/** Gather the MOA-relevant state. Reserve photos are stripped to keep URLs small. */
export function buildSnapshot(): Snapshot {
  return {
    v: 1,
    createdAt: new Date().toISOString(),
    project: shareProject(),
    tasks: getGanttTasks(),
    reserves: getReserves().map(r => ({ ...r, photo: undefined })),
    marches: getMarches(),
    avenants: getAvenants(),
    situations: getSituations(),
    zones: Object.fromEntries(getZoneRefs().map(z => [z.refId, z.label])),
  }
}

export function encodeSnapshot(s: Snapshot): string {
  return LZString.compressToEncodedURIComponent(serialize(s))
}

export function decodeSnapshot(encoded: string): Snapshot | null {
  try {
    const raw = LZString.decompressFromEncodedURIComponent(encoded)
    if (!raw) return null
    const snap = deserialize<Snapshot>(raw)
    if (!snap || snap.v !== 1 || !Array.isArray(snap.tasks)) return null
    return snap
  } catch {
    return null
  }
}

export const SHARE_HASH_PREFIX = '#share='

export function buildShareUrl(s: Snapshot): string {
  return `${window.location.origin}/${SHARE_HASH_PREFIX}${encodeSnapshot(s)}`
}

/** If the current URL carries a share snapshot, decode it; else null. */
export function readShareFromUrl(): Snapshot | null {
  const hash = window.location.hash
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null
  return decodeSnapshot(hash.slice(SHARE_HASH_PREFIX.length))
}
