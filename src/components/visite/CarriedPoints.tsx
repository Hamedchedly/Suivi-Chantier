import { useState } from 'react'
import { AlertTriangle, Check, RotateCw, X, CalendarClock } from 'lucide-react'
import { Reserve, FollowUpStatus, latestFollow, isOverdue, reserveKind } from '../../lib/reserves'
import { badge, input, ghostBtn, sectionLabel, fmtFr, todayIso } from './visiteStyles'

interface Props {
  points: Reserve[]
  readOnly: boolean
  onFollowUp: (reserveId: string, status: FollowUpStatus, dueDate?: string) => void
}

const VERDICT: { s: FollowUpStatus; label: string; icon: React.ReactNode; fg: string; bg: string }[] = [
  { s: 'done', label: 'Levé', icon: <Check size={13} />, fg: '#15803d', bg: '#dcfce7' },
  { s: 'in_progress', label: 'En cours', icon: <RotateCw size={13} />, fg: '#0369a1', bg: '#e0f2fe' },
  { s: 'not_done', label: 'Non réalisé', icon: <X size={13} />, fg: '#b91c1c', bg: '#fee2e2' },
]

/**
 * What greets the user when walking back into a logement: everything raised in
 * earlier sessions that is still open, with one tap to settle it.
 */
export function CarriedPoints({ points, readOnly, onFollowUp }: Props) {
  if (points.length === 0) return null
  return (
    <div style={{ border: '1px solid #fcd34d', borderRadius: '10px', background: '#fffbeb', padding: '12px', marginBottom: '16px' }}>
      <div style={{ ...sectionLabel, color: '#b45309', marginBottom: '8px' }}>
        À vérifier — visites précédentes ({points.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {points.map(p => <PointRow key={p.id} point={p} readOnly={readOnly} onFollowUp={onFollowUp} />)}
      </div>
    </div>
  )
}

function PointRow({ point, readOnly, onFollowUp }: { point: Reserve; readOnly: boolean; onFollowUp: Props['onFollowUp'] }) {
  const [reschedule, setReschedule] = useState(false)
  const [due, setDue] = useState(point.dueDate ?? '')
  const last = latestFollow(point)
  const overdue = isOverdue(point, todayIso())

  return (
    <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid var(--line)', padding: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <AlertTriangle size={14} color={overdue ? '#dc2626' : '#f59e0b'} style={{ marginTop: '2px', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)' }}>
            {point.number} — {point.description}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {point.company && <span>{point.company}</span>}
            <span>Créé le {fmtFr(point.createdAt.split('T')[0])}</span>
            {point.dueDate && (
              <span style={{ color: overdue ? '#dc2626' : 'inherit', fontWeight: overdue ? 700 : 400 }}>
                Échéance {fmtFr(point.dueDate)}{overdue ? ' — dépassée' : ''}
              </span>
            )}
          </div>
          {last && (
            <div style={{ fontSize: '10px', color: '#5b7183', marginTop: '3px', fontStyle: 'italic' }}>
              Dernier constat ({fmtFr(last.visitDate)}) : {VERDICT.find(v => v.s === last.status)?.label ?? 'échéance reportée'}
            </div>
          )}
        </div>
        <span style={{ ...badge, background: reserveKind(point) === 'observation' ? '#eef2f6' : '#fef3c7', color: reserveKind(point) === 'observation' ? '#5b7183' : '#b45309' }}>
          {reserveKind(point) === 'observation' ? 'Observation' : 'Action'}
        </span>
      </div>

      {!readOnly && (
        <>
          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
            {VERDICT.map(v => (
              <button key={v.s} onClick={() => onFollowUp(point.id, v.s)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px 4px', borderRadius: '7px', border: `1px solid ${v.fg}33`, background: v.bg, color: v.fg, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                {v.icon} {v.label}
              </button>
            ))}
            <button onClick={() => setReschedule(r => !r)} title="Modifier l'échéance"
              style={{ ...ghostBtn, padding: '8px 10px' }}>
              <CalendarClock size={14} />
            </button>
          </div>

          {reschedule && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <input type="date" value={due} onChange={e => setDue(e.target.value)} style={{ ...input, flex: 1, padding: '6px 8px', fontSize: '12px' }} />
              <button disabled={!due} onClick={() => { onFollowUp(point.id, 'rescheduled', due); setReschedule(false) }}
                style={{ ...ghostBtn, opacity: due ? 1 : 0.5 }}>Reporter</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
