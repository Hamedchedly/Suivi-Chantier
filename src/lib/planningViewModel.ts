// ────────────────────────────────────────────────────────────────────────────
// PlanningViewModel — géométrie pure du Gantt (aucune donnée métier).
//
// Convertit des dates en positions/largeurs de pixels pour un niveau de zoom
// donné. Le zoom ne change QUE l'échelle graphique (dayWidth) : il ne
// recalcule jamais une date.
// ────────────────────────────────────────────────────────────────────────────

import { PlanningTask } from '../types/planning'

// Semaine = vue temporelle principale et unique (les dates journalières
// restent visibles comme repères à l'intérieur de chaque semaine, sans
// exposer de vue « jour » séparée). Mois/trimestre ne restent que comme
// dézooms de confort pour une vue d'ensemble longue durée.
export type ZoomLevel = 'week' | 'month' | 'quarter'
export const ZOOM_LEVELS: ZoomLevel[] = ['week', 'month', 'quarter']
export const ZOOM_LABEL: Record<ZoomLevel, string> = { week: 'Semaine', month: 'Mois', quarter: 'Trimestre' }

// Une colonne = une semaine, large d'environ une ligne (ROW_HEIGHT, GanttRow.tsx)
// à 100 % de zoom — plus la largeur fixe de 98px (14×7) d'origine, jugée trop
// large par rapport à la hauteur d'une ligne (34px).
const WEEK_COLUMN_WIDTH = 34
export const BASE_DAY_WIDTH: Record<ZoomLevel, number> = { week: WEEK_COLUMN_WIDTH / 7, month: 5, quarter: 1.6 }
const PADDING_DAYS: Record<ZoomLevel, number> = { week: 10, month: 20, quarter: 45 }

const MS_DAY = 86400000

// Garde-fou (même principe que calendar.ts : nextWorkingDay/addWorkingDays/
// workingDaysBetween, qui bornent déjà leurs boucles jour par jour avec un
// guard). Une date de tâche corrompue mais valide au sens JS (donc jamais
// détectée par un typeof/instanceof) peut échapper à toute validation en
// amont ; sans plafond, la frise calculée ferait tourner headerCells/
// dayTicks des dizaines de milliers de fois et produirait une largeur CSS
// démesurée — CPU proche de 100 %, mémoire qui grossit en continu (tuiles
// DOM créées en boucle), sans jamais lever d'exception. 20 000 jours
// (~54 ans) dépasse très largement tout planning de chantier réel.
const MAX_DAY_ITERATIONS = 20_000

const startOfDay = (d: Date): Date => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const addDays = (d: Date, n: number): Date => new Date(startOfDay(d).getTime() + n * MS_DAY)
export const diffDays = (a: Date, b: Date): number => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_DAY)

export interface TimelineScale {
  start: Date
  end: Date
  dayWidth: number
  zoom: ZoomLevel
  /** Ancre de la semaine n°1 (weekNumbers) : borne réelle la plus ancienne
   * parmi les dates des tâches, avant marge de confort et indépendamment
   * d'« aujourd'hui ». Optionnel pour ne pas casser les TimelineScale
   * littéraux existants (tests) qui ne le renseignent pas. */
  taskStart?: Date
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
  const taskDates: Date[] = []
  collectDates(tasks, taskDates)
  const dates: Date[] = [today, ...taskDates]
  const minT = Math.min(...dates.map(d => d.getTime()))
  let maxT = Math.max(...dates.map(d => d.getTime()))
  // Clippe la plage pathologique (voir MAX_DAY_ITERATIONS) plutôt que de
  // laisser la largeur de frise et les boucles de rendu grossir sans borne ;
  // une plage normale (bornée aux vraies dates des tâches) n'est jamais
  // affectée, seul le cas aberrant l'est.
  const maxSpanMs = MAX_DAY_ITERATIONS * MS_DAY
  if (Number.isFinite(minT) && Number.isFinite(maxT) && maxT - minT > maxSpanMs) maxT = minT + maxSpanMs
  const pad = PADDING_DAYS[zoom]
  // taskStart ignore « aujourd'hui » : la semaine 1 (weekNumbers) doit rester
  // ancrée sur la toute première tâche réelle, jamais déplacée par la date du
  // jour (ex. planning saisi pour un chantier qui démarre plus tard).
  const taskMinT = taskDates.length ? Math.min(...taskDates.map(d => d.getTime())) : minT
  return {
    start: addDays(new Date(minT), -pad), end: addDays(new Date(maxT), pad), dayWidth: width, zoom,
    taskStart: new Date(taskMinT),
  }
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
  let guard = 0
  if (scale.zoom === 'week') {
    // Jour seul (le lundi de la semaine) : le mois est porté par monthBands()
    // et n'a pas besoin d'être répété dans chaque cellule semaine.
    for (let cur = mondayOf(scale.start); cur.getTime() < scale.end.getTime() && guard++ < MAX_DAY_ITERATIONS; cur = addDays(cur, 7)) {
      cells.push({ x: xForDate(cur, scale), width: scale.dayWidth * 7, label: cur.toLocaleDateString('fr', { day: '2-digit' }) })
    }
  } else if (scale.zoom === 'month') {
    for (let cur = firstOfMonth(scale.start); cur.getTime() < scale.end.getTime() && guard++ < MAX_DAY_ITERATIONS; cur = addMonths(cur, 1)) {
      const next = addMonths(cur, 1)
      cells.push({ x: xForDate(cur, scale), width: diffDays(next, cur) * scale.dayWidth, label: cur.toLocaleDateString('fr', { month: 'short', year: '2-digit' }) })
    }
  } else {
    for (let cur = firstOfQuarter(scale.start); cur.getTime() < scale.end.getTime() && guard++ < MAX_DAY_ITERATIONS; cur = addMonths(cur, 3)) {
      const next = addMonths(cur, 3)
      cells.push({ x: xForDate(cur, scale), width: diffDays(next, cur) * scale.dayWidth, label: `T${Math.floor(cur.getMonth() / 3) + 1} ${cur.getFullYear()}` })
    }
  }
  return cells
}

