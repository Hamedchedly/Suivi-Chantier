// ────────────────────────────────────────────────────────────────────────────
// Édition du planning : créer des lots et leurs tâches, les renommer, les dater,
// les supprimer.
//
// Structure : un lot est une tâche parente qui porte des tâches feuilles. Les
// bornes et l'avancement d'un lot ne se saisissent pas — ils se recalculent
// depuis ses enfants.
//
// Convention de durée : jours calendaires INCLUS (du 1er au 5 = 5 jours), la
// même que celle utilisée à la saisie des dates contractuelles.
//
// Module pur : aucune entrée/sortie.
// ────────────────────────────────────────────────────────────────────────────

import { GanttTask } from '../types/gantt'

export type PlanningError = 'title_required' | 'lot_not_found' | 'code_taken' | 'not_found'

export const PLANNING_ERROR_LABEL: Record<PlanningError, string> = {
  title_required: 'Le libellé est obligatoire.',
  lot_not_found: 'Lot introuvable.',
  code_taken: 'Un lot porte déjà ce code.',
  not_found: 'Tâche introuvable.',
}

export interface PlanningResult {
  ok: boolean
  tasks: GanttTask[]
  task?: GanttTask
  error?: PlanningError
}

const DAY = 86400000

const startOfDay = (d: Date): Date => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

/** Jours calendaires inclus entre deux dates (bornes comprises). */
export function durationBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY) + 1)
}

export function endFromDuration(start: Date, duration: number): Date {
  return new Date(startOfDay(start).getTime() + (Math.max(1, duration) - 1) * DAY)
}

const uid = (prefix: string) => `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`

/** All leaf tasks of a subtree (tasks with no children). */
function allLeaves(task: GanttTask): GanttTask[] {
  if (!task.children?.length) return [task]
  return task.children.flatMap(allLeaves)
}

/** Recompute a task's progress and bounds from its sub-tasks. */
export function recomputeTask(task: GanttTask): GanttTask {
  const subs = task.children ?? []
  if (subs.length === 0) return task
  const start = new Date(Math.min(...subs.map(s => s.planned_start.getTime())))
  const end = new Date(Math.max(...subs.map(s => s.planned_end.getTime())))
  const work = subs.filter(s => !s.is_milestone)
  const progress = work.length ? Math.round(work.reduce((acc, s) => acc + s.progress, 0) / work.length) : 0
  return { ...task, planned_start: start, planned_end: end, planned_duration: durationBetween(start, end), progress }
}

/** Bornes et avancement d'un lot, recalculés depuis ses tâches (et leurs sous-tâches). */
export function recomputeLot(lot: GanttTask): GanttTask {
  const kids = (lot.children ?? []).map(t => t.children?.length ? recomputeTask(t) : t)
  if (kids.length === 0) return lot
  const leaves = kids.flatMap(allLeaves)
  const start = new Date(Math.min(...leaves.map(k => k.planned_start.getTime())))
  const end = new Date(Math.max(...leaves.map(k => k.planned_end.getTime())))
  const work = leaves.filter(k => !k.is_milestone)
  const progress = work.length
    ? Math.round(work.reduce((s, k) => s + k.progress, 0) / work.length)
    : 0
  return {
    ...lot,
    children: kids,
    planned_start: start,
    planned_end: end,
    planned_duration: durationBetween(start, end),
    progress,
    actual_start: leaves.map(k => k.actual_start).filter(Boolean).length
      ? new Date(Math.min(...leaves.filter(k => k.actual_start).map(k => k.actual_start!.getTime())))
      : undefined,
    actual_end: leaves.length > 0 && leaves.every(k => k.actual_end)
      ? new Date(Math.max(...leaves.map(k => k.actual_end!.getTime())))
      : undefined,
  }
}

/** Repasse sur tous les lots après une modification de leurs enfants. */
export function recomputeAll(tasks: GanttTask[]): GanttTask[] {
  return tasks.map(t => (t.children?.length ? recomputeLot(t) : t))
}

export interface LotInput {
  code: string
  title: string
}

export function createLot(tasks: GanttTask[], input: LotInput): PlanningResult {
  const title = input.title.trim()
  const code = input.code.trim()
  if (!title) return { ok: false, tasks, error: 'title_required' }
  if (code && tasks.some(t => t.lot_id.toLowerCase() === code.toLowerCase())) {
    return { ok: false, tasks, error: 'code_taken' }
  }
  const today = startOfDay(new Date())
  const lot: GanttTask = {
    id: uid('LOT-'),
    lot_id: code || uid('L'),
    title,
    planned_start: today,
    planned_end: endFromDuration(today, 5),
    planned_duration: 5,
    progress: 0,
    status: 'not-started',
    priority: 'medium',
    dependencies: [],
    is_milestone: false,
    is_critical: false,
    children: [],
  }
  return { ok: true, tasks: [...tasks, lot], task: lot }
}

export interface TaskInput {
  title: string
  start: Date
  duration?: number
  end?: Date
  is_milestone?: boolean
}

