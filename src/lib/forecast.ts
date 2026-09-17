// ────────────────────────────────────────────────────────────────────────────
// Forecast — prévisions automatiques basées sur l'avancement réel.
//
// Quatre types de dates coexistent, jamais écrasées les unes sur les autres :
//   baseline_start/end  — contractuel (figé à la signature, ou au premier lock)
//   planned_start/end   — planning courant (modifiable par l'utilisateur)
//   actual_start/end    — réel constaté (auto-alimenté par les visites)
//   forecast_start/end  — prévision calculée (jamais saisie manuellement)
//
// Module pur : pas d'I/O.
// ────────────────────────────────────────────────────────────────────────────

import { GanttTask } from '../types/gantt'
import { WorkCalendar, addWorkingDays, workingDaysBetween, nextWorkingDay, makeCalendar } from './calendar'

const DEFAULT_CAL = makeCalendar()
const SOD = (d: Date): Date => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

// ── Durée contractuelle ───────────────────────────────────────────────────────

/** Durée de référence en jours ouvrés.
 * Priorité : champ explicite → baseline → planned. */
export function contractualWorkDays(task: GanttTask, cal: WorkCalendar = DEFAULT_CAL): number {
  if (task.contractual_working_days != null) return Math.max(1, task.contractual_working_days)
  const start = task.baseline_start ?? task.planned_start
  const end = task.baseline_end ?? task.planned_end
  // workingDaysBetween uses [a, b) — add 1 day to make end inclusive
  const wd = workingDaysBetween(start, new Date(SOD(end).getTime() + 86400000), cal)
  return Math.max(1, wd)
}

// ── Prévision individuelle (sans propagation) ─────────────────────────────────

/** Forecast for a single leaf task before dependency propagation.
 * Returns null if the task is on schedule and no forecast differs from planned. */
function initialForecast(
  task: GanttTask, today: Date, cal: WorkCalendar,
): { start: Date; end: Date } | null {
  const workDays = contractualWorkDays(task, cal)
  const d0 = SOD(today)

  if (task.actual_end) {
    // Done: forecast = actual
    return { start: task.actual_start ?? task.actual_end, end: task.actual_end }
  }

  if (task.actual_start) {
    // In progress: forecast_start = actual_start, forecast_end = +workDays working days
    const fEnd = addWorkingDays(SOD(task.actual_start), workDays - 1, cal)
    return { start: task.actual_start, end: fEnd }
  }

  // Not started
  const plannedStart = SOD(task.planned_start)
  if (d0.getTime() > plannedStart.getTime()) {
    // Late start: forecast starts today (next working day)
    const fStart = nextWorkingDay(d0, cal)
    const fEnd = addWorkingDays(fStart, workDays - 1, cal)
    return { start: fStart, end: fEnd }
  }

  return null // on schedule — no deviation
}

// ── Propagation des dépendances ───────────────────────────────────────────────

/** Compute forecast_start/end for all tasks + propagate through dependencies.
 * Returns a new task tree (pure, no mutation). */
export function computeForecasts(
  tasks: GanttTask[],
  today: Date = new Date(),
  cal: WorkCalendar = DEFAULT_CAL,
): GanttTask[] {
  // 1. Collect all leaf tasks
  const leaves: GanttTask[] = []
  const collectLeaves = (arr: GanttTask[]) => {
    for (const t of arr) {
      if (t.children?.length) collectLeaves(t.children)
      else leaves.push(t)
    }
  }
  collectLeaves(tasks)

  const byId = new Map(leaves.map(t => [t.id, t]))

  // 2. Initial forecast per leaf
  const forecasts = new Map<string, { start: Date; end: Date }>()
  for (const t of leaves) {
    const f = initialForecast(t, today, cal)
    forecasts.set(t.id, f ?? { start: t.planned_start, end: t.planned_end })
  }

  // 3. Topological sort (Kahn's algorithm)
  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  for (const t of leaves) { preds.set(t.id, []); succs.set(t.id, []) }
  for (const t of leaves) {
    for (const p of t.dependencies) {
      if (!byId.has(p)) continue
      preds.get(t.id)!.push(p)
      succs.get(p)!.push(t.id)
    }
  }
  const indeg = new Map(leaves.map(t => [t.id, preds.get(t.id)!.length]))
  const queue = leaves.filter(t => indeg.get(t.id) === 0).map(t => t.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const s of succs.get(id)!) {
      const n = indeg.get(s)! - 1
      indeg.set(s, n)
      if (n === 0) queue.push(s)
    }
  }

  if (order.length !== leaves.length) return tasks // cyclic graph — skip

  // 4. Propagate: push successors when predecessor's forecast_end is later
  for (const id of order) {
    const ps = preds.get(id)!
    if (!ps.length) continue
    const cur = forecasts.get(id)!
    const latestPredEnd = new Date(Math.max(...ps.map(p => forecasts.get(p)!.end.getTime())))
    const required = nextWorkingDay(latestPredEnd, cal)
    if (required.getTime() > SOD(cur.start).getTime()) {
      const dur = contractualWorkDays(byId.get(id)!, cal)
      forecasts.set(id, { start: required, end: addWorkingDays(required, dur - 1, cal) })
    }
  }

  // 5. Apply forecasts back to the tree
  const apply = (arr: GanttTask[]): GanttTask[] =>
    arr.map(t => {
      if (t.children?.length) {
        const children = apply(t.children)
        const fStarts = children.map(c => (c.forecast_start ?? c.planned_start).getTime())
        const fEnds = children.map(c => (c.forecast_end ?? c.planned_end).getTime())
        return { ...t, children, forecast_start: new Date(Math.min(...fStarts)), forecast_end: new Date(Math.max(...fEnds)) }
      }
      const f = forecasts.get(t.id)
      if (!f) return t
      const sameAsPlanned =
        SOD(f.start).getTime() === SOD(t.planned_start).getTime() &&
        SOD(f.end).getTime() === SOD(t.planned_end).getTime()
      return sameAsPlanned
        ? { ...t, forecast_start: undefined, forecast_end: undefined }
        : { ...t, forecast_start: f.start, forecast_end: f.end }
    })

  return apply(tasks)
}

