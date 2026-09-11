import { describe, expect, it } from 'vitest'
import { DateCommitment, commitmentsForTask, latestCommitment, isBroken, withoutVisit } from './commitments'

const c = (over: Partial<DateCommitment> & { id: string; taskId: string; at: string; promisedEnd: string }): DateCommitment => ({
  lotId: 'L05', visitId: 'VS1', visitDate: '2026-09-04', ...over,
})

const log: DateCommitment[] = [
  c({ id: '1', taskId: 'T-A', at: '2026-09-04T09:00:00.000Z', promisedEnd: '2026-09-15' }),
  c({ id: '2', taskId: 'T-A', at: '2026-09-11T09:00:00.000Z', promisedEnd: '2026-09-22', visitId: 'VS2' }),
  c({ id: '3', taskId: 'T-B', at: '2026-09-11T09:00:00.000Z', promisedEnd: '2026-09-30', visitId: 'VS2' }),
]

describe('commitmentsForTask', () => {
  it('returns the task history, most recent first', () => {
    expect(commitmentsForTask(log, 'T-A').map(x => x.id)).toEqual(['2', '1'])
  })
  it('is empty for an untouched task', () => {
    expect(commitmentsForTask(log, 'T-Z')).toEqual([])
  })
})

describe('latestCommitment', () => {
  it('returns the most recent promise', () => {
    expect(latestCommitment(log, 'T-A')?.promisedEnd).toBe('2026-09-22')
  })
  it('is undefined without any promise', () => {
    expect(latestCommitment(log, 'T-Z')).toBeUndefined()
  })
})

describe('isBroken', () => {
  it('is broken once the planning slips past the promise', () => {
    expect(isBroken(log[1], '2026-09-25')).toBe(true)
  })
  it('is kept when the planning lands on or before the promise', () => {
    expect(isBroken(log[1], '2026-09-22')).toBe(false)
    expect(isBroken(log[1], '2026-09-18')).toBe(false)
  })
})

describe('withoutVisit', () => {
  it('drops every commitment taken by one session', () => {
    expect(withoutVisit(log, 'VS2').map(x => x.id)).toEqual(['1'])
  })
})
