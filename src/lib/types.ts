export type Operation = { id: string; name: string; address: string | null; status: 'active' | 'archived'; created_at: string }
export type OperationForm = Pick<Operation, 'name' | 'address'>
export type UnitKind = 'building' | 'dwelling' | 'common_area' | 'exterior' | 'zone'
export type Unit = { id: string; operation_id: string; parent_id: string | null; kind: UnitKind; code: string | null; name: string; floor: string | null; sort_order: number }
export type Company = { id: string; operation_id: string; name: string; contact_name: string | null; email: string | null; phone: string | null }
export type Lot = { id: string; operation_id: string; number: string | null; code: string | null; name: string; company_id: string | null; weighting_method: 'simple' | 'weighted'; sort_order: number }
export type Visit = { id: string; operation_id: string; visited_at: string; title: string | null; note: string | null }
