import { useState, useMemo, useEffect } from 'react'
import { Eye, EyeOff, RotateCcw, AlertTriangle, Zap, ZoomIn, ZoomOut } from 'lucide-react'
import { GanttTask, GanttViewState } from '../../types/gantt'
import { GANTT_TASKS } from '../../data/ganttMockData'
import { ZONES } from '../../data/zones'
import { getGanttTasks, saveGanttTasks, getHolidays } from '../../lib/repo'
import { maxDrift, lateTasks } from '../../lib/schedule'
import GanttTable from '../gantt/GanttTable'
import LogementMatrix from '../gantt/LogementMatrix'
import '../../styles/gantt.css'

const LOTS = [
  { id: 'L05', name: 'LOT 05' },
  { id: 'L06', name: 'LOT 06' },
  { id: 'L07', name: 'LOT 07' },
  { id: 'L08', name: 'LOT 08' },
]

const updateTaskInList = (
  list: GanttTask[],
  taskId: string,
  updates: Partial<GanttTask>,
): GanttTask[] =>
  list.map(t => {
    if (t.id === taskId) return { ...t, ...updates }
    if (t.children?.length) return { ...t, children: updateTaskInList(t.children, taskId, updates) }
    return t
  })

// Combined AND filter: keep lots matching lotId; within each, keep only children
// matching zoneId (a logement id). Parent lots with no matching child are dropped.
const filterTasks = (
  tasks: GanttTask[],
  lotId: string | null,
  zoneId: string | null,
): GanttTask[] => {
  const base = lotId ? tasks.filter(t => t.lot_id === lotId) : tasks
  if (!zoneId) return base
  const out: GanttTask[] = []
  for (const lot of base) {
    const children = (lot.children ?? []).filter(c => c.logement_id === zoneId)
    if (children.length) out.push({ ...lot, children })
  }
  return out
}

