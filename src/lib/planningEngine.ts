// ────────────────────────────────────────────────────────────────────────────
// PlanningEngine — point d'entrée unique des calculs de planning.
//
// N'invente aucun calcul : orchestre les modules purs déjà existants
// (forecast.ts, cpm.ts, actualDates.ts, schedule.ts, commitments.ts) et
// expose le résultat sous la forme PlanningTask (types/planning.ts), pensée
// pour l'affichage — contractuel / réel / prévision, écarts, pourquoi.
//
// Pure, sans I/O : la persistance reste dans repo.ts / sync.ts.
// ────────────────────────────────────────────────────────────────────────────

import { GanttTask, TaskStatus } from '../types/gantt'
import {
  PlanningTask, PlanningVariance, PlanningAnalysis, PlanningCommitment,
  CriticalPathResult, WhyLate,
} from '../types/planning'
import { DateCommitment, commitmentsForTask, latestCommitment as latestCommitmentOf } from './commitments'
import { forecastDrift } from './forecast'
import { startDrift } from './actualDates'
import { flattenLeaves, driftDays, diffDays } from './schedule'
import { computeCpm, CpmResult } from './cpm'

// ── Statut dérivé de l'avancement ─────────────────────────────────────────

/**
 * Seule fonction autorisée à déduire un statut depuis un avancement.
 * Règle : 0 % → not-started, 1-99 % → in-progress, 100 % → completed.
 * 'blocked' et 'cancelled' sont des états opérationnels, jamais déduits d'un
 * pourcentage — une fois posés (action explicite), un simple recalcul
 * d'avancement ne doit jamais les écraser silencieusement.
 */
export function deriveTaskStatus(progress: number, current: TaskStatus): TaskStatus {
  if (current === 'blocked' || current === 'cancelled') return current
  if (progress >= 100) return 'completed'
  if (progress > 0) return 'in-progress'
  return 'not-started'
}

// ── Variance ───────────────────────────────────────────────────────────────

/** calculateScheduleVariance — les quatre écarts distincts (section 15 du brief) :
 * démarrage, fin, prévision, engagement. Ne mélange jamais l'un avec l'autre. */
export function calculateScheduleVariance(task: GanttTask, commitments: DateCommitment[] = []): PlanningVariance {
  const contractStart = task.baseline_start ?? task.planned_start
  const contractEnd = task.baseline_end ?? task.planned_end

  const startDays = task.actual_start ? diffDays(task.actual_start, contractStart) : null
  const endDays = task.actual_end ? diffDays(task.actual_end, contractEnd) : null
  const forecastDays = forecastDrift(task)

  const commitment = latestCommitmentOf(commitments, task.id)
  const referenceEnd = task.actual_end ?? task.forecast_end
  const commitmentDays = commitment && referenceEnd
    ? diffDays(referenceEnd, new Date(commitment.promisedEnd))
    : null

  return { startDays, endDays, forecastDays, commitmentDays }
}

// ── Mapping GanttTask → PlanningTask ──────────────────────────────────────

function toPlanningCommitment(c: DateCommitment): PlanningCommitment {
  return {
    id: c.id,
    company: c.company,
    label: c.label,
    promisedEnd: c.promisedEnd,
    at: c.at,
    visitId: c.visitId,
    visitDate: c.visitDate,
    outcome: c.outcome ?? 'pending',
  }
}

export interface PlanningTaskContext {
  operationId: string
  commitments: DateCommitment[]
}

/** Construit la vue PlanningTask d'une tâche (et récursivement de ses enfants). */
export function toPlanningTask(task: GanttTask, ctx: PlanningTaskContext): PlanningTask {
  const taskCommitments = commitmentsForTask(ctx.commitments, task.id).map(toPlanningCommitment)
  return {
    id: task.id,
    operationId: ctx.operationId,
    lotId: task.lot_id,
    parentId: task.parent_id,
    zoneId: task.zone_id,
    logementId: task.logement_id,
    title: task.title,
    isMilestone: task.is_milestone,
    isCritical: task.is_critical,
    status: task.status,
    progress: task.progress,
    contract: {
      start: task.baseline_start ?? task.planned_start,
      end: task.baseline_end ?? task.planned_end,
      workingDays: task.contractual_working_days,
    },
    actual: { start: task.actual_start, end: task.actual_end, progress: task.progress },
    forecast: {
      start: task.forecast_start,
      end: task.forecast_end,
      method: task.forecast_method ?? null,
    },
    variance: calculateScheduleVariance(task, ctx.commitments),
    dependencies: (task.dependencies ?? []).map(predecessorId => ({ predecessorId, type: 'finish_to_start' as const })),
    commitments: taskCommitments,
    latestCommitment: taskCommitments[0],
    delayCause: task.delay_cause,
    children: task.children?.length ? task.children.map(c => toPlanningTask(c, ctx)) : undefined,
  }
}

