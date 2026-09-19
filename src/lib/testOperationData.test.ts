import { describe, it, expect } from 'vitest'
import { buildTestOperationSeed, TEST_PROJECT } from './testOperationData'
import { flattenLeaves } from './schedule'
import type { GanttTask } from '../types/gantt'
import type { Unit, TaskUnitLink } from './units'

const seed = buildTestOperationSeed()
const gantt = seed.gantt as GanttTask[]
const leaves = flattenLeaves(gantt)
const byId = new Map(leaves.map(t => [t.id, t]))
const today = new Date()

describe('opération TEST — Validation Planning & Visite', () => {
  it("n'est pas Gambetta : nom et référence distincts, sans donnée réelle", () => {
    expect(TEST_PROJECT.name).toContain('TEST')
    expect(TEST_PROJECT.reference).not.toBe('ER.T2286')
    expect(gantt.some(l => l.title.includes('Gambetta'))).toBe(false)
  })

  it("aucune Date invalide, dates relatives à aujourd'hui (pas figées dans le passé)", () => {
    for (const t of leaves) {
      expect(Number.isNaN(t.planned_start.getTime())).toBe(false)
      expect(Number.isNaN(t.planned_end.getTime())).toBe(false)
    }
  })

  it('couvre le cas "terminée" (100 % → verte)', () => {
    const t = byId.get('T-TERR-OK')!
    expect(t.progress).toBe(100)
    expect(t.status).toBe('completed')
  })

  it('couvre le cas "dépassement contractuel, non terminée" (rouge immédiat)', () => {
    const t = byId.get('T-TERR-RETARD')!
    expect(t.progress).toBeLessThan(100)
    expect(t.planned_end.getTime()).toBeLessThan(today.getTime())
  })

  it('couvre le cas "en cours, dans les temps" (dégradé bleu→vert)', () => {
    const t = byId.get('T-GO-COURS')!
    expect(t.progress).toBeGreaterThan(0)
    expect(t.progress).toBeLessThan(100)
    expect(t.planned_end.getTime()).toBeGreaterThan(today.getTime())
  })

  it('couvre le cas "bloquée" (rouge hachuré, indépendant de l\'avancement)', () => {
    expect(byId.get('T-GO-BLOQ')!.status).toBe('blocked')
  })

  it('couvre le cas "à venir, jamais démarrée" (pas de rouge)', () => {
    const t = byId.get('T-GO-AVENIR')!
    expect(t.progress).toBe(0)
    expect(t.planned_start.getTime()).toBeGreaterThan(today.getTime())
  })

  it('un jalon exclu des moyennes de progression du lot', () => {
    const jalon = byId.get('T-GO-JALON')!
    expect(jalon.is_milestone).toBe(true)
    const lot02 = gantt.find(l => l.lot_id === 'LOT02')!
    // Moyenne des 3 tâches de travail (hors jalon) : (50+20+0)/3 = 23.
    expect(lot02.progress).toBe(23)
  })

  it('une dépendance finish-to-start pour vérifier le chaînage', () => {
    expect(byId.get('T-MENU-A101')!.dependencies).toContain('T-GO-COURS')
  })

  it('une prévision qui diverge du contractuel (couche « Prévision » visible)', () => {
    const t = byId.get('T-MENU-A101')!
    expect(t.forecast_end).toBeDefined()
    expect(t.forecast_end!.getTime()).not.toBe(t.planned_end.getTime())
  })

  it('deux logements distincts, pour la vue « Par logement »', () => {
    const units = seed.units as Unit[]
    const links = seed.taskUnits as TaskUnitLink[]
    const dwellings = units.filter(u => u.kind === 'dwelling')
    expect(dwellings.length).toBe(2)
    expect(links.some(l => l.taskId === 'T-MENU-A101')).toBe(true)
    expect(links.some(l => l.taskId === 'T-MENU-B01')).toBe(true)
  })
})
