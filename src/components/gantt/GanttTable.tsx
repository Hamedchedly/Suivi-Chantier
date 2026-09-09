import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
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
  originalStart?: Date
  originalEnd?: Date
  isDragging?: boolean
  mode?: 'move' | 'resize-start' | 'resize-end'
}

const MONTH_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function buildHeaders(startDate: Date, daysInRange: number, dayWidthPx: number) {
  const msPerDay = 86400000
  const months: { label: string; leftPx: number; widthPx: number }[] = []
  const weeks: { label: string; leftPx: number; widthPx: number }[] = []

  let day = 0
  while (day < daysInRange) {
    const date = new Date(startDate.getTime() + day * msPerDay)
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1)
    const span = Math.min(
      Math.ceil((endOfMonth.getTime() - date.getTime()) / msPerDay),
      daysInRange - day,
    )
    months.push({
      label: `${MONTH_FR[date.getMonth()]} ${date.getFullYear()}`,
      leftPx: day * dayWidthPx,
      widthPx: span * dayWidthPx,
    })
    day += span
  }

  day = 0
  while (day < daysInRange) {
    const date = new Date(startDate.getTime() + day * msPerDay)
    const dow = date.getDay() || 7
    const daysUntilMonday = 8 - dow
    const span = Math.min(daysUntilMonday, daysInRange - day)
    weeks.push({
      label: `S${isoWeek(date)}`,
      leftPx: day * dayWidthPx,
      widthPx: span * dayWidthPx,
    })
    day += span
  }

  return { months, weeks }
}

