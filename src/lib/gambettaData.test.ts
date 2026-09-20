import { describe, it, expect } from 'vitest'
import { buildGambettaSeed, GAMBETTA_PROJECT } from './gambettaData'
import {
  roots, childrenOf, visitableUnits, buildingOf, taskConcernsUnit, type Unit, type TaskUnitLink,
} from './units'
import { flattenLeaves } from './schedule'
import type { GanttTask } from '../types/gantt'

const seed = buildGambettaSeed()
const units = seed.units as Unit[]
const taskUnits = seed.taskUnits as TaskUnitLink[]
const gantt = seed.gantt as GanttTask[]
const leaves = flattenLeaves(gantt)

describe('opération Gambetta — structure réelle (A/B liés, C indépendant)', () => {
  it('a un projet distinct de TEST (référence et nom réels)', () => {
    expect(GAMBETTA_PROJECT.reference).toBe('ER.T2286')
    expect(GAMBETTA_PROJECT.name).toContain('Gambetta')
  })

  it('définit exactement 3 bâtiments (A, B, C) à la racine, plus les communs A/B', () => {
    const buildings = roots(units).filter(u => u.kind === 'building')
    expect(buildings.map(b => b.code).sort()).toEqual(['A', 'AB', 'B', 'C'])
  })

  it('Bâtiment A a exactement 2 logements, tous au R+2', () => {
    const a = units.find(u => u.code === 'A')!
    const dwellings = units.filter(u => u.kind === 'dwelling' && buildingOf(units, u.id)?.id === a.id)
    expect(dwellings.map(d => d.code).sort()).toEqual(['A-201', 'A-202'])
    const levels = childrenOf(units, a.id).filter(u => u.kind === 'level')
    expect(levels.map(l => l.name)).toEqual(['R+2'])
  })

  it('Bâtiment B a exactement 3 logements, un par niveau (RDC, R+1, R+2)', () => {
    const b = units.find(u => u.code === 'B')!
    const dwellings = units.filter(u => u.kind === 'dwelling' && buildingOf(units, u.id)?.id === b.id)
    expect(dwellings.map(d => d.code).sort()).toEqual(['B-001', 'B-101', 'B-201'])
    const levels = childrenOf(units, b.id).filter(u => u.kind === 'level')
    expect(levels.map(l => l.name)).toEqual(['RDC', 'R+1', 'R+2'])
  })

  it("Bâtiment C est indépendant : aucun logement ni niveau A/B ne lui est rattaché, structure volontairement vide", () => {
    const c = units.find(u => u.code === 'C')!
    expect(childrenOf(units, c.id)).toHaveLength(0)
    const aOrB = new Set(['A', 'B', 'AB'])
    // Aucune unité de A/B n'a pour bâtiment C, et réciproquement.
    for (const u of units) {
      if (u.id === c.id) continue
      const building = buildingOf(units, u.id)
      if (building?.id === c.id) expect(aOrB.has(u.code ?? '')).toBe(false)
    }
  })

  it('la circulation commune A/B (couloir, escaliers) est visitable indépendamment de tout logement', () => {
    const visitable = visitableUnits(units)
    const couloir = visitable.find(u => u.name === 'Couloir commun RDC')
    const escaliers = visitable.find(u => u.name === 'Escaliers A/B')
    expect(couloir).toBeDefined()
    expect(escaliers).toBeDefined()
    // Ni l'un ni l'autre n'est un logement, ni dupliqué par logement.
    expect(visitable.filter(u => u.name.includes('Couloir'))).toHaveLength(1)
  })

  it('la même circulation commune A/B ne doit jamais être dupliquée sous un logement précis', () => {
    const dwellings = units.filter(u => u.kind === 'dwelling')
    for (const d of dwellings) {
      expect(childrenOf(units, d.id)).toHaveLength(0) // un logement est toujours une feuille
    }
  })

  it('au moins une tâche réelle concerne chaque bâtiment A, B et C (rattachement textuel, non fabriqué)', () => {
    const a = units.find(u => u.code === 'A')!
    const b = units.find(u => u.code === 'B')!
    const c = units.find(u => u.code === 'C')!
    for (const building of [a, b, c]) {
      const concerned = leaves.filter(t => taskConcernsUnit(units, taskUnits, t.id, building.id))
      expect(concerned.length).toBeGreaterThan(0)
    }
  })

  it('un rattachement au bâtiment vaut pour tous ses logements (héritage documenté, pas une deuxième logique de filtrage)', () => {
    const a201 = units.find(u => u.code === 'A-201')!
    const aTask = taskUnits.find(l => l.unitId === units.find(u => u.code === 'A')!.id)!
    expect(taskConcernsUnit(units, taskUnits, aTask.taskId, a201.id)).toBe(true)
  })

  it("une visite peut démarrer : au moins une unité réellement parcourable existe", () => {
    expect(visitableUnits(units).length).toBeGreaterThan(0)
  })
})
