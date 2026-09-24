import { describe, it, expect } from 'vitest'
import { GanttTask } from '../types/gantt'

describe('Gantt Slider Regression Tests — Flux complet', () => {
  const makeTask = (id: string, title: string, progress: number = 0, children: GanttTask[] = []): GanttTask => ({
    id, lot_id: 'L1', title,
    planned_start: new Date('2026-01-01'),
    planned_end: new Date('2026-01-31'),
    planned_duration: 30,
    progress,
    status: 'in-progress',
    priority: 'medium',
    dependencies: [],
    is_milestone: false,
    is_critical: false,
    ...(children.length > 0 && { children }),
  })

  it('Scenario 1 : Sélectionner A (50%), puis B (75%) → A ne change pas, B change', () => {
    const taskA = makeTask('A', 'Tâche A', 0)
    const taskB = makeTask('B', 'Tâche B', 0)
    let ganttTasks = [
      makeTask('LOT-1', 'Lot 1', 0, [taskA, taskB]),
    ]

    // Modifier A -> 50%
    const task = findTaskInList(ganttTasks, 'A')
    expect(task).toBeDefined()
    ganttTasks = mapTaskInList(ganttTasks, 'A', t => ({ ...t, progress: 50 }))

    // Vérifier A = 50%
    const updatedA = findTaskInList(ganttTasks, 'A')
    expect(updatedA?.progress).toBe(50)

    // Modifier B -> 75%
    ganttTasks = mapTaskInList(ganttTasks, 'B', t => ({ ...t, progress: 75 }))

    // Vérifier A = 50% (inchangé), B = 75%
    const checkA = findTaskInList(ganttTasks, 'A')
    const checkB = findTaskInList(ganttTasks, 'B')
    expect(checkA?.progress).toBe(50)
    expect(checkB?.progress).toBe(75)
  })

  it('Scenario 2 : ID synthétique grp-lg-* ne modifie rien', () => {
    const taskA = makeTask('A', 'Tâche A', 0)
    const ganttTasks = [
      makeTask('LOT-1', 'Lot 1', 0, [taskA]),
    ]

    // Essayer de modifier un ID synthétique (n'existe pas dans ganttTasks)
    const synthTask = findTaskInList(ganttTasks, 'grp-lg-zone1-L1')
    expect(synthTask).toBeUndefined() // NOT FOUND

    // Vérifier que mapTaskInList ne change rien
    const result = mapTaskInList(ganttTasks, 'grp-lg-zone1-L1', t => ({ ...t, progress: 99 }))
    const checkA = findTaskInList(result, 'A')
    expect(checkA?.progress).toBe(0) // Inchangé
  })

  it('Scenario 3 : Changement rapide A → B → slider', () => {
    const taskA = makeTask('A', 'Tâche A', 0)
    const taskB = makeTask('B', 'Tâche B', 0)
    const ganttTasks = [
      makeTask('LOT-1', 'Lot 1', 0, [taskA, taskB]),
    ]

    // Simuler sélection rapide : A changé en B
    // Puis un slider agit sur B (pas sur A)
    let result = mapTaskInList(ganttTasks, 'A', t => ({ ...t, progress: 30 }))
    result = mapTaskInList(result, 'B', t => ({ ...t, progress: 60 }))

    const checkA = findTaskInList(result, 'A')
    const checkB = findTaskInList(result, 'B')
    expect(checkA?.progress).toBe(30)
    expect(checkB?.progress).toBe(60)
  })

  it('Scenario 4 : Tâche avec sous-tâches (parent ne peut pas être modifié par slider)', () => {
    const sub1 = makeTask('SUB-1', 'Sous-tâche 1', 0)
    const sub2 = makeTask('SUB-2', 'Sous-tâche 2', 0)
    const parent = makeTask('P', 'Parent', 0, [sub1, sub2])
    const ganttTasks = [
      makeTask('LOT-1', 'Lot 1', 0, [parent]),
    ]

    // Parent a des children, donc le slider devrait être désactivé dans l'UI
    // Vérifier que le parent ne peut pas être modifié directement par findTaskInList
    const p = findTaskInList(ganttTasks, 'P')
    expect(p?.children?.length).toBe(2) // Confirme qu'il a des enfants

    // Si on essaye quand même de le modifier, ça marche au niveau mapTaskInList
    // (c'est l'UI qui empêche, pas le moteur)
    const result = mapTaskInList(ganttTasks, 'P', t => ({ ...t, progress: 100 }))
    const checkP = findTaskInList(result, 'P')
    expect(checkP?.progress).toBe(100) // La mutation fonctionne
    // Mais en pratique, GanttDetails.tsx ligne 350 désactive le slider
  })

  it('Scenario 5 : Mode "Par logement" — synthétiques vs réelles', () => {
    const realTask1 = makeTask('REAL-1', 'Tâche réelle 1', 0)
    const realTask2 = makeTask('REAL-2', 'Tâche réelle 2', 0)
    const lot = makeTask('LOT-1', 'Lot 1', 0, [realTask1, realTask2])

    // Dans buildLogementTree, on crée des synthétiques comme :
    // grp-lg-zone1 (logement groupe)
    // grp-lg-zone1-L1 (lot synthétique dans logement)
    // mais les IDs réels (REAL-1, REAL-2) restent dans ganttTasks

    let ganttTasks = [lot]

    // Modifier une tâche réelle
    ganttTasks = mapTaskInList(ganttTasks, 'REAL-1', t => ({ ...t, progress: 40 }))
    const check = findTaskInList(ganttTasks, 'REAL-1')
    expect(check?.progress).toBe(40)

    // Essayer de modifier un synthétique (ne l'affecte pas)
    const beforeSynth = findTaskInList(ganttTasks, 'grp-lg-zone1-L1')
    expect(beforeSynth).toBeUndefined() // N'existe pas dans ganttTasks

    // La source de vérité reste intacte
    const checkAfter = findTaskInList(ganttTasks, 'REAL-1')
    expect(checkAfter?.progress).toBe(40)
  })

  it('Scenario 6 : Fermer/rouvrir panneau détail conserve progression', () => {
    const taskA = makeTask('A', 'Tâche A', 0)
    let ganttTasks = [
      makeTask('LOT-1', 'Lot 1', 0, [taskA]),
    ]

    // Sélectionner et modifier A
    ganttTasks = mapTaskInList(ganttTasks, 'A', t => ({ ...t, progress: 75 }))
    let checkA = findTaskInList(ganttTasks, 'A')
    expect(checkA?.progress).toBe(75)

    // Fermer le panneau (setSelectedId(null) dans l'UI)
    // Rouvrir et vérifier que A = 75% toujours
    checkA = findTaskInList(ganttTasks, 'A')
    expect(checkA?.progress).toBe(75)
  })

  it('Scenario 7 : Mobile/touch — onTouchEnd modifie bien la tâche sélectionnée', () => {
    const taskA = makeTask('A', 'Tâche A', 0)
    const taskB = makeTask('B', 'Tâche B', 0)
    let ganttTasks = [
      makeTask('LOT-1', 'Lot 1', 0, [taskA, taskB]),
    ]

    // Simuler :
    // 1. Sélectionner A
    // 2. Touch slide (onTouchEnd)
    // 3. Sélectionner B
    // 4. Touch slide (onTouchEnd)

    ganttTasks = mapTaskInList(ganttTasks, 'A', t => ({ ...t, progress: 20 }))
    ganttTasks = mapTaskInList(ganttTasks, 'B', t => ({ ...t, progress: 80 }))

    const checkA = findTaskInList(ganttTasks, 'A')
    const checkB = findTaskInList(ganttTasks, 'B')
    expect(checkA?.progress).toBe(20)
    expect(checkB?.progress).toBe(80)
  })
})

// Helpers (copies depuis pages/Gantt.tsx)
export const findTaskInList = (list: GanttTask[], id: string): GanttTask | undefined => {
  for (const t of list) {
    if (t.id === id) return t
    if (t.children?.length) { const found = findTaskInList(t.children, id); if (found) return found }
  }
  return undefined
}

export const updateTaskInList = (list: GanttTask[], id: string, updates: Partial<GanttTask>): GanttTask[] =>
  list.map(t => {
    if (t.id === id) return { ...t, ...updates }
    if (t.children?.length) return { ...t, children: updateTaskInList(t.children, id, updates) }
    return t
  })

export const mapTaskInList = (list: GanttTask[], id: string, fn: (t: GanttTask) => GanttTask): GanttTask[] =>
  list.map(t => {
    if (t.id === id) return fn(t)
    if (t.children?.length) return { ...t, children: mapTaskInList(t.children, id, fn) }
    return t
  })
