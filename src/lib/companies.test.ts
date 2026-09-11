import { describe, expect, it } from 'vitest'
import {
  listCompanies, lotsOfCompany, reservesOfCompany, openActionsOfCompany,
  observationsOfCompany, commitmentsOfCompany, commitmentVerdict, visitsOfCompany, companySummary,
} from './companies'
import type { LotContact } from './repo'
import type { Reserve } from './reserves'
import type { DateCommitment } from './commitments'
import type { Visit } from './visits'

const lots: LotContact[] = [
  { id: 'L05', name: 'LOT 05 - Menuiseries', company: 'SMP Aménagement', contactName: 'Jean', email: 'j@smp.fr', phone: '' },
  { id: 'L06', name: 'LOT 06 - Électricité', company: 'Soveclim Services', contactName: 'Marie', email: 'm@sov.fr', phone: '' },
  { id: 'L07', name: 'LOT 07 - CVC', company: 'Soveclim Services', contactName: 'Pierre', email: 'p@sov.fr', phone: '' },
]

const r = (over: Partial<Reserve> & { id: string; lotId: string }): Reserve => ({
  number: 'R-001', logementId: 'A-101', description: 'x', priority: 'medium',
  status: 'open', createdAt: '2026-09-01', ...over,
})

const c = (over: Partial<DateCommitment> & { id: string; lotId: string; promisedEnd: string; at: string }): DateCommitment => ({
  taskId: 'T', visitId: 'V1', visitDate: '2026-09-04', ...over,
})

describe('listCompanies / lotsOfCompany', () => {
  it('lists distinct companies alphabetically', () => {
    expect(listCompanies(lots)).toEqual(['SMP Aménagement', 'Soveclim Services'])
  })
  it('groups the lots a company holds', () => {
    expect(lotsOfCompany(lots, 'Soveclim Services').map(l => l.id)).toEqual(['L06', 'L07'])
  })
})

describe('reserves by company', () => {
  // The middle one has no `company` field at all — it must still be found via its lot.
  const reserves = [
    r({ id: '1', lotId: 'L06', kind: 'action', company: 'Soveclim Services' }),
    r({ id: '2', lotId: 'L07', kind: 'action' }),
    r({ id: '3', lotId: 'L05', kind: 'action' }),
    r({ id: '4', lotId: 'L06', kind: 'observation' }),
    r({ id: '5', lotId: 'L06', kind: 'action', status: 'resolved' }),
  ]

  it('matches through the lot, not the stored company name', () => {
    expect(reservesOfCompany(reserves, lots, 'Soveclim Services').map(x => x.id)).toEqual(['1', '2', '4', '5'])
  })
  it('keeps only open actions', () => {
    expect(openActionsOfCompany(reserves, lots, 'Soveclim Services').map(x => x.id)).toEqual(['1', '2'])
  })
  it('separates observations', () => {
    expect(observationsOfCompany(reserves, lots, 'Soveclim Services').map(x => x.id)).toEqual(['4'])
  })
})

describe('commitments by company', () => {
  const all = [
    c({ id: '1', lotId: 'L06', promisedEnd: '2026-09-10', at: '2026-09-04T09:00:00Z' }),
    c({ id: '2', lotId: 'L07', promisedEnd: '2026-09-25', at: '2026-09-11T09:00:00Z' }),
    c({ id: '3', lotId: 'L05', promisedEnd: '2026-09-30', at: '2026-09-11T09:00:00Z' }),
  ]
  it('returns the company history, most recent first', () => {
    expect(commitmentsOfCompany(all, lots, 'Soveclim Services').map(x => x.id)).toEqual(['2', '1'])
  })
})

describe('commitmentVerdict', () => {
  const base = c({ id: '1', lotId: 'L06', promisedEnd: '2026-09-10', at: '' })
  it('is broken once the promised date has passed', () => {
    expect(commitmentVerdict(base, '2026-09-11')).toBe('broken')
  })
  it('is pending before the date', () => {
    expect(commitmentVerdict(base, '2026-09-09')).toBe('pending')
  })
  it('respects an explicit verdict', () => {
    expect(commitmentVerdict({ ...base, outcome: 'kept' }, '2026-12-01')).toBe('kept')
  })
})

describe('visitsOfCompany', () => {
  const visit = (id: string, date: string, tasks: { lotId: string; state: string; progress?: number }[]): Visit => ({
    id, kind: 'visite', date, status: 'diffuse', participants: [], notes: [], createdAt: '',
    zones: [{
      refId: 'A-101', label: 'Logt A-101', kind: 'logement', buildingId: 'BAT-A', buildingLabel: 'Bâtiment A',
      tasks: tasks.map((t, i) => ({ taskId: `t${i}`, title: 't', lotId: t.lotId, state: t.state as never, progress: t.progress })),
    }],
  })

  const visits = [
    visit('V1', '2026-09-04', [{ lotId: 'L06', state: 'ok', progress: 40 }, { lotId: 'L07', state: 'ok', progress: 60 }]),
    visit('V2', '2026-09-11', [{ lotId: 'L05', state: 'ok', progress: 90 }]),
    visit('V3', '2026-09-18', [{ lotId: 'L06', state: 'not_checked' }]),
  ]

  it('keeps only sessions that actually inspected the company', () => {
    expect(visitsOfCompany(visits, lots, 'Soveclim Services').map(v => v.id)).toEqual(['V1'])
  })
  it('averages the progress observed on its tasks', () => {
    expect(visitsOfCompany(visits, lots, 'Soveclim Services')[0].progress).toBe(50)
  })
  it('reports no progress when nothing was quantified', () => {
    const v = [visit('V4', '2026-09-20', [{ lotId: 'L06', state: 'to_review' }])]
    expect(visitsOfCompany(v, lots, 'Soveclim Services')[0].progress).toBeNull()
  })
})

describe('companySummary', () => {
  it('counts what is owed right now', () => {
    const reserves = [
      r({ id: '1', lotId: 'L06', kind: 'action', dueDate: '2026-09-05' }),  // overdue
      r({ id: '2', lotId: 'L07', kind: 'action', dueDate: '2026-09-30' }),  // still fine
    ]
    const commitments = [c({ id: '1', lotId: 'L06', promisedEnd: '2026-09-01', at: '' })] // broken
    expect(companySummary('Soveclim Services', lots, reserves, commitments, '2026-09-11')).toEqual({
      company: 'Soveclim Services', lotCount: 2, openActions: 2, overdueActions: 1, brokenCommitments: 1,
    })
  })
})
