// ────────────────────────────────────────────────────────────────────────────
// Visit domain — a chantier visit is a GLOBAL control session, not a wizard.
//
// Design (validated with the user):
//  · A visit holds selected zones (logements / communs / techniques / extérieurs);
//    each zone carries per-lot task checks with their own state.
//  · Progress is computed from elements REALLY controlled, never from the number
//    of zones opened.
//  · "Points à revoir" are Reserves tagged with `visitId` (unified concept —
//    a single reprises list across the app), surfaced back per visit.
//  · The visit is only closed when the user explicitly terminates it; ending a
//    single zone never closes the visit.
//  · On terminate, the live planning is frozen into `snapshot` so the CR shows a
//    historical photograph, decoupled from later planning edits.
//
// This module is pure (no I/O). Persistence lives in repo.ts, UI in pages/Visite.
// ────────────────────────────────────────────────────────────────────────────

import type { Reserve } from './reserves'
import type { GanttTask } from '../types/gantt'
import { flattenLeaves, lotSummaries, overallProgress, maxDrift, lateTasks, driftDays } from './schedule'

// ── Roles & participants ─────────────────────────────────────────────────────

export const ROLES = [
  'MOA', 'MOE', 'AMO', 'OPC', 'Entreprise',
  'Conducteur de travaux', 'Responsable de patrimoine',
] as const
export type Role = typeof ROLES[number]

export interface Participant {
  id: string
  name: string
  role: Role
}

// ── Zone / task states ───────────────────────────────────────────────────────

export type ZoneKind = 'logement' | 'commun' | 'technique' | 'exterieur'
export type ZoneState = 'not_started' | 'in_progress' | 'done' | 'to_review' | 'blocked'

// Per-lot checkpoint within a zone.
export type TaskState = 'not_checked' | 'ok' | 'to_review' | 'blocked' | 'na'

export interface VisitTaskCheck {
  lotId: string
  state: TaskState
  comment?: string
}

export interface VisitZone {
  refId: string          // catalog id (logement/zone)
  label: string
  kind: ZoneKind
  tasks: VisitTaskCheck[]
  // Explicit user pin. `null` = derive from tasks; otherwise forces the state.
  override?: 'to_review' | 'blocked' | null
}

// ── Visit ────────────────────────────────────────────────────────────────────

export type VisitStatus = 'en_cours' | 'terminee' | 'cr_pret' | 'diffuse' | 'verrouille'

export interface PlanningSnapshotLot {
  lotId: string
  title: string
  progress: number
  drift: number
  late: boolean
}
export interface PlanningSnapshotTask {
  id: string
  title: string
  lotId: string
  progress: number
  status: string
  plannedStart: string   // ISO
  plannedEnd: string     // ISO
  drift: number
  isMilestone: boolean
}
export interface PlanningSnapshot {
  capturedAt: string     // ISO datetime
  overall: number
  maxDrift: number
  lateCount: number
  lots: PlanningSnapshotLot[]
  tasks: PlanningSnapshotTask[]
}

// Editable CR draft, built from the visit then hand-tuned before diffusion.
export interface CrData {
  synthese: string
  conclusions: string
  nextMeeting: string
  // Ordered observation/reserve ids selected for the CR (empty = all open ones).
  reserveOrder: string[]
  // Ordered photo ids selected for the CR.
  photoOrder: string[]
}

export interface AuditEntry {
  at: string             // ISO datetime
  by: string             // user label (simulated until auth)
  field: string
  from: string
  to: string
}

export interface Visit {
  id: string
  date: string           // ISO yyyy-mm-dd
  title?: string
  status: VisitStatus
  participants: Participant[]
  zones: VisitZone[]
  snapshot?: PlanningSnapshot
  cr?: CrData
  createdAt: string      // ISO datetime
  diffusedAt?: string    // ISO datetime
  auditLog?: AuditEntry[]
}

// ── Zone construction ────────────────────────────────────────────────────────

export function makeZone(refId: string, label: string, kind: ZoneKind, lotIds: string[]): VisitZone {
  return { refId, label, kind, override: null, tasks: lotIds.map(lotId => ({ lotId, state: 'not_checked' as TaskState })) }
}

// ── State derivation ─────────────────────────────────────────────────────────

/**
 * Zone state, derived from its task checks unless the user pinned an override.
 * Precedence: blocked > to_review > done > in_progress > not_started.
 * `na` (non applicable) tasks are excluded from the applicable set.
 */
