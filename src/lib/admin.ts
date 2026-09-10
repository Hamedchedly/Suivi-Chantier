// Administrative documents: RFI (demandes d'information), VISA (submittals),
// GED (document library). Pure helpers only.

export type RfiStatus = 'open' | 'answered'
export type VisaStatus = 'pending' | 'approved' | 'approved_reserves' | 'rejected'

export interface Rfi {
  id: string
  ref: string // DI-001
  subject: string
  lotId: string
  question: string
  answer?: string
  status: RfiStatus
  createdAt: string // ISO
}

export interface Visa {
  id: string
  docName: string
  index: string // indice A, B, C…
  lotId: string
  status: VisaStatus
  date: string // ISO
}

export interface Doc {
  id: string
  name: string
  category: string
  version: string
  date: string // ISO
  sizeKb: number
}

/** Next sequential RFI reference DI-00N. */
export function nextRfiRef(rfis: Rfi[]): string {
  const max = rfis.reduce((m, r) => {
    const n = parseInt(r.ref.replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `DI-${String(max + 1).padStart(3, '0')}`
}

export function countOpenRfis(rfis: Rfi[]): number {
  return rfis.filter(r => r.status === 'open').length
}

export function countPendingVisas(visas: Visa[]): number {
  return visas.filter(v => v.status === 'pending').length
}

/** Human file size from a KB count. */
export function fileSize(sizeKb: number): string {
  return sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${sizeKb} Ko`
}
