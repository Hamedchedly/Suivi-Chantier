// Financial domain: marchés (contracts), avenants (change orders), situations
// (payment applications). Pure functions — no I/O.

export type AvenantStatus = 'proposed' | 'approved' | 'rejected'
export type SituationStatus = 'pending' | 'paid'

export interface Marche {
  id: string
  lotId: string
  company: string
  amountHT: number // base contract amount (HT)
}

export interface Avenant {
  id: string
  marcheId: string
  label: string
  amountHT: number // signed (+ increase / - decrease)
  status: AvenantStatus
  date: string // ISO
}

export interface Situation {
  id: string
  marcheId: string
  number: number
  date: string // ISO
  amountHT: number // amount billed for this period (incremental, HT)
  status: SituationStatus
}

/** Contract amount including only APPROVED avenants. */
export function marcheAmount(marche: Marche, avenants: Avenant[]): number {
  const delta = avenants
    .filter(a => a.marcheId === marche.id && a.status === 'approved')
    .reduce((s, a) => s + a.amountHT, 0)
  return marche.amountHT + delta
}

/** Total project budget = sum of all marchés incl. approved avenants. */
export function projectBudget(marches: Marche[], avenants: Avenant[]): number {
  return marches.reduce((s, m) => s + marcheAmount(m, avenants), 0)
}

/** Total base (initial contracts, before avenants). */
export function baseBudget(marches: Marche[]): number {
  return marches.reduce((s, m) => s + m.amountHT, 0)
}

/** Sum of approved avenants across the project (signed). */
export function approvedAvenantsTotal(avenants: Avenant[]): number {
  return avenants.filter(a => a.status === 'approved').reduce((s, a) => s + a.amountHT, 0)
}

/** Amount billed to date (all situations). */
export function totalBilled(situations: Situation[]): number {
  return situations.reduce((s, x) => s + x.amountHT, 0)
}

/** Amount actually paid (paid situations only). */
export function totalPaid(situations: Situation[]): number {
  return situations.filter(s => s.status === 'paid').reduce((s, x) => s + x.amountHT, 0)
}

export interface MarcheFinance {
  marcheId: string
  lotId: string
  company: string
  amount: number // incl. approved avenants
  billed: number
  paid: number
  remaining: number // amount - billed
  billedPct: number // 0-100
}

export function marcheFinance(marche: Marche, avenants: Avenant[], situations: Situation[]): MarcheFinance {
  const amount = marcheAmount(marche, avenants)
  const mSituations = situations.filter(s => s.marcheId === marche.id)
  const billed = totalBilled(mSituations)
  const paid = totalPaid(mSituations)
  const remaining = amount - billed
  const billedPct = amount > 0 ? Math.round((billed / amount) * 100) : 0
  return { marcheId: marche.id, lotId: marche.lotId, company: marche.company, amount, billed, paid, remaining, billedPct }
}

export interface ProjectFinance {
  budget: number
  base: number
  avenants: number
  billed: number
  paid: number
  remaining: number
  billedPct: number
}

export function projectFinance(marches: Marche[], avenants: Avenant[], situations: Situation[]): ProjectFinance {
  const budget = projectBudget(marches, avenants)
  const billed = totalBilled(situations)
  const paid = totalPaid(situations)
  return {
    budget,
    base: baseBudget(marches),
    avenants: approvedAvenantsTotal(avenants),
    billed,
    paid,
    remaining: budget - billed,
    billedPct: budget > 0 ? Math.round((billed / budget) * 100) : 0,
  }
}

/** Format a number as euros (HT), French style, no decimals. */
export function euros(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`
}