export function zoneState(z: VisitZone): ZoneState {
  if (z.override === 'blocked') return 'blocked'
  const applicable = z.tasks.filter(t => t.state !== 'na')
  const controlled = applicable.filter(t => t.state !== 'not_checked')
  if (controlled.length === 0) return z.override === 'to_review' ? 'to_review' : 'not_started'
  const anyReview = z.override === 'to_review' || applicable.some(t => t.state === 'to_review')
  if (anyReview) return 'to_review'
  if (controlled.length === applicable.length) return 'done'
  return 'in_progress'
}

/**
 * Zone completion %, based on elements REALLY controlled: done tasks over
 * controlled tasks (na excluded). Example — 3 terminé + 1 à-revoir + 1 non
 * contrôlé → 3 done / 4 controlled = 75 %.
 */
export function zoneProgress(z: VisitZone): number {
  const applicable = z.tasks.filter(t => t.state !== 'na')
  const controlled = applicable.filter(t => t.state !== 'not_checked')
  if (controlled.length === 0) return 0
  const done = applicable.filter(t => t.state === 'ok').length
  return Math.round((done / controlled.length) * 100)
}

export interface VisitCounts {
  total: number
  not_started: number
  in_progress: number
  done: number
  to_review: number
  blocked: number
}

export function visitCounts(v: Visit): VisitCounts {
  const c: VisitCounts = { total: v.zones.length, not_started: 0, in_progress: 0, done: 0, to_review: 0, blocked: 0 }
  for (const z of v.zones) c[zoneState(z)]++
  return c
}

/**
 * Global visit progress — done tasks over ALL applicable tasks across every
 * selected zone (untouched zones legitimately drag it down). Never based on the
 * count of zones opened.
 */
export function visitProgress(v: Visit): number {
  let done = 0
  let applicable = 0
  for (const z of v.zones) {
    for (const t of z.tasks) {
      if (t.state === 'na') continue
      applicable++
      if (t.state === 'ok') done++
    }
  }
  if (applicable === 0) return 0
  return Math.round((done / applicable) * 100)
}

/** Zones still needing control (blocking an implicit close): not_started + in_progress. */
export function remainingToControl(v: Visit): VisitZone[] {
  return v.zones.filter(z => {
    const s = zoneState(z)
    return s === 'not_started' || s === 'in_progress'
  })
}

/** Distinct lot ids touched by the visit's zones. */
export function visitLotIds(v: Visit): string[] {
  const set = new Set<string>()
  for (const z of v.zones) for (const t of z.tasks) set.add(t.lotId)
  return [...set]
}

// ── Points à revoir = reserves tagged with visitId ───────────────────────────

export function reservesForVisit(reserves: Reserve[], visitId: string): Reserve[] {
  return reserves.filter(r => r.visitId === visitId)
}

// ── Planning snapshot ────────────────────────────────────────────────────────

const iso = (d: Date): string => d.toISOString()

/** Freeze the live planning into a self-contained historical photograph. */
export function buildPlanningSnapshot(tasks: GanttTask[], today: Date): PlanningSnapshot {
  const lots = lotSummaries(tasks, today).map(l => ({
    lotId: l.lotId, title: l.title, progress: l.progress, drift: l.drift, late: l.late,
  }))
  const snapTasks: PlanningSnapshotTask[] = flattenLeaves(tasks).map(t => ({
    id: t.id,
    title: t.title,
    lotId: t.lot_id,
    progress: t.progress,
    status: t.status,
    plannedStart: iso(t.planned_start),
    plannedEnd: iso(t.planned_end),
    drift: driftDays(t),
    isMilestone: t.is_milestone,
  }))
  return {
    capturedAt: new Date().toISOString(),
    overall: overallProgress(tasks),
    maxDrift: maxDrift(tasks),
    lateCount: lateTasks(tasks, today).length,
    lots,
    tasks: snapTasks,
  }
}

// ── Factories ────────────────────────────────────────────────────────────────

export function emptyCr(): CrData {
  return {
    synthese: '',
    conclusions: '',
    nextMeeting: '',
    reserveOrder: [],
    photoOrder: [],
  }
}

export function newVisit(date: string, participants: Participant[], zones: VisitZone[], title?: string): Visit {
  return {
    id: `VS${Date.now()}`,
    date,
    title: title?.trim() || undefined,
    status: 'en_cours',
    participants,
    zones,
    createdAt: new Date().toISOString(),
  }
}