export interface MonthBand { x: number; width: number; label: string }

/** Bandeau mois (vue semaine uniquement) : une cellule fusionnée par mois,
 * large de 4-5 colonnes semaine selon le nombre de lundis qu'elle contient —
 * regroupe les mêmes semaines (lundi par lundi) que headerCells('week') pour
 * rester aligné au pixel près avec la ligne de cellules semaine. */
export function monthBands(scale: TimelineScale): MonthBand[] {
  const bands: MonthBand[] = []
  let guard = 0
  let current: { key: string; label: string; x: number; width: number } | null = null
  for (let cur = mondayOf(scale.start); cur.getTime() < scale.end.getTime() && guard++ < MAX_DAY_ITERATIONS; cur = addDays(cur, 7)) {
    const key = `${cur.getFullYear()}-${cur.getMonth()}`
    const x = xForDate(cur, scale)
    const width = scale.dayWidth * 7
    if (current && current.key === key) {
      current.width += width
    } else {
      if (current) bands.push(current)
      current = { key, label: cur.toLocaleDateString('fr', { month: 'long', year: 'numeric' }), x, width }
    }
  }
  if (current) bands.push(current)
  return bands.map(({ x, width, label }) => ({ x, width, label }))
}

export interface WeekNumberCell { x: number; width: number; label: string }

/** N° de semaine séquentiel depuis le début réel du chantier (pas un n° ISO
 * calendaire) : semaine 1 = la semaine du lundi de la toute première tâche
 * réelle (scale.taskStart). Sans taskStart (littéraux de test existants),
 * s'ancre sur scale.start pour rester utilisable sans casser leur typage. */
export function weekNumbers(scale: TimelineScale): WeekNumberCell[] {
  const anchor = mondayOf(scale.taskStart ?? scale.start)
  const cells: WeekNumberCell[] = []
  let guard = 0
  for (let cur = mondayOf(scale.start); cur.getTime() < scale.end.getTime() && guard++ < MAX_DAY_ITERATIONS; cur = addDays(cur, 7)) {
    const weekIndex = Math.round(diffDays(cur, anchor) / 7) + 1
    cells.push({ x: xForDate(cur, scale), width: scale.dayWidth * 7, label: String(weekIndex) })
  }
  return cells
}

export interface CurrentWeekBand { x: number; width: number }

/** Bande verticale surlignant la semaine courante (« aujourd'hui »), sur
 * toute la colonne — remplace la ligne fine d'origine, format du planning de
 * référence. null si aujourd'hui tombe hors de la plage affichée. */
export function currentWeekBand(scale: TimelineScale, today: Date): CurrentWeekBand | null {
  if (today.getTime() < scale.start.getTime() || today.getTime() >= scale.end.getTime()) return null
  const monday = mondayOf(today)
  return { x: xForDate(monday, scale), width: scale.dayWidth * 7 }
}

export interface DayTick { x: number; width: number; label: string; isWeekend: boolean; isToday: boolean }

/** Repères journaliers à l'intérieur de chaque semaine — jamais une vue séparée,
 * uniquement affichés en sous-ligne de l'en-tête semaine et en grille légère. */
export function dayTicks(scale: TimelineScale, today: Date): DayTick[] {
  const ticks: DayTick[] = []
  let guard = 0
  for (let cur = scale.start; cur.getTime() < scale.end.getTime() && guard++ < MAX_DAY_ITERATIONS; cur = addDays(cur, 1)) {
    const dow = cur.getDay()
    ticks.push({
      x: xForDate(cur, scale), width: scale.dayWidth,
      label: String(cur.getDate()),
      isWeekend: dow === 0 || dow === 6,
      isToday: diffDays(cur, today) === 0,
    })
  }
  return ticks
}
