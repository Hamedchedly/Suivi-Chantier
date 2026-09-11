export type ReservePriority = 'low' | 'medium' | 'high'
export type ReserveStatus = 'open' | 'resolved'

/**
 * An "observation" is a plain finding (joint fissuré…); an "action" is
 * something someone must DO by a date. They share a context and a history but
 * must not be mixed in the CR. Legacy reserves have no kind → treated as actions.
 */
export type ReserveKind = 'observation' | 'action'

/** What a later visit concluded about an open action. */
export type FollowUpStatus = 'done' | 'in_progress' | 'not_done' | 'rescheduled'

export interface FollowUp {
  at: string              // ISO datetime
  visitId: string
  visitDate: string       // ISO yyyy-mm-dd
  status: FollowUpStatus
  dueDate?: string        // the new deadline when status === 'rescheduled'
  note?: string
}

export interface Reserve {
  id: string
  number: string // R-001
  lotId: string
  logementId: string
  description: string
  priority: ReservePriority
  status: ReserveStatus
  photo?: string // data URL (downscaled)
  createdAt: string // ISO
  visitId?: string // set when the reserve is a "point à revoir" raised during a visit
  company?: string // entreprise concernée (optional)
  kind?: ReserveKind // undefined = action (legacy reserves)
  taskId?: string // the planning task it was raised on
  dueDate?: string // ISO yyyy-mm-dd — échéance for an action
  follow?: FollowUp[] // what each later visit concluded, never overwritten
}

export const reserveKind = (r: Reserve): ReserveKind => r.kind ?? 'action'

/** Next sequential number R-00N based on existing reserves. */
export function nextReserveNumber(reserves: Reserve[]): string {
  const max = reserves.reduce((m, r) => {
    const n = parseInt(r.number.replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `R-${String(max + 1).padStart(3, '0')}`
}

export interface ReserveFilter {
  lotId?: string | null
  logementId?: string | null
  status?: ReserveStatus | 'all'
}

export function filterReserves(reserves: Reserve[], f: ReserveFilter): Reserve[] {
  return reserves.filter(r => {
    if (f.lotId && r.lotId !== f.lotId) return false
    if (f.logementId && r.logementId !== f.logementId) return false
    if (f.status && f.status !== 'all' && r.status !== f.status) return false
    return true
  })
}

export function countOpen(reserves: Reserve[]): number {
  return reserves.filter(r => r.status === 'open').length
}

// ── Carrying points over from one visit to the next ─────────────────────────

/**
 * Points still open in a zone that were raised BEFORE the current session —
 * exactly what must greet the user when walking into a logement again.
 */
export function carriedOverPoints(reserves: Reserve[], logementId: string, currentVisitId?: string): Reserve[] {
  return reserves.filter(r =>
    r.status === 'open' &&
    r.logementId === logementId &&
    r.visitId !== undefined &&
    r.visitId !== currentVisitId,
  )
}

export function latestFollow(r: Reserve): FollowUp | undefined {
  return r.follow && r.follow.length > 0 ? r.follow[r.follow.length - 1] : undefined
}

/**
 * Record what this visit concluded about a point. History is append-only: a
 * re-opened point keeps every previous verdict.
 */
export function applyFollowUp(r: Reserve, f: FollowUp): Reserve {
  return {
    ...r,
    status: f.status === 'done' ? 'resolved' : 'open',
    dueDate: f.status === 'rescheduled' && f.dueDate ? f.dueDate : r.dueDate,
    follow: [...(r.follow ?? []), f],
  }
}

/** An action is overdue once its deadline has passed and it is still open. */
export function isOverdue(r: Reserve, today: string): boolean {
  return r.status === 'open' && !!r.dueDate && r.dueDate < today
}
