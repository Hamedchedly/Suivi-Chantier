import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft, Camera, Check, Ban, Eye, Flag, Handshake, ArrowUp, ArrowDown,
  X, ChevronRight, ChevronLeft, ChevronDown, Pencil, Trash2, CalendarRange, CircleSlash, RotateCcw, LayoutList, ImageIcon, Plus, CheckCircle2,
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
  /** Ajouter une tâche (ou sous-tâche) dans le planning pour ce lot depuis la visite. */
  onAddPlanTask?: (title: string, start: string, duration: number, parentTaskId?: string) => void
}

export function LotControl(props: Props) {
  const { zone, lotId, tasks, lots, commitments, photos, reserves, blockerOptions,
    readOnly, previousOf, onPatchTask, onAddRemark, onUpdateRemark, onRemoveRemark, onAddPhoto, onBack,
    prevLot, nextLot, onGoToLot, onAddPlanTask } = props

  // Scroll to top whenever we land on a new lot
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [])

  const st = ZONE_META[tasksState(tasks)]
  const pct = tasksWorksProgress(tasks)
  const company = lotCompany(lots, lotId)

  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  const [addForm, setAddForm] = useState<{ title: string; start: string; duration: string } | null>(null)
  const [addedName, setAddedName] = useState<string | null>(null)

  const submitAdd = () => {
    if (!addForm || !addForm.title.trim() || !onAddPlanTask) return
    onAddPlanTask(addForm.title.trim(), addForm.start, Math.max(1, parseInt(addForm.duration, 10) || 5))
    setAddedName(addForm.title.trim())
    setAddForm({ title: '', start: addForm.start, duration: '5' })
    setTimeout(() => setAddedName(null), 3000)
  }

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

      {[...tasks]
        .sort((a, b) => {
          // Non-terminées en premier, terminées ensuite, N/A tout à la fin
          const rank = (t: VisitTaskCheck) => t.state === 'na' ? 3 : (t.state === 'ok' ? 2 : 0)
          return rank(a) - rank(b)
        })
        .map(t => (
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
          onAddSubTask={onAddPlanTask ? (title, start, duration) => onAddPlanTask(title, start, duration, t.taskId) : undefined}
        />
      ))}

      {/* Ajouter une tâche au planning pour ce lot */}
      {onAddPlanTask && !readOnly && (
        <div style={{ marginTop: '12px', marginBottom: '4px', border: '1px solid var(--line)', borderRadius: '10px', overflow: 'hidden' }}>
          <button
            onClick={() => setAddForm(f => f ? null : { title: '', start: todayIso(), duration: '5' })}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '10px 12px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', textAlign: 'left' }}
          >
            <Plus size={14} color="var(--accent)" />
            Ajouter une tâche à ce lot
            <ChevronRight size={13} color="var(--muted)" style={{ marginLeft: 'auto', transform: addForm ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {addForm && (
            <div style={{ padding: '10px 12px', background: '#fff', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {addedName && (
                <div style={{ fontSize: '11px', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> « {addedName} » ajouté au planning.
                </div>
              )}
              <input
                autoFocus
                value={addForm.title}
                placeholder="Intitulé de la tâche"
                onChange={e => setAddForm({ ...addForm, title: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') submitAdd() }}
                style={{ ...input, fontSize: '12px' }}
              />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Début
                  <input type="date" value={addForm.start} onChange={e => setAddForm({ ...addForm, start: e.target.value })} style={{ ...input, fontSize: '12px' }} />
                </label>
                <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Durée (j)
                  <input type="number" min={1} value={addForm.duration} onChange={e => setAddForm({ ...addForm, duration: e.target.value })} style={{ ...input, width: '56px', fontSize: '12px' }} />
                </label>
              </div>
              <button
                onClick={submitAdd}
                disabled={!addForm.title.trim()}
                style={{ ...ghostBtn, background: addForm.title.trim() ? 'var(--accent)' : '#e5e7eb', color: addForm.title.trim() ? '#fff' : 'var(--muted)', border: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
              >
                Ajouter
              </button>
            </div>
          )}
        </div>
      )}

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

type Panel = null | 'menu' | 'photo' | 'observation' | 'action' | 'engagement' | 'blockers'

function TaskCard({ task, zone, lots, readOnly, commitment, previous, photoCount, remarks, blockerOptions, onPatch, onAddPhoto, onAddRemark, onUpdateRemark, onRemoveRemark, onAddSubTask }: {
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
  onAddSubTask?: (title: string, start: string, duration: number) => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const [collapsed, setCollapsed] = useState(
    () => task.state === 'ok' || (task.state !== 'na' && (task.progress ?? 0) >= 100),
  )
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [subForm, setSubForm] = useState<{ title: string; start: string; duration: string } | null>(null)
  const [subAdded, setSubAdded] = useState<string | null>(null)
  const gap = progressGap(task)

  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const submitSubTask = () => {
    if (!subForm || !subForm.title.trim() || !onAddSubTask) return
    onAddSubTask(subForm.title.trim(), subForm.start, Math.max(1, parseInt(subForm.duration, 10) || 5))
    setSubAdded(subForm.title.trim())
    setSubForm({ title: '', start: subForm.start, duration: '5' })
    setTimeout(() => setSubAdded(null), 3000)
  }
  const delta = previous?.progress !== undefined && task.progress !== undefined ? task.progress - previous.progress : null
  const broken = commitment && task.plannedEnd ? isBroken(commitment, task.promisedEnd ?? task.plannedEnd) : false
  const blockers = task.blockedBy ?? []
  const isNa = task.state === 'na'

  const checked = task.progress !== undefined
  const planned = task.plannedProgress            // attendu selon le planning, figé à l'ouverture
  const prev = previous?.progress                 // % constaté à la dernière réunion
  // Le curseur démarre là où en était le point (dernière réunion, sinon prévu) :
  // il ne reste qu'à le pousser à la valeur du jour. Les repères « prévu » et
  // « réunion préc. » sont posés par-dessus le remplissage.
  const thumb = task.progress ?? prev ?? planned ?? 0
  const track = `linear-gradient(to right, #02457A 0%, #02457A ${thumb}%, #dbe5ec ${thumb}%, #dbe5ec 100%)`

  const patchProgress = (progress: number) =>
    onPatch({ progress, state: stateAfterEdit({ ...task, progress }) })

  const patchBlockers = (blockedBy: string[]) =>
    onPatch({ blockedBy: blockedBy.length ? blockedBy : undefined, state: stateAfterEdit({ ...task, blockedBy }) })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onAddPhoto(f)
    if (e.target) e.target.value = ''
    setPanel(null)
  }

  // P3 — Tâche terminée : affichage compact, dépliable au clic
  if (collapsed && !isNa) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #86efac', cursor: 'pointer', marginBottom: '10px' }}
      >
        <Check size={15} color="#15803d" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#15803d' }}>
          {taskTitle(task.title, zone.refId)}
        </span>
        {photoCount > 0 && <span style={{ ...badge, background: '#dcfce7', color: '#15803d', fontSize: '9px' }}>{photoCount}📷</span>}
        {remarks.length > 0 && <span style={{ ...badge, background: '#fef3c7', color: '#92400e', fontSize: '9px' }}>{remarks.length} note{remarks.length > 1 ? 's' : ''}</span>}
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>{task.progress ?? 100}%</span>
        <ChevronDown size={13} color="#86efac" />
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: '12px', background: '#fff', padding: '14px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
          {taskTitle(task.title, zone.refId)}
        </span>
        {/* Replier si la tâche était terminée */}
        {(task.state === 'ok' || (task.progress ?? 0) >= 100) && (
          <button onClick={() => setCollapsed(true)} title="Replier" style={miniBtn('#15803d', false)}>
            <Check size={14} />
          </button>
        )}
        {!readOnly && (
          <>
            {onAddSubTask && (
              <button
                onClick={() => setSubForm(f => f ? null : { title: '', start: todayStr, duration: '5' })}
                title="Ajouter une sous-tâche"
                style={{ ...miniBtn('#0284c7', !!subForm), fontSize: '10px', gap: '2px' }}
              >
                <Plus size={11} />↳
              </button>
            )}
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
        {!isNa && (
          <strong style={{ fontSize: '19px', color: checked ? 'var(--navy)' : 'var(--muted)' }} title={checked ? undefined : 'Valeur de départ (dernière réunion) — bougez le curseur pour constater'}>
            {thumb}%{!checked && <span style={{ fontSize: '10px', fontWeight: 600, verticalAlign: '2px', marginLeft: '2px' }}>·</span>}
          </strong>
        )}
      </div>

      {/* A non-applicable task is set aside: no bar, and it stops counting */}
      {isNa ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '9px', background: '#f1f5f9', border: '1px solid var(--line)', marginBottom: '10px' }}>
          <CircleSlash size={15} color="#64748b" />
          <span
            style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#64748b' }}
            title="Cette tâche ne concerne pas ce logement / cette zone et est exclue du calcul d'avancement."
          >
            N/A — non concerné par ce logement
          </span>
          {!readOnly && (
            <button onClick={() => onPatch({ state: task.progress === undefined ? 'not_checked' : 'ok' })}
              style={{ ...ghostBtn, padding: '6px 10px' }}>
              <RotateCcw size={13} /> Rétablir
            </button>
          )}
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            className="task-slider"
            type="range" min={0} max={100} step={5}
            value={thumb}
            disabled={readOnly}
            onChange={e => patchProgress(Number(e.target.value))}
            style={{ background: track }}
          />
          {/* Repère du prévu au planning et de l'avancement de la dernière réunion */}
          {planned !== undefined && <SliderMark pct={planned} color="#0284c7" title={`Prévu au planning : ${planned}%`} />}
          {prev !== undefined && <SliderMark pct={prev} color="#f59e0b" title={`Dernière réunion : ${prev}%`} />}
        </div>
      )}

      {/* Contexte d'avancement — compact, sans doublon */}
      {!isNa && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '10px', marginTop: '4px', marginBottom: '10px' }}>
          {/* Écart vs planning : principal indicateur */}
          {gap !== null && gap !== 0 && planned !== undefined && (
            <span style={{ color: gap < 0 ? '#b45309' : '#15803d', fontWeight: 700 }}>
              {gap < 0 ? `${-gap} pts de retard sur le prévu (${planned}%)` : `+${gap} pts d'avance sur le prévu (${planned}%)`}
            </span>
          )}
          {gap === 0 && planned !== undefined && (
            <span style={{ color: '#15803d', fontWeight: 600 }}>Conforme au prévu ({planned}%)</span>
          )}
          {/* Évolution depuis la dernière visite (seulement si le curseur a été bougé) */}
          {delta !== null && delta !== 0 && checked && (
            <span style={{ color: delta > 0 ? '#15803d' : '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              {delta > 0
                ? <ArrowUp size={9} style={{ verticalAlign: '-1px' }} />
                : <ArrowDown size={9} style={{ verticalAlign: '-1px' }} />}
              <strong>{delta > 0 ? `+${delta}` : `${delta}`} pts</strong> depuis le {fmtFr(previous!.date)}
            </span>
          )}
          {/* Point de départ affiché quand la tâche n'a pas encore été vérifiée aujourd'hui */}
          {prev !== undefined && !checked && planned === undefined && (
            <span style={{ color: 'var(--muted)' }}>Dernier constat : {prev}% — {fmtFr(previous!.date)}</span>
          )}
        </div>
      )}

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

      {/* Formulaire sous-tâche inline */}
      {subForm && onAddSubTask && (
        <div style={{ margin: '4px 0 10px', padding: '10px 12px', borderRadius: '10px', border: '1px solid #bae6fd', background: '#f0f9ff' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Plus size={12} />↳ Nouvelle sous-tâche
          </div>
          {subAdded && (
            <div style={{ fontSize: '11px', color: 'var(--ok)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={12} /> « {subAdded} » ajoutée au planning.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              autoFocus
              value={subForm.title}
              placeholder="Intitulé de la sous-tâche"
              onChange={e => setSubForm({ ...subForm, title: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') submitSubTask(); if (e.key === 'Escape') setSubForm(null) }}
              style={{ ...input, fontSize: '12px' }}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Début
                <input type="date" value={subForm.start} onChange={e => setSubForm({ ...subForm, start: e.target.value })} style={{ ...input, fontSize: '12px' }} />
              </label>
              <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Durée (j)
                <input type="number" min={1} value={subForm.duration} onChange={e => setSubForm({ ...subForm, duration: e.target.value })} style={{ ...input, width: '54px', fontSize: '12px' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={submitSubTask}
                disabled={!subForm.title.trim()}
                style={{ ...ghostBtn, background: subForm.title.trim() ? '#0284c7' : '#e5e7eb', color: subForm.title.trim() ? '#fff' : 'var(--muted)', border: 'none', fontWeight: 700 }}
              >
                Ajouter
              </button>
              <button onClick={() => setSubForm(null)} style={ghostBtn}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          {/* P1 — Deux inputs distincts : appareil photo vs galerie */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
          <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />

          {/* Three things to declare, reachable in one tap each */}
          {panel === null && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setPanel('photo')} style={actBtn('#02457A')}>
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

          {/* Sélecteur photo : appareil photo ou galerie */}
          {panel === 'photo' && (
            <div style={{ ...panelBox, borderColor: '#bae6fd', background: '#f0f9ff' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '10px' }}>Ajouter une photo</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => cameraRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 14px', borderRadius: '10px', border: '1px solid #7dd3fc', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#0369a1' }}
                >
                  <Camera size={20} color="#0369a1" />
                  <span>📷 Prendre une photo</span>
                </button>
                <button
                  onClick={() => galleryRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 14px', borderRadius: '10px', border: '1px solid #a5f3fc', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#0e7490' }}
                >
                  <ImageIcon size={20} color="#0e7490" />
                  <span>🖼 Choisir une photo existante</span>
                </button>
              </div>
              <button onClick={() => setPanel(null)} style={{ ...ghostBtn, marginTop: '10px', width: '100%', justifyContent: 'center' }}>Annuler</button>
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

/**
 * Repère vertical posé sur le curseur d'avancement. Le pouce fait 24px : son
 * centre va de 12px (0 %) à largeur−12px (100 %), d'où le calc d'alignement.
 */
function SliderMark({ pct, color, title }: { pct: number; color: string; title: string }) {
  return (
    <div
      title={title}
      style={{
        position: 'absolute', top: '-2px', bottom: '-2px',
        left: `calc(12px + (100% - 24px) * ${pct} / 100)`,
        width: '3px', marginLeft: '-1.5px', background: color, borderRadius: '2px',
        boxShadow: '0 0 0 1.5px rgba(255,255,255,.95)', pointerEvents: 'none', zIndex: 2,
      }}
    />
  )
}

const markDot = (color: string): React.CSSProperties => ({
  width: '8px', height: '8px', borderRadius: '2px', background: color, display: 'inline-block', flexShrink: 0,
})

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
