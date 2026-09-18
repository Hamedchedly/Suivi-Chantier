export type ReservePriority = 'low' | 'medium' | 'high'
/** open : en cours ; resolved : traité ; obsolete : plus valable (annulé). */
export type ReserveStatus = 'open' | 'resolved' | 'obsolete'

/**
 * An "observation" is a plain finding (joint fissuré…); an "action" is
 * something someone must DO by a date. They share a context and a history but
 * must not be mixed in the CR. Legacy reserves have no kind → treated as actions.
 */
export type ReserveKind = 'observation' | 'action'

/**
 * Ce qu'une réunion/visite ultérieure conclut sur un point.
 * - done : terminé ; in_progress/not_done : constat ; rescheduled : reporté (nouvelle échéance) ;
 * - obsolete : plus valable ; comment : simple réponse/commentaire (statut inchangé).
 */
export type FollowUpStatus = 'done' | 'in_progress' | 'not_done' | 'rescheduled' | 'obsolete' | 'comment'

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
  // ── Contexte « compte rendu » (tableau CR / import Excel) ──
  crNo?: number          // n° du CR (= une réunion/visite)
  meetingDate?: string   // ISO yyyy-mm-dd — date de la réunion/visite du CR
  reminder?: boolean     // rappel / mémo important → mis en évidence (rouge)
  archived?: boolean     // archived items are hidden by default
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
 * re-opened point keeps every previous verdict. Un simple commentaire ('comment')
 * ne change pas le statut ; 'obsolete' rend le point non valable.
 */
export function applyFollowUp(r: Reserve, f: FollowUp): Reserve {
  const status: ReserveStatus =
    f.status === 'done' ? 'resolved'
      : f.status === 'obsolete' ? 'obsolete'
        : f.status === 'comment' ? r.status
          : 'open'
  return {
    ...r,
    status,
    dueDate: f.status === 'rescheduled' && f.dueDate ? f.dueDate : r.dueDate,
    follow: [...(r.follow ?? []), f],
  }
}

/** An action is overdue once its deadline has passed and it is still open. */
export function isOverdue(r: Reserve, today: string): boolean {
  return r.status === 'open' && !!r.dueDate && r.dueDate < today
}

/** A-t-on reporté ce point à une échéance encore future ? (affiché en orange) */
export function isReported(r: Reserve, today: string): boolean {
  const last = latestFollow(r)
  return r.status === 'open' && last?.status === 'rescheduled' && !!r.dueDate && r.dueDate >= today
}

/** Ton visuel d'un point de CR + s'il a été évoqué à la dernière réunion. */
export type CrTone = 'normal' | 'reminder' | 'overdue' | 'reported' | 'done' | 'obsolete'
export function crState(
  r: Reserve, today: string, latestMeetingDate?: string,
): { tone: CrTone; lastMeeting: boolean } {
  const lastMeeting = !!r.meetingDate && !!latestMeetingDate && r.meetingDate === latestMeetingDate
  let tone: CrTone = 'normal'
  if (r.status === 'resolved') tone = 'done'
  else if (r.status === 'obsolete') tone = 'obsolete'
  else if (isOverdue(r, today)) tone = 'overdue'
  // Un point reporté à une échéance future passe en orange (« en attente »),
  // même s'il s'agissait d'un rappel — jusqu'à ce que l'échéance soit dépassée.
  else if (isReported(r, today)) tone = 'reported'
  else if (r.reminder) tone = 'reminder'
  return { tone, lastMeeting }
}
