import { supabase } from './supabase'
import type { Company, Lot, ProgressEntry, Task, TaskValues, Unit, Visit } from './types'

function db() { if (!supabase) throw new Error('Supabase n’est pas configuré.'); return supabase }
export async function operationData(operationId: string) {
  const [units, companies, lots, assignments] = await Promise.all([
    db().from('operation_units').select('*').eq('operation_id', operationId).order('sort_order'),
    db().from('companies').select('*').eq('operation_id', operationId).order('name'),
    db().from('lots').select('*').eq('operation_id', operationId).order('sort_order'),
    db().from('lot_assignments').select('*').eq('operation_id', operationId)
  ])
  for (const result of [units, companies, lots, assignments]) if (result.error) throw result.error
  return { units: units.data as Unit[], companies: companies.data as Company[], lots: lots.data as Lot[], assignments: assignments.data as { lot_id: string; unit_id: string | null; scope: string }[] }
}
export async function addUnit(operation_id: string, values: Pick<Unit, 'kind' | 'code' | 'name' | 'floor' | 'parent_id' | 'sort_order'>) { const { error } = await db().from('operation_units').insert({ operation_id, ...values }); if (error) throw error }
export async function addCompany(operation_id: string, values: Pick<Company, 'name' | 'contact_name' | 'email' | 'phone'>) { const { error } = await db().from('companies').insert({ operation_id, ...values }); if (error) throw error }
export async function addLot(operation_id: string, values: Pick<Lot, 'number' | 'name' | 'company_id' | 'sort_order'>) { const { error } = await db().from('lots').insert({ operation_id, ...values }); if (error) throw error }
export async function setAssignment(operation_id: string, lot_id: string, unit_id: string | null, scope: string, assigned: boolean) {
  if (assigned) { const { error } = await db().from('lot_assignments').upsert({ operation_id, lot_id, unit_id, scope }, { onConflict: 'lot_id,unit_id' }); if (error) throw error }
  else { const query = db().from('lot_assignments').delete().eq('operation_id', operation_id).eq('lot_id', lot_id); const { error } = unit_id ? await query.eq('unit_id', unit_id) : await query.is('unit_id', null); if (error) throw error }
}
export async function effectiveAssignments(unitId: string) { const { data, error } = await db().rpc('effective_lot_assignments', { target_unit: unitId }); if (error) throw error; return data as { lot_id: string; enabled: boolean; source: 'specific' | 'inherited' }[] }
export async function startVisit(operation_id: string, values: Pick<Visit, 'title' | 'note'>) { const { data, error } = await db().from('visits').insert({ operation_id, ...values }).select().single(); if (error) throw error; return data as Visit }
export async function addProgress(operation_id: string, visit_id: string, unit_id: string | null, lot_id: string, task_id: string | null, percentage: number | null, status: string, comment: string) { const { error } = await db().from('progress_entries').insert({ operation_id, visit_id, unit_id, lot_id, task_id, percentage, status, comment }); if (error) throw error }

export async function listTasks(operation_id: string, lot_id: string): Promise<Task[]> {
  const { data, error } = await db().from('tasks').select('id, operation_id, lot_id, parent_id, reference, name, section, unit, quantity, unit_price, amount, weight, task_type, sort_order, unit_id').eq('operation_id', operation_id).eq('lot_id', lot_id).order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as Task[]
}

export async function addTask(operation_id: string, lot_id: string, values: TaskValues): Promise<Task> {
  const { data, error } = await db().from('tasks').insert({
    operation_id,
    lot_id,
    task_type: values.task_type,
    name: values.name,
    reference: values.reference ?? null,
    section: values.section ?? null,
    unit: values.unit ?? null,
    quantity: values.quantity ?? null,
    unit_price: values.unit_price ?? null,
    amount: values.amount ?? null,
    parent_id: values.parent_id ?? null,
    unit_id: values.unit_id ?? null,
    sort_order: values.sort_order ?? 0,
    weight: values.task_type === 'section' ? 0 : undefined
  }).select('id, operation_id, lot_id, parent_id, reference, name, section, unit, quantity, unit_price, amount, weight, task_type, sort_order, unit_id').single()
  if (error) throw error
  return data as Task
}

export async function moveTask(operation_id: string, task_id: string, direction: -1 | 1, tasks: Task[]): Promise<void> {
  const index = tasks.findIndex((task) => task.id === task_id)
  const neighbor = tasks[index + direction]
  if (!neighbor) return
  const current = tasks[index]
  await db().from('tasks').update({ sort_order: neighbor.sort_order }).eq('id', current.id).eq('operation_id', operation_id)
  await db().from('tasks').update({ sort_order: current.sort_order }).eq('id', neighbor.id).eq('operation_id', operation_id)
}

export async function listTasksByOperation(operation_id: string): Promise<Task[]> {
  const { data, error } = await db().from('tasks').select('id, operation_id, lot_id, parent_id, reference, name, section, unit, quantity, unit_price, amount, weight, task_type, sort_order, unit_id').eq('operation_id', operation_id).order('lot_id', { ascending: true }).order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as Task[]
}

export async function lastProgressForUnit(operation_id: string, unit_id: string): Promise<ProgressEntry[]> {
  const { data, error } = await db().from('progress_entries').select('id, operation_id, visit_id, unit_id, lot_id, task_id, progressed_at, percentage, status, comment, created_at, created_by').eq('operation_id', operation_id).or(`unit_id.eq.${unit_id},unit_id.is.null`).order('progressed_at', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProgressEntry[]
}