// ── Actions utilisateur ───────────────────────────────────────────────────────

/** Promote forecast → planned (user confirmed "Appliquer au planning").
 * Freezes baseline first if not already set. Never touches actual dates. */
export function applyForecastToPlanning(tasks: GanttTask[]): GanttTask[] {
  const apply = (arr: GanttTask[]): GanttTask[] =>
    arr.map(t => {
      const children = t.children?.length ? apply(t.children) : t.children
      if (t.children?.length) return { ...t, children }
      if (!t.forecast_start || !t.forecast_end) return { ...t, children }
      return {
        ...t, children,
        baseline_start: t.baseline_start ?? t.planned_start,
        baseline_end: t.baseline_end ?? t.planned_end,
        contractual_working_days: t.contractual_working_days,
        planned_start: t.forecast_start,
        planned_end: t.forecast_end,
        forecast_start: undefined,
        forecast_end: undefined,
      }
    })
  return apply(tasks)
}

/** Clear all forecast dates (user chose "Conserver en prévision" → dismiss). */
export function clearForecasts(tasks: GanttTask[]): GanttTask[] {
  const clear = (arr: GanttTask[]): GanttTask[] =>
    arr.map(t => ({
      ...t,
      forecast_start: undefined,
      forecast_end: undefined,
      children: t.children?.length ? clear(t.children) : t.children,
    }))
  return clear(tasks)
}

/** Freeze current planned dates as the contractual baseline (one-time action).
 * Already-locked tasks (baseline_start set) are not overwritten. */
export function lockBaseline(tasks: GanttTask[], cal: WorkCalendar = DEFAULT_CAL): GanttTask[] {
  const lock = (arr: GanttTask[]): GanttTask[] =>
    arr.map(t => {
      const children = t.children?.length ? lock(t.children) : t.children
      if (t.baseline_start) return { ...t, children }
      const wd = workingDaysBetween(
        t.planned_start,
        new Date(SOD(t.planned_end).getTime() + 86400000),
        cal,
      )
      return {
        ...t, children,
        baseline_start: new Date(t.planned_start),
        baseline_end: new Date(t.planned_end),
        contractual_working_days: Math.max(1, wd),
      }
    })
  return lock(tasks)
}

// ── Analyse des écarts ────────────────────────────────────────────────────────

/** Drift in calendar days: forecast_end vs contractual (baseline_end ?? planned_end).
 * Positive = forecast finishes later than contractual. null if no forecast. */
export function forecastDrift(task: GanttTask): number | null {
  if (!task.forecast_end) return null
  const ref = task.baseline_end ?? task.planned_end
  return Math.round((SOD(task.forecast_end).getTime() - SOD(ref).getTime()) / 86400000)
}

/** Summary of tasks impacted by forecasts. */
export function forecastImpact(tasks: GanttTask[]): { count: number; maxDrift: number } {
  const leaves: GanttTask[] = []
  const collect = (arr: GanttTask[]) => {
    for (const t of arr) {
      if (t.children?.length) collect(t.children)
      else leaves.push(t)
    }
  }
  collect(tasks)
  let count = 0
  let max = 0
  for (const t of leaves) {
    const d = forecastDrift(t)
    if (d != null && d > 0) { count++; if (d > max) max = d }
  }
  return { count, maxDrift: max }
}

/** True if any leaf task has a contractual baseline set. */
export function hasBaseline(tasks: GanttTask[]): boolean {
  const check = (arr: GanttTask[]): boolean =>
    arr.some(t => t.baseline_start != null || (t.children?.length ? check(t.children) : false))
  return check(tasks)
}
