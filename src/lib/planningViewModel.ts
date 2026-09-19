// ────────────────────────────────────────────────────────────────────────────
// PlanningViewModel — géométrie pure du Gantt (aucune donnée métier).
//
// Convertit des dates en positions/largeurs de pixels pour un niveau de zoom
// donné. Le zoom ne change QUE l'échelle graphique (dayWidth) : il ne
// recalcule jamais une date.
// ────────────────────────────────────────────────────────────────────────────

import { PlanningTask } from '../types/planning'

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter'
export const ZOOM_LEVELS: ZoomLevel[] = ['day', 'week', 'month', 'quarter']
export const ZOOM_LABEL: Record<ZoomLevel, string> = { day: 'Jour', week: 'Semaine', month: 'Mois', quarter: 'Trimestre' }

const BASE_DAY_WIDTH: Record<ZoomLevel, number> = { day: 36, week: 14, month: 5, quarter: 1.6 }
const PADDING_DAYS: Record<ZoomLevel, number> = { day: 5, week: 10, month: 20, quarter: 45 }

const MS_DAY = 86400000
const startOfDay = (d: Date): Date => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const addDays = (d: Date, n: number): Date => new Date(startOfDay(d).getTime() + n * MS_DAY)
export const diffDays = (a: Date, b: Date): number => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_DAY)

export interface TimelineScale {
  start: Date
  end: Date
  dayWidth: number
  zoom: ZoomLevel
}

function collectDates(tasks: PlanningTask[], acc: Date[]): void {
  for (const t of tasks) {
    acc.push(t.contract.start, t.contract.end)
    if (t.actual.start) acc.push(t.actual.start)
    if (t.actual.end) acc.push(t.actual.end)
    if (t.forecast.start) acc.push(t.forecast.start)
    if (t.forecast.end) acc.push(t.forecast.end)
    if (t.children?.length) collectDates(t.children, acc)
  }
}

/** Plage de la frise : bornes réelles des tâches (+ aujourd'hui), avec une marge de confort.
 * Ne recadre jamais sur une plage arbitraire : uniquement ce que les données contiennent. */
export function computeTimelineRange(tasks: PlanningTask[], today: Date, zoom: ZoomLevel = 'week', dayWidth?: number): TimelineScale {
  const width = dayWidth ?? BASE_DAY_WIDTH[zoom]
  const dates: Date[] = [today]
  collectDates(tasks, dates)
  const minT = Math.min(...dates.map(d => d.getTime()))
  const maxT = Math.max(...dates.map(d => d.getTime()))
  const pad = PADDING_DAYS[zoom]
  return { start: addDays(new Date(minT), -pad), end: addDays(new Date(maxT), pad), dayWidth: width, zoom }
}

export function xForDate(date: Date, scale: TimelineScale): number {
  return diffDays(date, scale.start) * scale.dayWidth
}

export function widthForRange(start: Date, end: Date, scale: TimelineScale): number {
  return Math.max(scale.dayWidth, (diffDays(end, start) + 1) * scale.dayWidth)
}

export function timelineWidth(scale: TimelineScale): number {
  return diffDays(scale.end, scale.start) * scale.dayWidth
}

export function zoomIn(zoom: ZoomLevel): ZoomLevel {
  const i = ZOOM_LEVELS.indexOf(zoom)
  return ZOOM_LEVELS[Math.max(0, i - 1)]
}

export function zoomOut(zoom: ZoomLevel): ZoomLevel {
  const i = ZOOM_LEVELS.indexOf(zoom)
  return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, i + 1)]
}

// ── En-tête temporel ──────────────────────────────────────────────────────

export interface HeaderCell { x: number; width: number; label: string; isWeekend?: boolean }

const mondayOf = (d: Date): Date => { const dow = (d.getDay() + 6) % 7; return addDays(d, -dow) }
const firstOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1)
const addMonths = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth() + n, 1)
const firstOfQuarter = (d: Date): Date => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)

/** Cellules d'en-tête pour le niveau de zoom courant — jour, semaine, mois ou trimestre. */
export function headerCells(scale: TimelineScale): HeaderCell[] {
  const cells: HeaderCell[] = []
  if (scale.zoom === 'day') {
    for (let cur = scale.start; cur.getTime() < scale.end.getTime(); cur = addDays(cur, 1)) {
      const dow = cur.getDay()
      cells.push({
        x: xForDate(cur, scale), width: scale.dayWidth,
        label: cur.toLocaleDateString('fr', { day: '2-digit', month: '2-digit' }),
        isWeekend: dow === 0 || dow === 6,
      })
    }
  } else if (scale.zoom === 'week') {
    for (let cur = mondayOf(scale.start); cur.getTime() < scale.end.getTime(); cur = addDays(cur, 7)) {
      cells.push({ x: xForDate(cur, scale), width: scale.dayWidth * 7, label: cur.toLocaleDateString('fr', { day: '2-digit', month: '2-digit' }) })
    }
  } else if (scale.zoom === 'month') {
    for (let cur = firstOfMonth(scale.start); cur.getTime() < scale.end.getTime(); cur = addMonths(cur, 1)) {
      const next = addMonths(cur, 1)
      cells.push({ x: xForDate(cur, scale), width: diffDays(next, cur) * scale.dayWidth, label: cur.toLocaleDateString('fr', { month: 'short', year: '2-digit' }) })
    }
  } else {
    for (let cur = firstOfQuarter(scale.start); cur.getTime() < scale.end.getTime(); cur = addMonths(cur, 3)) {
      const next = addMonths(cur, 3)
      cells.push({ x: xForDate(cur, scale), width: diffDays(next, cur) * scale.dayWidth, label: `T${Math.floor(cur.getMonth() / 3) + 1} ${cur.getFullYear()}` })
    }
  }
  return cells
}
