import { describe, expect, it } from 'vitest'
import { nextReserveNumber, filterReserves, countOpen, type Reserve } from './reserves'

const r = (over: Partial<Reserve>): Reserve => ({
  id: over.id ?? 'x',
  number: over.number ?? 'R-001',
  lotId: over.lotId ?? 'L05',
  logementId: over.logementId ?? 'A-101',
  description: over.description ?? 'desc',
  priority: over.priority ?? 'medium',
  status: over.status ?? 'open',
  createdAt: over.createdAt ?? '2026-09-10',
})

describe('nextReserveNumber', () => {
  it('starts at R-001 when empty', () => {
    expect(nextReserveNumber([])).toBe('R-001')
  })
  it('increments past the highest existing number', () => {
    expect(nextReserveNumber([r({ number: 'R-001' }), r({ number: 'R-004' }), r({ number: 'R-002' })])).toBe('R-005')
  })
})

describe('filterReserves', () => {
  const list = [
    r({ id: '1', lotId: 'L05', logementId: 'A-101', status: 'open' }),
    r({ id: '2', lotId: 'L06', logementId: 'A-101', status: 'resolved' }),
    r({ id: '3', lotId: 'L05', logementId: 'B-201', status: 'open' }),
  ]
  it('filters by lot', () => {
    expect(filterReserves(list, { lotId: 'L05' }).map(x => x.id)).toEqual(['1', '3'])
  })
  it('filters by logement', () => {
    expect(filterReserves(list, { logementId: 'A-101' }).map(x => x.id)).toEqual(['1', '2'])
  })
  it('filters by status', () => {
    expect(filterReserves(list, { status: 'open' }).map(x => x.id)).toEqual(['1', '3'])
  })
  it('combines filters (AND)', () => {
    expect(filterReserves(list, { lotId: 'L05', status: 'open' }).map(x => x.id)).toEqual(['1', '3'])
  })
  it('all status returns everything', () => {
    expect(filterReserves(list, { status: 'all' })).toHaveLength(3)
  })
})

describe('countOpen', () => {
  it('counts open reserves', () => {
    expect(countOpen([r({ status: 'open' }), r({ status: 'resolved' }), r({ status: 'open' })])).toBe(2)
  })
})
