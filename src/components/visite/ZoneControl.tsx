import { useState, useRef } from 'react'
import {
  ChevronRight, ChevronLeft, Camera, Pencil, Trash2, AlertTriangle, Ban, Check,
  Eye, Flag,
} from 'lucide-react'
import {
  VisitZone, lotGroups, tasksState, tasksWorksProgress,
  zoneState, zoneWorksProgress, zoneControlProgress,
} from '../../lib/visits'
import { Reserve, ReservePriority, FollowUpStatus, reserveKind } from '../../lib/reserves'
import { VisitPhoto } from '../../lib/photoStore'
import { Annotation } from '../../lib/annotations'
import { PhotoAnnotator } from './PhotoAnnotator'
import { CarriedPoints } from './CarriedPoints'
import type { LotContact } from '../../lib/repo'
import {
  ZONE_META, lotLabel, lotCompany, fmtFr,
  sectionLabel, badge, input, ghostBtn, linkBtn, navBtn, thumbBtn, bigBtnInline,
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
  photos: VisitPhoto[]
  carriedPoints: Reserve[]
  visitReserves: Reserve[]
  readOnly: boolean
  isLast: boolean
  onOpenLot: (lotId: string) => void
  onUpdateZone: (fn: (z: VisitZone) => VisitZone) => void
  onAddRemark: (r: RemarkInput) => void
  onRemoveRemark: (id: string) => void
  onFollowUp: (reserveId: string, status: FollowUpStatus, dueDate?: string) => void
  onAddPhoto: (lotId: string | undefined, file: File) => void
  onUpdatePhoto: (p: VisitPhoto) => void
  onRemovePhoto: (id: string) => void
  onBack: () => void
  onPrev: (() => void) | null
  onCloseZone: () => void
}

