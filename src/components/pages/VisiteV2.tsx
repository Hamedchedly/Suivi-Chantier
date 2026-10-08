import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getCurrentProjectId, getGanttTasks, saveGanttTasks, getZoneRefs, getUnits, getTaskUnits } from '../../lib/repo'
import { taskConcernsUnit } from '../../lib/units'
import type { GanttTask } from '../../types/gantt'
import {
  type V2Session, type V2Unit, type V2Task, type V2Remark, type RemarkStatus, type RemarkPriority,
  REMARK_STATUS_LABEL, REMARK_PRIORITY_LABEL,
  buildTree, buildingProgress, nodeProgress, projectProgress, unitProgress, lotGroups, lotProgress,
  taskProgress, isComplete, logementCounter, taskCounter, unitsFromPlanning, openSession, patchTask,
  addRemark, patchRemark, detectIssues, applySessionToPlanning, allLeaves, type ChildNode,
} from '../../lib/visitV2/model'
import { loadCache, saveCache, pushSession, pullSessions, type SyncResult } from '../../lib/visitV2/store'

const pct = (p: number | null) => (p === null ? '—' : `${Math.round(p)} %`)
const todayLocal = () => new Date().toLocaleDateString('sv-SE')

const SYNC_LABEL: Record<SyncResult | 'idle', string> = {
  idle: '',
  synced: 'Enregistré sur le serveur',
  offline: 'Hors ligne : conservé sur cet appareil',
  error: 'Échec d’envoi : nouvel essai à la prochaine sortie',
}

const btnBase: CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--line)' }
const btnPrimary: CSSProperties = { ...btnBase, background: 'var(--navy-2, #1e3a5f)', color: '#fff', borderColor: 'transparent' }
const btnGhost: CSSProperties = { ...btnBase, background: '#fff', color: 'inherit' }

const card: CSSProperties = {
  background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', marginBottom: 10,
}
const input: CSSProperties = {
  padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13, background: '#fff',
}

