// Task applicability helpers: a task with no unit_id is general to its lot and
// always applicable; a task linked to a unit also applies to its descendants.

import type { Task, Unit } from './types'

export function ancestorChain(unitId: string, units: Unit[]): string[] {
  const chain: string[] = []
  let current: string | null = unitId
  let hops = 0
  while (current && hops <= units.length) {
    chain.push(current)
    const unit = units.find((candidate) => candidate.id === current)
    current = unit?.parent_id ?? null
    hops++
  }
  return chain
}

export function isTaskApplicable(task: Pick<Task, 'unit_id'>, unitId: string, units: Unit[]): boolean {
  if (task.unit_id === null) return true
  return ancestorChain(unitId, units).includes(task.unit_id)
}

export function filterApplicableTasks(tasks: Task[], unitId: string, units: Unit[]): Task[] {
  const chain = new Set(ancestorChain(unitId, units))
  return tasks.filter((task) => task.unit_id === null || chain.has(task.unit_id))
}