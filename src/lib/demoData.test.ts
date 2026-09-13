import { describe, it, expect } from 'vitest'
import { buildDemoSeed, DEMO_PROJECT } from './demoData'
import { overallProgress, lateTasks, flattenLeaves } from './schedule'
import type { GanttTask } from '../types/gantt'
import type { Reserve } from './reserves'
import type { Marche } from './finance'
import type { Unit } from './units'

const seed = buildDemoSeed()
const gantt = seed.gantt as GanttTask[]

describe('jeu d’exemple', () => {
  it('décrit une opération fictive nommée', () => {
    expect(DEMO_PROJECT.name).toBe('Résidence Les Tilleuls')
    expect(DEMO_PROJECT.reference).toBe('RT-2026')
  })

  it('fournit un planning à 3 lots et 9 tâches', () => {
    expect(gantt).toHaveLength(3)
    expect(flattenLeaves(gantt)).toHaveLength(9)
  })

  it('donne un avancement d’ensemble réaliste (~48 %)', () => {
    expect(overallProgress(gantt)).toBe(48)
  })

  it('contient au moins un retard au 13/09/2026', () => {
    const late = lateTasks(gantt, new Date(2026, 8, 13))
    expect(late.length).toBeGreaterThanOrEqual(1)
    expect(late.some(t => t.id === 'T-pose')).toBe(true)
  })

  it('remplit les zones, les réserves et les finances', () => {
    expect((seed.units as Unit[]).length).toBeGreaterThanOrEqual(6)
    expect((seed.reserves as Reserve[]).length).toBe(3)
    expect((seed.marches as Marche[]).length).toBe(3)
  })

  it('rattache des tâches à des zones', () => {
    expect(Array.isArray(seed.taskUnits)).toBe(true)
    expect((seed.taskUnits as unknown[]).length).toBeGreaterThan(0)
  })

  it('n’expose aucune Date invalide dans le planning', () => {
    for (const t of flattenLeaves(gantt)) {
      expect(Number.isNaN(t.planned_start.getTime())).toBe(false)
      expect(Number.isNaN(t.planned_end.getTime())).toBe(false)
    }
  })
})
