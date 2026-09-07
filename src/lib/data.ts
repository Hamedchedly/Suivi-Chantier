import { supabase } from './supabase'
import type { Company, Lot, Unit, UnitKind, Visit } from './types'

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
