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
import type { DateCommitment, CommitmentType } from './commitments'
import { flattenLeaves, lotSummaries, overallProgress, maxDrift, lateTasks, driftDays, diffDays, startOfDay } from './schedule'
import { forecastDrift } from './forecast'
import { analyzePlanning, deriveTaskStatus } from './planningEngine'
import { recomputeAll, addBlockedTask } from './planning'

// ── Session kind ─────────────────────────────────────────────────────────────

export type VisitKind = 'visite' | 'reunion' | 'technique' | 'opl'

export const VISIT_KIND_LABEL: Record<VisitKind, string> = {
  visite: 'Visite de chantier',
  reunion: 'Réunion de chantier',
  technique: 'Visite technique',
  opl: 'OPL / pré-réception',
}

/**
 * A session can carry a name of its own ("OPL bâtiment A", "Visite CVC").
 * `kind` stays the underlying family so nothing downstream has to change;
 * `kindLabel`, when set, is what the user sees everywhere.
 */
export function visitKindLabel(v: Pick<Visit, 'kind' | 'kindLabel'>): string {
  return v.kindLabel?.trim() || VISIT_KIND_LABEL[v.kind]
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
  plannedProgress?: number // % the planning expected, frozen when the session opened
  comment?: string
  baselineEnd?: string     // ISO yyyy-mm-dd — contractual, frozen
  plannedEnd?: string      // ISO yyyy-mm-dd — planning the day of the session
  promisedEnd?: string     // ISO yyyy-mm-dd — derived from promisedWeek (its Friday)
  promisedWeek?: string    // ISO week the company committed to ("2026-W38")
  promisedLabel?: string   // what exactly was promised ("Livraison pompe")
  promisedType?: CommitmentType // 'debut' | 'fin' — undefined = 'fin' (legacy default)
  blockedBy?: string[]     // ids of the planning tasks holding this one up
  blocks?: string[]        // ids of the planning tasks this one holds up (symmetric direction)
  company?: string
  children?: VisitTaskCheck[] // sous-tâches
}

/** Gap between what the planning expected and what was observed, in points. */
export function progressGap(c: VisitTaskCheck): number | null {
  if (c.progress === undefined || c.plannedProgress === undefined) return null
  return c.progress - c.plannedProgress
}

/**
 * The state now follows what the user actually did rather than a separate row
 * of buttons: naming a blocker blocks the task, moving the slider marks it
 * inspected. An explicit "non applicable" set earlier is preserved.
 */
