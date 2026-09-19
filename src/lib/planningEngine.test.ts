import { describe, expect, it } from 'vitest'
import { GanttTask } from '../types/gantt'
import { DateCommitment } from './commitments'
import { computeForecasts } from './forecast'
import {
  calculateScheduleVariance, toPlanningTask, analyzePlanning, criticalPath, whyLate, indexTasksById,
} from './planningEngine'
import { addDays } from './cpm'

const BASE = new Date(2026, 0, 1)
const d = (n: number) => addDays(BASE, n)

const task = (id: string, patch: Partial<GanttTask> = {}): GanttTask => ({
  id, lot_id: 'L06', title: id,
  planned_start: d(0), planned_end: d(9), planned_duration: 10,
  baseline_start: d(0), baseline_end: d(9),
  progress: 0, status: 'not-started', priority: 'medium',
  dependencies: [], is_milestone: false, is_critical: false,
  ...patch,
})

describe('calculateScheduleVariance', () => {
  it('renvoie des écarts nuls tant que rien n\'est constaté', () => {
    const v = calculateScheduleVariance(task('T1'))
    expect(v).toEqual({ startDays: null, endDays: null, forecastDays: null, commitmentDays: null })
  })

  it('écart de démarrage : actual_start − contract_start', () => {
    const v = calculateScheduleVariance(task('T1', { actual_start: d(5) }))
    expect(v.startDays).toBe(5)
    expect(v.endDays).toBeNull()
  })

  it('écart de fin : actual_end − contract_end (positif = en retard)', () => {
    const v = calculateScheduleVariance(task('T1', { actual_start: d(0), actual_end: d(12) }))
    expect(v.endDays).toBe(3)
  })

  it('écart de fin négatif quand la tâche finit en avance', () => {
    const v = calculateScheduleVariance(task('T1', { actual_start: d(0), actual_end: d(5) }))
    expect(v.endDays).toBe(-4)
  })

  it('écart prévisionnel délègue à forecastDrift, sans le recalculer', () => {
    const t = task('T1', { forecast_end: d(20) })
    const v = calculateScheduleVariance(t)
    expect(v.forecastDays).toBe(11)
  })

  it('écart d\'engagement : référence (réel ou prévision) vs dernière promesse', () => {
    const t = task('T1', { actual_end: d(15) })
    const commitments: DateCommitment[] = [{
      id: 'C1', taskId: 'T1', lotId: 'L06', promisedEnd: toIso(d(10)),
      at: '2026-01-01T00:00:00Z', visitId: 'V1', visitDate: '2026-01-01',
    }]
    const v = calculateScheduleVariance(t, commitments)
    expect(v.commitmentDays).toBe(5)
  })

  it('pas d\'écart d\'engagement sans engagement ni fin/prévision connue', () => {
    expect(calculateScheduleVariance(task('T1')).commitmentDays).toBeNull()
    const commitments: DateCommitment[] = [{
      id: 'C1', taskId: 'T1', lotId: 'L06', promisedEnd: toIso(d(10)),
      at: '2026-01-01T00:00:00Z', visitId: 'V1', visitDate: '2026-01-01',
    }]
    expect(calculateScheduleVariance(task('T1'), commitments).commitmentDays).toBeNull()
  })
})

describe('toPlanningTask', () => {
  it('mappe contractuel/réel/prévision sans en inventer un quatrième', () => {
    const t = task('T1', { actual_start: d(1), forecast_end: d(15), forecast_method: 'actual_rate' })
    const pt = toPlanningTask(t, { operationId: 'OP1', commitments: [] })
    expect(pt.contract).toEqual({ start: d(0), end: d(9), workingDays: undefined })
    expect(pt.actual.start).toEqual(d(1))
    expect(pt.forecast).toEqual({ start: undefined, end: d(15), method: 'actual_rate' })
  })

  it('récupère le dernier engagement de la tâche', () => {
    const commitments: DateCommitment[] = [
      { id: 'C1', taskId: 'T1', lotId: 'L06', promisedEnd: '2026-01-10', at: '2026-01-01T00:00:00Z', visitId: 'V1', visitDate: '2026-01-01' },
      { id: 'C2', taskId: 'T1', lotId: 'L06', promisedEnd: '2026-01-20', at: '2026-01-05T00:00:00Z', visitId: 'V2', visitDate: '2026-01-05' },
    ]
    const pt = toPlanningTask(task('T1'), { operationId: 'OP1', commitments })
    expect(pt.latestCommitment?.id).toBe('C2')
    expect(pt.commitments).toHaveLength(2)
  })

  it('descend récursivement dans les enfants', () => {
    const parent: GanttTask = { ...task('LOT'), children: [task('T1'), task('T2')] }
    const pt = toPlanningTask(parent, { operationId: 'OP1', commitments: [] })
    expect(pt.children).toHaveLength(2)
    expect(pt.children?.[0].id).toBe('T1')
  })
})

