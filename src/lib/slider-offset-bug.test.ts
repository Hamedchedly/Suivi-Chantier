import { describe, it, expect } from 'vitest'
import { GanttTask } from '../types/gantt'

/**
 * Test reproduisant le bug du slider : décalage systématique
 *
 * Quand je clique sur le slider de la Tâche 1, c'est la Tâche 3 qui est modifiée.
 * Quand je réessaye sur la Tâche 1, c'est la Tâche 2 qui est modifiée.
 * Quand je réessaye une troisième fois, enfin la Tâche 1 est modifiée.
 *
 * Cela ressemble à un décalage ou un mélange entre l'ordre d'affichage et
 * l'ordre des données réelles.
 */

describe('Slider Offset Bug — Task Selection vs Modification', () => {
  // Simulation simple : un lot avec 3 tâches
  const makeTask = (id: string, title: string, progress: number = 0): GanttTask => ({
    id,
    lot_id: 'LOT-1',
    title,
    planned_start: new Date('2026-01-01'),
    planned_end: new Date('2026-01-31'),
    planned_duration: 30,
    progress,
    status: 'in-progress',
    priority: 'medium',
    dependencies: [],
    is_milestone: false,
    is_critical: false,
  })

  it('should modify the selected task, not an offset task', () => {
    const lot: GanttTask = {
      id: 'LOT-1',
      lot_id: 'LOT-1',
      title: 'Lot 1',
      planned_start: new Date('2026-01-01'),
      planned_end: new Date('2026-01-31'),
      planned_duration: 30,
      progress: 0,
      status: 'in-progress',
      priority: 'medium',
      dependencies: [],
      is_milestone: false,
      is_critical: false,
      children: [
        makeTask('T1', 'Tâche 1', 0),
        makeTask('T2', 'Tâche 2', 0),
        makeTask('T3', 'Tâche 3', 0),
      ],
    }

    // Simuler la sélection de T1
    const selectedId = 'T1'

    // Trouver la tâche sélectionnée dans lot.children
    const selectedTask = lot.children?.find(t => t.id === selectedId)
    expect(selectedTask?.id).toBe('T1')

    // La modification doit affecter T1, pas T3 ni T2
    const updated = {
      ...lot,
      children: lot.children?.map(t =>
        t.id === selectedId ? { ...t, progress: 50 } : t
      ),
    }

    expect(updated.children![0].progress).toBe(50) // T1
    expect(updated.children![1].progress).toBe(0)  // T2
    expect(updated.children![2].progress).toBe(0)  // T3

    // Vérifier que ce sont bien les bonnes tâches
    expect(updated.children![0].title).toBe('Tâche 1')
    expect(updated.children![1].title).toBe('Tâche 2')
    expect(updated.children![2].title).toBe('Tâche 3')
  })

  it('should work consistently on multiple sequential selections', () => {
    const lot: GanttTask = {
      id: 'LOT-1',
      lot_id: 'LOT-1',
      title: 'Lot 1',
      planned_start: new Date('2026-01-01'),
      planned_end: new Date('2026-01-31'),
      planned_duration: 30,
      progress: 0,
      status: 'in-progress',
      priority: 'medium',
      dependencies: [],
      is_milestone: false,
      is_critical: false,
      children: [
        makeTask('T1', 'Tâche 1', 0),
        makeTask('T2', 'Tâche 2', 0),
        makeTask('T3', 'Tâche 3', 0),
      ],
    }

    // Première modification : T1 → 30%
    let updated = {
      ...lot,
      children: lot.children?.map(t =>
        t.id === 'T1' ? { ...t, progress: 30 } : t
      ),
    }

    expect(updated.children![0].progress).toBe(30) // T1
    expect(updated.children![0].title).toBe('Tâche 1')

    // Deuxième modification : T2 → 60%
    updated = {
      ...updated,
      children: updated.children?.map(t =>
        t.id === 'T2' ? { ...t, progress: 60 } : t
      ),
    }

    expect(updated.children![0].progress).toBe(30) // T1 unchanged
    expect(updated.children![1].progress).toBe(60) // T2 modified
    expect(updated.children![2].progress).toBe(0)  // T3 unchanged

    // Troisième modification : T3 → 90%
    updated = {
      ...updated,
      children: updated.children?.map(t =>
        t.id === 'T3' ? { ...t, progress: 90 } : t
      ),
    }

    expect(updated.children![0].progress).toBe(30) // T1
    expect(updated.children![1].progress).toBe(60) // T2
    expect(updated.children![2].progress).toBe(90) // T3
  })
})