export function createTask(tasks: GanttTask[], lotId: string, input: TaskInput): PlanningResult {
  const title = input.title.trim()
  if (!title) return { ok: false, tasks, error: 'title_required' }
  const lot = tasks.find(t => t.id === lotId)
  if (!lot) return { ok: false, tasks, error: 'lot_not_found' }

  const start = startOfDay(input.start)
  const end = input.end
    ? startOfDay(input.end)
    : endFromDuration(start, input.duration ?? 5)
  const safeEnd = end.getTime() < start.getTime() ? start : end

  const task: GanttTask = {
    id: uid('T-'),
    parent_id: lot.id,
    lot_id: lot.lot_id,
    title,
    planned_start: start,
    planned_end: safeEnd,
    planned_duration: durationBetween(start, safeEnd),
    progress: 0,
    status: 'not-started',
    priority: 'medium',
    dependencies: [],
    is_milestone: input.is_milestone ?? false,
    is_critical: false,
  }
  const next = tasks.map(t => (t.id === lotId ? { ...t, children: [...(t.children ?? []), task] } : t))
  return { ok: true, tasks: recomputeAll(next), task }
}

/** Applique une transformation à la tâche visée, où qu'elle soit dans l'arbre. */
function mapTask(tasks: GanttTask[], id: string, fn: (t: GanttTask) => GanttTask): { tasks: GanttTask[]; found: boolean } {
  let found = false
  const walk = (list: GanttTask[]): GanttTask[] => list.map(t => {
    if (t.id === id) { found = true; return fn(t) }
    if (t.children?.length) return { ...t, children: walk(t.children) }
    return t
  })
  return { tasks: walk(tasks), found }
}

export function renameTask(tasks: GanttTask[], id: string, title: string): PlanningResult {
  const clean = title.trim()
  if (!clean) return { ok: false, tasks, error: 'title_required' }
  const { tasks: next, found } = mapTask(tasks, id, t => ({ ...t, title: clean }))
  if (!found) return { ok: false, tasks, error: 'not_found' }
  return { ok: true, tasks: next }
}

/**
 * Déplacer le début conserve la durée ; changer la fin la recalcule.
 * Une fin antérieure au début est ignorée.
 */
export function setTaskDates(
  tasks: GanttTask[], id: string, patch: { start?: Date; end?: Date },
): PlanningResult {
  const { tasks: next, found } = mapTask(tasks, id, t => {
    if (patch.start) {
      const start = startOfDay(patch.start)
      return { ...t, planned_start: start, planned_end: endFromDuration(start, t.planned_duration) }
    }
    if (patch.end) {
      const end = startOfDay(patch.end)
      if (end.getTime() < startOfDay(t.planned_start).getTime()) return t
      return { ...t, planned_end: end, planned_duration: durationBetween(t.planned_start, end) }
    }
    return t
  })
  if (!found) return { ok: false, tasks, error: 'not_found' }
  return { ok: true, tasks: recomputeAll(next) }
}

/** Crée une sous-tâche rattachée à une tâche existante (depth 1, id = parentTaskId). */
export function createSubTask(tasks: GanttTask[], parentId: string, input: TaskInput): PlanningResult {
  const title = input.title.trim()
  if (!title) return { ok: false, tasks, error: 'title_required' }

  let parentTask: GanttTask | undefined
  for (const lot of tasks) {
    const found = (lot.children ?? []).find(t => t.id === parentId)
    if (found) { parentTask = found; break }
  }
  if (!parentTask) return { ok: false, tasks, error: 'not_found' }

  const start = startOfDay(input.start)
  const end = input.end ? startOfDay(input.end) : endFromDuration(start, input.duration ?? 3)
  const safeEnd = end.getTime() < start.getTime() ? start : end

  const sub: GanttTask = {
    id: uid('ST-'),
    parent_id: parentId,
    lot_id: parentTask.lot_id,
    title,
    planned_start: start,
    planned_end: safeEnd,
    planned_duration: durationBetween(start, safeEnd),
    progress: 0,
    status: 'not-started',
    priority: 'medium',
    dependencies: [],
    is_milestone: input.is_milestone ?? false,
    is_critical: false,
  }

  const next = tasks.map(lot => ({
    ...lot,
    children: (lot.children ?? []).map(t =>
      t.id === parentId ? { ...t, children: [...(t.children ?? []), sub] } : t
    ),
  }))

  return { ok: true, tasks: recomputeAll(next), task: sub }
}

/** Supprime un lot (avec ses tâches), une tâche, ou une sous-tâche. */
export function removeTask(tasks: GanttTask[], id: string): PlanningResult {
  if (tasks.some(t => t.id === id)) {
    return { ok: true, tasks: tasks.filter(t => t.id !== id) }
  }
  let found = false
  const removeFrom = (list: GanttTask[]): GanttTask[] =>
    list.flatMap(t => {
      if (t.id === id) { found = true; return [] }
      if (t.children?.length) return [{ ...t, children: removeFrom(t.children) }]
      return [t]
    })
  const next = tasks.map(t => t.children?.length ? { ...t, children: removeFrom(t.children) } : t)
  if (!found) return { ok: false, tasks, error: 'not_found' }
  return { ok: true, tasks: recomputeAll(next) }
}

/** Assigne la liste de prédécesseurs d'une tâche (ID quelconque dans l'arbre). */
export function setTaskDependencies(tasks: GanttTask[], id: string, deps: string[]): PlanningResult {
  const { tasks: next, found } = mapTask(tasks, id, t => ({ ...t, dependencies: deps }))
  if (!found) return { ok: false, tasks, error: 'not_found' }
  return { ok: true, tasks: next }
}

/** Identifiants de toutes les tâches feuilles — pour purger les liens orphelins. */
export function leafIds(tasks: GanttTask[]): string[] {
  return tasks.flatMap(t => (t.children ?? []).map(c => c.id))
}
