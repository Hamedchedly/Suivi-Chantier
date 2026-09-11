import { useState, useRef } from 'react'
import {
  ArrowLeft, Camera, Plus, CheckCircle2, AlertTriangle, Circle, Ban, Check,
  Eye, Flag, Handshake, ArrowUp, ArrowDown, Search, X, CalendarRange,
} from 'lucide-react'
import {
  VisitZone, VisitTaskCheck, TaskState, PreviousObservation,
  tasksState, tasksWorksProgress, progressGap,
} from '../../lib/visits'
import { DateCommitment, latestCommitment, isBroken } from '../../lib/commitments'
import { Reserve, ReservePriority, reserveKind } from '../../lib/reserves'
import { VisitPhoto } from '../../lib/photoStore'
import { weekToFriday, weekLabel, dateToWeek } from '../../lib/weeks'
import type { LotContact } from '../../lib/repo'
import {
  ZONE_META, PRIORITY_META, lotLabel, lotCompany, fmtFr, taskTitle,
  badge, input, linkBtn, bigBtnInline,
} from './visiteStyles'
import { Bar, Empty } from './visiteBits'
import type { RemarkInput } from './ZoneControl'

/** One candidate blocker, flattened from the planning. */
export interface BlockerOption {
  id: string
  title: string
  lotId: string
  logementId?: string
  company?: string
}

interface Props {
  zone: VisitZone
  lotId: string
  tasks: VisitTaskCheck[]
  lots: LotContact[]
  commitments: DateCommitment[]
  photos: VisitPhoto[]
  reserves: Reserve[]
  blockerOptions: BlockerOption[]
  readOnly: boolean
  previousOf: (taskId: string) => PreviousObservation | undefined
  onPatchTask: (taskId: string, patch: Partial<VisitTaskCheck>) => void
  onAddRemark: (r: RemarkInput) => void
  onAddPhoto: (lotId: string, taskId: string, file: File) => void
  onBack: () => void
}

