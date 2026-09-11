import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import type { ReservePriority } from '../../lib/reserves'
import { input, linkBtn, bigBtnInline } from './visiteStyles'

const PRIORITIES: { p: ReservePriority; label: string; color: string }[] = [
  { p: 'low', label: 'Faible', color: '#5b7183' },
  { p: 'medium', label: 'Moyenne', color: '#b45309' },
  { p: 'high', label: 'Haute', color: '#dc2626' },
]

/**
 * The single form behind every remark — observation or action, freshly raised
 * or being corrected. One shape to learn instead of four.
 */
export function RemarkForm({ kind, company, initial, onSubmit, onCancel }: {
  kind: 'observation' | 'action'
  company?: string
  initial?: { description: string; dueDate?: string; priority?: ReservePriority }
  onSubmit: (description: string, dueDate: string | undefined, priority: ReservePriority | undefined) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initial?.description ?? '')
  const [due, setDue] = useState(initial?.dueDate ?? '')
  const [priority, setPriority] = useState<ReservePriority>(initial?.priority ?? 'medium')
  const isAction = kind === 'action'

  return (
    <div style={{
      marginTop: '4px', padding: '11px', borderRadius: '10px',
      border: `1px solid ${isAction ? '#fcd34d' : 'var(--line)'}`,
      background: isAction ? '#fffbeb' : '#f8fafc',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: isAction ? '#b45309' : '#5b7183', marginBottom: '7px' }}>
        {isAction ? `Action à réaliser${company ? ` — ${company}` : ''}` : 'Observation'}
      </div>

      <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
        placeholder={isAction ? 'ex. Reprendre le joint avant la prochaine visite' : 'ex. Joint fissuré autour de la menuiserie'}
        style={{ ...input, width: '100%', minHeight: '56px', resize: 'vertical', marginBottom: '8px' }} />

      {isAction && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <CalendarClock size={14} color="var(--muted)" />
            <input type="date" value={due} onChange={e => setDue(e.target.value)} title="Échéance"
              style={{ ...input, flex: 1, padding: '8px 9px' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {PRIORITIES.map(({ p, label, color }) => (
              <button key={p} onClick={() => setPriority(p)}
                style={{
                  flex: 1, padding: '9px', borderRadius: '7px', background: '#fff', color,
                  border: priority === p ? `2px solid ${color}` : '1px solid var(--line)',
                  fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                }}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={linkBtn}>Annuler</button>
        <button disabled={!text.trim()} onClick={() => onSubmit(text.trim(), due || undefined, isAction ? priority : undefined)}
          style={{ ...bigBtnInline, background: isAction ? '#b45309' : 'var(--navy)', padding: '10px 15px', fontSize: '13px', opacity: text.trim() ? 1 : 0.5 }}>
          Enregistrer
        </button>
      </div>
    </div>
  )
}
