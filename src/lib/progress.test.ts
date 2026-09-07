import { describe, expect, it } from 'vitest'
import { latestByTask, progressAverage, type ProgressRow } from './progress'

const entry = (task: string | null, percentage: number | null, status: string, date: string): ProgressRow =>
  ({ task_id: task, percentage, status, comment: null, progressed_at: date })

describe('progressAverage', () => {
  it('ignores not_applicable items', () => {
    expect(progressAverage([
      { percentage: 100, status: 'done' },
      { percentage: null, status: 'not_applicable' }
    ])).toBe(100)
  })
  it('computes a simple average of 3 items', () => {
    expect(progressAverage([
      { percentage: 100, status: 'done' },
      { percentage: 50, status: 'in_progress' },
      { percentage: 0, status: 'not_started' }
    ])).toBe(50)
  })
  it('computes a quantity-weighted average', () => {
    const result = progressAverage([
      { percentage: 100, status: 'done', quantity: 2 },
      { percentage: 50, status: 'in_progress', quantity: 1 },
      { percentage: 0, status: 'not_started', quantity: 1 }
    ], 'quantity')
    expect(result).toBe(62.5)
  })
  it('returns null when nothing is measurable', () => {
    expect(progressAverage([])).toBeNull()
  })
})

describe('latestByTask', () => {
  it('keeps the most recent entry per task among an append-only history', () => {
    const rows = [
      entry('t1', 25, 'in_progress', '2026-08-29T08:00:00Z'),
      entry('t1', 60, 'in_progress', '2026-09-04T08:00:00Z'),
      entry('t1', 100, 'done', '2026-09-11T08:00:00Z'),
      entry('t2', 10, 'in_progress', '2026-09-01T08:00:00Z')
    ]
    const latest = latestByTask(rows)
    expect(latest.size).toBe(2)
    expect(latest.get('t1')?.percentage).toBe(100)
    expect(latest.get('t2')?.percentage).toBe(10)
  })
})