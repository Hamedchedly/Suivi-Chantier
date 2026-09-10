import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { GanttTask, GanttViewState } from '../../types/gantt'

interface GanttTableProps {
  tasks: GanttTask[]
  viewState: GanttViewState
  onToggleExpanded: (taskId: string) => void
  onTaskUpdate?: (taskId: string, updates: { planned_start?: Date; planned_end?: Date }) => void
  readOnly?: boolean
}

interface DragState {
  taskId?: string
  startX?: number
  originalStart?: Date
  originalEnd?: Date
  isDragging?: boolean
  mode?: 'move' | 'resize-start' | 'resize-end'
}

interface DepLine {
  x1: number; y1: number; x2: number; y2: number; critical: boolean
}

const MONTH_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

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

  // Weeks numbered relative to the project start: the start week is S0.
  // startDate is anchored to a Monday, so segments are clean 7-day weeks.
  day = 0
  let weekIndex = 0
  while (day < daysInRange) {
    const date = new Date(startDate.getTime() + day * msPerDay)
    const dow = date.getDay() || 7
    const span = Math.min(8 - dow, daysInRange - day)
    weeks.push({ label: `S${weekIndex}`, leftPx: day * dayWidthPx, widthPx: span * dayWidthPx })
    day += span
    weekIndex++
  }

  return { months, weeks }
}

// Accumulate offsetLeft/offsetTop up the offsetParent chain until `ancestor`.
// Needed because .gantt-timeline-cell is position:relative and becomes the
// container's offsetParent, so a single offsetLeft is only relative to the <td>.
function offsetWithin(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0, y = 0
  let node: HTMLElement | null = el
  while (node && node !== ancestor) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { x, y }
}

// Flatten the tree into the visible row order, respecting expansion state.
function flattenVisible(
  tasks: GanttTask[],
  expanded: Set<string>,
  depth = 0,
  acc: { task: GanttTask; depth: number }[] = [],
) {
  for (const t of tasks) {
    acc.push({ task: t, depth })
    if (t.children?.length && expanded.has(t.id)) {
      flattenVisible(t.children, expanded, depth + 1, acc)
    }
  }
  return acc
}

