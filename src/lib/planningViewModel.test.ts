import { describe, expect, it } from 'vitest'
import { PlanningTask } from '../types/planning'
import {
  computeTimelineRange, xForDate, widthForRange, timelineWidth, headerCells, zoomIn, zoomOut, addDays,
} from './planningViewModel'

const BASE = new Date(2026, 0, 1)
const d = (n: number) => addDays(BASE, n)

const task = (patch: Partial<PlanningTask> = {}): PlanningTask => ({
  id: 'T1', operationId: 'OP1', lotId: 'L06', title: 'T1',
  isMilestone: false, isCritical: false, status: 'not-started', progress: 0,
  contract: { start: d(0), end: d(9) },
  actual: { progress: 0 },
  forecast: { method: null },
  variance: { startDays: null, endDays: null, forecastDays: null, commitmentDays: null },
  dependencies: [], commitments: [],
  ...patch,
})

describe('computeTimelineRange', () => {
  it('couvre les bornes réelles des tâches, avec une marge', () => {
    const scale = computeTimelineRange([task()], d(0), 'week')
    expect(scale.start.getTime()).toBeLessThanOrEqual(d(0).getTime())
    expect(scale.end.getTime()).toBeGreaterThanOrEqual(d(9).getTime())
  })

  it('inclut aujourd\'hui même hors de la plage contractuelle', () => {
    const scale = computeTimelineRange([task()], d(60), 'week')
    expect(scale.end.getTime()).toBeGreaterThanOrEqual(d(60).getTime())
  })

  it('un changement de zoom ne déplace pas les dates contractuelles sous-jacentes', () => {
    const t = task()
    const week = computeTimelineRange([t], d(0), 'week')
    const day = computeTimelineRange([t], d(0), 'day')
    expect(week.dayWidth).not.toBe(day.dayWidth)
    // la tâche elle-même n'est jamais recalculée par le zoom
    expect(t.contract.start).toEqual(d(0))
    expect(t.contract.end).toEqual(d(9))
  })
})

describe('xForDate / widthForRange', () => {
  it('positionne une date au nombre de jours écoulés × dayWidth', () => {
    const scale = { start: d(0), end: d(30), dayWidth: 10, zoom: 'day' as const }
    expect(xForDate(d(5), scale)).toBe(50)
  })

  it('largeur d\'une plage inclut le dernier jour', () => {
    const scale = { start: d(0), end: d(30), dayWidth: 10, zoom: 'day' as const }
    expect(widthForRange(d(0), d(4), scale)).toBe(50) // 5 jours inclus (0..4)
  })

  it('timelineWidth couvre toute la plage', () => {
    const scale = { start: d(0), end: d(10), dayWidth: 10, zoom: 'day' as const }
    expect(timelineWidth(scale)).toBe(100)
  })
})

describe('headerCells', () => {
  it('une cellule par jour en mode jour', () => {
    const scale = { start: d(0), end: d(3), dayWidth: 10, zoom: 'day' as const }
    expect(headerCells(scale)).toHaveLength(3)
  })

  it('découpe en semaines en mode semaine', () => {
    const scale = { start: d(0), end: d(21), dayWidth: 10, zoom: 'week' as const }
    const cells = headerCells(scale)
    expect(cells.every(c => c.width === 70)).toBe(true)
  })

  it('découpe en mois en mode mois', () => {
    const scale = { start: new Date(2026, 0, 1), end: new Date(2026, 2, 1), dayWidth: 5, zoom: 'month' as const }
    const cells = headerCells(scale)
    expect(cells.map(c => c.label)).toEqual(['janv. 26', 'févr. 26'])
  })
})

describe('zoomIn / zoomOut', () => {
  it('reste dans les bornes day..quarter', () => {
    expect(zoomIn('day')).toBe('day')
    expect(zoomOut('quarter')).toBe('quarter')
    expect(zoomIn('week')).toBe('day')
    expect(zoomOut('week')).toBe('month')
  })
})
