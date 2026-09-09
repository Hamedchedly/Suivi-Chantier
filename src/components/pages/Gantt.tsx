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

export function Gantt() {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [selectedLot, setSelectedLot] = useState<string | null>(null)
  const [depsVisible, setDepsVisible] = useState(true)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>(GANTT_TASKS)

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 21)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 63)

  const filteredTasks = useMemo(() => {
    if (!selectedLot) return ganttTasks
    return ganttTasks.filter(t => t.lot_id === selectedLot)
  }, [selectedLot, ganttTasks])

  const viewState: GanttViewState = {
    view,
    startDate,
    endDate,
    selectedLotId: selectedLot,
    depsVisible,
    expandedTasks,
  }

  const handleTaskUpdate = (taskId: string, updates: { planned_start?: Date; planned_end?: Date }) => {
    setGanttTasks(prev => updateTaskInList(prev, taskId, updates))
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      {/* Toolbar */}
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
