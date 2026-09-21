// @vitest-environment jsdom
//
// Reproduction du bug bloquant « clic Planning → écran blanc / navigateur
// figé » : sc-gantt-v2::p-demo-residence-20260920 (Acacias) contient en
// production des dates en chaîne ISO brute (ex. "2026-03-13") plutôt que le
// format { __date: ISOString } que storage.ts attend — écrites par un
// chemin hors application (correction directe en base). Le reviver
// générique de storage.ts ne les convertit donc pas en Date, et tout le
// pipeline Planning (cpm.ts, forecast.ts, planningEngine.ts) appelle
// .getTime() dessus sans vérifier, ce qui plante au montage.
import { describe, it, expect, afterEach } from 'vitest'
import { getGanttTasks, saveGanttTasks, setCurrentProjectId } from './repo'
import { analyzePlanning, toPlanningTasks, criticalPath } from './planningEngine'
import { computeCpm, applyCriticality } from './cpm'
import { computeTimelineRange } from './planningViewModel'
import type { GanttTask } from '../types/gantt'

// Forme exacte reproduite depuis sc-gantt-v2::p-demo-residence-20260920 en
// base (dates en chaîne brute, pas de wrapper { __date }).
const RAW_ACACIAS_SHAPE = [
  {
    id: 'LOT-L01', title: 'LOT 01 — Installation / désamiantage / curage', lot_id: 'L01',
    status: 'completed', progress: 100,
    actual_end: '2026-04-08', planned_end: '2026-04-10', actual_start: '2026-03-02', planned_start: '2026-03-02',
    children: [
      {
        id: 'T-L01-01', title: 'Installation de chantier et protections', lot_id: 'L01',
        status: 'completed', progress: 100,
        actual_end: '2026-03-12', planned_end: '2026-03-13', actual_start: '2026-03-02', planned_start: '2026-03-02',
      },
      {
        id: 'T-L01-02', title: 'Curage et désamiantage', lot_id: 'L01',
        status: 'completed', progress: 100,
        actual_end: '2026-04-08', planned_end: '2026-04-10', actual_start: '2026-03-16', planned_start: '2026-03-16',
      },
    ],
  },
] as unknown as GanttTask[]

function seedRawAcacias() {
  localStorage.clear()
  // getCurrentProjectId() ne retient un id que s'il figure dans le
  // registre — sans ça il retombe sur null (NO_PROJECT) et la clé
  // cloisonnée ne correspondrait plus à celle qu'on vient d'écrire.
  localStorage.setItem('sc-projects-v1', JSON.stringify([{ id: 'p-acacias-test', name: 'Test', createdAt: '2026-01-01T00:00:00.000Z' }]))
  setCurrentProjectId('p-acacias-test')
  // Écrit directement, tel que storage.ts le ferait pour une chaîne JSON —
  // mais SANS passer par saveGanttTasks (qui, lui, sérialiserait de vraies
  // Date correctement) : c'est exactement la situation d'une ligne corrigée
  // hors application, avec des dates déjà en chaîne dans le JSON stocké.
  localStorage.setItem('sc-gantt-v2::p-acacias-test', JSON.stringify(RAW_ACACIAS_SHAPE))
}

describe('getGanttTasks() : filet de lecture sur des dates non conformes (chaîne brute)', () => {
  afterEach(() => localStorage.clear())

  it('convertit malgré tout les champs date en vraies instances Date, y compris dans les enfants', () => {
    seedRawAcacias()
    const tasks = getGanttTasks()
    expect(tasks[0].planned_start instanceof Date).toBe(true)
    expect(tasks[0].planned_end instanceof Date).toBe(true)
    expect(tasks[0].children![0].planned_start instanceof Date).toBe(true)
    expect(tasks[0].children![0].actual_end instanceof Date).toBe(true)
    expect(tasks[0].planned_start.toISOString().slice(0, 10)).toBe('2026-03-02')
  })

  it('analyzePlanning (le point de plantage exact) ne lève plus avec ces données', () => {
    seedRawAcacias()
    const tasks = getGanttTasks()
    expect(() => analyzePlanning(tasks, new Date('2026-09-21'))).not.toThrow()
  })

  it('toute la chaîne Planning (CPM, prévision, vue) ne lève plus non plus', () => {
    seedRawAcacias()
    const tasks = getGanttTasks()
    const today = new Date('2026-09-21')
    expect(() => computeCpm(tasks)).not.toThrow()
    const cpm = computeCpm(tasks)
    expect(() => applyCriticality(tasks, cpm.criticalIds)).not.toThrow()
    expect(() => criticalPath(tasks)).not.toThrow()
    const planningTasks = toPlanningTasks(tasks, { operationId: 'p-acacias-test', commitments: [] })
    expect(() => computeTimelineRange(planningTasks, today)).not.toThrow()
  })

  it('des dates déjà conformes ({ __date }, chemin normal) ne sont pas altérées', () => {
    localStorage.clear()
    localStorage.setItem('sc-projects-v1', JSON.stringify([{ id: 'p-normal-test', name: 'Test', createdAt: '2026-01-01T00:00:00.000Z' }]))
    setCurrentProjectId('p-normal-test')
    const wellFormed: GanttTask = {
      id: 'T1', lot_id: 'L01', title: 'Tâche normale', planned_start: new Date('2026-01-01T00:00:00.000Z'),
      planned_end: new Date('2026-01-10T00:00:00.000Z'), planned_duration: 9, progress: 0,
      status: 'not-started', priority: 'medium', dependencies: [], is_milestone: false, is_critical: false,
    }
    saveGanttTasks([wellFormed])
    const tasks = getGanttTasks()
    expect(tasks[0].planned_start.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(tasks[0].planned_end.toISOString()).toBe('2026-01-10T00:00:00.000Z')
  })
})