/** A logement: its lots as a list, plus everything recorded at zone level. */
export function ZoneControl(props: Props) {
  const { zone, lots, photos, carriedPoints, visitReserves, readOnly, isLast,
    onOpenLot, onUpdateZone, onAddRemark, onRemoveRemark, onFollowUp, onAddPhoto, onUpdatePhoto, onRemovePhoto,
    onBack, onPrev, onCloseZone } = props

  const groups = lotGroups(zone)
  const st = ZONE_META[zoneState(zone)]
  const zoneRemarks = visitReserves.filter(r => r.logementId === zone.refId)

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

      <CarriedPoints points={carriedPoints} readOnly={readOnly} onFollowUp={onFollowUp} />

      <div style={sectionLabel}>Lots ({groups.length})</div>
      {groups.length === 0 && <Empty>Aucune tâche planifiée sur cette zone — vous pouvez tout de même y ajouter des remarques et des photos.</Empty>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {groups.map(g => {
          const gs = ZONE_META[tasksState(g.tasks)]
          const pct = tasksWorksProgress(g.tasks)
          const blocked = g.tasks.filter(t => t.state === 'blocked').length
          return (
            <button key={g.lotId} onClick={() => onOpenLot(g.lotId)}
              style={{ padding: '13px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)' }}>{g.lotId} — {lotLabel(lots, g.lotId)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    {g.tasks.length} tâche{g.tasks.length > 1 ? 's' : ''} · {lotCompany(lots, g.lotId) ?? '—'}
                    {blocked > 0 && <span style={{ color: '#b91c1c', fontWeight: 700 }}> · {blocked} bloquée{blocked > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <strong style={{ fontSize: '16px', color: 'var(--navy)' }}>{pct}%</strong>
                <span style={{ ...badge, background: gs.bg, color: gs.fg }}>{gs.label}</span>
                <ChevronRight size={16} color="var(--muted)" />
              </div>
              <Bar value={pct} />
            </button>
          )
        })}
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
          <button onClick={() => setOverride('to_review')}
            style={zonePill(zone.override === 'to_review', '#b45309', '#fef3c7')}>
            <AlertTriangle size={14} /> Zone à revoir
          </button>
          <button onClick={() => setOverride('blocked')}
            style={zonePill(zone.override === 'blocked', '#b91c1c', '#fee2e2')}>
            <Ban size={14} /> Zone bloquée
          </button>
        </div>
      )}

      {zoneRemarks.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={sectionLabel}>Relevé de cette visite ({zoneRemarks.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {zoneRemarks.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px' }}>
                {reserveKind(r) === 'observation' ? <Eye size={13} color="#5b7183" /> : <Flag size={13} color="#b45309" />}
                <span style={{ flex: 1 }}>{r.description}</span>
                {r.dueDate && <span style={{ fontSize: '10px', color: '#b45309' }}>{fmtFr(r.dueDate)}</span>}
                {!readOnly && (
                  <button onClick={() => { if (window.confirm('Supprimer cette remarque ?')) onRemoveRemark(r.id) }}
                    title="Supprimer"
                    style={{ display: 'flex', border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px' }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <ZoneRemarkButtons
          lots={lots}
          lotIds={groups.map(g => g.lotId)}
          onAddRemark={onAddRemark}
        />
      )}

      <ZonePhotos
        photos={photos.filter(p => !p.taskId)}
        lots={lots}
        readOnly={readOnly}
        onAdd={onAddPhoto}
        onUpdate={onUpdatePhoto}
        onRemove={onRemovePhoto}
      />

      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        {onPrev && <button onClick={onPrev} style={{ ...navBtn, flex: '0 0 auto', padding: '14px' }}><ChevronLeft size={16} /> Précédent</button>}
        <button onClick={onCloseZone} style={{ ...bigBtnInline, flex: 1, padding: '15px', background: zone.closedAt ? 'var(--muted)' : 'var(--ok)' }}>
          <Check size={17} /> {zone.closedAt ? 'Logement terminé' : 'Terminer'}{isLast ? '' : ' et suivant'}
        </button>
      </div>
    </div>
  )
}

const zonePill = (on: boolean, fg: string, bg: string): React.CSSProperties => ({
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  padding: '12px 6px', borderRadius: '9px',
  border: on ? `2px solid ${fg}` : '1px solid var(--line)',
  background: on ? bg : '#fff', color: on ? fg : 'var(--muted)',
  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
})

// ── Zone-level remarks (not tied to one task) ────────────────────────────────

function ZoneRemarkButtons({ lots, lotIds, onAddRemark }: {
  lots: LotContact[]; lotIds: string[]; onAddRemark: (r: RemarkInput) => void
}) {
  const [panel, setPanel] = useState<null | 'observation' | 'action'>(null)
  const [lot, setLot] = useState(lotIds[0] ?? lots[0]?.id ?? '')
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const choices = lotIds.length ? lotIds : lots.map(l => l.id)

  const submit = () => {
    if (!text.trim() || !panel) return
    onAddRemark({
      kind: panel, description: text.trim(), lotId: lot,
      dueDate: panel === 'action' ? (due || undefined) : undefined,
      priority: panel === 'action' ? 'medium' : 'low',
    })
    setText(''); setDue(''); setPanel(null)
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={() => setPanel(p => p === 'observation' ? null : 'observation')} style={{ ...ghostBtn, flex: 1, justifyContent: 'center', padding: '12px' }}>
          <Eye size={15} /> Observation
        </button>
        <button onClick={() => setPanel(p => p === 'action' ? null : 'action')} style={{ ...ghostBtn, flex: 1, justifyContent: 'center', padding: '12px' }}>
          <Flag size={15} /> Action
        </button>
      </div>

      {panel && (
        <div style={{ marginTop: '8px', padding: '11px', borderRadius: '10px', background: '#f8fafc', border: '1px solid var(--line)' }}>
          <select value={lot} onChange={e => setLot(e.target.value)} style={{ ...input, width: '100%', marginBottom: '8px' }}>
            {choices.map(id => <option key={id} value={id}>{id} — {lotLabel(lots, id)}</option>)}
          </select>
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
            placeholder={panel === 'observation' ? 'Constat sur la zone…' : 'Action à réaliser sur la zone…'}
            style={{ ...input, width: '100%', minHeight: '54px', resize: 'vertical', marginBottom: '8px' }} />
          {panel === 'action' && (
            <input type="date" value={due} onChange={e => setDue(e.target.value)} title="Échéance"
              style={{ ...input, width: '100%', marginBottom: '8px' }} />
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setPanel(null)} style={linkBtn}>Annuler</button>
            <button disabled={!text.trim()} onClick={submit}
              style={{ ...bigBtnInline, background: panel === 'action' ? '#b45309' : 'var(--navy)', padding: '10px 14px', fontSize: '13px', opacity: text.trim() ? 1 : 0.5 }}>
              Ajouter
            </button>
          </div>
        </div>
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
