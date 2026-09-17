import { useState, useMemo, useEffect } from 'react'
import { Eye, EyeOff, AlertTriangle, Zap, ZoomIn, ZoomOut, GitBranch } from 'lucide-react'
import { GanttTask, GanttViewState } from '../../types/gantt'
import {
  getGanttTasks, saveGanttTasks, getHolidays, getGanttPrefs, saveGanttPrefs, GanttGroup, logActivity,
  getUnits, getTaskUnits, getZoneRefs,
} from '../../lib/repo'
import { maxDrift, lateTasks, flattenLeaves } from '../../lib/schedule'
import { withActualDates } from '../../lib/actualDates'
import { taskConcernsUnit } from '../../lib/units'
import { computeCpm, autoSchedule, applyCriticality } from '../../lib/cpm'
import { makeCalendar } from '../../lib/calendar'
import GanttTable from '../gantt/GanttTable'
import LogementMatrix from '../gantt/LogementMatrix'
import { MultiSelect } from '../gantt/MultiSelect'
import { TaskDetail } from '../gantt/TaskDetail'
import '../../styles/gantt.css'

const LOT_OPTS = [
  { id: 'L05', label: 'LOT 05 — Menuiseries' },
  { id: 'L06', label: 'LOT 06 — Électricité' },
  { id: 'L07', label: 'LOT 07 — CVC' },
  { id: 'L08', label: 'LOT 08 — Embellissements' },
]

const updateTaskInList = (list: GanttTask[], id: string, updates: Partial<GanttTask>): GanttTask[] =>
  list.map(t => {
    if (t.id === id) return { ...t, ...updates }
    if (t.children?.length) return { ...t, children: updateTaskInList(t.children, id, updates) }
    return t
  })

/** Comme updateTaskInList, mais la mise à jour est calculée depuis la tâche. */
const mapTaskInList = (list: GanttTask[], id: string, fn: (t: GanttTask) => GanttTask): GanttTask[] =>
  list.map(t => {
    if (t.id === id) return fn(t)
    if (t.children?.length) return { ...t, children: mapTaskInList(t.children, id, fn) }
    return t
  })

function makeParent(id: string, title: string, children: GanttTask[]): GanttTask {
  const leaves = children.filter(c => !c.is_milestone)
  const min = (f: (c: GanttTask) => number) => new Date(Math.min(...children.map(f)))
  const max = (f: (c: GanttTask) => number) => new Date(Math.max(...children.map(f)))
  return {
    id, lot_id: children[0]?.lot_id ?? '', title,
    planned_start: min(c => c.planned_start.getTime()), planned_end: max(c => c.planned_end.getTime()),
    planned_duration: 0,
    progress: leaves.length ? Math.round(leaves.reduce((s, c) => s + c.progress, 0) / leaves.length) : 0,
    status: 'in-progress', priority: 'medium', dependencies: [],
    is_milestone: false, is_critical: children.some(c => c.is_critical), children,
  }
}

// Build the display tree from the raw tasks, applying grouping + multi filters.
interface ZoneOpt { id: string; label: string }

function buildTree(
  tasks: GanttTask[], group: GanttGroup, lots: Set<string>, zones: Set<string>,
  zoneRefs: ZoneOpt[], concerns: (taskId: string, unitId: string) => boolean,
): GanttTask[] {
  const leaves = flattenLeaves(tasks).filter(l =>
    (lots.size === 0 || lots.has(l.lot_id)) &&
    (zones.size === 0 || [...zones].some(z => concerns(l.id, z))),
  )
  if (group === 'chrono') {
    return [...leaves].sort((a, b) => a.planned_start.getTime() - b.planned_start.getTime())
  }
  if (group === 'zone') {
    // Regroupe par zone du projet (bâtiments, logements, communs) via les
    // rattachements tâche→unité saisis dans « Bâtiments & zones ».
    return zoneRefs
      .map(z => {
        const children = leaves.filter(l => concerns(l.id, z.id))
        return children.length ? makeParent(`grp-z-${z.id}`, z.label, children) : null
      })
      .filter((t): t is GanttTask => t !== null)
  }
  // group === 'lot'
  const ids = new Set(leaves.map(l => l.id))
  return tasks
    .map(lot => {
      const children = (lot.children ?? []).filter(c => ids.has(c.id))
      return children.length ? makeParent(`grp-l-${lot.lot_id}`, lot.title, children) : null
    })
    .filter((t): t is GanttTask => t !== null)
}

