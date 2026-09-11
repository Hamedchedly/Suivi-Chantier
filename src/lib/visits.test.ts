import { describe, expect, it } from 'vitest'
import {
  Visit, VisitZone, VisitTaskCheck, ZoneRef,
  buildZonesFromPlanning, lotGroups, tasksState, tasksWorksProgress, tasksControlProgress,
  zoneState, zoneWorksProgress, zoneControlProgress,
  visitCounts, visitControlProgress, visitWorksProgress, remainingToControl,
  visitLotIds, nextZoneRef, notesForCompany, generalNotes,
  applyVisitToPlanning, commitmentsFromVisit, buildPlanningSnapshot, newVisit,
} from './visits'
import type { GanttTask } from '../types/gantt'

// ── Fixtures ─────────────────────────────────────────────────────────────────

// Local midnight, like the planning stores it (never UTC — that shifts the day).
const d = (iso: string) => { const [y, m, day] = iso.split('-').map(Number); return new Date(y, m - 1, day) }
const dayOf = (date: Date) => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`

const leaf = (over: Partial<GanttTask> & { id: string; lot_id: string }): GanttTask => ({
  title: over.id,
  planned_start: d('2026-09-01'),
  planned_end: d('2026-09-10'),
  planned_duration: 10,
  progress: 0,
  status: 'not-started',
  priority: 'medium',
  dependencies: [],
  is_milestone: false,
  is_critical: false,
  ...over,
})

const parent = (id: string, lot_id: string, children: GanttTask[]): GanttTask =>
  leaf({ id, lot_id, children, progress: 0 })

const check = (over: Partial<VisitTaskCheck> & { taskId: string; lotId: string }): VisitTaskCheck => ({
  title: over.taskId, state: 'not_checked', ...over,
})

const zone = (over: Partial<VisitZone> & { refId: string }): VisitZone => ({
  label: over.refId, kind: 'logement', buildingId: 'BAT-A', buildingLabel: 'Bâtiment A',
  tasks: [], override: null, ...over,
})

const visit = (zones: VisitZone[], over: Partial<Visit> = {}): Visit => ({
  ...newVisit('visite', '2026-09-11', [], zones), ...over,
})

// ── Building zones from the planning ─────────────────────────────────────────

describe('buildZonesFromPlanning', () => {
  const tasks = [
    parent('T-05-00', 'L05', [
      leaf({ id: 'T-05-A101', lot_id: 'L05', logement_id: 'A-101', title: 'Menuiseries A-101', baseline_end: d('2026-09-08'), planned_end: d('2026-09-12'), company_id: 'SMP' }),
      leaf({ id: 'T-05-B201', lot_id: 'L05', logement_id: 'B-201' }),
    ]),
    parent('T-06-00', 'L06', [
      leaf({ id: 'T-06-A101', lot_id: 'L06', logement_id: 'A-101' }),
    ]),
  ]
  const refs: ZoneRef[] = [
    { refId: 'A-101', label: 'Logt A-101', kind: 'logement', buildingId: 'BAT-A', buildingLabel: 'Bâtiment A' },
    { refId: 'COM', label: 'Parties communes', kind: 'commun', buildingId: 'COMMUNS', buildingLabel: 'Communs' },
  ]

  it('attaches every leaf task of the selected logement', () => {
    const zones = buildZonesFromPlanning(tasks, refs)
    expect(zones[0].tasks.map(t => t.taskId)).toEqual(['T-05-A101', 'T-06-A101'])
  })

  it('freezes the contractual and planned dates into the check', () => {
    const t = buildZonesFromPlanning(tasks, refs)[0].tasks[0]
    expect(t.baselineEnd).toBe('2026-09-08')
    expect(t.plannedEnd).toBe('2026-09-12')
    expect(t.company).toBe('SMP')
  })

  it('keeps a zone with no planning task (notes / photos only)', () => {
    const zones = buildZonesFromPlanning(tasks, refs)
    expect(zones[1].tasks).toHaveLength(0)
    expect(zoneState(zones[1])).toBe('not_started')
  })
})

// ── Lot grouping ─────────────────────────────────────────────────────────────

describe('lotGroups', () => {
  it('groups checks by lot preserving order', () => {
    const z = zone({ refId: 'A-101', tasks: [
      check({ taskId: 't1', lotId: 'L05' }),
      check({ taskId: 't2', lotId: 'L06' }),
      check({ taskId: 't3', lotId: 'L05' }),
    ] })
    const g = lotGroups(z)
    expect(g.map(x => x.lotId)).toEqual(['L05', 'L06'])
    expect(g[0].tasks.map(t => t.taskId)).toEqual(['t1', 't3'])
  })
})

// ── State & progress derivation ──────────────────────────────────────────────

describe('tasksState', () => {
  it('is not_started when nothing is checked', () => {
    expect(tasksState([check({ taskId: 't', lotId: 'L05' })])).toBe('not_started')
  })
  it('is in_progress when only part is checked', () => {
    expect(tasksState([
      check({ taskId: 'a', lotId: 'L05', state: 'ok' }),
      check({ taskId: 'b', lotId: 'L05' }),
    ])).toBe('in_progress')
  })
  it('is done when every applicable check is controlled', () => {
    expect(tasksState([
      check({ taskId: 'a', lotId: 'L05', state: 'ok' }),
      check({ taskId: 'b', lotId: 'L05', state: 'na' }),
    ])).toBe('done')
  })
  it('lets to_review and blocked take precedence', () => {
    expect(tasksState([check({ taskId: 'a', lotId: 'L05', state: 'to_review' })])).toBe('to_review')
    expect(tasksState([
      check({ taskId: 'a', lotId: 'L05', state: 'to_review' }),
      check({ taskId: 'b', lotId: 'L05', state: 'blocked' }),
    ])).toBe('blocked')
  })
})

describe('progress helpers', () => {
  const tasks = [
    check({ taskId: 'a', lotId: 'L05', state: 'ok', progress: 100 }),
    check({ taskId: 'b', lotId: 'L05', state: 'ok', progress: 50 }),
    check({ taskId: 'c', lotId: 'L05' }),                       // not checked → 0 %
    check({ taskId: 'd', lotId: 'L05', state: 'na', progress: 100 }), // excluded
  ]
  it('averages observed works progress over applicable tasks', () => {
    expect(tasksWorksProgress(tasks)).toBe(50)   // (100 + 50 + 0) / 3
  })
  it('measures the tour separately from the works', () => {
    expect(tasksControlProgress(tasks)).toBe(67) // 2 controlled / 3 applicable
  })
  it('returns 0 when nothing is applicable', () => {
    expect(tasksWorksProgress([])).toBe(0)
    expect(tasksControlProgress([check({ taskId: 'x', lotId: 'L05', state: 'na' })])).toBe(0)
  })
})

describe('zoneState', () => {
  it('honours an explicit close ("logement terminé")', () => {
    const z = zone({ refId: 'A', closedAt: '2026-09-11T10:00:00.000Z', tasks: [check({ taskId: 't', lotId: 'L05' })] })
    expect(zoneState(z)).toBe('done')
  })
  it('lets a pinned override win over the derived state', () => {
    const z = zone({ refId: 'A', override: 'blocked', closedAt: '2026-09-11T10:00:00.000Z' })
    expect(zoneState(z)).toBe('blocked')
  })
  it('exposes works and control progress separately', () => {
    const z = zone({ refId: 'A', tasks: [
      check({ taskId: 'a', lotId: 'L05', state: 'ok', progress: 80 }),
      check({ taskId: 'b', lotId: 'L05' }),
    ] })
    expect(zoneWorksProgress(z)).toBe(40)
    expect(zoneControlProgress(z)).toBe(50)
  })
})

// ── Visit aggregation ────────────────────────────────────────────────────────

describe('visit aggregation', () => {
  const v = visit([
    zone({ refId: 'A-101', tasks: [check({ taskId: 'a', lotId: 'L05', state: 'ok', progress: 100 })] }),
    zone({ refId: 'A-102', tasks: [
      check({ taskId: 'b', lotId: 'L06', state: 'ok', progress: 50 }),
      check({ taskId: 'c', lotId: 'L06' }),
    ] }),
    zone({ refId: 'B-201', tasks: [check({ taskId: 'd', lotId: 'L07', state: 'to_review', progress: 30, company: 'SOVECLIM' })] }),
  ])

  it('counts zones by state', () => {
    expect(visitCounts(v)).toMatchObject({ total: 3, done: 1, in_progress: 1, to_review: 1 })
  })
  it('separates tour progress from works progress', () => {
    expect(visitControlProgress(v)).toBe(75)  // 3 of 4 checks controlled
    expect(visitWorksProgress(v)).toBe(45)    // (100 + 50 + 0 + 30) / 4
  })
  it('lists remaining zones and touched lots', () => {
    expect(remainingToControl(v).map(z => z.refId)).toEqual(['A-102'])
    expect(visitLotIds(v)).toEqual(['L05', 'L06', 'L07'])
  })
})

describe('nextZoneRef', () => {
  const v = visit([
    zone({ refId: 'A-101', closedAt: 'x' }),
    zone({ refId: 'A-102' }),
    zone({ refId: 'B-201' }),
  ])
  it('moves to the next zone still open', () => {
    expect(nextZoneRef(v, 'A-102')).toBe('B-201')
  })
  it('wraps back to an earlier open zone at the end', () => {
    expect(nextZoneRef(v, 'B-201')).toBe('A-102')
  })
  it('returns null when everything else is closed', () => {
    const done = visit([zone({ refId: 'A', closedAt: 'x' }), zone({ refId: 'B', closedAt: 'x' })])
    expect(nextZoneRef(done, 'A')).toBeNull()
  })
})

describe('notes', () => {
  const v = visit([], { notes: [
    { id: 'n1', scope: 'all', text: 'Base propre', createdAt: '' },
    { id: 'n2', scope: 'company', company: 'SMP', text: 'Reprendre les joints', createdAt: '' },
  ] })
  it('separates general notes from per-company ones', () => {
    expect(generalNotes(v).map(n => n.id)).toEqual(['n1'])
    expect(notesForCompany(v, 'SMP').map(n => n.id)).toEqual(['n2'])
    expect(notesForCompany(v, 'ELEC')).toEqual([])
  })
})

// ── Applying back onto the planning ──────────────────────────────────────────

describe('applyVisitToPlanning', () => {
  const tasks = () => [
    parent('T-05-00', 'L05', [
      leaf({ id: 'T-05-A101', lot_id: 'L05', progress: 0, baseline_end: d('2026-09-08'), planned_end: d('2026-09-10') }),
      leaf({ id: 'T-05-A102', lot_id: 'L05', progress: 0 }),
    ]),
  ]

  it('writes the observed progress and status onto the leaf', () => {
    const v = visit([zone({ refId: 'A-101', tasks: [check({ taskId: 'T-05-A101', lotId: 'L05', state: 'ok', progress: 100 })] })])
    const out = applyVisitToPlanning(tasks(), v)
    expect(out[0].children![0].progress).toBe(100)
    expect(out[0].children![0].status).toBe('completed')
  })

  it('recomputes the parent lot from its children', () => {
    const v = visit([zone({ refId: 'A-101', tasks: [check({ taskId: 'T-05-A101', lotId: 'L05', state: 'ok', progress: 60 })] })])
    expect(applyVisitToPlanning(tasks(), v)[0].progress).toBe(30) // (60 + 0) / 2
  })

  it('moves planned_end to the promised date but never the contractual baseline', () => {
    const v = visit([zone({ refId: 'A-101', tasks: [check({ taskId: 'T-05-A101', lotId: 'L05', state: 'ok', progress: 40, promisedEnd: '2026-09-20' })] })])
    const t = applyVisitToPlanning(tasks(), v)[0].children![0]
    expect(dayOf(t.planned_end)).toBe('2026-09-20')
    expect(dayOf(t.baseline_end!)).toBe('2026-09-08')
  })

  it('ignores checks that were never controlled', () => {
    const v = visit([zone({ refId: 'A-101', tasks: [check({ taskId: 'T-05-A101', lotId: 'L05', progress: 90 })] })])
    expect(applyVisitToPlanning(tasks(), v)[0].children![0].progress).toBe(0)
  })

  it('marks a blocked check as blocked', () => {
    const v = visit([zone({ refId: 'A-101', tasks: [check({ taskId: 'T-05-A101', lotId: 'L05', state: 'blocked' })] })])
    expect(applyVisitToPlanning(tasks(), v)[0].children![0].status).toBe('blocked')
  })
})

describe('commitmentsFromVisit', () => {
  it('records one commitment per promised date', () => {
    const v = visit([zone({ refId: 'A-101', tasks: [
      check({ taskId: 'a', lotId: 'L05', state: 'ok', promisedEnd: '2026-09-20', company: 'SMP' }),
      check({ taskId: 'b', lotId: 'L06', state: 'ok' }),
    ] })])
    const c = commitmentsFromVisit(v)
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ taskId: 'a', promisedEnd: '2026-09-20', company: 'SMP', visitId: v.id })
  })
})

// ── Snapshot ─────────────────────────────────────────────────────────────────

describe('buildPlanningSnapshot', () => {
  it('freezes lots and leaf tasks as ISO strings', () => {
    const tasks = [parent('T-05-00', 'L05', [leaf({ id: 'T-05-A101', lot_id: 'L05', progress: 50 })])]
    const snap = buildPlanningSnapshot(tasks, d('2026-09-11'))
    expect(snap.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(snap.lots[0].lotId).toBe('L05')
    expect(snap.tasks[0]).toMatchObject({ id: 'T-05-A101', progress: 50 })
    expect(typeof snap.tasks[0].plannedEnd).toBe('string')
  })
})

describe('newVisit', () => {
  it('opens an "en cours" session of the requested kind', () => {
    const v = newVisit('reunion', '2026-09-11', [], [], '  Hebdo  ')
    expect(v).toMatchObject({ kind: 'reunion', status: 'en_cours', title: 'Hebdo', notes: [] })
  })
})
