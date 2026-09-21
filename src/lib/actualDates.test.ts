import { describe, it, expect } from 'vitest'
import { deriveActualDates, applyDerivedActualDates, endDrift, startDrift, ActualDateOverride } from './actualDates'
import { ProgressHistoryEntry } from './progressHistory'
import { GanttTask } from '../types/gantt'

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

const task = (over: Partial<GanttTask> = {}): GanttTask => ({
  id: 'T-1', lot_id: 'L05', title: 'Doublage',
  planned_start: d('2026-02-16'), planned_end: d('2026-03-08'), planned_duration: 15,
  progress: 0, status: 'not-started', priority: 'medium',
  dependencies: [], is_milestone: false, is_critical: false,
  ...over,
})

let seq = 0
const entry = (effective_date: string, new_progress: number, over: Partial<ProgressHistoryEntry> = {}): ProgressHistoryEntry => ({
  id: `e${seq++}`, taskId: 'T-1', effective_date, created_at: over.created_at ?? `${effective_date}T00:00:00.000Z`,
  old_progress: 0, new_progress, source: 'manual',
  ...over,
})

const override = (field: 'actual_start' | 'actual_end', value: string | null, at: string, over: Partial<ActualDateOverride> = {}): ActualDateOverride => ({
  id: `ov${seq++}`, taskId: 'T-1', field, value, at, ...over,
})

describe('deriveActualDates — cas de base (une seule observation)', () => {
  it('ne pose aucune date réelle tant que rien n’a démarré', () => {
    expect(deriveActualDates([entry('2026-03-01', 0)], [])).toEqual({})
  })

  it('fige le début réel au premier constat d’avancement', () => {
    const r = deriveActualDates([entry('2026-03-01', 20)], [])
    expect(r.actual_start).toEqual(d('2026-03-01'))
    expect(r.actual_end).toBeUndefined()
  })

  it('fige la fin réelle au constat qui porte la tâche à 100 %', () => {
    const r = deriveActualDates([entry('2026-02-10', 20), entry('2026-03-05', 100)], [])
    expect(r.actual_start).toEqual(d('2026-02-10'))
    expect(r.actual_end).toEqual(d('2026-03-05'))
  })
})

describe('deriveActualDates — historique chronologique complet (TEST 4 / TEST 5)', () => {
  it('TEST 4 — 10/09=0, 15/09=30, 21/09=70 → actual_start = 15/09, pas de fin réelle', () => {
    const r = deriveActualDates([entry('2026-09-10', 0), entry('2026-09-15', 30), entry('2026-09-21', 70)], [])
    expect(r.actual_start).toEqual(d('2026-09-15'))
    expect(r.actual_end).toBeUndefined()
  })

  it('TEST 5 — 10/09=0, 15/09=30, 21/09=100 → actual_start = 15/09, actual_end = 21/09', () => {
    const r = deriveActualDates([entry('2026-09-10', 0), entry('2026-09-15', 30), entry('2026-09-21', 100)], [])
    expect(r.actual_start).toEqual(d('2026-09-15'))
    expect(r.actual_end).toEqual(d('2026-09-21'))
  })

  it('l’ordre d’insertion ne compte pas, seul l’ordre chronologique (effective_date) compte', () => {
    const r = deriveActualDates([entry('2026-09-21', 100), entry('2026-09-10', 0), entry('2026-09-15', 30)], [])
    expect(r.actual_start).toEqual(d('2026-09-15'))
    expect(r.actual_end).toEqual(d('2026-09-21'))
  })
})

describe('deriveActualDates — correction rétroactive (TEST 3 / TEST 15 / TEST 20 / TEST 22)', () => {
  it('modifier rétroactivement 15/09 de 30% à 0% déplace actual_start au prochain franchissement (21/09)', () => {
    const history = [entry('2026-09-10', 0), entry('2026-09-15', 0), entry('2026-09-21', 70)]
    const r = deriveActualDates(history, [])
    expect(r.actual_start).toEqual(d('2026-09-21'))
  })

  it('TEST 22 — 10/09=0, 15/09=30, 21/09=100 → start=15/09, end=21/09 ; puis 15/09 repassé à 0 → start=21/09, end=21/09', () => {
    const before = deriveActualDates([entry('2026-09-10', 0), entry('2026-09-15', 30), entry('2026-09-21', 100)], [])
    expect(before.actual_start).toEqual(d('2026-09-15'))
    expect(before.actual_end).toEqual(d('2026-09-21'))

    const after = deriveActualDates([entry('2026-09-10', 0), entry('2026-09-15', 0), entry('2026-09-21', 100)], [])
    expect(after.actual_start).toEqual(d('2026-09-21'))
    expect(after.actual_end).toEqual(d('2026-09-21'))
  })

  it('insérer rétroactivement une observation plus ancienne recule actual_start sans perdre l’historique postérieur', () => {
    const history = [entry('2026-09-15', 30), entry('2026-09-21', 70)]
    const withRetro = [...history, entry('2026-09-05', 10)] // saisie après coup, mais datée avant
    const r = deriveActualDates(withRetro, [])
    expect(r.actual_start).toEqual(d('2026-09-05'))
  })
})

