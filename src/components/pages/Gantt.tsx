import { useState, useMemo, useEffect } from 'react'
import { Eye, EyeOff, AlertTriangle, Zap, ZoomIn, ZoomOut, GitBranch, TrendingUp, History, Pencil, Plus, Check, X } from 'lucide-react'
import { GanttTask, GanttViewState } from '../../types/gantt'
import {
  getGanttTasks, saveGanttTasks, getHolidays, getGanttPrefs, saveGanttPrefs, GanttGroup, logActivity,
  getUnits, getTaskUnits, getZoneRefs, getCommitments,
} from '../../lib/repo'
import { createTask } from '../../lib/planning'
import { maxDrift, lateTasks, flattenLeaves } from '../../lib/schedule'
import { withActualDates } from '../../lib/actualDates'
import { taskConcernsUnit } from '../../lib/units'
import { computeCpm, autoSchedule, applyCriticality } from '../../lib/cpm'
import { makeCalendar } from '../../lib/calendar'
import { computeForecasts, applyForecastToPlanning, forecastImpact, hasBaseline, lockBaseline } from '../../lib/forecast'
import GanttTable from '../gantt/GanttTable'
import LogementMatrix from '../gantt/LogementMatrix'
import { MultiSelect } from '../gantt/MultiSelect'
import { TaskDetail } from '../gantt/TaskDetail'
import '../../styles/gantt.css'

const LOT_OPTS = [
  { id: 'L05', label: 'LOT 05 — Menuiseries' },
  { id: 'L06', label: 'LOT 06 — Électricité' },
  { id: 'L07', label: 'LOT 07 — CVC' },
  { id: 'L08', label: 'LOT 08 — Embellissements' },
]

const updateTaskInList = (list: GanttTask[], id: string, updates: Partial<GanttTask>): GanttTask[] =>
  list.map(t => {
    if (t.id === id) return { ...t, ...updates }
    if (t.children?.length) return { ...t, children: updateTaskInList(t.children, id, updates) }
    return t
  })

/** Comme updateTaskInList, mais la mise à jour est calculée depuis la tâche. */
const mapTaskInList = (list: GanttTask[], id: string, fn: (t: GanttTask) => GanttTask): GanttTask[] =>
  list.map(t => {
    if (t.id === id) return fn(t)
    if (t.children?.length) return { ...t, children: mapTaskInList(t.children, id, fn) }
    return t
  })

function makeParent(id: string, title: string, children: GanttTask[]): GanttTask {
  const leaves = children.filter(c => !c.is_milestone)
  const min = (f: (c: GanttTask) => number) => new Date(Math.min(...children.map(f)))
  const max = (f: (c: GanttTask) => number) => new Date(Math.max(...children.map(f)))
  return {
    id, lot_id: children[0]?.lot_id ?? '', title,
    planned_start: min(c => c.planned_start.getTime()), planned_end: max(c => c.planned_end.getTime()),
    planned_duration: 0,
    progress: leaves.length ? Math.round(leaves.reduce((s, c) => s + c.progress, 0) / leaves.length) : 0,
    status: 'in-progress', priority: 'medium', dependencies: [],
    is_milestone: false, is_critical: children.some(c => c.is_critical), children,
  }
}

// Build the display tree from the raw tasks, applying grouping + multi filters.
interface ZoneOpt { id: string; label: string }

function buildTree(
  tasks: GanttTask[], group: GanttGroup, lots: Set<string>, zones: Set<string>,
  zoneRefs: ZoneOpt[], concerns: (taskId: string, unitId: string) => boolean,
): GanttTask[] {
  const leaves = flattenLeaves(tasks).filter(l =>
    (lots.size === 0 || lots.has(l.lot_id)) &&
    (zones.size === 0 || [...zones].some(z => concerns(l.id, z))),
  )
  if (group === 'chrono') {
    return [...leaves].sort((a, b) => a.planned_start.getTime() - b.planned_start.getTime())
  }
  if (group === 'zone') {
    // Regroupe par zone du projet (bâtiments, logements, communs) via les
    // rattachements tâche→unité saisis dans « Bâtiments & zones ».
    return zoneRefs
      .map(z => {
        const children = leaves.filter(l => concerns(l.id, z.id))
        return children.length ? makeParent(`grp-z-${z.id}`, z.label, children) : null
      })
      .filter((t): t is GanttTask => t !== null)
  }
  // group === 'lot'
  const ids = new Set(leaves.map(l => l.id))
  return tasks
    .map(lot => {
      const children = (lot.children ?? []).filter(c => ids.has(c.id))
      return children.length ? makeParent(`grp-l-${lot.lot_id}`, lot.title, children) : null
    })
    .filter((t): t is GanttTask => t !== null)
}

