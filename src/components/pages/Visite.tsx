import { useState, useEffect } from 'react'
import {
  Plus, Calendar, ChevronRight, ArrowLeft, ImageIcon, StickyNote, Clock,
  CheckCircle2, AlertTriangle, Lock, Send, FileText, Printer, Users, Eye, Flag,
} from 'lucide-react'
import {
  Visit, VisitZone, VisitKind, ZoneRef, Role, ROLES, Participant,
  VISIT_KIND_LABEL, zoneState, zoneWorksProgress, zoneControlProgress,
  visitCounts, visitWorksProgress, visitControlProgress, remainingToControl, visitLotIds,
  reservesForVisit, generalNotes, notesForCompany, nextZoneRef, previousObservation,
  visitStats, visitChanges, progressGap, type ChangeKind,
  buildZonesFromPlanning, applyVisitToPlanning, commitmentsFromVisit,
  buildPlanningSnapshot, newVisit, emptyCr,
} from '../../lib/visits'
import { DateCommitment, withoutVisit, commitmentsForTask } from '../../lib/commitments'
import {
  Reserve, FollowUpStatus, carriedOverPoints, applyFollowUp, nextReserveNumber, reserveKind,
} from '../../lib/reserves'
import type { RemarkInput } from '../visite/ZoneControl'
import {
  getVisits, saveVisits, getReserves, saveReserves, getGanttTasks, saveGanttTasks,
  getCommitments, saveCommitments, getLotsConfig, logActivity, ZONE_REFS, type LotContact,
} from '../../lib/repo'
import { VisitPhoto, listPhotos, savePhoto, deletePhoto, fileToDataUrl } from '../../lib/photoStore'
import { summarizeAnnotations } from '../../lib/annotations'
import { ZoneControl } from '../visite/ZoneControl'
import { SessionNotes } from '../visite/SessionNotes'
import {
  ZONE_META, STATUS_META, KIND_META, PRIORITY_META, lotLabel, lotCompany, fmtFr, todayIso,
  bigBtn, bigBtnInline, sectionLabel, visitCard, zoneRow, badge, input, ghostBtn, linkBtn,
  tableStyle, thStyle, tdStyle, pStyle,
} from '../visite/visiteStyles'
import { Field, Empty, Stat, Bar } from '../visite/visiteBits'

