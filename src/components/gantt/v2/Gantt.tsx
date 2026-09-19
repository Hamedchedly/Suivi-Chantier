// PlanningGantt — orchestrateur du nouveau Gantt (Phase 3).
// Consomme PlanningEngine ; n'a besoin d'aucune autre logique de calcul.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { BarChart3, ArrowLeft } from 'lucide-react'
import { GanttTask, DelayCause } from '../../../types/gantt'
import { PlanningTask } from '../../../types/planning'
import { DateCommitment } from '../../../lib/commitments'
import { toPlanningTasks, analyzePlanning, criticalPath as computeCriticalPath } from '../../../lib/planningEngine'
import { ZoomLevel, computeTimelineRange, xForDate } from '../../../lib/planningViewModel'
import { GanttHeaderLabel, GanttHeaderTimeline, HEADER_HEIGHT } from './GanttHeader'
import { GanttRowLabel, GanttRowTimeline, ROW_HEIGHT } from './GanttRow'
import { GanttTooltip } from './GanttTooltip'
import { GanttDetails } from './GanttDetails'
import { GanttAnalysis } from './GanttAnalysis'
import { GanttMobileList } from './GanttMobileList'

const LABEL_COLUMN_WIDTH = 240

interface Row { task: PlanningTask; depth: number }

function flattenRows(tasks: PlanningTask[], depth: number, collapsed: Set<string>, out: Row[]): void {
  for (const t of tasks) {
    out.push({ task: t, depth })
    if (t.children?.length && !collapsed.has(t.id)) flattenRows(t.children, depth + 1, collapsed, out)
  }
}

function indexById<T extends { id: string; children?: T[] }>(tasks: T[]): Map<string, T> {
  const m = new Map<string, T>()
  const walk = (arr: T[]) => { for (const t of arr) { m.set(t.id, t); if (t.children?.length) walk(t.children) } }
  walk(tasks)
  return m
}

interface Props {
  tasks: GanttTask[]
  commitments: DateCommitment[]
  operationId: string
  onDelayCauseChange?: (taskId: string, cause: DelayCause | undefined) => void
}