export default function GanttTable({ tasks, viewState, onToggleExpanded, onTaskUpdate }: GanttTableProps) {
  const [dragState, setDragState] = useState<DragState>({})
  const tableRef = useRef<HTMLDivElement>(null)

  const dayWidthPx = viewState.view === 'week' ? 24 : 12
  const msPerDay = 86400000
  const daysInRange = Math.ceil(
    (viewState.endDate.getTime() - viewState.startDate.getTime()) / msPerDay,
  )

  const { months, weeks } = buildHeaders(viewState.startDate, daysInRange, dayWidthPx)

  const todayOffset = Math.floor((Date.now() - viewState.startDate.getTime()) / msPerDay)
  const todayVisible = todayOffset >= 0 && todayOffset < daysInRange
  const todayLeftPx = todayOffset * dayWidthPx

  const handleBarMouseDown = (task: GanttTask, e: React.MouseEvent, mode: DragState['mode']) => {
    e.preventDefault()
    setDragState({
      taskId: task.id,
      startX: e.clientX,
      originalStart: new Date(task.planned_start),
      originalEnd: new Date(task.planned_end),
      isDragging: true,
      mode,
    })
  }

  const handleMouseMove = useCallback((_e: MouseEvent) => {
    // Visual feedback could be added here
  }, [])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    setDragState(prev => {
      if (
        prev.isDragging &&
        prev.taskId &&
        prev.startX !== undefined &&
        prev.originalStart &&
        prev.originalEnd &&
        onTaskUpdate
      ) {
        const daysShift = Math.round((e.clientX - prev.startX) / dayWidthPx)
        if (daysShift !== 0) {
          const msShift = daysShift * msPerDay
          if (prev.mode === 'move') {
            onTaskUpdate(prev.taskId, {
              planned_start: new Date(prev.originalStart.getTime() + msShift),
              planned_end: new Date(prev.originalEnd.getTime() + msShift),
            })
          } else if (prev.mode === 'resize-start') {
            onTaskUpdate(prev.taskId, {
              planned_start: new Date(prev.originalStart.getTime() + msShift),
            })
          } else if (prev.mode === 'resize-end') {
            onTaskUpdate(prev.taskId, {
              planned_end: new Date(prev.originalEnd.getTime() + msShift),
            })
          }
        }
      }
      return {}
    })
  }, [dayWidthPx, msPerDay, onTaskUpdate])

  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp])

  const getStatusColor = (status: GanttTask['status']) => {
    if (status === 'completed')  return '#15803d'
    if (status === 'in-progress') return '#185fa5'
    if (status === 'delayed' || status === 'blocked') return '#b91c1c'
    if (status === 'not-started') return '#94a3b8'
    return '#6b21a8'
  }

  const renderTaskRow = (task: GanttTask, depth = 0): JSX.Element[] => {
    const hasChildren = !!task.children?.length
    const isExpanded = viewState.expandedTasks.has(task.id)

    const taskStart = Math.max(
      0,
      Math.floor((task.planned_start.getTime() - viewState.startDate.getTime()) / msPerDay),
    )
    const taskEnd = Math.min(
      daysInRange,
      Math.ceil((task.planned_end.getTime() - viewState.startDate.getTime()) / msPerDay),
    )
    const taskWidth = Math.max(1, taskEnd - taskStart)
    const taskLeftPx = taskStart * dayWidthPx

    const rows: JSX.Element[] = [
      <tr key={task.id} className={`gantt-row${task.is_critical ? ' critical' : ''}${task.is_milestone ? ' milestone' : ''}`}>
        {/* Task name column */}
        <td className="gantt-task-cell">
          <div style={{ paddingLeft: `${depth * 14}px`, display: 'flex', alignItems: 'center', gap: 4 }}>
            {hasChildren ? (
              <button
                onClick={() => onToggleExpanded(task.id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--navy)' }}
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <div style={{ width: 14 }} />
            )}
            <span style={{ fontSize: 12, fontWeight: hasChildren ? 600 : 400, color: task.is_critical ? '#b91c1c' : undefined }}>
              {task.title}
            </span>
          </div>
        </td>

        {/* Progress column */}
        <td className="gantt-progress-cell">{task.progress}%</td>

        {/* Timeline column */}
        <td className="gantt-timeline-cell">
          <div className="gantt-timeline-container" style={{ width: daysInRange * dayWidthPx }}>
            {/* Today marker */}
            {todayVisible && (
              <div
                style={{ position: 'absolute', left: todayLeftPx, top: 0, width: 2, height: '100%', background: 'rgba(185,28,28,.35)', zIndex: 1, pointerEvents: 'none' }}
              />
            )}
            {/* Left resize handle */}
            <div
              onMouseDown={e => handleBarMouseDown(task, e, 'resize-start')}
              style={{ position: 'absolute', left: taskLeftPx - 4, top: 3, width: 8, height: 22, cursor: 'ew-resize', zIndex: 3 }}
            />
            {/* Bar */}
            <div
              className="gantt-bar"
              onMouseDown={e => handleBarMouseDown(task, e, 'move')}
              style={{
                left: taskLeftPx,
                width: taskWidth * dayWidthPx,
                backgroundColor: getStatusColor(task.status),
                opacity: task.is_milestone ? 0.85 : 1,
                cursor: dragState.isDragging && dragState.taskId === task.id ? 'grabbing' : 'grab',
              }}
              title={`${task.title} • ${task.progress}% • ${task.planned_start.toLocaleDateString('fr')} → ${task.planned_end.toLocaleDateString('fr')}`}
            >
              {/* Remaining (uncompleted) portion shown lighter; completed stays solid */}
              {task.progress < 100 && (
                <div style={{ position: 'absolute', top: 0, left: `${task.progress}%`, right: 0, bottom: 0, background: 'rgba(255,255,255,.45)', borderRadius: '0 2px 2px 0', pointerEvents: 'none' }} />
              )}
              {taskWidth * dayWidthPx > 30 && (
                <span style={{ position: 'relative', fontSize: 9, fontWeight: 600, color: '#fff', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', display: 'block', lineHeight: '20px' }}>
                  {task.progress}%
                </span>
              )}
            </div>
            {/* Right resize handle */}
            <div
              onMouseDown={e => handleBarMouseDown(task, e, 'resize-end')}
              style={{ position: 'absolute', left: taskLeftPx + taskWidth * dayWidthPx - 4, top: 3, width: 8, height: 22, cursor: 'ew-resize', zIndex: 3 }}
            />
          </div>
        </td>
      </tr>,
    ]

    if (hasChildren && isExpanded) {
      for (const child of task.children!) {
        rows.push(...renderTaskRow(child, depth + 1))
      }
    }

    return rows
  }

  return (
    <div className="gantt-table-wrapper" ref={tableRef}>
      <table className="gantt-tbl" style={{ userSelect: dragState.isDragging ? 'none' : 'auto' }}>
        <thead>
          {/* Month row */}
          <tr>
            <th className="gantt-task-header" rowSpan={2}>Tâche</th>
            <th className="gantt-progress-header" rowSpan={2}>%</th>
            <th className="gantt-date-header" style={{ position: 'relative', height: 22, padding: 0, minWidth: daysInRange * dayWidthPx }}>
              <div style={{ position: 'relative', height: 22 }}>
                {months.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute', left: m.leftPx, width: m.widthPx,
                      fontSize: 10, fontWeight: 700, color: '#0b3b60',
                      padding: '4px 6px', overflow: 'hidden', whiteSpace: 'nowrap',
                      borderRight: '1px solid #e3e9ee', boxSizing: 'border-box', height: '100%',
                    }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </th>
          </tr>
          {/* Week row */}
          <tr>
            <th className="gantt-date-header" style={{ position: 'relative', height: 20, padding: 0, borderTop: '1px solid #e3e9ee' }}>
              <div style={{ position: 'relative', height: 20 }}>
                {weeks.map((w, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute', left: w.leftPx, width: w.widthPx,
                      fontSize: 9, color: '#5c6f80',
                      padding: '3px 3px', overflow: 'hidden', whiteSpace: 'nowrap',
                      borderRight: '1px solid #e3e9ee', boxSizing: 'border-box', height: '100%',
                    }}
                  >
                    {w.label}
                  </div>
                ))}
              </div>
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
