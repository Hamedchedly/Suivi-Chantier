import { describe, expect, it } from 'vitest'
import { GanttTask } from '../types/gantt'
import {
  computeForecasts, contractualWorkDays, applyForecastToPlanning, clearForecasts,
  lockBaseline, forecastDrift, forecastImpact, hasBaseline,
} from './forecast'
import { addDays } from './cpm'
import { makeCalendar } from './calendar'

const BASE = new Date(2026, 0, 5) // lundi
const d = (n: number) => addDays(BASE, n)
const NO_WEEKEND = makeCalendar([], []) // calendrier tout-ouvré, pour raisonner en jours simples

const task = (id: string, patch: Partial<GanttTask> = {}): GanttTask => ({
  id, lot_id: 'L06', title: id,
  planned_start: d(0), planned_end: d(9), planned_duration: 10,
  progress: 0, status: 'not-started', priority: 'medium',
  dependencies: [], is_milestone: false, is_critical: false,
  ...patch,
})

describe('contractualWorkDays', () => {
  it('utilise le champ explicite en priorité', () => {
    expect(contractualWorkDays(task('T', { contractual_working_days: 3 }), NO_WEEKEND)).toBe(3)
  })
  it('sinon la durée baseline ou planned, en jours ouvrés inclusifs', () => {
    expect(contractualWorkDays(task('T', { planned_start: d(0), planned_end: d(4) }), NO_WEEKEND)).toBe(5)
  })
})

describe('computeForecasts — tâche terminée', () => {
  it('forecast = dates réelles quand actual_end est connu', () => {
    const t = task('T', { actual_start: d(0), actual_end: d(3), progress: 100 })
    const [{ children }] = computeForecasts([{ ...task('LOT'), children: [t] }], d(5), NO_WEEKEND)
    const out = children!.find(c => c.id === 'T')!
    expect(out.forecast_start).toEqual(d(0))
    expect(out.forecast_end).toEqual(d(3))
  })
})

describe('computeForecasts — tâche en cours', () => {
  it('prolonge depuis le début réel sur la durée contractuelle', () => {
    const t = task('T', { actual_start: d(2), progress: 40, planned_start: d(0), planned_end: d(9) })
    const [{ children }] = computeForecasts([{ ...task('LOT'), children: [t] }], d(5), NO_WEEKEND)
    const out = children!.find(c => c.id === 'T')!
    expect(out.forecast_start).toEqual(d(2))
    expect(out.forecast_end).toEqual(d(11)) // 2 + 10 jours - 1
  })
})

describe('computeForecasts — tâche non commencée', () => {
  it('aucun écart tant que la date contractuelle de début n\'est pas dépassée', () => {
    const t = task('T', { planned_start: d(10), planned_end: d(19) })
    const [{ children }] = computeForecasts([{ ...task('LOT'), children: [t] }], d(5), NO_WEEKEND)
    const out = children!.find(c => c.id === 'T')!
    expect(out.forecast_start).toBeUndefined()
    expect(out.forecast_end).toBeUndefined()
  })

  it('démarrage en retard : la prévision commence aujourd\'hui', () => {
    const t = task('T', { planned_start: d(0), planned_end: d(9) })
    const [{ children }] = computeForecasts([{ ...task('LOT'), children: [t] }], d(5), NO_WEEKEND)
    const out = children!.find(c => c.id === 'T')!
    expect(out.forecast_start).toEqual(d(5))
    expect(out.forecast_end).toEqual(d(14))
  })
})

describe('computeForecasts — terminée sans dates réelles (import historique)', () => {
  it('ne la projette pas comme "pas commencée" : pas de prévision fabriquée', () => {
    // Cas réel : tâche importée avec progress=100 mais jamais passée par
    // actualDates.ts (pas d'actual_start/actual_end). Sans ce garde-fou,
    // computeForecasts la lirait comme "jamais démarrée, en retard depuis
    // 2026" et la projetterait comme démarrant aujourd'hui — faux.
    const t = task('T', { progress: 100, planned_start: d(-400), planned_end: d(-390) })
    const [{ children }] = computeForecasts([{ ...task('LOT'), children: [t] }], d(5), NO_WEEKEND)
    const out = children!.find(c => c.id === 'T')!
    expect(out.forecast_start).toBeUndefined()
    expect(out.forecast_end).toBeUndefined()
  })
})

