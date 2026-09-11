import { useState, useRef } from 'react'
import {
  ChevronDown, ChevronRight, ChevronLeft, Camera, Pencil, Trash2,
  CheckCircle2, AlertTriangle, Circle, Ban, CalendarClock, StickyNote, Check,
  Eye, Flag, Handshake, ArrowUp, ArrowDown,
} from 'lucide-react'
import {
  VisitZone, VisitTaskCheck, TaskState, PreviousObservation,
  lotGroups, tasksState, tasksWorksProgress, progressGap,
  zoneState, zoneWorksProgress, zoneControlProgress,
} from '../../lib/visits'
import { DateCommitment, latestCommitment, isBroken } from '../../lib/commitments'
import { Reserve, ReservePriority, FollowUpStatus, reserveKind } from '../../lib/reserves'
import { VisitPhoto } from '../../lib/photoStore'
import { Annotation } from '../../lib/annotations'
import { PhotoAnnotator } from './PhotoAnnotator'
import { CarriedPoints } from './CarriedPoints'
import type { LotContact } from '../../lib/repo'
import {
  ZONE_META, PRIORITY_META, lotLabel, lotCompany, fmtFr,
  sectionLabel, badge, input, ghostBtn, linkBtn, navBtn, thumbBtn, pill, bigBtnInline,
} from './visiteStyles'
import { Bar, Empty } from './visiteBits'

/** What the caller needs to build a full Reserve. */
export interface RemarkInput {
  kind: 'observation' | 'action'
  description: string
  lotId: string
  taskId?: string
  dueDate?: string
  priority: ReservePriority
}

interface Props {
  zone: VisitZone
  lots: LotContact[]
  commitments: DateCommitment[]
  photos: VisitPhoto[]
  carriedPoints: Reserve[]
  visitReserves: Reserve[]
  readOnly: boolean
  isLast: boolean
  previousOf: (taskId: string) => PreviousObservation | undefined
  onUpdateZone: (fn: (z: VisitZone) => VisitZone) => void
  onAddRemark: (r: RemarkInput) => void
  onFollowUp: (reserveId: string, status: FollowUpStatus, dueDate?: string) => void
  onAddPhoto: (lotId: string | undefined, taskId: string | undefined, file: File) => void
  onUpdatePhoto: (p: VisitPhoto) => void
  onRemovePhoto: (id: string) => void
  onBack: () => void
  onPrev: (() => void) | null
  onCloseZone: () => void
}

const dayDiff = (a?: string, b?: string): number | null => {
  if (!a || !b) return null
  const pa = Date.parse(a), pb = Date.parse(b)
  if (isNaN(pa) || isNaN(pb)) return null
  return Math.round((pb - pa) / 86400000)
}