const isLocked = (v: Visit) => v.status === 'diffuse' || v.status === 'verrouille'
const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDuration = (min: number | null) => min === null ? '—' : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`

type View = 'list' | 'create' | 'session' | 'notes' | 'cr' | 'report'

export function Visite() {
  const [visits, setVisits] = useState<Visit[]>(getVisits)
  const [reserves, setReserves] = useState<Reserve[]>(getReserves)
  const [commitments, setCommitments] = useState<DateCommitment[]>(getCommitments)
  const [lots] = useState<LotContact[]>(getLotsConfig)
  const [photos, setPhotos] = useState<VisitPhoto[]>([])
  const [view, setView] = useState<View>('list')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeZone, setActiveZone] = useState<string | null>(null)

  // Auto-save as you go — nothing is ever lost between two taps.
  useEffect(() => { saveVisits(visits) }, [visits])
  useEffect(() => { saveReserves(reserves) }, [reserves])

  const reloadPhotos = (visitId: string) => { listPhotos(visitId).then(setPhotos).catch(() => setPhotos([])) }
  useEffect(() => { if (activeId) reloadPhotos(activeId); else setPhotos([]) }, [activeId])

  const active = visits.find(v => v.id === activeId) ?? null

  const updateVisit = (id: string, patch: Partial<Visit> | ((v: Visit) => Visit)) =>
    setVisits(prev => prev.map(v => v.id !== id ? v : (typeof patch === 'function' ? patch(v) : { ...v, ...patch })))

  const updateZone = (refId: string, fn: (z: VisitZone) => VisitZone) =>
    active && updateVisit(active.id, v => ({ ...v, zones: v.zones.map(z => z.refId === refId ? fn(z) : z) }))

  const addPhoto = async (zone: VisitZone, lotId: string | undefined, taskId: string | undefined, file: File) => {
    if (!activeId) return
    const original = await fileToDataUrl(file)
    await savePhoto({
      id: `ph${Date.now()}`, visitId: activeId, zoneRefId: zone.refId, zoneLabel: zone.label,
      lotId, taskId, original, annotations: [], includeInCr: true, order: photos.length,
      createdAt: new Date().toISOString(),
    })
    reloadPhotos(activeId)
  }
  const updatePhoto = async (p: VisitPhoto) => { await savePhoto(p); if (activeId) reloadPhotos(activeId) }
  const removePhoto = async (id: string) => { await deletePhoto(id); if (activeId) reloadPhotos(activeId) }

  /** Observations and actions raised on the spot, always carrying their context. */
  const addRemark = (v: Visit, zone: VisitZone, r: RemarkInput) =>
    setReserves(prev => [{
      id: `r${Date.now()}`,
      number: nextReserveNumber(prev),
      kind: r.kind,
      lotId: r.lotId,
      taskId: r.taskId,
      logementId: zone.refId,
      description: r.description,
      priority: r.priority,
      status: 'open',
      createdAt: new Date().toISOString(),
      dueDate: r.dueDate,
      visitId: v.id,
      company: lotCompany(lots, r.lotId),
    }, ...prev])

  /** Settling a point left open by an earlier session — history is appended. */
  const followUp = (v: Visit, reserveId: string, status: FollowUpStatus, dueDate?: string) =>
    setReserves(prev => prev.map(r => r.id !== reserveId ? r : applyFollowUp(r, {
      at: new Date().toISOString(), visitId: v.id, visitDate: v.date, status, dueDate,
    })))

  /** Companies concerned by the session, read from the lots actually planned. */
  const companiesOf = (v: Visit) =>
    [...new Set(visitLotIds(v).map(id => lotCompany(lots, id)).filter((c): c is string => !!c))].sort()

  const openVisit = (v: Visit) => {
    setActiveId(v.id); setActiveZone(null)
    setView(v.status === 'en_cours' ? 'session' : v.status === 'diffuse' || v.status === 'verrouille' ? 'report' : 'cr')
  }

  /**
   * Closing the session: what was observed is written onto the planning, the
   * date promises are appended to the log, and only THEN is the planning frozen
   * — so the CR shows the chantier as it stood at the end of the tour.
   */
  const terminate = (v: Visit) => {
    const updated = applyVisitToPlanning(getGanttTasks(), v)
    saveGanttTasks(updated)
    const nextCommitments = [...withoutVisit(getCommitments(), v.id), ...commitmentsFromVisit(v)]
    saveCommitments(nextCommitments)
    setCommitments(nextCommitments)
    updateVisit(v.id, prev => ({
      ...prev, status: 'terminee', endedAt: new Date().toISOString(),
      snapshot: buildPlanningSnapshot(updated, new Date()), cr: prev.cr ?? emptyCr(),
    }))
    logActivity('visit', `${VISIT_KIND_LABEL[v.kind]} du ${fmtFr(v.date)} terminée — planning mis à jour et figé`)
    setView('cr')
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  if (view === 'create') {
    return <CreateSession lots={lots} onCancel={() => setView('list')} onCreate={v => {
      setVisits(prev => [v, ...prev]); setActiveId(v.id); setActiveZone(null); setView('session')
      logActivity('visit', `${VISIT_KIND_LABEL[v.kind]} du ${fmtFr(v.date)} démarrée`)
    }} />
  }

  // ── Zone control ───────────────────────────────────────────────────────────
  if (view === 'session' && active && activeZone) {
    const zone = active.zones.find(z => z.refId === activeZone)
    if (zone) {
      const idx = active.zones.findIndex(z => z.refId === activeZone)
      const next = nextZoneRef(active, activeZone)
      const control = <ZoneControl
        zone={zone}
        lots={lots}
        commitments={commitments}
        photos={photos.filter(p => p.zoneRefId === zone.refId)}
        carriedPoints={carriedOverPoints(reserves, zone.refId, active.id)}
        visitReserves={reservesForVisit(reserves, active.id)}
        readOnly={active.status !== 'en_cours'}
        isLast={next === null}
        previousOf={taskId => previousObservation(visits, active, taskId)}
        onUpdateZone={fn => updateZone(zone.refId, fn)}
        onAddRemark={r => addRemark(active, zone, r)}
        onFollowUp={(id, status, dueDate) => followUp(active, id, status, dueDate)}
        onAddPhoto={(lotId, taskId, file) => addPhoto(zone, lotId, taskId, file)}
        onUpdatePhoto={updatePhoto}
        onRemovePhoto={removePhoto}
        onBack={() => setActiveZone(null)}
        onPrev={idx > 0 ? () => setActiveZone(active.zones[idx - 1].refId) : null}
        onCloseZone={() => {
          updateZone(zone.refId, z => ({ ...z, closedAt: z.closedAt ?? new Date().toISOString() }))
          setActiveZone(next)
        }}
      />
      return <><TourBar visit={active} zoneRef={activeZone} />{control}</>
    }
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  if (view === 'session' && active) {
    const counts = visitCounts(active)
    const visitReserves = reservesForVisit(reserves, active.id).filter(r => r.status === 'open')
    const buildings = [...new Set(active.zones.map(z => z.buildingId))]
    const remaining = remainingToControl(active)
    const pendingElsewhere = active.zones.reduce((n, z) => n + carriedOverPoints(reserves, z.refId, active.id).length, 0)

    return (
      <>
      {active.status === 'en_cours' && <TourBar visit={active} zoneRef={null} />}
      <div style={{ padding: '12px', paddingBottom: '90px' }}>
        <button onClick={() => setView('list')} style={{ ...linkBtn, marginBottom: '8px' }}>← Toutes les sessions</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ ...badge, background: KIND_META[active.kind].bg, color: KIND_META[active.kind].fg }}>{KIND_META[active.kind].short}</span>
          <h2 style={{ margin: 0, flex: 1 }}>{fmtFr(active.date)}</h2>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
          {active.title ?? VISIT_KIND_LABEL[active.kind]} • {counts.total} zones • {active.participants.length} présents
          {active.startedAt && <> • démarrée à {fmtTime(active.startedAt)}</>}
        </div>

        <div style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>
              <span>Travaux constatés</span><strong style={{ color: 'var(--navy)', fontSize: '14px' }}>{visitWorksProgress(active)}%</strong>
            </div>
            <Bar value={visitWorksProgress(active)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>
              <span>Tournée</span><strong style={{ color: 'var(--navy)', fontSize: '14px' }}>{visitControlProgress(active)}%</strong>
            </div>
            <Bar value={visitControlProgress(active)} color="#16a34a" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: '8px', marginBottom: '16px' }}>
          <Stat n={counts.done} label="Terminés" dot={ZONE_META.done.dot} />
          <Stat n={counts.in_progress} label="En cours" dot={ZONE_META.in_progress.dot} />
          <Stat n={counts.to_review} label="À revoir" dot={ZONE_META.to_review.dot} />
          <Stat n={counts.blocked} label="Bloqués" dot={ZONE_META.blocked.dot} />
          <Stat n={counts.not_started} label="Non commencés" dot={ZONE_META.not_started.dot} />
        </div>

        {buildings.map(bid => {
          const zones = active.zones.filter(z => z.buildingId === bid)
          return (
            <div key={bid} style={{ marginBottom: '14px' }}>
              <div style={sectionLabel}>{zones[0].buildingLabel}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {zones.map(z => {
                  const m = ZONE_META[zoneState(z)]
                  const carried = carriedOverPoints(reserves, z.refId, active.id).length
                  return (
                    <button key={z.refId} onClick={() => setActiveZone(z.refId)} style={zoneRow}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>{z.label}</div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Travaux {zoneWorksProgress(z)}% · Contrôle {zoneControlProgress(z)}%</div>
                      </div>
                      {carried > 0 && (
                        <span title={`${carried} point(s) non levé(s)`} style={{ ...badge, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <AlertTriangle size={10} />{carried}
                        </span>
                      )}
                      <span style={{ ...badge, background: m.bg, color: m.fg }}>{m.label}</span>
                      <ChevronRight size={14} color="var(--muted)" />
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {visitReserves.length > 0 && (
          <>
            <div style={sectionLabel}>Relevé de la session ({visitReserves.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {visitReserves.map(r => (
                <button key={r.id} onClick={() => setActiveZone(r.logementId)} style={{ ...zoneRow, alignItems: 'flex-start' }}>
                  {reserveKind(r) === 'observation'
                    ? <Eye size={14} color="#5b7183" style={{ marginTop: '2px', flexShrink: 0 }} />
                    : <Flag size={14} color="#b45309" style={{ marginTop: '2px', flexShrink: 0 }} />}
                  <span style={{ flex: 1, textAlign: 'left', fontSize: '12px' }}>
                    <strong style={{ color: 'var(--navy)' }}>{r.number}</strong> {r.description}
                    <span style={{ color: 'var(--muted)' }}> · {r.logementId} · {lotLabel(lots, r.lotId)}</span>
                    {r.dueDate && <span style={{ color: '#b45309' }}> · échéance {fmtFr(r.dueDate)}</span>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {pendingElsewhere > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fcd34d', fontSize: '12px', color: '#b45309', marginBottom: '16px' }}>
            <AlertTriangle size={14} />
            {pendingElsewhere} point{pendingElsewhere > 1 ? 's' : ''} des visites précédentes reste{pendingElsewhere > 1 ? 'nt' : ''} à statuer — ils apparaissent dans les logements concernés.
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <div style={{ ...zoneRow, cursor: 'default', flex: 1 }}>
            <ImageIcon size={15} color="var(--muted)" />
            <span style={{ fontSize: '12px' }}><strong style={{ color: 'var(--navy)' }}>{photos.length}</strong> photo{photos.length > 1 ? 's' : ''}</span>
          </div>
          <button onClick={() => setView('notes')} style={{ ...zoneRow, flex: 1 }}>
            <StickyNote size={15} color="var(--muted)" />
            <span style={{ flex: 1, textAlign: 'left', fontSize: '12px' }}><strong style={{ color: 'var(--navy)' }}>{active.notes.length}</strong> note{active.notes.length > 1 ? 's' : ''}</span>
            <ChevronRight size={14} color="var(--muted)" />
          </button>
        </div>

        {active.status === 'en_cours' && (
          <button
            onClick={() => {
              if (remaining.length > 0 && !window.confirm(`${remaining.length} zone(s) ne sont pas entièrement contrôlées. Terminer et enregistrer quand même ?`)) return
              terminate(active)
            }}
            style={{ ...bigBtn, background: 'var(--ok)' }}
          >
            <CheckCircle2 size={17} /> Terminer et enregistrer
          </button>
        )}
      </div>
      </>
    )
  }

  // ── Notes ──────────────────────────────────────────────────────────────────
  if (view === 'notes' && active) {
    return (
      <div style={{ padding: '12px', paddingBottom: '90px' }}>
        <button onClick={() => setView(active.status === 'en_cours' ? 'session' : 'cr')} style={{ ...linkBtn, marginBottom: '10px' }}>
          <ArrowLeft size={15} /> Retour
        </button>
        <h2 style={{ margin: '0 0 2px' }}>Notes de fin de {KIND_META[active.kind].short.toLowerCase()}</h2>
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px' }}>
          Adressez une note à tout le monde ou à une entreprise en particulier.
        </p>
        <SessionNotes
          notes={active.notes}
          companies={companiesOf(active)}
          readOnly={isLocked(active)}
          onAdd={n => updateVisit(active.id, v => ({ ...v, notes: [...v.notes, n] }))}
          onRemove={id => updateVisit(active.id, v => ({ ...v, notes: v.notes.filter(n => n.id !== id) }))}
        />
      </div>
    )
  }

  // ── CR ─────────────────────────────────────────────────────────────────────
  if (view === 'cr' && active) {
    return <CrEditor
      visit={active}
      lots={lots}
      reserves={reservesForVisit(reserves, active.id)}
      photos={photos}
      companies={companiesOf(active)}
      onBack={() => setView('list')}
      onUpdate={fn => updateVisit(active.id, fn)}
      onUpdatePhoto={updatePhoto}
      onNotes={() => setView('notes')}
      onValidate={() => updateVisit(active.id, { status: 'cr_pret' })}
      onReopen={() => updateVisit(active.id, { status: 'terminee' })}
      onDiffuse={() => {
        updateVisit(active.id, { status: 'diffuse', diffusedAt: new Date().toISOString() })
        logActivity('doc', `CR de la ${VISIT_KIND_LABEL[active.kind].toLowerCase()} du ${fmtFr(active.date)} diffusé`)
        setView('report')
      }}
      onReport={() => setView('report')}
    />
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  if (view === 'report' && active) {
    return <Report
      visit={active}
      visits={visits}
      lots={lots}
      reserves={reservesForVisit(reserves, active.id)}
      allReserves={reserves}
      photos={photos}
      commitments={commitments}
      companies={companiesOf(active)}
      onBack={() => setView(isLocked(active) ? 'list' : 'cr')}
    />
  }

  // ── List ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <button onClick={() => setView('create')} style={bigBtn}>
        <Plus size={18} /> Nouvelle visite ou réunion
      </button>

      <div style={sectionLabel}>Sessions</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visits.length === 0 && <Empty>Aucune session. Démarrez une visite ou une réunion de chantier.</Empty>}
        {visits.map(v => {
          const c = visitCounts(v)
          const st = STATUS_META[v.status]
          const k = KIND_META[v.kind]
          return (
            <button key={v.id} onClick={() => openVisit(v)} style={visitCard}>
              <Calendar size={18} color="var(--muted)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ ...badge, background: k.bg, color: k.fg }}>{k.short}</span>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--navy)' }}>{fmtFr(v.date)}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  {v.title ? `${v.title} • ` : ''}{c.total} zones • travaux {visitWorksProgress(v)}% • tournée {visitControlProgress(v)}%
                </div>
              </div>
              <span style={{ ...badge, background: st.bg, color: st.fg }}>{st.label}</span>
              <ChevronRight size={14} color="var(--muted)" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Create
// ═══════════════════════════════════════════════════════════════════════════

function CreateSession({ lots, onCancel, onCreate }: { lots: LotContact[]; onCancel: () => void; onCreate: (v: Visit) => void }) {
  const [kind, setKind] = useState<VisitKind>('visite')
  const [date, setDate] = useState(todayIso())
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [pName, setPName] = useState('')
  const [pRole, setPRole] = useState<Role>('MOE')
  const [companies, setCompanies] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set(ZONE_REFS.map(r => r.refId)))

  const allCompanies = [...new Set(lots.map(l => l.company))].sort()
  const toggleCompany = (c: string) => setCompanies(prev => {
    const n = new Set(prev)
    if (n.has(c)) n.delete(c); else n.add(c)
    return n
  })

  const buildings = [...new Set(ZONE_REFS.map(r => r.buildingId))]
  const toggle = (refId: string) => setSelected(prev => {
    const n = new Set(prev)
    if (n.has(refId)) n.delete(refId); else n.add(refId)
    return n
  })
  const toggleBuilding = (bid: string) => {
    const refs = ZONE_REFS.filter(r => r.buildingId === bid).map(r => r.refId)
    const allOn = refs.every(r => selected.has(r))
    setSelected(prev => {
      const n = new Set(prev)
      refs.forEach(r => allOn ? n.delete(r) : n.add(r))
      return n
    })
  }
  const addP = () => {
    if (!pName.trim()) return
    setParticipants(prev => [...prev, { id: `p${Date.now()}`, name: pName.trim(), role: pRole }])
    setPName('')
  }

  const create = () => {
    const refs: ZoneRef[] = ZONE_REFS.filter(r => selected.has(r.refId))
    onCreate(newVisit({
      kind, date, participants, title, brief,
      companiesPresent: [...companies],
      zones: buildZonesFromPlanning(getGanttTasks(), refs),
    }))
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <button onClick={onCancel} style={{ ...linkBtn, marginBottom: '10px' }}><ArrowLeft size={15} /> Retour</button>
      <h2 style={{ margin: '0 0 16px' }}>Nouvelle session</h2>

      <Field label="Type de session">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {(['visite', 'reunion', 'technique', 'opl'] as VisitKind[]).map(k => (
            <button key={k} onClick={() => setKind(k)} style={{
              padding: '14px 10px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
              border: kind === k ? `2px solid ${KIND_META[k].fg}` : '1px solid var(--line)',
              background: kind === k ? KIND_META[k].bg : '#fff',
              color: kind === k ? KIND_META[k].fg : 'var(--muted)',
            }}>
              {VISIT_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Date">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...input, width: '100%' }} />
      </Field>
      <Field label="Objet (facultatif)">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex. Visite hebdomadaire" style={{ ...input, width: '100%' }} />
      </Field>

      <Field label={`Intervenants présents (${participants.length})`}>
        {participants.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
            <span style={{ ...badge, background: '#eef2f6', color: '#02457A' }}>{p.role}</span>
            <span style={{ flex: 1, fontSize: '13px' }}>{p.name}</span>
            <button onClick={() => setParticipants(prev => prev.filter(x => x.id !== p.id))} style={linkBtn}>Retirer</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
          <input value={pName} onChange={e => setPName(e.target.value)} placeholder="Nom" style={{ ...input, flex: '2 1 140px' }}
            onKeyDown={e => { if (e.key === 'Enter') addP() }} />
          <select value={pRole} onChange={e => setPRole(e.target.value as Role)} style={{ ...input, flex: '1 1 120px' }}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={addP} style={ghostBtn}><Plus size={14} /></button>
        </div>
      </Field>

      <Field label={`Entreprises présentes (${companies.size})`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {allCompanies.map(c => (
            <button key={c} onClick={() => toggleCompany(c)} style={{
              padding: '9px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              border: companies.has(c) ? '2px solid #02457A' : '1px solid var(--line)',
              background: companies.has(c) ? 'var(--sky-soft)' : '#fff',
              color: companies.has(c) ? '#02457A' : 'var(--muted)',
            }}>
              {c}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Observations générales (facultatif)">
        <textarea value={brief} onChange={e => setBrief(e.target.value)}
          placeholder="Contexte, météo, accès, points à aborder…"
          style={{ ...input, width: '100%', minHeight: '56px', resize: 'vertical' }} />
      </Field>

      <Field label={`Zones à parcourir (${selected.size})`}>
        {buildings.map(bid => {
          const refs = ZONE_REFS.filter(r => r.buildingId === bid)
          const allOn = refs.every(r => selected.has(r.refId))
          return (
            <div key={bid} style={{ marginBottom: '10px' }}>
              <button onClick={() => toggleBuilding(bid)} style={{ ...linkBtn, marginBottom: '6px' }}>
                {refs[0].buildingLabel} — {allOn ? 'tout décocher' : 'tout cocher'}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {refs.map(r => (
                  <label key={r.refId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: selected.has(r.refId) ? 'var(--ok-bg)' : '#fff', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.has(r.refId)} onChange={() => toggle(r.refId)} />
                    <span style={{ fontSize: '13px' }}>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </Field>

      <button onClick={create} disabled={selected.size === 0} style={{ ...bigBtn, opacity: selected.size === 0 ? 0.5 : 1 }}>
        Démarrer la visite →
      </button>
      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '-12px', textAlign: 'center' }}>
        L'heure de début est enregistrée automatiquement.
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CR editor
// ═══════════════════════════════════════════════════════════════════════════

function CrEditor(props: {
  visit: Visit
  lots: LotContact[]
  reserves: Reserve[]
  photos: VisitPhoto[]
  companies: string[]
  onBack: () => void
  onUpdate: (fn: (v: Visit) => Visit) => void
  onUpdatePhoto: (p: VisitPhoto) => void
  onNotes: () => void
  onValidate: () => void
  onDiffuse: () => void
  onReopen: () => void
  onReport: () => void
}) {
  const { visit, lots, reserves, photos, companies, onBack, onUpdate, onUpdatePhoto, onNotes, onValidate, onDiffuse, onReopen, onReport } = props
  const cr = visit.cr ?? emptyCr()
  const locked = isLocked(visit)
  const setCr = (patch: Partial<typeof cr>) => onUpdate(v => ({ ...v, cr: { ...(v.cr ?? emptyCr()), ...patch } }))

  return (
    <div style={{ padding: '12px', paddingBottom: '90px' }}>
      <button onClick={onBack} style={{ ...linkBtn, marginBottom: '8px' }}>← Toutes les sessions</button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <h2 style={{ margin: '0 0 2px' }}>Compte rendu — {fmtFr(visit.date)}</h2>
        <span style={{ ...badge, background: STATUS_META[visit.status].bg, color: STATUS_META[visit.status].fg }}>{STATUS_META[visit.status].label}</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 6px' }}>
        {VISIT_KIND_LABEL[visit.kind]} — {locked ? 'document diffusé, verrouillé.' : 'brouillon éditable, relisez puis validez avant diffusion.'}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)', marginBottom: '14px' }}>
        <Clock size={12} /> {fmtTime(visit.startedAt)} → {fmtTime(visit.endedAt)} · {fmtDuration(visitStats(visit, reserves, photos.length).durationMin)}
      </div>

      {locked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#ede9fe', color: '#6d28d9', fontSize: '12px', fontWeight: 600, marginBottom: '14px' }}>
          <Lock size={14} /> Diffusé le {visit.diffusedAt ? new Date(visit.diffusedAt).toLocaleDateString('fr') : '—'}. Modification réservée à un administrateur.
        </div>
      )}

      <Field label="Synthèse">
        <textarea disabled={locked} value={cr.synthese} onChange={e => setCr({ synthese: e.target.value })}
          placeholder="Résumé général de la session…" style={{ ...input, width: '100%', minHeight: '70px', resize: 'vertical' }} />
      </Field>

      <Field label={`Intervenants présents (${visit.participants.length})`}>
        {visit.participants.length === 0 && <Empty>Aucun intervenant renseigné.</Empty>}
        {visit.participants.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
            <select disabled={locked} value={p.role} style={{ ...input, width: '150px' }}
              onChange={e => onUpdate(v => ({ ...v, participants: v.participants.map(x => x.id === p.id ? { ...x, role: e.target.value as Role } : x) }))}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input disabled={locked} value={p.name} style={{ ...input, flex: 1 }}
              onChange={e => onUpdate(v => ({ ...v, participants: v.participants.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) }))} />
          </div>
        ))}
      </Field>

      <Field label={`Notes (${visit.notes.length})`}>
        {visit.notes.length === 0 ? <Empty>Aucune note.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {visit.notes.map(n => (
              <div key={n.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', padding: '4px 0' }}>
                <span style={{ ...badge, background: n.scope === 'all' ? '#e0f2fe' : '#ede9fe', color: n.scope === 'all' ? '#0369a1' : '#6d28d9' }}>
                  {n.scope === 'all' ? 'Tous' : n.company}
                </span>
                <span style={{ flex: 1 }}>{n.text}</span>
              </div>
            ))}
          </div>
        )}
        {!locked && (
          <button onClick={onNotes} style={{ ...ghostBtn, marginTop: '8px' }}>
            <StickyNote size={14} /> Rédiger les notes
          </button>
        )}
      </Field>

      <Field label={`Relevé de la session (${reserves.length})`}>
        {reserves.length === 0 && <Empty>Aucune observation ni action.</Empty>}
        {reserves.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: '12px' }}>
            {reserveKind(r) === 'observation'
              ? <Eye size={13} color="#5b7183" style={{ flexShrink: 0 }} />
              : <Flag size={13} color="#b45309" style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1 }}><strong style={{ color: 'var(--navy)' }}>{r.number}</strong> {r.description}
              <span style={{ color: 'var(--muted)' }}> · {r.logementId} · {lotLabel(lots, r.lotId)}</span></span>
            {r.dueDate && <span style={{ fontSize: '10px', color: '#b45309' }}>{fmtFr(r.dueDate)}</span>}
            {reserveKind(r) === 'action' && (
              <span style={{ ...badge, background: PRIORITY_META[r.priority].bg, color: PRIORITY_META[r.priority].fg }}>{PRIORITY_META[r.priority].label}</span>
            )}
          </div>
        ))}
      </Field>

      <Field label={`Photos (${photos.length}) — sélection & légendes`}>
        {photos.length === 0 && <Empty>Aucune photo.</Empty>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {photos.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', borderRadius: '8px', border: '1px solid var(--line)', background: p.includeInCr ? '#fff' : '#f7faf8', opacity: p.includeInCr ? 1 : 0.6 }}>
              <img src={p.annotated ?? p.original} alt="" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                  {p.zoneLabel}{p.lotId ? ` · ${lotLabel(lots, p.lotId)}` : ''} · {summarizeAnnotations(p.annotations)}
                </div>
                <input disabled={locked} value={p.caption ?? ''} onChange={e => onUpdatePhoto({ ...p, caption: e.target.value })}
                  placeholder="Légende…" style={{ ...input, width: '100%', padding: '6px 8px' }} />
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', fontSize: '9px', color: 'var(--muted)' }}>
                <input type="checkbox" disabled={locked} checked={p.includeInCr} onChange={e => onUpdatePhoto({ ...p, includeInCr: e.target.checked })} />
                CR
              </label>
            </div>
          ))}
        </div>
      </Field>

      <Field label="Conclusions">
        <textarea disabled={locked} value={cr.conclusions} onChange={e => setCr({ conclusions: e.target.value })}
          placeholder="Décisions, actions, points d'attention…" style={{ ...input, width: '100%', minHeight: '60px', resize: 'vertical' }} />
      </Field>
      <Field label="Prochaine réunion / visite">
        <input disabled={locked} value={cr.nextMeeting} onChange={e => setCr({ nextMeeting: e.target.value })}
          placeholder="ex. Semaine du 22/09/2026" style={{ ...input, width: '100%' }} />
      </Field>

      {companies.length > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '12px' }}>
          <Users size={12} style={{ verticalAlign: '-2px' }} /> Entreprises concernées : {companies.join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
        <button onClick={onReport} style={{ ...ghostBtn, flex: '1 1 140px', justifyContent: 'center', padding: '11px' }}><FileText size={15} /> Aperçu du CR</button>
        {!locked && visit.status === 'terminee' && <button onClick={onValidate} style={{ ...bigBtnInline, flex: '1 1 140px', background: 'var(--navy)' }}>Valider</button>}
        {!locked && visit.status === 'cr_pret' && <>
          <button onClick={onReopen} style={{ ...ghostBtn, flex: '1 1 100px', justifyContent: 'center', padding: '11px' }}>Rouvrir</button>
          <button onClick={() => { if (window.confirm('Diffuser le CR ? Il sera verrouillé.')) onDiffuse() }}
            style={{ ...bigBtnInline, flex: '1 1 140px', background: 'var(--ok)' }}><Send size={15} /> Diffuser</button>
        </>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Report (rendered from the frozen snapshot)
// ═══════════════════════════════════════════════════════════════════════════

function Report({ visit, visits, lots, reserves, allReserves, photos, commitments, companies, onBack }: {
  visit: Visit
  visits: Visit[]
  lots: LotContact[]
  reserves: Reserve[]
  allReserves: Reserve[]
  photos: VisitPhoto[]
  commitments: DateCommitment[]
  companies: string[]
  onBack: () => void
}) {
  const snap = visit.snapshot
  const cr = visit.cr ?? emptyCr()
  const crPhotos = photos.filter(p => p.includeInCr)
  const general = generalNotes(visit)
  const sessionCommitments = commitments.filter(c => c.visitId === visit.id)
  const stats = visitStats(visit, allReserves, crPhotos.length)
  const changes = visitChanges(visit, visits, allReserves)
  const observations = reserves.filter(r => reserveKind(r) === 'observation')
  const actions = reserves.filter(r => reserveKind(r) === 'action')
  const gaps = visit.zones.flatMap(z => z.tasks
    .filter(t => { const g = progressGap(t); return g !== null && g !== 0 })
    .map(t => ({ zone: z.label, task: t, gap: progressGap(t)! })))
  let s = 0  // dynamic section numbering — conditional sections never leave gaps

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--line)', background: '#fff', position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={onBack} style={linkBtn}><ArrowLeft size={15} /> Retour</button>
        <button onClick={() => window.print()} style={{ ...bigBtnInline, background: 'var(--navy)', padding: '8px 14px' }}><Printer size={15} /> Exporter PDF</button>
      </div>

      <div className="cr-print" style={{ padding: '20px', maxWidth: '780px', margin: '0 auto', background: '#fff', color: '#16222e' }}>
        <div style={{ borderBottom: '2px solid #02457A', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em', color: '#018ABE', fontWeight: 700 }}>
            Compte rendu — {VISIT_KIND_LABEL[visit.kind]}
          </div>
          <h1 style={{ margin: '4px 0', fontSize: '22px', color: '#02457A' }}>{fmtFr(visit.date)}{visit.title ? ` — ${visit.title}` : ''}</h1>
          <div style={{ fontSize: '12px', color: '#5b7183' }}>
            Gambetta — Réhabilitation • GAM-2026-001{snap ? ` • planning figé le ${new Date(snap.capturedAt).toLocaleDateString('fr')}` : ''}
          </div>
        </div>

        <RSection title={`${++s}. Informations générales`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', fontSize: '11px' }}>
            <RFact label="Horaires" value={`${fmtTime(visit.startedAt)} → ${fmtTime(visit.endedAt)}`} />
            <RFact label="Durée" value={fmtDuration(stats.durationMin)} />
            <RFact label="Bâtiments" value={String(stats.buildings)} />
            <RFact label="Logements" value={String(stats.logements)} />
            <RFact label="Tâches contrôlées" value={String(stats.tasksChecked)} />
            <RFact label="Observations" value={String(stats.observations)} />
            <RFact label="Actions" value={String(stats.actions)} />
            <RFact label="Photos" value={String(stats.photos)} />
          </div>
        </RSection>

        <RSection title={`${++s}. Intervenants présents`}>
          {visit.participants.length === 0 ? <p style={pStyle}>—</p> : (
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              {visit.participants.map(p => <li key={p.id} style={{ fontSize: '12px', marginBottom: '2px' }}><strong>{p.role}</strong> — {p.name}</li>)}
            </ul>
          )}
          {visit.companiesPresent && visit.companiesPresent.length > 0 && (
            <p style={{ ...pStyle, marginTop: '6px' }}><strong>Entreprises présentes :</strong> {visit.companiesPresent.join(', ')}</p>
          )}
        </RSection>

        {(cr.synthese || visit.brief) && (
          <RSection title={`${++s}. Synthèse`}>
            {visit.brief && <p style={{ ...pStyle, marginBottom: '6px', fontStyle: 'italic' }}>{visit.brief}</p>}
            {cr.synthese && <p style={pStyle}>{cr.synthese}</p>}
          </RSection>
        )}

        {changes.length > 0 && (
          <RSection title={`${++s}. Ce qui a changé depuis la dernière visite`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {changes.map((c, i) => {
                const m = CHANGE_META[c.kind]
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px' }}>
                    <span style={{ ...badge, background: m.bg, color: m.fg, flexShrink: 0 }}>{m.label}</span>
                    <span style={{ flex: 1 }}>
                      {c.label}
                      {c.zone && <span style={{ color: '#9bb0c2' }}> · {c.zone}</span>}
                      {c.detail && <span style={{ color: '#5b7183' }}> — {c.detail}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </RSection>
        )}

        <RSection title={`${++s}. Relevé d'avancement par zone`}>
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Bâtiment</th><th style={thStyle}>Zone</th><th style={thStyle}>Travaux</th><th style={thStyle}>Contrôle</th><th style={thStyle}>État</th></tr></thead>
            <tbody>
              {visit.zones.map(z => (
                <tr key={z.refId}>
                  <td style={tdStyle}>{z.buildingLabel}</td>
                  <td style={tdStyle}>{z.label}</td>
                  <td style={tdStyle}>{zoneWorksProgress(z)}%</td>
                  <td style={tdStyle}>{zoneControlProgress(z)}%</td>
                  <td style={tdStyle}>{ZONE_META[zoneState(z)].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </RSection>

        {sessionCommitments.length > 0 && (
          <RSection title={`${++s}. Échéances annoncées par les entreprises`}>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Lot</th><th style={thStyle}>Tâche</th><th style={thStyle}>Entreprise</th><th style={thStyle}>Échéance annoncée</th><th style={thStyle}>Précédente</th></tr></thead>
              <tbody>
                {sessionCommitments.map(c => {
                  const previous = commitmentsForTask(commitments, c.taskId).filter(x => x.visitId !== visit.id)[0]
                  const title = visit.zones.flatMap(z => z.tasks).find(t => t.taskId === c.taskId)?.title ?? c.taskId
                  return (
                    <tr key={c.id}>
                      <td style={tdStyle}>{lotLabel(lots, c.lotId)}</td>
                      <td style={tdStyle}>{title}</td>
                      <td style={tdStyle}>{lotCompany(lots, c.lotId) ?? c.company ?? '—'}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtFr(c.promisedEnd)}</td>
                      <td style={tdStyle}>{previous ? `${fmtFr(previous.promisedEnd)} (${fmtFr(previous.visitDate)})` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </RSection>
        )}

        {snap && (
          <RSection title={`${++s}. Avancement du planning (figé)`}>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <RKpi label="Avancement global" value={`${snap.overall}%`} />
              <RKpi label="Dérive max" value={`+${snap.maxDrift} j`} accent={snap.maxDrift > 0} />
              <RKpi label="Tâches en retard" value={String(snap.lateCount)} accent={snap.lateCount > 0} />
            </div>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Lot</th><th style={thStyle}>Avancement</th><th style={thStyle}>Dérive</th><th style={thStyle}>État</th></tr></thead>
              <tbody>
                {snap.lots.map(l => (
                  <tr key={l.lotId}>
                    <td style={tdStyle}>{l.title.replace(/^LOT \d+ - /, '')}</td>
                    <td style={tdStyle}>{l.progress}%</td>
                    <td style={{ ...tdStyle, color: l.drift > 0 ? '#dc2626' : '#15803d' }}>{l.drift > 0 ? `+${l.drift} j` : 'à jour'}</td>
                    <td style={tdStyle}>{l.late ? '⚠ Retard' : '✓ OK'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RSection>
        )}

        {gaps.length > 0 && (
          <RSection title={`${++s}. Écarts planning / constat`}>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Zone</th><th style={thStyle}>Tâche</th><th style={thStyle}>Prévu</th><th style={thStyle}>Constaté</th><th style={thStyle}>Écart</th></tr></thead>
              <tbody>
                {gaps.map(g => (
                  <tr key={`${g.zone}-${g.task.taskId}`}>
                    <td style={tdStyle}>{g.zone}</td>
                    <td style={tdStyle}>{g.task.title}</td>
                    <td style={tdStyle}>{g.task.plannedProgress}%</td>
                    <td style={tdStyle}>{g.task.progress}%</td>
                    <td style={{ ...tdStyle, color: g.gap < 0 ? '#dc2626' : '#15803d', fontWeight: 700 }}>{g.gap > 0 ? `+${g.gap}` : g.gap} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RSection>
        )}

        {observations.length > 0 && (
          <RSection title={`${++s}. Observations`}>
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>N°</th><th style={thStyle}>Localisation</th><th style={thStyle}>Constat</th><th style={thStyle}>Lot</th></tr></thead>
              <tbody>
                {observations.map(r => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.number}</td>
                    <td style={tdStyle}>{r.logementId}</td>
                    <td style={tdStyle}>{r.description}</td>
                    <td style={tdStyle}>{lotLabel(lots, r.lotId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RSection>
        )}

        <RSection title={`${++s}. Actions à réaliser`}>
          {actions.length === 0 ? <p style={pStyle}>Aucune action ouverte issue de cette session.</p> : (
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>N°</th><th style={thStyle}>Localisation</th><th style={thStyle}>Action</th><th style={thStyle}>Entreprise</th><th style={thStyle}>Échéance</th><th style={thStyle}>Priorité</th></tr></thead>
              <tbody>
                {actions.map(r => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.number}</td>
                    <td style={tdStyle}>{r.logementId}</td>
                    <td style={tdStyle}>{r.description}</td>
                    <td style={tdStyle}>{r.company ?? lotCompany(lots, r.lotId) ?? '—'}</td>
                    <td style={tdStyle}>{fmtFr(r.dueDate)}</td>
                    <td style={tdStyle}>{PRIORITY_META[r.priority].label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </RSection>

        {crPhotos.length > 0 && (
          <RSection title={`${++s}. Reportage photographique`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
              {crPhotos.map(p => (
                <figure key={p.id} style={{ margin: 0 }}>
                  <img src={p.annotated ?? p.original} alt={p.caption ?? ''} style={{ width: '100%', borderRadius: '6px', border: '1px solid #e4ecf2', display: 'block' }} />
                  <figcaption style={{ fontSize: '11px', color: '#5b7183', marginTop: '4px' }}>
                    <strong style={{ color: '#02457A' }}>{p.zoneLabel}{p.lotId ? ` · ${lotLabel(lots, p.lotId)}` : ''}</strong>{p.caption ? ` — ${p.caption}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          </RSection>
        )}

        {general.length > 0 && (
          <RSection title={`${++s}. Notes générales`}>
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              {general.map(n => <li key={n.id} style={{ fontSize: '12px', marginBottom: '3px' }}>{n.text}</li>)}
            </ul>
          </RSection>
        )}

        {companies.map(c => {
          const list = notesForCompany(visit, c)
          if (list.length === 0) return null
          return (
            <RSection key={c} title={`${++s}. Notes — ${c}`}>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                {list.map(n => <li key={n.id} style={{ fontSize: '12px', marginBottom: '3px' }}>{n.text}</li>)}
              </ul>
            </RSection>
          )
        })}

        {cr.conclusions && <RSection title={`${++s}. Conclusions`}><p style={pStyle}>{cr.conclusions}</p></RSection>}
        {cr.nextMeeting && <RSection title={`${++s}. Prochaine réunion`}><p style={pStyle}>{cr.nextMeeting}</p></RSection>}

        <div style={{ marginTop: '24px', paddingTop: '10px', borderTop: '1px solid #e4ecf2', fontSize: '10px', color: '#9bb0c2', textAlign: 'center' }}>
          Suivi-Chantier — {VISIT_KIND_LABEL[visit.kind]} du {fmtFr(visit.date)}
        </div>
      </div>
    </div>
  )
}

const RSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '18px' }}>
    <h2 style={{ fontSize: '14px', color: '#02457A', borderBottom: '1px solid #e4ecf2', paddingBottom: '4px', marginBottom: '8px' }}>{title}</h2>
    {children}
  </div>
)

/** Permanent, discreet reminder of where the tour stands. */
function TourBar({ visit, zoneRef }: { visit: Visit; zoneRef: string | null }) {
  const zones = visit.zones
  const idx = zoneRef ? zones.findIndex(z => z.refId === zoneRef) : -1
  const current = idx >= 0 ? zones[idx] : null
  const checks = zones.flatMap(z => z.tasks).filter(t => t.state !== 'na')
  const controlled = checks.filter(t => t.state !== 'not_checked').length
  const closed = zones.filter(z => z.closedAt).length

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 6, background: '#02457A', color: '#fff', padding: '7px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '11px', fontWeight: 600 }}>
        {current && <span>{current.buildingLabel} · {current.label}</span>}
        <span style={{ opacity: .85 }}>Logements {closed}/{zones.length}</span>
        <span style={{ opacity: .85 }}>Tâches {controlled}/{checks.length}</span>
        <div style={{ flex: 1 }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: .85 }}>
          <Clock size={11} /> {fmtTime(visit.startedAt)}
        </span>
      </div>
      <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,.25)', marginTop: '5px', overflow: 'hidden' }}>
        <div style={{ width: `${checks.length ? Math.round((controlled / checks.length) * 100) : 0}%`, height: '100%', background: '#7ad3ff' }} />
      </div>
    </div>
  )
}

const CHANGE_META: Record<ChangeKind, { label: string; bg: string; fg: string }> = {
  lifted: { label: 'Levé', bg: '#dcfce7', fg: '#15803d' },
  still_open: { label: 'Non levé', bg: '#fee2e2', fg: '#b91c1c' },
  rescheduled: { label: 'Échéance reportée', bg: '#fef3c7', fg: '#b45309' },
  new: { label: 'Nouveau', bg: '#e0f2fe', fg: '#0369a1' },
  progress_up: { label: 'Avancement', bg: '#dcfce7', fg: '#15803d' },
  progress_down: { label: 'Retard constaté', bg: '#fee2e2', fg: '#b91c1c' },
}

const RFact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9bb0c2', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: '13px', fontWeight: 700, color: '#02457A' }}>{value}</div>
  </div>
)

const RKpi = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div>
    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#5b7183', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: '22px', fontWeight: 700, color: accent ? '#dc2626' : '#02457A' }}>{value}</div>
  </div>
)
