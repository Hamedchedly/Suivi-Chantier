import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { GanttTask, GanttViewState } from '../../types/gantt'
import { DateCommitment } from '../../lib/commitments'

interface GanttTableProps {
  tasks: GanttTask[]
  viewState: GanttViewState
  onToggleExpanded: (taskId: string) => void
  onTaskUpdate?: (taskId: string, updates: { planned_start?: Date; planned_end?: Date; actual_start?: Date; actual_end?: Date }) => void
  onProgress?: (taskId: string, value: number) => void
  onTaskClick?: (task: GanttTask) => void
  onCommitmentClick?: (commitment: DateCommitment) => void
  onCreateSubtask?: (parentId: string, title: string, duration: number) => void
  readOnly?: boolean
  showForecast?: boolean
  showBaseline?: boolean
  showEcarts?: boolean
  commitments?: DateCommitment[]
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

  // Weeks: ISO week numbers (S36, S37…).
  day = 0
  while (day < daysInRange) {
    const date = new Date(startDate.getTime() + day * msPerDay)
    const dow = date.getDay() || 7
    const span = Math.min(8 - dow, daysInRange - day)
    weeks.push({ label: `S${isoWeek(date)}`, leftPx: day * dayWidthPx, widthPx: span * dayWidthPx })
    day += span
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

/** ISO week number (1–53) for a given date. */
function isoWeek(d: Date): number {
  const target = new Date(d.getTime())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const jan4 = new Date(target.getFullYear(), 0, 4)
  return 1 + Math.round((target.getTime() - jan4.getTime()) / 604800000)
}

const fmt2 = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

// Calcul des écarts (delta) pour affichage mode détail
function calculateEcarts(task: GanttTask) {
  const dayMs = 86400000
  const ecarts = { deltaStart: 0, deltaEnd: 0, dayLabel: '', color: '#10b981' } // green by default

  // Δ start : actual vs planned
  if (task.actual_start && task.planned_start) {
    ecarts.deltaStart = Math.ceil((task.actual_start.getTime() - task.planned_start.getTime()) / dayMs)
  }

  // Δ end : forecast vs baseline (or planned if no baseline)
  if (task.forecast_end && task.baseline_end) {
    ecarts.deltaEnd = Math.ceil((task.forecast_end.getTime() - task.baseline_end.getTime()) / dayMs)
  } else if (task.forecast_end && task.planned_end) {
    ecarts.deltaEnd = Math.ceil((task.forecast_end.getTime() - task.planned_end.getTime()) / dayMs)
  }

  // Color based on worst écart
  const maxEcart = Math.max(ecarts.deltaStart, ecarts.deltaEnd)
  if (maxEcart <= 0) {
    ecarts.color = '#10b981' // green
  } else if (maxEcart <= 5) {
    ecarts.color = '#f59e0b' // orange
  } else {
    ecarts.color = '#ef4444' // red
  }

  // Label for display
  if (ecarts.deltaEnd > 0) {
    ecarts.dayLabel = `+${ecarts.deltaEnd}j`
  } else if (ecarts.deltaEnd < 0) {
    ecarts.dayLabel = `${ecarts.deltaEnd}j`
  }

  return ecarts
}

export default function GanttTable({ tasks, viewState, onToggleExpanded, onTaskUpdate, onProgress, onTaskClick, onCommitmentClick, onCreateSubtask, readOnly, showForecast, showBaseline, showEcarts, commitments }: GanttTableProps) {
  const editable = !readOnly
  const [dragState, setDragState] = useState<DragState>({})
  const [editingProgress, setEditingProgress] = useState<string | null>(null)
  const [editingActualStart, setEditingActualStart] = useState<string | null>(null)
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const didAutoScroll = useRef(false)
  const [depLines, setDepLines] = useState<DepLine[]>([])
  const [svgSize, setSvgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  // Vue « semaine » compacte par défaut : une colonne semaine (7 j) fait environ
  // la hauteur d'une ligne (~28 px) à zoom 1 ; le zoom permet d'étaler pour lire
  // le détail. 4 px/jour → 28 px/semaine.
  const dayWidthPx = (viewState.view === 'week' ? 4 : 12) * (viewState.zoom ?? 1)
  const msPerDay = 86400000
  const daysInRange = Math.ceil(
    (viewState.endDate.getTime() - viewState.startDate.getTime()) / msPerDay,
  )

  const { months, weeks } = buildHeaders(viewState.startDate, daysInRange, dayWidthPx)

  const todayOffset = Math.floor((Date.now() - viewState.startDate.getTime()) / msPerDay)
  const todayLeftPx = todayOffset * dayWidthPx

  // Current-week band (startDate is Monday-anchored → weeks align on 7-day steps)
  const curWeekStartDay = Math.floor(todayOffset / 7) * 7
  const curWeekVisible = todayOffset >= 0 && curWeekStartDay < daysInRange
  const curWeekLeftPx = Math.max(0, curWeekStartDay) * dayWidthPx
  const curWeekWidthPx = (Math.min(daysInRange, curWeekStartDay + 7) - Math.max(0, curWeekStartDay)) * dayWidthPx

  // The chantier is read week by week: one column per week, no weekend banding.
  // Days still drive the geometry so bars keep landing on the right date.
  const weekPx = 7 * dayWidthPx
  const gridBackground =
    `repeating-linear-gradient(to right, #e9eff4 0, #e9eff4 1px, transparent 1px, transparent ${weekPx}px)`

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

  // ── Zone segmentation: split bar into contractual | planning | overdue ──
  interface BarZone {
    type: 'contractual' | 'planning' | 'overdue'
    widthPercent: number
    progressPercent: number // 0-100 fill within this segment
    isVisible: boolean
  }

  const calculateZones = (task: GanttTask, barStart: Date, barEnd: Date): BarZone[] => {
    const planEnd = task.planned_end
    const totalMs = Math.max(1, barEnd.getTime() - barStart.getTime())
    const p = Math.max(0, Math.min(100, task.progress))

    const hasOverrun = barEnd.getTime() > planEnd.getTime()

    if (hasOverrun) {
      // Bar extends past planned end: planning zone + red overrun zone
      const planMs = Math.max(0, planEnd.getTime() - barStart.getTime())
      const planPct = (planMs / totalMs) * 100
      const overduePct = 100 - planPct
      // Progress distribution: contract zone first, then planning, then overdue
      const contractualFilled = Math.min(planPct, p)
      const planningFilled = Math.max(0, Math.min(p - contractualFilled, (planEnd.getTime() - barStart.getTime()) / totalMs * 100 - contractualFilled))
      const overdueProgress = p >= 100 ? 100 : 0
      return [
        { type: 'planning', widthPercent: planPct, progressPercent: (contractualFilled / planPct) * 100, isVisible: planPct > 0.5 },
        { type: 'overdue', widthPercent: overduePct, progressPercent: overdueProgress, isVisible: overduePct > 0.5 },
      ]
    }

    // No overrun — check if there's a distinct baseline ending before planned_end
    const baselineEnd = task.baseline_end
    const hasDistinctBaseline = !!baselineEnd && baselineEnd.getTime() < planEnd.getTime() - 86400000

    if (hasDistinctBaseline && baselineEnd) {
      // Contractual (grey) up to baseline_end, then planning extension (blue)
      const contractualMs = Math.max(0, baselineEnd.getTime() - barStart.getTime())
      const contractualPct = (contractualMs / totalMs) * 100
      const planningPct = 100 - contractualPct
      // Progress: if task is p% complete, first p% fills contractual zone, overflow goes to planning
      const contractualProgress = Math.min(100, (p / contractualPct) * 100)
      const planningProgress = p > contractualPct ? Math.min(100, ((p - contractualPct) / planningPct) * 100) : 0
      return [
        { type: 'contractual', widthPercent: contractualPct, progressPercent: contractualProgress, isVisible: contractualPct > 0.5 },
        ...(planningPct > 0.5 ? [{ type: 'planning' as const, widthPercent: planningPct, progressPercent: planningProgress, isVisible: true }] : []),
      ]
    }

    // Default: single blue planning bar with gradient progress
    return [{ type: 'planning', widthPercent: 100, progressPercent: p, isVisible: true }]
  }

  // Returns CSS background (gradient) showing the filled portion within a segment
  const getSegmentBackground = (zoneType: 'contractual' | 'planning' | 'overdue', progressPercent: number): string => {
    if (zoneType === 'overdue') return '#dc2626'
    const p = Math.max(0, Math.min(100, progressPercent))
    if (zoneType === 'contractual') {
      const done = '#64748b'; const todo = '#e2e8f0'
      if (p >= 100) return done
      if (p <= 0) return todo
      return `linear-gradient(to right, ${done} ${p}%, ${todo} ${p}%)`
    }
    // planning
    const done = '#2563eb'; const todo = '#bfdbfe'
    if (p >= 100) return done
    if (p <= 0) return todo
    return `linear-gradient(to right, ${done} ${p}%, ${todo} ${p}%)`
  }

  const handleBarMouseDown = (task: GanttTask, e: React.MouseEvent, mode: DragState['mode']) => {
    e.preventDefault()
    // Drag always moves actual dates; fall back to planned if no actual yet.
    setDragState({
      taskId: task.id,
      startX: e.clientX,
      originalStart: new Date(task.actual_start ?? task.planned_start),
      originalEnd: new Date(task.actual_end ?? task.planned_end),
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
              actual_start: new Date(prev.originalStart.getTime() + msShift),
              actual_end: new Date(prev.originalEnd.getTime() + msShift),
            })
          } else if (prev.mode === 'resize-start') {
            onTaskUpdate(prev.taskId, { actual_start: new Date(prev.originalStart.getTime() + msShift) })
          } else if (prev.mode === 'resize-end') {
            onTaskUpdate(prev.taskId, { actual_end: new Date(prev.originalEnd.getTime() + msShift) })
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

  // Scroll to current week once after first render where today is in range
  useEffect(() => {
    if (didAutoScroll.current || todayLeftPx <= 0) return
    const wrapper = wrapperRef.current
    if (!wrapper) return
    wrapper.scrollLeft = Math.max(0, todayLeftPx - 80)
    didAutoScroll.current = true
  }, [todayLeftPx])

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

  const renderSubtaskForm = (parentId: string) => {
    return (
      <tr style={{ background: '#f9fbfd' }}>
        <td style={{ padding: '6px 10px', paddingLeft: `${28 + 14}px` }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', maxWidth: '300px' }}>
            <input
              autoFocus
              type="text"
              placeholder="Titre…"
              value={subtaskTitle}
              onChange={e => setSubtaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && subtaskTitle.trim()) {
                  onCreateSubtask?.(parentId, subtaskTitle.trim(), 5)
                  setSubtaskTitle('')
                  setEditingSubtask(null)
                } else if (e.key === 'Escape') {
                  setSubtaskTitle('')
                  setEditingSubtask(null)
                }
              }}
              style={{ flex: 1, padding: '4px 6px', borderRadius: '4px', border: '1px solid #d1dbe5', fontSize: '11px' }}
            />
            <button
              onClick={() => {
                if (subtaskTitle.trim()) {
                  onCreateSubtask?.(parentId, subtaskTitle.trim(), 5)
                  setSubtaskTitle('')
                  setEditingSubtask(null)
                }
              }}
              style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #018ABE', background: '#018ABE', color: '#fff', fontSize: '10px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >✓</button>
            <button
              onClick={() => { setSubtaskTitle(''); setEditingSubtask(null) }}
              style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #ddd', background: '#fff', color: '#666', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >✕</button>
          </div>
        </td>
        <td colSpan={2} />
      </tr>
    )
  }

  const renderRow = (task: GanttTask, depth: number) => {
    const hasChildren = !!task.children?.length
    const isExpanded = viewState.expandedTasks.has(task.id)
    const dimmed = !!viewState.highlightCritical && !task.is_critical
    const isLate = task.actual_end && task.actual_end.getTime() > task.planned_end.getTime()

    // Barre principale = dates réelles si elles existent, sinon dates contractuelles.
    // Référence fine (dessous) = dates contractuelles quand les réelles sont posées.
    const mainStart = task.actual_start ?? task.planned_start
    const mainEnd = task.actual_end ?? task.planned_end
    const bar = geom(mainStart, mainEnd)
    const base = task.actual_start ? geom(task.planned_start, task.planned_end) : null

    const fr = (d: Date) => d.toLocaleDateString('fr')
    const tooltip = task.actual_start
      ? `${task.title} • ${task.progress}%\nRéel : ${fr(mainStart)} → ${task.actual_end ? fr(mainEnd) : 'en cours'}\nContractuel : ${fr(task.planned_start)} → ${fr(task.planned_end)}`
      : `${task.title} • ${task.progress}%\nContractuel (prévisionnel) : ${fr(task.planned_start)} → ${fr(task.planned_end)}`

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
            <span
              onClick={() => hasChildren ? onToggleExpanded(task.id) : onTaskClick?.(task)}
              style={{ fontSize: 12, fontWeight: hasChildren ? 600 : 400, color: task.is_critical ? '#dc2626' : undefined, cursor: (hasChildren || onTaskClick) ? 'pointer' : 'default' }}
            >
              {task.title}
            </span>
            {hasChildren && onTaskClick && (
              <button
                onClick={e => { e.stopPropagation(); onTaskClick(task) }}
                title="Détails du lot"
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 3px', display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: 11, flexShrink: 0, lineHeight: 1 }}
              >ⓘ</button>
            )}
            {!hasChildren && !readOnly && onCreateSubtask && (
              <button
                onClick={e => { e.stopPropagation(); setEditingSubtask(task.id) }}
                title="Ajouter une sous-tâche"
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 3px', display: 'flex', alignItems: 'center', color: '#018ABE', fontSize: 12, flexShrink: 0, lineHeight: 1, fontWeight: 700 }}
              >+</button>
            )}
          </div>
        </td>

        <td
          className="gantt-progress-cell"
          onClick={() => { if (!readOnly && onProgress) setEditingProgress(task.id) }}
          style={{ cursor: !readOnly && onProgress ? 'pointer' : 'default' }}
        >
          {editingProgress === task.id ? (
            <input
              type="number" min={0} max={100} step={5}
              defaultValue={task.progress}
              autoFocus
              style={{ width: '46px', fontSize: '11px', textAlign: 'center', border: '1px solid var(--accent)', borderRadius: '4px', padding: '1px 2px' }}
              onBlur={e => { onProgress?.(task.id, Math.min(100, Math.max(0, Number(e.target.value)))); setEditingProgress(null) }}
              onKeyDown={e => { if (e.key === 'Enter') { onProgress?.(task.id, Math.min(100, Math.max(0, Number((e.target as HTMLInputElement).value)))); setEditingProgress(null) } else if (e.key === 'Escape') setEditingProgress(null) }}
            />
          ) : (
            <span title={!readOnly && onProgress ? 'Cliquer pour modifier' : undefined}>{task.progress}%</span>
          )}
        </td>

        <td className="gantt-timeline-cell">
          <div
            className="gantt-timeline-container"
            style={{
              width: daysInRange * dayWidthPx,
              background: base ? `linear-gradient(90deg, #e2e8f0 0%, #e2e8f0 ${(base.leftPx + base.widthPx) / (daysInRange * dayWidthPx) * 100}%, transparent ${(base.leftPx + base.widthPx) / (daysInRange * dayWidthPx) * 100}%), ${gridBackground}` : gridBackground
            }}
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
              <div style={{ position: 'absolute', left: curWeekLeftPx, top: 0, width: curWeekWidthPx, height: '100%', background: 'rgba(1,138,190,.16)', borderLeft: '2px solid rgba(1,138,190,.55)', borderRight: '2px solid rgba(1,138,190,.55)', zIndex: 0, pointerEvents: 'none' }} />
            )}
            {/* Today marker removed — current week highlight (blue band above) is sufficient */}

            {task.is_milestone ? (
              /* Milestone diamond */
              <div
                onMouseDown={editable ? e => handleBarMouseDown(task, e, 'move') : undefined}
                title={tooltip}
                style={{
                  position: 'absolute', left: bar.leftPx - 7, top: 4, width: 14, height: 14,
                  background: task.progress >= 100 ? '#15803d' : '#02457A',
                  transform: 'rotate(45deg)', borderRadius: 2, zIndex: 3,
                  border: '1.5px solid #fff', boxShadow: '0 1px 2px rgba(0,0,0,.25)',
                  cursor: editable ? 'grab' : 'default', opacity: dimmed ? 0.3 : 1,
                }}
              />
            ) : (
              <div style={{ opacity: dimmed ? 0.28 : 1 }}>
                {/* Left resize handle */}
                {editable && (
                  <div
                    onMouseDown={e => handleBarMouseDown(task, e, 'resize-start')}
                    style={{ position: 'absolute', left: bar.leftPx - 4, top: 5, width: 8, height: 12, cursor: 'ew-resize', zIndex: 4 }}
                  />
                )}

                {/* ÉCARTS display — only when mode is on */}
                {showEcarts && (() => {
                  const ec = calculateEcarts(task)
                  return (
                    <div style={{
                      position: 'absolute',
                      left: bar.leftPx + bar.widthPx + 6,
                      top: 2,
                      fontSize: 9,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      zIndex: 2,
                      pointerEvents: 'none',
                      color: ec.color,
                    }}>
                      Δ {ec.deltaStart >= 0 ? '+' : ''}{ec.deltaStart}j | {ec.dayLabel}
                    </div>
                  )
                })()}

                {/* Unified segmented bar */}
                <div
                  className="gantt-bar"
                  onMouseDown={editable ? e => handleBarMouseDown(task, e, 'move') : undefined}
                  style={{
                    left: bar.leftPx,
                    width: bar.widthPx,
                    boxShadow: isLate ? '0 0 0 1.5px #dc2626' : task.is_critical && viewState.highlightCritical ? '0 0 0 1.5px #dc2626' : '0 1px 3px rgba(0, 0, 0, 0.12)',
                    border: isLate ? '1px solid #dc2626' : '1px solid rgba(0,0,0,0.08)',
                    cursor: !editable ? 'default' : dragState.isDragging && dragState.taskId === task.id ? 'grabbing' : 'grab',
                  }}
                  title={tooltip}
                >
                  {(() => {
                    const zones = calculateZones(task, mainStart, mainEnd)
                    const visibleZones = zones.filter(z => z.isVisible)
                    // Fallback: always show at least a blue bar
                    if (visibleZones.length === 0) {
                      return <div className="gantt-bar-segment" style={{ flex: 1, background: '#bfdbfe' }} />
                    }
                    return visibleZones.map(zone => (
                      <div
                        key={zone.type}
                        className="gantt-bar-segment"
                        style={{
                          flex: zone.widthPercent,
                          background: getSegmentBackground(zone.type, zone.progressPercent),
                        }}
                      />
                    ))
                  })()}

                  {/* Percentage overlay */}
                  {bar.widthPx > 50 && (
                    <div
                      className="gantt-bar-percentage"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: 0.9,
                        pointerEvents: 'none',
                        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                        zIndex: 10,
                      }}
                    >
                      {task.progress}%
                    </div>
                  )}
                </div>

                {/* Right resize handle */}
                {editable && (
                  <div
                    onMouseDown={e => handleBarMouseDown(task, e, 'resize-end')}
                    style={{ position: 'absolute', left: bar.leftPx + bar.widthPx - 4, top: 5, width: 8, height: 12, cursor: 'ew-resize', zIndex: 4 }}
                  />
                )}

                {/* Commitment markers ◆ (engagement pris en visite) */}
                {commitments?.filter(c => c.taskId === task.id).map(c => {
                  const cDate = new Date(c.promisedEnd)
                  const cx = geom(cDate, cDate).leftPx
                  return (
                    <div
                      key={c.id}
                      onClick={() => onCommitmentClick?.(c)}
                      title={`Engagement : ${c.label ?? c.promisedEnd}${c.company ? ` — ${c.company}` : ''}`}
                      style={{ position: 'absolute', left: cx - 5, top: 1, fontSize: 10, color: '#7c3aed', zIndex: 5, pointerEvents: 'auto', fontWeight: 700, lineHeight: 1, cursor: 'pointer' }}
                    >◆</div>
                  )
                })}
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
              <th className="gantt-timeline-header" style={{ padding: 0, width: daysInRange * dayWidthPx, position: 'relative' }}>
                {/* Current-week highlight in header */}
                {curWeekVisible && (
                  <div style={{ position: 'absolute', left: curWeekLeftPx, top: 0, width: curWeekWidthPx, height: '100%', background: 'rgba(1,138,190,.16)', borderLeft: '2px solid rgba(1,138,190,.55)', borderRight: '2px solid rgba(1,138,190,.55)', zIndex: 0, pointerEvents: 'none' }} />
                )}
                {/* Today indicator removed — current week band in header is sufficient */}
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
            {visible.flatMap(({ task, depth }) => {
              const rows = [renderRow(task, depth)]
              if (editingSubtask === task.id) rows.push(renderSubtaskForm(task.id))
              return rows
            })}
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