export function VisiteV2() {
  const projectId = getCurrentProjectId() ?? 'sans-projet'
  const latest = useRef<V2Session[]>(loadCache(projectId))
  const [sessions, setSessions] = useState<V2Session[]>(latest.current)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [sync, setSync] = useState<SyncResult | 'idle'>('idle')
  const dirty = useRef<string | null>(null)

  const replaceAll = (list: V2Session[]) => {
    latest.current = list
    setSessions(list)
    saveCache(projectId, list)
  }

  // Envoi distant de la session modifiée : appelé à la sortie d'un lot, d'un logement,
  // de la page, ou à la clôture.
  const flush = () => {
    const id = dirty.current
    if (!id) return
    const s = latest.current.find(x => x.id === id)
    dirty.current = null
    if (s) pushSession(projectId, s).then(setSync)
  }

  const commit = (next: V2Session) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    const exists = latest.current.some(s => s.id === stamped.id)
    replaceAll(exists
      ? latest.current.map(s => (s.id === stamped.id ? stamped : s))
      : [stamped, ...latest.current])
    dirty.current = stamped.id
  }

  useEffect(() => {
    let cancelled = false
    pullSessions(projectId).then(list => { if (!cancelled && list) replaceAll(list) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = sessions.find(s => s.id === activeId) ?? null
  const lastClosed = sessions.filter(s => s.status === 'close').sort((a, b) => b.date.localeCompare(a.date))[0]

  const leave = () => { flush(); setActiveId(null) }

  const onCreate = (s: V2Session) => {
    commit(s)
    dirty.current = s.id
    flush()
    setCreating(false)
    setActiveId(s.id)
  }

  return (
    <div style={{ padding: '16px 16px 80px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {active ? (
          <button style={btnGhost} onClick={leave}>← Sessions</button>
        ) : (
          <button style={btnPrimary} onClick={() => setCreating(true)}>+ Nouvelle session</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{SYNC_LABEL[sync]}</span>
      </div>

      {creating && !active && (
        <NewSession previous={lastClosed} onCreate={onCreate} onCancel={() => setCreating(false)} />
      )}

      {!active && !creating && (
        <div>
          {sessions.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune session pour ce projet.</p>}
          {sessions.map(s => (
            <button key={s.id} onClick={() => { flush(); setActiveId(s.id) }}
              style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{s.kindLabel}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.date} · {s.status === 'close' ? 'Clôturée' : 'En cours'}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{pct(projectProgress(s.units))}</div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <SessionView key={active.id} session={active} onChange={commit} flush={flush} />
      )}
    </div>
  )
}

// ── Nouvelle session ────────────────────────────────────────────────────────

function NewSession({ previous, onCreate, onCancel }: {
  previous?: V2Session
  onCreate: (s: V2Session) => void
  onCancel: () => void
}) {
  const refs = useMemo(() => getZoneRefs(), [])
  const [date, setDate] = useState(todayLocal())
  const [kindLabel, setKindLabel] = useState('Visite de chantier')
  const [picked, setPicked] = useState<Set<string>>(() => new Set(refs.map(r => r.refId)))

  const create = () => {
    const units = getUnits()
    const links = getTaskUnits()
    const belongs = (t: GanttTask, refId: string) => taskConcernsUnit(units, links, t.id, refId)
    const session = openSession({
      id: `V2-${Date.now()}`,
      date,
      kindLabel: kindLabel.trim() || 'Visite de chantier',
      units: unitsFromPlanning(getGanttTasks(), refs.filter(r => picked.has(r.refId)), belongs),
      previous,
      now: new Date().toISOString(),
    })
    onCreate(session)
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />
        <input value={kindLabel} onChange={e => setKindLabel(e.target.value)} style={{ ...input, flex: 1, minWidth: 200 }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Logements et zones concernés</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {refs.map(r => (
          <label key={r.refId} style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="checkbox" checked={picked.has(r.refId)} onChange={() => setPicked(prev => {
              const n = new Set(prev)
              if (n.has(r.refId)) n.delete(r.refId); else n.add(r.refId)
              return n
            })} />
            {r.buildingLabel} · {r.label}
          </label>
        ))}
      </div>
      {refs.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Aucun logement défini : configurez « Bâtiments & zones » d’abord.</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnPrimary} onClick={create} disabled={picked.size === 0}>Ouvrir la session</button>
        <button style={btnGhost} onClick={onCancel}>Annuler</button>
      </div>
    </div>
  )
}

// ── Session ─────────────────────────────────────────────────────────────────

type PatchTask = (unitId: string, taskId: string, p: Partial<Pick<V2Task, 'progress' | 'na' | 'comment'>>) => void

type Tab = 'tournee' | 'remarques' | 'incoherences' | 'cloture'
const TABS: { id: Tab; label: string }[] = [
  { id: 'tournee', label: 'Tournée' },
  { id: 'remarques', label: 'Remarques' },
  { id: 'incoherences', label: 'Incohérences' },
  { id: 'cloture', label: 'Clôture' },
]

function SessionView({ session, onChange, flush }: {
  session: V2Session
  onChange: (s: V2Session) => void
  flush: () => void
}) {
  const [tab, setTab] = useState<Tab>('tournee')
  const readOnly = session.status === 'close'
  const lc = logementCounter(session)
  const tc = taskCounter(session)
  const openIssues = detectIssues(session).filter(i => !i.acknowledged).length

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{session.kindLabel}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{session.date} · {readOnly ? 'Clôturée' : 'En cours'}</div>
        </div>
        <Stat label="Avancement projet" value={pct(projectProgress(session.units))} />
        <Stat label="Logements restants" value={`${lc.remaining}/${lc.total}`} />
        <Stat label="Tâches restantes" value={`${tc.remaining}/${tc.total}`} />
        <Stat label="Incohérences" value={String(openIssues)} warn={openIssues > 0} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={tab === t.id ? btnPrimary : btnGhost}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tournee' && <TourTab session={session} onChange={onChange} flush={flush} readOnly={readOnly} />}
      {tab === 'remarques' && <RemarksTab session={session} onChange={onChange} readOnly={readOnly} />}
      {tab === 'incoherences' && <IssuesTab session={session} onChange={onChange} />}
      {tab === 'cloture' && <CloseTab session={session} onChange={onChange} flush={flush} />}
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: warn ? '#b45309' : 'inherit' }}>{value}</div>
    </div>
  )
}

// ── Tournée : arbre bâtiment › zone › logement, puis lots, tâches, sous-tâches ──

function TourTab({ session, onChange, flush, readOnly }: {
  session: V2Session
  onChange: (s: V2Session) => void
  flush: () => void
  readOnly: boolean
}) {
  const tree = buildTree(session.units)
  const [unitId, setUnitId] = useState<string | null>(
    (session.units.find(u => u.tasks.length > 0) ?? session.units[0])?.id ?? null,
  )
  const unit = session.units.find(u => u.id === unitId) ?? null

  const selectUnit = (id: string) => {
    if (id !== unitId) flush()
    setUnitId(id)
  }

  const patch: PatchTask = (unitId, taskId, p) =>
    onChange({ ...session, units: patchTask(session.units, unitId, taskId, p) })

  const unitButton = (u: V2Unit, indent: number) => (
    <button key={u.id} onClick={() => selectUnit(u.id)}
      style={{
        display: 'flex', width: '100%', justifyContent: 'space-between', padding: '7px 8px',
        paddingLeft: 8 + indent, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
        background: u.id === unitId ? 'var(--navy-2, #1e3a5f)' : 'transparent',
        color: u.id === unitId ? '#fff' : 'inherit',
      }}>
      <span>{u.label}</span>
      <span style={{ opacity: 0.8 }}>{pct(unitProgress(u))}</span>
    </button>
  )

  const childNode = (c: ChildNode) => {
    if (c.kind === 'unit') return unitButton(c.unit, 0)
    return (
      <div key={c.label}>
        <div style={{ fontSize: 12, fontWeight: 700, padding: '6px 8px', color: 'var(--muted)' }}>
          {c.label} · {pct(nodeProgress(c))}
        </div>
        {c.units.map(u => unitButton(u, 12))}
      </div>
    )
  }

  if (session.units.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--muted)' }}>Aucun logement dans cette session.</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: 14, alignItems: 'start' }}>
      <div style={{ ...card, padding: 8 }}>
        {tree.map(b => (
          <div key={b.id} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, padding: '4px 8px' }}>
              {b.label} · {pct(buildingProgress(b))}
            </div>
            {b.children.map(childNode)}
          </div>
        ))}
      </div>
      <div>{unit && <UnitPanel key={unit.id} session={session} unit={unit} patch={patch} flush={flush} readOnly={readOnly} />}</div>
    </div>
  )
}

function UnitPanel({ session, unit, patch, flush, readOnly }: {
  session: V2Session
  unit: V2Unit
  patch: PatchTask
  flush: () => void
  readOnly: boolean
}) {
  const groups = lotGroups(unit.tasks)
  const titles = useMemo(() => new Map(getGanttTasks().map(t => [t.id, t.title])), [])
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({})

  const isOpen = (lotId: string, p: number | null) => openOverride[lotId] ?? !isComplete(p)
  const toggle = (lotId: string, p: number | null) => {
    if (!isOpen(lotId, p)) flush()
    setOpenOverride(prev => ({ ...prev, [lotId]: !isOpen(lotId, p) }))
  }

  return (
    <div>
      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800 }}>{unit.buildingLabel} · {unit.label}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{groups.length} lot(s)</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{pct(unitProgress(unit))}</div>
      </div>

      {groups.map(g => {
        const p = lotProgress(g.tasks)
        const done = isComplete(p)
        const open = isOpen(g.lotId, p)
        return (
          <div key={g.lotId} style={{ ...card, background: done ? '#f0fdf4' : '#fff' }}>
            <button onClick={() => toggle(g.lotId, p)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              <span style={{ width: 12 }}>{open ? '▾' : '▸'}</span>
              <span style={{ fontWeight: 700, flex: 1 }}>{titles.get(g.lotId) ?? g.lotId}</span>
              {done && <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>✓ Terminé</span>}
              <span style={{ fontWeight: 700 }}>{pct(p)}</span>
            </button>
            {open && (
              <div style={{ marginTop: 10 }}>
                {g.tasks.map(t => (
                  <TaskRow key={t.id} unitId={unit.id} task={t} depth={0} session={session} patch={patch} readOnly={readOnly} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TaskRow({ unitId, task, depth, session, patch, readOnly }: {
  unitId: string
  task: V2Task
  depth: number
  session: V2Session
  patch: PatchTask
  readOnly: boolean
}) {
  const p = taskProgress(task)
  const hasChildren = !!task.children?.length
  const base = session.baseline[`t:${unitId}:${task.id}`]
  const regressed = base !== undefined && Math.round(base) === 100 && p !== null && Math.round(p) < 100

  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: `8px 0 8px ${depth * 16}px` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 180, fontSize: 13, opacity: task.na ? 0.5 : 1 }}>
          {task.title}
          {task.plannedProgress !== undefined && (
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>prévu {task.plannedProgress} %</span>
          )}
        </span>
        {hasChildren ? (
          <span style={{ fontWeight: 700, fontSize: 13 }}>{pct(p)}</span>
        ) : (
          <>
            <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="checkbox" disabled={readOnly} checked={task.na}
                onChange={e => patch(unitId, task.id, { na: e.target.checked, progress: e.target.checked ? undefined : task.progress })} />
              N/A
            </label>
            <input type="number" min={0} max={100} step={5} disabled={readOnly || task.na}
              value={task.progress ?? ''} placeholder="—" style={{ ...input, width: 72 }}
              onChange={e => {
                const raw = e.target.value
                if (raw === '') return patch(unitId, task.id, { progress: undefined })
                patch(unitId, task.id, { progress: Math.max(0, Math.min(100, Number(raw))), na: false })
              }} />
            <input type="range" min={0} max={100} step={5} disabled={readOnly || task.na}
              value={task.progress ?? 0} style={{ width: 120 }}
              onChange={e => patch(unitId, task.id, { progress: Number(e.target.value), na: false })} />
          </>
        )}
      </div>
      {regressed && (
        <input placeholder="Motif de la régression (obligatoire)" value={task.comment ?? ''} disabled={readOnly}
          onChange={e => patch(unitId, task.id, { comment: e.target.value })}
          style={{ ...input, width: '100%', marginTop: 6, border: '1px solid #f59e0b' }} />
      )}
      {hasChildren && task.children!.map(c => (
        <TaskRow key={c.id} unitId={unitId} task={c} depth={depth + 1} session={session} patch={patch} readOnly={readOnly} />
      ))}
    </div>
  )
}

// ── Remarques : tableau éditable ────────────────────────────────────────────

function RemarksTab({ session, onChange, readOnly }: {
  session: V2Session
  onChange: (s: V2Session) => void
  readOnly: boolean
}) {
  const titles = useMemo(() => new Map(getGanttTasks().map(t => [t.id, t.title])), [])
  const lotIds = [...new Set(allLeaves(session.units).map(t => t.lotId))]
  const now = () => new Date().toISOString()

  const [draft, setDraft] = useState({
    description: '', priority: 'moyenne' as RemarkPriority, lotId: lotIds[0] ?? '', unitId: '', companies: '', dueDate: '',
  })

  const add = () => {
    if (!draft.description.trim()) return
    onChange(addRemark(session, {
      description: draft.description.trim(),
      priority: draft.priority,
      lotIds: draft.lotId ? [draft.lotId] : [],
      unitIds: draft.unitId ? [draft.unitId] : [],
      companies: draft.companies.split(',').map(s => s.trim()).filter(Boolean),
      dueDate: draft.dueDate || undefined,
    }, now()))
    setDraft({ ...draft, description: '', companies: '', dueDate: '' })
  }

  const edit = (r: V2Remark, p: Partial<V2Remark>) => onChange(patchRemark(session, r.id, p, now()))

  return (
    <div style={{ ...card, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>
            <th>N°</th><th>Description</th><th>Lot</th><th>Logement</th><th>Priorité</th><th>Statut</th><th>Délai</th><th>Entreprises</th>
          </tr>
        </thead>
        <tbody>
          {session.remarks.map(r => (
            <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ padding: '6px 4px', fontWeight: 700 }}>{r.number}</td>
              <td><input value={r.description} disabled={readOnly} style={{ ...input, width: 240 }} onChange={e => edit(r, { description: e.target.value })} /></td>
              <td>
                <select value={r.lotIds[0] ?? ''} disabled={readOnly} style={input} onChange={e => edit(r, { lotIds: e.target.value ? [e.target.value] : [] })}>
                  <option value="">—</option>
                  {lotIds.map(id => <option key={id} value={id}>{titles.get(id) ?? id}</option>)}
                </select>
              </td>
              <td>
                <select value={r.unitIds[0] ?? ''} disabled={readOnly} style={input} onChange={e => edit(r, { unitIds: e.target.value ? [e.target.value] : [] })}>
                  <option value="">—</option>
                  {session.units.map(u => <option key={u.id} value={u.id}>{u.buildingLabel} · {u.label}</option>)}
                </select>
              </td>
              <td>
                <select value={r.priority} disabled={readOnly} style={input} onChange={e => edit(r, { priority: e.target.value as RemarkPriority })}>
                  {(Object.keys(REMARK_PRIORITY_LABEL) as RemarkPriority[]).map(k => <option key={k} value={k}>{REMARK_PRIORITY_LABEL[k]}</option>)}
                </select>
              </td>
              <td>
                <select value={r.status} disabled={readOnly} style={input} onChange={e => edit(r, { status: e.target.value as RemarkStatus })}>
                  {(Object.keys(REMARK_STATUS_LABEL) as RemarkStatus[]).map(k => <option key={k} value={k}>{REMARK_STATUS_LABEL[k]}</option>)}
                </select>
              </td>
              <td>
                <input type="date" value={r.dueDate ?? ''} disabled={readOnly} style={input} onChange={e => edit(r, { dueDate: e.target.value || undefined })} />
              </td>
              <td>
                <input value={r.companies.join(', ')} disabled={readOnly} style={{ ...input, width: 150 }}
                  onChange={e => edit(r, { companies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              </td>
            </tr>
          ))}
          {!readOnly && (
            <tr style={{ borderTop: '1px solid var(--line)' }}>
              <td />
              <td><input placeholder="Nouvelle remarque…" value={draft.description} style={{ ...input, width: 240 }}
                onChange={e => setDraft({ ...draft, description: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') add() }} /></td>
              <td>
                <select value={draft.lotId} style={input} onChange={e => setDraft({ ...draft, lotId: e.target.value })}>
                  {lotIds.map(id => <option key={id} value={id}>{titles.get(id) ?? id}</option>)}
                </select>
              </td>
              <td>
                <select value={draft.unitId} style={input} onChange={e => setDraft({ ...draft, unitId: e.target.value })}>
                  <option value="">—</option>
                  {session.units.map(u => <option key={u.id} value={u.id}>{u.buildingLabel} · {u.label}</option>)}
                </select>
              </td>
              <td>
                <select value={draft.priority} style={input} onChange={e => setDraft({ ...draft, priority: e.target.value as RemarkPriority })}>
                  {(Object.keys(REMARK_PRIORITY_LABEL) as RemarkPriority[]).map(k => <option key={k} value={k}>{REMARK_PRIORITY_LABEL[k]}</option>)}
                </select>
              </td>
              <td><button style={btnPrimary} onClick={add}>Ajouter</button></td>
              <td><input type="date" value={draft.dueDate} style={input} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} /></td>
              <td><input placeholder="Entreprises" value={draft.companies} style={{ ...input, width: 150 }} onChange={e => setDraft({ ...draft, companies: e.target.value })} /></td>
            </tr>
          )}
        </tbody>
      </table>
      {session.remarks.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Aucune remarque. Les remarques ouvertes des sessions précédentes sont reportées automatiquement.</p>}
    </div>
  )
}

// ── Incohérences ────────────────────────────────────────────────────────────

function IssuesTab({ session, onChange }: { session: V2Session; onChange: (s: V2Session) => void }) {
  const issues = detectIssues(session)
  const open = issues.filter(i => !i.acknowledged)
  const accepted = issues.filter(i => i.acknowledged)
  const accept = (key: string) => onChange({ ...session, acknowledged: [...session.acknowledged, key] })

  return (
    <div>
      {open.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Aucune incohérence à corriger.</p>}
      {open.map(i => (
        <div key={i.key} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, borderLeft: `3px solid ${i.severity === 'error' ? '#dc2626' : '#f59e0b'}` }}>
          <span style={{ flex: 1, fontSize: 13 }}>{i.message}</span>
          <button style={btnGhost} onClick={() => accept(i.key)}>Accepter</button>
        </div>
      ))}
      {accepted.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12, color: 'var(--muted)' }}>{accepted.length} acceptée(s)</summary>
          {accepted.map(i => <div key={i.key} style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>{i.message}</div>)}
        </details>
      )}
    </div>
  )
}

// ── Clôture : planning et CR ────────────────────────────────────────────────

function CloseTab({ session, onChange, flush }: {
  session: V2Session
  onChange: (s: V2Session) => void
  flush: () => void
}) {
  const readOnly = session.status === 'close'
  const openIssues = detectIssues(session).filter(i => !i.acknowledged).length
  const openRemarks = session.remarks.filter(r => r.status !== 'fait' && r.status !== 'obsolete').length
  const observed = allLeaves(session.units).filter(t => !t.na && t.progress !== undefined).length

  const close = () => {
    if (!window.confirm(`Clôturer la session ? ${observed} avancement(s) seront reportés au planning.`)) return
    const closed: V2Session = { ...session, status: 'close', closedAt: new Date().toISOString() }
    onChange(closed)
    saveGanttTasks(applySessionToPlanning(getGanttTasks(), closed))
    flush()
  }

  return (
    <div style={card}>
      <ul style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 18 }}>
        <li>Avancement projet : <b>{pct(projectProgress(session.units))}</b></li>
        <li>Avancements observés à reporter au planning : <b>{observed}</b></li>
        <li>Remarques ouvertes (reportées à la prochaine session) : <b>{openRemarks}</b></li>
        <li>Incohérences non acceptées : <b>{openIssues}</b></li>
      </ul>
      {readOnly ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Session clôturée le {session.closedAt?.slice(0, 10)}.</p>
      ) : (
        <button style={btnPrimary} onClick={close}>Clôturer la session</button>
      )}
    </div>
  )
}
