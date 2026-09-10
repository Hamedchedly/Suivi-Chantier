import { useState, useEffect } from 'react'
import { Plus, Check, RotateCcw, Users, Gavel, ChevronDown, ChevronRight } from 'lucide-react'
import { Meeting, MeetingAction, nextActionRef, overdueActions } from '../../lib/meetings'
import { getMeetings, saveMeetings, logActivity } from '../../lib/repo'

const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr')
const todayIso = () => new Date().toISOString().split('T')[0]

export function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>(getMeetings)
  const [open, setOpen] = useState<Set<string>>(() => new Set(getMeetings().slice(0, 1).map(m => m.id)))
  const [showForm, setShowForm] = useState(false)
  const [dTitle, setDTitle] = useState('')
  const [dDate, setDDate] = useState(todayIso())

  useEffect(() => { saveMeetings(meetings) }, [meetings])

  const overdue = new Set(overdueActions(meetings, new Date()).map(a => a.id))

  const toggleOpen = (id: string) => setOpen(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const addMeeting = () => {
    if (!dTitle.trim()) return
    const m: Meeting = { id: `rc${Date.now()}`, date: dDate, title: dTitle.trim(), attendees: [], decisions: [], actions: [] }
    setMeetings(prev => [m, ...prev])
    setOpen(prev => new Set(prev).add(m.id))
    logActivity('doc', `Réunion créée — ${m.title}`)
    setDTitle(''); setShowForm(false)
  }

  const addDecision = (mid: string, text: string) => {
    if (!text.trim()) return
    setMeetings(prev => prev.map(m => m.id === mid
      ? { ...m, decisions: [...m.decisions, { id: `d${Date.now()}`, text: text.trim() }] } : m))
  }

  const addAction = (mid: string, text: string, assignee: string, dueDate: string) => {
    if (!text.trim()) return
    setMeetings(prev => {
      const ref = nextActionRef(prev)
      return prev.map(m => m.id === mid
        ? { ...m, actions: [...m.actions, { id: `a${Date.now()}`, ref, text: text.trim(), assignee: assignee.trim() || '—', dueDate, status: 'todo' as const }] }
        : m)
    })
  }

  const toggleAction = (mid: string, aid: string) =>
    setMeetings(prev => prev.map(m => m.id !== mid ? m : {
      ...m,
      actions: m.actions.map(a => {
        if (a.id !== aid) return a
        const status = a.status === 'todo' ? 'done' as const : 'todo' as const
        logActivity('resolve', `Action ${a.ref} ${status === 'done' ? 'soldée' : 'rouverte'}`)
        return { ...a, status }
      }),
    }))

  const openCount = meetings.flatMap(m => m.actions).filter(a => a.status === 'todo').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {meetings.length} réunion{meetings.length > 1 ? 's' : ''} • {openCount} action{openCount > 1 ? 's' : ''} ouverte{openCount > 1 ? 's' : ''}
          {overdue.size > 0 && <span style={{ color: 'var(--bad)', fontWeight: 700 }}> • {overdue.size} en retard</span>}
        </div>
        <button onClick={() => setShowForm(v => !v)} style={primaryBtn}><Plus size={15} /> Réunion</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <input value={dTitle} onChange={e => setDTitle(e.target.value)} placeholder="Objet de la réunion" style={{ ...inp, flex: '2 1 180px' }} />
            <input type="date" value={dDate} onChange={e => setDDate(e.target.value)} style={{ ...inp, flex: '1 1 130px' }} />
          </div>
          <button onClick={addMeeting} style={okBtn}>Créer</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {meetings.map(m => {
          const isOpen = open.has(m.id)
          return (
            <div key={m.id} className="card" style={{ padding: '12px' }}>
              <button onClick={() => toggleOpen(m.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                {isOpen ? <ChevronDown size={16} color="var(--navy)" /> : <ChevronRight size={16} color="var(--navy)" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '14px' }}>{m.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {fmtDate(m.date)} • {m.decisions.length} décision{m.decisions.length > 1 ? 's' : ''} • {m.actions.length} action{m.actions.length > 1 ? 's' : ''}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div style={{ marginTop: '12px' }}>
                  {m.attendees.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                      <Users size={12} /> {m.attendees.join(' · ')}
                    </div>
                  )}

                  <SubTitle icon={<Gavel size={12} />} label="Décisions" />
                  {m.decisions.length === 0 && <Empty>Aucune décision actée.</Empty>}
                  {m.decisions.map(d => (
                    <div key={d.id} style={{ fontSize: '13px', color: 'var(--ink)', padding: '5px 0 5px 16px', borderLeft: '2px solid var(--sky)', marginBottom: '4px' }}>{d.text}</div>
                  ))}
                  <InlineAdd placeholder="Nouvelle décision…" onAdd={text => addDecision(m.id, text)} />

                  <div style={{ height: '12px' }} />
                  <SubTitle icon={<Check size={12} />} label="Actions" />
                  {m.actions.length === 0 && <Empty>Aucune action.</Empty>}
                  {m.actions.map(a => (
                    <ActionRow key={a.id} action={a} overdue={overdue.has(a.id)} onToggle={() => toggleAction(m.id, a.id)} />
                  ))}
                  <ActionAdd onAdd={(t, who, due) => addAction(m.id, t, who, due)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActionRow({ action, overdue, onToggle }: { action: MeetingAction; overdue: boolean; onToggle: () => void }) {
  const done = action.status === 'done'
  return (
    <div style={{ display: 'flex', alignItems: 'start', gap: '8px', padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <button onClick={onToggle} title={done ? 'Rouvrir' : 'Solder'} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', color: done ? 'var(--ok)' : 'var(--muted)', flexShrink: 0 }}>
        {done ? <RotateCcw size={14} /> : <Check size={14} />}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
          <strong style={{ color: 'var(--navy)', marginRight: '5px' }}>{action.ref}</strong>{action.text}
        </div>
        <div style={{ fontSize: '11px', color: overdue && !done ? 'var(--bad)' : 'var(--muted)', fontWeight: overdue && !done ? 700 : 400 }}>
          {action.assignee} • échéance {fmtDate(action.dueDate)}{overdue && !done ? ' — en retard' : ''}
        </div>
      </div>
    </div>
  )
}

function InlineAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (t: string) => void }) {
  const [v, setV] = useState('')
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder={placeholder} style={{ ...inp, flex: 1 }}
        onKeyDown={e => { if (e.key === 'Enter') { onAdd(v); setV('') } }} />
      <button onClick={() => { onAdd(v); setV('') }} style={ghostBtn}><Plus size={13} /></button>
    </div>
  )
}

function ActionAdd({ onAdd }: { onAdd: (text: string, assignee: string, due: string) => void }) {
  const [t, setT] = useState(''); const [who, setWho] = useState(''); const [due, setDue] = useState(todayIso())
  const submit = () => { onAdd(t, who, due); setT(''); setWho('') }
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
      <input value={t} onChange={e => setT(e.target.value)} placeholder="Nouvelle action…" style={{ ...inp, flex: '2 1 150px' }} />
      <input value={who} onChange={e => setWho(e.target.value)} placeholder="Responsable" style={{ ...inp, flex: '1 1 100px' }} />
      <input type="date" value={due} onChange={e => setDue(e.target.value)} style={{ ...inp, flex: '1 1 120px' }} />
      <button onClick={submit} style={ghostBtn}><Plus size={13} /></button>
    </div>
  )
}

const SubTitle = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '6px' }}>
    {icon}{label}
  </div>
)
const Empty = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', padding: '2px 0' }}>{children}</div>
)

const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }
const primaryBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }
const okBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: '6px', border: 'none', background: 'var(--ok)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--line)', background: '#fff', color: 'var(--navy)', cursor: 'pointer', display: 'flex', alignItems: 'center' }
