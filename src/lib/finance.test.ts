import { describe, expect, it } from 'vitest'
import {
  Marche, Avenant, Situation,
  marcheAmount, projectBudget, baseBudget, approvedAvenantsTotal,
  totalBilled, totalPaid, marcheFinance, projectFinance, euros,
} from './finance'

const marche = (id: string, amountHT: number, lotId = 'L05'): Marche => ({ id, lotId, company: 'ACME', amountHT })
const avenant = (marcheId: string, amountHT: number, status: Avenant['status']): Avenant =>
  ({ id: `a-${Math.random()}`, marcheId, label: 'av', amountHT, status, date: '2026-09-01' })
const situation = (marcheId: string, amountHT: number, status: Situation['status'], number = 1): Situation =>
  ({ id: `s-${Math.random()}`, marcheId, number, date: '2026-09-01', amountHT, status })

describe('marcheAmount', () => {
  it('adds only approved avenants', () => {
    const m = marche('m1', 100000)
    const avs = [avenant('m1', 10000, 'approved'), avenant('m1', 5000, 'proposed'), avenant('m1', -2000, 'approved')]
    expect(marcheAmount(m, avs)).toBe(108000)
  })
  it('ignores avenants of other marchés', () => {
    expect(marcheAmount(marche('m1', 100000), [avenant('m2', 50000, 'approved')])).toBe(100000)
  })
})

describe('project totals', () => {
  const marches = [marche('m1', 100000), marche('m2', 50000)]
  const avs = [avenant('m1', 10000, 'approved'), avenant('m2', 5000, 'rejected')]
  it('baseBudget sums initial contracts', () => {
    expect(baseBudget(marches)).toBe(150000)
  })
  it('approvedAvenantsTotal sums approved only', () => {
    expect(approvedAvenantsTotal(avs)).toBe(10000)
  })
  it('projectBudget = base + approved avenants', () => {
    expect(projectBudget(marches, avs)).toBe(160000)
  })
})

describe('billing', () => {
  const sits = [situation('m1', 30000, 'paid'), situation('m1', 20000, 'pending'), situation('m2', 10000, 'paid')]
  it('totalBilled sums all situations', () => {
    expect(totalBilled(sits)).toBe(60000)
  })
  it('totalPaid sums paid only', () => {
    expect(totalPaid(sits)).toBe(40000)
  })
})

describe('marcheFinance', () => {
  it('computes amount/billed/paid/remaining/pct', () => {
    const m = marche('m1', 100000)
    const avs = [avenant('m1', 20000, 'approved')]
    const sits = [situation('m1', 60000, 'paid'), situation('m1', 30000, 'pending')]
    const f = marcheFinance(m, avs, sits)
    expect(f.amount).toBe(120000)
    expect(f.billed).toBe(90000)
    expect(f.paid).toBe(60000)
    expect(f.remaining).toBe(30000)
    expect(f.billedPct).toBe(75)
  })
})

describe('projectFinance', () => {
  it('aggregates the whole project', () => {
    const marches = [marche('m1', 100000), marche('m2', 100000)]
    const avs = [avenant('m1', 20000, 'approved')]
    const sits = [situation('m1', 50000, 'paid'), situation('m2', 30000, 'pending')]
    const f = projectFinance(marches, avs, sits)
    expect(f.budget).toBe(220000)
    expect(f.base).toBe(200000)
    expect(f.avenants).toBe(20000)
    expect(f.billed).toBe(80000)
    expect(f.paid).toBe(50000)
    expect(f.remaining).toBe(140000)
    expect(f.billedPct).toBe(36) // 80000/220000
  })
})

describe('euros', () => {
  it('formats with french thousands separator and no decimals', () => {
    // Strip every non-digit / non-euro char so any whitespace separator is ignored.
    expect(euros(1234567).replace(/[^\d€]/g, '')).toBe('1234567€')
  })
})