export function ZoneControl(props: Props) {
  const { zone, lots, commitments, photos, carriedPoints, visitReserves, readOnly, isLast,
    previousOf, onUpdateZone, onAddRemark, onFollowUp, onAddPhoto, onUpdatePhoto, onRemovePhoto,
    onBack, onPrev, onCloseZone } = props

  const groups = lotGroups(zone)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const st = ZONE_META[zoneState(zone)]
  const zoneRemarks = visitReserves.filter(r => r.logementId === zone.refId)

  const toggleLot = (lotId: string) => setExpanded(prev => {
    const n = new Set(prev)
    if (n.has(lotId)) n.delete(lotId); else n.add(lotId)
    return n
  })

  const patchTask = (taskId: string, patch: Partial<VisitTaskCheck>) =>
    onUpdateZone(z => ({ ...z, tasks: z.tasks.map(t => t.taskId === taskId ? { ...t, ...patch } : t) }))

  const setLotState = (lotId: string, state: TaskState) =>
    onUpdateZone(z => ({ ...z, tasks: z.tasks.map(t => t.lotId === lotId ? { ...t, state } : t) }))

  const setOverride = (o: 'to_review' | 'blocked') =>
    onUpdateZone(z => ({ ...z, override: z.override === o ? null : o }))

  return (
    <div style={{ padding: '12px', paddingBottom: '90px' }}>
      <button onClick={onBack} style={{ ...linkBtn, marginBottom: '10px' }}>← Tableau de bord</button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <h2 style={{ margin: 0 }}>{zone.label}</h2>
        <span style={{ ...badge, background: st.bg, color: st.fg }}>{st.label}</span>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 10px' }}>{zone.buildingLabel}</div>

      <div style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>
            <span>Travaux constatés</span><strong style={{ color: 'var(--navy)' }}>{zoneWorksProgress(zone)}%</strong>
          </div>
          <Bar value={zoneWorksProgress(zone)} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>
            <span>Contrôle</span><strong style={{ color: 'var(--navy)' }}>{zoneControlProgress(zone)}%</strong>
          </div>
          <Bar value={zoneControlProgress(zone)} color="#16a34a" />
        </div>
      </div>

      {/* Priority: what earlier sessions left open here */}
      <CarriedPoints points={carriedPoints} readOnly={readOnly} onFollowUp={onFollowUp} />

      {groups.length === 0 && <Empty>Aucune tâche planifiée sur cette zone — vous pouvez tout de même y ajouter des remarques et des photos.</Empty>}

      {groups.map(g => {
        const open = expanded.has(g.lotId)
        const gs = ZONE_META[tasksState(g.tasks)]
        return (
          <div key={g.lotId} style={{ border: '1px solid var(--line)', borderRadius: '10px', marginBottom: '8px', overflow: 'hidden', background: '#fff' }}>
            <button onClick={() => toggleLot(g.lotId)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '13px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
              {open ? <ChevronDown size={16} color="var(--muted)" /> : <ChevronRight size={16} color="var(--muted)" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy)' }}>{g.lotId} — {lotLabel(lots, g.lotId)}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{g.tasks.length} tâche{g.tasks.length > 1 ? 's' : ''} · {lotCompany(lots, g.lotId) ?? '—'}</div>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy)' }}>{tasksWorksProgress(g.tasks)}%</span>
              <span style={{ ...badge, background: gs.bg, color: gs.fg }}>{gs.label}</span>
            </button>

            {!open && !readOnly && (
              <div style={{ display: 'flex', gap: '5px', padding: '0 12px 10px' }}>
                <button onClick={() => setLotState(g.lotId, 'ok')} style={pill(false, '#15803d', '#dcfce7')}><CheckCircle2 size={13} /> Tout conforme</button>
                <button onClick={() => setLotState(g.lotId, 'na')} style={pill(false, '#64748b', '#f1f5f9')}><Circle size={13} /> Tout N/A</button>
              </div>
            )}

            {open && (
              <div style={{ borderTop: '1px solid var(--line)' }}>
                {g.tasks.map(t => (
                  <TaskRow
                    key={t.taskId}
                    task={t}
                    lots={lots}
                    readOnly={readOnly}
                    commitment={latestCommitment(commitments, t.taskId)}
                    previous={previousOf(t.taskId)}
                    photoCount={photos.filter(p => p.taskId === t.taskId).length}
                    remarkCount={zoneRemarks.filter(r => r.taskId === t.taskId).length}
                    onPatch={patch => patchTask(t.taskId, patch)}
                    onAddPhoto={file => onAddPhoto(t.lotId, t.taskId, file)}
                    onAddRemark={onAddRemark}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {!readOnly && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
          <button onClick={() => setOverride('to_review')} style={pill(zone.override === 'to_review', '#b45309', '#fef3c7')}>
            <AlertTriangle size={13} /> Zone à revoir
          </button>
          <button onClick={() => setOverride('blocked')} style={pill(zone.override === 'blocked', '#b91c1c', '#fee2e2')}>
            <Ban size={13} /> Zone bloquée
          </button>
        </div>
      )}

      {/* Remarks raised in this zone during this session */}
      {zoneRemarks.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={sectionLabel}>Relevé de cette visite ({zoneRemarks.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {zoneRemarks.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px' }}>
                {reserveKind(r) === 'observation' ? <Eye size={13} color="#5b7183" /> : <Flag size={13} color="#b45309" />}
                <span style={{ flex: 1 }}>{r.description}</span>
                {r.dueDate && <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{fmtFr(r.dueDate)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <ZoneRemarkButtons
          lots={lots}
          lotIds={[...new Set(zone.tasks.map(t => t.lotId))]}
          onAddRemark={onAddRemark}
        />
      )}

      <ZonePhotos
        photos={photos.filter(p => !p.taskId)}
        lots={lots}
        readOnly={readOnly}
        onAdd={(lotId, file) => onAddPhoto(lotId, undefined, file)}
        onUpdate={onUpdatePhoto}
        onRemove={onRemovePhoto}
      />

      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        {onPrev && <button onClick={onPrev} style={{ ...navBtn, flex: '0 0 auto', padding: '13px 14px' }}><ChevronLeft size={16} /> Précédent</button>}
        <button onClick={onCloseZone} style={{ ...bigBtnInline, flex: 1, padding: '14px', background: zone.closedAt ? 'var(--muted)' : 'var(--ok)' }}>
          <Check size={17} /> {zone.closedAt ? 'Logement terminé' : 'Terminer'}{isLast ? '' : ' et suivant'}
        </button>
      </div>
    </div>
  )
}

// ── One planning task ────────────────────────────────────────────────────────

const STATE_OPTS: { s: TaskState; label: string; icon: React.ReactNode; fg: string; bg: string }[] = [
  { s: 'ok', label: 'OK', icon: <CheckCircle2 size={13} />, fg: '#15803d', bg: '#dcfce7' },
  { s: 'to_review', label: 'À revoir', icon: <AlertTriangle size={13} />, fg: '#b45309', bg: '#fef3c7' },
  { s: 'blocked', label: 'Bloqué', icon: <Ban size={13} />, fg: '#b91c1c', bg: '#fee2e2' },
  { s: 'na', label: 'N/A', icon: <Circle size={13} />, fg: '#64748b', bg: '#f1f5f9' },
]

type Panel = null | 'observation' | 'action' | 'engagement'

function TaskRow({ task, lots, readOnly, commitment, previous, photoCount, remarkCount, onPatch, onAddPhoto, onAddRemark }: {
  task: VisitTaskCheck
  lots: LotContact[]
  readOnly: boolean
  commitment?: DateCommitment
  previous?: PreviousObservation
  photoCount: number
  remarkCount: number
  onPatch: (patch: Partial<VisitTaskCheck>) => void
  onAddPhoto: (file: File) => void
  onAddRemark: (r: RemarkInput) => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drift = dayDiff(task.baselineEnd, task.promisedEnd ?? task.plannedEnd)
  const broken = commitment && task.plannedEnd ? isBroken(commitment, task.promisedEnd ?? task.plannedEnd) : false
  const gap = progressGap(task)
  const delta = previous?.progress !== undefined && task.progress !== undefined ? task.progress - previous.progress : null
  const rescheduled = previous?.promisedEnd && task.promisedEnd && task.promisedEnd !== previous.promisedEnd

  // Filling in a percentage means the task WAS inspected — mark it controlled.
  const setProgress = (progress: number) =>
    onPatch({ progress, ...(task.state === 'not_checked' ? { state: 'ok' as TaskState } : {}) })

  return (
    <div style={{ padding: '12px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
        <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{task.title}</span>
        {remarkCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px', color: '#b45309' }}><Flag size={11} />{remarkCount}</span>}
        {task.comment && <StickyNote size={13} color="#b45309" />}
        {photoCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px', color: 'var(--muted)' }}><Camera size={12} />{photoCount}</span>}
        <strong style={{ fontSize: '14px', color: 'var(--navy)', minWidth: '38px', textAlign: 'right' }}>{task.progress ?? 0}%</strong>
      </div>

      {!readOnly ? (
        <input type="range" min={0} max={100} step={5} value={task.progress ?? 0}
          onChange={e => setProgress(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#02457A', marginBottom: '8px', height: '26px' }} />
      ) : (
        <div style={{ marginBottom: '8px' }}><Bar value={task.progress ?? 0} /></div>
      )}

      {!readOnly && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          {STATE_OPTS.map(o => (
            <button key={o.s} onClick={() => onPatch({ state: task.state === o.s ? 'not_checked' : o.s })}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '8px 3px', borderRadius: '6px', border: task.state === o.s ? `2px solid ${o.fg}` : '1px solid var(--line)', background: task.state === o.s ? o.bg : '#fff', color: task.state === o.s ? o.fg : 'var(--muted)', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Planning vs observed, and movement since the last session */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: 'var(--muted)', marginBottom: '6px' }}>
        {task.plannedProgress !== undefined && <span>Prévu <strong style={{ color: 'var(--ink)' }}>{task.plannedProgress}%</strong></span>}
        {gap !== null && gap !== 0 && (
          <span style={{ color: gap < 0 ? '#dc2626' : '#15803d', fontWeight: 700 }}>
            Écart {gap > 0 ? `+${gap}` : gap} pts
          </span>
        )}
        {previous && (
          <span>
            Visite {fmtFr(previous.date)} <strong style={{ color: 'var(--ink)' }}>{previous.progress ?? 0}%</strong>
            {delta !== null && delta !== 0 && (
              <strong style={{ color: delta > 0 ? '#15803d' : '#dc2626', marginLeft: '4px' }}>
                {delta > 0 ? <ArrowUp size={10} style={{ verticalAlign: '-1px' }} /> : <ArrowDown size={10} style={{ verticalAlign: '-1px' }} />}
                {delta > 0 ? `+${delta}` : delta} pts
              </strong>
            )}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: 'var(--muted)', marginBottom: '8px' }}>
        <span>Contractuel <strong style={{ color: 'var(--ink)' }}>{fmtFr(task.baselineEnd)}</strong></span>
        <span>Planning <strong style={{ color: 'var(--ink)' }}>{fmtFr(task.plannedEnd)}</strong></span>
        {drift !== null && drift !== 0 && (
          <span style={{ color: drift > 0 ? '#dc2626' : '#15803d', fontWeight: 700 }}>{drift > 0 ? `+${drift} j` : `${drift} j`}</span>
        )}
        {commitment && (
          <span style={{ color: broken ? '#dc2626' : '#5b7183' }}>
            Promis {fmtFr(commitment.promisedEnd)} ({fmtFr(commitment.visitDate)}){broken ? ' — non tenu' : ''}
          </span>
        )}
        {rescheduled && <span style={{ color: '#b45309', fontWeight: 700 }}>Échéance reportée</span>}
      </div>

      {!readOnly && (
        <>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onAddPhoto(f); if (fileRef.current) fileRef.current.value = '' }} />
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <button onClick={() => fileRef.current?.click()} style={quickBtn('#02457A')}><Camera size={14} /> Photo</button>
            <button onClick={() => setPanel(p => p === 'observation' ? null : 'observation')} style={quickBtn('#5b7183')}><Eye size={14} /> Observation</button>
            <button onClick={() => setPanel(p => p === 'action' ? null : 'action')} style={quickBtn('#b45309')}><Flag size={14} /> Action</button>
            <button onClick={() => setPanel(p => p === 'engagement' ? null : 'engagement')} style={quickBtn('#6d28d9')}><Handshake size={14} /> Engagement</button>
          </div>

          {panel === 'observation' && (
            <QuickRemark
              placeholder="Constat — ex. joint fissuré autour de la menuiserie"
              submitLabel="Ajouter l'observation"
              onSubmit={description => { onAddRemark({ kind: 'observation', description, lotId: task.lotId, taskId: task.taskId, priority: 'low' }); setPanel(null) }}
              onCancel={() => setPanel(null)}
            />
          )}

          {panel === 'action' && (
            <ActionForm
              company={lotCompany(lots, task.lotId)}
              onSubmit={(description, dueDate, priority) => { onAddRemark({ kind: 'action', description, lotId: task.lotId, taskId: task.taskId, dueDate, priority }); setPanel(null) }}
              onCancel={() => setPanel(null)}
            />
          )}

          {panel === 'engagement' && (
            <EngagementForm
              company={lotCompany(lots, task.lotId)}
              label={task.promisedLabel ?? ''}
              due={task.promisedEnd ?? ''}
              onSubmit={(promisedLabel, promisedEnd) => { onPatch({ promisedLabel: promisedLabel || undefined, promisedEnd: promisedEnd || undefined }); setPanel(null) }}
              onCancel={() => setPanel(null)}
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
        <div style={{ marginTop: '6px', fontSize: '11px', color: '#b45309', fontStyle: 'italic' }}>{task.comment}</div>
      )}
    </div>
  )
}

const quickBtn = (fg: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 11px', borderRadius: '8px',
  border: `1px solid ${fg}33`, background: `${fg}0f`, color: fg, fontSize: '11px', fontWeight: 700, cursor: 'pointer',
})

// ── Inline forms ─────────────────────────────────────────────────────────────

function QuickRemark({ placeholder, submitLabel, onSubmit, onCancel }: {
  placeholder: string; submitLabel: string; onSubmit: (text: string) => void; onCancel: () => void
}) {
  const [text, setText] = useState('')
  return (
    <div style={panelBox}>
      <textarea autoFocus value={text} onChange={e => setText(e.target.value)} placeholder={placeholder}
        style={{ ...input, width: '100%', minHeight: '52px', resize: 'vertical', marginBottom: '8px' }} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={linkBtn}>Annuler</button>
        <button disabled={!text.trim()} onClick={() => onSubmit(text.trim())}
          style={{ ...bigBtnInline, background: 'var(--navy)', padding: '9px 14px', fontSize: '13px', opacity: text.trim() ? 1 : 0.5 }}>
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
        style={{ ...input, width: '100%', minHeight: '52px', resize: 'vertical', marginBottom: '8px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <CalendarClock size={14} color="var(--muted)" />
        <input type="date" value={due} onChange={e => setDue(e.target.value)} title="Échéance"
          style={{ ...input, flex: 1, padding: '7px 9px', fontSize: '12px' }} />
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        {(Object.keys(PRIORITY_META) as ReservePriority[]).map(p => (
          <button key={p} onClick={() => setPriority(p)}
            style={{ flex: 1, padding: '7px', borderRadius: '6px', border: priority === p ? `2px solid ${PRIORITY_META[p].fg}` : '1px solid var(--line)', background: priority === p ? PRIORITY_META[p].bg : '#fff', color: PRIORITY_META[p].fg, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            {PRIORITY_META[p].label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={linkBtn}>Annuler</button>
        <button disabled={!text.trim()} onClick={() => onSubmit(text.trim(), due || undefined, priority)}
          style={{ ...bigBtnInline, background: '#b45309', padding: '9px 14px', fontSize: '13px', opacity: text.trim() ? 1 : 0.5 }}>
          Créer l'action
        </button>
      </div>
    </div>
  )
}

function EngagementForm({ company, label, due, onSubmit, onCancel }: {
  company?: string; label: string; due: string
  onSubmit: (label: string, due: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(label)
  const [date, setDate] = useState(due)
  return (
    <div style={panelBox}>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
        Engagement{company ? ` de ${company}` : ''} — consigné dans l'historique
      </div>
      <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="ex. Remplacement de la pompe"
        style={{ ...input, width: '100%', marginBottom: '8px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <CalendarClock size={14} color="var(--muted)" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} title="Échéance annoncée"
          style={{ ...input, flex: 1, padding: '7px 9px', fontSize: '12px' }} />
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={linkBtn}>Annuler</button>
        <button disabled={!date} onClick={() => onSubmit(text.trim(), date)}
          style={{ ...bigBtnInline, background: '#6d28d9', padding: '9px 14px', fontSize: '13px', opacity: date ? 1 : 0.5 }}>
          Enregistrer
        </button>
      </div>
    </div>
  )
}

const panelBox: React.CSSProperties = { marginTop: '8px', padding: '10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid var(--line)' }

// ── Zone-level remarks (not tied to one task) ────────────────────────────────

function ZoneRemarkButtons({ lots, lotIds, onAddRemark }: {
  lots: LotContact[]; lotIds: string[]; onAddRemark: (r: RemarkInput) => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const [lot, setLot] = useState(lotIds[0] ?? lots[0]?.id ?? '')
  const choices = lotIds.length ? lotIds : lots.map(l => l.id)

  return (
    <div style={{ marginTop: '14px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={() => setPanel(p => p === 'observation' ? null : 'observation')} style={{ ...ghostBtn, flex: 1, justifyContent: 'center', padding: '11px' }}>
          <Eye size={14} /> Observation
        </button>
        <button onClick={() => setPanel(p => p === 'action' ? null : 'action')} style={{ ...ghostBtn, flex: 1, justifyContent: 'center', padding: '11px' }}>
          <Flag size={14} /> Action
        </button>
      </div>

      {panel && (
        <>
          <select value={lot} onChange={e => setLot(e.target.value)} style={{ ...input, width: '100%', marginTop: '8px' }}>
            {choices.map(id => <option key={id} value={id}>{id} — {lotLabel(lots, id)}</option>)}
          </select>
          {panel === 'observation' ? (
            <QuickRemark
              placeholder="Constat sur la zone…"
              submitLabel="Ajouter l'observation"
              onSubmit={description => { onAddRemark({ kind: 'observation', description, lotId: lot, priority: 'low' }); setPanel(null) }}
              onCancel={() => setPanel(null)}
            />
          ) : (
            <ActionForm
              company={lotCompany(lots, lot)}
              onSubmit={(description, dueDate, priority) => { onAddRemark({ kind: 'action', description, lotId: lot, dueDate, priority }); setPanel(null) }}
              onCancel={() => setPanel(null)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Zone-level photo gallery ─────────────────────────────────────────────────

function ZonePhotos({ photos, lots, readOnly, onAdd, onUpdate, onRemove }: {
  photos: VisitPhoto[]
  lots: LotContact[]
  readOnly: boolean
  onAdd: (lotId: string | undefined, file: File) => void
  onUpdate: (p: VisitPhoto) => void
  onRemove: (id: string) => void
}) {
  const [lot, setLot] = useState('')
  const [editing, setEditing] = useState<VisitPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ marginTop: '18px' }}>
      <div style={sectionLabel}>Photos de la zone ({photos.length})</div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <select value={lot} onChange={e => setLot(e.target.value)} style={{ ...input, flex: 1 }}>
            <option value="">Lot (facultatif)</option>
            {lots.map(l => <option key={l.id} value={l.id}>{l.id} — {lotLabel(lots, l.id)}</option>)}
          </select>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onAdd(lot || undefined, f); if (fileRef.current) fileRef.current.value = '' }} />
          <button onClick={() => fileRef.current?.click()} style={ghostBtn}><Camera size={14} /> Ajouter</button>
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px' }}>
          {photos.map(p => (
            <div key={p.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--line)' }}>
              <img src={p.annotated ?? p.original} alt="" style={{ width: '100%', height: '96px', objectFit: 'cover', display: 'block' }} />
              {p.annotations.length > 0 && <span style={{ position: 'absolute', top: '4px', left: '4px', padding: '1px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: 700, background: 'rgba(2,69,122,.9)', color: '#fff' }}>{p.annotations.length}</span>}
              {!readOnly && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: '2px', padding: '3px', background: 'linear-gradient(transparent, rgba(0,0,0,.55))' }}>
                  <button onClick={() => setEditing(p)} title="Annoter" style={thumbBtn}><Pencil size={13} /></button>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => onRemove(p.id)} title="Supprimer" style={thumbBtn}><Trash2 size={13} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PhotoAnnotator
          src={editing.original}
          initial={editing.annotations}
          onClose={() => setEditing(null)}
          onSave={(annotations: Annotation[], annotated: string) => {
            onUpdate({ ...editing, annotations, annotated: annotations.length ? annotated : undefined })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