export function PlanningGantt({ tasks, commitments, operationId, onDelayCauseChange }: Props) {
  const today = useMemo(() => new Date(), [])
  const [zoom, setZoom] = useState<ZoomLevel>('week')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hover, setHover] = useState<{ task: PlanningTask; x: number; y: number } | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  // Section 8 du brief : sur mobile, ne pas reproduire la grille desktop —
  // une liste de cartes par défaut, la frise reste accessible sur demande.
  const isMobile = useMemo(() => typeof window !== 'undefined' && window.innerWidth < 768, [])
  const [showTimelineOnMobile, setShowTimelineOnMobile] = useState(false)
  const labelPaneRef = useRef<HTMLDivElement>(null)
  const timelinePaneRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  const planningTasks = useMemo(
    () => toPlanningTasks(tasks, { operationId, commitments }),
    [tasks, operationId, commitments],
  )
  const scale = useMemo(() => computeTimelineRange(planningTasks, today, zoom), [planningTasks, today, zoom])
  const rows = useMemo(() => { const out: Row[] = []; flattenRows(planningTasks, 0, collapsed, out); return out }, [planningTasks, collapsed])
  const planningById = useMemo(() => indexById(planningTasks), [planningTasks])
  const ganttById = useMemo(() => indexById(tasks), [tasks])

  const analysis = useMemo(() => analyzePlanning(tasks, today), [tasks, today])
  const cp = useMemo(() => computeCriticalPath(tasks), [tasks])
  const titleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const [id, t] of ganttById) m.set(id, t.title)
    return m
  }, [ganttById])

  const selectedTask = selectedId ? planningById.get(selectedId) ?? null : null

  // Au chargement (ou changement de zoom), recentre la frise sur aujourd'hui.
  useEffect(() => {
    const el = timelinePaneRef.current
    if (!el) return
    el.scrollLeft = Math.max(0, xForDate(today, scale) - el.clientWidth / 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const handleHover = (task: PlanningTask, e: ReactMouseEvent) => setHover({ task, x: e.clientX, y: e.clientY })

  // Les deux volets scrollent verticalement ensemble ; seul le volet frise scrolle à l'horizontale.
  const syncScroll = (source: 'label' | 'timeline') => (e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current) return
    const other = source === 'label' ? timelinePaneRef.current : labelPaneRef.current
    if (!other) return
    syncingRef.current = true
    other.scrollTop = e.currentTarget.scrollTop
    syncingRef.current = false
  }

  const showMobileList = isMobile && !showTimelineOnMobile

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        {isMobile && showTimelineOnMobile ? (
          <button
            onClick={() => setShowTimelineOnMobile(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--navy)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <ArrowLeft size={14} /> Retour à la liste
          </button>
        ) : showMobileList ? (
          <span />
        ) : (
          <Legend />
        )}
        <button
          onClick={() => setShowAnalysis(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--navy)', background: '#eef2f6', border: 'none', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', flexShrink: 0 }}
        >
          <BarChart3 size={14} /> Analyse
        </button>
      </div>

      {showMobileList ? (
        <GanttMobileList
          tasks={planningTasks}
          onSelect={t => setSelectedId(t.id)}
          onShowTimeline={() => setShowTimelineOnMobile(true)}
        />
      ) : (
      <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Volet libellés : scroll vertical uniquement, ne bouge jamais à l'horizontale. */}
        <div
          ref={labelPaneRef}
          onScroll={syncScroll('label')}
          style={{ width: LABEL_COLUMN_WIDTH, flexShrink: 0, maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden', borderRight: '1px solid var(--line)' }}
        >
          <GanttHeaderLabel zoom={zoom} onZoomChange={setZoom} />
          {rows.map(({ task, depth }) => (
            <GanttRowLabel
              key={task.id}
              task={task}
              depth={depth}
              isLot={!!task.children?.length}
              isExpanded={!collapsed.has(task.id)}
              onToggleExpand={() => toggle(task.id)}
              onSelect={t => setSelectedId(t.id)}
              highlighted={cp.criticalIds.has(task.id)}
            />
          ))}
        </div>

        {/* Volet frise : scroll vertical (synchronisé) + horizontal. */}
        <div
          ref={timelinePaneRef}
          onScroll={syncScroll('timeline')}
          style={{ position: 'relative', flex: 1, maxHeight: '70vh', overflow: 'auto' }}
        >
          <GanttHeaderTimeline scale={scale} />
          {/* Ligne « aujourd'hui » : traverse toutes les lignes, reste alignée pendant le scroll. */}
          <div style={{
            position: 'absolute', top: HEADER_HEIGHT, left: xForDate(today, scale),
            width: 2, height: rows.length * ROW_HEIGHT, background: 'var(--bad)', pointerEvents: 'none', zIndex: 1,
          }} />
          {rows.map(({ task }) => (
            <GanttRowTimeline
              key={task.id}
              task={task}
              scale={scale}
              today={today}
              onSelect={t => setSelectedId(t.id)}
              onHover={handleHover}
              onLeave={() => setHover(null)}
              highlighted={cp.criticalIds.has(task.id)}
            />
          ))}
        </div>
      </div>
      )}

      {!showMobileList && rows.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Aucune tâche planifiée.</div>
      )}

      {hover && <GanttTooltip task={hover.task} x={hover.x} y={hover.y} />}

      {selectedTask && (
        <GanttDetails
          task={selectedTask}
          allTasksById={planningById}
          onClose={() => setSelectedId(null)}
          onDelayCauseChange={onDelayCauseChange ? cause => onDelayCauseChange(selectedTask.id, cause) : undefined}
        />
      )}

      {showAnalysis && (
        <GanttAnalysis analysis={analysis} criticalPath={cp} taskTitleById={titleById} onClose={() => setShowAnalysis(false)} />
      )}
    </div>
  )
}

function Legend() {
  const item = (color: string, label: string, pattern?: boolean) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
      <span style={{ width: 14, height: 8, borderRadius: 2, background: pattern ? undefined : color, border: pattern ? `1.5px solid ${color}` : undefined }} />
      {label}
    </span>
  )
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      {item('var(--navy)', 'Contractuel', true)}
      {item('var(--accent)', 'Réel')}
      {item('var(--warn)', 'Prévision (retard)')}
    </div>
  )
}
