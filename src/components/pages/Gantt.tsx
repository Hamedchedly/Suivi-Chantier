import { useState, useMemo, useEffect } from 'react'
import { Eye, EyeOff, RotateCcw } from 'lucide-react'
import { GanttTask, GanttViewState } from '../../types/gantt'
import { GANTT_TASKS } from '../../data/ganttMockData'
import { ZONES } from '../../data/zones'
import { loadState, saveState } from '../../lib/storage'
import GanttTable from '../gantt/GanttTable'
import '../../styles/gantt.css'

// v2: data model gained zone_id / logement_id — invalidate v1 stored trees
const GANTT_STORAGE_KEY = 'sc-gantt-v2'

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
  let out = lotId ? tasks.filter(t => t.lot_id === lotId) : tasks
  if (zoneId) {
    out = out
      .map(lot => {
        const children = (lot.children ?? []).filter(c => c.logement_id === zoneId)
        return children.length ? { ...lot, children } : null
      })
      .filter((t): t is GanttTask => t !== null)
  }
  return out
}

export function Gantt() {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [selectedLot, setSelectedLot] = useState<string | null>(null)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [depsVisible, setDepsVisible] = useState(true)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>(() =>
    loadState<GanttTask[]>(GANTT_STORAGE_KEY, GANTT_TASKS),
  )

  useEffect(() => {
    saveState(GANTT_STORAGE_KEY, ganttTasks)
  }, [ganttTasks])

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 21)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 63)

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
    expandedTasks,
  }

  const handleTaskUpdate = (taskId: string, updates: { planned_start?: Date; planned_end?: Date }) => {
    setGanttTasks(prev => updateTaskInList(prev, taskId, updates))
  }

  const handleReset = () => {
    setGanttTasks(GANTT_TASKS)
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
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
          className={`gtb ${depsVisible ? 'on' : ''}`}
          onClick={() => setDepsVisible(!depsVisible)}
          title="Afficher/masquer les liaisons"
        >
          {depsVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          <span style={{ fontSize: '10px', fontWeight: '600', marginLeft: '4px' }}>Liaisons</span>
        </button>
        <button className={`gtb ${view === 'week' ? 'on' : ''}`} onClick={() => setView('week')}>S</button>
        <button className={`gtb ${view === 'month' ? 'on' : ''}`} onClick={() => setView('month')}>M</button>
        <button className="gtb" onClick={handleReset} title="Réinitialiser les dates">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Gantt Table */}
      <div style={{ overflow: 'hidden', borderRadius: '6px', border: '1px solid #e3e9ee' }}>
        <GanttTable
          tasks={filteredTasks}
          viewState={viewState}
          onToggleExpanded={(taskId: string) => {
            setExpandedTasks(prev => {
              const next = new Set(prev)
              next.has(taskId) ? next.delete(taskId) : next.add(taskId)
              return next
            })
          }}
          onTaskUpdate={handleTaskUpdate}
        />
      </div>
    </div>
  )
}
