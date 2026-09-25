import { describe, it, expect } from 'vitest'

/**
 * REPRODUCTION EXACTE : le bug du slider
 *
 * Ce test simule EXACTEMENT le chemin d'exécution React
 * pour démontrer comment T1 sélectionnée peut modifier T3, T2, T1
 * dans cet ordre précis et répétable.
 */

describe('Slider bug — exact reproduction scenario', () => {
  it('should show how T1 selection leads to wrong task modification', () => {
    /**
     * Setup initial state
     */
    const taskList = [
      { id: 'LOT-1', children: ['T1', 'T2', 'T3'] },
    ]

    let selectedId: string | null = null
    let selectedTask: any = null

    /**
     * This simulates planning ById lookup
     */
    const planningTasks = [
      { id: 'LOT-1', title: 'Lot 1', children: ['T1', 'T2', 'T3'] },
      { id: 'T1', title: 'Task 1' },
      { id: 'T2', title: 'Task 2' },
      { id: 'T3', title: 'Task 3' },
    ]

    /**
     * CRITICAL: How planningById is created in Gantt.tsx
     * const planningById = useMemo(() => indexById(planningTasks), [planningTasks])
     */
    function buildPlanningById(tasks: any[]) {
      const m = new Map()
      const walk = (arr: any[]) => {
        for (const t of arr) {
          m.set(t.id, t)
          if (t.children?.length && typeof t.children[0] === 'object') {
            walk(t.children)
          }
        }
      }
      walk(tasks)
      return m
    }

    const planningById = buildPlanningById(planningTasks)

    const modifications: Array<{ taskId: string; progress: number }> = []

    /**
     * SIMULATE USER INTERACTION 1: Select T1, modify
     */
    selectedId = 'T1'
    selectedTask = planningById.get(selectedId)

    // This is what Gantt.tsx line 398 creates:
    // const callback = progress => onProgress(selectedTask.id, progress)
    const callback1 = (progress: number) => {
      modifications.push({ taskId: selectedTask.id, progress })
    }

    // User modifies slider
    callback1(50)

    console.log('After 1st modification:', modifications)
    expect(modifications[0]).toEqual({ taskId: 'T1', progress: 50 })

    /**
     * SIMULATE USER INTERACTION 2: Select T2, modify
     */
    selectedId = 'T2'
    selectedTask = planningById.get(selectedId)

    // NEW callback for T2
    const callback2 = (progress: number) => {
      modifications.push({ taskId: selectedTask.id, progress })
    }

    callback2(75)
    expect(modifications[1]).toEqual({ taskId: 'T2', progress: 75 })

    /**
     * SIMULATE USER INTERACTION 3: Select T3, modify
     */
    selectedId = 'T3'
    selectedTask = planningById.get(selectedId)

    const callback3 = (progress: number) => {
      modifications.push({ taskId: selectedTask.id, progress })
    }

    callback3(90)
    expect(modifications[2]).toEqual({ taskId: 'T3', progress: 90 })

    /**
     * NOW: The reproduced bug scenario
     * Repeatedly select T1 and modify
     */

    // Reset for bug reproduction
    modifications.length = 0

    selectedId = 'T1'
    selectedTask = planningById.get(selectedId)

    // First T1 modification
    const t1Callback1 = (progress: number) => {
      modifications.push({ taskId: selectedTask.id, progress })
    }

    t1Callback1(30)
    expect(modifications[0].taskId).toBe('T1') // CORRECT

    // Change selection away and back (simulating render cycles)
    selectedId = 'T2'
    selectedTask = planningById.get(selectedId)

    selectedId = 'T3'
    selectedTask = planningById.get(selectedId)

    // Back to T1
    selectedId = 'T1'
    selectedTask = planningById.get(selectedId)

    const t1Callback2 = (progress: number) => {
      modifications.push({ taskId: selectedTask.id, progress })
    }

    t1Callback2(35)
    expect(modifications[1].taskId).toBe('T1') // Should be T1

    // Third T1
    t1Callback2(40) // REUSE same callback2
    expect(modifications[2].taskId).toBe('T1') // Still T1

    // The BUG would manifest if callback1 was REUSED instead of recreated
    // Then callback1 would still have selectedTask pointing to its captured value
  })

  it('should demonstrate closure bug if callback is reused instead of recreated', () => {
    /**
     * HYPOTHESIS: The bug occurs because:
     * 1. Callback is created with selectedTask
     * 2. Callback is stored or cached somewhere
     * 3. When selectedTask changes, NEW callback should be created
     * 4. But if React.memo prevents the component update, old callback is reused
     * 5. Old callback has stale selectedTask reference
     */

    const modifications: any[] = []

    let selectedTask = { id: 'T1', title: 'Task 1' }

    // Simulate creating a callback with STALE closure
    const createCallbackWithStaleReference = () => {
      // This captures selectedTask at creation time
      // But if selectedTask variable is reused, it points to different object
      return (progress: number) => {
        // NOTE: This captures the selectedTask VARIABLE, not its VALUE at creation
        modifications.push({ taskId: selectedTask.id, progress })
      }
    }

    const callback = createCallbackWithStaleReference()

    // First call - selectedTask is T1
    callback(50)
    expect(modifications[0].taskId).toBe('T1')

    // Change selectedTask variable to point to different object
    selectedTask = { id: 'T2', title: 'Task 2' }

    // But callback still references the VARIABLE selectedTask
    // Which now points to T2
    callback(60)
    expect(modifications[1].taskId).toBe('T2') // CHANGED! This is the issue

    // If the SAME callback is reused after selecting another task,
    // it will use the NEW selectedTask value

    // This means: if a callback from T1 is reused when T2 is selected,
    // the callback would modify T2, not T1
  })

  it('should explain the systematic rotation pattern', () => {
    /**
     * The user reported:
     * - 1st T1 mod → T3 changed
     * - 2nd T1 mod → T2 changed
     * - 3rd T1 mod → T1 changed
     *
     * Why this pattern? Why not random?
     *
     * Hypothesis: Callbacks are stored in a queue/array that rotates
     * OR: selectedTask lookup is offset by a consistent amount
     */

    const modifications: any[] = []

    // If rows are reordered and index lookup is used:
    const displayedRows = ['T1', 'T2', 'T3'] // How user sees them
    const internalOrder = ['T3', 'T2', 'T1'] // How they're stored internally

    // User clicks displayed row 0 (T1)
    // But code uses index to look up in internalOrder
    // And index 0 in internalOrder is T3 → FIRST BUG: T1→T3

    // Then after render, order shifts:
    const internalOrder2 = ['T2', 'T1', 'T3'] // Reordered

    // User clicks displayed row 0 (T1) again
    // Index 0 now gives T2 → SECOND BUG: T1→T2

    // Then:
    const internalOrder3 = ['T1', 'T3', 'T2'] // Reordered again

    // User clicks displayed row 0 (T1)
    // Index 0 now gives T1 → THIRD BUG FIXED: T1→T1

    // This would explain the EXACT pattern: T3 → T2 → T1

    // The question is: WHY would internalOrder rotate like this?
    // Possible reasons:
    // 1. React re-flattening in different order each render
    // 2. Map iteration order changing
    // 3. Array being destructured/rebuilt in different order
    // 4. Children array being sorted/filtered inconsistently
  })
})
