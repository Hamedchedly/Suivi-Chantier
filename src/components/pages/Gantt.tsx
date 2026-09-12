import { useState, useMemo, useEffect } from 'react'
import { Eye, EyeOff, RotateCcw, AlertTriangle, Zap, ZoomIn, ZoomOut, GitBranch } from 'lucide-react'
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
  // Lots open on arrival: the planning is read at task level, and a lot is
  // collapsed by tapping it rather than expanded one by one.
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(
    () => new Set(getGanttTasks().filter(t => t.children?.length).map(t => t.id)),
  )
  const [detailTask, setDetailTask] = useState<GanttTask | null>(null)
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

  // Expand all group parents whenever the grouping / filters change.
  useEffect(() => {
    setExpandedTasks(new Set(displayTree.filter(t => t.children?.length).map(t => t.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleTaskUpdate = (id: string, updates: { planned_start?: Date; planned_end?: Date }) =>
    setGanttTasks(prev => {
      const moved = updateTaskInList(prev, id, updates)
      if (!autoPlan) return moved
      // Propage la contrainte fin -> début aux successeurs.
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
  /** Vider le planning de l'opération courante (pas de données de démonstration). */
  const handleReset = () => setGanttTasks([])

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
          {drift > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bad-bg)', color: 'var(--bad)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}><AlertTriangle size={14} />Dérive max : +{drift} j vs contractuel</div>}
          {lateCount > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--warn-bg)', color: 'var(--warn)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>{lateCount} tâche{lateCount > 1 ? 's' : ''} en retard</div>}
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
            <button className="gtb" onClick={handleReset} title="Réinitialiser les dates"><RotateCcw size={14} /></button>
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
    </div>
  )
}

const seg = (on: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? '#02457A' : '#5b7183', boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none', whiteSpace: 'nowrap' })
