// ────────────────────────────────────────────────────────────────────────────
// Visit domain — a session (visite OU réunion de chantier) is a GLOBAL control
// pass over the planning, not a wizard.
//
// Design (validated with the user):
//  · A session declares its KIND (visite de chantier / réunion de chantier) and
//    the participants present.
//  · It holds selected zones (bâtiment → logement / communs / technique / ext.).
//    Each zone carries the planning's real LEAF TASKS, grouped by lot, so the
//    user can collapse to lot level or expand to tick task by task.
//  · Each check records the observed progress (%) — which feeds the Gantt on
//    close — plus a qualitative state, and may carry a NEW promised end date.
//  · The three dates never overwrite each other: contractual (baseline) and the
//    planning date are frozen INTO the check when the session opens, and the new
//    promise is appended to the commitments log (see commitments.ts).
//  · "Points à revoir" are Reserves tagged with `visitId` (unified concept).
//  · Notes can target everyone or one specific company.
//  · The session only closes when explicitly terminated; finishing one logement
//    just moves on to the next.
//  · On close, observations are APPLIED to the planning, then the planning is
//    frozen into `snapshot` so the CR shows a historical photograph.
//
// This module is pure (no I/O). Persistence lives in repo.ts, UI in pages/Visite.
// ────────────────────────────────────────────────────────────────────────────

import type { Reserve } from './reserves'
import type { GanttTask, TaskStatus } from '../types/gantt'
import type { DateCommitment } from './commitments'
import { flattenLeaves, lotSummaries, overallProgress, maxDrift, lateTasks, driftDays, diffDays, startOfDay } from './schedule'

// ── Session kind ─────────────────────────────────────────────────────────────

export type VisitKind = 'visite' | 'reunion'

export const VISIT_KIND_LABEL: Record<VisitKind, string> = {
  visite: 'Visite de chantier',
  reunion: 'Réunion de chantier',
}

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

export type TaskState = 'not_checked' | 'ok' | 'to_review' | 'blocked' | 'na'

/**
 * One checkpoint on a real planning task. `baselineEnd` / `plannedEnd` are
 * copied in when the session opens so the CR keeps the dates as they stood that
 * day, whatever happens to the planning afterwards.
 */
export interface VisitTaskCheck {
  taskId: string
  lotId: string
  title: string
  state: TaskState
  progress?: number        // % observed on site (undefined = not filled in)
  comment?: string
  baselineEnd?: string     // ISO yyyy-mm-dd — contractual, frozen
  plannedEnd?: string      // ISO yyyy-mm-dd — planning the day of the session
  promisedEnd?: string     // ISO yyyy-mm-dd — new date announced by the company
  company?: string
}

export interface VisitZone {
  refId: string            // catalog id (logement / zone)
  label: string
  kind: ZoneKind
  buildingId: string
  buildingLabel: string
  tasks: VisitTaskCheck[]
  // Explicit user pin. `null` = derive from tasks; otherwise forces the state.
  override?: 'to_review' | 'blocked' | null
  closedAt?: string        // ISO datetime — "logement terminé", set explicitly
}

// ── Notes ────────────────────────────────────────────────────────────────────

export interface VisitNote {
  id: string
  scope: 'all' | 'company'
  company?: string         // required when scope === 'company'
  text: string
  createdAt: string        // ISO datetime
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
  reserveOrder: string[]
  photoOrder: string[]
}

export interface AuditEntry {
  at: string
  by: string
  field: string
  from: string
  to: string
}

export interface Visit {
  id: string
  kind: VisitKind
  date: string           // ISO yyyy-mm-dd
  title?: string
  status: VisitStatus
  participants: Participant[]
  zones: VisitZone[]
  notes: VisitNote[]
  snapshot?: PlanningSnapshot
  cr?: CrData
  createdAt: string      // ISO datetime
  diffusedAt?: string    // ISO datetime
  auditLog?: AuditEntry[]
}

// ── Zone construction from the live planning ─────────────────────────────────

// Day <-> ISO conversions stay in LOCAL time on purpose: the planning stores
// local midnights, and going through toISOString() would shift the day for any
// timezone behind/ahead of UTC.
const isoDay = (date: Date): string => {
  const x = startOfDay(date)
  return `${x.getFullYear()}-${`${x.getMonth() + 1}`.padStart(2, '0')}-${`${x.getDate()}`.padStart(2, '0')}`
}

