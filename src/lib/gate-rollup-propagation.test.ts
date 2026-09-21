// ────────────────────────────────────────────────────────────────────────────
// GATE DE STABILISATION — Scénario 3 : rollup pondéré, exclusion N/A,
// propagation tâche → lot → opération (+ bâtiment/logement pour la vue visite).
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { GanttTask } from '../types/gantt'
import { recomputeLot, recomputeAll, durationBetween } from './planning'
import { overallProgress } from './schedule'
import { isExcludedForUnit, TaskUnitExclusion } from './units'

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

const leaf = (id: string, progress: number, days: number, over: Partial<GanttTask> = {}): GanttTask => ({
  id, lot_id: 'LA', title: id,
  planned_start: d('2026-01-01'), planned_end: new Date(2026, 0, days),
  planned_duration: days,
  progress, status: 'in-progress', priority: 'medium',
  dependencies: [], is_milestone: false, is_critical: false,
  ...over,
})

describe('GATE 3 — rollup pondéré (poids = planned_duration, le seul poids défini dans le modèle)', () => {
  it('Lot A : t1=100%(10j), t2=50%(20j), t3=0%(5j) → moyenne pondérée, pas une moyenne simple', () => {
    const lot: GanttTask = {
      ...leaf('LOT-A', 0, 1), id: 'LOT-A', title: 'Lot A',
      children: [leaf('t1', 100, 10), leaf('t2', 50, 20), leaf('t3', 0, 5)],
    }
    const recomputed = recomputeLot(lot)
    // (100*10 + 50*20 + 0*5) / (10+20+5) = 2000/35 = 57,14 → 57
    expect(recomputed.progress).toBe(57)
    // Preuve que ce n'est PAS une moyenne simple (qui donnerait 50) :
    expect(recomputed.progress).not.toBe(Math.round((100 + 50 + 0) / 3))
  })

  it('t3 → N/A : exclu du calcul, le résultat ne devient PAS artificiellement 100 %', () => {
    const lot: GanttTask = {
      ...leaf('LOT-A', 0, 1), id: 'LOT-A', title: 'Lot A',
      children: [leaf('t1', 100, 10), leaf('t2', 50, 20), leaf('t3', 0, 5, { is_na: true })],
    }
    const recomputed = recomputeLot(lot)
    // (100*10 + 50*20) / (10+20) = 2000/30 = 66,67 → 67
    expect(recomputed.progress).toBe(67)
    expect(recomputed.progress).not.toBe(100) // jamais un 100% artificiel simplement parce qu'une tâche non-nulle est exclue
    expect(recomputed.progress).not.toBe(57) // le résultat a bien changé par rapport au cas sans N/A
  })

  it('rendre t3 applicable à nouveau restaure le calcul initial (réversible, sans perte)', () => {
    const withNa: GanttTask = {
      ...leaf('LOT-A', 0, 1), id: 'LOT-A', title: 'Lot A',
      children: [leaf('t1', 100, 10), leaf('t2', 50, 20), leaf('t3', 0, 5, { is_na: true })],
    }
    const withoutNa: GanttTask = { ...withNa, children: withNa.children!.map(c => c.id === 't3' ? { ...c, is_na: false } : c) }
    expect(recomputeLot(withoutNa).progress).toBe(57)
  })

  it('un lot dont TOUTES les tâches sont N/A ne casse rien (0%, pas NaN/crash)', () => {
    const lot: GanttTask = {
      ...leaf('LOT-A', 0, 1), id: 'LOT-A', title: 'Lot A',
      children: [leaf('t1', 50, 10, { is_na: true }), leaf('t2', 80, 5, { is_na: true })],
    }
    expect(recomputeLot(lot).progress).toBe(0)
    expect(Number.isNaN(recomputeLot(lot).progress)).toBe(false)
  })
})

describe('GATE 3 — propagation tâche → lot → opération', () => {
  it('recomputeAll propage correctement sur PLUSIEURS lots, et overallProgress agrège au niveau opération', () => {
    const lotA: GanttTask = {
      ...leaf('LOT-A', 0, 1), id: 'LOT-A', title: 'Lot A',
      children: [leaf('a1', 100, 10), leaf('a2', 0, 10)],
    }
    const lotB: GanttTask = {
      ...leaf('LOT-B', 0, 1), id: 'LOT-B', title: 'Lot B',
      children: [leaf('b1', 50, 10)],
    }
    const tasks = recomputeAll([lotA, lotB])
    // Lot A : (100*10 + 0*10)/20 = 50 ; Lot B : 50 (une seule feuille, poids indifférent)
    expect(tasks[0].progress).toBe(50)
    expect(tasks[1].progress).toBe(50)

    // Niveau "opération" : overallProgress agrège directement les FEUILLES de
    // tous les lots (pas les lots eux-mêmes) — pondéré par durée, comme le lot.
    // a1=100(10j) a2=0(10j) b1=50(10j) → (100*10+0*10+50*10)/30 = 1500/30 = 50
    expect(overallProgress(tasks)).toBe(50)
  })

  it('une tâche N/A dans un lot n’est pas comptée au niveau opération non plus (même exclusion à tous les étages)', () => {
    const lotA: GanttTask = {
      ...leaf('LOT-A', 0, 1), id: 'LOT-A', title: 'Lot A',
      children: [leaf('a1', 100, 10), leaf('a2', 0, 10, { is_na: true })],
    }
    const tasks = recomputeAll([lotA])
    expect(tasks[0].progress).toBe(100) // a2 exclue au niveau lot
    expect(overallProgress(tasks)).toBe(100) // et exclue au niveau opération, cohérence entre étages
  })
})

describe('GATE 3 — propagation bâtiment/logement (vue visite, LogementMatrix)', () => {
  it('isExcludedForUnit exclut une tâche N/A pour UN logement précis sans affecter les autres', () => {
    const exclusions: TaskUnitExclusion[] = [{ taskId: 't3', unitId: 'dw-101' }]
    expect(isExcludedForUnit(exclusions, 't3', 'dw-101')).toBe(true)
    expect(isExcludedForUnit(exclusions, 't3', 'dw-102')).toBe(false) // un AUTRE logement n'est pas affecté
    expect(isExcludedForUnit(exclusions, 't1', 'dw-101')).toBe(false) // une AUTRE tâche n'est pas affectée
  })
})

describe('GATE 3 — vérification directe de durationBetween (le poids utilisé)', () => {
  it('confirme que planned_duration est bien "jours calendaires inclus", cohérent avec le poids attendu', () => {
    expect(durationBetween(d('2026-01-01'), d('2026-01-10'))).toBe(10)
  })
})