describe('analyzePlanning', () => {
  it('compte terminées / en cours / non commencées et calcule les fins de chantier', () => {
    const tasks: GanttTask[] = [{
      ...task('LOT06'),
      children: [
        task('T1', { progress: 100, actual_start: d(0), actual_end: d(5) }),
        task('T2', { progress: 40, actual_start: d(0) }),
        task('T3', { progress: 0 }),
      ],
    }]
    const a = analyzePlanning(tasks, d(5))
    expect(a.totalTasks).toBe(3)
    expect(a.completed).toBe(1)
    expect(a.inProgress).toBe(1)
    expect(a.notStarted).toBe(1)
    expect(a.contractEnd).toEqual(d(9))
  })

  it('dérive vers 0 si tout est dans les clous', () => {
    const tasks: GanttTask[] = [{ ...task('LOT'), children: [task('T1')] }]
    const a = analyzePlanning(tasks, d(0))
    expect(a.drifting).toBe(0)
    expect(a.varianceDays).toBe(0)
  })

  it('classe les principaux écarts par lot, uniquement ceux en dérive', () => {
    const late = task('T1', { planned_start: d(0), planned_end: d(9), baseline_start: d(0), baseline_end: d(9) })
    const onTime = task('T2', { progress: 100, actual_start: d(0), actual_end: d(5) })
    const tasks: GanttTask[] = [
      { ...task('LOT06'), lot_id: 'L06', title: 'Lot 06', children: [late] },
      { ...task('LOT07'), lot_id: 'L07', title: 'Lot 07', children: [onTime] },
    ]
    // Force LOT06 in the future so `today` puts it late without a forecast.
    const a = analyzePlanning(tasks, d(20))
    expect(a.topVariances[0].lotId).toBe('L06')
    expect(a.topVariances.some(v => v.lotId === 'L07')).toBe(false)
  })
})

describe('criticalPath', () => {
  it('indisponible sans dépendances — jamais inventé', () => {
    const tasks: GanttTask[] = [{ ...task('LOT'), children: [task('T1'), task('T2')] }]
    const cp = criticalPath(tasks)
    expect(cp.available).toBe(false)
    expect(cp.path).toEqual([])
  })

  it('disponible et déterministe avec un réseau de dépendances', () => {
    const a = task('A', { planned_start: d(0), planned_end: d(2) })
    const b = task('B', { planned_start: d(2), planned_end: d(5), dependencies: ['A'] })
    const tasks: GanttTask[] = [{ ...task('LOT'), children: [a, b] }]
    const cp = criticalPath(tasks)
    expect(cp.available).toBe(true)
    expect(cp.path).toEqual(['A', 'B'])
  })
})

describe('whyLate', () => {
  it('rassemble les faits déjà calculés, sans en déduire de nouveaux', () => {
    const pred = task('L05', { title: 'Lot 05 — Doublage' })
    const t = task('L06', { title: 'Lot 06', dependencies: ['L05'], forecast_end: d(20), delay_cause: 'approvisionnement' })
    const tasks: GanttTask[] = [{ ...task('LOT'), children: [pred, t] }]
    const byId = indexTasksById(tasks)
    const w = whyLate(t, byId, [])
    expect(w.forecastDriftDays).toBe(11)
    expect(w.delayCause).toBe('approvisionnement')
    expect(w.predecessors).toEqual([{ id: 'L05', title: 'Lot 05 — Doublage' }])
  })
})

describe('cohérence avec computeForecasts (aucun calcul dupliqué)', () => {
  it('forecastDays de calculateScheduleVariance retombe sur le forecast propagé', () => {
    const a = task('A', { planned_start: d(0), planned_end: d(9), baseline_start: d(0), baseline_end: d(9), actual_start: d(0), actual_end: d(15) })
    const b = task('B', { planned_start: d(10), planned_end: d(19), baseline_start: d(10), baseline_end: d(19), dependencies: ['A'] })
    const tasks: GanttTask[] = [{ ...task('LOT'), children: [a, b] }]
    const [{ children }] = computeForecasts(tasks, d(1))
    const propagatedB = children!.find(t => t.id === 'B')!
    const v = calculateScheduleVariance(propagatedB)
    expect(v.forecastDays).toBe(propagatedB.forecast_end ? Math.round((propagatedB.forecast_end.getTime() - d(19).getTime()) / 86400000) : null)
  })
})

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}
