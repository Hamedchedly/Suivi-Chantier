import { useState } from 'react'
import { CalendarClock, AlertTriangle } from 'lucide-react'
import type { ReservePriority } from '../../lib/reserves'
import { input, linkBtn, bigBtnInline } from './visiteStyles'

/**
 * The single form behind every remark — observation or action, freshly raised
 * or being corrected. Priority is simplified to normal vs. important (bold red).
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
  const [important, setImportant] = useState(initial?.priority === 'high')
  const isAction = kind === 'action'

  const handleSubmit = () => {
    onSubmit(text.trim(), due || undefined, isAction ? (important ? 'high' : 'low') : undefined)
  }

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
          <button
            onClick={() => setImportant(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px',
              padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              border: important ? '2px solid #dc2626' : '1px solid var(--line)',
              background: important ? '#fdecec' : '#fff',
              color: important ? '#dc2626' : 'var(--muted)', width: '100%',
            }}
          >
            <AlertTriangle size={14} />
            {important ? '⚡ Important — en gras rouge dans le CR' : 'Marquer comme important'}
          </button>
        </>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={linkBtn}>Annuler</button>
        <button disabled={!text.trim()} onClick={handleSubmit}
          style={{ ...bigBtnInline, background: isAction ? '#b45309' : 'var(--navy)', padding: '10px 15px', fontSize: '13px', opacity: text.trim() ? 1 : 0.5 }}>
          Enregistrer
        </button>
      </div>
    </div>
  )
}
