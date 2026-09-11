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

  it('getVisits seeds a session whose zones carry real planning tasks', () => {
    const v = getVisits()
    expect(v.length).toBeGreaterThanOrEqual(1)
    expect(v[0].kind).toBe('visite')
    const zone = v[0].zones.find(z => z.refId === 'A-101')!
    expect(zone.buildingLabel).toBe('Bâtiment A')
    // checks point at real Gantt leaves and carry their contractual date
    expect(zone.tasks.length).toBeGreaterThan(0)
    expect(zone.tasks[0].taskId).toMatch(/^T-/)
    expect(zone.tasks[0].baselineEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/)
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