const parseDay = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export interface ZoneRef {
  refId: string
  label: string
  kind: ZoneKind
  buildingId: string
  buildingLabel: string
}

/**
 * Build a session's zones from the real planning: every leaf task attached to a
 * selected logement becomes a checkpoint, carrying its contractual and planned
 * dates. A zone with no planning task stays valid (notes / photos / réserves).
 */
export function buildZonesFromPlanning(tasks: GanttTask[], refs: ZoneRef[]): VisitZone[] {
  const leaves = flattenLeaves(tasks)
  return refs.map(ref => ({
    refId: ref.refId,
    label: ref.label,
    kind: ref.kind,
    buildingId: ref.buildingId,
    buildingLabel: ref.buildingLabel,
    override: null,
    tasks: leaves
      .filter(t => t.logement_id === ref.refId)
      .map(t => ({
        taskId: t.id,
        lotId: t.lot_id,
        title: t.title,
        state: 'not_checked' as TaskState,
        baselineEnd: t.baseline_end ? isoDay(t.baseline_end) : undefined,
        plannedEnd: isoDay(t.planned_end),
        company: t.company_id,
      })),
  }))
}

// ── Lot grouping (collapse / expand) ─────────────────────────────────────────

export interface LotGroup {
  lotId: string
  tasks: VisitTaskCheck[]
}

/** Group a zone's checks by lot, preserving first-seen lot order. */
export function lotGroups(z: VisitZone): LotGroup[] {
  const out: LotGroup[] = []
  for (const t of z.tasks) {
    const g = out.find(x => x.lotId === t.lotId)
    if (g) g.tasks.push(t)
    else out.push({ lotId: t.lotId, tasks: [t] })
  }
  return out
}

/** Qualitative state of a set of checks. Precedence: blocked > to_review > done > in_progress > not_started. */
export function tasksState(tasks: VisitTaskCheck[]): ZoneState {
  const applicable = tasks.filter(t => t.state !== 'na')
  const controlled = applicable.filter(t => t.state !== 'not_checked')
  if (applicable.some(t => t.state === 'blocked')) return 'blocked'
  if (applicable.some(t => t.state === 'to_review')) return 'to_review'
  if (controlled.length === 0) return 'not_started'
  return controlled.length === applicable.length ? 'done' : 'in_progress'
}

/** Observed works progress (%) — mean of the observed percentages, na excluded. */
export function tasksWorksProgress(tasks: VisitTaskCheck[]): number {
  const applicable = tasks.filter(t => t.state !== 'na')
  if (applicable.length === 0) return 0
  const sum = applicable.reduce((s, t) => s + (t.progress ?? 0), 0)
  return Math.round(sum / applicable.length)
}

/** Control progress (%) — how much of the tour has been inspected, na excluded. */
export function tasksControlProgress(tasks: VisitTaskCheck[]): number {
  const applicable = tasks.filter(t => t.state !== 'na')
  if (applicable.length === 0) return 0
  const controlled = applicable.filter(t => t.state !== 'not_checked').length
  return Math.round((controlled / applicable.length) * 100)
}

// ── Zone derivation ──────────────────────────────────────────────────────────

export function zoneState(z: VisitZone): ZoneState {
  if (z.override === 'blocked') return 'blocked'
  if (z.override === 'to_review') return 'to_review'
  if (z.closedAt) return 'done'
  if (z.tasks.length === 0) return 'not_started'
  return tasksState(z.tasks)
}

export function zoneWorksProgress(z: VisitZone): number {
  return tasksWorksProgress(z.tasks)
}

export function zoneControlProgress(z: VisitZone): number {
  return tasksControlProgress(z.tasks)
}

// ── Visit aggregation ────────────────────────────────────────────────────────

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

const allChecks = (v: Visit): VisitTaskCheck[] => v.zones.flatMap(z => z.tasks)

/** How far the tour has gone — controlled checks over all applicable ones. */
export function visitControlProgress(v: Visit): number {
  return tasksControlProgress(allChecks(v))
}

/** Works progress observed across the whole session. */
export function visitWorksProgress(v: Visit): number {
  return tasksWorksProgress(allChecks(v))
}