export function Gantt() {
  const prefs0 = useMemo(() => getGanttPrefs(), [])
  const [mode, setMode] = useState<'gantt' | 'matrix'>('gantt')
  const [group, setGroup] = useState<GanttGroup>(prefs0.group)
  const [zoom, setZoom] = useState(prefs0.zoom)
  const [autoPlan, setAutoPlan] = useState(prefs0.autoSchedule)
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set())
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set())
  const [depsVisible, setDepsVisible] = useState(true)
  const [highlightCritical, setHighlightCritical] = useState(false)
  // Lots collapsed on arrival : on n'affiche que les lots, on tape un lot pour
  // dérouler ses tâches.
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => new Set())
  const [detailTask, setDetailTask] = useState<GanttTask | null>(null)
  const [showDelays, setShowDelays] = useState(false)
  const [showForecast, setShowForecast] = useState(false)
  const [showBaseline, setShowBaseline] = useState(false)
  const [showEcarts, setShowEcarts] = useState(false)
  const [forecastTasks, setForecastTasks] = useState<GanttTask[] | null>(null) // non-null = panel open
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>(getGanttTasks)
  const [editMode, setEditMode] = useState(false)
  const [snapshot, setSnapshot] = useState<GanttTask[] | null>(null)
  const [addForm, setAddForm] = useState(false)
  const commitments = useMemo(() => getCommitments(), [])
  const holidays = useMemo(() => getHolidays(), [])
  const calendar = useMemo(() => makeCalendar(holidays), [holidays])

  // Zones du projet (unités) et rattachements tâche→zone, pour le regroupement
  // et le filtre « Par logement ».
  const units = useMemo(() => getUnits(), [])
  const links = useMemo(() => getTaskUnits(), [])
  const zoneOpts = useMemo(() => getZoneRefs().map(z => ({ id: z.refId, label: z.label, group: z.buildingLabel })), [])
  const concerns = useMemo(() => (taskId: string, unitId: string) => taskConcernsUnit(units, links, taskId, unitId), [units, links])

  useEffect(() => { saveGanttTasks(ganttTasks) }, [ganttTasks])
  useEffect(() => { saveGanttPrefs({ zoom, group, autoSchedule: autoPlan }) }, [zoom, group, autoPlan])

  // CPM : chemin critique + marges recalculés depuis le réseau de dépendances.
  const cpm = useMemo(() => computeCpm(ganttTasks), [ganttTasks])
  const tasksWithCpm = useMemo(
    () => applyCriticality(ganttTasks, cpm.criticalIds),
    [ganttTasks, cpm],
  )

  const displayTree = useMemo(
    () => buildTree(tasksWithCpm, group, selectedLots, selectedZones, zoneOpts, concerns),
    [tasksWithCpm, group, selectedLots, selectedZones, zoneOpts, concerns],
  )

  // Changer de regroupement / filtre replie tout : on repart des lots seuls.
  useEffect(() => {
    setExpandedTasks(new Set())
  }, [group, selectedLots, selectedZones])

  const { startDate, endDate } = useMemo(() => {
    // La fenêtre couvre le prévisionnel ET le réel constaté, pour que l'écart
    // reste visible même quand le chantier déborde de son planning.
    const starts = ganttTasks.flatMap(l => [
      (l.actual_start ?? l.planned_start).getTime(),
      ...(l.children ?? []).map(c => (c.actual_start ?? c.planned_start).getTime()),
    ])
    const ends = ganttTasks.flatMap(l => [
      Math.max(l.planned_end.getTime(), l.actual_end?.getTime() ?? 0),
      ...(l.children ?? []).map(c => Math.max(c.planned_end.getTime(), c.actual_end?.getTime() ?? 0)),
    ])
    const start = new Date(Math.min(...starts)); start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - ((start.getDay() || 7) - 1))
    const end = new Date(Math.max(...ends)); end.setDate(end.getDate() + 14)
    return { startDate: start, endDate: end }
  }, [ganttTasks])

  const viewState: GanttViewState = {
    view: 'week', startDate, endDate, depsVisible, highlightCritical, zoom, holidays, expandedTasks,
  }

  const drift = useMemo(() => maxDrift(ganttTasks), [ganttTasks])
  const lateCount = useMemo(() => lateTasks(ganttTasks, new Date()).length, [ganttTasks])

  const handleTaskUpdate = (id: string, updates: { planned_start?: Date; planned_end?: Date; actual_start?: Date; actual_end?: Date }) =>
    setGanttTasks(prev => {
      const moved = updateTaskInList(prev, id, updates)
      // Auto-schedule uniquement quand les dates contractuelles changent, pas les réelles.
      if (!autoPlan || (!updates.planned_start && !updates.planned_end)) return moved
      const { tasks: replanned, shifted } = autoSchedule(moved, calendar)
      if (shifted.length) {
        logActivity('planning', `Auto-planification : ${shifted.length} tâche${shifted.length > 1 ? 's' : ''} décalée${shifted.length > 1 ? 's' : ''} suite au déplacement`)
      }
      return replanned
    })
  /** Saisir un avancement recale aussitôt les dates réelles de la tâche. */
  const handleProgress = (id: string, progress: number) => {
    const today = new Date()
    setGanttTasks(prev => {
      const bumped = updateTaskInList(prev, id, { progress })
      return mapTaskInList(bumped, id, t => withActualDates(t, today))
    })
    setDetailTask(t => (t && t.id === id ? withActualDates({ ...t, progress }, today) : t))
  }
  const enterEdit = () => { setSnapshot(ganttTasks); setEditMode(true) }
  const confirmEdit = () => { setSnapshot(null); setEditMode(false); logActivity('planning', 'Planning modifié (mode édition)') }
  const cancelEdit = () => { if (snapshot) { setGanttTasks(snapshot); saveGanttTasks(snapshot) } setSnapshot(null); setEditMode(false) }

  const addTaskFromForm = (lotId: string, title: string, start: string, duration: number) => {
    const [y, m, d] = start.split('-').map(Number)
    const res = createTask(ganttTasks, lotId, { title, start: new Date(y, m - 1, d), duration: Math.max(1, duration) })
    if (res.ok) { setGanttTasks(res.tasks); saveGanttTasks(res.tasks); logActivity('planning', `Tâche ajoutée : ${title}`) }
    setAddForm(false)
  }

  const groups: { id: GanttGroup; label: string }[] = [
    { id: 'lot', label: 'Par lot' },
    { id: 'zone', label: 'Par logement' },
    { id: 'chrono', label: 'Chronologique' },
  ]

  return (
    <div style={{ padding: '16px', paddingBottom: '80px' }}>
      {/* Header section */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: '#02457A' }}>Planning du chantier</h2>

        {/* Mode + grouping */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '3px', background: '#f0f4f8', padding: '4px', borderRadius: '8px', border: '1px solid #cbd5e0' }}>
            {(['gantt', 'matrix'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={seg(mode === m)}>{m === 'gantt' ? '📊 Gantt' : '🔲 Damier'}</button>
            ))}
          </div>
          {mode === 'gantt' && (
            <div style={{ display: 'flex', gap: '3px', background: '#f0f4f8', padding: '4px', borderRadius: '8px', border: '1px solid #cbd5e0' }}>
              {groups.map(g => (
                <button key={g.id} onClick={() => setGroup(g.id)} style={seg(group === g.id)}>{g.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drift / late banner */}
      {(drift > 0 || lateCount > 0) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {drift > 0 && (
            <button onClick={() => setShowDelays(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bad-bg)', color: 'var(--bad)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              <AlertTriangle size={14} />Dérive max : +{drift} j vs contractuel
            </button>
          )}
          {lateCount > 0 && (
            <button onClick={() => setShowDelays(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--warn-bg)', color: 'var(--warn)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              {lateCount} tâche{lateCount > 1 ? 's' : ''} en retard
            </button>
          )}
        </div>
      )}

      {mode === 'matrix' ? (
        <LogementMatrix tasks={ganttTasks} />
      ) : (
        <>
          {/* Filters + controls */}
          {/* Edit mode bar */}
          {editMode ? (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', background: '#fef3c7', borderRadius: '8px', padding: '8px 12px' }}>
              <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#92400e' }}>Mode édition — modifiez les tâches par glisser-déposer ou via les détails</span>
              <button onClick={confirmEdit} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#15803d', color: '#fff', border: 'none', borderRadius: '7px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                <Check size={13} /> Confirmer
              </button>
              <button onClick={cancelEdit} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '7px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                <X size={13} /> Annuler
              </button>
            </div>
          ) : null}

          <div className="g-toolbar">
            {/* Filters section */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', paddingRight: '8px', borderRight: '1px solid #cbd5e0' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#5b7183', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Filtres</span>
              <MultiSelect label="Lots" options={LOT_OPTS} selected={selectedLots} onChange={setSelectedLots} />
              <MultiSelect label="Logements" options={zoneOpts} selected={selectedZones} onChange={setSelectedZones} />
            </div>

            {/* View options section */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#5b7183', textTransform: 'uppercase', letterSpacing: '0.03em', marginLeft: '4px' }}>Affichage</span>
              <button className={`gtb ${depsVisible ? 'on' : ''}`} onClick={() => setDepsVisible(!depsVisible)} title="Afficher/masquer les liaisons entre tâches">
                {depsVisible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button className={`gtb ${highlightCritical ? 'on' : ''}`} onClick={() => setHighlightCritical(!highlightCritical)} title="Mettre en évidence le chemin critique">
                <Zap size={14} />
              </button>
              <button className={`gtb ${showEcarts ? 'on' : ''}`} onClick={() => setShowEcarts(v => !v)} title="Afficher les écarts (délais réels vs prévus)">
                <AlertTriangle size={14} />
              </button>
            </div>

            {/* Analysis section */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', paddingLeft: '8px', borderLeft: '1px solid #cbd5e0' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#5b7183', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Analyse</span>
              <button
                className={`gtb ${showBaseline ? 'on' : ''}`}
                onClick={() => setShowBaseline(v => !v)}
                title="Afficher le contractuel (référence de base)"
              >
                <History size={14} />
              </button>
              <button
                className={`gtb ${showForecast ? 'on' : ''}`}
                onClick={() => setShowForecast(v => !v)}
                title="Afficher les prévisions calculées"
              >
                <TrendingUp size={14} />
              </button>
            </div>

            <div style={{ flex: 1 }} />

            {/* Automation & Actions section */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className={`gtb ${autoPlan ? 'on' : ''}`}
                onClick={() => setAutoPlan(!autoPlan)}
                title="Auto-planification : décaler les tâches liées automatiquement"
              >
                <GitBranch size={14} />
              </button>
              <button
                className="gtb"
                onClick={() => {
                  const computed = computeForecasts(ganttTasks, new Date(), calendar)
                  setForecastTasks(computed)
                }}
                title="Calculer les prévisions"
                style={{ background: '#fef3c7', color: '#92400e' }}
              >
                <TrendingUp size={14} />
              </button>
              <button
                className="gtb"
                onClick={() => {
                  const locked = lockBaseline(ganttTasks, calendar)
                  saveGanttTasks(locked)
                  setGanttTasks(locked)
                  logActivity('planning', 'Dates contractuelles verrouillées')
                }}
                title="Figer comme référence contractuelle"
                style={{ background: '#f0f9ff', color: '#0369a1' }}
              >
                <History size={14} />
              </button>
            </div>

            {/* Edit & Zoom section */}
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center', background: '#f0f4f8', padding: '4px', borderRadius: '6px' }}>
              <button className="gtb" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Dézoomer" style={{ padding: '6px 8px' }}><ZoomOut size={13} /></button>
              <span style={{ fontSize: '11px', color: '#5b7183', fontWeight: 600, minWidth: '32px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button className="gtb" onClick={() => setZoom(z => Math.min(2.5, +(z + 0.25).toFixed(2)))} title="Zoomer" style={{ padding: '6px 8px' }}><ZoomIn size={13} /></button>
            </div>

            {/* Edit mode button */}
            <button
              className={`gtb ${editMode ? 'on' : ''}`}
              onClick={editMode ? confirmEdit : enterEdit}
              title={editMode ? 'Confirmer les modifications' : 'Passer en mode édition'}
              style={editMode ? { background: '#dcfce7', color: '#15803d' } : {}}
            >
              <Pencil size={14} />
            </button>

            {/* Add task button */}
            <button
              className="gtb"
              onClick={() => setAddForm(a => !a)}
              title="Ajouter une tâche"
              style={{ background: '#eff6ff', color: '#2563eb' }}
            >
              <Plus size={14} />
            </button>
          </div>

          {addForm && (
            <AddTaskForm
              lots={ganttTasks.map(t => ({ id: t.lot_id, label: t.title }))}
              onAdd={addTaskFromForm}
              onCancel={() => setAddForm(false)}
            />
          )}

          <div style={{ overflow: 'hidden', borderRadius: '6px', border: '1px solid #e4ecf2' }}>
            <GanttTable
              tasks={forecastTasks ? buildTree(applyCriticality(forecastTasks, cpm.criticalIds), group, selectedLots, selectedZones, zoneOpts, concerns) : displayTree}
              viewState={viewState}
              readOnly={!editMode}
              onToggleExpanded={id => setExpandedTasks(prev => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id); else next.add(id)
                return next
              })}
              onTaskUpdate={handleTaskUpdate}
              onProgress={handleProgress}
              onTaskClick={setDetailTask}
              showForecast={showForecast}
              showBaseline={showBaseline}
              showEcarts={showEcarts}
              commitments={commitments}
            />
          </div>

          {/* Écarts color legend */}
          {showEcarts && (
            <div style={{ marginTop: '12px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', display: 'flex', gap: '20px', alignItems: 'center', color: '#475569' }}>
              <span style={{ fontWeight: 600 }}>Légende écarts :</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 12, height: 12, background: '#10b981', borderRadius: 2 }} />
                <span>À jour (≤0j)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: 2 }} />
                <span>Léger retard (0-5j)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 2 }} />
                <span>Retard significatif (&gt;5j)</span>
              </div>
            </div>
          )}
        </>
      )}

      {detailTask && (
        <TaskDetail
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onProgress={handleProgress}
          onDates={(id, updates) => {
            handleTaskUpdate(id, updates)
            setDetailTask(t => (t && t.id === id ? { ...t, ...updates } : t))
          }}
          onActualEnd={(id, date) => {
            handleTaskUpdate(id, { actual_end: date ?? undefined })
            setDetailTask(t => (t && t.id === id ? { ...t, actual_end: date ?? undefined } : t))
          }}
          onForecastMethod={(id, method) => {
            const updated = ganttTasks.map(t => t.id === id ? { ...t, forecast_method: method } : t)
            saveGanttTasks(updated)
            setGanttTasks(updated)
            setDetailTask(t => (t && t.id === id ? { ...t, forecast_method: method } : t))
            logActivity('planning', `Méthode de calcul prévision modifiée : ${method}`)
          }}
          totalFloat={cpm.nodes.get(detailTask.id)?.totalFloat}
        />
      )}

      {showDelays && <DelayPanel tasks={ganttTasks} onClose={() => setShowDelays(false)} />}

      {forecastTasks && (
        <ForecastPanel
          tasks={forecastTasks}
          onApply={() => {
            const applied = applyForecastToPlanning(forecastTasks)
            setGanttTasks(applied)
            setForecastTasks(null)
            setShowForecast(false)
          }}
          onKeep={() => {
            setGanttTasks(forecastTasks)
            setForecastTasks(null)
            setShowForecast(true)
          }}
          onCancel={() => {
            setForecastTasks(null)
          }}
        />
      )}
    </div>
  )
}

// ── Panneau prévision (auto-réplanification) ───────────────────────────────────
function ForecastPanel({
  tasks, onApply, onKeep, onCancel,
}: { tasks: GanttTask[]; onApply: () => void; onKeep: () => void; onCancel: () => void }) {
  const { count, maxDrift: drift } = forecastImpact(tasks)
  const hasBase = hasBaseline(tasks)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} onClick={onCancel} />
      <div style={{ position: 'relative', width: '100%', background: '#fff', borderRadius: '16px 16px 0 0', padding: '16px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <TrendingUp size={16} color="#f59e0b" style={{ marginRight: 8 }} />
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#02457A', flex: 1 }}>Prévision calculée</span>
          <button onClick={onCancel} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#5b7183' }}>✕</button>
        </div>
        {count === 0 ? (
          <p style={{ fontSize: '13px', color: '#15803d', fontWeight: 600, marginBottom: '12px' }}>✓ Aucun écart — planning à jour.</p>
        ) : (
          <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
              {count} tâche{count > 1 ? 's' : ''} impactée{count > 1 ? 's' : ''} — dérive max +{drift} j
            </p>
            {!hasBase && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#b45309' }}>Le contractuel n'est pas encore verrouillé — "Appliquer" figera d'abord les dates planifiées comme référence.</p>}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={onApply}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#018ABE', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >Appliquer au planning</button>
          <button
            onClick={onKeep}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e4ecf2', background: '#f8fafc', color: '#02457A', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >Conserver en prévision</button>
          <button
            onClick={onCancel}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e4ecf2', background: 'transparent', color: '#5b7183', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >Annuler</button>
        </div>
      </div>
    </div>
  )
}

// ── Panneau analyse des retards ────────────────────────────────────────────────
function DelayPanel({ tasks, onClose }: { tasks: GanttTask[]; onClose: () => void }) {
  const today = new Date()
  const fr = (d?: Date) => (d ? d.toLocaleDateString('fr-FR') : '—')
  const delay = (t: GanttTask) => {
    if (t.actual_end) return Math.round((t.actual_end.getTime() - t.planned_end.getTime()) / 86400000)
    if (t.progress >= 100) return 0
    const late = Math.round((today.getTime() - t.planned_end.getTime()) / 86400000)
    return late > 0 ? late : 0
  }

  const byLot = tasks.map(lot => {
    const leaves = (lot.children ?? []).filter(c => !c.is_milestone)
    const maxDelay = leaves.reduce((m, c) => Math.max(m, delay(c)), 0)
    const last = [...leaves].sort((a, b) => b.planned_end.getTime() - a.planned_end.getTime())[0]
    return { lot, leaves, maxDelay, last }
  }).filter(r => r.maxDelay > 0 || r.leaves.some(c => delay(c) > 0))

  const allLeaves = tasks.flatMap(lot =>
    (lot.children ?? []).filter(c => !c.is_milestone).map(t => ({ lot, t }))
  ).filter(r => delay(r.t) > 0)
    .sort((a, b) => delay(b.t) - delay(a.t))

  const delayColor = (d: number) => d >= 14 ? '#b42318' : d >= 5 ? '#b45309' : '#92400e'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} onClick={onClose} />
      <div style={{ position: 'relative', marginTop: 'auto', background: '#fff', borderRadius: '16px 16px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 10px', borderBottom: '1px solid #e4ecf2' }}>
          <span style={{ flex: 1, fontWeight: 700, fontSize: '15px', color: '#02457A' }}>Analyse des retards</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#5b7183' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 16px 24px' }}>

          {/* Par lot / entreprise */}
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#5b7183', textTransform: 'uppercase', letterSpacing: '.05em' }}>Par lot</h4>
          {byLot.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#5b7183' }}>Aucun retard constaté.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Lot', 'Dernière tâche', 'Fin contractuelle', 'Fin réelle/projetée', 'Dérive finale'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#5b7183', borderBottom: '1px solid #e4ecf2', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byLot.map(({ lot, last, maxDelay }) => (
                    <tr key={lot.id} style={{ borderBottom: '1px solid #f0f5f9' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: '#02457A' }}>{lot.lot_id} · {lot.title}</td>
                      <td style={{ padding: '7px 10px', color: '#1f2937' }}>{last?.title ?? '—'}</td>
                      <td style={{ padding: '7px 10px', color: '#5b7183' }}>{fr(last?.planned_end)}</td>
                      <td style={{ padding: '7px 10px', color: '#5b7183' }}>{last?.actual_end ? fr(last.actual_end) : 'en cours'}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: delayColor(maxDelay) }}>+{maxDelay} j</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Par tâche */}
          <h4 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#5b7183', textTransform: 'uppercase', letterSpacing: '.05em' }}>Par tâche</h4>
          {allLeaves.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#5b7183' }}>Aucune tâche en retard.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Lot', 'Tâche', 'Début prévu', 'Fin prévue', 'Début réel', 'Fin réelle/projetée', 'Retard'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#5b7183', borderBottom: '1px solid #e4ecf2', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allLeaves.map(({ lot, t }) => {
                    const d = delay(t)
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f0f5f9' }}>
                        <td style={{ padding: '7px 10px', color: '#018ABE', fontWeight: 600 }}>{lot.lot_id}</td>
                        <td style={{ padding: '7px 10px', color: '#1f2937' }}>{t.title}</td>
                        <td style={{ padding: '7px 10px', color: '#5b7183' }}>{fr(t.planned_start)}</td>
                        <td style={{ padding: '7px 10px', color: '#5b7183' }}>{fr(t.planned_end)}</td>
                        <td style={{ padding: '7px 10px', color: '#5b7183' }}>{fr(t.actual_start)}</td>
                        <td style={{ padding: '7px 10px', color: '#5b7183' }}>{t.actual_end ? fr(t.actual_end) : 'en cours'}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: delayColor(d) }}>+{d} j</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Formulaire ajout de tâche ─────────────────────────────────────────────────
function AddTaskForm({ lots, onAdd, onCancel }: {
  lots: { id: string; label: string }[]
  onAdd: (lotId: string, title: string, start: string, duration: number) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [lotId, setLotId] = useState(lots[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(today)
  const [duration, setDuration] = useState('5')
  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: '7px', border: '1px solid #d1dbe5', fontSize: '12px', color: '#1f2937', background: '#fff', width: '100%', boxSizing: 'border-box' }
  return (
    <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid #d1dbe5', background: '#f8fafc', marginBottom: '10px' }}>
      <div style={{ fontWeight: 700, fontSize: '12px', color: '#02457A', marginBottom: '8px' }}>Nouvelle tâche</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '7px' }}>
        <select value={lotId} onChange={e => setLotId(e.target.value)} style={inp}>
          {lots.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de la tâche" style={inp} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '10px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#5b7183' }}>
          Début
          <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inp} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: '#5b7183' }}>
          Durée (jours)
          <input type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} style={inp} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          disabled={!title.trim() || !lotId}
          onClick={() => onAdd(lotId, title.trim(), start, parseInt(duration) || 1)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: 'none', background: '#018ABE', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: title.trim() && lotId ? 'pointer' : 'not-allowed', opacity: title.trim() && lotId ? 1 : 0.5 }}
        >
          <Plus size={13} /> Ajouter
        </button>
        <button onClick={onCancel} style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid #d1dbe5', background: '#fff', color: '#5b7183', fontSize: '12px', cursor: 'pointer' }}>Annuler</button>
      </div>
    </div>
  )
}

const seg = (on: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? '#02457A' : '#5b7183', boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none', whiteSpace: 'nowrap' })
