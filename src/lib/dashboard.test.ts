import { describe, expect, it } from 'vitest'
import {
  descendants,
  evolution,
  filterHistoryRows,
  itemPoints,
  latestPerTask,
  latestPerTaskAndUnit,
  metricsFromPoints,
  taskPoint
} from './dashboard'
import { progressAverage } from './progress'
import type { ProgressEntry, Task, Unit } from './types'

let sequence = 0
const entry = (task: string | null, unit: string | null, lot: string, percentage: number | null, status: string | null, date: string): ProgressEntry => ({
  id: `e${sequence++}`,
  operation_id: 'op',
  visit_id: 'v',
  unit_id: unit,
  lot_id: lot,
  task_id: task,
  progressed_at: date,
  percentage,
  status,
  comment: null,
  created_at: date,
  created_by: null
})

const task = (id: string, type: 'section' | 'item', lot: string, overrides: Partial<Task> = {}): Task => ({
  id,
  operation_id: 'op',
  lot_id: lot,
  parent_id: null,
  reference: null,
  name: id,
  section: null,
  unit: null,
  quantity: null,
  unit_price: null,
  amount: null,
  weight: 1,
  task_type: type,
  sort_order: 0,
  unit_id: null,
  ...overrides
})

const unit = (id: string, parent: string | null): Unit => ({
  id,
  operation_id: 'op',
  parent_id: parent,
  kind: id.startsWith('b') ? 'building' : 'dwelling',
  code: null,
  name: id,
  floor: null,
  sort_order: 0
})

describe('sections and items', () => {
  it('sections never produce points', () => {
    const tasks = [task('s1', 'section', 'lot1'), task('i1', 'item', 'lot1'), task('i2', 'item', 'lot1')]
    const points = itemPoints(tasks, () => undefined)
    expect(points).toHaveLength(2)
  })
})

describe('latest entries', () => {
  it('keeps the latest of several visits per task at operation level', () => {
    const rows = [
      entry('t1', 'l1', 'lot1', 25, 'in_progress', '2026-08-29T08:00:00Z'),
      entry('t1', 'l1', 'lot1', 60, 'in_progress', '2026-09-04T08:00:00Z'),
      entry('t1', 'l1', 'lot1', 100, 'done', '2026-09-11T08:00:00Z')
    ]
    const latest = latestPerTask(rows)
    expect(latest.get('t1')?.percentage).toBe(100)
  })
  it('keeps one latest per task and unit (general vs localised separation)', () => {
    const rows = [
      entry('gen', 'l1', 'lot1', 40, 'in_progress', '2026-09-01T08:00:00Z'),
      entry('gen', 'l2', 'lot1', 70, 'in_progress', '2026-09-02T08:00:00Z'),
      entry('loc', 'l1', 'lot1', 10, 'in_progress', '2026-09-03T08:00:00Z')
    ]
    const perUnit = latestPerTaskAndUnit(rows)
    expect(perUnit.size).toBe(3)
    const perTask = latestPerTask(rows)
    expect(perTask.size).toBe(2)
    expect(perTask.get('gen')?.percentage).toBe(70)
  })
})

describe('metrics', () => {
  it('simple average and counts from real points', () => {
    const tasks = [task('a', 'item', 'lot1', { quantity: 2 }), task('b', 'item', 'lot1', { quantity: 1 }), task('c', 'item', 'lot1', { quantity: 1 })]
    const latest = latestPerTask([
      entry('a', null, 'lot1', 100, 'done', '2026-09-01T08:00:00Z'),
      entry('b', null, 'lot1', 50, 'in_progress', '2026-09-01T08:00:00Z'),
      entry('c', null, 'lot1', 0, 'not_started', '2026-09-01T08:00:00Z')
    ])
    const points = itemPoints(tasks, (taskId) => latest.get(taskId))
    const metrics = metricsFromPoints(points)
    expect(metrics.total).toBe(3)
    expect(metrics.started).toBe(2)
    expect(metrics.done).toBe(1)
    expect(metrics.blocked).toBe(0)
    expect(metrics.average).toBe(50)
    expect(progressAverage(points.map((point) => ({ percentage: point.percentage, status: point.status ?? '', quantity: point.quantity, amount: point.amount })), 'quantity')).toBe(62.5)
    expect(progressAverage(points.map((point) => ({ percentage: point.percentage, status: point.status ?? '', quantity: point.quantity, amount: point.amount })), 'amount')).toBe(50)
  })
  it('counts in-progress, done and not-started separately', () => {
    const tasks = [task('a', 'item', 'lot1'), task('b', 'item', 'lot1'), task('c', 'item', 'lot1'), task('d', 'item', 'lot1')]
    const latest = latestPerTask([
      entry('a', null, 'lot1', 60, 'in_progress', '2026-09-01T08:00:00Z'),
      entry('b', null, 'lot1', 100, 'done', '2026-09-01T08:00:00Z'),
      entry('c', null, 'lot1', 0, 'not_started', '2026-09-01T08:00:00Z')
    ])
    const metrics = metricsFromPoints(itemPoints(tasks, (taskId) => latest.get(taskId)))
    expect(metrics.inProgress).toBe(1)
    expect(metrics.done).toBe(1)
    expect(metrics.notStarted).toBe(1)
    expect(metrics.untracked).toBe(1)
    expect(metrics.started).toBe(2)
  })
  it('untracked tasks are never shown as zero', () => {
    const tasks = [task('a', 'item', 'lot1'), task('b', 'item', 'lot1')]
    const points = itemPoints(tasks, () => undefined)
    const metrics = metricsFromPoints(points)
    expect(metrics.total).toBe(2)
    expect(metrics.tracked).toBe(0)
    expect(metrics.untracked).toBe(2)
    expect(metrics.average).toBeNull()
  })
  it('a blocked status with a physical percentage stays blocked', () => {
    const snapshot = entry('a', null, 'lot1', 80, 'blocked', '2026-09-01T08:00:00Z')
    const point = taskPoint(task('a', 'item', 'lot1'), snapshot)
    expect(point.has).toBe(true)
    expect(point.percentage).toBe(80)
    const metrics = metricsFromPoints([point])
    expect(metrics.blocked).toBe(1)
    expect(metrics.done).toBe(0)
  })
})

