import { useState, useEffect, useRef } from 'react'
import {
  Plus, Calendar, ChevronRight, ChevronLeft, ArrowLeft, Camera, ImageIcon, Pencil, Trash2,
  CheckCircle2, AlertTriangle, Circle, CircleDot, Ban, Lock, Send, FileText, Printer,
} from 'lucide-react'
import { ZONES } from '../../data/zones'
import {
  Visit, VisitZone, ZoneState, TaskState, ROLES, Role, Participant,
  zoneState, zoneProgress, visitCounts, visitProgress, remainingToControl,
  reservesForVisit, buildPlanningSnapshot, newVisit, makeZone, emptyCr,
} from '../../lib/visits'
import { Reserve, ReservePriority, nextReserveNumber } from '../../lib/reserves'
import {
  getVisits2, saveVisits2, getReserves, saveReserves, getGanttTasks, logActivity,
} from '../../lib/repo'
import { VisitPhoto, listPhotos, savePhoto, deletePhoto, fileToDataUrl } from '../../lib/photoStore'
import { Annotation, summarizeAnnotations } from '../../lib/annotations'
import { PhotoAnnotator } from '../visite/PhotoAnnotator'

// ── Catalog & lots ───────────────────────────────────────────────────────────

type CatalogEntry = { refId: string; label: string; kind: VisitZone['kind'] }
const CATALOG: CatalogEntry[] = ZONES.flatMap(z =>
  z.logements.map(l => ({ refId: l.id, label: l.label, kind: (z.id === 'COMMUNS' ? 'commun' : 'logement') as VisitZone['kind'] })),
)

const LOTS = [
  { id: 'L05', short: 'Menuiseries' },
  { id: 'L06', short: 'Électricité' },
  { id: 'L07', short: 'CVC / Plomberie' },
  { id: 'L08', short: 'Embellissements' },
]
const LOT_IDS = LOTS.map(l => l.id)
const lotShort = (id: string) => LOTS.find(l => l.id === id)?.short ?? id

// ── State metadata ───────────────────────────────────────────────────────────

const ZONE_META: Record<ZoneState, { label: string; dot: string; bg: string; fg: string }> = {
  not_started: { label: 'Non commencé', dot: '#cbd5e1', bg: '#f1f5f9', fg: '#64748b' },
  in_progress: { label: 'En cours', dot: '#0284c7', bg: '#e0f2fe', fg: '#0369a1' },
  done: { label: 'Terminé', dot: '#16a34a', bg: '#dcfce7', fg: '#15803d' },
  to_review: { label: 'À revoir', dot: '#f59e0b', bg: '#fef3c7', fg: '#b45309' },
  blocked: { label: 'Bloqué', dot: '#dc2626', bg: '#fee2e2', fg: '#b91c1c' },
}

const PRIORITY_META: Record<ReservePriority, { label: string; bg: string; fg: string }> = {
  low: { label: 'Faible', bg: '#eef2f6', fg: '#5b7183' },
  medium: { label: 'Moyenne', bg: '#fef3c7', fg: '#b45309' },
  high: { label: 'Haute', bg: '#fdecec', fg: '#dc2626' },
}

const fmtFr = (iso: string) => { const [y, m, d] = iso.split('-'); return d ? `${d}/${m}/${y}` : iso }
const todayIso = () => new Date().toISOString().split('T')[0]
const isLocked = (v: Visit) => v.status === 'diffuse' || v.status === 'verrouille'

function fileToThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 800
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no ctx'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

type View = 'list' | 'create' | 'session' | 'cr' | 'report'

