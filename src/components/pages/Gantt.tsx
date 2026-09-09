import { useState, useMemo } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { GanttTask, GanttViewState } from '../../types/gantt'
import { GANTT_TASKS } from '../../data/ganttMockData'
import GanttTable from '../gantt/GanttTable'
import '../../styles/gantt.css'

const LOTS = [
  { id: 'L05', name: 'LOT 05' },
  { id: 'L06', name: 'LOT 06' },
  { id: 'L07', name: 'LOT 07' },
  { id: 'L08', name: 'LOT 08' },
]

export function Gantt() {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [selectedLot, setSelectedLot] = useState<string | null>(null)
  const [depsVisible, setDepsVisible] = useState(true)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 21)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 42)

  // Filter tasks by lot
  const filteredTasks = useMemo(() => {
    if (!selectedLot) return GANTT_TASKS
    return GANTT_TASKS.filter(t => t.lot_id === selectedLot)
  }, [selectedLot])

  const viewState: GanttViewState = {
    view,
    startDate,
    endDate,
    selectedLotId: selectedLot,
    depsVisible,
    expandedTasks,
  }

  const currentWeek = Math.ceil((startDate.getTime() - new Date(startDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))

  const handleTaskUpdate = (taskId: string, updates: { planned_start?: Date; planned_end?: Date }) => {
    // For now, just log the update. In production, this would update state and call backend
    console.log(`Task ${taskId} updated:`, updates)
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0b3b60', marginBottom: '4px' }}>
          Planning
        </h1>
        <div style={{ fontSize: '12px', color: '#5c6f80' }}>
          S{currentWeek} • Vue {view === 'week' ? 'semaine' : 'mois'} • Déplacez les barres pour modifier les dates
        </div>
      </div>

      {/* Toolbar */}
      <div className="g-toolbar">
        <button
          className={`gtb ${!selectedLot ? 'on' : ''}`}
          onClick={() => setSelectedLot(null)}
          title="Tous les lots"
        >
          ⊞ Tous
        </button>
        {LOTS.map(lot => (
          <button
            key={lot.id}
            className={`gtb ${selectedLot === lot.id ? 'on' : ''}`}
            onClick={() => setSelectedLot(lot.id)}
            title={lot.name}
          >
            {lot.name}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          className={`gtb ${depsVisible ? 'on' : ''}`}
          onClick={() => setDepsVisible(!depsVisible)}
          title="Afficher/masquer les liaisons"
        >
          {depsVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          <span style={{ fontSize: '10px', fontWeight: '600', marginLeft: '4px' }}>
            Liaisons
          </span>
        </button>
        <button
          className={`gtb ${view === 'week' ? 'on' : ''}`}
          onClick={() => setView('week')}
          title="Vue semaine"
        >
          S
        </button>
        <button
          className={`gtb ${view === 'month' ? 'on' : ''}`}
          onClick={() => setView('month')}
          title="Vue mois"
        >
          M
        </button>
      </div>

      {/* Gantt Table */}
      <div style={{ marginTop: '12px', overflow: 'hidden', borderRadius: '6px', border: '1px solid #e3e9ee' }}>
        <GanttTable
          tasks={filteredTasks}
          viewState={viewState}
          onToggleExpanded={(taskId: string) => {
            const newExpanded = new Set(expandedTasks)
            if (newExpanded.has(taskId)) {
              newExpanded.delete(taskId)
            } else {
              newExpanded.add(taskId)
            }
            setExpandedTasks(newExpanded)
          }}
          onTaskUpdate={handleTaskUpdate}
        />
      </div>
    </div>
  )
}
