import { useState } from 'react'
import { Users, Building2, Trash2, Plus } from 'lucide-react'
import { VisitNote } from '../../lib/visits'
import { input, ghostBtn, sectionLabel, badge, bigBtnInline } from './visiteStyles'
import { Empty } from './visiteBits'

interface Props {
  notes: VisitNote[]
  companies: string[]
  readOnly: boolean
  onAdd: (note: VisitNote) => void
  onRemove: (id: string) => void
}

/** Closing notes: addressed to everyone, or to one specific company. */
export function SessionNotes({ notes, companies, readOnly, onAdd, onRemove }: Props) {
  const [target, setTarget] = useState('all')
  const [text, setText] = useState('')

  const submit = () => {
    const body = text.trim()
    if (!body) return
    onAdd({
      id: `n${Date.now()}`,
      scope: target === 'all' ? 'all' : 'company',
      company: target === 'all' ? undefined : target,
      text: body,
      createdAt: new Date().toISOString(),
    })
    setText('')
  }

  const general = notes.filter(n => n.scope === 'all')
  const byCompany = companies
    .map(c => ({ company: c, list: notes.filter(n => n.scope === 'company' && n.company === c) }))
    .filter(g => g.list.length > 0)

  return (
    <div>
      {!readOnly && (
        <div style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginBottom: '16px', background: '#fff' }}>
          <div style={sectionLabel}>Nouvelle note</div>
          <select value={target} onChange={e => setTarget(e.target.value)} style={{ ...input, width: '100%', marginBottom: '8px' }}>
            <option value="all">Pour tout le monde</option>
            {companies.map(c => <option key={c} value={c}>Pour {c}</option>)}
          </select>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="ex. Livraison des menuiseries à confirmer avant vendredi"
            style={{ ...input, width: '100%', minHeight: '64px', resize: 'vertical', marginBottom: '8px' }}
          />
          <button onClick={submit} disabled={!text.trim()} style={{ ...bigBtnInline, width: '100%', background: 'var(--navy)', opacity: text.trim() ? 1 : 0.5 }}>
            <Plus size={15} /> Ajouter la note
          </button>
        </div>
      )}

      <div style={sectionLabel}>Pour tout le monde ({general.length})</div>
      {general.length === 0 ? <Empty>Aucune note générale.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {general.map(n => <NoteRow key={n.id} note={n} icon={<Users size={14} color="#0369a1" />} readOnly={readOnly} onRemove={onRemove} />)}
        </div>
      )}

      {byCompany.map(g => (
        <div key={g.company} style={{ marginTop: '10px' }}>
          <div style={sectionLabel}>Pour {g.company} ({g.list.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {g.list.map(n => <NoteRow key={n.id} note={n} icon={<Building2 size={14} color="#6d28d9" />} readOnly={readOnly} onRemove={onRemove} />)}
          </div>
        </div>
      ))}

      {!readOnly && companies.length === 0 && (
        <Empty>Aucune entreprise identifiée sur les lots de cette session — les notes ciblées seront disponibles dès qu'un lot sera contrôlé.</Empty>
      )}
    </div>
  )
}

function NoteRow({ note, icon, readOnly, onRemove }: { note: VisitNote; icon: React.ReactNode; readOnly: boolean; onRemove: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}>
      <span style={{ marginTop: '1px' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: '12px', color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{note.text}</span>
      {note.scope === 'company' && <span style={{ ...badge, background: '#ede9fe', color: '#6d28d9' }}>{note.company}</span>}
      {!readOnly && (
        <button onClick={() => onRemove(note.id)} title="Supprimer" style={{ ...ghostBtn, padding: '4px 6px', border: 'none' }}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}
