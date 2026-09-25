// PlanningGantt — orchestrateur du nouveau Gantt (Phase 3).
// Consomme PlanningEngine ; n'a besoin d'aucune autre logique de calcul.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { BarChart3, ArrowLeft, Search, X as XIcon, ZoomIn, ZoomOut, LayoutList, GanttChartSquare, Cog } from 'lucide-react'
import { GanttTask, DelayCause } from '../../../types/gantt'
import { PlanningTask } from '../../../types/planning'
import { DateCommitment } from '../../../lib/commitments'
import { CpmResult } from '../../../lib/cpm'
import { toPlanningTasks, analyzePlanning, criticalPath as computeCriticalPath, isTaskGroupCompleted } from '../../../lib/planningEngine'
import { ZoomLevel, computeTimelineRange, xForDate, headerCells, currentWeekBand, BASE_DAY_WIDTH } from '../../../lib/planningViewModel'
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
  const ids = new Set<string>()
  const walk = (arr: T[], depth = 0) => {
    for (const t of arr) {
      if (ids.has(t.id)) console.warn(`[indexById] DUPLICATE ID FOUND: ${t.id}`)
      ids.add(t.id)
      m.set(t.id, t)
      if (depth <= 2 && 'title' in t) console.log(`  [${'  '.repeat(depth)}] indexById: ${(t as any).title} (${t.id})`)
      if (t.children?.length) walk(t.children, depth + 1)
    }
  }
  walk(tasks)
  console.log('[indexById] Total items indexed:', m.size, 'unique IDs:', ids.size)
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
  /** Navigation vers la configuration du planning (section 6 du brief). */
  onEditPlanningConfig?: () => void
}

