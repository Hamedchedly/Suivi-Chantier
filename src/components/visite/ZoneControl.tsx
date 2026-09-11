import { useState, useRef } from 'react'
import {
  ChevronDown, ChevronRight, ChevronLeft, Camera, Plus, Pencil, Trash2,
  CheckCircle2, AlertTriangle, Circle, Ban, CalendarClock, StickyNote, Check,
} from 'lucide-react'
import {
  VisitZone, VisitTaskCheck, TaskState, lotGroups, tasksState, tasksWorksProgress,
  zoneState, zoneWorksProgress, zoneControlProgress,
} from '../../lib/visits'
import { DateCommitment, latestCommitment, isBroken } from '../../lib/commitments'
import { Reserve, ReservePriority, nextReserveNumber } from '../../lib/reserves'
import { VisitPhoto } from '../../lib/photoStore'
import { Annotation } from '../../lib/annotations'
import { PhotoAnnotator } from './PhotoAnnotator'
import type { LotContact } from '../../lib/repo'
import {
  ZONE_META, PRIORITY_META, lotLabel, lotCompany, fmtFr, todayIso,
  sectionLabel, badge, input, ghostBtn, linkBtn, navBtn, thumbBtn, pill, bigBtnInline,
} from './visiteStyles'
import { Bar, Empty } from './visiteBits'

interface Props {
  zone: VisitZone
  visitId: string
  lots: LotContact[]
  commitments: DateCommitment[]
  photos: VisitPhoto[]
  reserves: Reserve[]
  readOnly: boolean
  isLast: boolean
  onUpdateZone: (fn: (z: VisitZone) => VisitZone) => void
  onAddReserve: (r: Reserve) => void
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
  const { zone, visitId, lots, commitments, photos, reserves, readOnly, isLast,
    onUpdateZone, onAddReserve, onAddPhoto, onUpdatePhoto, onRemovePhoto, onBack, onPrev, onCloseZone } = props

  const groups = lotGroups(zone)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const st = ZONE_META[zoneState(zone)]

  const toggleLot = (lotId: string) => setExpanded(prev => {
    const n = new Set(prev)
    if (n.has(lotId)) n.delete(lotId); else n.add(lotId)
    return n
  })

  const patchTask = (taskId: string, patch: Partial<VisitTaskCheck>) =>
    onUpdateZone(z => ({ ...z, tasks: z.tasks.map(t => t.taskId === taskId ? { ...t, ...patch } : t) }))

  /** Apply a state to every task of a lot at once (collapsed-level shortcut). */
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

      {groups.length === 0 && <Empty>Aucune tâche planifiée sur cette zone — vous pouvez tout de même y ajouter des notes, photos et points à revoir.</Empty>}