export function Gantt() {
  const [mode, setMode] = useState<'gantt' | 'matrix'>('gantt')
  const [view, setView] = useState<'week' | 'month'>('week')
  const [selectedLot, setSelectedLot] = useState<string | null>(null)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [depsVisible, setDepsVisible] = useState(true)
  const [highlightCritical, setHighlightCritical] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>(getGanttTasks)
  const holidays = useMemo(() => getHolidays(), [])

  useEffect(() => {
    saveGanttTasks(ganttTasks)
  }, [ganttTasks])

  // Anchor the timeline to the project start: Monday of the earliest baseline,
  // so the first column is week S0. End = latest task end + 2 weeks of margin.
  const { startDate, endDate } = useMemo(() => {
    const dates = ganttTasks.flatMap(l => [
      (l.baseline_start ?? l.planned_start).getTime(),
      ...(l.children ?? []).map(c => (c.baseline_start ?? c.planned_start).getTime()),
    ])
    const ends = ganttTasks.flatMap(l => [
      l.planned_end.getTime(), (l.baseline_end ?? l.planned_end).getTime(),
      ...(l.children ?? []).flatMap(c => [c.planned_end.getTime(), (c.baseline_end ?? c.planned_end).getTime()]),
    ])
    const start = new Date(Math.min(...dates))
    start.setHours(0, 0, 0, 0)
    const dow = start.getDay() || 7           // Mon=1..Sun=7
    start.setDate(start.getDate() - (dow - 1)) // back to Monday
    const end = new Date(Math.max(...ends))
    end.setDate(end.getDate() + 14)
    return { startDate: start, endDate: end }
  }, [ganttTasks])

  const filteredTasks = useMemo(
    () => filterTasks(ganttTasks, selectedLot, selectedZone),
    [selectedLot, selectedZone, ganttTasks],
  )

  const viewState: GanttViewState = {
    view,
    startDate,
    endDate,
    selectedLotId: selectedLot,
    selectedZoneId: selectedZone,
    depsVisible,
    highlightCritical,
    zoom,
    holidays,
    expandedTasks,
  }

  const drift = useMemo(() => maxDrift(ganttTasks), [ganttTasks])
  const lateCount = useMemo(() => lateTasks(ganttTasks, new Date()).length, [ganttTasks])

  const handleTaskUpdate = (taskId: string, updates: { planned_start?: Date; planned_end?: Date }) => {
    setGanttTasks(prev => updateTaskInList(prev, taskId, updates))
  }

  const handleReset = () => {
    setGanttTasks(GANTT_TASKS)
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {/* Mode switch: Gantt vs Damier logements */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', background: '#eef2f6', padding: '3px', borderRadius: '8px', width: 'fit-content' }}>
        <button
          onClick={() => setMode('gantt')}
          style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: mode === 'gantt' ? '#fff' : 'transparent', color: mode === 'gantt' ? '#02457A' : '#5b7183', boxShadow: mode === 'gantt' ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}
        >
          Gantt
        </button>
        <button
          onClick={() => setMode('matrix')}
          style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: mode === 'matrix' ? '#fff' : 'transparent', color: mode === 'matrix' ? '#02457A' : '#5b7183', boxShadow: mode === 'matrix' ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}
        >
          Damier logements
        </button>
      </div>

      {/* Drift / late banner */}
      {(drift > 0 || lateCount > 0) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {drift > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bad-bg)', color: 'var(--bad)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
              <AlertTriangle size={14} />
              Dérive max : +{drift} j vs contractuel
            </div>
          )}
          {lateCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--warn-bg)', color: 'var(--warn)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
              {lateCount} tâche{lateCount > 1 ? 's' : ''} en retard
            </div>
          )}
        </div>
      )}

      {/* Toolbar — row 1: lot filters */}
      <div className="g-toolbar">
        <button
          className={`gtb ${!selectedLot ? 'on' : ''}`}
          onClick={() => setSelectedLot(null)}
        >
          ⊞ Tous
        </button>
        {LOTS.map(lot => (
          <button
            key={lot.id}
            className={`gtb ${selectedLot === lot.id ? 'on' : ''}`}
            onClick={() => setSelectedLot(lot.id)}
          >
            {lot.name}
          </button>
        ))}
      </div>

      {mode === 'matrix' ? (
        <LogementMatrix tasks={filteredTasks} />
      ) : (
      <>
      {/* Toolbar — row 2: zone filter + controls */}
      <div className="g-toolbar">
        <select
          className="gtb-select"
          value={selectedZone ?? ''}
          onChange={e => setSelectedZone(e.target.value || null)}
          title="Filtrer par zone / logement"
        >
          <option value="">⊞ Toutes zones</option>
          {ZONES.map(zone => (
            <optgroup key={zone.id} label={zone.label}>
              {zone.logements.map(l => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button
          className={`gtb ${highlightCritical ? 'on' : ''}`}
          onClick={() => setHighlightCritical(!highlightCritical)}
          title="Mettre en évidence le chemin critique"
        >
          <Zap size={14} />
          <span style={{ fontSize: '10px', fontWeight: '600', marginLeft: '4px' }}>Critique</span>
        </button>
        <button
          className={`gtb ${depsVisible ? 'on' : ''}`}
          onClick={() => setDepsVisible(!depsVisible)}
          title="Afficher/masquer les liaisons"
        >
          {depsVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          <span style={{ fontSize: '10px', fontWeight: '600', marginLeft: '4px' }}>Liaisons</span>
        </button>
        <button className={`gtb ${view === 'week' ? 'on' : ''}`} onClick={() => setView('week')} title="Vue semaine">S</button>
        <button className={`gtb ${view === 'month' ? 'on' : ''}`} onClick={() => setView('month')} title="Vue mois">M</button>
        <button className="gtb" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Dézoomer"><ZoomOut size={14} /></button>
        <button className="gtb" onClick={() => setZoom(z => Math.min(2.5, +(z + 0.25).toFixed(2)))} title="Zoomer"><ZoomIn size={14} /></button>
        <button className="gtb" onClick={handleReset} title="Réinitialiser les dates">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Gantt Table */}
      <div style={{ overflow: 'hidden', borderRadius: '6px', border: '1px solid #e4ecf2' }}>
        <GanttTable
          tasks={filteredTasks}
          viewState={viewState}
          onToggleExpanded={(taskId: string) => {
            setExpandedTasks(prev => {
              const next = new Set(prev)
              if (next.has(taskId)) next.delete(taskId)
              else next.add(taskId)
              return next
            })
          }}
          onTaskUpdate={handleTaskUpdate}
        />
      </div>
      </>
      )}
    </div>
  )
}
