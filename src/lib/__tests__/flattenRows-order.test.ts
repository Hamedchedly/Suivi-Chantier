import { describe, it, expect } from 'vitest'
import type { PlanningTask } from '../../types/planning'

/**
 * Test : l'ordre des tâches dans rows (flattenRows)
 * vs l'ordre dans planningById (indexById)
 *
 * Hypothèse : ces deux ordres pourraient être DIFFÉRENTS,
 * ce qui causerait le bug du décalage.
 */

describe('Task ordering: flattenRows vs indexById', () => {
  // Simulate flattenRows from Gantt.tsx
  function flattenRows(tasks: PlanningTask[], depth: number, out: Array<{ task: PlanningTask; depth: number }>): void {
    for (const t of tasks) {
      out.push({ task: t, depth })
      if (t.children?.length) flattenRows(t.children, depth + 1, out)
    }
  }

  // Simulate indexById from Gantt.tsx
  function indexById(tasks: PlanningTask[]): Map<string, PlanningTask> {
    const m = new Map<string, PlanningTask>()
    const walk = (arr: PlanningTask[]) => {
      for (const t of arr) {
        m.set(t.id, t)
        if (t.children?.length) walk(t.children)
      }
    }
    walk(tasks)
    return m
  }

  const makeTask = (id: string, title: string): PlanningTask => ({
    id,
    operationId: 'test',
    lotId: 'L1',
    parentId: undefined,
    zoneId: undefined,
    logementId: undefined,
    title,
    isMilestone: false,
    isCritical: false,
    status: 'in-progress',
    progress: 0,
    isNa: false,
    contract: { start: new Date(), end: new Date(), workingDays: 0 },
    actual: { start: undefined, end: undefined, progress: 0 },
    forecast: { start: new Date(), end: new Date(), method: null },
    variance: { startDays: null, endDays: null, forecastDays: null, commitmentDays: null },
    dependencies: [],
    commitments: [],
    latestCommitment: undefined,
    delayCause: undefined,
  })

  const makeLot = (children: PlanningTask[]): PlanningTask => {
    const lot = makeTask('LOT-1', 'Lot 1')
    lot.children = children
    return lot
  }

  it('should have same order in rows and planningById', () => {
    const tasks = [
      makeLot([
        makeTask('T1', 'Task 1'),
        makeTask('T2', 'Task 2'),
        makeTask('T3', 'Task 3'),
      ]),
    ]

    // Get order from flattenRows
    const rows: Array<{ task: PlanningTask; depth: number }> = []
    flattenRows(tasks, 0, rows)

    const rowOrder = rows.map(r => r.task.id)
    console.log('flattenRows order:', rowOrder) // Should be: LOT-1, T1, T2, T3

    // Get order from indexById
    const planningById = indexById(tasks)
    const mapKeys = Array.from(planningById.keys())
    console.log('indexById order:', mapKeys) // Should be same

    // Check they match
    for (let i = 0; i < rowOrder.length; i++) {
      const displayedId = rowOrder[i]
      const mapValue = planningById.get(displayedId)

      expect(mapValue).toBeDefined()
      expect(mapValue?.id).toBe(displayedId)
    }

    // Now the critical test: if user clicks row at index 1 (should be T1)
    // But if order mismatches, clicking row 1 could select a different task
    const clickedRowIndex = 1
    const displayedTaskAtRow = rows[clickedRowIndex].task.id
    expect(displayedTaskAtRow).toBe('T1')

    // Now if we look up this task in planningById
    const lookedUpTask = planningById.get(displayedTaskAtRow)
    expect(lookedUpTask?.id).toBe('T1')
  })

  it('should demonstrate issue if rows are reordered', () => {
    // Hypothetical scenario: what if flattenRows returns tasks in different order?
    // This could happen if collapsed state changes or filtering happens

    const tasks = [
      makeLot([
        makeTask('T1', 'Task 1'),
        makeTask('T2', 'Task 2'),
        makeTask('T3', 'Task 3'),
      ]),
    ]

    const rows: Array<{ task: PlanningTask; depth: number }> = []
    flattenRows(tasks, 0, rows)

    const planningById = indexById(tasks)

    // Initial order: LOT-1, T1, T2, T3
    expect(rows.map(r => r.task.id)).toEqual(['LOT-1', 'T1', 'T2', 'T3'])

    // User selects row 1 (T1)
    const selectedRow = rows[1]
    expect(selectedRow.task.id).toBe('T1')

    // Now imagine rows are re-flattened but in DIFFERENT order
    // (this could happen if children array is modified, or if flattenRows has a bug)
    const reorderedRows = [
      rows[0], // LOT-1
      rows[3], // T3
      rows[2], // T2
      rows[1], // T1
    ]

    // But planningById is still the same
    expect(planningById.get('T1')?.id).toBe('T1')

    // If code mistakenly uses ROW INDEX from old render with NEW rows:
    // const taskAtClickedIndex = reorderedRows[1] → T3
    const taskAtClickedIndex = reorderedRows[1]
    expect(taskAtClickedIndex.task.id).toBe('T3') // WRONG!

    // This would explain: Click row showing T1 → T3 modified
  })

  it('should verify planningById.get always returns correct task', () => {
    // The REAL question: does planningById.get(selectedId) return the right task?
    // IF YES: bug is NOT in lookup
    // IF NO: bug IS in planningById construction

    const t1 = makeTask('T1', 'Task 1')
    const t2 = makeTask('T2', 'Task 2')
    const t3 = makeTask('T3', 'Task 3')

    const tasks = [makeLot([t1, t2, t3])]

    const planningById = indexById(tasks)

    // Direct reference check
    expect(planningById.get('T1') === t1).toBe(true)
    expect(planningById.get('T2') === t2).toBe(true)
    expect(planningById.get('T3') === t3).toBe(true)

    // ID check
    expect(planningById.get('T1')?.id).toBe('T1')
    expect(planningById.get('T2')?.id).toBe('T2')
    expect(planningById.get('T3')?.id).toBe('T3')

    // If this test passes, planningById is correct
    // If it fails, the bug is in indexById
  })
})
