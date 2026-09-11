export type ReservePriority = 'low' | 'medium' | 'high'
export type ReserveStatus = 'open' | 'resolved'

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
}

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