describe('deriveActualDates — réouverture (100 % → retour en arrière)', () => {
  it('rouvre la tâche quand l’avancement retombe sous 100 % : la fin réelle est effacée, le début conservé', () => {
    const history = [entry('2026-02-10', 20), entry('2026-03-02', 100), entry('2026-03-10', 60)]
    const r = deriveActualDates(history, [])
    expect(r.actual_start).toEqual(d('2026-02-10'))
    expect(r.actual_end).toBeUndefined()
  })

  it('un nouveau passage à 100 % après réouverture fige une nouvelle fin réelle', () => {
    const history = [entry('2026-02-10', 20), entry('2026-03-02', 100), entry('2026-03-10', 60), entry('2026-03-20', 100)]
    const r = deriveActualDates(history, [])
    expect(r.actual_end).toEqual(d('2026-03-20'))
  })
})

describe('deriveActualDates — sans historique', () => {
  it('aucune entrée ⇒ aucune date réelle', () => {
    expect(deriveActualDates([], [])).toEqual({})
  })
})

describe('deriveActualDates — coexistence avec une correction manuelle (ActualDateOverride)', () => {
  it('une correction manuelle plus récente (created_at/at) que la dernière observation l’emporte', () => {
    const history = [entry('2026-03-01', 20, { created_at: '2026-03-01T09:00:00.000Z' })]
    const overrides = [override('actual_start', '2026-02-15', '2026-03-02T10:00:00.000Z')]
    const r = deriveActualDates(history, overrides)
    expect(r.actual_start).toEqual(d('2026-02-15'))
  })

  it('une observation de visite plus récente que l’ancienne correction manuelle supplante celle-ci', () => {
    const overrides = [override('actual_start', '2026-02-15', '2026-03-01T08:00:00.000Z')]
    const history = [entry('2026-03-01', 20, { created_at: '2026-03-02T09:00:00.000Z' })]
    const r = deriveActualDates(history, overrides)
    expect(r.actual_start).toEqual(d('2026-03-01'))
  })

  it('une correction manuelle accepte une date future, sans restriction', () => {
    const overrides = [override('actual_start', '2099-01-01', '2026-03-01T00:00:00.000Z')]
    const r = deriveActualDates([], overrides)
    expect(r.actual_start).toEqual(d('2099-01-01'))
  })

  it('un effacement manuel explicite (value: null) plus récent efface la date', () => {
    const history = [entry('2026-03-01', 20, { created_at: '2026-03-01T09:00:00.000Z' })]
    const overrides = [override('actual_start', null, '2026-03-02T10:00:00.000Z')]
    const r = deriveActualDates(history, overrides)
    expect(r.actual_start).toBeUndefined()
  })
})

describe('applyDerivedActualDates', () => {
  it('descend dans les enfants et calcule actual_duration', () => {
    const tree = [task({
      id: 'L', progress: 0,
      children: [task({ id: 'c1', progress: 100 })],
    })]
    const history: ProgressHistoryEntry[] = [
      { id: 'e1', taskId: 'c1', effective_date: '2026-03-02', created_at: '2026-03-02T00:00:00.000Z', old_progress: 0, new_progress: 30, source: 'manual' },
      { id: 'e2', taskId: 'c1', effective_date: '2026-03-06', created_at: '2026-03-06T00:00:00.000Z', old_progress: 30, new_progress: 100, source: 'manual' },
    ]
    const out = applyDerivedActualDates(tree, history, [])
    expect(out[0].actual_start).toBeUndefined()
    expect(out[0].children![0].actual_start).toEqual(d('2026-03-02'))
    expect(out[0].children![0].actual_end).toEqual(d('2026-03-06'))
    expect(out[0].children![0].actual_duration).toBe(5) // du 2 au 6 inclus
  })

  it('un parent avec ses propres entrées "calculated" dérive ses dates réelles comme une feuille', () => {
    const tree = [task({ id: 'L', progress: 100, children: [task({ id: 'c1', progress: 100 })] })]
    const history: ProgressHistoryEntry[] = [
      { id: 'p1', taskId: 'L', effective_date: '2026-03-01', created_at: '2026-03-01T00:00:00.000Z', old_progress: 0, new_progress: 40, source: 'calculated' },
      { id: 'p2', taskId: 'L', effective_date: '2026-03-06', created_at: '2026-03-06T00:00:00.000Z', old_progress: 40, new_progress: 100, source: 'calculated' },
    ]
    const out = applyDerivedActualDates(tree, history, [])
    expect(out[0].actual_start).toEqual(d('2026-03-01'))
    expect(out[0].actual_end).toEqual(d('2026-03-06'))
  })
})

describe('écarts réel / prévisionnel (inchangé)', () => {
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
