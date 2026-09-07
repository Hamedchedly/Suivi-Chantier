import { describe, expect, it } from 'vitest'
import {
  OBSERVATION_PRIORITY_OPTIONS,
  OBSERVATION_STATUS_OPTIONS,
  buildObservationInsert,
  buildObservationViews,
  buildTimeline,
  dueDateLabel,
  dueDateState,
  eventHistoryForObservation,
  filterObservationViewsByUnit,
  observationsForLocation,
  observationsForTask,
  observationPriorityLabel,
  observationStatusLabel
} from './observations'
import type { Observation, ObservationEvent } from './types'

let obsId = 0
const observation = (overrides: Partial<Observation> = {}): Observation => ({
  id: `obs${++obsId}`,
  operation_id: 'op',
  unit_id: null,
  lot_id: 'lot1',
  task_id: null,
  status: 'new',
  title: 'Titre',
  detail: null,
  priority: null,
  due_date: null,
  responsible_user_id: null,
  created_at: '2026-09-01T08:00:00Z',
  created_by: null,
  ...overrides
})

const event = (overrides: Partial<ObservationEvent> = {}): ObservationEvent => ({
  id: `evt${++obsId}`,
  observation_id: 'obs1',
  visit_id: null,
  status: null,
  note: null,
  occurred_at: '2026-09-02T08:00:00Z',
  created_by: null,
  ...overrides
})

describe('observationsForTask', () => {
  it('keeps observations linked to the task and lot-scoped ones', () => {
    const obs = [
      observation({ id: 'a', task_id: 't1' }),
      observation({ id: 'b', task_id: null, lot_id: 'lot1' }),
      observation({ id: 'c', task_id: 't2' })
    ]
    const selected = observationsForTask(obs, 't1', 'lot1')
    expect(selected.map((item) => item.id)).toEqual(['a', 'b'])
  })
  it('excludes observations that belong to another task', () => {
    const obs = [observation({ id: 'x', task_id: 't2' }), observation({ id: 'y', task_id: 't3' })]
    expect(observationsForTask(obs, 't1', 'lot1')).toHaveLength(0)
  })
  it('returns empty when nothing exists', () => {
    expect(observationsForTask([], 't1', 'lot1')).toHaveLength(0)
  })
})

describe('buildObservationViews', () => {
  it('merges the latest event into the view and sorts most recent first', () => {
    const obs = [
      observation({ id: 'o1', task_id: 't1', title: 'Défaut menuiserie', created_at: '2026-09-01T08:00:00Z' }),
      observation({ id: 'o2', task_id: 't1', title: 'Point sec', created_at: '2026-08-30T08:00:00Z' })
    ]
    const events = [
      event({ observation_id: 'o1', note: 'Défaut constaté côté cour.', visit_id: 'v9', occurred_at: '2026-09-10T08:00:00Z' })
    ]
    const views = buildObservationViews(obs, events)
    expect(views).toHaveLength(2)
    expect(views[0].id).toBe('o1')
    expect(views[0].content).toContain('Défaut constaté')
    expect(views[0].visitId).toBe('v9')
    expect(views[1].content).toBe('Point sec')
  })
})

describe('statuses and insert builders', () => {
  it('statuses match the schema CHECK exactly', () => {
    const values = OBSERVATION_STATUS_OPTIONS.map((option) => option.value)
    expect(values).toContain('new')
    expect(values).toContain('to_verify')
    expect(values).toContain('done')
    expect(values).not.toContain('in_progress')
  })
  it('translates known statuses and keeps unknown ones readable', () => {
    expect(observationStatusLabel('new')).toBe('Nouveau')
    expect(observationStatusLabel('to_verify')).toBe('À vérifier')
    expect(observationStatusLabel('done')).toBe('Fait')
    expect(observationStatusLabel('mystery')).toBe('mystery')
    expect(observationStatusLabel(null)).toBe('—')
  })
  it('builds an observation insert with location, lot and task', () => {
    const insert = buildObservationInsert('op', { title: 'Défaut', unit_id: 'u1', lot_id: 'lot1', task_id: 't1', status: 'blocked', due_date: '2026-09-30' })
    expect(insert).toMatchObject({ operation_id: 'op', unit_id: 'u1', lot_id: 'lot1', task_id: 't1', status: 'blocked', due_date: '2026-09-30', priority: 'normal' })
  })
  it('builds a general observation when no lot or task is given', () => {
    const insert = buildObservationInsert('op', { title: 'Point général', unit_id: 'u1' })
    expect(insert.task_id).toBeNull()
    expect(insert.lot_id).toBeNull()
    expect(insert.status).toBe('new')
  })
})

