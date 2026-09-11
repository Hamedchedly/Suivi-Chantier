import { useState, useRef } from 'react'
import {
  ArrowLeft, Camera, Check, Ban, Eye, Flag, Handshake, ArrowUp, ArrowDown,
  X, ChevronRight, ChevronLeft, Pencil, Trash2, CalendarRange, CircleSlash, RotateCcw, LayoutList,
} from 'lucide-react'
import {
  VisitZone, VisitTaskCheck, PreviousObservation,
  tasksState, tasksWorksProgress, progressGap, stateAfterEdit,
} from '../../lib/visits'
import { DateCommitment, latestCommitment, isBroken } from '../../lib/commitments'
import { Reserve, reserveKind } from '../../lib/reserves'
import { VisitPhoto } from '../../lib/photoStore'
import { weekToFriday, weekLabel, dateToWeek } from '../../lib/weeks'
import type { LotContact } from '../../lib/repo'
import {
  ZONE_META, lotLabel, lotCompany, fmtFr, taskTitle,
  badge, input, linkBtn, ghostBtn, navBtn, bigBtnInline,
} from './visiteStyles'
import { Bar, Empty } from './visiteBits'
import type { RemarkInput } from './ZoneControl'
import { RemarkForm } from './RemarkForm'

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
  onUpdateRemark: (id: string, patch: Partial<Reserve>) => void
  onRemoveRemark: (id: string) => void
  onAddPhoto: (lotId: string, taskId: string, file: File) => void
  onBack: () => void
  /** Move straight to the neighbouring lot without going back to the list. */
  prevLot: { lotId: string; label: string } | null
  nextLot: { lotId: string; label: string } | null
  onGoToLot: (lotId: string) => void
}

export function LotControl(props: Props) {
  const { zone, lotId, tasks, lots, commitments, photos, reserves, blockerOptions,
    readOnly, previousOf, onPatchTask, onAddRemark, onUpdateRemark, onRemoveRemark, onAddPhoto, onBack,
    prevLot, nextLot, onGoToLot } = props

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
          onUpdateRemark={onUpdateRemark}
          onRemoveRemark={onRemoveRemark}
        />
      ))}

      {/* Walk the lots without going back to the list each time */}
      <div style={{ marginTop: '20px' }}>
        {nextLot && (
          <button onClick={() => onGoToLot(nextLot.lotId)}
            style={{ ...bigBtnInline, width: '100%', padding: '15px', background: 'var(--ok)', marginBottom: '8px' }}>
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: '10px', opacity: .85, fontWeight: 600 }}>Lot suivant</span>
              {nextLot.lotId} — {lotLabel(lots, nextLot.lotId)}
            </span>
            <ChevronRight size={18} />
          </button>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          {prevLot && (
            <button onClick={() => onGoToLot(prevLot.lotId)}
              style={{ ...navBtn, flex: 1, padding: '13px' }}>
              <ChevronLeft size={16} /> {prevLot.lotId}
            </button>
          )}
          <button onClick={onBack} title="Tous les lots du logement"
            style={{ ...navBtn, flex: prevLot ? '0 0 auto' : 1, padding: '13px 16px' }}>
            <LayoutList size={16} /> Tous les lots
          </button>
        </div>
      </div>
    </div>
  )
}

// ── One task ─────────────────────────────────────────────────────────────────

type Panel = null | 'menu' | 'observation' | 'action' | 'engagement' | 'blockers'