export function LotControl(props: Props) {
  const { zone, lotId, tasks, lots, commitments, photos, reserves, blockerOptions,
    readOnly, previousOf, onPatchTask, onAddRemark, onAddPhoto, onBack } = props

  const st = ZONE_META[tasksState(tasks)]
  const pct = tasksWorksProgress(tasks)
  const company = lotCompany(lots, lotId)

  return (
    <div style={{ padding: '12px', paddingBottom: '90px' }}>
      <button onClick={onBack} style={{ ...linkBtn, marginBottom: '10px' }}>
        <ArrowLeft size={15} /> {zone.label}
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{lotId} — {lotLabel(lots, lotId)}</h2>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
            {company ?? '—'} · {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
          </div>
        </div>
        <span style={{ ...badge, background: st.bg, color: st.fg }}>{st.label}</span>
      </div>

      <div style={{ margin: '12px 0 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
          <span>Avancement constaté du lot</span>
          <strong style={{ color: 'var(--navy)', fontSize: '15px' }}>{pct}%</strong>
        </div>
        <Bar value={pct} />
      </div>

      {tasks.length === 0 && <Empty>Aucune tâche planifiée pour ce lot dans ce logement.</Empty>}

      {tasks.map(t => (
        <TaskCard
          key={t.taskId}
          task={t}
          zone={zone}
          lots={lots}
          readOnly={readOnly}
          commitment={latestCommitment(commitments, t.taskId)}
          previous={previousOf(t.taskId)}
          photoCount={photos.filter(p => p.taskId === t.taskId).length}
          remarks={reserves.filter(r => r.taskId === t.taskId)}
          blockerOptions={blockerOptions.filter(o => o.id !== t.taskId)}
          onPatch={patch => onPatchTask(t.taskId, patch)}
          onAddPhoto={file => onAddPhoto(t.lotId, t.taskId, file)}
          onAddRemark={onAddRemark}
        />
      ))}

      <button onClick={onBack} style={{ ...bigBtnInline, width: '100%', marginTop: '18px', padding: '14px', background: 'var(--navy)' }}>
        <Check size={17} /> Revenir aux lots
      </button>
    </div>
  )
}

// ── One task ─────────────────────────────────────────────────────────────────

const STATE_OPTS: { s: TaskState; label: string; icon: React.ReactNode; fg: string; bg: string }[] = [
  { s: 'ok', label: 'OK', icon: <CheckCircle2 size={14} />, fg: '#15803d', bg: '#dcfce7' },
  { s: 'to_review', label: 'À revoir', icon: <AlertTriangle size={14} />, fg: '#b45309', bg: '#fef3c7' },
  { s: 'blocked', label: 'Bloqué', icon: <Ban size={14} />, fg: '#b91c1c', bg: '#fee2e2' },
  { s: 'na', label: 'N/A', icon: <Circle size={14} />, fg: '#64748b', bg: '#f1f5f9' },
]

type Panel = null | 'menu' | 'observation' | 'action' | 'engagement' | 'blockers'

function TaskCard({ task, zone, lots, readOnly, commitment, previous, photoCount, remarks, blockerOptions, onPatch, onAddPhoto, onAddRemark }: {
  task: VisitTaskCheck
  zone: VisitZone
  lots: LotContact[]
  readOnly: boolean
  commitment?: DateCommitment
  previous?: PreviousObservation
  photoCount: number
  remarks: Reserve[]
  blockerOptions: BlockerOption[]
  onPatch: (patch: Partial<VisitTaskCheck>) => void
  onAddPhoto: (file: File) => void
  onAddRemark: (r: RemarkInput) => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const gap = progressGap(task)
  const delta = previous?.progress !== undefined && task.progress !== undefined ? task.progress - previous.progress : null
  const broken = commitment && task.plannedEnd ? isBroken(commitment, task.promisedEnd ?? task.plannedEnd) : false
  const blockers = task.blockedBy ?? []

  const setProgress = (progress: number) =>
    onPatch({ progress, ...(task.state === 'not_checked' ? { state: 'ok' as TaskState } : {}) })

  const setState = (s: TaskState) => {
    const next = task.state === s ? 'not_checked' : s
    onPatch({ state: next })
    // Marking a task blocked immediately asks WHAT is blocking it.
    if (next === 'blocked') setPanel('blockers')
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: '12px', background: '#fff', padding: '14px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
          {taskTitle(task.title, zone.refId)}
        </span>
        <strong style={{ fontSize: '17px', color: 'var(--navy)' }}>{task.progress ?? 0}%</strong>
      </div>

      {!readOnly ? (
        <input type="range" min={0} max={100} step={5} value={task.progress ?? 0}
          onChange={e => setProgress(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#02457A', height: '30px', marginBottom: '10px' }} />
      ) : (
        <div style={{ marginBottom: '10px' }}><Bar value={task.progress ?? 0} /></div>
      )}

      {!readOnly && (
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          {STATE_OPTS.map(o => (
            <button key={o.s} onClick={() => setState(o.s)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '11px 4px', borderRadius: '8px', border: task.state === o.s ? `2px solid ${o.fg}` : '1px solid var(--line)', background: task.state === o.s ? o.bg : '#fff', color: task.state === o.s ? o.fg : 'var(--muted)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Context line: planning vs observed, movement, dates */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: 'var(--muted)', marginBottom: '8px' }}>
        {task.plannedProgress !== undefined && <span>Prévu <strong style={{ color: 'var(--ink)' }}>{task.plannedProgress}%</strong></span>}
        {gap !== null && gap !== 0 && (
          <span style={{ color: gap < 0 ? '#dc2626' : '#15803d', fontWeight: 700 }}>Écart {gap > 0 ? `+${gap}` : gap} pts</span>
        )}
        {previous && (
          <span>
            Visite {fmtFr(previous.date)} <strong style={{ color: 'var(--ink)' }}>{previous.progress ?? 0}%</strong>
            {delta !== null && delta !== 0 && (
              <strong style={{ color: delta > 0 ? '#15803d' : '#dc2626', marginLeft: '3px' }}>
                {delta > 0 ? <ArrowUp size={10} style={{ verticalAlign: '-1px' }} /> : <ArrowDown size={10} style={{ verticalAlign: '-1px' }} />}
                {delta > 0 ? `+${delta}` : delta}
              </strong>
            )}
          </span>
        )}
        <span>Planning <strong style={{ color: 'var(--ink)' }}>{fmtFr(task.plannedEnd)}</strong></span>
        {commitment && (
          <span style={{ color: broken ? '#dc2626' : '#5b7183' }}>
            Promis {fmtFr(commitment.promisedEnd)}{broken ? ' — non tenu' : ''}
          </span>
        )}
      </div>

      {/* What was recorded on this task */}
      {(task.promisedWeek || blockers.length > 0 || remarks.length > 0 || photoCount > 0 || task.comment) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
          {task.promisedWeek && (
            <span style={{ ...badge, background: '#ede9fe', color: '#6d28d9' }}>
              <Handshake size={10} style={{ verticalAlign: '-1px', marginRight: '3px' }} />
              {task.promisedLabel ? `${task.promisedLabel} — ` : ''}{weekLabel(task.promisedWeek)}
            </span>
          )}
          {blockers.length > 0 && (
            <span style={{ ...badge, background: '#fee2e2', color: '#b91c1c' }}>
              <Ban size={10} style={{ verticalAlign: '-1px', marginRight: '3px' }} />
              Bloqué par {blockers.length}
            </span>
          )}
          {photoCount > 0 && <span style={{ ...badge, background: '#eef2f6', color: '#02457A' }}>{photoCount} photo{photoCount > 1 ? 's' : ''}</span>}
          {remarks.map(r => (
            <span key={r.id} style={{ ...badge, background: reserveKind(r) === 'observation' ? '#eef2f6' : '#fef3c7', color: reserveKind(r) === 'observation' ? '#5b7183' : '#b45309' }}>
              {reserveKind(r) === 'observation' ? <Eye size={10} style={{ verticalAlign: '-1px', marginRight: '3px' }} /> : <Flag size={10} style={{ verticalAlign: '-1px', marginRight: '3px' }} />}
              {r.number}
            </span>
          ))}
        </div>
      )}

      {blockers.length > 0 && (
        <div style={{ fontSize: '11px', color: '#b91c1c', marginBottom: '10px' }}>
          {blockers.map(id => {
            const o = blockerOptions.find(x => x.id === id)
            if (!o) return <div key={id}>• {id}</div>
            const who = lotCompany(lots, o.lotId) ?? o.company
            return <div key={id}>• {o.lotId} — {o.title}{who ? ` (${who})` : ''}</div>
          })}
        </div>
      )}

      {!readOnly && (
        <>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onAddPhoto(f); if (fileRef.current) fileRef.current.value = ''; setPanel(null) }} />

          {panel === null && (
            <button onClick={() => setPanel('menu')} style={addBtn}>
              <Plus size={18} /> Ajouter
            </button>
          )}

          {panel === 'menu' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button onClick={() => fileRef.current?.click()} style={menuBtn('#02457A')}><Camera size={16} /> Photo</button>
              <button onClick={() => setPanel('observation')} style={menuBtn('#5b7183')}><Eye size={16} /> Observation</button>
              <button onClick={() => setPanel('action')} style={menuBtn('#b45309')}><Flag size={16} /> Action</button>
              <button onClick={() => setPanel('engagement')} style={menuBtn('#6d28d9')}><Handshake size={16} /> Engagement</button>
              <button onClick={() => setPanel(null)} style={{ ...menuBtn('#94a3b8'), gridColumn: '1 / -1' }}><X size={15} /> Fermer</button>
            </div>
          )}

          {panel === 'observation' && (
            <QuickText
              placeholder="Constat — ex. joint fissuré autour de la menuiserie"
              submitLabel="Ajouter l'observation"
              color="#5b7183"
              onSubmit={description => { onAddRemark({ kind: 'observation', description, lotId: task.lotId, taskId: task.taskId, priority: 'low' }); setPanel(null) }}
              onCancel={() => setPanel('menu')}
            />
          )}

          {panel === 'action' && (
            <ActionForm
              company={lotCompany(lots, task.lotId)}
              onSubmit={(description, dueDate, priority) => { onAddRemark({ kind: 'action', description, lotId: task.lotId, taskId: task.taskId, dueDate, priority }); setPanel(null) }}
              onCancel={() => setPanel('menu')}
            />
          )}

          {panel === 'engagement' && (
            <EngagementForm
              company={lotCompany(lots, task.lotId)}
              label={task.promisedLabel ?? ''}
              week={task.promisedWeek ?? (task.plannedEnd ? dateToWeek(task.plannedEnd) : '')}
              onSubmit={(promisedLabel, promisedWeek) => {
                onPatch({
                  promisedLabel: promisedLabel || undefined,
                  promisedWeek: promisedWeek || undefined,
                  promisedEnd: promisedWeek ? weekToFriday(promisedWeek) ?? undefined : undefined,
                })
                setPanel(null)
              }}
              onCancel={() => setPanel('menu')}
            />
          )}

          {panel === 'blockers' && (
            <BlockerPicker
              options={blockerOptions}
              lots={lots}
              selected={blockers}
              onToggle={id => onPatch({ blockedBy: blockers.includes(id) ? blockers.filter(x => x !== id) : [...blockers, id] })}
              onClose={() => setPanel(null)}
            />
          )}

          <textarea
            value={task.comment ?? ''}
            onChange={e => onPatch({ comment: e.target.value || undefined })}
            placeholder="Note libre sur cette tâche…"
            style={{ ...input, width: '100%', minHeight: '38px', resize: 'vertical', fontSize: '12px', marginTop: '8px' }}
          />
        </>
      )}

      {readOnly && task.comment && (
        <div style={{ fontSize: '11px', color: '#b45309', fontStyle: 'italic' }}>{task.comment}</div>
      )}
    </div>
  )
}

// ── Blocking tasks: search by entreprise / lot ──────────────────────────────

function BlockerPicker({ options, lots, selected, onToggle, onClose }: {
  options: BlockerOption[]
  lots: LotContact[]
  selected: string[]
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const [lot, setLot] = useState('')
  const [company, setCompany] = useState('')
  const [q, setQ] = useState('')

  // Show the contractual company name (config), not the planning's short code.
  const nameOf = (o: BlockerOption) => lotCompany(lots, o.lotId) ?? o.company
  const companies = [...new Set(options.map(nameOf).filter((c): c is string => !!c))].sort()
  const lotIds = [...new Set(options.map(o => o.lotId))].sort()
  const shown = options.filter(o =>
    (!lot || o.lotId === lot) &&
    (!company || nameOf(o) === company) &&
    (!q || o.title.toLowerCase().includes(q.toLowerCase())),
  ).slice(0, 40)

  return (
    <div style={{ ...panelBox, borderColor: '#fca5a5', background: '#fff7f7' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c', marginBottom: '8px' }}>
        Qu'est-ce qui bloque cette tâche ?
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
        <select value={lot} onChange={e => setLot(e.target.value)} style={{ ...input, flex: 1, padding: '7px 8px', fontSize: '12px' }}>
          <option value="">Tous les lots</option>
          {lotIds.map(id => <option key={id} value={id}>{id} — {lotLabel(lots, id)}</option>)}
        </select>
        <select value={company} onChange={e => setCompany(e.target.value)} style={{ ...input, flex: 1, padding: '7px 8px', fontSize: '12px' }}>
          <option value="">Toutes entreprises</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <Search size={14} color="var(--muted)" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une tâche…"
          style={{ ...input, flex: 1, padding: '7px 9px', fontSize: '12px' }} />
      </div>

      <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {shown.length === 0 && <Empty>Aucune tâche ne correspond.</Empty>}
        {shown.map(o => {
          const on = selected.includes(o.id)
          return (
            <button key={o.id} onClick={() => onToggle(o.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '8px', border: on ? '2px solid #b91c1c' : '1px solid var(--line)', background: on ? '#fee2e2' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
              {on ? <Check size={14} color="#b91c1c" /> : <Circle size={14} color="var(--muted)" />}
              <span style={{ flex: 1, minWidth: 0, fontSize: '12px' }}>
                <strong style={{ color: 'var(--navy)' }}>{o.lotId}</strong> {o.title}
                {nameOf(o) && <span style={{ color: 'var(--muted)' }}> · {nameOf(o)}</span>}
              </span>
            </button>
          )
        })}
      </div>

      <button onClick={onClose} style={{ ...bigBtnInline, width: '100%', marginTop: '8px', background: 'var(--navy)', padding: '10px' }}>
        Terminé
      </button>
    </div>
  )
}

// ── Inline forms ─────────────────────────────────────────────────────────────

function QuickText({ placeholder, submitLabel, color, onSubmit, onCancel }: {
  placeholder: string; submitLabel: string; color: string
  onSubmit: (text: string) => void; onCancel: () => void
}) {
  const [text, setText] = useState('')
  return (
    <div style={panelBox}>
      <textarea autoFocus value={text} onChange={e => setText(e.target.value)} placeholder={placeholder}
        style={{ ...input, width: '100%', minHeight: '54px', resize: 'vertical', marginBottom: '8px' }} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={linkBtn}>Retour</button>
        <button disabled={!text.trim()} onClick={() => onSubmit(text.trim())}
          style={{ ...bigBtnInline, background: color, padding: '10px 14px', fontSize: '13px', opacity: text.trim() ? 1 : 0.5 }}>
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function ActionForm({ company, onSubmit, onCancel }: {
  company?: string
  onSubmit: (description: string, dueDate: string | undefined, priority: ReservePriority) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState<ReservePriority>('medium')
  return (
    <div style={panelBox}>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
        Action à réaliser{company ? ` — ${company}` : ''}
      </div>
      <textarea autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="ex. Reprendre le joint avant la prochaine visite"
        style={{ ...input, width: '100%', minHeight: '54px', resize: 'vertical', marginBottom: '8px' }} />
      <input type="date" value={due} onChange={e => setDue(e.target.value)} title="Échéance"
        style={{ ...input, width: '100%', marginBottom: '8px' }} />
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        {(Object.keys(PRIORITY_META) as ReservePriority[]).map(p => (
          <button key={p} onClick={() => setPriority(p)}
            style={{ flex: 1, padding: '9px', borderRadius: '7px', border: priority === p ? `2px solid ${PRIORITY_META[p].fg}` : '1px solid var(--line)', background: priority === p ? PRIORITY_META[p].bg : '#fff', color: PRIORITY_META[p].fg, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            {PRIORITY_META[p].label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={linkBtn}>Retour</button>
        <button disabled={!text.trim()} onClick={() => onSubmit(text.trim(), due || undefined, priority)}
          style={{ ...bigBtnInline, background: '#b45309', padding: '10px 14px', fontSize: '13px', opacity: text.trim() ? 1 : 0.5 }}>
          Créer l'action
        </button>
      </div>
    </div>
  )
}

function EngagementForm({ company, label, week, onSubmit, onCancel }: {
  company?: string; label: string; week: string
  onSubmit: (label: string, week: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(label)
  const [w, setW] = useState(week)
  return (
    <div style={panelBox}>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
        Engagement{company ? ` de ${company}` : ''} — semaine de fin annoncée
      </div>
      <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="ex. Remplacement de la pompe"
        style={{ ...input, width: '100%', marginBottom: '8px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <CalendarRange size={16} color="var(--muted)" />
        <input type="week" value={w} onChange={e => setW(e.target.value)}
          style={{ ...input, flex: 1 }} />
      </div>
      {w && <div style={{ fontSize: '11px', color: '#6d28d9', fontWeight: 600, marginBottom: '8px' }}>Fin annoncée : {weekLabel(w)}</div>}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={linkBtn}>Retour</button>
        <button disabled={!w} onClick={() => onSubmit(text.trim(), w)}
          style={{ ...bigBtnInline, background: '#6d28d9', padding: '10px 14px', fontSize: '13px', opacity: w ? 1 : 0.5 }}>
          Enregistrer
        </button>
      </div>
    </div>
  )
}

const panelBox: React.CSSProperties = { marginTop: '4px', padding: '11px', borderRadius: '10px', background: '#f8fafc', border: '1px solid var(--line)' }

const addBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', width: '100%',
  padding: '13px', borderRadius: '10px', border: '1px dashed #9bb0c2', background: '#fff',
  color: 'var(--navy)', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
}

const menuBtn = (fg: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '14px 10px',
  borderRadius: '10px', border: `1px solid ${fg}33`, background: `${fg}0f`, color: fg,
  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
})
