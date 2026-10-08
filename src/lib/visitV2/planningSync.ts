// Écriture d'une session v2 dans le planning et dans l'historique d'avancement.
// Même mécanisme que la v1 (Visite.tsx terminate) : une entrée 'visit' par tâche et par
// session (identifiant déterministe, donc une ré-écriture remplace la précédente), des entrées
// 'calculated' pour les parents, puis dérivation des dates réelles depuis l'historique.

import type { GanttTask } from '../../types/gantt'
import { appendProgressEntry, withGenesisEntries, type ProgressHistoryEntry } from '../progressHistory'
import { applyDerivedActualDates, type ActualDateOverride } from '../actualDates'
import { computeForecasts } from '../forecast'
import { applySessionToPlanning, observedPlanningProgress, type V2Session } from './model'

export interface PlanningSyncResult {
  tasks: GanttTask[]
  history: ProgressHistoryEntry[]
}

export function syncSessionToPlanning(input: {
  tasks: GanttTask[]
  history: ProgressHistoryEntry[]
  overrides: ActualDateOverride[]
  session: V2Session
  now: Date
  user?: string
}): PlanningSyncResult {
  const { tasks, overrides, session, now, user } = input
  const observed = observedPlanningProgress(session)
  if (observed.size === 0) return { tasks, history: input.history }

  const planned = applySessionToPlanning(tasks, session)

  let history = withGenesisEntries(tasks, input.history)
  for (const [taskId, progress] of observed) {
    history = appendProgressEntry(history, {
      taskId, effective_date: session.date, new_progress: progress,
      source: 'visit', visitId: session.id, visitDate: session.date, user,
    })
  }

  const calcIds = new Set<string>()
  const collectParents = (list: GanttTask[]) => {
    for (const t of list) {
      if (!t.children?.length) continue
      calcIds.add(t.id)
      collectParents(t.children)
    }
  }
  collectParents(planned)
  const created_at = now.toISOString()
  const calculated: ProgressHistoryEntry[] = []
  const walk = (list: GanttTask[]) => {
    for (const t of list) {
      if (!t.children?.length) continue
      calculated.push({
        id: `ph-calc-${session.id}-${t.id}`,
        taskId: t.id,
        effective_date: session.date,
        created_at,
        old_progress: 0,
        new_progress: t.progress,
        source: 'calculated',
        visitId: session.id,
        visitDate: session.date,
        user,
      })
      walk(t.children)
    }
  }
  walk(planned)
  history = [...history.filter(h => !(h.source === 'calculated' && calcIds.has(h.taskId) && h.visitId === session.id)), ...calculated]

  const withActuals = applyDerivedActualDates(planned, history, overrides)
  return { tasks: computeForecasts(withActuals, now), history }
}