function TaskCard({ task, zone, lots, readOnly, commitment, previous, photoCount, remarks, blockerOptions, onPatch, onAddPhoto, onAddRemark, onUpdateRemark, onRemoveRemark }: {
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
  onUpdateRemark: (id: string, patch: Partial<Reserve>) => void
  onRemoveRemark: (id: string) => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const gap = progressGap(task)
  const delta = previous?.progress !== undefined && task.progress !== undefined ? task.progress - previous.progress : null
  const broken = commitment && task.plannedEnd ? isBroken(commitment, task.promisedEnd ?? task.plannedEnd) : false
  const blockers = task.blockedBy ?? []
  const isNa = task.state === 'na'

  const actual = task.progress ?? 0
  const planned = task.plannedProgress ?? actual
  const lo = Math.min(planned, actual)
  const hi = Math.max(planned, actual)
  const ahead = actual >= planned
  // One bar, three readings: done, the gap to plan, and what is left.
  const gapColor = ahead ? '#16a34a' : '#f59e0b'
  const track = `linear-gradient(to right, #02457A 0%, #02457A ${lo}%, ${gapColor} ${lo}%, ${gapColor} ${hi}%, #dbe5ec ${hi}%, #dbe5ec 100%)`

  const patchProgress = (progress: number) =>
    onPatch({ progress, state: stateAfterEdit({ ...task, progress }) })

  const patchBlockers = (blockedBy: string[]) =>
    onPatch({ blockedBy: blockedBy.length ? blockedBy : undefined, state: stateAfterEdit({ ...task, blockedBy }) })

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: '12px', background: '#fff', padding: '14px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
          {taskTitle(task.title, zone.refId)}
        </span>
        {!readOnly && (
          <>
            <button onClick={() => setPanel(p => p === 'engagement' ? null : 'engagement')}
              title="Engagement de l'entreprise" style={miniBtn('#6d28d9', !!task.promisedWeek)}>
              <Handshake size={15} />
            </button>
            <button onClick={() => onPatch({ state: isNa ? (task.progress === undefined ? 'not_checked' : 'ok') : 'na' })}
              title={isNa ? 'Rendre applicable' : 'Marquer non applicable'} style={miniBtn('#64748b', isNa)}>
              <CircleSlash size={15} />
            </button>
          </>
        )}
        {!isNa && <strong style={{ fontSize: '19px', color: 'var(--navy)' }}>{actual}%</strong>}
      </div>

      {/* A non-applicable task is set aside: no bar, and it stops counting */}
      {isNa ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '9px', background: '#f1f5f9', border: '1px solid var(--line)', marginBottom: '10px' }}>
          <CircleSlash size={15} color="#64748b" />
          <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
            Non applicable — exclue de l'avancement
          </span>
          {!readOnly && (
            <button onClick={() => onPatch({ state: task.progress === undefined ? 'not_checked' : 'ok' })}
              style={{ ...ghostBtn, padding: '6px 10px' }}>
              <RotateCcw size={13} /> Rétablir
            </button>
          )}
        </div>
      ) : (
        <input
          className="task-slider"
          type="range" min={0} max={100} step={5}
          value={actual}
          disabled={readOnly}
          onChange={e => patchProgress(Number(e.target.value))}
          style={{ background: track }}
        />
      )}

      {/* The bar carries the plan; only the gap itself needs spelling out */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '10px', marginTop: '6px', marginBottom: '10px' }}>
        {!isNa && gap !== null && gap !== 0 && (
          <span style={{ color: gap < 0 ? '#b45309' : '#15803d', fontWeight: 700 }}>
            {gap < 0 ? `${-gap} pts de retard` : `${gap} pts d'avance`} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>sur le prévu ({planned}%)</span>
          </span>
        )}
        {!isNa && gap === 0 && <span style={{ color: '#15803d', fontWeight: 700 }}>conforme au prévu</span>}
        {delta !== null && delta !== 0 && (
          <span style={{ color: 'var(--muted)' }}>
            depuis le {fmtFr(previous!.date)}
            <strong style={{ color: delta > 0 ? '#15803d' : '#dc2626', marginLeft: '3px' }}>
              {delta > 0 ? <ArrowUp size={10} style={{ verticalAlign: '-1px' }} /> : <ArrowDown size={10} style={{ verticalAlign: '-1px' }} />}
              {delta > 0 ? `+${delta}` : delta}
            </strong>
          </span>
        )}
      </div>

      {/* Recorded on this task */}
      {(task.promisedWeek || blockers.length > 0 || photoCount > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
          {task.promisedWeek && (
            <span style={{ ...badge, background: '#ede9fe', color: '#6d28d9' }}>
              <Handshake size={10} style={{ verticalAlign: '-1px', marginRight: '3px' }} />
              {task.promisedLabel ? `${task.promisedLabel} — ` : ''}{weekLabel(task.promisedWeek)}
            </span>
          )}
          {photoCount > 0 && <span style={{ ...badge, background: '#eef2f6', color: '#02457A' }}>{photoCount} photo{photoCount > 1 ? 's' : ''}</span>}
          {commitment && broken && <span style={{ ...badge, background: '#fdecec', color: '#dc2626' }}>promesse du {fmtFr(commitment.visitDate)} non tenue</span>}
        </div>
      )}

      {blockers.length > 0 && (
        <div style={{ borderRadius: '8px', background: '#fff7f7', border: '1px solid #fca5a5', padding: '8px 10px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>
            <Ban size={12} /> Bloquée par {blockers.length} tâche{blockers.length > 1 ? 's' : ''}
          </div>
          {blockers.map(id => {
            const o = blockerOptions.find(x => x.id === id)
            const who = o ? lotCompany(lots, o.lotId) ?? o.company : undefined
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#7f1d1d' }}>
                <span style={{ flex: 1 }}>{o ? `${o.lotId} — ${o.title}${who ? ` (${who})` : ''}` : id}</span>
                {!readOnly && (
                  <button onClick={() => patchBlockers(blockers.filter(x => x !== id))} title="Retirer"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#b91c1c', padding: '2px' }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Remarks raised on this task — editable and removable */}
      {remarks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
          {remarks.map(r => (
            <RemarkRow key={r.id} remark={r} readOnly={readOnly} onUpdate={onUpdateRemark} onRemove={onRemoveRemark} />
          ))}
        </div>
      )}

      {!readOnly && (
        <>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onAddPhoto(f); if (fileRef.current) fileRef.current.value = ''; setPanel(null) }} />

          {/* Three things to declare, reachable in one tap each */}
          {panel === null && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => fileRef.current?.click()} style={actBtn('#02457A')}>
                <Camera size={16} /> Photo
              </button>
              <button onClick={() => setPanel('action')} style={actBtn('#b45309')}>
                <Flag size={16} /> Alerte
              </button>
              <button onClick={() => setPanel('blockers')}
                style={actBtn(blockers.length ? '#b91c1c' : '#94a3b8', blockers.length > 0)}>
                <Ban size={16} /> Blocage
              </button>
            </div>
          )}

          {panel === 'action' && (
            <RemarkForm
              kind="action"
              company={lotCompany(lots, task.lotId)}
              onSubmit={(description, dueDate, priority) => { onAddRemark({ kind: 'action', description, lotId: task.lotId, taskId: task.taskId, dueDate, priority: priority ?? 'medium' }); setPanel(null) }}
              onCancel={() => setPanel(null)}
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
              onClear={() => { onPatch({ promisedLabel: undefined, promisedWeek: undefined, promisedEnd: undefined }); setPanel(null) }}
              hasOne={!!task.promisedWeek}
              onCancel={() => setPanel('menu')}
            />
          )}

          {panel === 'blockers' && (
            <BlockerPicker
              options={blockerOptions}
              lots={lots}
              selected={blockers}
              onChange={patchBlockers}
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

// ── A remark, editable in place ──────────────────────────────────────────────

function RemarkRow({ remark, readOnly, onUpdate, onRemove }: {
  remark: Reserve
  readOnly: boolean
  onUpdate: (id: string, patch: Partial<Reserve>) => void
  onRemove: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const isAction = reserveKind(remark) === 'action'
  const tint = isAction ? { bg: '#fffbeb', border: '#fcd34d', fg: '#b45309' } : { bg: '#f8fafc', border: 'var(--line)', fg: '#5b7183' }

  if (editing) {
    return (
      <RemarkForm
        kind={isAction ? 'action' : 'observation'}
        initial={{ description: remark.description, dueDate: remark.dueDate, priority: remark.priority }}
        onSubmit={(description, dueDate, priority) => {
          onUpdate(remark.id, { description, dueDate, ...(priority ? { priority } : {}) })
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '8px 10px', borderRadius: '8px', background: tint.bg, border: `1px solid ${tint.border}` }}>
      {isAction ? <Flag size={13} color={tint.fg} style={{ marginTop: '1px', flexShrink: 0 }} /> : <Eye size={13} color={tint.fg} style={{ marginTop: '1px', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: 'var(--ink)' }}>{remark.description}</div>
        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
          {remark.number}{remark.dueDate ? ` · échéance ${fmtFr(remark.dueDate)}` : ''}
        </div>
      </div>
      {!readOnly && (
        <>
          <button onClick={() => setEditing(true)} title="Modifier" style={iconBtn}><Pencil size={13} /></button>
          <button onClick={() => { if (window.confirm('Supprimer cette remarque ?')) onRemove(remark.id) }} title="Supprimer" style={iconBtn}><Trash2 size={13} /></button>
        </>
      )}
    </div>
  )
}

// ── Blocking tasks: pick the lot, then its tasks ─────────────────────────────

function BlockerPicker({ options, lots, selected, onChange, onClose }: {
  options: BlockerOption[]
  lots: LotContact[]
  selected: string[]
  onChange: (ids: string[]) => void
  onClose: () => void
}) {
  const [lot, setLot] = useState<string | null>(null)
  const lotIds = [...new Set(options.map(o => o.lotId))].sort()

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  return (
    <div style={{ ...panelBox, borderColor: '#fca5a5', background: '#fff7f7' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <Ban size={14} color="#b91c1c" />
        <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: '#b91c1c' }}>
          {lot ? `${lot} — choisissez les tâches` : "Quel lot bloque cette tâche ?"}
        </span>
        {selected.length > 0 && <span style={{ ...badge, background: '#fee2e2', color: '#b91c1c' }}>{selected.length}</span>}
      </div>

      {/* Step 1 — the lot */}
      {!lot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {lotIds.map(id => {
            const count = options.filter(o => o.lotId === id).length
            const picked = options.filter(o => o.lotId === id && selected.includes(o.id)).length
            return (
              <button key={id} onClick={() => setLot(id)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 11px', borderRadius: '9px', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--navy)' }}>{id} — {lotLabel(lots, id)}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                    {lotCompany(lots, id) ?? '—'} · {count} tâche{count > 1 ? 's' : ''}
                  </div>
                </div>
                {picked > 0 && <span style={{ ...badge, background: '#fee2e2', color: '#b91c1c' }}>{picked}</span>}
                <ChevronRight size={15} color="var(--muted)" />
              </button>
            )
          })}
        </div>
      )}

      {/* Step 2 — its tasks, multi-select */}
      {lot && (
        <>
          <button onClick={() => setLot(null)} style={{ ...linkBtn, marginBottom: '8px' }}>
            <ArrowLeft size={14} /> Tous les lots
          </button>
          <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {options.filter(o => o.lotId === lot).map(o => {
              const on = selected.includes(o.id)
              return (
                <button key={o.id} onClick={() => toggle(o.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '11px 10px', borderRadius: '8px', border: on ? '2px solid #b91c1c' : '1px solid var(--line)', background: on ? '#fee2e2' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{
                    width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                    border: on ? 'none' : '1.5px solid #cbd5e1', background: on ? '#b91c1c' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on && <Check size={13} color="#fff" />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '12px', color: 'var(--ink)' }}>{o.title}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        {selected.length > 0 && (
          <button onClick={() => onChange([])} style={{ ...navBtn, flex: '0 0 auto', padding: '11px 14px', color: '#b91c1c', borderColor: '#f5c2c2' }}>
            Tout retirer
          </button>
        )}
        <button onClick={onClose} style={{ ...bigBtnInline, flex: 1, background: 'var(--navy)', padding: '11px' }}>
          Terminé
        </button>
      </div>
    </div>
  )
}

// ── Engagement ───────────────────────────────────────────────────────────────

function EngagementForm({ company, label, week, hasOne, onSubmit, onClear, onCancel }: {
  company?: string; label: string; week: string; hasOne: boolean
  onSubmit: (label: string, week: string) => void
  onClear: () => void
  onCancel: () => void
}) {
  const [text, setText] = useState(label)
  const [w, setW] = useState(week)
  return (
    <div style={{ ...panelBox, borderColor: '#ddd6fe', background: '#faf8ff' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#6d28d9', marginBottom: '7px' }}>
        Engagement{company ? ` de ${company}` : ''} — semaine de fin annoncée
      </div>
      <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="ex. Remplacement de la pompe"
        style={{ ...input, width: '100%', marginBottom: '8px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <CalendarRange size={16} color="var(--muted)" />
        <input type="week" value={w} onChange={e => setW(e.target.value)} style={{ ...input, flex: 1 }} />
      </div>
      {w && <div style={{ fontSize: '11px', color: '#6d28d9', fontWeight: 600, marginBottom: '8px' }}>Fin annoncée : {weekLabel(w)}</div>}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
        {hasOne && <button onClick={onClear} style={{ ...linkBtn, color: '#dc2626' }}>Retirer</button>}
        <button onClick={onCancel} style={linkBtn}>Annuler</button>
        <button disabled={!w} onClick={() => onSubmit(text.trim(), w)}
          style={{ ...bigBtnInline, background: '#6d28d9', padding: '10px 15px', fontSize: '13px', opacity: w ? 1 : 0.5 }}>
          Enregistrer
        </button>
      </div>
    </div>
  )
}

const panelBox: React.CSSProperties = { marginTop: '4px', padding: '11px', borderRadius: '10px', background: '#f8fafc', border: '1px solid var(--line)' }

const actBtn = (fg: string, on = false): React.CSSProperties => ({
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  padding: '13px 8px', borderRadius: '10px',
  border: on ? `2px solid ${fg}` : `1px solid ${fg}33`,
  background: on ? `${fg}1a` : `${fg}0f`, color: fg,
  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
})

/** Secondary, rarer actions live beside the title rather than in the main row. */
const miniBtn = (fg: string, on = false): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '30px', height: '30px', borderRadius: '8px',
  border: on ? `2px solid ${fg}` : '1px solid var(--line)',
  background: on ? `${fg}1a` : '#fff', color: on ? fg : 'var(--muted)',
  cursor: 'pointer', flexShrink: 0,
})

const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px',
  borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,.7)', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0,
}
