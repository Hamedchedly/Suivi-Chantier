import { describe, it, expect } from 'vitest'
import { actualDatesFor, withActualDates, applyActualDates, endDrift, startDrift } from './actualDates'
import { GanttTask } from '../types/gantt'

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

const task = (over: Partial<GanttTask> = {}): GanttTask => ({
  id: 'T-1', lot_id: 'L05', title: 'Doublage',
  planned_start: d('2026-02-16'), planned_end: d('2026-03-08'), planned_duration: 15,
  progress: 0, status: 'not-started', priority: 'medium',
  dependencies: [], is_milestone: false, is_critical: false,
  ...over,
})

describe('actualDatesFor', () => {
  it('ne pose aucune date réelle tant que rien n’a démarré', () => {
    expect(actualDatesFor({}, 0, d('2026-03-01'))).toEqual({})
  })

  it('fige le début réel au premier constat d’avancement', () => {
    expect(actualDatesFor({}, 20, d('2026-03-01'))).toEqual({ actual_start: d('2026-03-01') })
  })

  it('ne déplace pas un début réel déjà constaté', () => {
    const r = actualDatesFor({ actual_start: d('2026-02-10') }, 60, d('2026-03-01'))
    expect(r.actual_start).toEqual(d('2026-02-10'))
    expect(r.actual_end).toBeUndefined()
  })

  it('fige la fin réelle au constat qui porte la tâche à 100 %', () => {
    const r = actualDatesFor({ actual_start: d('2026-02-10') }, 100, d('2026-03-05'))
    expect(r.actual_end).toEqual(d('2026-03-05'))
  })

  it('ne déplace pas une fin réelle déjà constatée', () => {
    const r = actualDatesFor({ actual_start: d('2026-02-10'), actual_end: d('2026-03-02') }, 100, d('2026-03-20'))
    expect(r.actual_end).toEqual(d('2026-03-02'))
  })

  it('rouvre la tâche quand l’avancement retombe sous 100 %', () => {
    const r = actualDatesFor({ actual_start: d('2026-02-10'), actual_end: d('2026-03-02') }, 60, d('2026-03-10'))
    expect(r.actual_start).toEqual(d('2026-02-10'))
    expect(r.actual_end).toBeUndefined()
  })

  it('efface tout si l’avancement est remis à zéro', () => {
    expect(actualDatesFor({ actual_start: d('2026-02-10'), actual_end: d('2026-03-02') }, 0, d('2026-03-10'))).toEqual({})
  })

  it('ignore l’heure du constat', () => {
    const at = new Date(2026, 2, 1, 17, 45)
    expect(actualDatesFor({}, 10, at).actual_start).toEqual(d('2026-03-01'))
  })
})

describe('withActualDates', () => {
  it('calcule la durée réelle une fois la tâche terminée', () => {
    const t = withActualDates(task({ progress: 100, actual_start: d('2026-03-02') }), d('2026-03-06'))
    expect(t.actual_start).toEqual(d('2026-03-02'))
    expect(t.actual_end).toEqual(d('2026-03-06'))
    expect(t.actual_duration).toBe(5)   // du 2 au 6 inclus
  })

  it('laisse la durée réelle vide tant que la tâche est en cours', () => {
    const t = withActualDates(task({ progress: 50 }), d('2026-03-06'))
    expect(t.actual_duration).toBeUndefined()
  })

  it('ne modifie pas le prévisionnel', () => {
    const t = withActualDates(task({ progress: 100 }), d('2026-03-06'))
    expect(t.planned_start).toEqual(d('2026-02-16'))
    expect(t.planned_end).toEqual(d('2026-03-08'))
  })
})

describe('applyActualDates', () => {
  it('descend dans les enfants', () => {
    const tree = [task({ id: 'L', progress: 0, children: [task({ id: 'c1', progress: 100 })] })]
    const out = applyActualDates(tree, d('2026-03-06'))
    expect(out[0].actual_start).toBeUndefined()
    expect(out[0].children![0].actual_end).toEqual(d('2026-03-06'))
  })
})

describe('écarts réel / prévisionnel', () => {
  it('reste indéterminé tant que le réel est inconnu', () => {
    expect(endDrift(task())).toBeNull()
    expect(startDrift(task())).toBeNull()
  })

  it('compte les jours de retard sur la fin', () => {
    expect(endDrift(task({ actual_end: d('2026-03-15') }))).toBe(7)
  })

  it('compte les jours d’avance en négatif', () => {
    expect(endDrift(task({ actual_end: d('2026-03-01') }))).toBe(-7)
    expect(startDrift(task({ actual_start: d('2026-02-09') }))).toBe(-7)
  })

  it('renvoie zéro quand le réel colle au prévisionnel', () => {
    expect(endDrift(task({ actual_end: d('2026-03-08') }))).toBe(0)
  })
})
