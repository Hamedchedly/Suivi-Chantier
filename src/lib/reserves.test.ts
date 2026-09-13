import { describe, expect, it } from 'vitest'
import {
  nextReserveNumber, filterReserves, countOpen, applyFollowUp, isReported, crState, type Reserve,
} from './reserves'

const r = (over: Partial<Reserve>): Reserve => ({
  id: 'x', number: 'R-001', lotId: 'L05', logementId: 'A-101', description: 'desc',
  priority: 'medium', status: 'open', createdAt: '2026-09-10',
  ...over,
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

const fu = (status: Parameters<typeof applyFollowUp>[1]['status'], over: Partial<Parameters<typeof applyFollowUp>[1]> = {}) => ({
  at: '2026-09-10T10:00:00Z', visitId: 'v1', visitDate: '2026-09-10', status, ...over,
})

describe('applyFollowUp', () => {
  it('terminer → resolved, historique append-only', () => {
    const out = applyFollowUp(r({}), fu('done', { note: 'ok' }))
    expect(out.status).toBe('resolved')
    expect(out.follow).toHaveLength(1)
  })
  it('obsolète → statut obsolete', () => {
    expect(applyFollowUp(r({}), fu('obsolete')).status).toBe('obsolete')
  })
  it('commentaire → statut inchangé, ajouté à l’historique', () => {
    const out = applyFollowUp(r({ status: 'open' }), fu('comment', { note: 'réponse entreprise' }))
    expect(out.status).toBe('open')
    expect(out.follow?.[0].note).toBe('réponse entreprise')
  })
  it('reporté → nouvelle échéance', () => {
    expect(applyFollowUp(r({ dueDate: '2026-09-01' }), fu('rescheduled', { dueDate: '2026-10-01' })).dueDate).toBe('2026-10-01')
  })
})

describe('isReported / crState', () => {
  it('un point reporté à une échéance future est « reported » (orange)', () => {
    const rep = applyFollowUp(r({}), fu('rescheduled', { dueDate: '2026-12-01' }))
    expect(isReported(rep, '2026-09-14')).toBe(true)
    expect(crState(rep, '2026-09-14').tone).toBe('reported')
  })
  it('échéance dépassée → overdue (rouge) l’emporte', () => {
    const rep = applyFollowUp(r({}), fu('rescheduled', { dueDate: '2026-09-01' }))
    expect(crState(rep, '2026-09-14').tone).toBe('overdue')
  })
  it('rappel/mémo → reminder (rouge)', () => {
    expect(crState(r({ reminder: true }), '2026-09-14').tone).toBe('reminder')
  })
  it('résolu prime sur rappel', () => {
    expect(crState(r({ reminder: true, status: 'resolved' }), '2026-09-14').tone).toBe('done')
  })
  it('évoqué à la dernière réunion → lastMeeting', () => {
    expect(crState(r({ meetingDate: '2026-09-08' }), '2026-09-14', '2026-09-08').lastMeeting).toBe(true)
    expect(crState(r({ meetingDate: '2026-08-01' }), '2026-09-14', '2026-09-08').lastMeeting).toBe(false)
  })
})
