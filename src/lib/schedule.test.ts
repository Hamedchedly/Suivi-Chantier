import { describe, expect, it } from 'vitest'
import { GanttTask, TaskStatus } from '../types/gantt'
import {
  diffDays, driftDays, maxDrift, isLate, lateTasks, tasksForToday,
  flattenLeaves, criticalLeafIds, lotSummaries, overallProgress,
} from './schedule'

const day = (iso: string) => new Date(iso + 'T00:00:00')

const leaf = (
  id: string,
  opts: Partial<GanttTask> & { start: string; end: string; baselineEnd?: string; progress?: number },
): GanttTask => ({
  id,
  lot_id: opts.lot_id ?? 'L01',
  title: opts.title ?? id,
  planned_start: day(opts.start),
  planned_end: day(opts.end),
  planned_duration: diffDays(day(opts.end), day(opts.start)),
  baseline_start: day(opts.start),
  baseline_end: opts.baselineEnd ? day(opts.baselineEnd) : day(opts.end),
  progress: opts.progress ?? 0,
  status: (opts.status ?? 'not-started') as TaskStatus,
  priority: 'medium',
  dependencies: opts.dependencies ?? [],
  is_milestone: opts.is_milestone ?? false,
  is_critical: opts.is_critical ?? false,
})

const parent = (id: string, children: GanttTask[]): GanttTask => ({
  ...leaf(id, { start: '2026-01-01', end: '2026-01-10' }),
  children,
})

describe('diffDays / driftDays', () => {
  it('counts calendar days between dates', () => {
    expect(diffDays(day('2026-01-10'), day('2026-01-01'))).toBe(9)
  })
  it('reports slippage when planned end is after baseline', () => {
    expect(driftDays(leaf('a', { start: '2026-01-01', end: '2026-01-12', baselineEnd: '2026-01-05' }))).toBe(7)
  })
  it('is zero when on baseline', () => {
    expect(driftDays(leaf('a', { start: '2026-01-01', end: '2026-01-05', baselineEnd: '2026-01-05' }))).toBe(0)
  })
})

describe('flattenLeaves', () => {
  it('returns only leaves, skipping parents', () => {
    const tree = [parent('P', [leaf('c1', { start: '2026-01-01', end: '2026-01-02' }), leaf('c2', { start: '2026-01-02', end: '2026-01-03' })])]
    expect(flattenLeaves(tree).map(t => t.id)).toEqual(['c1', 'c2'])
  })
})

describe('isLate / lateTasks', () => {
  const today = day('2026-01-15')
  it('flags overdue incomplete tasks', () => {
    expect(isLate(leaf('a', { start: '2026-01-01', end: '2026-01-10', progress: 40 }), today)).toBe(true)
  })
  it('does not flag completed tasks', () => {
    expect(isLate(leaf('a', { start: '2026-01-01', end: '2026-01-10', progress: 100 }), today)).toBe(false)
  })
  it('does not flag future tasks', () => {
    expect(isLate(leaf('a', { start: '2026-01-20', end: '2026-01-25', progress: 0 }), today)).toBe(false)
  })
  it('excludes milestones from lateTasks', () => {
    const tree = [parent('P', [leaf('m', { start: '2026-01-01', end: '2026-01-05', progress: 0, is_milestone: true })])]
    expect(lateTasks(tree, today)).toHaveLength(0)
  })
})

describe('tasksFortoday', () => {
  const today = day('2026-01-15')
  it('includes tasks straddling today', () => {
    const tree = [parent('P', [
      leaf('active', { start: '2026-01-10', end: '2026-01-20', progress: 30 }),
      leaf('past', { start: '2026-01-01', end: '2026-01-05', progress: 100 }),
      leaf('future', { start: '2026-01-25', end: '2026-01-30', progress: 0 }),
    ])]
    expect(tasksForToday(tree, today).map(t => t.id)).toEqual(['active'])
  })
})

describe('criticalLeafIds', () => {
  it('collects ids flagged critical', () => {
    const tree = [parent('P', [
      leaf('a', { start: '2026-01-01', end: '2026-01-05', is_critical: true }),
      leaf('b', { start: '2026-01-05', end: '2026-01-08' }),
    ])]
    expect([...criticalLeafIds(tree)]).toEqual(['a'])
  })
})

describe('lotSummaries / maxDrift / overallProgress', () => {
  const today = day('2026-01-15')
  const tree = [
    { ...parent('L1', [
      leaf('a', { lot_id: 'L1', start: '2026-01-01', end: '2026-01-12', baselineEnd: '2026-01-08', progress: 50 }),
      leaf('b', { lot_id: 'L1', start: '2026-01-12', end: '2026-01-20', progress: 0 }),
    ]), lot_id: 'L1' },
  ]
  it('summarises drift and lateness per lot', () => {
    const [s] = lotSummaries(tree, today)
    expect(s.drift).toBe(4)
    expect(s.late).toBe(true)
  })
  it('maxDrift returns worst slippage', () => {
    expect(maxDrift(tree)).toBe(4)
  })
  it('overallProgress averages leaves', () => {
    expect(overallProgress(tree)).toBe(25)
  })
})
