import { describe, expect, it } from 'vitest'
import { GanttTask } from '../types/gantt'
import { computeCpm, autoSchedule, applyCriticality, toDay, addDays } from './cpm'
import { makeCalendar } from './calendar'

const BASE = new Date(2026, 0, 1)
const d = (n: number) => addDays(BASE, n)

const task = (id: string, startDay: number, endDay: number, deps: string[] = []): GanttTask => ({
  id, lot_id: 'L1', title: id,
  planned_start: d(startDay), planned_end: d(endDay), planned_duration: endDay - startDay,
  baseline_start: d(startDay), baseline_end: d(endDay),
  progress: 0, status: 'not-started', priority: 'medium',
  dependencies: deps, is_milestone: false, is_critical: false,
})
const parent = (id: string, children: GanttTask[]): GanttTask => ({ ...task(id, 0, 1), children })

// A(0-2) ─┬─> B(2-5) ─┬─> D(5-6)
//         └─> C(2-3) ─┘        (C a 2 jours de marge)
const network = () => [parent('P', [
  task('A', 0, 2),
  task('B', 2, 5, ['A']),
  task('C', 2, 3, ['A']),
  task('D', 5, 6, ['B', 'C']),
])]

describe('computeCpm', () => {
  it('calcule les dates au plus tôt (passe avant)', () => {
    const { nodes } = computeCpm(network())
    expect(nodes.get('A')!.es).toBe(toDay(d(0)))
    expect(nodes.get('B')!.es).toBe(toDay(d(2)))
    expect(nodes.get('D')!.es).toBe(toDay(d(5)))  // max(fin B=5, fin C=3)
  })

  it('calcule la marge totale et le chemin critique', () => {
    const { nodes, criticalIds } = computeCpm(network())
    expect(nodes.get('A')!.totalFloat).toBe(0)
    expect(nodes.get('B')!.totalFloat).toBe(0)
    expect(nodes.get('C')!.totalFloat).toBe(2)   // branche plus courte -> marge
    expect(nodes.get('D')!.totalFloat).toBe(0)
    expect([...criticalIds].sort()).toEqual(['A', 'B', 'D'])
  })

  it('détecte les cycles sans planter', () => {
    const cyclic = [parent('P', [task('X', 0, 1, ['Y']), task('Y', 1, 2, ['X'])])]
    const r = computeCpm(cyclic)
    expect(r.hasCycle).toBe(true)
    expect(r.criticalIds.size).toBe(0)
  })

  it('ignore les dépendances hors périmètre', () => {
    const r = computeCpm([parent('P', [task('A', 0, 2, ['INCONNU'])])])
    expect(r.hasCycle).toBe(false)
    expect(r.nodes.get('A')!.totalFloat).toBe(0)
  })
})

describe('autoSchedule', () => {
  it('décale les successeurs qui violent fin -> début', () => {
    // A allongée à 0-4 : B (2-5) doit glisser de 2 jours -> 4-7
    const tasks = [parent('P', [task('A', 0, 4), task('B', 2, 5, ['A'])])]
    const { tasks: out, shifted } = autoSchedule(tasks)
    const b = out[0].children!.find(t => t.id === 'B')!
    expect(shifted).toEqual(['B'])
    expect(toDay(b.planned_start)).toBe(toDay(d(4)))
    expect(toDay(b.planned_end)).toBe(toDay(d(7)))   // durée 3 préservée
  })

  it('ne ramène pas une tâche en arrière (la marge est permise)', () => {
    const tasks = [parent('P', [task('A', 0, 2), task('B', 10, 12, ['A'])])]
    const { shifted } = autoSchedule(tasks)
    expect(shifted).toEqual([])
  })

  it('propage en cascade sur une chaîne', () => {
    const tasks = [parent('P', [task('A', 0, 5), task('B', 2, 4, ['A']), task('C', 4, 6, ['B'])])]
    const { tasks: out } = autoSchedule(tasks)
    const kids = out[0].children!
    expect(toDay(kids.find(t => t.id === 'B')!.planned_start)).toBe(toDay(d(5)))
    expect(toDay(kids.find(t => t.id === 'C')!.planned_start)).toBe(toDay(d(7)))
  })

  it('repousse au prochain jour ouvré avec un calendrier', () => {
    // 2026-09-07 = lundi. A finit samedi (jour 5) -> B doit démarrer lundi (jour 7).
    const MON = new Date(2026, 8, 7)
    const dd = (n: number) => addDays(MON, n)
    const mk = (id: string, s: number, e: number, deps: string[] = []): GanttTask => ({
      ...task(id, 0, 1, deps), planned_start: dd(s), planned_end: dd(e), baseline_start: dd(s), baseline_end: dd(e),
    })
    const tasks = [{ ...parent('P', []), children: [mk('A', 0, 5), mk('B', 2, 4, ['A'])] }]
    const { tasks: out } = autoSchedule(tasks, makeCalendar())
    const b = out[0].children!.find(t => t.id === 'B')!
    expect(b.planned_start.getDay()).toBe(1)          // lundi, pas samedi
    expect(toDay(b.planned_start)).toBe(toDay(dd(7)))
  })

  it("recalcule l'emprise du parent", () => {
    const tasks = [parent('P', [task('A', 0, 4), task('B', 2, 5, ['A'])])]
    const { tasks: out } = autoSchedule(tasks)
    expect(toDay(out[0].planned_end)).toBe(toDay(d(7)))
  })
})

describe('applyCriticality', () => {
  it('marque les feuilles et remonte sur les parents', () => {
    const out = applyCriticality(network(), new Set(['A', 'B', 'D']))
    const kids = out[0].children!
    expect(kids.find(t => t.id === 'A')!.is_critical).toBe(true)
    expect(kids.find(t => t.id === 'C')!.is_critical).toBe(false)
    expect(out[0].is_critical).toBe(true)
  })
})
