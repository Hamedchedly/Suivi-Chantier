import { GanttTask } from '../types/gantt'

const MS_PER_DAY = 86400000

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY)
}

/** All leaf tasks (no children) in display order. */
export function flattenLeaves(tasks: GanttTask[], acc: GanttTask[] = []): GanttTask[] {
  for (const t of tasks) {
    if (t.children?.length) flattenLeaves(t.children, acc)
    else acc.push(t)
  }
  return acc
}

/** All tasks, parents included. */
export function flattenAll(tasks: GanttTask[], acc: GanttTask[] = []): GanttTask[] {
  for (const t of tasks) {
    acc.push(t)
    if (t.children?.length) flattenAll(t.children, acc)
  }
  return acc
}

/**
 * Écart de fin, en jours. Positif = la tâche se termine plus tard que prévu.
 *
 * Le prévisionnel EST le contractuel : la dérive se mesure donc entre le RÉEL
 * et lui. Tant qu'aucune fin réelle n'est constatée, une tâche déjà en retard
 * sur sa date de fin dérive d'autant de jours écoulés ; sinon la dérive est nulle
 * (on ne projette pas de retard sur une tâche encore dans les temps).
 */
export function driftDays(task: GanttTask, today: Date = new Date()): number {
  if (task.actual_end) return diffDays(task.actual_end, task.planned_end)
  if (task.progress >= 100) return 0
  const late = diffDays(today, task.planned_end)
  return late > 0 ? late : 0
}

/** Worst slippage across all leaf tasks (days). */
export function maxDrift(tasks: GanttTask[], today: Date = new Date()): number {
  // Les jalons marquent une échéance, ils ne portent pas de travail : ils sont
  // exclus de la dérive comme ils le sont déjà du retard.
  return flattenLeaves(tasks)
    .filter(t => !t.is_milestone)
    .reduce((m, t) => Math.max(m, driftDays(t, today)), 0)
}

/** A task is late if it should be finished by `today` but isn't complete. */
export function isLate(task: GanttTask, today: Date): boolean {
  if (task.progress >= 100) return false
  return startOfDay(task.planned_end).getTime() < startOfDay(today).getTime()
}

export function lateTasks(tasks: GanttTask[], today: Date): GanttTask[] {
  return flattenLeaves(tasks).filter(t => !t.is_milestone && isLate(t, today))
}

/** Leaf tasks active today (started, not finished) and not complete. */
export function tasksForToday(tasks: GanttTask[], today: Date): GanttTask[] {
  const t0 = startOfDay(today).getTime()
  return flattenLeaves(tasks).filter(t => {
    if (t.is_milestone || t.progress >= 100) return false
    return startOfDay(t.planned_start).getTime() <= t0 && startOfDay(t.planned_end).getTime() >= t0
  })
}

/** Ids of critical leaf tasks (from authored is_critical flags). */
export function criticalLeafIds(tasks: GanttTask[]): Set<string> {
  return new Set(flattenLeaves(tasks).filter(t => t.is_critical).map(t => t.id))
}

export interface LotSummary {
  lotId: string
  title: string
  progress: number
  drift: number
  late: boolean
}

/** Per top-level lot: progress + worst drift among its leaves. */
export function lotSummaries(tasks: GanttTask[], today: Date): LotSummary[] {
  return tasks.map(lot => {
    const leaves = flattenLeaves([lot])
    const drift = leaves.filter(t => !t.is_milestone)
      .reduce((m, t) => Math.max(m, driftDays(t, today)), 0)
    const late = leaves.some(t => !t.is_milestone && isLate(t, today))
    return { lotId: lot.lot_id, title: lot.title, progress: lot.progress, drift, late }
  })
}

/** Weighted-average progress across leaf tasks (milestones excluded). */
export function overallProgress(tasks: GanttTask[]): number {
  const leaves = flattenLeaves(tasks).filter(t => !t.is_milestone)
  if (!leaves.length) return 0
  const sum = leaves.reduce((s, t) => s + t.progress, 0)
  return Math.round(sum / leaves.length)
}
