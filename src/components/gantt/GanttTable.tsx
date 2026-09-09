import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { GanttTask, GanttViewState } from '../../types/gantt'

interface GanttTableProps {
  tasks: GanttTask[]
  viewState: GanttViewState
  onToggleExpanded: (taskId: string) => void
  onTaskUpdate?: (taskId: string, updates: { planned_start?: Date; planned_end?: Date }) => void
}

interface DragState {
  taskId?: string
  startX?: number
  startDate?: Date
  isDragging?: boolean
  mode?: 'move' | 'resize-start' | 'resize-end'
}

export default function GanttTable({ tasks, viewState, onToggleExpanded, onTaskUpdate }: GanttTableProps) {
  const [dragState, setDragState] = useState<DragState>({})
  const tableRef = useRef<HTMLDivElement>(null)

  const dayWidthPx = viewState.view === 'week' ? 24 : 12
  const msPerDay = 24 * 60 * 60 * 1000

  const handleBarMouseDown = (taskId: string, e: React.MouseEvent, mode: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragState({
      taskId,
      startX: e.clientX,
      isDragging: true,
      mode,
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.taskId || !dragState.startX) return

    const delta = e.clientX - dragState.startX
    const daysShift = Math.round(delta / dayWidthPx)

    // Log the drag for now (MVP)
    if (Math.abs(daysShift) > 0) {
      console.log(`Dragging task ${dragState.taskId}: ${daysShift} days, mode: ${dragState.mode}`)
    }
  }

  const handleMouseUp = () => {
    if (dragState.isDragging && dragState.taskId && dragState.startX) {
      console.log(`Drag ended for task ${dragState.taskId}`)
    }
    setDragState({})
  }

  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState])

  const getStatusColor = (status: GanttTask['status'], isCritical: boolean) => {
    if (status === 'completed') return '#15803d' // green
    if (status === 'in-progress') return '#185fa5' // blue
    if (status === 'delayed' || status === 'blocked') return '#b91c1c' // red
    if (status === 'not-started') return '#78716c' // gray
    return '#6b21a8' // purple for cancelled
  }

  const getTasksBefore = (taskId: string): GanttTask[] => {
    const result: GanttTask[] = []
    const collect = (list: GanttTask[]) => {
      for (const t of list) {
        if (t.id === taskId) return true
        result.push(t)
        if (t.children && collect(t.children)) return true
        result.pop()
      }
      return false
    }
    collect(tasks)
    return result
  }

  const isTaskVisible = (taskId: string): boolean => {
    const tasksBefore = getTasksBefore(taskId)
    for (const t of tasksBefore) {
      if (t.children && !viewState.expandedTasks.has(t.id)) return false
    }
    return true
  }

  const daysInRange = Math.ceil((viewState.endDate.getTime() - viewState.startDate.getTime()) / (24 * 60 * 60 * 1000))

  const formatDateRange = () => {
    return `${viewState.startDate.toLocaleDateString('fr')} - ${viewState.endDate.toLocaleDateString('fr')}`
  }

  const renderTaskRow = (task: GanttTask, depth: number = 0): JSX.Element[] => {
    const result: JSX.Element[] = []

    if (!isTaskVisible(task.id)) return result

    const hasChildren = task.children && task.children.length > 0
    const isExpanded = viewState.expandedTasks.has(task.id)

    const taskStart = Math.max(0, Math.floor((task.planned_start.getTime() - viewState.startDate.getTime()) / (24 * 60 * 60 * 1000)))
    const taskEnd = Math.min(daysInRange, Math.ceil((task.planned_end.getTime() - viewState.startDate.getTime()) / (24 * 60 * 60 * 1000)))
    const taskWidth = Math.max(1, taskEnd - taskStart)
    const taskLeft = taskStart * dayWidthPx

    result.push(
      <tr key={task.id} className={`gantt-row ${task.is_critical ? 'critical' : ''} ${task.is_milestone ? 'milestone' : ''}`}>
        <td className="gantt-task-cell">
          <div style={{ paddingLeft: `${depth * 16}px`, display: 'flex', alignItems: 'center', gap: '4px' }}>
            {hasChildren && (
              <button
                onClick={() => onToggleExpanded(task.id)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            {!hasChildren && <div style={{ width: '14px' }} />}
            <span style={{ fontSize: '12px', fontWeight: hasChildren ? '600' : '400' }}>
              {task.title}
            </span>
          </div>
        </td>
        <td className="gantt-progress-cell">
          <div style={{ fontSize: '11px', fontWeight: '600' }}>{task.progress}%</div>
        </td>
        <td className="gantt-timeline-cell">
          <div className="gantt-timeline-container">
            {/* Left resize handle */}
            <div
              onMouseDown={(e) => handleBarMouseDown(task.id, e, 'resize-start')}
              style={{
                position: 'absolute',
                left: `${taskLeft - 4}px`,
                top: '4px',
                width: '8px',
                height: '20px',
                cursor: 'ew-resize',
                background: 'rgba(0,0,0,0.1)',
              }}
              title="Redimensionner le début"
            />

            {/* Main bar (draggable) */}
            <div
              onMouseDown={(e) => handleBarMouseDown(task.id, e, 'move')}
              className="gantt-bar"
              style={{
                left: `${taskLeft}px`,
                width: `${taskWidth * dayWidthPx}px`,
                backgroundColor: getStatusColor(task.status, task.is_critical),
                opacity: task.is_milestone ? 0.3 : 1,
                cursor: dragState.isDragging && dragState.taskId === task.id ? 'grabbing' : 'grab',
              }}
              title={`${task.title} • ${task.progress}%`}
            />

            {/* Right resize handle */}
            <div
              onMouseDown={(e) => handleBarMouseDown(task.id, e, 'resize-end')}
              style={{
                position: 'absolute',
                left: `${taskLeft + taskWidth * dayWidthPx - 4}px`,
                top: '4px',
                width: '8px',
                height: '20px',
                cursor: 'ew-resize',
                background: 'rgba(0,0,0,0.1)',
              }}
              title="Redimensionner la fin"
            />
          </div>
        </td>
      </tr>,
    )

    if (hasChildren && isExpanded) {
      for (const child of task.children!) {
        result.push(...renderTaskRow(child, depth + 1))
      }
    }

    return result
  }

  return (
    <div className="gantt-table-wrapper" ref={tableRef}>
      <table className="gantt-tbl" style={{ userSelect: dragState.isDragging ? 'none' : 'auto' }}>
        <thead>
          <tr>
            <th className="gantt-task-header">Tâche</th>
            <th className="gantt-progress-header">%</th>
            <th className="gantt-timeline-header" style={{ width: `${daysInRange * dayWidthPx}px` }}>
              Timeline • {formatDateRange()}
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => renderTaskRow(task))}
        </tbody>
      </table>
    </div>
  )
}
