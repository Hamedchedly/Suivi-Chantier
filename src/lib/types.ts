export type OperationStatus = 'preparation' | 'consultation' | 'travaux' | 'opr' | 'reception' | 'levee_reserves' | 'cloturee' | 'archived' | 'active'
export type OperationType = 'entreprise_generale' | 'lots_separes'

export type Operation = {
  id: string
  name: string
  address: string | null
  reference_interne: string | null
  moa: string | null
  moe: string | null
  amo: string | null
  start_date: string | null
  contractual_end_date: string | null
  budget_global: number | null
  operation_type: OperationType
  status: OperationStatus
  created_at: string
  created_by: string
}

export type OperationForm = Pick<Operation, 'name' | 'address' | 'reference_interne' | 'moa' | 'moe' | 'amo' | 'start_date' | 'contractual_end_date' | 'budget_global' | 'operation_type' | 'status'>
export type UnitKind = 'building' | 'dwelling' | 'common_area' | 'exterior' | 'zone'
export type Unit = { id: string; operation_id: string; parent_id: string | null; kind: UnitKind; code: string | null; name: string; floor: string | null; sort_order: number }
export type Company = { id: string; operation_id: string; name: string; contact_name: string | null; email: string | null; phone: string | null }
export type LotStatus = 'actif' | 'suspendu' | 'termine' | 'resilie'

export type Lot = {
  id: string
  operation_id: string
  number: string | null
  code: string | null
  name: string
  company_id: string | null
  weighting_method: 'simple' | 'weighted'
  amount_contract_ht: number | null
  responsible_name: string | null
  lot_status: LotStatus
  sort_order: number
}
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
  import_id?: string | null
  source_sheet?: string | null
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
  responsible_user_id: string | null
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

export type ObservationHistory = {
  id: string
  observation_id: string
  changed_at: string
  changed_by: string | null
  action: string
  snapshot: Record<string, unknown>
}

export type OperationMember = {
  operation_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
}

export type ScheduleStatus = 'not_started' | 'in_progress' | 'done' | 'blocked' | 'postponed' | 'cancelled'
export type Priority = 'low' | 'normal' | 'high' | 'critical'
export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'

export type ScheduleItem = {
  id: string
  operation_id: string
  lot_id: string | null
  task_id: string | null
  unit_id: string | null
  parent_id: string | null
  company_id: string | null
  responsible_user_id: string | null
  title: string
  wbs_code: string | null
  planned_start: string | null
  planned_end: string | null
  planned_duration: number | null
  actual_start: string | null
  actual_end: string | null
  actual_duration: number | null
  progress: number | null
  status: ScheduleStatus | null
  priority: Priority
  is_milestone: boolean
  is_critical: boolean
  baseline_start: string | null
  baseline_end: string | null
  early_start: string | null
  early_finish: string | null
  late_start: string | null
  late_finish: string | null
  total_float: number | null
  free_float: number | null
  notes: string | null
  sort_order: number
}

export type ScheduleDependency = {
  schedule_item_id: string
  predecessor_id: string
  dependency_type: DependencyType
  lag_days: number
}

export type ScheduleBaseline = {
  id: string
  operation_id: string
  name: string
  notes: string | null
  created_at: string
  created_by: string | null
}

export type ScheduleBaselineItem = {
  id: string
  baseline_id: string
  schedule_item_id: string
  title: string
  planned_start: string | null
  planned_end: string | null
  planned_duration: number | null
}

export type ScheduleCalendar = {
  id: string
  operation_id: string
  name: string
  work_saturday: boolean
  work_sunday: boolean
  created_at: string
}

export type ScheduleCalendarException = {
  id: string
  calendar_id: string
  exception_date: string
  is_working: boolean
  label: string | null
}

export type Reserve = {
  id: string
  operation_id: string
  number: string
  unit_id: string | null
  lot_id: string | null
  schedule_item_id: string | null
  title: string
  description: string | null
  priority: Priority
  responsible_user_id: string | null
  company_id: string | null
  due_date: string | null
  status: 'open' | 'in_progress' | 'declared_resolved' | 'to_verify' | 'validated' | 'rejected'
  resolved_at: string | null
  resolution_proof: string | null
  created_at: string
  created_by: string | null
}
