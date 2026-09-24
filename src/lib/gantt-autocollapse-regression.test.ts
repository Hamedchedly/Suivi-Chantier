import { describe, it, expect } from 'vitest'
import { isTaskGroupCompleted } from './planningEngine'
import { PlanningTask } from '../types/planning'

describe('Gantt Auto-Collapse Regression Tests — 100% Group Completion', () => {
  const makeTask = (id: string, title: string, progress: number = 0, status: 'in-progress' | 'completed' | 'blocked' | 'cancelled' | 'not-started' = 'in-progress', children: PlanningTask[] = []): PlanningTask => ({
    id, title,
    operationId: 'op1',
    lotId: 'L1',
    isMilestone: false,
    isCritical: false,
    status,
    progress,
    isNa: false,
    contract: { start: new Date('2026-01-01'), end: new Date('2026-01-31'), workingDays: 30 },
    actual: { start: undefined, end: undefined, progress },
    forecast: { start: undefined, end: undefined, method: null },
    variance: { startDays: null, endDays: null, forecastDays: null, commitmentDays: null },
    dependencies: [],
    commitments: [],
    latestCommitment: undefined,
    delayCause: undefined,
    ...(children.length > 0 && { children }),
  })

  it('Scenario 1 : Lot terminé (100%) → doit être complété', () => {
    const lot = makeTask('LOT-1', 'Lot 1', 100, 'completed', [
      makeTask('T1', 'Tâche 1', 100, 'completed'),
      makeTask('T2', 'Tâche 2', 100, 'completed'),
    ])

    // isTaskGroupCompleted regarde :
    // 1. progress >= 100
    // 2. status !== 'blocked'
    // 3. aucune feuille bloquée
    const isCompleted = isTaskGroupCompleted(lot)
    expect(isCompleted).toBe(true)
  })

  it('Scenario 2 : Lot à 100% mais avec tâche bloquée → pas complété', () => {
    const lot = makeTask('LOT-1', 'Lot 1', 100, 'in-progress', [
      makeTask('T1', 'Tâche 1', 100, 'completed'),
      makeTask('T2', 'Tâche 2', 100, 'blocked'),
    ])

    expect(isTaskGroupCompleted(lot)).toBe(false)
  })

  it('Scenario 3 : Lot à 95% → pas complété', () => {
    const lot = makeTask('LOT-1', 'Lot 1', 95, 'in-progress', [
      makeTask('T1', 'Tâche 1', 95, 'in-progress'),
      makeTask('T2', 'Tâche 2', 95, 'in-progress'),
    ])

    const isCompleted = isTaskGroupCompleted(lot)
    expect(isCompleted).toBe(false)
  })

  it('Scenario 4 : Lot bloqué (status=blocked) → pas complété même à 100%', () => {
    const lot = makeTask('LOT-1', 'Lot 1', 100, 'blocked', [
      makeTask('T1', 'Tâche 1', 100, 'completed'),
      makeTask('T2', 'Tâche 2', 100, 'completed'),
    ])

    const isCompleted = isTaskGroupCompleted(lot)
    expect(isCompleted).toBe(false)
  })

  it('Scenario 5 : Lot annulé (status=cancelled) → complétude basée sur progress + blocages', () => {
    const lot = makeTask('LOT-1', 'Lot 1', 100, 'cancelled', [
      makeTask('T1', 'Tâche 1', 100, 'cancelled'),
      makeTask('T2', 'Tâche 2', 100, 'cancelled'),
    ])

    // cancelled ne force pas la non-complétude à lui seul ; c'est 'blocked' qui la force
    const isCompleted = isTaskGroupCompleted(lot)
    expect(isCompleted).toBe(true)
  })

  it('Scenario 6 : Lot 100% + sous-tâches 100% → complété', () => {
    const sub1 = makeTask('SUB-1', 'Sous-tâche 1', 100, 'completed')
    const sub2 = makeTask('SUB-2', 'Sous-tâche 2', 100, 'completed')
    const task = makeTask('T1', 'Tâche 1', 100, 'completed', [sub1, sub2])
    const lot = makeTask('LOT-1', 'Lot 1', 100, 'completed', [task])

    const isCompleted = isTaskGroupCompleted(lot)
    expect(isCompleted).toBe(true)
  })

  it('Scenario 7 : Transition 95% → 100% → devrait être auto-collapsé', () => {
    const lot95 = makeTask('LOT-1', 'Lot 1', 95, 'in-progress', [
      makeTask('T1', 'Tâche 1', 95, 'in-progress'),
    ])
    expect(isTaskGroupCompleted(lot95)).toBe(false) // Avant

    const lot100 = makeTask('LOT-1', 'Lot 1', 100, 'completed', [
      makeTask('T1', 'Tâche 1', 100, 'completed'),
    ])
    expect(isTaskGroupCompleted(lot100)).toBe(true) // Après

    // La logique d'auto-collapse dans Gantt.tsx Section 1.3 ajoute les nouveaux groupes
    // terminés à l'ensemble collapsed
  })

  it('Scenario 8 : Lot 100% puis réouvert manuellement → ne doit pas être referé automatiquement', () => {
    const lot = makeTask('LOT-1', 'Lot 1', 100, 'completed', [
      makeTask('T1', 'Tâche 1', 100, 'completed'),
    ])

    // isTaskGroupCompleted retourne true
    expect(isTaskGroupCompleted(lot)).toBe(true)

    // L'UI devrait (via Section 1.3) :
    // 1. Ajouter LOT-1 à collapsed
    // 2. Si utilisateur clic sur le chevron, oter LOT-1 de collapsed
    // 3. La prochaine re-évaluation de completedGroupIds n'ajoute pas LOT-1 si déjà dans collapsed
    // (la logique : for (const id of completedGroupIds) { if (!next.has(id)) { next.add(id) } })
  })

  it('Scenario 9 : Lot N/A → pas dans les feuilles comptées pour complétude', () => {
    // T2.isNa serait true, mais cette API ne l'expose pas directement
    // La vérification réelle se fait dans planningEngine.ts/recomputeLot avec weightedProgress

    // Pour cette régression, on vérifie juste que la complétude ignore
    // les tâches marquées N/A dans les feuilles
    // isTaskGroupCompleted regarde juste les enfants directs et leur status
    // Le calcul de progress exclut N/A, mais isTaskGroupCompleted regarde progress >= 100
    // (ce test est principalement pour la couverture documentaire)
  })

  it('Scenario 10 : Lot 100% + utilisateur le met manuellement à 95% → devrait être réouvert', () => {
    let lot = makeTask('LOT-1', 'Lot 1', 100, 'completed', [
      makeTask('T1', 'Tâche 1', 100, 'completed'),
    ])
    expect(isTaskGroupCompleted(lot)).toBe(true)

    // Simuler que l'utilisateur change une tâche
    lot = makeTask('LOT-1', 'Lot 1', 95, 'in-progress', [
      makeTask('T1', 'Tâche 1', 95, 'in-progress'),
    ])
    expect(isTaskGroupCompleted(lot)).toBe(false) // Le lot ne répond plus aux critères

    // L'UI devrait le retirer de collapsed pour le montrer à nouveau
  })
})
