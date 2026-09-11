// ────────────────────────────────────────────────────────────────────────────
// Everything the app knows about one entreprise, gathered in one place.
//
// The contractual company name lives in the lots configuration; the planning
// only carries a short code (ELEC, SMP…) and older reserves may carry nothing
// at all. So the lot is always the pivot: lotId → LotContact.company. Matching
// on the stored `company` field alone would silently miss records.
// ────────────────────────────────────────────────────────────────────────────

import type { LotContact } from './repo'
import type { Reserve } from './reserves'
import type { DateCommitment } from './commitments'
import type { Visit } from './visits'
import { reserveKind } from './reserves'

/** Distinct companies, in alphabetical order. */
export function listCompanies(lots: LotContact[]): string[] {
  return [...new Set(lots.map(l => l.company).filter(Boolean))].sort()
}

/** The lots a company is responsible for. */
export function lotsOfCompany(lots: LotContact[], company: string): LotContact[] {
  return lots.filter(l => l.company === company)
}

const lotIdsOf = (lots: LotContact[], company: string) =>
  new Set(lotsOfCompany(lots, company).map(l => l.id))

/** Reserves attached to the company's lots (the lot is the reliable link). */
export function reservesOfCompany(reserves: Reserve[], lots: LotContact[], company: string): Reserve[] {
  const ids = lotIdsOf(lots, company)
  return reserves.filter(r => ids.has(r.lotId))
}

export function openActionsOfCompany(reserves: Reserve[], lots: LotContact[], company: string): Reserve[] {
  return reservesOfCompany(reserves, lots, company)
    .filter(r => reserveKind(r) === 'action' && r.status === 'open')
}

export function observationsOfCompany(reserves: Reserve[], lots: LotContact[], company: string): Reserve[] {
  return reservesOfCompany(reserves, lots, company).filter(r => reserveKind(r) === 'observation')
}

/** Date promises made by the company, most recent first. */
export function commitmentsOfCompany(all: DateCommitment[], lots: LotContact[], company: string): DateCommitment[] {
  const ids = lotIdsOf(lots, company)
  return all.filter(c => ids.has(c.lotId)).sort((a, b) => b.at.localeCompare(a.at))
}

/** A commitment is broken once its date has passed without being kept. */
export function commitmentVerdict(c: DateCommitment, today: string): 'kept' | 'broken' | 'pending' {
  if (c.outcome === 'kept') return 'kept'
  if (c.outcome === 'broken') return 'broken'
  return c.promisedEnd < today ? 'broken' : 'pending'
}

export interface CompanyVisit {
  id: string
  date: string
  title?: string
  /** Works progress observed on this company's tasks during that session. */
  progress: number | null
}

/** Sessions that actually inspected one of the company's lots, most recent first. */
export function visitsOfCompany(visits: Visit[], lots: LotContact[], company: string): CompanyVisit[] {
  const ids = lotIdsOf(lots, company)
  const out: CompanyVisit[] = []
  for (const v of visits) {
    const checks = v.zones.flatMap(z => z.tasks)
      .filter(t => ids.has(t.lotId) && t.state !== 'not_checked' && t.state !== 'na')
    if (checks.length === 0) continue
    const quantified = checks.filter(t => t.progress !== undefined)
    out.push({
      id: v.id,
      date: v.date,
      title: v.title,
      progress: quantified.length
        ? Math.round(quantified.reduce((s, t) => s + (t.progress ?? 0), 0) / quantified.length)
        : null,
    })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

export interface CompanySummary {
  company: string
  lotCount: number
  openActions: number
  overdueActions: number
  brokenCommitments: number
}

export function companySummary(
  company: string, lots: LotContact[], reserves: Reserve[], commitments: DateCommitment[], today: string,
): CompanySummary {
  const actions = openActionsOfCompany(reserves, lots, company)
  return {
    company,
    lotCount: lotsOfCompany(lots, company).length,
    openActions: actions.length,
    overdueActions: actions.filter(r => !!r.dueDate && r.dueDate < today).length,
    brokenCommitments: commitmentsOfCompany(commitments, lots, company)
      .filter(c => commitmentVerdict(c, today) === 'broken').length,
  }
}
