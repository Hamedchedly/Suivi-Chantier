// ────────────────────────────────────────────────────────────────────────────
// Dates réelles pilotées par l'avancement.
//
// Le modèle de dates ne comporte que DEUX repères :
//   • le PRÉVISIONNEL, qui est aussi le CONTRACTUEL (planned_start / planned_end).
//     Il est saisi par l'utilisateur et ne bouge que s'il le décide.
//   • le RÉEL (actual_start / actual_end), qui s'ajuste tout seul à l'avancement
//     constaté : il n'est jamais saisi à la main.
//
// Règles, sans rien inventer :
//   0 %            → la tâche n'a pas démarré : aucune date réelle.
//   entre 1 et 99 %→ elle a démarré : on fige le début réel au premier constat.
//   100 %          → elle est terminée : on fige la fin réelle au constat qui
//                    l'a portée à 100 %.
// Revenir en arrière (100 % → 60 %) rouvre la tâche : la fin réelle est effacée,
// le début réel est conservé — il a bien eu lieu.
// ────────────────────────────────────────────────────────────────────────────

import { GanttTask } from '../types/gantt'

/** Partie d'une tâche qui nous intéresse ici — facilite les tests et les appels. */
export interface ActualDates {
  actual_start?: Date
  actual_end?: Date
}

const startOfDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Dates réelles d'une tâche après un constat d'avancement à la date `observedAt`.
 * Fonction pure : elle ne modifie pas l'objet reçu.
 */
export function actualDatesFor(
  current: ActualDates, progress: number, observedAt: Date,
): ActualDates {
  const day = startOfDay(observedAt)

  if (progress <= 0) {
    // Jamais démarrée (ou remise à zéro) : plus aucune date réelle.
    return {}
  }

  const actual_start = current.actual_start ?? day

  if (progress >= 100) {
    return { actual_start, actual_end: current.actual_end ?? day }
  }

  // En cours : le début reste, la fin n'a pas encore eu lieu.
  return { actual_start }
}

/** Applique la règle à une tâche du planning. */
export function withActualDates(task: GanttTask, observedAt: Date): GanttTask {
  const next = actualDatesFor(task, task.progress, observedAt)
  return {
    ...task,
    actual_start: next.actual_start,
    actual_end: next.actual_end,
    actual_duration: next.actual_start && next.actual_end
      ? Math.max(1, Math.round((startOfDay(next.actual_end).getTime() - startOfDay(next.actual_start).getTime()) / 86400000) + 1)
      : undefined,
  }
}

/** Applique la règle à tout un arbre de tâches (parents compris). */
export function applyActualDates(tasks: GanttTask[], observedAt: Date): GanttTask[] {
  return tasks.map(t => {
    const next = withActualDates(t, observedAt)
    return t.children?.length
      ? { ...next, children: applyActualDates(t.children, observedAt) }
      : next
  })
}

/**
 * Écart en jours entre le réel et le prévisionnel, sur la fin de tâche.
 * Positif = terminé (ou projeté) plus tard que prévu.
 * Renvoie null tant qu'aucune fin réelle n'est connue : on ne projette pas.
 */
export function endDrift(task: GanttTask): number | null {
  if (!task.actual_end) return null
  const ms = startOfDay(task.actual_end).getTime() - startOfDay(task.planned_end).getTime()
  return Math.round(ms / 86400000)
}

/** Écart en jours sur le démarrage — même convention. */
export function startDrift(task: GanttTask): number | null {
  if (!task.actual_start) return null
  const ms = startOfDay(task.actual_start).getTime() - startOfDay(task.planned_start).getTime()
  return Math.round(ms / 86400000)
}