export function PlanningGantt({
  tasks, commitments, operationId, cpm: precomputedCpm, onDelayCauseChange,
  onProgress, onPlannedDates, onActualStart, onActualEnd, onDependencyAdd, onDependencyRemove, onSubTaskAdd, onEditPlanningConfig,
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
  // Section 4 du sprint Planning/Journal CR : même choix [Liste][Gantt] sur
  // desktop que sur mobile (bouton « Voir le Gantt »/« Retour à la liste »),
  // vue par défaut = Gantt sur desktop (Liste sur mobile, inchangé).
  const [desktopView, setDesktopView] = useState<'gantt' | 'liste'>('gantt')
  const labelPaneRef = useRef<HTMLDivElement>(null)
  const timelinePaneRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)
  const collapseInitDone = useRef(false)

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
  const rows = useMemo(() => {
    const out: Row[] = [];
    flattenRows(filteredTasks, 0, collapsed, out)
    if (out.length > 0 && out.length <= 10) {
      console.log('[PlanningGantt] rows order:', out.map(r => `${r.task.title}(${r.task.id})`).join(' → '))
    }
    return out
  }, [filteredTasks, collapsed])
  const planningById = useMemo(() => indexById(planningTasks), [planningTasks])
  const ganttById = useMemo(() => indexById(tasks), [tasks])

  // Section 1.1 : groupes (lots, et toute tâche à enfants) terminés au sens
  // isTaskGroupCompleted — calculé une seule fois ici (jamais dans la ligne
  // elle-même, dont le comparateur React.memo ne regarde pas les enfants).
  const completedGroupIds = useMemo(() => {
    const ids = new Set<string>()
    const walk = (list: PlanningTask[]) => {
      for (const t of list) {
        if (t.children?.length) {
          if (isTaskGroupCompleted(t)) ids.add(t.id)
          walk(t.children)
        }
      }
    }
    walk(planningTasks)
    return ids
  }, [planningTasks])

  // Section 1.2 : repli automatique au CHARGEMENT uniquement — un lot terminé
  // démarre replié, un lot non terminé reste ouvert, mais un repli/dépli
  // manuel ultérieur de l'utilisateur n'est plus jamais écrasé par ce calcul
  // (collapseInitDone garde l'effet à un seul déclenchement, à la première
  // fois que des tâches sont disponibles).
  useEffect(() => {
    if (collapseInitDone.current || planningTasks.length === 0) return
    collapseInitDone.current = true
    if (completedGroupIds.size === 0) return
    setCollapsed(prev => new Set([...prev, ...completedGroupIds]))
  }, [planningTasks, completedGroupIds])

  // Section 1.3 : auto-collapse quand un groupe DEVIENT 100% (transition uniquement).
  // Tracker de l'état précédent : seuls les groupes qui ne SONT PAS dans l'état précédent
  // mais le SONT maintenant sont considérés comme "nouvellement terminés" et doivent déclencher
  // un collapse automatique.
  const previousCompletedGroupIdsRef = useRef(completedGroupIds)
  useEffect(() => {
    if (!collapseInitDone.current) return

    const previousIds = previousCompletedGroupIdsRef.current
    const newlyCompleted = new Set<string>()

    // Trouver les groupes qui viennent de devenir terminés (dans current mais pas dans previous)
    for (const id of completedGroupIds) {
      if (!previousIds.has(id)) {
        newlyCompleted.add(id)
      }
    }

    // Ne collapsing que si au moins un groupe vient de devenir terminé
    if (newlyCompleted.size > 0) {
      setCollapsed(prev => {
        const next = new Set(prev)
        for (const id of newlyCompleted) {
          next.add(id)
        }
        return next
      })
    }

    // Mémoriser l'état actuel pour le prochain cycle
    previousCompletedGroupIdsRef.current = completedGroupIds
  }, [completedGroupIds])

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

  // DEBUG: Log selected task to trace offset bug
  useEffect(() => {
    if (selectedTask) {
      console.log('[PlanningGantt] selectedTask changed:', { id: selectedTask.id, title: selectedTask.title, progress: selectedTask.progress })
    }
  }, [selectedTask?.id, selectedTask?.progress])

  // Au chargement (ou changement de zoom), recentre la frise sur aujourd'hui.
  useEffect(() => {
    const el = timelinePaneRef.current
    if (!el) return
    el.scrollLeft = Math.max(0, xForDate(today, scale) - el.clientWidth / 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  const toggle = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const handleSelectTask = useCallback((task: PlanningTask) => {
    console.log('[Gantt.handleSelectTask] selecting:', { id: task.id, title: task.title })
    setSelectedId(task.id)
  }, [])

  const handleHover = useCallback((task: PlanningTask, e: ReactMouseEvent) => {
    setHover({ task, x: e.clientX, y: e.clientY })
  }, [])

  const handleLeaveHover = useCallback(() => {
    setHover(null)
  }, [])

  // Les deux volets scrollent verticalement ensemble ; seul le volet frise scrolle à l'horizontale.
  const syncScroll = (source: 'label' | 'timeline') => (e: React.UIEvent<HTMLDivElement>) => {
    if (syncingRef.current) return
    const other = source === 'label' ? timelinePaneRef.current : labelPaneRef.current
    if (!other) return
    syncingRef.current = true
    other.scrollTop = e.currentTarget.scrollTop
    syncingRef.current = false
  }

  // Section 4 : même bascule [Liste]/[Gantt] des deux côtés — sur mobile elle
  // reste pilotée par showTimelineOnMobile (bouton « Voir le Gantt » interne à
  // GanttMobileList, inchangé) ; sur desktop par desktopView (nouveaux boutons
  // dans la barre d'outils, ci-dessous). Le mode Par lot / Par logement (hors
  // de ce composant) reste indépendant de ce choix.
  const showListView = isMobile ? !showTimelineOnMobile : desktopView === 'liste'
  const goToGanttView = () => (isMobile ? setShowTimelineOnMobile(true) : setDesktopView('gantt'))

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
        ) : showListView ? (
          <span />
        ) : (
          <Legend />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!isMobile && (
            <ViewToggle view={desktopView} onChange={setDesktopView} />
          )}
          {!showListView && (
            <ZoomControl multiplier={zoomMultiplier} onChange={setZoomMultiplier} />
          )}
          {onEditPlanningConfig && (
            <button
              onClick={onEditPlanningConfig}
              title="Modifier le planning et les congés"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--navy)', background: '#eef2f6', border: 'none', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', flexShrink: 0 }}
            >
              <Cog size={14} /> Config
            </button>
          )}
          <button
            onClick={() => setShowAnalysis(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--navy)', background: '#eef2f6', border: 'none', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', flexShrink: 0 }}
          >
            <BarChart3 size={14} /> Analyse
          </button>
        </div>
      </div>

      {showListView ? (
        <GanttMobileList
          tasks={filteredTasks}
          onSelect={handleSelectTask}
          onShowTimeline={goToGanttView}
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
              onSelect={handleSelectTask}
              highlighted={cp.criticalIds.has(task.id)}
              isCompleted={completedGroupIds.has(task.id)}
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
          {/* Seule grille verticale du corps : les colonnes SEMAINE (section 2 du
              sprint Planning/Journal CR) — plus de repères journaliers, plus de
              distinction samedi/dimanche, alignés pixel pour pixel sur l'en-tête
              (mêmes cellules que headerCells, réutilisées par GanttHeaderTimeline). */}
          {scale.zoom === 'week' && headerCells(scale).map((c, i) => (
            <div
              key={i}
              style={{
                position: 'absolute', top: headerHeightFor(zoom), left: c.x, width: c.width,
                height: rows.length * ROW_HEIGHT, borderLeft: '1px solid #f1f5f9', pointerEvents: 'none',
              }}
            />
          ))}
          {/* Bande « semaine courante » : toute la colonne, traverse toutes les
              lignes, reste alignée pendant le scroll (section 3) — teinte navy
              discrète, cohérente avec le reste de l'UI (déjà utilisée pour les
              barres contractuelles), pour ne pas être confondue avec le rouge
              qui signale un blocage/retard ailleurs sur cette même page. */}
          {todayBand && (
            <div style={{
              position: 'absolute', top: headerHeightFor(zoom), left: todayBand.x, width: todayBand.width,
              height: rows.length * ROW_HEIGHT, background: 'rgba(2,69,122,.06)', pointerEvents: 'none', zIndex: 1,
            }} />
          )}
          {rows.map(({ task }) => (
            <GanttRowTimeline
              key={task.id}
              task={task}
              scale={scale}
              today={today}
              onSelect={handleSelectTask}
              onHover={handleHover}
              onLeave={handleLeaveHover}
              highlighted={cp.criticalIds.has(task.id)}
            />
          ))}
        </div>
      </div>
      )}

      {!showListView && rows.length === 0 && (
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
          // CRITICAL BUG FIX: Only allow progress editing on leaf tasks (no children).
          // Synthetic parents (grp-lg-*, grp-bld-*) should be read-only.
          // Prevent synthetic task IDs from being passed to handleProgress.
          onProgress={onProgress && !selectedTask.children?.length ? progress => onProgress(selectedTask.id, progress) : undefined}
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

/** Bascule [Liste][Gantt] desktop (section 4) — même choix que mobile, vue
 * par défaut = Gantt. Le mode Par lot / Par logement reste indépendant. */
function ViewToggle({ view, onChange }: { view: 'gantt' | 'liste'; onChange: (v: 'gantt' | 'liste') => void }) {
  const btn = (v: 'gantt' | 'liste'): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 5, border: 'none',
    cursor: 'pointer', fontSize: 11, fontWeight: 600,
    background: view === v ? '#fff' : 'transparent', color: view === v ? '#02457A' : '#5b7183',
  })
  return (
    <div style={{ display: 'flex', gap: 2, background: '#eef2f6', padding: 2, borderRadius: 7, flexShrink: 0 }}>
      <button onClick={() => onChange('liste')} style={btn('liste')}><LayoutList size={13} /> Liste</button>
      <button onClick={() => onChange('gantt')} style={btn('gantt')}><GanttChartSquare size={13} /> Gantt</button>
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