export function stateAfterEdit(c: Pick<VisitTaskCheck, 'state' | 'progress' | 'blockedBy'>): TaskState {
  if (c.blockedBy && c.blockedBy.length > 0) return 'blocked'
  if (c.state === 'na') return 'na'
  return c.progress === undefined ? 'not_checked' : 'ok'
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
  /** Dérive prévisionnelle max du lot (jours). null si aucune tâche n'a de prévision calculée. */
  forecastDays: number | null
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
  /** Prévision calculée à la clôture de la session — absente si aucun écart n'était projeté. */
  forecastEnd?: string   // ISO
  forecastDays: number | null
}
export interface PlanningSnapshot {
  capturedAt: string     // ISO datetime
  overall: number
  maxDrift: number
  lateCount: number
  lots: PlanningSnapshotLot[]
  tasks: PlanningSnapshotTask[]
  /** Fin de chantier prévisionnelle à date, et son écart vs la fin contractuelle. */
  forecastEnd?: string   // ISO
  forecastVarianceDays: number | null
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
  kindLabel?: string     // user-defined session name, overrides the standard one
  date: string           // ISO yyyy-mm-dd
  title?: string         // legacy free-text object, no longer captured
  status: VisitStatus
  participants: Participant[]
  companiesPresent?: string[]
  brief?: string         // observations générales noted before setting off
  zones: VisitZone[]
  notes: VisitNote[]
  startedAt?: string     // ISO datetime — stamped when the tour starts
  endedAt?: string       // ISO datetime — stamped on close
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
 * selected zone becomes a checkpoint, carrying its contractual and planned
 * dates. A zone with no planning task stays valid (notes / photos / réserves).
 *
 * `belongs` décide si une tâche concerne une zone. Par défaut on retombe sur
 * l'ancien champ `logement_id` ; le module Visite passe un résolveur basé sur
 * les rattachements tâche→unité saisis dans « Bâtiments & zones ».
 */
/**
 * Un VisitTaskCheck vierge pour une tâche du planning — même construction
 * que buildZonesFromPlanning en utilise pour peupler une zone, réutilisée
 * telle quelle quand une tâche créée EN COURS de visite doit rejoindre
 * immédiatement la tournée en cours (voir Visite.tsx, onAddPlanTask) : une
 * seule façon de fabriquer un VisitTaskCheck, jamais une deuxième.
 */
export function taskCheckFromPlanning(t: GanttTask): VisitTaskCheck {
  // Planned progress = what % should be done by today based on dates,
  // not the last recorded progress (which would show old observations).
  const today = new Date()
  let plannedProgress: number | undefined
  if (t.planned_start && t.planned_end) {
    if (today <= t.planned_start) plannedProgress = 0
    else if (today >= t.planned_end) plannedProgress = 100
    else {
      const total = t.planned_end.getTime() - t.planned_start.getTime()
      const elapsed = today.getTime() - t.planned_start.getTime()
      plannedProgress = Math.round((elapsed / total) * 100)
    }
  }
  return {
    taskId: t.id,
    lotId: t.lot_id,
    title: t.title,
    state: 'not_checked' as TaskState,
    plannedProgress,
    baselineEnd: isoDay(t.baseline_end ?? t.planned_end),
    plannedEnd: isoDay(t.planned_end),
    company: t.company_id,
    children: t.children ? t.children.map(taskCheckFromPlanning) : undefined,
  }
}

export function buildZonesFromPlanning(
  tasks: GanttTask[], refs: ZoneRef[],
  belongs: (task: GanttTask, refId: string) => boolean = (t, refId) => t.logement_id === refId,
  hideCompleted = false, // if true, filter out zones where all leaf tasks are completed
): VisitZone[] {
  // Get all root tasks (direct children of lots, not leaves)
  const allTasks = flattenAll(tasks)
  const rootTasks = allTasks.filter(t => !t.parent_id)

  const zones = refs.map(ref => ({
    refId: ref.refId,
    label: ref.label,
    kind: ref.kind,
    buildingId: ref.buildingId,
    buildingLabel: ref.buildingLabel,
    override: null,
    tasks: rootTasks.filter(t => belongs(t, ref.refId)).map(taskCheckFromPlanning),
  }))

  // Filter out zones with only completed tasks if hideCompleted is true
  if (hideCompleted) {
    return zones.filter(z => {
      // Keep zone if it has no tasks (notes/photos only) or has at least one non-completed task
      if (z.tasks.length === 0) return true
      // Check if all tasks in this zone are complete (recursively check children)
      const hasIncompleteTask = (t: VisitTaskCheck): boolean => {
        if ((t.progress ?? 0) < 100) return true
        if (t.children?.some(hasIncompleteTask)) return true
        return false
      }
      return z.tasks.some(hasIncompleteTask)
    })
  }

  return zones
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

/** Observed works progress (%) — mean of the observed percentages, na excluded.
 * If a task hasn't been observed yet (progress undefined), use plannedProgress instead. */
export function tasksWorksProgress(tasks: VisitTaskCheck[]): number {
  const applicable = tasks.filter(t => t.state !== 'na')
  if (applicable.length === 0) return 0
  const sum = applicable.reduce((s, t) => {
    // Use observed progress if available, otherwise use planned progress (no change assumed)
    const progress = t.progress !== undefined ? t.progress : (t.plannedProgress ?? 0)
    return s + progress
  }, 0)
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

// ── Comparing one session to the previous ones ───────────────────────────────

export interface PreviousObservation {
  visitId: string
  date: string
  progress?: number
  promisedEnd?: string
}

/**
 * What the last CLOSED session before this one observed on a given task —
 * the basis for "70 % → 100 %, +30 pts" and "échéance reportée".
 */
export function previousObservation(visits: Visit[], current: Visit, taskId: string): PreviousObservation | undefined {
  const earlier = visits
    .filter(v => v.id !== current.id && v.status !== 'en_cours' && v.date <= current.date)
    .sort((a, b) => b.date.localeCompare(a.date))
  for (const v of earlier) {
    const c = v.zones.flatMap(z => z.tasks).find(t => t.taskId === taskId && t.state !== 'not_checked' && t.state !== 'na')
    if (c) return { visitId: v.id, date: v.date, progress: c.progress, promisedEnd: c.promisedEnd }
  }
  return undefined
}

// ── What changed since the previous session ─────────────────────────────────

export type ChangeKind = 'lifted' | 'still_open' | 'rescheduled' | 'new' | 'progress_up' | 'progress_down'

export interface VisitChange {
  kind: ChangeKind
  label: string
  detail?: string
  zone?: string
}

/**
 * The delta a CR reader cares about: which points were lifted, which slipped,
 * what was newly raised and where the works moved — so nobody has to re-read
 * the previous comptes rendus.
 */
export function visitChanges(current: Visit, visits: Visit[], reserves: Reserve[]): VisitChange[] {
  const out: VisitChange[] = []

  for (const r of reserves) {
    const verdict = r.follow?.filter(f => f.visitId === current.id).pop()
    if (verdict) {
      const label = `${r.number} — ${r.description}`
      if (verdict.status === 'done') out.push({ kind: 'lifted', label, zone: r.logementId })
      else if (verdict.status === 'rescheduled') {
        out.push({ kind: 'rescheduled', label, zone: r.logementId, detail: verdict.dueDate ? `nouvelle échéance ${verdict.dueDate}` : undefined })
      } else out.push({ kind: 'still_open', label, zone: r.logementId, detail: verdict.status === 'not_done' ? 'non réalisé' : 'toujours en cours' })
    }
    if (r.visitId === current.id) {
      out.push({ kind: 'new', label: `${r.number} — ${r.description}`, zone: r.logementId, detail: r.dueDate ? `échéance ${r.dueDate}` : undefined })
    }
  }

  for (const z of current.zones) {
    for (const c of z.tasks) {
      if (c.state === 'not_checked' || c.state === 'na' || c.progress === undefined) continue
      const prev = previousObservation(visits, current, c.taskId)
      if (prev?.progress === undefined) continue
      const delta = c.progress - prev.progress
      if (delta === 0) continue
      out.push({
        kind: delta > 0 ? 'progress_up' : 'progress_down',
        label: c.title,
        zone: z.label,
        detail: `${prev.progress}% → ${c.progress}% (${delta > 0 ? '+' : ''}${delta} pts)`,
      })
    }
  }

  return out
}

// ── Closing statistics ───────────────────────────────────────────────────────

export interface VisitStats {
  durationMin: number | null
  buildings: number
  logements: number
  tasksChecked: number
  observations: number
  actions: number
  photos: number
  commitments: number
}

export function visitStats(v: Visit, reserves: Reserve[], photoCount: number): VisitStats {
  const mine = reservesForVisit(reserves, v.id)
  const visited = v.zones.filter(z => z.closedAt || zoneControlProgress(z) > 0)
  const start = v.startedAt ? Date.parse(v.startedAt) : NaN
  const end = v.endedAt ? Date.parse(v.endedAt) : NaN
  return {
    durationMin: isNaN(start) || isNaN(end) ? null : Math.max(0, Math.round((end - start) / 60000)),
    buildings: new Set(visited.map(z => z.buildingId)).size,
    logements: visited.length,
    tasksChecked: allChecks(v).filter(t => t.state !== 'not_checked' && t.state !== 'na').length,
    observations: mine.filter(r => (r.kind ?? 'action') === 'observation').length,
    actions: mine.filter(r => (r.kind ?? 'action') === 'action').length,
    photos: photoCount,
    commitments: allChecks(v).filter(t => t.promisedEnd).length,
  }
}

// ── Notes ────────────────────────────────────────────────────────────────────

export function notesForCompany(v: Visit, company: string): VisitNote[] {
  return v.notes.filter(n => n.scope === 'company' && n.company === company)
}

export function generalNotes(v: Visit): VisitNote[] {
  return v.notes.filter(n => n.scope === 'all')
}

// ── Applying the session back onto the planning ──────────────────────────────

/**
 * DÉFECTUOSITÉ CORRIGÉE (gate de stabilisation, commit 815807e) : quand cette
 * visite ne signale plus de blocage (check.state !== 'blocked', ex. le dernier
 * bloqueur vient d'être retiré), il ne faut pas transmettre tel quel le statut
 * potentiellement encore 'blocked' du GanttTask à deriveTaskStatus() — son
 * propre garde-fou de collant ("blocked" ne se lève jamais tout seul)
 * réappliquerait alors un blocage que CETTE visite vient explicitement de
 * lever, empêchant à jamais la tâche d'atteindre 'completed' même à 100 %.
 * Le garde-fou reste volontairement inchangé pour tout appelant qui n'a pas
 * ce signal (ex. le curseur manuel de pages/Gantt.tsx) — seule la remontée
 * d'une visite peut légitimement décider qu'un blocage est levé.
 */
export function statusFor(check: VisitTaskCheck, current: TaskStatus): TaskStatus {
  if (check.state === 'blocked') return 'blocked'
  if (check.progress === undefined) return current
  const base = current === 'blocked' ? 'in-progress' : current
  return deriveTaskStatus(check.progress, base)
}

/**
 * Apply what was observed to the planning: progress, status and — when a new
 * end date was promised — planned_end (duration follows).
 *
 * Le prévisionnel EST le contractuel : il ne change que sur une date promise.
 * Les dates réelles ne sont PLUS dérivées ici : elles se dérivent de
 * l'historique complet (progressHistory.ts + actualDates.deriveActualDates),
 * pas d'une seule observation — voir progressObservationsFromVisit ci-dessous,
 * à combiner par l'appelant (pages/Visite.tsx) avec applyDerivedActualDates.
 * Parent lots are recomputed from their children. Pure: returns a new task tree.
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

  // N'applique la visite qu'aux feuilles : la remontée sur les parents et
  // les lots passe par recomputeAll (lib/planning.ts), le seul pipeline de
  // recalcul — jamais une seconde implémentation ad hoc ici.
  const applyLeaves = (list: GanttTask[]): GanttTask[] => list.map(t =>
    t.children && t.children.length > 0 ? { ...t, children: applyLeaves(t.children) } : applyLeaf(t),
  )

  return recomputeAll(applyLeaves(tasks))
}

/**
 * Les observations d'avancement prises pendant cette session, prêtes à être
 * ajoutées à l'historique via progressHistory.appendProgressEntry — une par
 * tâche cochée avec un % renseigné, datée de v.date (effective_date), jamais
 * de la date technique de clôture.
 */
export function progressObservationsFromVisit(v: Visit): { taskId: string; new_progress: number }[] {
  return allChecks(v)
    .filter(c => c.state !== 'na' && c.state !== 'not_checked' && c.progress !== undefined)
    .map(c => ({ taskId: c.taskId, new_progress: Math.max(0, Math.min(100, Math.round(c.progress!))) }))
}

/**
 * Les blocages saisis pendant la session, fusionnés dans GanttTask.dependencies
 * (décision validée avec l'utilisateur : réutilisables par le planning/Gantt,
 * chemin critique compris). Fusion additive uniquement (jamais un remplacement) :
 * une dépendance déjà posée hors visite (via le Gantt) n'est jamais perdue.
 * "A bloquée par B" ⇒ B ajouté aux dépendances de A. "A bloque C" ⇒ A ajouté aux
 * dépendances de C — dependencies[] EST déjà la liste "bloquée par" au sens CPM.
 */
export function applyVisitBlockages(tasks: GanttTask[], v: Visit): GanttTask[] {
  let next = tasks
  for (const c of allChecks(v)) {
    for (const blockerId of c.blockedBy ?? []) next = addBlockedTask(next, blockerId, c.taskId).tasks
    for (const blockedId of c.blocks ?? []) next = addBlockedTask(next, c.taskId, blockedId).tasks
  }
  return next
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
      label: c.promisedLabel?.trim() || c.title,
      promisedEnd: c.promisedEnd,
      type: c.promisedType,
      at: new Date().toISOString(),
      visitId: v.id,
      visitDate: v.date,
      outcome: 'pending',
    })
  }
  return out
}

