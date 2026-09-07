// Observation view helpers (pure). The distinction between a progress note
// (ProgressEntry.comment) and an observation (business object persisting over
// time) is kept strict in the UI.

import type { Observation, ObservationEvent } from './types'

export interface ObservationView {
  id: string
  date: string
  status: string | null
  content: string
  unitId: string | null
  lotId: string | null
  taskId: string | null
  visitId: string | null
  createdBy: string | null
}

/**
 * Observations relevant to a task: either directly linked to this task, or
 * lot-scoped (task_id null, same lot). Observations belonging to ANOTHER task
 * are always excluded.
 */
export function observationsForTask(observations: Observation[], taskId: string, lotId: string): Observation[] {
  return observations.filter(
    (observation) => observation.task_id === taskId || (observation.task_id === null && observation.lot_id === lotId)
  )
}

const latestEvent = (events: ObservationEvent[], observationId: string): ObservationEvent | undefined =>
  events
    .filter((event) => event.observation_id === observationId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0]

export function buildObservationViews(observations: Observation[], events: ObservationEvent[]): ObservationView[] {
  const views = observations.map((observation) => {
    const event = latestEvent(events, observation.id)
    const date = event?.occurred_at ?? observation.created_at
    const content = event?.note || observation.detail || observation.title
    return {
      id: observation.id,
      date,
      status: event?.status ?? observation.status,
      content,
      unitId: observation.unit_id,
      lotId: observation.lot_id,
      taskId: observation.task_id,
      visitId: event?.visit_id ?? null,
      createdBy: observation.created_by
    }
  })
  return views.sort((a, b) => b.date.localeCompare(a.date))
}

/** General observations (unit null) stay visible everywhere; unit-specific ones only in their own location. */
export function filterObservationViewsByUnit(views: ObservationView[], unitId: string | null): ObservationView[] {
  if (unitId === null) return views
  return views.filter((view) => view.unitId === null || view.unitId === unitId)
}