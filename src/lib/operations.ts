import { supabase } from './supabase'
import type { Operation, OperationForm } from './types'

function client() {
  if (!supabase) throw new Error('Supabase n’est pas configuré.')
  return supabase
}

export async function listOperations(): Promise<Operation[]> {
  const { data, error } = await client().from('operations').select('*').eq('status', 'active').order('created_at', { ascending: false })
  if (error) throw error
  return data as Operation[]
}

export async function createOperation(values: OperationForm): Promise<Operation> {
  const { data, error } = await client().from('operations').insert(values).select().single()
  if (error) throw error
  return data as Operation
}
