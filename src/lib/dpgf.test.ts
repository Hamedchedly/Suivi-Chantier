import { describe, expect, it } from 'vitest'
import { lineTotal, lotTotal, grandTotal, groupByLot, type DpgfLine } from './dpgf'

const line = (id: string, lotId: string, q: number, pu: number): DpgfLine =>
  ({ id, lotId, designation: 'd', unite: 'u', quantite: q, prixUnitaire: pu })

const lines = [line('1', 'L05', 10, 100), line('2', 'L05', 2, 50), line('3', 'L06', 5, 200)]

describe('dpgf totals', () => {
  it('lineTotal = qty × unit price', () => {
    expect(lineTotal(line('x', 'L05', 3, 25))).toBe(75)
  })
  it('lotTotal sums a lot', () => {
    expect(lotTotal(lines, 'L05')).toBe(1100)
    expect(lotTotal(lines, 'L06')).toBe(1000)
  })
  it('grandTotal sums everything', () => {
    expect(grandTotal(lines)).toBe(2100)
  })
})

describe('groupByLot', () => {
  it('groups preserving lot order', () => {
    const g = groupByLot(lines)
    expect(g.map(x => x.lotId)).toEqual(['L05', 'L06'])
    expect(g[0].lines).toHaveLength(2)
  })
})