export function Gantt() {
  const prefs0 = useMemo(() => getGanttPrefs(), [])
  const [mode, setMode] = useState<'gantt' | 'matrix'>('gantt')
  const [group, setGroup] = useState<GanttGroup>(prefs0.group)
  const [zoom, setZoom] = useState(prefs0.zoom)
  const [autoPlan, setAutoPlan] = useState(prefs0.autoSchedule)
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set())
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set())
  const [depsVisible, setDepsVisible] = useState(true)
  const [highlightCritical, setHighlightCritical] = useState(false)
  // Lots collapsed on arrival : on n'affiche que les lots, on tape un lot pour
  // dérouler ses tâches.
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => new Set())
  const [detailTask, setDetailTask] = useState<GanttTask | null>(null)
  const [showDelays, setShowDelays] = useState(false)
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>(getGanttTasks)
  const holidays = useMemo(() => getHolidays(), [])
  const calendar = useMemo(() => makeCalendar(holidays), [holidays])

  // Zones du projet (unités) et rattachements tâche→zone, pour le regroupement
  // et le filtre « Par logement ».
  const units = useMemo(() => getUnits(), [])
  const links = useMemo(() => getTaskUnits(), [])
  const zoneOpts = useMemo(() => getZoneRefs().map(z => ({ id: z.refId, label: z.label, group: z.buildingLabel })), [])
  const concerns = useMemo(() => (taskId: string, unitId: string) => taskConcernsUnit(units, links, taskId, unitId), [units, links])

  useEffect(() => { saveGanttTasks(ganttTasks) }, [ganttTasks])
  useEffect(() => { saveGanttPrefs({ zoom, group, autoSchedule: autoPlan }) }, [zoom, group, autoPlan])

  // CPM : chemin critique + marges recalculés depuis le réseau de dépendances.
  const cpm = useMemo(() => computeCpm(ganttTasks), [ganttTasks])
  const tasksWithCpm = useMemo(
    () => applyCriticality(ganttTasks, cpm.criticalIds),
    [ganttTasks, cpm],
  )

  const displayTree = useMemo(
    () => buildTree(tasksWithCpm, group, selectedLots, selectedZones, zoneOpts, concerns),
    [tasksWithCpm, group, selectedLots, selectedZones, zoneOpts, concerns],
  )

  // Changer de regroupement / filtre replie tout : on repart des lots seuls.
  useEffect(() => {
    setExpandedTasks(new Set())
  }, [group, selectedLots, selectedZones])

  const { startDate, endDate } = useMemo(() => {
    // La fenêtre couvre le prévisionnel ET le réel constaté, pour que l'écart
    // reste visible même quand le chantier déborde de son planning.
    const starts = ganttTasks.flatMap(l => [
      (l.actual_start ?? l.planned_start).getTime(),
      ...(l.children ?? []).map(c => (c.actual_start ?? c.planned_start).getTime()),
    ])
    const ends = ganttTasks.flatMap(l => [
      Math.max(l.planned_end.getTime(), l.actual_end?.getTime() ?? 0),
      ...(l.children ?? []).map(c => Math.max(c.planned_end.getTime(), c.actual_end?.getTime() ?? 0)),
    ])
    const start = new Date(Math.min(...starts)); start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - ((start.getDay() || 7) - 1))
    const end = new Date(Math.max(...ends)); end.setDate(end.getDate() + 14)
    return { startDate: start, endDate: end }
  }, [ganttTasks])

  const viewState: GanttViewState = {
    view: 'week', startDate, endDate, depsVisible, highlightCritical, zoom, holidays, expandedTasks,
  }

  const drift = useMemo(() => maxDrift(ganttTasks), [ganttTasks])
  const lateCount = useMemo(() => lateTasks(ganttTasks, new Date()).length, [ganttTasks])

  const handleTaskUpdate = (id: string, updates: { planned_start?: Date; planned_end?: Date; actual_start?: Date; actual_end?: Date }) =>
    setGanttTasks(prev => {
      const moved = updateTaskInList(prev, id, updates)
      // Auto-schedule uniquement quand les dates contractuelles changent, pas les réelles.
      if (!autoPlan || (!updates.planned_start && !updates.planned_end)) return moved
      const { tasks: replanned, shifted } = autoSchedule(moved, calendar)
      if (shifted.length) {
        logActivity('planning', `Auto-planification : ${shifted.length} tâche${shifted.length > 1 ? 's' : ''} décalée${shifted.length > 1 ? 's' : ''} suite au déplacement`)
      }
      return replanned
    })
  /** Saisir un avancement recale aussitôt les dates réelles de la tâche. */
  const handleProgress = (id: string, progress: number) => {
    const today = new Date()
    setGanttTasks(prev => {
      const bumped = updateTaskInList(prev, id, { progress })
      return mapTaskInList(bumped, id, t => withActualDates(t, today))
    })
    setDetailTask(t => (t && t.id === id ? withActualDates({ ...t, progress }, today) : t))
  }
  const groups: { id: GanttGroup; label: string }[] = [
    { id: 'lot', label: 'Par lot' },
    { id: 'zone', label: 'Par logement' },
    { id: 'chrono', label: 'Chronologique' },
  ]

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {/* Mode + grouping */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#eef2f6', padding: '3px', borderRadius: '8px' }}>
          {(['gantt', 'matrix'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={seg(mode === m)}>{m === 'gantt' ? 'Gantt' : 'Damier'}</button>
          ))}
        </div>
        {mode === 'gantt' && (
          <div style={{ display: 'flex', gap: '4px', background: '#eef2f6', padding: '3px', borderRadius: '8px' }}>
            {groups.map(g => (
              <button key={g.id} onClick={() => setGroup(g.id)} style={seg(group === g.id)}>{g.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Drift / late banner */}
      {(drift > 0 || lateCount > 0) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {drift > 0 && (
            <button onClick={() => setShowDelays(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bad-bg)', color: 'var(--bad)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              <AlertTriangle size={14} />Dérive max : +{drift} j vs contractuel
            </button>
          )}
          {lateCount > 0 && (
            <button onClick={() => setShowDelays(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--warn-bg)', color: 'var(--warn)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              {lateCount} tâche{lateCount > 1 ? 's' : ''} en retard
            </button>
          )}
        </div>
      )}

      {mode === 'matrix' ? (
        <LogementMatrix tasks={ganttTasks} />
      ) : (
        <>
          {/* Filters + controls */}
          <div className="g-toolbar">
            <MultiSelect label="Lots" options={LOT_OPTS} selected={selectedLots} onChange={setSelectedLots} />
            <MultiSelect label="Logements" options={zoneOpts} selected={selectedZones} onChange={setSelectedZones} />
            <div style={{ flex: 1 }} />
            <button className={`gtb ${highlightCritical ? 'on' : ''}`} onClick={() => setHighlightCritical(!highlightCritical)} title="Chemin critique (calculé par CPM)">
              <Zap size={14} /><span style={{ fontSize: '10px', fontWeight: 600, marginLeft: '4px' }}>Critique</span>
            </button>
            <button className={`gtb ${autoPlan ? 'on' : ''}`} onClick={() => setAutoPlan(!autoPlan)} title="Auto-planification : décaler les tâches liées">
              <GitBranch size={14} /><span style={{ fontSize: '10px', fontWeight: 600, marginLeft: '4px' }}>Auto-planif</span>
            </button>
            <button className={`gtb ${depsVisible ? 'on' : ''}`} onClick={() => setDepsVisible(!depsVisible)} title="Liaisons">
              {depsVisible ? <Eye size={16} /> : <EyeOff size={16} />}<span style={{ fontSize: '10px', fontWeight: 600, marginLeft: '4px' }}>Liaisons</span>
            </button>
            <button className="gtb" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Dézoomer"><ZoomOut size={14} /></button>
            <button className="gtb" onClick={() => setZoom(z => Math.min(2.5, +(z + 0.25).toFixed(2)))} title="Zoomer"><ZoomIn size={14} /></button>
          </div>

          <div style={{ overflow: 'hidden', borderRadius: '6px', border: '1px solid #e4ecf2' }}>
            <GanttTable
              tasks={displayTree}
              viewState={viewState}
              onToggleExpanded={id => setExpandedTasks(prev => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id); else next.add(id)
                return next
              })}
              onTaskUpdate={handleTaskUpdate}
              onProgress={handleProgress}
              onTaskClick={setDetailTask}
            />
          </div>
        </>
      )}

      {detailTask && (
        <TaskDetail
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onProgress={handleProgress}
          onDates={(id, updates) => {
            handleTaskUpdate(id, updates)
            setDetailTask(t => (t && t.id === id ? { ...t, ...updates } : t))
          }}
          totalFloat={cpm.nodes.get(detailTask.id)?.totalFloat}
        />
      )}

      {showDelays && <DelayPanel tasks={ganttTasks} onClose={() => setShowDelays(false)} />}
    </div>
  )
}

// ── Panneau analyse des retards ────────────────────────────────────────────────
function DelayPanel({ tasks, onClose }: { tasks: GanttTask[]; onClose: () => void }) {
  const today = new Date()
  const fr = (d?: Date) => (d ? d.toLocaleDateString('fr-FR') : '—')
  const delay = (t: GanttTask) => {
    if (t.actual_end) return Math.round((t.actual_end.getTime() - t.planned_end.getTime()) / 86400000)
    if (t.progress >= 100) return 0
    const late = Math.round((today.getTime() - t.planned_end.getTime()) / 86400000)
    return late > 0 ? late : 0
  }

  const byLot = tasks.map(lot => {
    const leaves = (lot.children ?? []).filter(c => !c.is_milestone)
    const maxDelay = leaves.reduce((m, c) => Math.max(m, delay(c)), 0)
    const last = [...leaves].sort((a, b) => b.planned_end.getTime() - a.planned_end.getTime())[0]
    return { lot, leaves, maxDelay, last }
  }).filter(r => r.maxDelay > 0 || r.leaves.some(c => delay(c) > 0))

  const allLeaves = tasks.flatMap(lot =>
    (lot.children ?? []).filter(c => !c.is_milestone).map(t => ({ lot, t }))
  ).filter(r => delay(r.t) > 0)
    .sort((a, b) => delay(b.t) - delay(a.t))

  const delayColor = (d: number) => d >= 14 ? '#b42318' : d >= 5 ? '#b45309' : '#92400e'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} onClick={onClose} />
      <div style={{ position: 'relative', marginTop: 'auto', background: '#fff', borderRadius: '16px 16px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 10px', borderBottom: '1px solid #e4ecf2' }}>
          <span style={{ flex: 1, fontWeight: 700, fontSize: '15px', color: '#02457A' }}>Analyse des retards</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#5b7183' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 16px 24px' }}>

          {/* Par lot / entreprise */}
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#5b7183', textTransform: 'uppercase', letterSpacing: '.05em' }}>Par lot</h4>
          {byLot.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#5b7183' }}>Aucun retard constaté.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Lot', 'Dernière tâche', 'Fin contractuelle', 'Fin réelle/projetée', 'Dérive finale'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#5b7183', borderBottom: '1px solid #e4ecf2', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byLot.map(({ lot, last, maxDelay }) => (
                    <tr key={lot.id} style={{ borderBottom: '1px solid #f0f5f9' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: '#02457A' }}>{lot.lot_id} · {lot.title}</td>
                      <td style={{ padding: '7px 10px', color: '#1f2937' }}>{last?.title ?? '—'}</td>
                      <td style={{ padding: '7px 10px', color: '#5b7183' }}>{fr(last?.planned_end)}</td>
                      <td style={{ padding: '7px 10px', color: '#5b7183' }}>{last?.actual_end ? fr(last.actual_end) : 'en cours'}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: delayColor(maxDelay) }}>+{maxDelay} j</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Par tâche */}
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#5b7183', textTransform: 'uppercase', letterSpacing: '.05em' }}>Par tâche</h4>
          {allLeaves.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#5b7183' }}>Aucune tâche en retard.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Lot', 'Tâche', 'Début prévu', 'Fin prévue', 'Début réel', 'Fin réelle/projetée', 'Retard'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#5b7183', borderBottom: '1px solid #e4ecf2', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allLeaves.map(({ lot, t }) => {
                    const d = delay(t)
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f0f5f9' }}>
                        <td style={{ padding: '7px 10px', color: '#018ABE', fontWeight: 600 }}>{lot.lot_id}</td>
                        <td style={{ padding: '7px 10px', color: '#1f2937' }}>{t.title}</td>
                        <td style={{ padding: '7px 10px', color: '#5b7183' }}>{fr(t.planned_start)}</td>
                        <td style={{ padding: '7px 10px', color: '#5b7183' }}>{fr(t.planned_end)}</td>
                        <td style={{ padding: '7px 10px', color: '#5b7183' }}>{fr(t.actual_start)}</td>
                        <td style={{ padding: '7px 10px', color: '#5b7183' }}>{t.actual_end ? fr(t.actual_end) : 'en cours'}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: delayColor(d) }}>+{d} j</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const seg = (on: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? '#02457A' : '#5b7183', boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none', whiteSpace: 'nowrap' })