describe('evolution', () => {
  it('computes 25 to 60 to 100 as up by 40', () => {
    const result = evolution([
      entry('t1', null, 'lot1', 25, 'in_progress', '2026-08-29T08:00:00Z'),
      entry('t1', null, 'lot1', 60, 'in_progress', '2026-09-04T08:00:00Z'),
      entry('t1', null, 'lot1', 100, 'done', '2026-09-11T08:00:00Z')
    ])
    expect(result.direction).toBe('up')
    expect(result.deltaPoints).toBe(40)
    expect(result.previous?.percentage).toBe(60)
    expect(result.latest?.percentage).toBe(100)
  })
  it('flags a decrease without preventing it', () => {
    const result = evolution([
      entry('t1', null, 'lot1', 80, 'in_progress', '2026-09-04T08:00:00Z'),
      entry('t1', null, 'lot1', 60, 'in_progress', '2026-09-11T08:00:00Z')
    ])
    expect(result.direction).toBe('down')
    expect(result.deltaPoints).toBe(-20)
  })
  it('marks a first entry', () => {
    const result = evolution([entry('t1', null, 'lot1', 25, 'in_progress', '2026-08-29T08:00:00Z')])
    expect(result.first).toBe(true)
    expect(result.previous).toBeNull()
  })
})

describe('descendants', () => {
  it('collects a unit and all its nested children', () => {
    const units = [unit('b1', null), unit('b2', null), unit('l1', 'b1'), unit('l2', 'b1'), unit('z1', 'b2')]
    expect(descendants('b1', units).sort()).toEqual(['b1', 'l1', 'l2'])
  })
})

describe('history by location', () => {
  it('filters rows for one unit while null keeps every location', () => {
    const rows = [
      entry('gen', 'l1', 'lot1', 25, 'in_progress', '2026-08-29T08:00:00Z'),
      entry('gen', 'l1', 'lot1', 60, 'in_progress', '2026-09-04T08:00:00Z'),
      entry('gen', 'l2', 'lot1', 100, 'done', '2026-09-11T08:00:00Z'),
      entry(null, null, 'lot1', 50, 'in_progress', '2026-09-02T08:00:00Z')
    ]
    expect(filterHistoryRows(rows, null)).toHaveLength(4)
    const onlyL1 = filterHistoryRows(rows, 'l1')
    expect(onlyL1.map((row) => row.progressed_at)).toEqual(['2026-08-29T08:00:00Z', '2026-09-04T08:00:00Z'])
  })
  it('computes the evolution on the selected location series only', () => {
    const rows = [
      entry('gen', 'l1', 'lot1', 25, 'in_progress', '2026-08-29T08:00:00Z'),
      entry('gen', 'l1', 'lot1', 60, 'in_progress', '2026-09-04T08:00:00Z'),
      entry('gen', 'l1', 'lot1', 100, 'done', '2026-09-11T08:00:00Z'),
      entry('gen', 'l2', 'lot1', 80, 'in_progress', '2026-09-10T08:00:00Z')
    ]
    const l1 = evolution(filterHistoryRows(rows, 'l1'))
    expect(l1.direction).toBe('up')
    expect(l1.deltaPoints).toBe(40)
    expect(l1.latest?.percentage).toBe(100)
    const l2 = evolution(filterHistoryRows(rows, 'l2'))
    expect(l2.first).toBe(true)
    expect(l2.latest?.percentage).toBe(80)
  })
})