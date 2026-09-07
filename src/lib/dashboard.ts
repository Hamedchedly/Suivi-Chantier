// Pure dashboard & history aggregation. All functions are side-effect free.
//
// Aggregation rules (documented choice):
// - Only task_type === 'item' tasks participate in progress. Sections never do.
// - Operation/lot level: each item contributes its LATEST entry across the whole
//   operation (any localisation). A general lot task is therefore counted once,
//   not once per localisation, which avoids double counting.
// - Location level (building / unit): each item contributes its latest entry
//   recorded FOR that unit. A general task without an entry in that unit counts
//   as untracked there (it never borrows another unit's value).
// - Averages use progressAverage() (simple by default; quantity/amount supported).
// - Items without any entry are 'untracked' and excluded from averages; they are
//   never shown as 0 %.
// - Done/started/blocked counts rely on the recorded STATUS (physical percentage
//   and operational status remain independent).

import { progressAverage } from './progress'
import type { ProgressEntry, Task, Unit } from './types'

const taskKey = (row: ProgressEntry): string => `${row.task_id ?? ''}|${row.unit_id ?? ''}`

const compareRows = (a: ProgressEntry, b: ProgressEntry): number =>
  a.progressed_at.localeCompare(b.progressed_at) || a.created_at.localeCompare(b.created_at)

export function historyAsc(rows: ProgressEntry[]): ProgressEntry[] {
  return [...rows].sort(compareRows)
}

/** Latest entry per task, whatever its localisation (ties resolved by date/id). */
export function latestPerTask(rows: ProgressEntry[]): Map<string, ProgressEntry> {
  const latest = new Map<string, ProgressEntry>()
  for (const row of historyAsc(rows)) {
    if (row.task_id !== null) latest.set(row.task_id, row)
  }
  return latest
}

/** Latest entry per (task, unit) pair. */
export function latestPerTaskAndUnit(rows: ProgressEntry[]): Map<string, ProgressEntry> {
  const latest = new Map<string, ProgressEntry>()
  for (const row of historyAsc(rows)) {
    if (row.task_id !== null) latest.set(taskKey(row), row)
  }
  return latest
}

export interface Evolution {
  latest: ProgressEntry | null
  previous: ProgressEntry | null
  deltaPoints: number | null
  direction: 'up' | 'down' | 'same' | 'none'
  first: boolean
}

export function evolution(rows: ProgressEntry[]): Evolution {
  const asc = historyAsc(rows)
  if (asc.length === 0) return { latest: null, previous: null, deltaPoints: null, direction: 'none', first: false }
  const latest = asc[asc.length - 1]
  if (asc.length === 1) return { latest, previous: null, deltaPoints: null, direction: 'none', first: true }
  const previous = asc[asc.length - 2]
  if (latest.percentage === null || previous.percentage === null) {
    return { latest, previous, deltaPoints: null, direction: 'none', first: false }
  }
  const deltaPoints = Number(latest.percentage) - Number(previous.percentage)
  return { latest, previous, deltaPoints, direction: deltaPoints > 0 ? 'up' : deltaPoints < 0 ? 'down' : 'same', first: false }
}

export interface Point {
  has: boolean
  percentage: number | null
  status: string | null
  quantity: number | null
  amount: number | null
}

export function taskPoint(task: Task, snapshot: ProgressEntry | undefined): Point {
  return snapshot
    ? { has: true, percentage: snapshot.percentage, status: snapshot.status, quantity: task.quantity, amount: task.amount }
    : { has: false, percentage: null, status: null, quantity: task.quantity, amount: task.amount }
}

export interface ScopeMetrics {
  total: number
  tracked: number
  untracked: number
  started: number
  inProgress: number
  done: number
  blocked: number
  notStarted: number
  average: number | null
}

export function metricsFromPoints(points: Point[]): ScopeMetrics {
  const total = points.length
  const trackedPoints = points.filter((point) => point.has)
  const tracked = trackedPoints.length
  const done = trackedPoints.filter((point) => point.status === 'done').length
  const inProgress = trackedPoints.filter((point) => point.status === 'in_progress').length
  const blocked = trackedPoints.filter((point) => point.status === 'blocked').length
  const notStarted = trackedPoints.filter((point) => point.status === 'not_started').length
  const started = done + inProgress
  const average = progressAverage(
    trackedPoints
      .filter((point) => point.percentage !== null && point.status !== 'not_applicable')
      .map((point) => ({ percentage: point.percentage, status: point.status ?? '', quantity: point.quantity, amount: point.amount }))
  )
  return { total, tracked, untracked: total - tracked, started, inProgress, done, blocked, notStarted, average }
}

export function itemPoints(tasks: Task[], snapshotOf: (taskId: string) => ProgressEntry | undefined): Point[] {
  return tasks
    .filter((task) => task.task_type === 'item')
    .map((task) => taskPoint(task, snapshotOf(task.id)))
}

export function descendants(unitId: string, units: Unit[]): string[] {
  const result: string[] = []
  const walk = (id: string) => {
    result.push(id)
    for (const unit of units) if (unit.parent_id === id) walk(unit.id)
  }
  walk(unitId)
  return result
}

/**
 * History filtered for one location. Passing null keeps every location
 * (used by the "Toutes les localisations" option).
 */
export function filterHistoryRows(rows: ProgressEntry[], unitId: string | null): ProgressEntry[] {
  if (unitId === null) return rows
  return rows.filter((row) => row.unit_id === unitId)
}