describe('computeForecasts — sans progression ni dates', () => {
  it('une tâche jamais entamée et pas encore en retard n\'a pas de prévision', () => {
    const t = task('T', { progress: 0, planned_start: d(3), planned_end: d(8) })
    const [{ children }] = computeForecasts([{ ...task('LOT'), children: [t] }], d(0), NO_WEEKEND)
    const out = children!.find(c => c.id === 'T')!
    expect(out.forecast_start).toBeUndefined()
  })
})

describe('computeForecasts — dépendances', () => {
  it('propage le retard d\'un prédécesseur sur son successeur', () => {
    const a = task('A', { planned_start: d(0), planned_end: d(1), actual_start: d(0), actual_end: d(6) }) // 5j de retard
    const b = task('B', { planned_start: d(2), planned_end: d(4), dependencies: ['A'] })
    const [{ children }] = computeForecasts([{ ...task('LOT'), children: [a, b] }], d(1), NO_WEEKEND)
    const outB = children!.find(c => c.id === 'B')!
    expect(outB.forecast_start!.getTime()).toBeGreaterThan(d(4).getTime())
  })

  it('un cycle de dépendances laisse les tâches inchangées (jamais planté)', () => {
    const a = task('A', { dependencies: ['B'] })
    const b = task('B', { dependencies: ['A'] })
    const tasks = [{ ...task('LOT'), children: [a, b] }]
    const out = computeForecasts(tasks, d(5), NO_WEEKEND)
    expect(out).toBe(tasks) // renvoyé tel quel
  })
})

describe('applyForecastToPlanning / clearForecasts', () => {
  it('promeut la prévision en planning et fige la baseline au passage', () => {
    const t: GanttTask = { ...task('T'), forecast_start: d(5), forecast_end: d(14) }
    const [out] = applyForecastToPlanning([t])
    expect(out.planned_start).toEqual(d(5))
    expect(out.planned_end).toEqual(d(14))
    expect(out.baseline_start).toEqual(d(0)) // ancien planned_start figé
    expect(out.forecast_start).toBeUndefined()
  })

  it('clearForecasts efface la prévision sans toucher au reste', () => {
    const t: GanttTask = { ...task('T'), forecast_start: d(5), forecast_end: d(14) }
    const [out] = clearForecasts([t])
    expect(out.forecast_start).toBeUndefined()
    expect(out.planned_start).toEqual(d(0))
  })
})

describe('lockBaseline / hasBaseline', () => {
  it('fige le planning courant en référence contractuelle, une seule fois', () => {
    const [out] = lockBaseline([task('T', { planned_start: d(0), planned_end: d(9) })], NO_WEEKEND)
    expect(out.baseline_start).toEqual(d(0))
    expect(hasBaseline([out])).toBe(true)
  })

  it('ne réécrit pas une baseline déjà posée', () => {
    const t = task('T', { baseline_start: d(-10), baseline_end: d(-1), planned_start: d(0), planned_end: d(9) })
    const [out] = lockBaseline([t], NO_WEEKEND)
    expect(out.baseline_start).toEqual(d(-10))
  })
})

describe('forecastDrift / forecastImpact', () => {
  it('drift = forecast_end - (baseline_end ?? planned_end)', () => {
    const t = task('T', { planned_end: d(9), forecast_end: d(14) })
    expect(forecastDrift(t)).toBe(5)
  })
  it('null sans prévision', () => {
    expect(forecastDrift(task('T'))).toBeNull()
  })
  it('agrège le nombre de tâches en dérive et la dérive max', () => {
    const t1 = task('T1', { planned_end: d(9), forecast_end: d(14) })
    const t2 = task('T2', { planned_end: d(9), forecast_end: d(20) })
    const onTime = task('T3')
    expect(forecastImpact([{ ...task('LOT'), children: [t1, t2, onTime] }])).toEqual({ count: 2, maxDrift: 11 })
  })
})