/** Zones still needing control: not closed and not fully checked. */
export function remainingToControl(v: Visit): VisitZone[] {
  return v.zones.filter(z => {
    const s = zoneState(z)
    return s === 'not_started' || s === 'in_progress'
  })
}

/** Distinct lot ids touched by the session. */
export function visitLotIds(v: Visit): string[] {
  return [...new Set(allChecks(v).map(t => t.lotId))]
}

/** Next zone to visit after `refId` — the following one still not closed, else null. */
export function nextZoneRef(v: Visit, refId: string): string | null {
  const i = v.zones.findIndex(z => z.refId === refId)
  if (i < 0) return null
  const after = v.zones.slice(i + 1).find(z => !z.closedAt)
  if (after) return after.refId
  const before = v.zones.slice(0, i).find(z => !z.closedAt)
  return before?.refId ?? null
}

// ── Points à revoir = reserves tagged with visitId ───────────────────────────

export function reservesForVisit(reserves: Reserve[], visitId: string): Reserve[] {
  return reserves.filter(r => r.visitId === visitId)
}

// ── Notes ────────────────────────────────────────────────────────────────────

export function notesForCompany(v: Visit, company: string): VisitNote[] {
  return v.notes.filter(n => n.scope === 'company' && n.company === company)
}

export function generalNotes(v: Visit): VisitNote[] {
  return v.notes.filter(n => n.scope === 'all')
}

// ── Applying the session back onto the planning ──────────────────────────────

function statusFor(check: VisitTaskCheck, current: TaskStatus): TaskStatus {
  if (check.state === 'blocked') return 'blocked'
  if (check.progress === undefined) return current
  if (check.progress >= 100) return 'completed'
  if (check.progress > 0) return 'in-progress'
  return 'not-started'
}

/**
 * Apply what was observed to the planning: progress, status and — when a new
 * end date was promised — planned_end (duration follows). The contractual
 * baseline is never touched. Parent lots are recomputed from their children.
 * Pure: returns a new task tree.
 */
export function applyVisitToPlanning(tasks: GanttTask[], v: Visit): GanttTask[] {
  const byId = new Map<string, VisitTaskCheck>()
  for (const c of allChecks(v)) {
    if (c.state === 'na' || c.state === 'not_checked') continue
    byId.set(c.taskId, c)
  }
  if (byId.size === 0) return tasks

  const applyLeaf = (t: GanttTask): GanttTask => {
    const c = byId.get(t.id)
    if (!c) return t
    const next: GanttTask = { ...t }
    if (c.progress !== undefined) next.progress = Math.max(0, Math.min(100, Math.round(c.progress)))
    next.status = statusFor(c, t.status)
    if (c.promisedEnd) {
      const end = parseDay(c.promisedEnd)
      if (!isNaN(end.getTime())) {
        next.planned_end = end
        next.planned_duration = Math.max(1, diffDays(next.planned_start, end) + 1)
      }
    }
    return next
  }

  const walk = (list: GanttTask[]): GanttTask[] => list.map(t => {
    if (t.children && t.children.length > 0) {
      const children = walk(t.children)
      const sum = children.reduce((s, c) => s + c.progress, 0)
      return { ...t, children, progress: Math.round(sum / children.length) }
    }
    return applyLeaf(t)
  })

  return walk(tasks)
}

/** The date promises taken during this session, ready to append to the log. */
export function commitmentsFromVisit(v: Visit): DateCommitment[] {
  const out: DateCommitment[] = []
  for (const c of allChecks(v)) {
    if (!c.promisedEnd) continue
    out.push({
      id: `dc-${v.id}-${c.taskId}`,
      taskId: c.taskId,
      lotId: c.lotId,
      company: c.company,
      promisedEnd: c.promisedEnd,
      at: new Date().toISOString(),
      visitId: v.id,
      visitDate: v.date,
    })
  }
  return out
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
  return { synthese: '', conclusions: '', nextMeeting: '', reserveOrder: [], photoOrder: [] }
}

export function newVisit(kind: VisitKind, date: string, participants: Participant[], zones: VisitZone[], title?: string): Visit {
  return {
    id: `VS${Date.now()}`,
    kind,
    date,
    title: title?.trim() || undefined,
    status: 'en_cours',
    participants,
    zones,
    notes: [],
    createdAt: new Date().toISOString(),
  }
}
