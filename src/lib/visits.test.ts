import { describe, expect, it } from 'vitest'
import {
  makeZone, zoneState, zoneProgress, visitCounts, visitProgress,
  remainingToControl, visitLotIds, reservesForVisit, buildPlanningSnapshot,
  newVisit, type Visit, type VisitZone,
} from './visits'
import type { Reserve } from './reserves'
import type { GanttTask } from '../types/gantt'

const LOTS = ['L05', 'L06', 'L07', 'L08']

function zoneWith(states: Record<string, 'not_checked' | 'ok' | 'to_review' | 'blocked' | 'na'>): VisitZone {
  const z = makeZone('A-101', 'Logt A-101', 'logement', LOTS)
  z.tasks = z.tasks.map(t => ({ ...t, state: states[t.lotId] ?? 'not_checked' }))
  return z
}

describe('zoneState', () => {
  it('not_started when nothing controlled', () => {
    expect(zoneState(zoneWith({}))).toBe('not_started')
  })
  it('in_progress when some but not all controlled', () => {
    expect(zoneState(zoneWith({ L05: 'ok' }))).toBe('in_progress')
  })
  it('done when every applicable task is ok', () => {
    expect(zoneState(zoneWith({ L05: 'ok', L06: 'ok', L07: 'ok', L08: 'ok' }))).toBe('done')
  })
  it('na tasks are excluded from the applicable set', () => {
    expect(zoneState(zoneWith({ L05: 'ok', L06: 'ok', L07: 'ok', L08: 'na' }))).toBe('done')
  })
  it('to_review wins over done when a task is flagged', () => {
    expect(zoneState(zoneWith({ L05: 'ok', L06: 'ok', L07: 'ok', L08: 'to_review' }))).toBe('to_review')
  })
  it('blocked override takes precedence', () => {
    const z = zoneWith({ L05: 'ok', L06: 'to_review' })
    z.override = 'blocked'
    expect(zoneState(z)).toBe('blocked')
  })
  it('to_review override applies even with nothing controlled', () => {
    const z = zoneWith({})
    z.override = 'to_review'
    expect(zoneState(z)).toBe('to_review')
  })
})

describe('zoneProgress', () => {
  it('is done over controlled (à-revoir counts as controlled, non contrôlé excluded)', () => {
    // 3 terminé + 1 à-revoir + 1 non contrôlé → 3/4 = 75 %
    const z = makeZone('A', 'A', 'logement', ['a', 'b', 'c', 'd', 'e'])
    z.tasks = [
      { lotId: 'a', state: 'ok' }, { lotId: 'b', state: 'ok' }, { lotId: 'c', state: 'ok' },
      { lotId: 'd', state: 'to_review' }, { lotId: 'e', state: 'not_checked' },
    ]
    expect(zoneProgress(z)).toBe(75)
  })
  it('is 0 when nothing controlled', () => {
    expect(zoneProgress(zoneWith({}))).toBe(0)
  })
})

function visitWith(zones: VisitZone[]): Visit {
  return newVisit('2026-09-10', [], zones)
}

describe('visit aggregation', () => {
  it('counts zones by state', () => {
    const v = visitWith([
      zoneWith({ L05: 'ok', L06: 'ok', L07: 'ok', L08: 'ok' }), // done
      zoneWith({ L05: 'ok' }),                                   // in_progress
      zoneWith({ L05: 'to_review' }),                            // to_review
      zoneWith({}),                                              // not_started
    ])
    const c = visitCounts(v)
    expect(c).toMatchObject({ total: 4, done: 1, in_progress: 1, to_review: 1, not_started: 1, blocked: 0 })
  })

  it('progress is done tasks over all applicable tasks (not zones opened)', () => {
    // zone1: 4 ok ; zone2: 0 controlled → 4 done / 8 applicable = 50 %
    const v = visitWith([
      zoneWith({ L05: 'ok', L06: 'ok', L07: 'ok', L08: 'ok' }),
      zoneWith({}),
    ])
    expect(visitProgress(v)).toBe(50)
  })

  it('remainingToControl lists not_started and in_progress zones only', () => {
    const v = visitWith([
      zoneWith({ L05: 'ok', L06: 'ok', L07: 'ok', L08: 'ok' }), // done → excluded
      zoneWith({ L05: 'ok' }),                                   // in_progress → included
      zoneWith({}),                                              // not_started → included
      zoneWith({ L05: 'to_review' }),                            // to_review → excluded (controlled)
    ])
    expect(remainingToControl(v)).toHaveLength(2)
  })

  it('visitLotIds returns distinct lots touched', () => {
    const v = visitWith([zoneWith({ L05: 'ok' })])
    expect(visitLotIds(v).sort()).toEqual(['L05', 'L06', 'L07', 'L08'])
  })
})

describe('reservesForVisit', () => {
  it('keeps only reserves tagged with the visit id', () => {
    const reserves: Reserve[] = [
      { id: 'r1', number: 'R-001', lotId: 'L05', logementId: 'A-101', description: 'x', priority: 'low', status: 'open', createdAt: '2026-09-10', visitId: 'VS1' },
      { id: 'r2', number: 'R-002', lotId: 'L06', logementId: 'B-201', description: 'y', priority: 'high', status: 'open', createdAt: '2026-09-10' },
      { id: 'r3', number: 'R-003', lotId: 'L07', logementId: 'A-102', description: 'z', priority: 'medium', status: 'open', createdAt: '2026-09-10', visitId: 'VS1' },
    ]
    expect(reservesForVisit(reserves, 'VS1').map(r => r.id)).toEqual(['r1', 'r3'])
  })
})

describe('buildPlanningSnapshot', () => {
  const d = (s: string) => new Date(s + 'T00:00:00')
  const task = (over: Partial<GanttTask>): GanttTask => ({
    id: 't1', lot_id: 'L05', title: 'Pose', planned_start: d('2026-09-01'), planned_end: d('2026-09-05'),
    planned_duration: 4, progress: 40, status: 'in-progress', priority: 'medium', dependencies: [],
    is_milestone: false, is_critical: false, ...over,
  })

  it('captures a self-contained historical photograph (dates as ISO strings)', () => {
    const tasks: GanttTask[] = [{
      ...task({ id: 'L05', progress: 60, baseline_end: d('2026-09-03') }),
      children: [task({ id: 'c1', progress: 60, baseline_end: d('2026-09-03') })],
    }]
    const snap = buildPlanningSnapshot(tasks, d('2026-09-10'))
    expect(snap.lots).toHaveLength(1)
    expect(snap.tasks).toHaveLength(1)          // leaves only
    expect(typeof snap.tasks[0].plannedEnd).toBe('string')
    expect(snap.tasks[0].drift).toBe(2)         // 05 vs baseline 03
    expect(snap.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
