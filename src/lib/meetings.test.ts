import { describe, expect, it } from 'vitest'
import { allActions, openActions, overdueActions, nextActionRef, type Meeting, type MeetingAction } from './meetings'

const action = (ref: string, dueDate: string, status: MeetingAction['status'] = 'todo'): MeetingAction =>
  ({ id: ref, ref, text: 'faire', assignee: 'Jean', dueDate, status })

const meeting = (id: string, actions: MeetingAction[]): Meeting =>
  ({ id, date: '2026-09-01', title: 'Réunion', attendees: [], decisions: [], actions })

const today = new Date(2026, 8, 10) // 2026-09-10

describe('actions', () => {
  const meetings = [
    meeting('m1', [action('A-001', '2026-09-05'), action('A-002', '2026-09-20')]),
    meeting('m2', [action('A-003', '2026-09-01', 'done'), action('A-004', '2026-09-09')]),
  ]

  it('allActions agrège toutes les réunions', () => {
    expect(allActions(meetings)).toHaveLength(4)
  })

  it('openActions exclut les actions faites', () => {
    expect(openActions(meetings).map(a => a.ref)).toEqual(['A-001', 'A-002', 'A-004'])
  })

  it('overdueActions ne garde que les échéances dépassées et non faites', () => {
    expect(overdueActions(meetings, today).map(a => a.ref)).toEqual(['A-001', 'A-004'])
  })

  it("l'échéance du jour n'est pas en retard", () => {
    expect(overdueActions([meeting('m', [action('A-009', '2026-09-10')])], today)).toHaveLength(0)
  })
})

describe('nextActionRef', () => {
  it('démarre à A-001', () => {
    expect(nextActionRef([])).toBe('A-001')
  })
  it('incrémente au-delà du plus grand', () => {
    expect(nextActionRef([meeting('m', [action('A-001', 'x'), action('A-007', 'x')])])).toBe('A-008')
  })
})
