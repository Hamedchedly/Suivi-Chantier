import { describe, expect, it } from 'vitest'
import {
  Visit, VisitZone, VisitTaskCheck, ZoneRef,
  buildZonesFromPlanning, lotGroups, tasksState, tasksWorksProgress, tasksControlProgress,
  zoneState, zoneWorksProgress, zoneControlProgress,
  visitCounts, visitControlProgress, visitWorksProgress, remainingToControl,
  visitLotIds, nextZoneRef, notesForCompany, generalNotes,
  applyVisitToPlanning, commitmentsFromVisit, buildPlanningSnapshot, newVisit,
  progressGap, previousObservation, visitStats, visitChanges, visitKindLabel, stateAfterEdit,
} from './visits'
import type { GanttTask } from '../types/gantt'
import type { Reserve } from './reserves'

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
  ...newVisit({ kind: 'visite', date: '2026-09-11', participants: [], zones }), ...over,
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

  it('utilise le résolveur de rattachement fourni (modèle tâche→zone)', () => {
    // Des tâches sans logement_id, rattachées via un résolveur externe.
    const t2 = [parent('L', 'L05', [
      leaf({ id: 'x1', lot_id: 'L05' }),
      leaf({ id: 'x2', lot_id: 'L05' }),
    ])]
    const linked: Record<string, string> = { x1: 'A-101', x2: 'COM' }
    const zones = buildZonesFromPlanning(t2, refs, (task, refId) => linked[task.id] === refId)
    expect(zones[0].tasks.map(t => t.taskId)).toEqual(['x1'])
    expect(zones[1].tasks.map(t => t.taskId)).toEqual(['x2'])
  })

  it('retombe sur la date prévisionnelle quand aucune baseline n’existe', () => {
    const t2 = [parent('L', 'L05', [
      leaf({ id: 'x1', lot_id: 'L05', logement_id: 'A-101', planned_end: d('2026-05-10') }),
    ])]
    const check0 = buildZonesFromPlanning(t2, refs)[0].tasks[0]
    expect(check0.baselineEnd).toBe('2026-05-10')
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
  it('opens an "en cours" session of the requested kind and stamps the start', () => {
    const v = newVisit({ kind: 'reunion', date: '2026-09-11', participants: [], zones: [] })
    expect(v).toMatchObject({ kind: 'reunion', status: 'en_cours', notes: [] })
    expect(v.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
  it('keeps optional context only when provided', () => {
    const v = newVisit({ kind: 'visite', date: '2026-09-11', participants: [], zones: [], brief: '   ', kindLabel: '  ' })
    expect(v.brief).toBeUndefined()
    expect(v.kindLabel).toBeUndefined()
    expect(v.companiesPresent).toBeUndefined()
  })
  it('lets a session carry a name of its own', () => {
    const v = newVisit({ kind: 'visite', date: '2026-09-11', participants: [], zones: [], kindLabel: '  OPL bâtiment A  ' })
    expect(v.kindLabel).toBe('OPL bâtiment A')
    expect(visitKindLabel(v)).toBe('OPL bâtiment A')
    expect(visitKindLabel({ kind: 'reunion' })).toBe('Réunion de chantier')
  })
})

// ── Planning vs observed, and comparison with earlier sessions ───────────────

describe('progressGap', () => {
  it('measures observed minus planned, in points', () => {
    expect(progressGap(check({ taskId: 'a', lotId: 'L05', progress: 65, plannedProgress: 80 }))).toBe(-15)
    expect(progressGap(check({ taskId: 'a', lotId: 'L05', progress: 90, plannedProgress: 80 }))).toBe(10)
  })
  it('is null when either side is missing', () => {
    expect(progressGap(check({ taskId: 'a', lotId: 'L05', progress: 50 }))).toBeNull()
    expect(progressGap(check({ taskId: 'a', lotId: 'L05', plannedProgress: 50 }))).toBeNull()
  })
})

describe('stateAfterEdit', () => {
  it('blocks a task as soon as a blocker is named', () => {
    expect(stateAfterEdit({ state: 'ok', progress: 50, blockedBy: ['T-07'] })).toBe('blocked')
  })
  it('falls back to controlled once the blockers are cleared', () => {
    expect(stateAfterEdit({ state: 'blocked', progress: 50, blockedBy: [] })).toBe('ok')
  })
  it('stays uninspected when no progress was ever entered', () => {
    expect(stateAfterEdit({ state: 'blocked', progress: undefined, blockedBy: [] })).toBe('not_checked')
  })
  it('keeps an explicit non-applicable', () => {
    expect(stateAfterEdit({ state: 'na', progress: undefined, blockedBy: [] })).toBe('na')
  })
})

describe('previousObservation', () => {
  const older = visit([zone({ refId: 'A-101', tasks: [check({ taskId: 'T1', lotId: 'L05', state: 'ok', progress: 70, promisedEnd: '2026-09-10' })] })],
    { id: 'V1', date: '2026-09-04', status: 'diffuse' })
  const current = visit([zone({ refId: 'A-101', tasks: [check({ taskId: 'T1', lotId: 'L05', state: 'ok', progress: 100 })] })],
    { id: 'V2', date: '2026-09-11' })

  it('finds what the last closed session observed', () => {
    expect(previousObservation([older, current], current, 'T1')).toMatchObject({ date: '2026-09-04', progress: 70, promisedEnd: '2026-09-10' })
  })
  it('ignores sessions still running', () => {
    const running = { ...older, status: 'en_cours' as const }
    expect(previousObservation([running, current], current, 'T1')).toBeUndefined()
  })
  it('ignores tasks that were never controlled', () => {
    expect(previousObservation([older, current], current, 'T-other')).toBeUndefined()
  })
})

describe('visitChanges', () => {
  const older = visit([zone({ refId: 'A-101', tasks: [check({ taskId: 'T1', lotId: 'L05', state: 'ok', progress: 70 })] })],
    { id: 'V1', date: '2026-09-04', status: 'diffuse' })
  const current = visit([zone({ refId: 'A-101', label: 'Logt A-101', tasks: [check({ taskId: 'T1', lotId: 'L05', title: 'Menuiseries', state: 'ok', progress: 100 })] })],
    { id: 'V2', date: '2026-09-11' })

  const base = (over: Partial<Reserve> & { id: string }): Reserve => ({
    number: 'R-001', lotId: 'L05', logementId: 'A-101', description: 'Joint',
    priority: 'medium', status: 'open', createdAt: '', ...over,
  })

  it('reports a point lifted by this session', () => {
    const r = base({ id: '1', visitId: 'V1', follow: [{ at: '', visitId: 'V2', visitDate: '2026-09-11', status: 'done' }] })
    expect(visitChanges(current, [older, current], [r])).toContainEqual(
      expect.objectContaining({ kind: 'lifted', label: 'R-001 — Joint' }),
    )
  })

  it('reports a point still open and one rescheduled', () => {
    const still = base({ id: '1', visitId: 'V1', follow: [{ at: '', visitId: 'V2', visitDate: '2026-09-11', status: 'not_done' }] })
    const moved = base({ id: '2', number: 'R-002', visitId: 'V1', follow: [{ at: '', visitId: 'V2', visitDate: '2026-09-11', status: 'rescheduled', dueDate: '2026-09-18' }] })
    const out = visitChanges(current, [older, current], [still, moved])
    expect(out).toContainEqual(expect.objectContaining({ kind: 'still_open', detail: 'non réalisé' }))
    expect(out).toContainEqual(expect.objectContaining({ kind: 'rescheduled', detail: 'nouvelle échéance 2026-09-18' }))
  })

  it('reports points newly raised by this session', () => {
    const fresh = base({ id: '3', number: 'R-003', visitId: 'V2', dueDate: '2026-09-20' })
    expect(visitChanges(current, [older, current], [fresh])).toContainEqual(
      expect.objectContaining({ kind: 'new', detail: 'échéance 2026-09-20' }),
    )
  })

  it('reports how the works moved since the previous session', () => {
    expect(visitChanges(current, [older, current], [])).toContainEqual(
      expect.objectContaining({ kind: 'progress_up', label: 'Menuiseries', detail: '70% → 100% (+30 pts)' }),
    )
  })

  it('stays silent when nothing moved', () => {
    const flat = visit([zone({ refId: 'A-101', tasks: [check({ taskId: 'T1', lotId: 'L05', state: 'ok', progress: 70 })] })],
      { id: 'V2', date: '2026-09-11' })
    expect(visitChanges(flat, [older, flat], [])).toEqual([])
  })
})

describe('visitStats', () => {
  const reserves: Reserve[] = [
    { id: 'r1', number: 'R-001', lotId: 'L05', logementId: 'A-101', description: 'x', priority: 'medium', status: 'open', createdAt: '', visitId: 'VS', kind: 'observation' },
    { id: 'r2', number: 'R-002', lotId: 'L05', logementId: 'A-101', description: 'y', priority: 'high', status: 'open', createdAt: '', visitId: 'VS', kind: 'action' },
  ]
  const v = visit([
    zone({ refId: 'A-101', closedAt: 'x', tasks: [check({ taskId: 'a', lotId: 'L05', state: 'ok', progress: 100, promisedEnd: '2026-09-20' })] }),
    zone({ refId: 'B-201', buildingId: 'BAT-B', tasks: [check({ taskId: 'b', lotId: 'L06' })] }),
  ], { id: 'VS', startedAt: '2026-09-11T09:00:00.000Z', endedAt: '2026-09-11T10:30:00.000Z' })

  it('summarises the tour for the CR header', () => {
    expect(visitStats(v, reserves, 4)).toMatchObject({
      durationMin: 90, buildings: 1, logements: 1, tasksChecked: 1,
      observations: 1, actions: 1, photos: 4, commitments: 1,
    })
  })
  it('leaves the duration unknown while the session is open', () => {
    expect(visitStats({ ...v, endedAt: undefined }, reserves, 0).durationMin).toBeNull()
  })
})
