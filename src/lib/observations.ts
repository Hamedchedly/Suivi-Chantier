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

// Statuses are the exact values accepted by the observations CHECK constraint
// (migration 001): done, cancelled, not_started, reminder, blocked, postponed, new, to_verify.
export const OBSERVATION_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'new', label: 'Nouveau' },
  { value: 'to_verify', label: 'À vérifier' },
  { value: 'not_started', label: 'Non commencé' },
  { value: 'reminder', label: 'Rappel' },
  { value: 'blocked', label: 'Bloqué' },
  { value: 'postponed', label: 'Reporté' },
  { value: 'done', label: 'Fait' },
  { value: 'cancelled', label: 'Annulé' }
]

const OBSERVATION_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  OBSERVATION_STATUS_OPTIONS.map((option) => [option.value, option.label])
)

export function observationStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return OBSERVATION_STATUS_LABELS[status] ?? status
}

/** Observations visible while visiting a location: those of this unit plus general ones. */
export function observationsForLocation(observations: Observation[], unitId: string): Observation[] {
  return observations.filter((observation) => observation.unit_id === null || observation.unit_id === unitId)
}

/** Event history of one observation, oldest first — append-only, never rewritten. */
export function eventHistoryForObservation(events: ObservationEvent[], observationId: string): ObservationEvent[] {
  return events
    .filter((event) => event.observation_id === observationId)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id))
}

export interface ObservationInsertValues {
  title: string
  unit_id?: string | null
  lot_id?: string | null
  task_id?: string | null
  detail?: string | null
  priority?: string | null
  due_date?: string | null
  status?: string
}

export function buildObservationInsert(operation_id: string, values: ObservationInsertValues) {
  return {
    operation_id,
    unit_id: values.unit_id ?? null,
    lot_id: values.lot_id ?? null,
    task_id: values.task_id ?? null,
    title: values.title,
    detail: values.detail ?? null,
    priority: values.priority ?? 'normal',
    due_date: values.due_date ?? null,
    status: values.status ?? 'new'
  }
}

export function buildObservationEventInsert(values: { observation_id: string; visit_id?: string | null; status?: string | null; note?: string | null }) {
  return {
    observation_id: values.observation_id,
    visit_id: values.visit_id ?? null,
    status: values.status ?? null,
    note: values.note ?? null
  }
}