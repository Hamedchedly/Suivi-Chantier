// PlanningGantt — orchestrateur du nouveau Gantt (Phase 3).
// Consomme PlanningEngine ; n'a besoin d'aucune autre logique de calcul.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { BarChart3, ArrowLeft, Search, X as XIcon, ZoomIn, ZoomOut } from 'lucide-react'
import { GanttTask, DelayCause } from '../../../types/gantt'
import { PlanningTask } from '../../../types/planning'
import { DateCommitment } from '../../../lib/commitments'
import { CpmResult } from '../../../lib/cpm'
import { toPlanningTasks, analyzePlanning, criticalPath as computeCriticalPath } from '../../../lib/planningEngine'
import { ZoomLevel, computeTimelineRange, xForDate, dayTicks, currentWeekBand, BASE_DAY_WIDTH } from '../../../lib/planningViewModel'
import { GanttHeaderLabel, GanttHeaderTimeline, headerHeightFor } from './GanttHeader'
import { GanttRowLabel, GanttRowTimeline, ROW_HEIGHT } from './GanttRow'
import { GanttTooltip } from './GanttTooltip'
import { GanttDetails } from './GanttDetails'
import { GanttAnalysis } from './GanttAnalysis'
import { GanttMobileList } from './GanttMobileList'

const LABEL_COLUMN_WIDTH = 240

// Zoom continu (+/-) : facteur appliqué à BASE_DAY_WIDTH[zoom], indépendant
// du sélecteur Semaine/Mois/Trimestre — ne recalcule jamais une date, comme
// le zoom par palier existant (computeTimelineRange ne recadre que dayWidth).
const ZOOM_MULTIPLIER_MIN = 0.4
const ZOOM_MULTIPLIER_MAX = 3
const ZOOM_MULTIPLIER_STEP = 0.2

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
  /** CPM déjà calculé par l'appelant (ex. pages/Gantt.tsx, pour appliquer la
   * criticité à l'affichage) — évite de relancer computeCpm ici sur le même
   * réseau de dépendances. Recalculé en interne si omis. */
  cpm?: CpmResult
  onDelayCauseChange?: (taskId: string, cause: DelayCause | undefined) => void
  /** Édition — omis (ex. ShareView en lecture seule) : le panneau détail redevient purement informatif. */
  onProgress?: (taskId: string, progress: number) => void
  onPlannedDates?: (taskId: string, updates: { start?: Date; end?: Date }) => void
  onActualStart?: (taskId: string, date: Date | null) => void
  onActualEnd?: (taskId: string, date: Date | null) => void
  onDependencyAdd?: (taskId: string, predecessorId: string) => void
  onDependencyRemove?: (taskId: string, predecessorId: string) => void
  /** Sous-tâche : uniquement pour une tâche de profondeur 1 (fille directe d'un
   * lot) sans enfant — createSubTask (lib/planning.ts) ne va pas plus loin. */
  onSubTaskAdd?: (parentTaskId: string, title: string, start: string, duration: number) => void
}

