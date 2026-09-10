import { useState, useMemo, useEffect } from 'react'
import { Eye, EyeOff, RotateCcw, AlertTriangle, Zap, ZoomIn, ZoomOut } from 'lucide-react'
import { GanttTask, GanttViewState } from '../../types/gantt'
import { GANTT_TASKS } from '../../data/ganttMockData'
import { LOGEMENTS } from '../../data/zones'
import {
  getGanttTasks, saveGanttTasks, getHolidays, getGanttPrefs, saveGanttPrefs, GanttGroup,
} from '../../lib/repo'
import { maxDrift, lateTasks, flattenLeaves } from '../../lib/schedule'
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
const LOGEMENT_OPTS = LOGEMENTS.map(l => ({ id: l.id, label: l.label, group: l.zoneLabel }))

const updateTaskInList = (list: GanttTask[], id: string, updates: Partial<GanttTask>): GanttTask[] =>
  list.map(t => {
    if (t.id === id) return { ...t, ...updates }
    if (t.children?.length) return { ...t, children: updateTaskInList(t.children, id, updates) }
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
    baseline_start: min(c => (c.baseline_start ?? c.planned_start).getTime()),
    baseline_end: max(c => (c.baseline_end ?? c.planned_end).getTime()),
    progress: leaves.length ? Math.round(leaves.reduce((s, c) => s + c.progress, 0) / leaves.length) : 0,
    status: 'in-progress', priority: 'medium', dependencies: [],
    is_milestone: false, is_critical: children.some(c => c.is_critical), children,
  }
}

// Build the display tree from the raw tasks, applying grouping + multi filters.
function buildTree(tasks: GanttTask[], group: GanttGroup, lots: Set<string>, zones: Set<string>): GanttTask[] {
  const leaves = flattenLeaves(tasks).filter(l =>
    (lots.size === 0 || lots.has(l.lot_id)) &&
    (zones.size === 0 || (l.logement_id ? zones.has(l.logement_id) : false)),
  )
  if (group === 'chrono') {
    return [...leaves].sort((a, b) => a.planned_start.getTime() - b.planned_start.getTime())
  }
  if (group === 'zone') {
    return LOGEMENTS
      .map(lg => {
        const children = leaves.filter(l => l.logement_id === lg.id)
        return children.length ? makeParent(`grp-z-${lg.id}`, lg.label, children) : null
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
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set())
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set())
  const [depsVisible, setDepsVisible] = useState(true)
  const [highlightCritical, setHighlightCritical] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [detailTask, setDetailTask] = useState<GanttTask | null>(null)
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>(getGanttTasks)
  const holidays = useMemo(() => getHolidays(), [])

  useEffect(() => { saveGanttTasks(ganttTasks) }, [ganttTasks])
  useEffect(() => { saveGanttPrefs({ zoom, group }) }, [zoom, group])

  const displayTree = useMemo(
    () => buildTree(ganttTasks, group, selectedLots, selectedZones),
    [ganttTasks, group, selectedLots, selectedZones],
  )

  // Expand all group parents whenever the grouping / filters change.
  useEffect(() => {
    setExpandedTasks(new Set(displayTree.filter(t => t.children?.length).map(t => t.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, selectedLots, selectedZones])

  const { startDate, endDate } = useMemo(() => {
    const starts = ganttTasks.flatMap(l => [(l.baseline_start ?? l.planned_start).getTime(), ...(l.children ?? []).map(c => (c.baseline_start ?? c.planned_start).getTime())])
    const ends = ganttTasks.flatMap(l => [l.planned_end.getTime(), ...(l.children ?? []).flatMap(c => [c.planned_end.getTime(), (c.baseline_end ?? c.planned_end).getTime()])])
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
    setGanttTasks(prev => updateTaskInList(prev, id, updates))
  const handleProgress = (id: string, progress: number) => {
    setGanttTasks(prev => updateTaskInList(prev, id, { progress }))
    setDetailTask(t => (t && t.id === id ? { ...t, progress } : t))
  }
  const handleReset = () => setGanttTasks(GANTT_TASKS)

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
            <MultiSelect label="Logements" options={LOGEMENT_OPTS} selected={selectedZones} onChange={setSelectedZones} />
            <div style={{ flex: 1 }} />
            <button className={`gtb ${highlightCritical ? 'on' : ''}`} onClick={() => setHighlightCritical(!highlightCritical)} title="Chemin critique">
              <Zap size={14} /><span style={{ fontSize: '10px', fontWeight: 600, marginLeft: '4px' }}>Critique</span>
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

      {detailTask && <TaskDetail task={detailTask} onClose={() => setDetailTask(null)} onProgress={handleProgress} />}
    </div>
  )
}

const seg = (on: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? '#02457A' : '#5b7183', boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none', whiteSpace: 'nowrap' })
