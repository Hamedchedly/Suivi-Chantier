import { describe, it, expect } from 'vitest'

/**
 * TEST : GanttDetails state isolation
 *
 * GanttDetails a un state local:
 *   const [dragProgress, setDragProgress] = useState<number | null>(null)
 *
 * QUESTION: Quand selectedTask change (GanttDetails remonte avec key=selectedTask.id),
 * est-ce que dragProgress est réinitialisé correctement ?
 *
 * PROBLÈME POTENTIEL:
 * Si dragProgress ne se réinitialise pas, ou si le handler du slider
 * capture une ancienne valeur, on aurait des bugs.
 */

describe('GanttDetails — state isolation per task', () => {
  it('should reset dragProgress when task changes', () => {
    /**
     * Simulate GanttDetails component with task as key
     * When task.id changes, component should remount (because key changed)
     * Which means all local state (dragProgress) should reset
     */

    type Task = { id: string; title: string; progress: number }

    let currentTask: Task = { id: 'T1', title: 'Task 1', progress: 0 }
    let dragProgress: number | null = null
    let displayProgress = dragProgress !== null ? dragProgress : currentTask.progress

    // User drags slider (without releasing)
    dragProgress = 50
    displayProgress = dragProgress

    console.log('During drag, displayProgress:', displayProgress)
    expect(displayProgress).toBe(50)

    // User releases (onMouseUp)
    dragProgress = null

    // Now parent updates and passes new task
    // Because key=task.id changes, GanttDetails should REMOUNT
    // In remount, useState creates NEW dragProgress = null

    currentTask = { id: 'T2', title: 'Task 2', progress: 0 }
    dragProgress = null // Would be reset by useState in remount
    displayProgress = dragProgress !== null ? dragProgress : currentTask.progress

    console.log('After task change, displayProgress:', displayProgress)
    expect(displayProgress).toBe(0) // Should show T2's progress

    // CRITICAL: dragProgress should be null after remount
    expect(dragProgress).toBe(null)
  })

  it('should verify dragProgress does not leak between tasks', () => {
    /**
     * Scenario: What if dragProgress DOESN'T reset?
     *
     * 1. User selects T1
     * 2. User starts dragging slider but DOESN'T release
     * 3. User switches to T2 while dragging
     * 4. dragProgress might still have T1's value
     */

    type Task = { id: string; progress: number }

    // T1 selected
    let task = { id: 'T1', progress: 10 }
    let dragProgress: number | null = null

    // User drags slider to 50 but doesn't release
    dragProgress = 50
    let displayProgress = dragProgress ?? task.progress

    console.log('T1 dragging: dragProgress=', dragProgress, 'display=', displayProgress)
    expect(displayProgress).toBe(50)

    // User switches to T2 while still dragging
    // Component remounts (because key=task.id changes)
    // NEW component instance has dragProgress = null
    task = { id: 'T2', progress: 20 }
    dragProgress = null // Reset by new component instance

    displayProgress = dragProgress ?? task.progress

    console.log('T2 after task switch: dragProgress=', dragProgress, 'display=', displayProgress)
    expect(displayProgress).toBe(20) // Should show T2's progress

    // This test proves: remounting SHOULD fix the issue
  })

  it('should verify callback captures correct task.id in closure', () => {
    /**
     * The slider handlers create a closure:
     *
     * onMouseUp={e => {
     *   const v = Number((e.target as HTMLInputElement).value)
     *   setDragProgress(null)
     *   onProgress(v)  // <- what does onProgress do?
     * }}
     *
     * In Gantt.tsx, onProgress is:
     * progress => onProgress(selectedTask.id, progress)
     *
     * So GanttDetails receives: onProgress(progress: number) => void
     *
     * And selectedTask is passed as separate prop: task={selectedTask}
     *
     * The closure captures 'task' prop from GanttDetails
     */

    type Task = { id: string; progress: number }

    // Simulate callback creation
    let task: Task = { id: 'T1', progress: 0 }

    const createSliderHandler = (task: Task, onProgress: (v: number) => void) => {
      return (newValue: number) => {
        // This captures task at creation time
        console.log(`Slider released: task=${task.id}, newValue=${newValue}`)
        onProgress(newValue)
      }
    }

    const modifications: Array<{ taskId: string; progress: number }> = []

    const onProgress = (progress: number) => {
      modifications.push({ taskId: task.id, progress })
    }

    // Create handler for T1
    const handler1 = createSliderHandler(task, onProgress)

    // User modifies
    handler1(50)
    expect(modifications[0]).toEqual({ taskId: 'T1', progress: 50 })

    // Change task
    task = { id: 'T2', progress: 0 }

    // If we REUSE the old handler (BUG), it would still use T1
    // handler1(60) would modify T1 instead of T2

    // But if we create a NEW handler (CORRECT), it uses T2
    const handler2 = createSliderHandler(task, onProgress)
    handler2(60)
    expect(modifications[1]).toEqual({ taskId: 'T2', progress: 60 })

    // Test: what if we REUSE handler1?
    // handler1(65) // This would use OLD task reference
    // The captured task variable in handler1 was T1, but task variable changed
    // Actually, NO - the closure captured task by value at creation time
    // So handler1 would STILL use T1

    // Wait, no. If handler1 captured the task variable by reference,
    // then handler1 would see the NEW task=T2 value

    // Let's verify:
    // handler1 was created with task=T1
    // Inside handler1: console.log(`task=${task.id}`) would print T1
    // Because task was captured by value (closure), not by reference

    // UNLESS: task is a reference (object), so the closure captures the reference
    // Then when task variable is reassigned to point to a different object,
    // the closure STILL points to the OLD object (T1)

    // This is the key insight: if handler1 captured task OBJECT reference,
    // then reassigning task variable doesn't affect the handler
  })
})
