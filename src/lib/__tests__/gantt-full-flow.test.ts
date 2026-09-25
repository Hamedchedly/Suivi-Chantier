import { describe, it, expect } from 'vitest'

/**
 * TEST COMPLET : simule le flux exact Gantt.tsx → GanttRowLabel → GanttDetails
 */

describe('Gantt full flow — from task selection to modification', () => {
  it('should trace task through entire flow to find offset', () => {
    /**
     * Step 1: Parent creates tasks
     */
    const initialGanttTasks = [
      {
        id: 'LOT-1',
        lot_id: 'LOT-1',
        title: 'Lot 1',
        progress: 0,
        children: [
          { id: 'T1', lot_id: 'LOT-1', title: 'Task 1', progress: 0 },
          { id: 'T2', lot_id: 'LOT-1', title: 'Task 2', progress: 0 },
          { id: 'T3', lot_id: 'LOT-1', title: 'Task 3', progress: 0 },
        ],
      },
    ]

    /**
     * Step 2: PlanningGantt receives tasks and processes them
     */
    const toPlanningTasks = (tasks: any[]) => tasks // Simplified
    const planningTasks = toPlanningTasks(initialGanttTasks)

    console.log('Step 2: planningTasks order:', planningTasks.map(t => t.id))

    /**
     * Step 3: flattenRows creates rows for display
     */
    const flattenRows = (tasks: any[], depth: number, out: any[] = []) => {
      for (const t of tasks) {
        out.push({ task: t, depth })
        if (t.children?.length) flattenRows(t.children, depth + 1, out)
      }
      return out
    }

    const rows = flattenRows(planningTasks, 0)
    console.log('Step 3: rows display order:', rows.map(r => r.task.id))
    expect(rows.map(r => r.task.id)).toEqual(['LOT-1', 'T1', 'T2', 'T3'])

    /**
     * Step 4: planningById is created for lookup
     */
    const indexById = (tasks: any[]) => {
      const m = new Map()
      const walk = (arr: any[]) => {
        for (const t of arr) {
          m.set(t.id, t)
          if (t.children?.length) walk(t.children)
        }
      }
      walk(tasks)
      return m
    }

    const planningById = indexById(planningTasks)
    console.log('Step 4: planningById keys:', Array.from(planningById.keys()))

    /**
     * Step 5: User clicks row 1 (which is T1)
     */
    const clickedRow = rows[1]
    const clickedTaskId = clickedRow.task.id

    console.log('Step 5: User clicked row 1, task ID:', clickedTaskId)
    expect(clickedTaskId).toBe('T1')

    /**
     * Step 6: GanttRowLabel onSelect is called with task from clicked row
     */
    const onSelect = (task: any) => {
      console.log('Step 6: onSelect called with task:', task.id)
      return task.id
    }

    const selectedIdFromOnSelect = onSelect(clickedRow.task)
    console.log('Step 6: selectedId set to:', selectedIdFromOnSelect)

    /**
     * Step 7: Gantt.tsx calculates selectedTask
     */
    const selectedTask = planningById.get(selectedIdFromOnSelect)
    console.log('Step 7: selectedTask from planningById.get():', selectedTask?.id)
    expect(selectedTask?.id).toBe('T1')

    /**
     * Step 8: GanttDetails renders with selectedTask
     */
    const ganttDetailsTask = selectedTask
    console.log('Step 8: GanttDetails receives task:', ganttDetailsTask?.id)

    /**
     * Step 9: User modifies slider
     */
    const modifiedTasks: any[] = []

    // Simulate the callback created in Gantt.tsx line 398:
    // onProgress={onProgress && !selectedTask.children?.length ? progress => onProgress(selectedTask.id, progress) : undefined}
    const onProgress = (taskId: string, progress: number) => {
      modifiedTasks.push({ taskId, progress })
    }

    const progressCallback = (progress: number) => {
      onProgress(ganttDetailsTask!.id, progress)
    }

    progressCallback(50)

    console.log('Step 9: Slider triggered onProgress with:', modifiedTasks[0])
    expect(modifiedTasks[0]).toEqual({ taskId: 'T1', progress: 50 })
  })

  it('should verify rows order matches planningById lookup', () => {
    /**
     * CRITICAL TEST: Are rows in same order as planningById?
     */

    const tasks = [
      {
        id: 'LOT-1',
        children: [
          { id: 'T1', title: 'Task 1' },
          { id: 'T2', title: 'Task 2' },
          { id: 'T3', title: 'Task 3' },
        ],
      },
    ]

    // Create rows
    const rows: any[] = []
    const flattenRows = (ts: any[], depth = 0) => {
      for (const t of ts) {
        rows.push({ task: t, depth })
        if (t.children?.length) flattenRows(t.children, depth + 1)
      }
    }
    flattenRows(tasks)

    // Create planningById
    const planningById = new Map()
    const walk = (ts: any[]) => {
      for (const t of ts) {
        planningById.set(t.id, t)
        if (t.children?.length) walk(t.children)
      }
    }
    walk(tasks)

    // Now verify: if I click on row at index N, does the task lookup match?
    for (let i = 0; i < rows.length; i++) {
      const rowTask = rows[i].task
      const lookedUpTask = planningById.get(rowTask.id)

      console.log(`Row ${i}: displayed=${rowTask.id}, lookup=${lookedUpTask?.id}`)

      // CRITICAL: These MUST match
      expect(rowTask.id).toBe(lookedUpTask?.id)
      expect(rowTask === lookedUpTask).toBe(true)
    }
  })

  it('should test the exact reported bug scenario', () => {
    /**
     * EXACT BUG SCENARIO:
     * - User selects T1 three times consecutively
     * - Each time, a DIFFERENT task is modified: T3, T2, T1
     */

    const tasks = [
      {
        id: 'LOT-1',
        children: [
          { id: 'T1', title: 'Task 1', progress: 0 },
          { id: 'T2', title: 'Task 2', progress: 0 },
          { id: 'T3', title: 'Task 3', progress: 0 },
        ],
      },
    ]

    // Build rows and planningById
    const rows: any[] = []
    const flattenRows = (ts: any[], depth = 0) => {
      for (const t of ts) {
        rows.push({ task: t, depth })
        if (t.children?.length) flattenRows(t.children, depth + 1)
      }
    }
    flattenRows(tasks)

    const planningById = new Map()
    const walk = (ts: any[]) => {
      for (const t of ts) {
        planningById.set(t.id, t)
        if (t.children?.length) walk(t.children)
      }
    }
    walk(tasks)

    const modifications: any[] = []

    // FIRST: Select T1 (row at index 1)
    let selectedTask = rows[1].task // T1
    console.log('1st selection: row 1 →', selectedTask.id)

    let progressCallback = (progress: number) => {
      modifications.push({ taskId: selectedTask.id, progress })
    }
    progressCallback(30)
    expect(modifications[0].taskId).toBe('T1')

    // SECOND: Select T1 again (should still be row 1)
    selectedTask = rows[1].task // T1
    console.log('2nd selection: row 1 →', selectedTask.id)

    progressCallback = (progress: number) => {
      modifications.push({ taskId: selectedTask.id, progress })
    }
    progressCallback(40)

    // BUG WOULD MANIFEST HERE: expect T1, but get T3 or T2
    console.log('2nd modification:', modifications[1])
    expect(modifications[1].taskId).toBe('T1')

    // THIRD: Select T1 again
    selectedTask = rows[1].task // T1
    console.log('3rd selection: row 1 →', selectedTask.id)

    progressCallback = (progress: number) => {
      modifications.push({ taskId: selectedTask.id, progress })
    }
    progressCallback(50)

    console.log('3rd modification:', modifications[2])
    expect(modifications[2].taskId).toBe('T1')

    // If test passes, bug is NOT in basic row/lookup logic
    // If test fails, bug is in how rows or callbacks are managed
  })
})
