import { supabase } from './supabase'
import type { Company, Lot, Observation, ObservationEvent, ObservationHistory, OperationMember, ProgressEntry, ScheduleItem, Task, TaskValues, Unit, Visit } from './types'

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
  const { data, error } = await db().from('tasks').select('id, operation_id, lot_id, parent_id, reference, name, section, unit, quantity, unit_price, amount, weight, task_type, sort_order, unit_id, import_id, source_sheet').eq('operation_id', operation_id).order('lot_id', { ascending: true }).order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as Task[]
}

export async function listScheduleItems(operation_id: string): Promise<ScheduleItem[]> {
  const { data, error } = await db().from('schedule_items').select('id, operation_id, lot_id, task_id, unit_id, parent_id, title, planned_start, planned_end, planned_duration, actual_start, actual_end, progress, status, notes, sort_order').eq('operation_id', operation_id).order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as ScheduleItem[]
}

export async function listProgressByOperation(operation_id: string): Promise<ProgressEntry[]> {
  const { data, error } = await db().from('progress_entries').select('id, operation_id, visit_id, unit_id, lot_id, task_id, progressed_at, percentage, status, comment, created_at, created_by').eq('operation_id', operation_id).order('progressed_at', { ascending: true }).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProgressEntry[]
}

export async function listObservationsByOperation(operation_id: string): Promise<Observation[]> {
  const { data, error } = await db().from('observations').select('id, operation_id, unit_id, lot_id, task_id, status, title, detail, priority, due_date, responsible_user_id, created_at, created_by').eq('operation_id', operation_id).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Observation[]
}

export async function listObservationEvents(observationIds: string[]): Promise<ObservationEvent[]> {
  if (observationIds.length === 0) return []
  const { data, error } = await db().from('observation_events').select('id, observation_id, visit_id, status, note, occurred_at, created_by').in('observation_id', observationIds).order('occurred_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ObservationEvent[]
}

export async function createObservation(values: {
  operation_id: string
  unit_id?: string | null
  lot_id?: string | null
  task_id?: string | null
  title: string
  detail?: string | null
  priority?: string | null
  due_date?: string | null
  status?: string
}): Promise<Observation> {
  const { data, error } = await db().from('observations').insert({
    operation_id: values.operation_id,
    unit_id: values.unit_id ?? null,
    lot_id: values.lot_id ?? null,
    task_id: values.task_id ?? null,
    title: values.title,
    detail: values.detail ?? null,
    priority: values.priority ?? 'normal',
    due_date: values.due_date ?? null,
    status: values.status ?? 'new'
  }).select('id, operation_id, unit_id, lot_id, task_id, status, title, detail, priority, due_date, responsible_user_id, created_at, created_by').single()
  if (error) throw error
  return data as Observation
}

export async function createObservationEvent(values: { observation_id: string; visit_id?: string | null; status?: string | null; note?: string | null }): Promise<ObservationEvent> {
  const { data, error } = await db().from('observation_events').insert({
    observation_id: values.observation_id,
    visit_id: values.visit_id ?? null,
    status: values.status ?? null,
    note: values.note ?? null
  }).select('id, observation_id, visit_id, status, note, occurred_at, created_by').single()
  if (error) throw error
  return data as ObservationEvent
}

export async function updateObservationStatus(operation_id: string, observation_id: string, status: string): Promise<void> {
  const { error } = await db().from('observations').update({ status }).eq('id', observation_id).eq('operation_id', operation_id)
  if (error) throw error
}

export async function getObservation(operation_id: string, observation_id: string): Promise<Observation | null> {
  const { data, error } = await db().from('observations').select('id, operation_id, unit_id, lot_id, task_id, status, title, detail, priority, due_date, responsible_user_id, created_at, created_by').eq('id', observation_id).eq('operation_id', operation_id).maybeSingle()
  if (error) throw error
  return (data as Observation | null) ?? null
}

export async function updateObservation(operation_id: string, observation_id: string, patch: { title?: string; detail?: string | null; priority?: string; due_date?: string | null }): Promise<Observation> {
  const { data, error } = await db().from('observations').update(patch).eq('id', observation_id).eq('operation_id', operation_id).select('id, operation_id, unit_id, lot_id, task_id, status, title, detail, priority, due_date, responsible_user_id, created_at, created_by').single()
  if (error) throw error
  return data as Observation
}

export async function listObservationHistory(observation_id: string): Promise<ObservationHistory[]> {
  const { data, error } = await db().from('observation_history').select('id, observation_id, changed_at, changed_by, action, snapshot').eq('observation_id', observation_id).order('changed_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ObservationHistory[]
}

export async function listOperationMembers(operation_id: string): Promise<OperationMember[]> {
  const { data, error } = await db().from('operation_members').select('operation_id, user_id, role').eq('operation_id', operation_id)
  if (error) throw error
  return (data ?? []) as OperationMember[]
}

export async function lastProgressForUnit(operation_id: string, unit_id: string): Promise<ProgressEntry[]> {
  const { data, error } = await db().from('progress_entries').select('id, operation_id, visit_id, unit_id, lot_id, task_id, progressed_at, percentage, status, comment, created_at, created_by').eq('operation_id', operation_id).or(`unit_id.eq.${unit_id},unit_id.is.null`).order('progressed_at', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProgressEntry[]
}
