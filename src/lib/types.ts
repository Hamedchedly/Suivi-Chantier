export type Operation = { id: string; name: string; address: string | null; status: 'active' | 'archived'; created_at: string }
export type OperationForm = Pick<Operation, 'name' | 'address'>
export type UnitKind = 'building' | 'dwelling' | 'common_area' | 'exterior' | 'zone'
export type Unit = { id: string; operation_id: string; parent_id: string | null; kind: UnitKind; code: string | null; name: string; floor: string | null; sort_order: number }
export type Company = { id: string; operation_id: string; name: string; contact_name: string | null; email: string | null; phone: string | null }
export type Lot = { id: string; operation_id: string; number: string | null; code: string | null; name: string; company_id: string | null; weighting_method: 'simple' | 'weighted'; sort_order: number }
export type TaskKind = 'section' | 'item'

export type Task = {
  id: string
  operation_id: string
  lot_id: string
  parent_id: string | null
  reference: string | null
  name: string
  section: string | null
  unit: string | null
  quantity: number | null
  unit_price: number | null
  amount: number | null
  weight: number
  task_type: TaskKind
  sort_order: number
  unit_id: string | null
}

export type TaskValues = {
  task_type: TaskKind
  name: string
  reference?: string | null
  section?: string | null
  unit?: string | null
  quantity?: number | null
  unit_price?: number | null
  amount?: number | null
  parent_id?: string | null
  unit_id?: string | null
  sort_order?: number
}

export type Visit = { id: string; operation_id: string; visited_at: string; title: string | null; note: string | null }

export type ProgressStatus =
  | 'not_started'
  | 'in_progress'
  | 'done'
  | 'blocked'
  | 'postponed'
  | 'not_applicable'

export type ProgressEntry = {
  id: string
  operation_id: string
  visit_id: string | null
  unit_id: string | null
  lot_id: string
  task_id: string | null
  progressed_at: string
  percentage: number | null
  status: string | null
  comment: string | null
  created_at: string
  created_by: string | null
}

export type Observation = {
  id: string
  operation_id: string
  unit_id: string | null
  lot_id: string | null
  task_id: string | null
  status: string
  title: string
  detail: string | null
  priority: string | null
  due_date: string | null
  created_at: string
  created_by: string | null
}

export type ObservationEvent = {
  id: string
  observation_id: string
  visit_id: string | null
  status: string | null
  note: string | null
  occurred_at: string
  created_by: string | null
}