      {groups.map(g => {
        const open = expanded.has(g.lotId)
        const gs = ZONE_META[tasksState(g.tasks)]
        return (
          <div key={g.lotId} style={{ border: '1px solid var(--line)', borderRadius: '10px', marginBottom: '8px', overflow: 'hidden', background: '#fff' }}>
            <button onClick={() => toggleLot(g.lotId)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '11px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
              {open ? <ChevronDown size={15} color="var(--muted)" /> : <ChevronRight size={15} color="var(--muted)" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy)' }}>{g.lotId} — {lotLabel(lots, g.lotId)}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{g.tasks.length} tâche{g.tasks.length > 1 ? 's' : ''} · {lotCompany(lots, g.lotId) ?? '—'}</div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy)' }}>{tasksWorksProgress(g.tasks)}%</span>
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
                    readOnly={readOnly}
                    commitment={latestCommitment(commitments, t.taskId)}
                    photoCount={photos.filter(p => p.taskId === t.taskId).length}
                    onPatch={patch => patchTask(t.taskId, patch)}
                    onAddPhoto={file => onAddPhoto(t.lotId, t.taskId, file)}
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

      {!readOnly && <ReviewForm zone={zone} visitId={visitId} lots={lots} reserves={reserves} onAdd={onAddReserve} />}

      <ZonePhotos
        photos={photos.filter(p => !p.taskId)}
        lots={lots}
        readOnly={readOnly}
        onAdd={(lotId, file) => onAddPhoto(lotId, undefined, file)}
        onUpdate={onUpdatePhoto}
        onRemove={onRemovePhoto}
      />

      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        {onPrev && <button onClick={onPrev} style={{ ...navBtn, flex: '0 0 auto', padding: '11px 14px' }}><ChevronLeft size={16} /> Précédent</button>}
        <button onClick={onCloseZone} style={{ ...bigBtnInline, flex: 1, background: zone.closedAt ? 'var(--muted)' : 'var(--ok)' }}>
          <Check size={16} /> {zone.closedAt ? 'Logement terminé' : 'Terminer'}{isLast ? '' : ' et suivant'}
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

function TaskRow({ task, readOnly, commitment, photoCount, onPatch, onAddPhoto }: {
  task: VisitTaskCheck
  readOnly: boolean
  commitment?: DateCommitment
  photoCount: number
  onPatch: (patch: Partial<VisitTaskCheck>) => void
  onAddPhoto: (file: File) => void
}) {
  const [extra, setExtra] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const drift = dayDiff(task.baselineEnd, task.promisedEnd ?? task.plannedEnd)
  const broken = commitment && task.plannedEnd ? isBroken(commitment, task.promisedEnd ?? task.plannedEnd) : false

  // Filling in a percentage means the task WAS inspected — mark it controlled.
  const setProgress = (progress: number) =>
    onPatch({ progress, ...(task.state === 'not_checked' ? { state: 'ok' as TaskState } : {}) })

  return (
    <div style={{ padding: '11px 12px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
        <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{task.title}</span>
        {task.comment && <StickyNote size={13} color="#b45309" />}
        {photoCount > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px', color: 'var(--muted)' }}><Camera size={12} />{photoCount}</span>}
        <strong style={{ fontSize: '13px', color: 'var(--navy)', minWidth: '34px', textAlign: 'right' }}>{task.progress ?? 0}%</strong>
      </div>

      {!readOnly && (
        <input
          type="range" min={0} max={100} step={5}
          value={task.progress ?? 0}
          onChange={e => setProgress(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#02457A', marginBottom: '8px' }}
        />
      )}
      {readOnly && <div style={{ marginBottom: '8px' }}><Bar value={task.progress ?? 0} /></div>}

      {!readOnly && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          {STATE_OPTS.map(o => (
            <button key={o.s} onClick={() => onPatch({ state: task.state === o.s ? 'not_checked' : o.s })}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '6px 3px', borderRadius: '6px', border: task.state === o.s ? `2px solid ${o.fg}` : '1px solid var(--line)', background: task.state === o.s ? o.bg : '#fff', color: task.state === o.s ? o.fg : 'var(--muted)', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Dates: contractual is frozen, planning is today's, promise is what the company announces */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10px', color: 'var(--muted)', marginBottom: extra || !readOnly ? '8px' : 0 }}>
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
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CalendarClock size={13} color="var(--muted)" />
          <input
            type="date"
            value={task.promisedEnd ?? ''}
            onChange={e => onPatch({ promisedEnd: e.target.value || undefined })}
            title="Nouvelle échéance annoncée par l'entreprise"
            style={{ ...input, padding: '5px 7px', fontSize: '11px', flex: 1 }}
          />
          <button onClick={() => setExtra(v => !v)} title="Ajouter une note ou une photo" style={{ ...ghostBtn, padding: '6px 9px' }}>
            <Plus size={14} />
          </button>
        </div>
      )}

      {extra && !readOnly && (
        <div style={{ marginTop: '8px', padding: '8px', borderRadius: '8px', background: '#f8fafc' }}>
          <textarea
            value={task.comment ?? ''}
            onChange={e => onPatch({ comment: e.target.value || undefined })}
            placeholder="Note sur cette tâche…"
            style={{ ...input, width: '100%', minHeight: '46px', resize: 'vertical', fontSize: '12px', marginBottom: '6px' }}
          />
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onAddPhoto(f); if (fileRef.current) fileRef.current.value = '' }} />
          <button onClick={() => fileRef.current?.click()} style={{ ...ghostBtn, width: '100%', justifyContent: 'center' }}>
            <Camera size={14} /> Ajouter une photo à cette tâche
          </button>
        </div>
      )}

      {readOnly && task.comment && (
        <div style={{ marginTop: '6px', fontSize: '11px', color: '#b45309', fontStyle: 'italic' }}>{task.comment}</div>
      )}
    </div>
  )
}

// ── Point à revoir (réserve rattachée à la visite) ───────────────────────────

function ReviewForm({ zone, visitId, lots, reserves, onAdd }: {
  zone: VisitZone
  visitId: string
  lots: LotContact[]
  reserves: Reserve[]
  onAdd: (r: Reserve) => void
}) {
  const lotIds = [...new Set(zone.tasks.map(t => t.lotId))]
  const [open, setOpen] = useState(false)
  const [lot, setLot] = useState(lotIds[0] ?? lots[0]?.id ?? '')
  const [desc, setDesc] = useState('')
  const [priority, setPriority] = useState<ReservePriority>('medium')

  const submit = () => {
    if (!desc.trim()) return
    onAdd({
      id: `r${Date.now()}`, number: nextReserveNumber(reserves), lotId: lot, logementId: zone.refId,
      description: desc.trim(), priority, status: 'open', createdAt: todayIso(),
      visitId, company: lotCompany(lots, lot),
    })
    setDesc(''); setOpen(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ ...ghostBtn, width: '100%', justifyContent: 'center', marginTop: '12px', padding: '10px' }}>
      <AlertTriangle size={14} /> Ajouter un point « à revoir »
    </button>
  )

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginTop: '12px', background: '#fffdf7' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', marginBottom: '8px' }}>Point à revoir — {zone.label}</div>
      <select value={lot} onChange={e => setLot(e.target.value)} style={{ ...input, width: '100%', marginBottom: '8px' }}>
        {(lotIds.length ? lotIds : lots.map(l => l.id)).map(id => <option key={id} value={id}>{id} — {lotLabel(lots, id)}</option>)}
      </select>
      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="ex. Peinture chambre à reprendre" style={{ ...input, width: '100%', minHeight: '52px', resize: 'vertical', marginBottom: '8px' }} />
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        {(Object.keys(PRIORITY_META) as ReservePriority[]).map(p => (
          <button key={p} onClick={() => setPriority(p)} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: priority === p ? `2px solid ${PRIORITY_META[p].fg}` : '1px solid var(--line)', background: priority === p ? PRIORITY_META[p].bg : '#fff', color: PRIORITY_META[p].fg, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            {PRIORITY_META[p].label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={() => setOpen(false)} style={linkBtn}>Annuler</button>
        <button onClick={submit} style={{ ...bigBtnInline, background: 'var(--ok)', padding: '8px 14px', fontSize: '13px' }}>Ajouter</button>
      </div>
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