export function PlanningGantt({
  tasks, commitments, operationId, cpm: precomputedCpm, onDelayCauseChange,
  onProgress, onPlannedDates, onActualStart, onActualEnd, onDependencyAdd, onDependencyRemove, onSubTaskAdd,
}: Props) {
  const today = useMemo(() => new Date(), [])
  const [zoom, setZoom] = useState<ZoomLevel>('week')
  const [zoomMultiplier, setZoomMultiplier] = useState(1)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hover, setHover] = useState<{ task: PlanningTask; x: number; y: number } | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
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
  // Filtre texte : garde une branche si elle-même ou l'un de ses descendants correspond.
  const filteredTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return planningTasks
    const filter = (list: PlanningTask[]): PlanningTask[] => list
      .map(t => {
        const children = t.children ? filter(t.children) : undefined
        const matches = t.title.toLowerCase().includes(term)
        if (matches || (children && children.length > 0)) return children ? { ...t, children } : t
        return null
      })
      .filter((t): t is PlanningTask => t !== null)
    return filter(planningTasks)
  }, [planningTasks, searchTerm])
  const scale = useMemo(
    () => computeTimelineRange(filteredTasks, today, zoom, BASE_DAY_WIDTH[zoom] * zoomMultiplier),
    [filteredTasks, today, zoom, zoomMultiplier],
  )
  const todayBand = useMemo(() => currentWeekBand(scale, today), [scale, today])
  const rows = useMemo(() => { const out: Row[] = []; flattenRows(filteredTasks, 0, collapsed, out); return out }, [filteredTasks, collapsed])
  const planningById = useMemo(() => indexById(planningTasks), [planningTasks])
  const ganttById = useMemo(() => indexById(tasks), [tasks])

  const analysis = useMemo(() => analyzePlanning(tasks, today), [tasks, today])
  const cp = useMemo(() => computeCriticalPath(tasks, precomputedCpm), [tasks, precomputedCpm])
  const titleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const [id, t] of ganttById) m.set(id, t.title)
    return m
  }, [ganttById])

  const selectedTask = selectedId ? planningById.get(selectedId) ?? null : null
  const selectedDepth = selectedId ? rows.find(r => r.task.id === selectedId)?.depth : undefined
  const canAddSubTask = !!onSubTaskAdd && selectedDepth === 1 && !selectedTask?.children?.length

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f7fafc', borderRadius: 6, padding: '6px 10px', marginBottom: 8, maxWidth: 320 }}>
        <Search size={14} color="var(--muted)" />
        <input
          type="text"
          placeholder="Rechercher une tâche…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ flex: 1, border: 'none', background: 'none', fontSize: 12, outline: 'none', color: 'var(--ink)' }}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, color: 'var(--muted)' }}><XIcon size={13} /></button>
        )}
      </div>

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!showMobileList && (
            <ZoomControl multiplier={zoomMultiplier} onChange={setZoomMultiplier} />
          )}
          <button
            onClick={() => setShowAnalysis(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--navy)', background: '#eef2f6', border: 'none', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', flexShrink: 0 }}
          >
            <BarChart3 size={14} /> Analyse
          </button>
        </div>
      </div>

      {showMobileList ? (
        <GanttMobileList
          tasks={filteredTasks}
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
          <GanttHeaderTimeline scale={scale} today={today} />
          {/* Repères journaliers dans le corps de la frise — grille légère, vue semaine uniquement. */}
          {scale.zoom === 'week' && dayTicks(scale, today).map((t, i) => (
            <div
              key={i}
              style={{
                position: 'absolute', top: headerHeightFor(zoom), left: t.x, width: t.width,
                height: rows.length * ROW_HEIGHT, borderLeft: '1px solid #f1f5f9',
                background: t.isWeekend ? 'rgba(2,69,122,.02)' : undefined, pointerEvents: 'none',
              }}
            />
          ))}
          {/* Bande « aujourd'hui » : toute la colonne de la semaine courante,
              traverse toutes les lignes, reste alignée pendant le scroll —
              format du planning de référence (remplace l'ancienne ligne fine). */}
          {todayBand && (
            <div style={{
              position: 'absolute', top: headerHeightFor(zoom), left: todayBand.x, width: todayBand.width,
              height: rows.length * ROW_HEIGHT, background: 'rgba(220,38,38,.07)', pointerEvents: 'none', zIndex: 1,
            }} />
          )}
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
          key={selectedTask.id}
          task={selectedTask}
          allTasksById={planningById}
          onClose={() => setSelectedId(null)}
          onDelayCauseChange={onDelayCauseChange ? cause => onDelayCauseChange(selectedTask.id, cause) : undefined}
          onProgress={onProgress ? progress => onProgress(selectedTask.id, progress) : undefined}
          onPlannedDates={onPlannedDates ? updates => onPlannedDates(selectedTask.id, updates) : undefined}
          onActualStart={onActualStart ? date => onActualStart(selectedTask.id, date) : undefined}
          onActualEnd={onActualEnd ? date => onActualEnd(selectedTask.id, date) : undefined}
          onDependencyAdd={onDependencyAdd ? predecessorId => onDependencyAdd(selectedTask.id, predecessorId) : undefined}
          onDependencyRemove={onDependencyRemove ? predecessorId => onDependencyRemove(selectedTask.id, predecessorId) : undefined}
          onSubTaskAdd={canAddSubTask ? (title, start, duration) => onSubTaskAdd!(selectedTask.id, title, start, duration) : undefined}
        />
      )}

      {showAnalysis && (
        <GanttAnalysis analysis={analysis} criticalPath={cp} taskTitleById={titleById} onClose={() => setShowAnalysis(false)} />
      )}
    </div>
  )
}

/** Zoom continu, indépendant du sélecteur Semaine/Mois/Trimestre — ne change
 * que l'échelle graphique (dayWidth), jamais une date. */
function ZoomControl({ multiplier, onChange }: { multiplier: number; onChange: (m: number) => void }) {
  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
    border: '1px solid var(--line)', borderRadius: 6, background: '#fff', color: 'var(--navy)', cursor: 'pointer',
  }
  const disabledStyle: React.CSSProperties = { opacity: 0.4, cursor: 'not-allowed' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={() => onChange(Math.max(ZOOM_MULTIPLIER_MIN, Math.round((multiplier - ZOOM_MULTIPLIER_STEP) * 10) / 10))}
        disabled={multiplier <= ZOOM_MULTIPLIER_MIN}
        title="Dézoomer"
        style={multiplier <= ZOOM_MULTIPLIER_MIN ? { ...btnStyle, ...disabledStyle } : btnStyle}
      >
        <ZoomOut size={13} />
      </button>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', width: 32, textAlign: 'center' }}>{Math.round(multiplier * 100)}%</span>
      <button
        onClick={() => onChange(Math.min(ZOOM_MULTIPLIER_MAX, Math.round((multiplier + ZOOM_MULTIPLIER_STEP) * 10) / 10))}
        disabled={multiplier >= ZOOM_MULTIPLIER_MAX}
        title="Zoomer"
        style={multiplier >= ZOOM_MULTIPLIER_MAX ? { ...btnStyle, ...disabledStyle } : btnStyle}
      >
        <ZoomIn size={13} />
      </button>
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
      {item('var(--accent)', 'Réel (avancement)')}
      {item('var(--bad)', 'Retard / bloqué', true)}
      {item('var(--warn)', 'Prévision (retard)')}
    </div>
  )
}