export function toPlanningTasks(tasks: GanttTask[], ctx: PlanningTaskContext): PlanningTask[] {
  return tasks.map(t => toPlanningTask(t, ctx))
}

// ── Analyse du planning (section 21) ──────────────────────────────────────

/** Synthèse chantier : comptes par état, dérive, fin contractuelle/réelle/prévisionnelle,
 * principaux écarts par lot. Aucun score arbitraire — uniquement des jours. */
export function analyzePlanning(tasks: GanttTask[], today: Date = new Date()): PlanningAnalysis {
  const leaves = flattenLeaves(tasks).filter(t => !t.is_milestone)
  const totalTasks = leaves.length
  const completed = leaves.filter(t => t.progress >= 100).length
  const notStarted = leaves.filter(t => t.progress <= 0).length
  const inProgress = totalTasks - completed - notStarted
  const drifting = leaves.filter(t => driftDays(t, today) > 0 || (forecastDrift(t) ?? 0) > 0).length

  const contractEnd = leaves.length
    ? new Date(Math.max(...leaves.map(t => (t.baseline_end ?? t.planned_end).getTime())))
    : null

  const actualEnds = leaves.filter(t => t.actual_end)
  const actualEnd = actualEnds.length
    ? new Date(Math.max(...actualEnds.map(t => t.actual_end!.getTime())))
    : null

  const forecastEnd = leaves.length
    ? new Date(Math.max(...leaves.map(t => (t.forecast_end ?? t.actual_end ?? t.planned_end).getTime())))
    : null

  const varianceDays = contractEnd && forecastEnd ? diffDays(forecastEnd, contractEnd) : null

  const topVariances = tasks
    .map(lot => {
      const kids = flattenLeaves([lot]).filter(t => !t.is_milestone)
      const days = kids.reduce((m, t) => Math.max(m, forecastDrift(t) ?? driftDays(t, today)), 0)
      return { lotId: lot.lot_id, title: lot.title, days }
    })
    .filter(l => l.days > 0)
    .sort((a, b) => b.days - a.days)

  return { totalTasks, completed, inProgress, notStarted, drifting, contractEnd, actualEnd, forecastEnd, varianceDays, topVariances }
}

// ── Chemin critique (section 20) ──────────────────────────────────────────

/** Chemin critique, déterministe, jamais inventé : indisponible tant que le
 * réseau de dépendances est vide (ou cyclique). */
export function criticalPath(tasks: GanttTask[], precomputed?: CpmResult): CriticalPathResult {
  const leaves = flattenLeaves(tasks)
  const edgeCount = leaves.reduce((n, t) => n + (t.dependencies?.length ?? 0), 0)
  const cpm = precomputed ?? computeCpm(tasks)

  if (edgeCount === 0 || cpm.hasCycle || cpm.criticalIds.size === 0) {
    return { available: false, path: [], criticalIds: new Set() }
  }

  const path = [...cpm.criticalIds].sort((a, b) => cpm.nodes.get(a)!.es - cpm.nodes.get(b)!.es)
  return { available: true, path, criticalIds: cpm.criticalIds }
}

// ── Pourquoi cette tâche est en retard (section 18) ───────────────────────

/** Rassemble les faits déjà calculés ailleurs — n'en déduit aucun nouveau. */
export function whyLate(task: GanttTask, tasksById: Map<string, GanttTask>, commitments: DateCommitment[]): WhyLate {
  const latest = latestCommitmentOf(commitments, task.id)
  return {
    startDriftDays: startDrift(task),
    forecastDriftDays: forecastDrift(task),
    progress: task.progress,
    delayCause: task.delay_cause ?? null,
    predecessors: (task.dependencies ?? []).map(id => ({ id, title: tasksById.get(id)?.title ?? id })),
    latestCommitment: latest ? toPlanningCommitment(latest) : null,
  }
}

/** Index id → tâche (feuilles et parents), pour whyLate et l'affichage des dépendances. */
export function indexTasksById(tasks: GanttTask[]): Map<string, GanttTask> {
  const byId = new Map<string, GanttTask>()
  const walk = (arr: GanttTask[]) => {
    for (const t of arr) {
      byId.set(t.id, t)
      if (t.children?.length) walk(t.children)
    }
  }
  walk(tasks)
  return byId
}

export const PlanningEngine = {
  deriveTaskStatus,
  calculateScheduleVariance,
  toPlanningTask,
  toPlanningTasks,
  analyzePlanning,
  criticalPath,
  whyLate,
  indexTasksById,
}