export function Visite() {
  const [visits, setVisits] = useState<Visit[]>(getVisits2)
  const [reserves, setReserves] = useState<Reserve[]>(getReserves)
  const [photos, setPhotos] = useState<VisitPhoto[]>([])
  const [view, setView] = useState<View>('list')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeZone, setActiveZone] = useState<string | null>(null)

  useEffect(() => { saveVisits2(visits) }, [visits])
  useEffect(() => { saveReserves(reserves) }, [reserves])

  const reloadPhotos = (visitId: string) => { listPhotos(visitId).then(setPhotos).catch(() => setPhotos([])) }
  useEffect(() => { if (activeId) reloadPhotos(activeId); else setPhotos([]) }, [activeId])

  const active = visits.find(v => v.id === activeId) ?? null

  const addPhoto = async (zoneRefId: string, zoneLabel: string, lotId: string | undefined, file: File) => {
    if (!activeId) return
    const original = await fileToDataUrl(file)
    const photo: VisitPhoto = {
      id: `ph${Date.now()}`, visitId: activeId, zoneRefId, zoneLabel, lotId,
      original, annotations: [], includeInCr: true, order: photos.length, createdAt: new Date().toISOString(),
    }
    await savePhoto(photo)
    reloadPhotos(activeId)
  }
  const updatePhoto = async (photo: VisitPhoto) => { await savePhoto(photo); if (activeId) reloadPhotos(activeId) }
  const removePhoto = async (id: string) => { await deletePhoto(id); if (activeId) reloadPhotos(activeId) }

  const updateVisit = (id: string, patch: Partial<Visit> | ((v: Visit) => Visit)) =>
    setVisits(prev => prev.map(v => v.id !== id ? v : (typeof patch === 'function' ? patch(v) : { ...v, ...patch })))

  const openVisit = (v: Visit) => {
    setActiveId(v.id)
    setActiveZone(null)
    if (v.status === 'en_cours') setView('session')
    else if (v.status === 'terminee' || v.status === 'cr_pret') setView('cr')
    else setView('report')
  }

  // ── Views ──────────────────────────────────────────────────────────────────
  if (view === 'create') {
    return <CreateVisit
      onCancel={() => setView('list')}
      onCreate={(v) => { setVisits(prev => [v, ...prev]); setActiveId(v.id); setActiveZone(null); setView('session'); logActivity('visit', `Visite du ${fmtFr(v.date)} démarrée`) }}
    />
  }

  if (view === 'session' && active) {
    return <Session
      visit={active}
      reserves={reserves}
      photos={photos}
      activeZone={activeZone}
      onSelectZone={setActiveZone}
      onBack={() => setView('list')}
      onUpdate={(fn) => updateVisit(active.id, fn)}
      onAddReserve={(r) => setReserves(prev => [r, ...prev])}
      onToggleReserve={(id) => setReserves(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'open' ? 'resolved' : 'open' } : r))}
      onAddPhoto={addPhoto}
      onUpdatePhoto={updatePhoto}
      onRemovePhoto={removePhoto}
      onTerminate={() => {
        const snapshot = buildPlanningSnapshot(getGanttTasks(), new Date())
        updateVisit(active.id, v => ({ ...v, status: 'terminee', snapshot, cr: v.cr ?? emptyCr() }))
        logActivity('visit', `Visite du ${fmtFr(active.date)} terminée — planning figé`)
        setView('cr')
      }}
    />
  }

  if (view === 'cr' && active) {
    return <CrEditor
      visit={active}
      reserves={reservesForVisit(reserves, active.id)}
      photos={photos}
      onBack={() => setView('list')}
      onUpdate={(fn) => updateVisit(active.id, fn)}
      onUpdatePhoto={updatePhoto}
      onValidate={() => updateVisit(active.id, { status: 'cr_pret' })}
      onDiffuse={() => { updateVisit(active.id, { status: 'diffuse', diffusedAt: new Date().toISOString() }); logActivity('doc', `CR de la visite du ${fmtFr(active.date)} diffusé`); setView('report') }}
      onReopen={() => updateVisit(active.id, { status: 'terminee' })}
      onReport={() => setView('report')}
    />
  }

  if (view === 'report' && active) {
    return <Report visit={active} reserves={reservesForVisit(reserves, active.id)} photos={photos} onBack={() => setView(isLocked(active) ? 'list' : 'cr')} />
  }

  // ── Default: list ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <button onClick={() => setView('create')} style={bigBtn}>
        <Plus size={18} /> Nouvelle visite de chantier
      </button>

      <div style={sectionLabel}>Visites</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visits.length === 0 && <Empty>Aucune visite. Démarrez-en une pour contrôler le chantier.</Empty>}
        {visits.map(v => {
          const c = visitCounts(v)
          const pct = visitProgress(v)
          const st = STATUS_META[v.status]
          return (
            <button key={v.id} onClick={() => openVisit(v)} style={visitCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                <Calendar size={18} color="var(--muted)" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--navy)' }}>Visite du {fmtFr(v.date)}{v.title ? ` — ${v.title}` : ''}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                    {c.total} zones • {pct}% • {c.done} terminées{c.to_review > 0 ? ` • ${c.to_review} à revoir` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ ...badge, background: st.bg, color: st.fg }}>{st.label}</span>
                <ChevronRight size={14} color="var(--muted)" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const STATUS_META: Record<Visit['status'], { label: string; bg: string; fg: string }> = {
  en_cours: { label: 'En cours', bg: '#e0f2fe', fg: '#0369a1' },
  terminee: { label: 'Terminée', bg: '#f1f5f9', fg: '#475569' },
  cr_pret: { label: 'CR prêt', bg: '#fef3c7', fg: '#b45309' },
  diffuse: { label: 'Diffusé', bg: '#dcfce7', fg: '#15803d' },
  verrouille: { label: 'Verrouillé', bg: '#ede9fe', fg: '#6d28d9' },
}

// ═══════════════════════════════════════════════════════════════════════════
// Create
// ═══════════════════════════════════════════════════════════════════════════

function CreateVisit({ onCancel, onCreate }: { onCancel: () => void; onCreate: (v: Visit) => void }) {
  const [date, setDate] = useState(todayIso())
  const [title, setTitle] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [pName, setPName] = useState('')
  const [pRole, setPRole] = useState<Role>('MOE')
  const [selected, setSelected] = useState<Set<string>>(new Set(CATALOG.map(c => c.refId)))

  const toggle = (refId: string) => setSelected(prev => { const n = new Set(prev); if (n.has(refId)) n.delete(refId); else n.add(refId); return n })
  const addP = () => { if (!pName.trim()) return; setParticipants(prev => [...prev, { id: `p${Date.now()}`, name: pName.trim(), role: pRole }]); setPName('') }

  const create = () => {
    const zones = CATALOG.filter(c => selected.has(c.refId)).map(c => makeZone(c.refId, c.label, c.kind, LOT_IDS))
    onCreate(newVisit(date, participants, zones, title))
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <BackBtn onClick={onCancel} />
      <h2 style={{ margin: '0 0 16px' }}>Nouvelle visite</h2>

      <Field label="Date de visite">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />
      </Field>
      <Field label="Objet (facultatif)">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex. Visite hebdomadaire" style={input} />
      </Field>

      <Field label="Participants & rôles">
        {participants.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
            <span style={{ ...badge, background: '#eef2f6', color: '#02457A' }}>{p.role}</span>
            <span style={{ flex: 1, fontSize: '13px' }}>{p.name}</span>
            <button onClick={() => setParticipants(prev => prev.filter(x => x.id !== p.id))} style={linkBtn}>Retirer</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
          <input value={pName} onChange={e => setPName(e.target.value)} placeholder="Nom" style={{ ...input, flex: '2 1 140px' }} onKeyDown={e => { if (e.key === 'Enter') addP() }} />
          <select value={pRole} onChange={e => setPRole(e.target.value as Role)} style={{ ...input, flex: '1 1 120px' }}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={addP} style={ghostBtn}><Plus size={14} /></button>
        </div>
      </Field>

      <Field label={`Zones à contrôler (${selected.size})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CATALOG.map(c => (
            <label key={c.refId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: selected.has(c.refId) ? 'var(--ok-bg)' : '#fff', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.has(c.refId)} onChange={() => toggle(c.refId)} />
              <span style={{ fontSize: '13px' }}>{c.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>{c.kind}</span>
            </label>
          ))}
        </div>
      </Field>

      <button onClick={create} disabled={selected.size === 0} style={{ ...bigBtn, opacity: selected.size === 0 ? 0.5 : 1 }}>
        Démarrer la visite →
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Session (dashboard + free navigation + zone control)
// ═══════════════════════════════════════════════════════════════════════════

function Session(props: {
  visit: Visit
  reserves: Reserve[]
  photos: VisitPhoto[]
  activeZone: string | null
  onSelectZone: (refId: string | null) => void
  onBack: () => void
  onUpdate: (fn: (v: Visit) => Visit) => void
  onAddReserve: (r: Reserve) => void
  onToggleReserve: (id: string) => void
  onAddPhoto: (zoneRefId: string, zoneLabel: string, lotId: string | undefined, file: File) => void
  onUpdatePhoto: (photo: VisitPhoto) => void
  onRemovePhoto: (id: string) => void
  onTerminate: () => void
}) {
  const { visit, reserves, photos, activeZone, onSelectZone, onBack, onUpdate, onAddReserve, onToggleReserve, onAddPhoto, onUpdatePhoto, onRemovePhoto, onTerminate } = props
  const counts = visitCounts(visit)
  const pct = visitProgress(visit)
  const visitReserves = reservesForVisit(reserves, visit.id)
  const openReview = visitReserves.filter(r => r.status === 'open')
  const zoneIndex = visit.zones.findIndex(z => z.refId === activeZone)
  const current = zoneIndex >= 0 ? visit.zones[zoneIndex] : null

  const setTask = (refId: string, lotId: string, state: TaskState) => onUpdate(v => ({
    ...v, zones: v.zones.map(z => z.refId !== refId ? z : { ...z, tasks: z.tasks.map(t => t.lotId === lotId ? { ...t, state } : t) }),
  }))
  const setOverride = (refId: string, override: 'to_review' | 'blocked' | null) => onUpdate(v => ({
    ...v, zones: v.zones.map(z => z.refId !== refId ? z : { ...z, override }),
  }))

  const terminate = () => {
    const remaining = remainingToControl(visit)
    if (remaining.length > 0 && !window.confirm(`${remaining.length} élément(s) restent à contrôler. Voulez-vous tout de même terminer la visite ?`)) return
    onTerminate()
  }

  // Zone detail
  if (current) {
    const st = zoneState(current)
    const meta = ZONE_META[st]
    return (
      <div style={{ padding: '12px', paddingBottom: '90px' }}>
        <button onClick={() => onSelectZone(null)} style={{ ...linkBtn, marginBottom: '10px' }}>← Tableau de bord</button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h2 style={{ margin: 0 }}>{current.label}</h2>
          <span style={{ ...badge, background: meta.bg, color: meta.fg }}>{meta.label}</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>Avancement : <strong style={{ color: 'var(--navy)' }}>{zoneProgress(current)}%</strong></div>

        {current.tasks.map(t => (
          <TaskRow key={t.lotId} lotId={t.lotId} state={t.state} onSet={(s) => setTask(current.refId, t.lotId, s)} />
        ))}

        <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
          <button onClick={() => setOverride(current.refId, current.override === 'to_review' ? null : 'to_review')} style={pill(current.override === 'to_review', '#b45309', '#fef3c7')}>
            <AlertTriangle size={13} /> Marquer la zone « à revoir »
          </button>
          <button onClick={() => setOverride(current.refId, current.override === 'blocked' ? null : 'blocked')} style={pill(current.override === 'blocked', '#b91c1c', '#fee2e2')}>
            <Ban size={13} /> Bloqué
          </button>
        </div>

        <ReviewForm zone={current} visitId={visit.id} reserves={reserves} onAdd={onAddReserve} />

        <PhotoSection
          photos={photos.filter(p => p.zoneRefId === current.refId)}
          onAdd={(lotId, file) => onAddPhoto(current.refId, current.label, lotId, file)}
          onUpdate={onUpdatePhoto}
          onRemove={onRemovePhoto}
        />

        {/* Nav prev / next */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
          <button disabled={zoneIndex <= 0} onClick={() => onSelectZone(visit.zones[zoneIndex - 1].refId)} style={{ ...navBtn, opacity: zoneIndex <= 0 ? 0.4 : 1 }}><ChevronLeft size={16} /> Précédent</button>
          <button disabled={zoneIndex >= visit.zones.length - 1} onClick={() => onSelectZone(visit.zones[zoneIndex + 1].refId)} style={{ ...navBtn, opacity: zoneIndex >= visit.zones.length - 1 ? 0.4 : 1 }}>Suivant <ChevronRight size={16} /></button>
        </div>
      </div>
    )
  }

  // Dashboard
  return (
    <div style={{ padding: '12px', paddingBottom: '90px' }}>
      <button onClick={onBack} style={{ ...linkBtn, marginBottom: '8px' }}>← Toutes les visites</button>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ margin: '0 0 2px' }}>Visite du {fmtFr(visit.date)}</h2>
        <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--navy)' }}>{pct}%</span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>{visit.title ?? 'Session de contrôle'} • {counts.total} zones</div>

      {/* Counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: '8px', marginBottom: '14px' }}>
        <Stat n={counts.done} label="Terminés" dot={ZONE_META.done.dot} />
        <Stat n={counts.in_progress} label="En cours" dot={ZONE_META.in_progress.dot} />
        <Stat n={counts.to_review} label="À revoir" dot={ZONE_META.to_review.dot} />
        <Stat n={counts.blocked} label="Bloqués" dot={ZONE_META.blocked.dot} />
        <Stat n={counts.not_started} label="Non commencés" dot={ZONE_META.not_started.dot} />
      </div>

      {/* Zone list */}
      <div style={sectionLabel}>Zones / logements</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
        {visit.zones.map(z => {
          const s = zoneState(z); const m = ZONE_META[s]
          return (
            <button key={z.refId} onClick={() => onSelectZone(z.refId)} style={zoneRow}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>{z.label}</span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{zoneProgress(z)}%</span>
              <span style={{ ...badge, background: m.bg, color: m.fg }}>{m.label}</span>
              <ChevronRight size={14} color="var(--muted)" />
            </button>
          )
        })}
      </div>

      {/* À revoir */}
      {openReview.length > 0 && (
        <>
          <div style={sectionLabel}>À revoir pendant cette visite ({openReview.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            {openReview.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}>
                <AlertTriangle size={14} color="#f59e0b" />
                <button onClick={() => onSelectZone(r.logementId)} style={{ flex: 1, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--ink)' }}>
                  <strong style={{ color: 'var(--navy)' }}>{r.number}</strong> — {r.description}
                  <span style={{ color: 'var(--muted)' }}> · {lotShort(r.lotId)}</span>
                </button>
                <button onClick={() => onToggleReserve(r.id)} style={linkBtn}>Lever</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Photos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', marginBottom: '16px' }}>
        <ImageIcon size={16} color="var(--muted)" />
        <span style={{ fontSize: '13px', color: 'var(--ink)' }}><strong style={{ color: 'var(--navy)' }}>{photos.length}</strong> photo{photos.length > 1 ? 's' : ''} sur la visite</span>
      </div>

      {/* Lots concernés */}
      <div style={sectionLabel}>Lots concernés</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
        {LOTS.map(l => <span key={l.id} style={{ ...badge, background: '#eef2f6', color: '#02457A' }}>{l.id} — {l.short}</span>)}
      </div>

      <button onClick={terminate} style={{ ...bigBtn, background: 'var(--ok)' }}>
        <CheckCircle2 size={17} /> Terminer la visite
      </button>
    </div>
  )
}

function TaskRow({ lotId, state, onSet }: { lotId: string; state: TaskState; onSet: (s: TaskState) => void }) {
  const opts: { s: TaskState; label: string; icon: React.ReactNode; fg: string; bg: string }[] = [
    { s: 'ok', label: 'OK', icon: <CheckCircle2 size={13} />, fg: '#15803d', bg: '#dcfce7' },
    { s: 'to_review', label: 'À revoir', icon: <AlertTriangle size={13} />, fg: '#b45309', bg: '#fef3c7' },
    { s: 'blocked', label: 'Bloqué', icon: <Ban size={13} />, fg: '#b91c1c', bg: '#fee2e2' },
    { s: 'na', label: 'N/A', icon: <Circle size={13} />, fg: '#64748b', bg: '#f1f5f9' },
  ]
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        {state === 'not_checked' ? <Circle size={14} color="#cbd5e1" /> : <CircleDot size={14} color="#0284c7" />}
        <strong style={{ fontSize: '13px', color: 'var(--navy)' }}>{lotId}</strong>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{lotShort(lotId)}</span>
      </div>
      <div style={{ display: 'flex', gap: '5px' }}>
        {opts.map(o => (
          <button key={o.s} onClick={() => onSet(state === o.s ? 'not_checked' : o.s)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '7px 4px', borderRadius: '7px', border: state === o.s ? `2px solid ${o.fg}` : '1px solid var(--line)', background: state === o.s ? o.bg : '#fff', color: state === o.s ? o.fg : 'var(--muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            {o.icon} {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ReviewForm({ zone, visitId, reserves, onAdd }: { zone: VisitZone; visitId: string; reserves: Reserve[]; onAdd: (r: Reserve) => void }) {
  const [open, setOpen] = useState(false)
  const [lot, setLot] = useState(zone.tasks[0]?.lotId ?? 'L05')
  const [desc, setDesc] = useState('')
  const [priority, setPriority] = useState<ReservePriority>('medium')
  const [company, setCompany] = useState('')
  const [photo, setPhoto] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    if (!desc.trim()) return
    onAdd({
      id: `r${Date.now()}`, number: nextReserveNumber(reserves), lotId: lot, logementId: zone.refId,
      description: desc.trim(), priority, status: 'open', photo, createdAt: todayIso(), visitId, company: company.trim() || undefined,
    })
    logActivity('reserve', `Point à revoir — ${zone.label} · ${desc.trim()}`)
    setDesc(''); setPhoto(undefined); setCompany(''); setOpen(false)
  }
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { try { setPhoto(await fileToThumbnail(f)) } catch { /* ignore */ } } }

  if (!open) return <button onClick={() => setOpen(true)} style={{ ...ghostBtn, width: '100%', justifyContent: 'center', marginTop: '12px', padding: '10px' }}><AlertTriangle size={14} /> Ajouter un point « à revoir »</button>

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginTop: '12px', background: '#fffdf7' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', marginBottom: '8px' }}>Point à revoir — {zone.label}</div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <select value={lot} onChange={e => setLot(e.target.value)} style={{ ...input, flex: 1 }}>{LOTS.map(l => <option key={l.id} value={l.id}>{l.id} — {l.short}</option>)}</select>
        <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Entreprise" style={{ ...input, flex: 1 }} />
      </div>
      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="ex. Peinture chambre à reprendre" style={{ ...input, width: '100%', minHeight: '52px', resize: 'vertical', marginBottom: '8px' }} />
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        {(Object.keys(PRIORITY_META) as ReservePriority[]).map(p => (
          <button key={p} onClick={() => setPriority(p)} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: priority === p ? `2px solid ${PRIORITY_META[p].fg}` : '1px solid var(--line)', background: priority === p ? PRIORITY_META[p].bg : '#fff', color: PRIORITY_META[p].fg, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>{PRIORITY_META[p].label}</button>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pick} style={{ display: 'none' }} />
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button onClick={() => fileRef.current?.click()} style={ghostBtn}><Camera size={14} /> {photo ? 'Photo ✓' : 'Photo'}</button>
        {photo && <img src={photo} alt="" style={{ height: '34px', borderRadius: '4px' }} />}
        <div style={{ flex: 1 }} />
        <button onClick={() => setOpen(false)} style={linkBtn}>Annuler</button>
        <button onClick={submit} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: 'var(--ok)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Ajouter</button>
      </div>
    </div>
  )
}

function PhotoSection({ photos, onAdd, onUpdate, onRemove }: {
  photos: VisitPhoto[]
  onAdd: (lotId: string | undefined, file: File) => void
  onUpdate: (p: VisitPhoto) => void
  onRemove: (id: string) => void
}) {
  const [lot, setLot] = useState('')
  const [editing, setEditing] = useState<VisitPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onAdd(lot || undefined, f)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div style={{ marginTop: '18px' }}>
      <div style={sectionLabel}>Photos ({photos.length})</div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <select value={lot} onChange={e => setLot(e.target.value)} style={{ ...input, flex: 1 }}>
          <option value="">Lot (facultatif)</option>
          {LOTS.map(l => <option key={l.id} value={l.id}>{l.id} — {l.short}</option>)}
        </select>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pick} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} style={ghostBtn}><Camera size={14} /> Ajouter une photo</button>
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px' }}>
          {photos.map(p => (
            <div key={p.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--line)' }}>
              <img src={p.annotated ?? p.original} alt="" style={{ width: '100%', height: '96px', objectFit: 'cover', display: 'block' }} />
              {p.annotations.length > 0 && <span style={{ position: 'absolute', top: '4px', left: '4px', padding: '1px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: 700, background: 'rgba(2,69,122,.9)', color: '#fff' }}>{p.annotations.length}</span>}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: '2px', padding: '3px', background: 'linear-gradient(transparent, rgba(0,0,0,.55))' }}>
                <button onClick={() => setEditing(p)} title="Annoter" style={thumbBtn}><Pencil size={13} /></button>
                <div style={{ flex: 1 }} />
                <button onClick={() => onRemove(p.id)} title="Supprimer" style={thumbBtn}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PhotoAnnotator
          src={editing.original}
          initial={editing.annotations}
          onClose={() => setEditing(null)}
          onSave={(annotations: Annotation[], annotated: string) => { onUpdate({ ...editing, annotations, annotated: annotations.length ? annotated : undefined }); setEditing(null) }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CR editor (phase B)
// ═══════════════════════════════════════════════════════════════════════════

function CrEditor(props: {
  visit: Visit
  reserves: Reserve[]
  photos: VisitPhoto[]
  onBack: () => void
  onUpdate: (fn: (v: Visit) => Visit) => void
  onUpdatePhoto: (p: VisitPhoto) => void
  onValidate: () => void
  onDiffuse: () => void
  onReopen: () => void
  onReport: () => void
}) {
  const { visit, reserves, photos, onBack, onUpdate, onUpdatePhoto, onValidate, onDiffuse, onReopen, onReport } = props
  const cr = visit.cr ?? emptyCr()
  const locked = isLocked(visit)
  const setCr = (patch: Partial<typeof cr>) => onUpdate(v => ({ ...v, cr: { ...(v.cr ?? emptyCr()), ...patch } }))

  return (
    <div style={{ padding: '12px', paddingBottom: '90px' }}>
      <button onClick={onBack} style={{ ...linkBtn, marginBottom: '8px' }}>← Toutes les visites</button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: '0 0 2px' }}>Compte rendu — {fmtFr(visit.date)}</h2>
        <span style={{ ...badge, background: STATUS_META[visit.status].bg, color: STATUS_META[visit.status].fg }}>{STATUS_META[visit.status].label}</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 14px' }}>
        {locked ? 'Document diffusé — verrouillé.' : 'Brouillon éditable. Relisez, ajustez, puis validez avant diffusion.'}
      </p>

      {locked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#ede9fe', color: '#6d28d9', fontSize: '12px', fontWeight: 600, marginBottom: '14px' }}>
          <Lock size={14} /> Diffusé le {visit.diffusedAt ? new Date(visit.diffusedAt).toLocaleDateString('fr') : '—'}. Modification réservée à un administrateur (à venir avec l'authentification).
        </div>
      )}

      <Field label="Synthèse de la visite">
        <textarea disabled={locked} value={cr.synthese} onChange={e => setCr({ synthese: e.target.value })} placeholder="Résumé général de la visite…" style={{ ...input, width: '100%', minHeight: '70px', resize: 'vertical' }} />
      </Field>

      <Field label={`Participants (${visit.participants.length})`}>
        {visit.participants.length === 0 && <Empty>Aucun participant renseigné.</Empty>}
        {visit.participants.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
            <select disabled={locked} value={p.role} onChange={e => onUpdate(v => ({ ...v, participants: v.participants.map(x => x.id === p.id ? { ...x, role: e.target.value as Role } : x) }))} style={{ ...input, width: '150px' }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input disabled={locked} value={p.name} onChange={e => onUpdate(v => ({ ...v, participants: v.participants.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) }))} style={{ ...input, flex: 1 }} />
          </div>
        ))}
      </Field>

      <Field label={`Points à revoir (${reserves.length})`}>
        {reserves.length === 0 && <Empty>Aucun point à revoir pour cette visite.</Empty>}
        {reserves.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: '12px' }}>
            <span style={{ ...badge, background: PRIORITY_META[r.priority].bg, color: PRIORITY_META[r.priority].fg }}>{PRIORITY_META[r.priority].label}</span>
            <span style={{ flex: 1 }}><strong style={{ color: 'var(--navy)' }}>{r.number}</strong> {r.description} <span style={{ color: 'var(--muted)' }}>· {lotShort(r.lotId)}</span></span>
            {r.photo && <img src={r.photo} alt="" style={{ height: '30px', borderRadius: '4px' }} />}
          </div>
        ))}
      </Field>

      <Field label={`Photos (${photos.length}) — sélection & légendes`}>
        {photos.length === 0 && <Empty>Aucune photo. Ajoutez-en depuis les zones pendant la visite.</Empty>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {photos.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', borderRadius: '8px', border: '1px solid var(--line)', background: p.includeInCr ? '#fff' : '#f7faf8', opacity: p.includeInCr ? 1 : 0.6 }}>
              <img src={p.annotated ?? p.original} alt="" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{p.zoneLabel}{p.lotId ? ` · ${lotShort(p.lotId)}` : ''} · {summarizeAnnotations(p.annotations)}</div>
                <input disabled={locked} value={p.caption ?? ''} onChange={e => onUpdatePhoto({ ...p, caption: e.target.value })} placeholder="Légende…" style={{ ...input, width: '100%', padding: '6px 8px' }} />
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', fontSize: '9px', color: 'var(--muted)', cursor: locked ? 'default' : 'pointer' }}>
                <input type="checkbox" disabled={locked} checked={p.includeInCr} onChange={e => onUpdatePhoto({ ...p, includeInCr: e.target.checked })} />
                CR
              </label>
            </div>
          ))}
        </div>
      </Field>

      <Field label="Conclusions">
        <textarea disabled={locked} value={cr.conclusions} onChange={e => setCr({ conclusions: e.target.value })} placeholder="Décisions, actions, points d'attention…" style={{ ...input, width: '100%', minHeight: '60px', resize: 'vertical' }} />
      </Field>
      <Field label="Prochaine réunion / visite">
        <input disabled={locked} value={cr.nextMeeting} onChange={e => setCr({ nextMeeting: e.target.value })} placeholder="ex. Semaine du 22/09/2026" style={{ ...input, width: '100%' }} />
      </Field>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
        <button onClick={onReport} style={{ ...ghostBtn, flex: '1 1 140px', justifyContent: 'center', padding: '11px' }}><FileText size={15} /> Aperçu du CR</button>
        {!locked && visit.status === 'terminee' && <button onClick={onValidate} style={{ ...bigBtnInline, flex: '1 1 140px', background: 'var(--navy)' }}>Valider</button>}
        {!locked && visit.status === 'cr_pret' && <>
          <button onClick={onReopen} style={{ ...ghostBtn, flex: '1 1 100px', justifyContent: 'center', padding: '11px' }}>Rouvrir</button>
          <button onClick={() => { if (window.confirm('Diffuser le CR ? Il sera verrouillé.')) onDiffuse() }} style={{ ...bigBtnInline, flex: '1 1 140px', background: 'var(--ok)' }}><Send size={15} /> Diffuser</button>
        </>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Report (phase C — rendered from the frozen snapshot)
// ═══════════════════════════════════════════════════════════════════════════

function Report({ visit, reserves, photos, onBack }: { visit: Visit; reserves: Reserve[]; photos: VisitPhoto[]; onBack: () => void }) {
  const snap = visit.snapshot
  const cr = visit.cr ?? emptyCr()
  const openReserves = reserves.filter(r => r.status === 'open')
  const crPhotos = photos.filter(p => p.includeInCr)
  let s = 0  // dynamic section numbering (conditional sections never leave gaps)

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--line)', background: '#fff', position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={onBack} style={{ ...linkBtn }}><ArrowLeft size={15} /> Retour</button>
        <button onClick={() => window.print()} style={{ ...bigBtnInline, background: 'var(--navy)', padding: '8px 14px' }}><Printer size={15} /> Exporter PDF</button>
      </div>

      <div className="cr-print" style={{ padding: '20px', maxWidth: '780px', margin: '0 auto', background: '#fff', color: '#16222e' }}>
        <div style={{ borderBottom: '2px solid #02457A', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em', color: '#018ABE', fontWeight: 700 }}>Compte rendu de visite</div>
          <h1 style={{ margin: '4px 0', fontSize: '22px', color: '#02457A' }}>Visite du {fmtFr(visit.date)}{visit.title ? ` — ${visit.title}` : ''}</h1>
          <div style={{ fontSize: '12px', color: '#5b7183' }}>Gambetta — Réhabilitation • GAM-2026-001{snap ? ` • planning figé le ${new Date(snap.capturedAt).toLocaleDateString('fr')}` : ''}</div>
        </div>

        <RSection title={`${++s}. Participants`}>
          {visit.participants.length === 0 ? <p style={pStyle}>—</p> : (
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              {visit.participants.map(p => <li key={p.id} style={{ fontSize: '12px', marginBottom: '2px' }}><strong>{p.role}</strong> — {p.name}</li>)}
            </ul>
          )}
        </RSection>

        {cr.synthese && <RSection title={`${++s}. Synthèse`}><p style={pStyle}>{cr.synthese}</p></RSection>}

        {snap && (
          <RSection title={`${++s}. Avancement du planning (figé au jour de la visite)`}>
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

        <RSection title={`${++s}. Points à revoir / réserves`}>
          {openReserves.length === 0 ? <p style={pStyle}>Aucun point à revoir ouvert.</p> : (
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>N°</th><th style={thStyle}>Localisation</th><th style={thStyle}>Description</th><th style={thStyle}>Lot</th><th style={thStyle}>Priorité</th></tr></thead>
              <tbody>
                {openReserves.map(r => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.number}</td>
                    <td style={tdStyle}>{r.logementId}</td>
                    <td style={tdStyle}>{r.description}</td>
                    <td style={tdStyle}>{lotShort(r.lotId)}</td>
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
                    <strong style={{ color: '#02457A' }}>{p.zoneLabel}{p.lotId ? ` · ${lotShort(p.lotId)}` : ''}</strong>{p.caption ? ` — ${p.caption}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          </RSection>
        )}

        {cr.conclusions && <RSection title={`${++s}. Conclusions`}><p style={pStyle}>{cr.conclusions}</p></RSection>}
        {cr.nextMeeting && <RSection title={`${++s}. Prochaine réunion`}><p style={pStyle}>{cr.nextMeeting}</p></RSection>}

        <div style={{ marginTop: '24px', paddingTop: '10px', borderTop: '1px solid #e4ecf2', fontSize: '10px', color: '#9bb0c2', textAlign: 'center' }}>
          Suivi-Chantier — CR généré depuis la visite du {fmtFr(visit.date)}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Small shared bits
// ═══════════════════════════════════════════════════════════════════════════

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>{label}</label>
    {children}
  </div>
)
const Empty = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', padding: '6px 0' }}>{children}</div>
)
const Stat = ({ n, label, dot }: { n: number; label: string; dot: string }) => (
  <div style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff', textAlign: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dot }} />
      <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--navy)' }}>{n}</span>
    </div>
    <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{label}</div>
  </div>
)
const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} style={{ ...linkBtn, marginBottom: '10px' }}><ArrowLeft size={15} /> Retour</button>
)
const RSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '18px' }}>
    <h2 style={{ fontSize: '14px', color: '#02457A', borderBottom: '1px solid #e4ecf2', paddingBottom: '4px', marginBottom: '8px' }}>{title}</h2>
    {children}
  </div>
)
const RKpi = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div>
    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#5b7183', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: '22px', fontWeight: 700, color: accent ? '#dc2626' : '#02457A' }}>{value}</div>
  </div>
)

