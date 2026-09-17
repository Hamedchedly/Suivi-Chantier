// ────────────────────────────────────────────────────────────────────────────
// Planning history — immutable record of every planning version.
//
// Two structures:
//   PlanningSnapshot — full task tree at a point in time (for comparison view)
//   ChangeLogEntry   — per-task diff between two consecutive versions
//
// Principle: "never overwrite history" — only append.
// Persistence lives in repo.ts. Pure module.
// ────────────────────────────────────────────────────────────────────────────

import { GanttTask } from '../types/gantt'

export type SnapshotOrigin = 'initial' | 'manual' | 'auto-replan' | 'visit'

export interface PlanningSnapshot {
  id: string
  savedAt: string            // ISO datetime
  label: string              // e.g. "Contractuel initial", "Modification S37"
  origin: SnapshotOrigin
  tasks: GanttTask[]         // full tree (dates revived by storage.ts)
}

export interface ChangeLogEntry {
  id: string
  at: string                 // ISO datetime
  taskId: string
  taskTitle: string
  lotId: string
  lotTitle: string
  oldStart: string           // ISO yyyy-mm-dd
  newStart: string
  oldEnd: string
  newEnd: string
  deltaEndDays: number       // positive = later end (delay)
  origin: 'manual' | 'auto-replan' | 'visit' | 'dependency'
  cause?: string             // e.g. "retard du prédécesseur Peinture"
}

const isoDate = (d: Date): string => {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

const MS = 86400000
const sod = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

function uid(prefix: string) {
  return `${prefix}${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

export function makeSnapshotId(): string { return uid('snap-') }
export function makeChangeId(): string { return uid('chg-') }

/** Human-readable label for a new snapshot. */
export function snapshotLabel(origin: SnapshotOrigin, date: Date = new Date()): string {
  const d = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  switch (origin) {
    case 'initial': return 'Contractuel initial'
    case 'manual': return `Modification manuelle — ${d}`
    case 'auto-replan': return `Auto-replanification — ${d}`
    case 'visit': return `Constat de visite — ${d}`
  }
}

/** Flatten all leaf tasks from the tree. */
function flatLeaves(tasks: GanttTask[]): GanttTask[] {
  const acc: GanttTask[] = []
  const walk = (arr: GanttTask[]) => {
    for (const t of arr) {
      if (t.children?.length) walk(t.children)
      else acc.push(t)
    }
  }
  walk(tasks)
  return acc
}

/** Build a lotId → lotTitle map from the top-level lot array. */
export function buildLotTitleMap(tasks: GanttTask[]): Map<string, string> {
  return new Map(tasks.map(l => [l.lot_id, l.title]))
}

/** Detect planned_start / planned_end changes between two task trees.
 * Returns changelog entries for every leaf that changed dates. */
export function detectChanges(
  before: GanttTask[],
  after: GanttTask[],
  origin: ChangeLogEntry['origin'],
  cause?: string,
): ChangeLogEntry[] {
  const bLeaves = flatLeaves(before)
  const aLeaves = flatLeaves(after)
  const bMap = new Map(bLeaves.map(t => [t.id, t]))
  const lotTitles = buildLotTitleMap(before)

  const now = new Date().toISOString()
  const changes: ChangeLogEntry[] = []

  for (const t of aLeaves) {
    const b = bMap.get(t.id)
    if (!b) continue
    const oldStart = isoDate(b.planned_start)
    const newStart = isoDate(t.planned_start)
    const oldEnd = isoDate(b.planned_end)
    const newEnd = isoDate(t.planned_end)
    if (oldStart === newStart && oldEnd === newEnd) continue
    const deltaEndDays = Math.round(
      (sod(t.planned_end).getTime() - sod(b.planned_end).getTime()) / MS,
    )
    changes.push({
      id: makeChangeId(),
      at: now,
      taskId: t.id,
      taskTitle: t.title,
      lotId: t.lot_id,
      lotTitle: lotTitles.get(t.lot_id) ?? t.lot_id,
      oldStart, newStart, oldEnd, newEnd,
      deltaEndDays,
      origin, cause,
    })
  }
  return changes
}

/** Keep only the most recent N snapshots (rotate older ones). */
export function pruneHistory(history: PlanningSnapshot[], maxCount = 20): PlanningSnapshot[] {
  if (history.length <= maxCount) return history
  return history.slice(-maxCount)
}
