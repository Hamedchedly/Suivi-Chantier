// ────────────────────────────────────────────────────────────────────────────
// SPRINT PLANNING + JOURNAL CR — tests minimaux section 21, volet Planning
// (1 à 6 : lot terminé, N/A exclu, échelle semaine, aucune grille week-end,
// semaine courante surlignée sur toute la colonne).
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { PlanningTask } from '../types/planning'
import { isTaskGroupCompleted } from './planningEngine'
import { BASE_DAY_WIDTH, headerCells, currentWeekBand, computeTimelineRange, TimelineScale } from './planningViewModel'

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

const leaf = (id: string, progress: number, status: PlanningTask['status'] = 'in-progress'): PlanningTask => ({
  id, operationId: 'op', lotId: 'L', title: id, isMilestone: false, isCritical: false, status, progress,
  contract: { start: d('2026-01-01'), end: d('2026-01-10') },
  actual: { progress },
  forecast: { method: null },
  variance: { startDays: null, endDays: null, forecastDays: null, commitmentDays: null },
  dependencies: [], commitments: [],
})

const group = (id: string, children: PlanningTask[], progress: number, status: PlanningTask['status'] = 'in-progress'): PlanningTask => ({
  ...leaf(id, progress, status), children,
})

describe('sprint 21.1 — lot 100% => terminé (isTaskGroupCompleted)', () => {
  it('progress=100, aucune feuille bloquée => terminé', () => {
    const lot = group('LOT', [leaf('t1', 100, 'completed'), leaf('t2', 100, 'completed')], 100, 'completed')
    expect(isTaskGroupCompleted(lot)).toBe(true)
  })

  it('progress=100 mais une feuille encore bloquée => PAS terminé (21.1 bis)', () => {
    const lot = group('LOT', [leaf('t1', 100, 'completed'), leaf('t2', 100, 'blocked')], 100, 'completed')
    expect(isTaskGroupCompleted(lot)).toBe(false)
  })

  it('progress<100 => pas terminé', () => {
    const lot = group('LOT', [leaf('t1', 100, 'completed'), leaf('t2', 50, 'in-progress')], 75, 'in-progress')
    expect(isTaskGroupCompleted(lot)).toBe(false)
  })
})

describe('sprint 21.3 — N/A jamais compté 0% dans le rollup remonté (via recomputeLot, déjà couvert par gate-rollup-propagation.test.ts) ; ici : une feuille N/A à 0% n\'empêche pas isTaskGroupCompleted quand le rollup l\'a déjà exclu', () => {
  it('rollup déjà à 100% (N/A exclue en amont) => terminé même si la feuille N/A affiche encore 0%', () => {
    const naLeaf: PlanningTask = { ...leaf('t2', 0, 'not-started') }
    const lot = group('LOT', [leaf('t1', 100, 'completed'), naLeaf], 100, 'completed')
    expect(isTaskGroupCompleted(lot)).toBe(true)
  })
})

describe('sprint 21.4 — échelle : une colonne = une semaine ≈ hauteur de ligne (34px)', () => {
  it('BASE_DAY_WIDTH.week * 7 ≈ 34px (ROW_HEIGHT)', () => {
    expect(Math.round(BASE_DAY_WIDTH.week * 7)).toBe(34)
  })

  it('headerCells(week) produit des colonnes larges de dayWidth*7, une par semaine', () => {
    const scale = computeTimelineRange([], d('2026-01-01'), 'week')
    const cells = headerCells(scale)
    expect(cells.length).toBeGreaterThan(0)
    for (const c of cells) expect(c.width).toBeCloseTo(scale.dayWidth * 7, 5)
  })
})

describe('sprint 21.5 — aucune colonne/grille week-end distincte dans le corps (headerCells ne marque plus isWeekend en vue semaine)', () => {
  it('les cellules semaine ne portent aucun marqueur samedi/dimanche', () => {
    const scale = computeTimelineRange([], d('2026-01-01'), 'week')
    const cells = headerCells(scale)
    expect(cells.every(c => c.isWeekend === undefined)).toBe(true)
  })
})

describe('sprint 21.6 — semaine courante = colonne entière surlignée', () => {
  it('currentWeekBand couvre toute la largeur d\'une semaine (7 * dayWidth), pas une simple ligne', () => {
    const scale: TimelineScale = { start: d('2026-01-01'), end: d('2026-02-01'), dayWidth: 5, zoom: 'week' }
    const band = currentWeekBand(scale, d('2026-01-14'))
    expect(band).not.toBeNull()
    expect(band!.width).toBe(scale.dayWidth * 7)
  })
})