// styles
const bigBtn: React.CSSProperties = { width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px' }
const bigBtnInline: React.CSSProperties = { padding: '11px 16px', borderRadius: '10px', border: 'none', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }
const sectionLabel: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }
const visitCard: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', width: '100%', textAlign: 'left' }
const zoneRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer' }
const badge: React.CSSProperties = { padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' }
const input: React.CSSProperties = { padding: '9px 11px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }
const ghostBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', color: 'var(--navy)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }
const linkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px', border: 'none', background: 'none', color: 'var(--navy-2)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0 }
const navBtn: React.CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '11px', borderRadius: '10px', border: '1px solid var(--line)', background: '#fff', color: 'var(--navy)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const thumbBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,.92)', color: '#02457A', cursor: 'pointer' }
const pill = (on: boolean, fg: string, bg: string): React.CSSProperties => ({ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '9px 6px', borderRadius: '8px', border: on ? `2px solid ${fg}` : '1px solid var(--line)', background: on ? bg : '#fff', color: on ? fg : 'var(--muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' })
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '12px' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', background: '#f8fafc', borderBottom: '1px solid #e4ecf2', color: '#02457A', fontSize: '11px' }
const tdStyle: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #eef2f6' }
const pStyle: React.CSSProperties = { fontSize: '12px', color: '#5b7183', margin: 0, whiteSpace: 'pre-wrap' }
