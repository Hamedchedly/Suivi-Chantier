import { describe, expect, it } from 'vitest'
import { getReserves, getVisits, getLotsConfig, getGanttTasks, getLotProgress } from './repo'

// In the node test environment there is no localStorage, so loadState falls back
// to the seed defaults. These tests lock in the repository's default data + wiring.

describe('repo default seeds (no localStorage → fallback)', () => {
  it('getReserves returns the seed reserves', () => {
    const r = getReserves()
    expect(r.length).toBeGreaterThanOrEqual(3)
    expect(r[0].number).toMatch(/^R-\d{3}$/)
  })

  it('getVisits returns seed visits', () => {
    const v = getVisits()
    expect(v.length).toBeGreaterThanOrEqual(3)
    expect(v.every(x => x.status === 'brouillon' || x.status === 'envoyé')).toBe(true)
  })

  it('getLotsConfig returns 4 lots with contact fields', () => {
    const lots = getLotsConfig()
    expect(lots).toHaveLength(4)
    expect(lots.every(l => l.company && l.email.includes('@'))).toBe(true)
  })

  it('getGanttTasks returns the planning with real Date fields', () => {
    const tasks = getGanttTasks()
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks[0].planned_start instanceof Date).toBe(true)
  })

  it('getLotProgress maps every top-level lot to a number', () => {
    const p = getLotProgress()
    const ids = Object.keys(p)
    expect(ids).toContain('L05')
    expect(typeof p['L05']).toBe('number')
  })
})
