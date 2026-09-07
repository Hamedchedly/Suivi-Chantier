import { describe, expect, it } from 'vitest'
import { buildObservationViews, filterObservationViewsByUnit, observationsForTask } from './observations'
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