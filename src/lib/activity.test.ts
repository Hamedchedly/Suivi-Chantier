import { describe, expect, it } from 'vitest'
import { pushEvent, relativeTime, groupByDay, ACTIVITY_MAX, type ActivityEvent } from './activity'

describe('pushEvent', () => {
  it('prepends the new event', () => {
    const r = pushEvent([], 'visit', 'Visite enregistrée')
    expect(r).toHaveLength(1)
    expect(r[0].type).toBe('visit')
    expect(r[0].message).toBe('Visite enregistrée')
  })
  it('caps at ACTIVITY_MAX', () => {
    let list: ActivityEvent[] = []
    for (let i = 0; i < ACTIVITY_MAX + 20; i++) list = pushEvent(list, 'doc', `e${i}`)
    expect(list).toHaveLength(ACTIVITY_MAX)
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-09-10T12:00:00')
  it('shows minutes/hours/hier', () => {
    expect(relativeTime('2026-09-10T11:58:00', now)).toBe('il y a 2 min')
    expect(relativeTime('2026-09-10T09:00:00', now)).toBe('il y a 3 h')
    expect(relativeTime('2026-09-09T12:00:00', now)).toBe('hier')
  })
})

describe('groupByDay', () => {
  it('groups consecutive events by day', () => {
    const evs: ActivityEvent[] = [
      { id: '1', at: '2026-09-10T10:00:00', type: 'visit', message: 'a' },
      { id: '2', at: '2026-09-10T09:00:00', type: 'reserve', message: 'b' },
      { id: '3', at: '2026-09-09T15:00:00', type: 'finance', message: 'c' },
    ]
    const g = groupByDay(evs)
    expect(g).toHaveLength(2)
    expect(g[0].events).toHaveLength(2)
    expect(g[1].events).toHaveLength(1)
  })
})
