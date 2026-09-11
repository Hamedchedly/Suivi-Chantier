// Shared labels, badge metadata and inline styles for the Visite module.
// No components here on purpose — keeps React Fast Refresh happy (see visiteBits).
import type { ZoneState, VisitStatus, VisitKind } from '../../lib/visits'
import type { ReservePriority } from '../../lib/reserves'
import type { LotContact } from '../../lib/repo'

// ── Labels ───────────────────────────────────────────────────────────────────

/** "LOT 05 - Menuiseries int. / Isolation" → "Menuiseries int. / Isolation" */
export function lotLabel(lots: LotContact[], lotId: string): string {
  const name = lots.find(l => l.id === lotId)?.name
  return name ? name.replace(/^LOT\s*\d+\s*-\s*/, '') : lotId
}

export function lotCompany(lots: LotContact[], lotId: string): string | undefined {
  return lots.find(l => l.id === lotId)?.company
}

export const fmtFr = (iso?: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return d ? `${d}/${m}/${y}` : iso
}

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`
}

// ── Meta ─────────────────────────────────────────────────────────────────────

export const ZONE_META: Record<ZoneState, { label: string; dot: string; bg: string; fg: string }> = {
  not_started: { label: 'Non commencé', dot: '#cbd5e1', bg: '#f1f5f9', fg: '#64748b' },
  in_progress: { label: 'En cours', dot: '#0284c7', bg: '#e0f2fe', fg: '#0369a1' },
  done: { label: 'Terminé', dot: '#16a34a', bg: '#dcfce7', fg: '#15803d' },
  to_review: { label: 'À revoir', dot: '#f59e0b', bg: '#fef3c7', fg: '#b45309' },
  blocked: { label: 'Bloqué', dot: '#dc2626', bg: '#fee2e2', fg: '#b91c1c' },
}

export const STATUS_META: Record<VisitStatus, { label: string; bg: string; fg: string }> = {
  en_cours: { label: 'En cours', bg: '#e0f2fe', fg: '#0369a1' },
  terminee: { label: 'Terminée', bg: '#f1f5f9', fg: '#475569' },
  cr_pret: { label: 'CR prêt', bg: '#fef3c7', fg: '#b45309' },
  diffuse: { label: 'Diffusé', bg: '#dcfce7', fg: '#15803d' },
  verrouille: { label: 'Verrouillé', bg: '#ede9fe', fg: '#6d28d9' },
}

export const KIND_META: Record<VisitKind, { label: string; short: string; bg: string; fg: string }> = {
  visite: { label: 'Visite de chantier', short: 'Visite', bg: '#e0f2fe', fg: '#0369a1' },
  reunion: { label: 'Réunion de chantier', short: 'Réunion', bg: '#ede9fe', fg: '#6d28d9' },
  technique: { label: 'Visite technique', short: 'Technique', bg: '#dcfce7', fg: '#15803d' },
  opl: { label: 'OPL / pré-réception', short: 'OPL', bg: '#fef3c7', fg: '#b45309' },
}

export const PRIORITY_META: Record<ReservePriority, { label: string; bg: string; fg: string }> = {
  low: { label: 'Faible', bg: '#eef2f6', fg: '#5b7183' },
  medium: { label: 'Moyenne', bg: '#fef3c7', fg: '#b45309' },
  high: { label: 'Haute', bg: '#fdecec', fg: '#dc2626' },
}

// ── Styles ───────────────────────────────────────────────────────────────────

export const bigBtn: React.CSSProperties = { width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px' }
export const bigBtnInline: React.CSSProperties = { padding: '11px 16px', borderRadius: '10px', border: 'none', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }
export const sectionLabel: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }
export const visitCard: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', width: '100%', textAlign: 'left' }
export const zoneRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', width: '100%' }
export const badge: React.CSSProperties = { padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }
export const input: React.CSSProperties = { padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }
export const ghostBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', color: 'var(--navy)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }
export const linkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', background: 'none', color: 'var(--navy-2)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0 }
export const navBtn: React.CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '11px', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff', color: 'var(--navy)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
export const thumbBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,.92)', color: '#02457A', cursor: 'pointer' }
export const pill = (on: boolean, fg: string, bg: string): React.CSSProperties => ({ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px 6px', borderRadius: '8px', border: on ? `2px solid ${fg}` : '1px solid var(--line)', background: on ? bg : '#fff', color: on ? fg : 'var(--muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' })

// Report styles
export const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '12px' }
export const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', background: '#f8fafc', borderBottom: '1px solid #e4ecf2', color: '#02457A', fontSize: '11px' }
export const tdStyle: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #eef2f6' }
export const pStyle: React.CSSProperties = { fontSize: '12px', color: '#5b7183', margin: 0, whiteSpace: 'pre-wrap' }