// ── Planning snapshot ────────────────────────────────────────────────────────

const iso = (d: Date): string => d.toISOString()

/** Dérive prévisionnelle max d'un lot (jours) — null si aucune de ses tâches n'a de prévision. */
function lotForecastDays(lot: GanttTask): number | null {
  return flattenLeaves([lot]).filter(t => !t.is_milestone).reduce<number | null>((worst, t) => {
    const fd = forecastDrift(t)
    if (fd === null) return worst
    return worst === null ? fd : Math.max(worst, fd)
  }, null)
}

/** Freeze the live planning into a self-contained historical photograph. */
export function buildPlanningSnapshot(tasks: GanttTask[], today: Date): PlanningSnapshot {
  const analysis = analyzePlanning(tasks, today)
  // lotSummaries() parcourt `tasks` dans le même ordre : on peut zipper directement.
  const lots: PlanningSnapshotLot[] = lotSummaries(tasks, today).map((l, i) => ({
    lotId: l.lotId, title: l.title, progress: l.progress, drift: l.drift, late: l.late,
    forecastDays: lotForecastDays(tasks[i]),
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
    forecastEnd: t.forecast_end ? iso(t.forecast_end) : undefined,
    forecastDays: forecastDrift(t),
  }))
  return {
    capturedAt: new Date().toISOString(),
    overall: overallProgress(tasks),
    maxDrift: maxDrift(tasks),
    lateCount: lateTasks(tasks, today).length,
    lots,
    tasks: snapTasks,
    forecastEnd: analysis.forecastEnd ? iso(analysis.forecastEnd) : undefined,
    forecastVarianceDays: analysis.varianceDays,
  }
}

// ── Factories ────────────────────────────────────────────────────────────────

export function emptyCr(): CrData {
  return { synthese: '', conclusions: '', nextMeeting: '', reserveOrder: [], photoOrder: [] }
}

export interface NewVisitInput {
  kind: VisitKind
  kindLabel?: string
  date: string
  participants: Participant[]
  zones: VisitZone[]
  companiesPresent?: string[]
  brief?: string
}

/** Opening a session stamps its start time — the tour begins now. */
export function newVisit(i: NewVisitInput): Visit {
  const now = new Date().toISOString()
  return {
    id: `VS${Date.now()}`,
    kind: i.kind,
    kindLabel: i.kindLabel?.trim() || undefined,
    date: i.date,
    status: 'en_cours',
    participants: i.participants,
    companiesPresent: i.companiesPresent?.length ? i.companiesPresent : undefined,
    brief: i.brief?.trim() || undefined,
    zones: i.zones,
    notes: [],
    startedAt: now,
    createdAt: now,
  }
}
