import { describe, expect, it } from 'vitest'
import {
  Reserve, carriedOverPoints, applyFollowUp, latestFollow, isOverdue, reserveKind,
} from './reserves'

const r = (over: Partial<Reserve> & { id: string }): Reserve => ({
  number: 'R-001', lotId: 'L05', logementId: 'A-101', description: 'x',
  priority: 'medium', status: 'open', createdAt: '2026-09-04', ...over,
})

describe('reserveKind', () => {
  it('treats legacy reserves without a kind as actions', () => {
    expect(reserveKind(r({ id: '1' }))).toBe('action')
    expect(reserveKind(r({ id: '2', kind: 'observation' }))).toBe('observation')
  })
})

describe('carriedOverPoints', () => {
  const all = [
    r({ id: '1', visitId: 'V1' }),                              // open, earlier visit → carried
    r({ id: '2', visitId: 'V1', status: 'resolved' }),          // already lifted
    r({ id: '3', visitId: 'V2' }),                              // raised by the current visit
    r({ id: '4', visitId: 'V1', logementId: 'B-201' }),         // another zone
    r({ id: '5' }),                                             // not linked to any visit
  ]
  it('returns only open points from earlier visits in that zone', () => {
    expect(carriedOverPoints(all, 'A-101', 'V2').map(x => x.id)).toEqual(['1'])
  })
  it('includes every open point when no current visit is given', () => {
    expect(carriedOverPoints(all, 'A-101').map(x => x.id)).toEqual(['1', '3'])
  })
})

describe('applyFollowUp', () => {
  const base = r({ id: '1', visitId: 'V1', dueDate: '2026-09-10' })

  it('lifting a point resolves it and keeps the verdict', () => {
    const out = applyFollowUp(base, { at: 'now', visitId: 'V2', visitDate: '2026-09-11', status: 'done' })
    expect(out.status).toBe('resolved')
    expect(latestFollow(out)).toMatchObject({ status: 'done', visitId: 'V2' })
  })

  it('keeps a point open when it is still in progress', () => {
    const out = applyFollowUp(base, { at: 'now', visitId: 'V2', visitDate: '2026-09-11', status: 'in_progress' })
    expect(out.status).toBe('open')
  })

  it('rescheduling moves the deadline', () => {
    const out = applyFollowUp(base, { at: 'now', visitId: 'V2', visitDate: '2026-09-11', status: 'rescheduled', dueDate: '2026-09-18' })
    expect(out.dueDate).toBe('2026-09-18')
    expect(out.status).toBe('open')
  })

  it('never overwrites earlier verdicts', () => {
    const once = applyFollowUp(base, { at: 'a', visitId: 'V2', visitDate: '2026-09-11', status: 'not_done' })
    const twice = applyFollowUp(once, { at: 'b', visitId: 'V3', visitDate: '2026-09-18', status: 'done' })
    expect(twice.follow?.map(f => f.status)).toEqual(['not_done', 'done'])
  })
})

describe('isOverdue', () => {
  it('is overdue once the deadline has passed and it is still open', () => {
    expect(isOverdue(r({ id: '1', dueDate: '2026-09-10' }), '2026-09-11')).toBe(true)
  })
  it('is not overdue on the deadline day, nor once resolved', () => {
    expect(isOverdue(r({ id: '1', dueDate: '2026-09-11' }), '2026-09-11')).toBe(false)
    expect(isOverdue(r({ id: '1', dueDate: '2026-09-01', status: 'resolved' }), '2026-09-11')).toBe(false)
  })
  it('is never overdue without a deadline', () => {
    expect(isOverdue(r({ id: '1' }), '2026-09-11')).toBe(false)
  })
})