export default function GanttTable({ tasks, viewState, onToggleExpanded, onTaskUpdate, readOnly }: GanttTableProps) {
  const editable = !readOnly
  const [dragState, setDragState] = useState<DragState>({})
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [depLines, setDepLines] = useState<DepLine[]>([])
  const [svgSize, setSvgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  const dayWidthPx = (viewState.view === 'week' ? 24 : 12) * (viewState.zoom ?? 1)
  const msPerDay = 86400000
  const daysInRange = Math.ceil(
    (viewState.endDate.getTime() - viewState.startDate.getTime()) / msPerDay,
  )

  const { months, weeks } = buildHeaders(viewState.startDate, daysInRange, dayWidthPx)

  const todayOffset = Math.floor((Date.now() - viewState.startDate.getTime()) / msPerDay)
  const todayVisible = todayOffset >= 0 && todayOffset < daysInRange
  const todayLeftPx = todayOffset * dayWidthPx

  // Current-week band (startDate is Monday-anchored → weeks align on 7-day steps)
  const curWeekStartDay = Math.floor(todayOffset / 7) * 7
  const curWeekVisible = todayOffset >= 0 && curWeekStartDay < daysInRange
  const curWeekLeftPx = Math.max(0, curWeekStartDay) * dayWidthPx
  const curWeekWidthPx = (Math.min(daysInRange, curWeekStartDay + 7) - Math.max(0, curWeekStartDay)) * dayWidthPx

  // Holiday / non-working bands (hatched grey columns)
  const holidayBands = (viewState.holidays ?? [])
    .map(h => {
      const s = Math.max(0, Math.floor((h.start.getTime() - viewState.startDate.getTime()) / msPerDay))
      const e = Math.min(daysInRange, Math.ceil((h.end.getTime() - viewState.startDate.getTime()) / msPerDay))
      return { leftPx: s * dayWidthPx, widthPx: (e - s) * dayWidthPx, label: h.label }
    })
    .filter(b => b.widthPx > 0)

  const visible = flattenVisible(tasks, viewState.expandedTasks)

  // Geometry of a bar for given start/end dates, clamped to the visible range.
  const geom = (start: Date, end: Date) => {
    const s = Math.max(0, Math.floor((start.getTime() - viewState.startDate.getTime()) / msPerDay))
    const e = Math.min(daysInRange, Math.ceil((end.getTime() - viewState.startDate.getTime()) / msPerDay))
    const leftPx = s * dayWidthPx
    const widthPx = Math.max(1, e - s) * dayWidthPx
    return { leftPx, widthPx }
  }

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

  const handleMouseMove = useCallback(() => {}, [])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    setDragState(prev => {
      if (
        prev.isDragging && prev.taskId && prev.startX !== undefined &&
        prev.originalStart && prev.originalEnd && onTaskUpdate
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
            onTaskUpdate(prev.taskId, { planned_start: new Date(prev.originalStart.getTime() + msShift) })
          } else if (prev.mode === 'resize-end') {
            onTaskUpdate(prev.taskId, { planned_end: new Date(prev.originalEnd.getTime() + msShift) })
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

  // Measure bar positions from the DOM and derive dependency lines.
  // Robust to responsive column widths and variable row heights.
  useLayoutEffect(() => {
    if (!viewState.depsVisible) {
      setDepLines([])
      return
    }
    const anchor = wrapperRef.current
    if (!anchor) return
    setSvgSize({ w: anchor.scrollWidth, h: anchor.scrollHeight })
    const pos = new Map<string, { x1: number; x2: number; y: number }>()
    for (const { task } of visible) {
      const el = containerRefs.current.get(task.id)
      if (!el) continue
      const { leftPx, widthPx } = geom(task.planned_start, task.planned_end)
      const { x: baseX, y: baseY } = offsetWithin(el, anchor)
      pos.set(task.id, {
        x1: baseX + leftPx,
        x2: baseX + leftPx + widthPx,
        y: baseY + el.offsetHeight / 2,
      })
    }
    const lines: DepLine[] = []
    for (const { task } of visible) {
      for (const depId of task.dependencies) {
        const from = pos.get(depId) // predecessor
        const to = pos.get(task.id) // successor
        if (from && to) {
          lines.push({ x1: from.x2, y1: from.y, x2: to.x1, y2: to.y, critical: task.is_critical })
        }
      }
    }
    setDepLines(lines)
    // geom/visible are recomputed each render on purpose; re-run only on these inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, viewState.expandedTasks, viewState.depsVisible, viewState.view, viewState.startDate, viewState.endDate])

  const getStatusColor = (status: GanttTask['status']) => {
    if (status === 'completed')  return '#15803d'
    if (status === 'in-progress') return '#018ABE'
    if (status === 'delayed' || status === 'blocked') return '#dc2626'
    if (status === 'not-started') return '#94a3b8'
    return '#6b21a8'
  }

  const renderRow = (task: GanttTask, depth: number) => {
    const hasChildren = !!task.children?.length
    const isExpanded = viewState.expandedTasks.has(task.id)
    const dimmed = !!viewState.highlightCritical && !task.is_critical

    const bar = geom(task.planned_start, task.planned_end)
    const base = task.baseline_start && task.baseline_end
      ? geom(task.baseline_start, task.baseline_end)
      : null

    const tooltip = base
      ? `${task.title} • ${task.progress}%\nContractuel: ${task.baseline_start!.toLocaleDateString('fr')} → ${task.baseline_end!.toLocaleDateString('fr')}\nPlanifié: ${task.planned_start.toLocaleDateString('fr')} → ${task.planned_end.toLocaleDateString('fr')}`
      : `${task.title} • ${task.progress}%`

    return (
      <tr key={task.id} className={`gantt-row${task.is_critical ? ' critical' : ''}${task.is_milestone ? ' milestone' : ''}`}>
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
            <span style={{ fontSize: 12, fontWeight: hasChildren ? 600 : 400, color: task.is_critical ? '#dc2626' : undefined }}>
              {task.title}
            </span>
          </div>
        </td>

        <td className="gantt-progress-cell">{task.progress}%</td>

        <td className="gantt-timeline-cell">
          <div
            className="gantt-timeline-container"
            style={{ width: daysInRange * dayWidthPx }}
            ref={el => {
              if (el) containerRefs.current.set(task.id, el)
              else containerRefs.current.delete(task.id)
            }}
          >
            {/* Holiday / non-working bands */}
            {holidayBands.map((b, i) => (
              <div key={`h${i}`} title={b.label} style={{ position: 'absolute', left: b.leftPx, top: 0, width: b.widthPx, height: '100%', zIndex: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(45deg, rgba(91,113,131,.12) 0 6px, rgba(91,113,131,.04) 6px 12px)' }} />
            ))}
            {/* Current-week highlight band */}
            {curWeekVisible && (
              <div style={{ position: 'absolute', left: curWeekLeftPx, top: 0, width: curWeekWidthPx, height: '100%', background: 'rgba(1,138,190,.10)', borderLeft: '1px solid rgba(1,138,190,.35)', borderRight: '1px solid rgba(1,138,190,.35)', zIndex: 0, pointerEvents: 'none' }} />
            )}
            {/* Today marker */}
            {todayVisible && (
              <div style={{ position: 'absolute', left: todayLeftPx, top: 0, width: 2, height: '100%', background: 'rgba(220,38,38,.5)', zIndex: 1, pointerEvents: 'none' }} />
            )}

            {task.is_milestone ? (
              /* Milestone diamond */
              <div
                onMouseDown={editable ? e => handleBarMouseDown(task, e, 'move') : undefined}
                title={tooltip}
                style={{
                  position: 'absolute', left: bar.leftPx - 7, top: 7, width: 14, height: 14,
                  background: task.progress >= 100 ? '#15803d' : '#02457A',
                  transform: 'rotate(45deg)', borderRadius: 2, zIndex: 3,
                  border: '1.5px solid #fff', boxShadow: '0 1px 2px rgba(0,0,0,.25)',
                  cursor: editable ? 'grab' : 'default', opacity: dimmed ? 0.3 : 1,
                }}
              />
            ) : (
              <div style={{ opacity: dimmed ? 0.28 : 1 }}>
                {/* Baseline (contractual) hatched bar */}
                {base && <div className="gantt-baseline" style={{ left: base.leftPx, width: base.widthPx }} />}

                {/* Left resize handle */}
                {editable && (
                  <div
                    onMouseDown={e => handleBarMouseDown(task, e, 'resize-start')}
                    style={{ position: 'absolute', left: bar.leftPx - 4, top: 8, width: 8, height: 16, cursor: 'ew-resize', zIndex: 4 }}
                  />
                )}

                {/* Actual/planned bar */}
                <div
                  className="gantt-bar"
                  onMouseDown={editable ? e => handleBarMouseDown(task, e, 'move') : undefined}
                  style={{
                    left: bar.leftPx,
                    width: bar.widthPx,
                    backgroundColor: getStatusColor(task.status),
                    boxShadow: task.is_critical && viewState.highlightCritical ? '0 0 0 1.5px #dc2626' : undefined,
                    cursor: !editable ? 'default' : dragState.isDragging && dragState.taskId === task.id ? 'grabbing' : 'grab',
                  }}
                  title={tooltip}
                >
                  {task.progress < 100 && (
                    <div style={{ position: 'absolute', top: 0, left: `${task.progress}%`, right: 0, bottom: 0, background: 'rgba(255,255,255,.45)', borderRadius: '0 2px 2px 0', pointerEvents: 'none' }} />
                  )}
                  {bar.widthPx > 30 && (
                    <span style={{ position: 'relative', fontSize: 9, fontWeight: 600, color: '#fff', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', display: 'block', lineHeight: '14px' }}>
                      {task.progress}%
                    </span>
                  )}
                </div>

                {/* Right resize handle */}
                {editable && (
                  <div
                    onMouseDown={e => handleBarMouseDown(task, e, 'resize-end')}
                    style={{ position: 'absolute', left: bar.leftPx + bar.widthPx - 4, top: 8, width: 8, height: 16, cursor: 'ew-resize', zIndex: 4 }}
                  />
                )}
              </div>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="gantt-table-wrapper" ref={wrapperRef}>
        <table className="gantt-tbl" style={{ userSelect: dragState.isDragging ? 'none' : 'auto' }}>
          <thead>
            <tr>
              <th className="gantt-task-header">Tâche</th>
              <th className="gantt-progress-header">%</th>
              <th className="gantt-timeline-header" style={{ padding: 0, width: daysInRange * dayWidthPx }}>
                {/* Month row */}
                <div style={{ position: 'relative', height: 22 }}>
                  {months.map((m, i) => (
                    <div key={i} style={{ position: 'absolute', left: m.leftPx, width: m.widthPx, fontSize: 10, fontWeight: 700, color: '#02457A', padding: '4px 6px', overflow: 'hidden', whiteSpace: 'nowrap', borderRight: '1px solid #e4ecf2', boxSizing: 'border-box', height: '100%' }}>
                      {m.label}
                    </div>
                  ))}
                </div>
                {/* Week row */}
                <div style={{ position: 'relative', height: 20, borderTop: '1px solid #e4ecf2' }}>
                  {weeks.map((w, i) => (
                    <div key={i} style={{ position: 'absolute', left: w.leftPx, width: w.widthPx, fontSize: 9, color: '#5b7183', padding: '3px 3px', overflow: 'hidden', whiteSpace: 'nowrap', borderRight: '1px solid #e4ecf2', boxSizing: 'border-box', height: '100%' }}>
                      {w.label}
                    </div>
                  ))}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ task, depth }) => renderRow(task, depth))}
          </tbody>
        </table>

        {/* Dependency lines overlay (absolute child of the scroll container → scrolls with content) */}
        {viewState.depsVisible && depLines.length > 0 && (
          <svg
            className="gantt-deps"
            width={svgSize.w}
            height={svgSize.h}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
          >
            <defs>
              <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
              </marker>
              <marker id="dep-arrow-crit" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#dc2626" />
              </marker>
            </defs>
            {depLines.map((l, i) => {
              const elbow = l.x1 + 10
              const d = `M ${l.x1} ${l.y1} L ${elbow} ${l.y1} L ${elbow} ${l.y2} L ${l.x2} ${l.y2}`
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={l.critical ? '#dc2626' : '#94a3b8'}
                  strokeWidth={1.3}
                  strokeDasharray={l.critical ? undefined : '3 2'}
                  markerEnd={`url(#${l.critical ? 'dep-arrow-crit' : 'dep-arrow'})`}
                />
              )
            })}
          </svg>
        )}
    </div>
  )
}