describe('observationsForLocation', () => {
  it('keeps unit-specific and general observations only', () => {
    const all = [
      observation({ id: 'a', unit_id: 'u1' }),
      observation({ id: 'b', unit_id: null }),
      observation({ id: 'c', unit_id: 'u2' })
    ]
    expect(observationsForLocation(all, 'u1').map((item) => item.id)).toEqual(['a', 'b'])
  })
})

describe('eventHistoryForObservation', () => {
  it('keeps every evolution event, oldest first, without rewriting history', () => {
    const events = [
      event({ observation_id: 'o1', status: 'to_verify', occurred_at: '2026-09-05T08:00:00Z' }),
      event({ observation_id: 'o1', status: 'new', occurred_at: '2026-09-01T08:00:00Z' }),
      event({ observation_id: 'other', status: 'done', occurred_at: '2026-09-09T08:00:00Z' })
    ]
    const history = eventHistoryForObservation(events, 'o1')
    expect(history).toHaveLength(2)
    expect(history[0].status).toBe('new')
    expect(history[1].status).toBe('to_verify')
  })
})

describe('filterObservationViewsByUnit', () => {
  it('keeps general and matching unit observations, hides others', () => {
    const views = [
      { id: 'g', date: '2026-09-01T08:00:00Z', status: null, content: 'générale', unitId: null, lotId: 'lot1', taskId: null, visitId: null, createdBy: null },
      { id: 'l1', date: '2026-09-01T08:00:00Z', status: null, content: 'localisée l1', unitId: 'u1', lotId: 'lot1', taskId: null, visitId: null, createdBy: null },
      { id: 'l2', date: '2026-09-01T08:00:00Z', status: null, content: 'localisée l2', unitId: 'u2', lotId: 'lot1', taskId: null, visitId: null, createdBy: null }
    ]
    expect(filterObservationViewsByUnit(views, 'u1').map((view) => view.id)).toEqual(['g', 'l1'])
    expect(filterObservationViewsByUnit(views, null)).toHaveLength(3)
  })
})

describe('priorities and due dates', () => {
  it('uses only the real priority CHECK values', () => {
    const values = OBSERVATION_PRIORITY_OPTIONS.map((option) => option.value)
    expect(values).toEqual(['low', 'normal', 'high', 'critical'])
    expect(values).not.toContain('urgent')
  })
  it('labels priorities', () => {
    expect(observationPriorityLabel('high')).toBe('Haute')
    expect(observationPriorityLabel('unknown')).toBe('unknown')
    expect(observationPriorityLabel(null)).toBe('—')
  })
  it('classifies due dates as none, future, today or overdue', () => {
    expect(dueDateState(null, '2026-09-07')).toBe('none')
    expect(dueDateState('', '2026-09-07')).toBe('none')
    expect(dueDateState('2026-12-01', '2026-09-07')).toBe('future')
    expect(dueDateState('2026-09-07', '2026-09-07')).toBe('today')
    expect(dueDateState('2026-08-01', '2026-09-07')).toBe('overdue')
    expect(dueDateLabel(dueDateState('2026-08-01', '2026-09-07'))).toBe('Échéance dépassée')
  })
})

describe('buildTimeline', () => {
  it('merges events and audit rows in chronological order without losing history', () => {
    const historyRow = { id: 'h1', observation_id: 'o1', changed_at: '2026-09-12T08:00:00Z', changed_by: 'u1', action: 'UPDATE', snapshot: { status: 'to_verify' } }
    const items = buildTimeline(
      [
        event({ observation_id: 'o1', status: 'new', occurred_at: '2026-09-11T08:00:00Z' }),
        event({ observation_id: 'o1', status: 'done', note: 'Correction constatée.', occurred_at: '2026-09-18T08:00:00Z' })
      ],
      [historyRow]
    )
    expect(items).toHaveLength(3)
    expect(items.map((item) => item.date)).toEqual([
      '2026-09-11T08:00:00Z',
      '2026-09-12T08:00:00Z',
      '2026-09-18T08:00:00Z'
    ])
    expect(items[0].source).toBe('event')
    expect(items[1].source).toBe('audit')
    expect(items[1].status).toBe('to_verify')
    expect(items[2].note).toBe('Correction constatée.')
  })
})