import { describe, it, expect } from 'vitest'

/**
 * Test : reproduire le problème de closure en slider
 *
 * Scénario :
 * - 3 tâches avec IDs T1, T2, T3
 * - Sélectionner T1 → créer callback qui capture T1 dans une closure
 * - Modifier T1 → le callback est appelé, devrait modifier T1
 * - Sélectionner T2 → new callback, devrait capturer T2
 * - Modifier T2 → devrait modifier T2
 * - Etc.
 *
 * Si le problème est une closure obsolète, voici comment cela pourrait se manifester:
 * - 1er callback capture T1 (correct)
 * - Utilisateur change de sélection
 * - Si la closure n'est pas invalidée, l'ancien callback (T1) pourrait rester attaché
 * - Ou l'ID pourrait être mélangé avec l'ordre d'affichage
 */

describe('Slider callback closure — Task ID capture', () => {
  it('should capture correct task ID in callback closure', () => {
    const tasks = [
      { id: 'T1', title: 'Task 1', progress: 0 },
      { id: 'T2', title: 'Task 2', progress: 0 },
      { id: 'T3', title: 'Task 3', progress: 0 },
    ]

    const modifications: Array<{ taskId: string; newProgress: number }> = []

    // Simulating Gantt.tsx behavior:
    // When user selects a task, we create a callback that captures selectedTask.id
    let selectedId = 'T1'
    let selectedTask = tasks.find(t => t.id === selectedId)!

    // This is what Gantt.tsx does:
    // onProgress={onProgress && !selectedTask.children?.length ? progress => onProgress(selectedTask.id, progress) : undefined}
    const createProgressCallback = () => {
      return (progress: number) => {
        // The callback CAPTURES selectedTask.id at creation time
        modifications.push({ taskId: selectedTask.id, newProgress: progress })
      }
    }

    let progressCallback = createProgressCallback()

    // User modifies T1
    progressCallback(50)
    expect(modifications[0]).toEqual({ taskId: 'T1', newProgress: 50 })

    // Now user selects T2
    selectedId = 'T2'
    selectedTask = tasks.find(t => t.id === selectedId)!

    // NEW callback should be created (this is what the key change should cause)
    progressCallback = createProgressCallback()

    // User modifies T2
    progressCallback(75)
    expect(modifications[1]).toEqual({ taskId: 'T2', newProgress: 75 })

    // Select T3
    selectedId = 'T3'
    selectedTask = tasks.find(t => t.id === selectedId)!
    progressCallback = createProgressCallback()

    // Modify T3
    progressCallback(90)
    expect(modifications[2]).toEqual({ taskId: 'T3', newProgress: 90 })
  })

  it('should demonstrate the bug if callback is NOT recreated', () => {
    const tasks = [
      { id: 'T1', title: 'Task 1', progress: 0 },
      { id: 'T2', title: 'Task 2', progress: 0 },
      { id: 'T3', title: 'Task 3', progress: 0 },
    ]

    const modifications: Array<{ taskId: string; newProgress: number }> = []

    let selectedId = 'T1'
    let selectedTask = tasks.find(t => t.id === selectedId)!

    // Create callback ONCE and reuse it (this would be a BUG)
    const buggyProgressCallback = (progress: number) => {
      modifications.push({ taskId: selectedTask.id, newProgress: progress })
    }

    // First modification with T1 selected
    buggyProgressCallback(50)
    expect(modifications[0].taskId).toBe('T1')

    // Change selection to T2
    selectedId = 'T2'
    selectedTask = tasks.find(t => t.id === selectedId)!

    // If callback is reused (instead of recreated), it will NOW capture T2
    // because selectedTask.id changed
    buggyProgressCallback(75)
    expect(modifications[1].taskId).toBe('T2') // This works because selectedTask changed

    // Change selection back to T1
    selectedId = 'T1'
    selectedTask = tasks.find(t => t.id === selectedId)!

    // But now if the PREVIOUS callback (which captured T2) is still being used...
    // NO WAIT, that's not how closures work.

    // The real bug would be if:
    // 1. Callback captures selectedTask by REFERENCE, not by value
    // 2. selectedTask object is reused
    // 3. But it refers to DIFFERENT task each time
  })

  it('should demonstrate bug if planningById lookup returns wrong task', () => {
    /**
     * This is the REAL suspect:
     *
     * In Gantt.tsx:
     * const selectedTask = selectedId ? planningById.get(selectedId) ?? null : null
     *
     * If planningById.get(selectedId) returns the WRONG task object,
     * then the callback will capture the wrong ID, regardless of closure behavior.
     */

    const planningById = new Map([
      ['T1', { id: 'T1', title: 'Task 1' }],
      ['T2', { id: 'T2', title: 'Task 2' }],
      ['T3', { id: 'T3', title: 'Task 3' }],
    ])

    const modifications: Array<{ taskId: string }> = []

    // Scenario: User selects T1
    let selectedId = 'T1'
    let selectedTask = planningById.get(selectedId)!

    const callback1 = (progress: number) => {
      modifications.push({ taskId: selectedTask.id })
    }

    callback1(50)
    expect(modifications[0].taskId).toBe('T1')

    // Now if planningById is rebuilt and T1's entry points to T3's object (BUG):
    planningById.set('T1', { id: 'T3', title: 'Task 3 (mismap)' })

    selectedTask = planningById.get(selectedId)! // Now gets T3's object

    callback1(60) // The OLD callback still has reference to old selectedTask
    // But wait, selectedTask is reassigned, so it depends on WHEN it's reassigned

    // If reassignment happens BEFORE callback creation:
    const callback2 = (progress: number) => {
      modifications.push({ taskId: selectedTask.id })
    }

    callback2(70)
    expect(modifications[2].taskId).toBe('T3') // WRONG! Should be T1

    // This would explain: T1 selected → T3 modified
  })

  it('should demonstrate the systematic offset pattern', () => {
    /**
     * User reported:
     * - Select T1, modify → T3 changed
     * - Select T1 again, modify → T2 changed
     * - Select T1 again, modify → T1 changed
     *
     * This pattern is SYSTEMATIC. It follows a rotation.
     * This suggests: array index manipulation or order mismatch.
     */

    const tasksByIndex = [
      { id: 'LOT-1', children: ['T1', 'T2', 'T3'] }, // index 0
    ]

    const tasksByOrder = ['T1', 'T2', 'T3'] // indices 0, 1, 2

    // If somewhere in the code, an index is used instead of an ID:
    // Then selecting "T1" (visual index 0) could modify "task at index 2" (T3)

    // Example: if rows are reversed
    const reversedRows = ['T3', 'T2', 'T1'] // indices 0, 1, 2

    // User clicks on visual row displaying "T1"
    // But the code mistakenly uses the ROW INDEX instead of task ID
    // Row displaying "T1" is at index 2 in reversedRows
    // If code then uses reversedRows[2] but expects it to be T1...
    // No, reversedRows[2] = 'T1', so that works.

    // UNLESS:
    // - Row index is 2 (T1 is at index 2 visually)
    // - But in displayedRows order, T1 is at index 0 after re-flattening
    // - And code uses old index (2) to access new array (T3 is at index 2 in new array)

    const initialRows = ['T1', 'T2', 'T3'] // User views this
    const userClicksRow = 0 // Clicks on T1, visual row 0

    // But internally uses task at index 0
    let taskIDAtClickedIndex = initialRows[userClicksRow]
    expect(taskIDAtClickedIndex).toBe('T1')

    // After a render, rows are re-flattened but order changes
    const reorderedRows = ['T3', 'T2', 'T1'] // T1 moved to index 2
    const modifiedRows = ['T2', 'T3', 'T1']  // Different order each time?

    // If code mistakenly still uses index 0:
    taskIDAtClickedIndex = reorderedRows[0]
    expect(taskIDAtClickedIndex).toBe('T3') // NOW it's wrong!

    // This would explain the offset
  })
})
