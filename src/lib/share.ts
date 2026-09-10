import LZString from 'lz-string'
import { GanttTask } from '../types/gantt'
import { Reserve } from './reserves'
import { Marche, Avenant, Situation } from './finance'
import { serialize, deserialize } from './storage'
import { getGanttTasks, getReserves, getMarches, getAvenants, getSituations } from './repo'

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
}

const PROJECT: ShareProject = {
  name: 'Gambetta — Réhabilitation',
  ref: 'GAM-2026-001',
  address: '111 Rue Gambetta, 51100 Reims',
}

/** Gather the MOA-relevant state. Reserve photos are stripped to keep URLs small. */
export function buildSnapshot(): Snapshot {
  return {
    v: 1,
    createdAt: new Date().toISOString(),
    project: PROJECT,
    tasks: getGanttTasks(),
    reserves: getReserves().map(r => ({ ...r, photo: undefined })),
    marches: getMarches(),
    avenants: getAvenants(),
    situations: getSituations(),
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
