import { describe, expect, it } from 'vitest'
import { ancestorChain, filterApplicableTasks, isTaskApplicable } from './scope'
import type { Task, Unit } from './types'

const units: Unit[] = [
  { id: 'op', operation_id: 'o', parent_id: null, kind: 'building', code: null, name: 'OP', floor: null, sort_order: 0 },
  { id: 'b1', operation_id: 'o', parent_id: null, kind: 'building', code: 'A', name: 'Bâtiment A', floor: null, sort_order: 1 },
  { id: 'l1', operation_id: 'o', parent_id: 'b1', kind: 'dwelling', code: '1', name: 'Logement 1', floor: 'RDC', sort_order: 2 },
  { id: 'c1', operation_id: 'o', parent_id: null, kind: 'common_area', code: 'C', name: 'Cave', floor: null, sort_order: 3 }
]

const task = (unitId: string | null): Task => ({
  id: Math.random().toString(),
  operation_id: 'o',
  lot_id: 'lot',
  parent_id: null,
  reference: null,
  name: 'Tâche',
  section: null,
  unit: null,
  quantity: null,
  unit_price: null,
  amount: null,
  weight: 1,
  task_type: 'item',
  sort_order: 0,
  unit_id: unitId
})

describe('ancestorChain', () => {
  it('walks up to the root unit', () => {
    expect(ancestorChain('l1', units)).toEqual(['l1', 'b1'])
  })
})

describe('isTaskApplicable', () => {
  it('keeps a general task without unit_id usable everywhere', () => {
    expect(isTaskApplicable(task(null), 'l1', units)).toBe(true)
    expect(isTaskApplicable(task(null), 'c1', units)).toBe(true)
  })
  it('applies a task linked to the building to its dwellings', () => {
    expect(isTaskApplicable(task('b1'), 'l1', units)).toBe(true)
  })
  it('applies a task linked to the unit itself', () => {
    expect(isTaskApplicable(task('l1'), 'l1', units)).toBe(true)
  })
  it('does not apply an unrelated localised task', () => {
    expect(isTaskApplicable(task('b1'), 'c1', units)).toBe(false)
    expect(isTaskApplicable(task('l1'), 'c1', units)).toBe(false)
  })
})

describe('filterApplicableTasks', () => {
  it('keeps general and inherited tasks for a dwelling', () => {
    const tasks = [task(null), task('b1'), task('l1'), task('c1')]
    expect(filterApplicableTasks(tasks, 'l1', units)).toHaveLength(3)
  })
})