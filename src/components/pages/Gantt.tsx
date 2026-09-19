import { useState, useMemo, useEffect } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { GanttTask } from '../../types/gantt'
import {
  getGanttTasks, saveGanttTasks, getHolidays, getGanttPrefs, logActivity,
  getUnits, getTaskUnits, getZoneRefs, getCommitments, getCurrentProjectId,
} from '../../lib/repo'
import { Breadcrumbs, buildGanttBreadcrumbs } from '../layout/Breadcrumbs'
import { createTask, createSubTask, recomputeAll, durationBetween } from '../../lib/planning'
import { maxDrift, lateTasks, flattenLeaves } from '../../lib/schedule'
import { withActualDates } from '../../lib/actualDates'
import { taskConcernsUnit } from '../../lib/units'
import { computeCpm, autoSchedule, applyCriticality } from '../../lib/cpm'
import { makeCalendar } from '../../lib/calendar'
import { computeForecasts } from '../../lib/forecast'
import { deriveTaskStatus } from '../../lib/planningEngine'
import LogementMatrix from '../gantt/LogementMatrix'
import { PlanningGantt } from '../gantt/v2/Gantt'

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

interface ZoneOpt { id: string; label: string; group?: string }

/**
 * Arborescence Bâtiment › Logement › Lot (mode 2 du Gantt, section 7 du
 * brief) : les mêmes tâches que le mode « Par lot », réorganisées via les
 * rattachements tâche→zone déjà saisis dans « Bâtiments & zones ». N'affiche
 * un lot dans un logement que lorsqu'il s'y applique réellement.
 */
function buildLogementTree(
  tasks: GanttTask[], zoneRefs: ZoneOpt[], concerns: (taskId: string, unitId: string) => boolean,
): GanttTask[] {
  const leaves = flattenLeaves(tasks)
  const lotTitle = new Map(tasks.map(lot => [lot.lot_id, lot.title]))

  const byBuilding = new Map<string, ZoneOpt[]>()
  for (const z of zoneRefs) {
    const building = z.group ?? 'Bâtiment'
    if (!byBuilding.has(building)) byBuilding.set(building, [])
    byBuilding.get(building)!.push(z)
  }

  const buildings: GanttTask[] = []
  for (const [building, zones] of byBuilding) {
    const logements: GanttTask[] = []
    for (const z of zones) {
      const zoneLeaves = leaves.filter(l => concerns(l.id, z.id))
      if (!zoneLeaves.length) continue
      const byLot = new Map<string, GanttTask[]>()
      for (const l of zoneLeaves) {
        const arr = byLot.get(l.lot_id) ?? []
        arr.push(l)
        byLot.set(l.lot_id, arr)
      }
      const lots = [...byLot.entries()].map(([lotId, lotLeaves]) =>
        makeParent(`grp-lg-${z.id}-${lotId}`, lotTitle.get(lotId) ?? lotId, lotLeaves))
      logements.push(makeParent(`grp-lg-${z.id}`, z.label, lots))
    }
    if (logements.length) buildings.push(makeParent(`grp-bld-${building}`, building, logements))
  }
  return buildings
}

export function Gantt() {
  const prefs0 = useMemo(() => getGanttPrefs(), [])
  const [mode, setMode] = useState<'gantt' | 'matrix'>('gantt')
  const [group, setGroup] = useState<'lot' | 'logement'>('lot')
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>(getGanttTasks)
  const [addForm, setAddForm] = useState(false)
  const commitments = useMemo(() => getCommitments(), [])
  const holidays = useMemo(() => getHolidays(), [])
  const calendar = useMemo(() => makeCalendar(holidays), [holidays])
  // Auto-planification des successeurs quand une date contractuelle bouge —
  // préférence existante, aucune bascule dans l'interface pour l'instant.
  const autoPlan = prefs0.autoSchedule

  // ── URL state sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const savedMode = params.get('ganttMode') as 'gantt' | 'matrix' | null
    if (savedMode === 'gantt' || savedMode === 'matrix') setMode(savedMode)
  }, [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (mode !== 'gantt') params.set('ganttMode', mode)
    else params.delete('ganttMode')
    const search = params.toString()
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname)
  }, [mode])

  // Zones du projet (unités) et rattachements tâche→zone, pour la vue « Par logement ».
  const units = useMemo(() => getUnits(), [])
  const links = useMemo(() => getTaskUnits(), [])
  const zoneOpts = useMemo(() => getZoneRefs().map(z => ({ id: z.refId, label: z.label, group: z.buildingLabel })), [])
  const concerns = useMemo(() => (taskId: string, unitId: string) => taskConcernsUnit(units, links, taskId, unitId), [units, links])

  useEffect(() => { saveGanttTasks(ganttTasks) }, [ganttTasks])

  // CPM : chemin critique + marges recalculés depuis le réseau de dépendances.
  const cpm = useMemo(() => computeCpm(ganttTasks), [ganttTasks])
  const tasksWithCpm = useMemo(() => applyCriticality(ganttTasks, cpm.criticalIds), [ganttTasks, cpm])

  const displayTasks = useMemo(
    () => group === 'logement' ? buildLogementTree(tasksWithCpm, zoneOpts, concerns) : tasksWithCpm,
    [group, tasksWithCpm, zoneOpts, concerns],
  )

  const drift = useMemo(() => maxDrift(ganttTasks), [ganttTasks])
  const lateCount = useMemo(() => lateTasks(ganttTasks, new Date()).length, [ganttTasks])

  const handleTaskUpdate = (id: string, updates: { planned_start?: Date; planned_end?: Date; actual_start?: Date; actual_end?: Date }) =>
    setGanttTasks(prev => {
      const moved = mapTaskInList(prev, id, t => {
        const next = { ...t, ...updates }
        if (updates.planned_start !== undefined || updates.planned_end !== undefined) {
          next.planned_duration = durationBetween(next.planned_start, next.planned_end)
        }
        return next
      })
      // Auto-schedule uniquement quand les dates contractuelles changent, pas les réelles.
      let replanned = moved
      if (autoPlan && (updates.planned_start || updates.planned_end)) {
        const { tasks, shifted } = autoSchedule(moved, calendar)
        if (shifted.length) {
          logActivity('planning', `Auto-planification : ${shifted.length} tâche${shifted.length > 1 ? 's' : ''} décalée${shifted.length > 1 ? 's' : ''} suite au déplacement`)
        }
        replanned = tasks
      }
      // La remontée sur le lot parent doit voir les nouvelles dates avant la prévision.
      const rolledUp = recomputeAll(replanned)
      return computeForecasts(rolledUp, new Date(), calendar)
    })

  /**
   * Saisir un avancement recale aussitôt le statut, les dates réelles, la
   * remontée sur le lot parent, et la prévision qui en découle — dans cet
   * ordre : la prévision doit voir l'avancement du lot déjà à jour.
   */
  const handleProgress = (id: string, progress: number) => {
    const today = new Date()
    setGanttTasks(prev => {
      const bumped = mapTaskInList(prev, id, t => ({ ...t, progress, status: deriveTaskStatus(progress, t.status) }))
      const withActual = mapTaskInList(bumped, id, t => withActualDates(t, today))
      const rolledUp = recomputeAll(withActual)
      return computeForecasts(rolledUp, today, calendar)
    })
  }

  const addTaskFromForm = (lotId: string, title: string, start: string, duration: number) => {
    const [y, m, d] = start.split('-').map(Number)
    const res = createTask(ganttTasks, lotId, { title, start: new Date(y, m - 1, d), duration: Math.max(1, duration) })
    if (res.ok) { setGanttTasks(res.tasks); saveGanttTasks(res.tasks); logActivity('planning', `Tâche ajoutée : ${title}`) }
    setAddForm(false)
  }

  const addSubTaskFromForm = (parentTaskId: string, title: string, start: string, duration: number) => {
    const [y, m, d] = start.split('-').map(Number)
    const res = createSubTask(ganttTasks, parentTaskId, { title, start: new Date(y, m - 1, d), duration: Math.max(1, duration) })
    if (res.ok) { setGanttTasks(res.tasks); saveGanttTasks(res.tasks); logActivity('planning', `Sous-tâche ajoutée : ${title}`) }
  }

  return (
    <div style={{ padding: '12px', paddingBottom: '80px' }}>
      <Breadcrumbs crumbs={buildGanttBreadcrumbs(mode, group)} />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#eef2f6', padding: '3px', borderRadius: '8px' }}>
          {(['gantt', 'matrix'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={seg(mode === m)}>{m === 'gantt' ? 'Gantt' : 'Damier'}</button>
          ))}
        </div>
        {mode === 'gantt' && (
          <>
            <div style={{ display: 'flex', gap: '4px', background: '#eef2f6', padding: '3px', borderRadius: '8px' }}>
              {(['lot', 'logement'] as const).map(g => (
                <button key={g} onClick={() => setGroup(g)} style={seg(group === g)}>{g === 'lot' ? 'Par lot' : 'Par logement'}</button>
              ))}
            </div>
            <button
              onClick={() => setAddForm(a => !a)}
              title="Ajouter une tâche au planning"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              <Plus size={14} /> Tâche
            </button>
          </>
        )}
      </div>

      {(drift > 0 || lateCount > 0) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {drift > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bad-bg)', color: 'var(--bad)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
              <AlertTriangle size={14} />Dérive max : +{drift} j vs contractuel
            </span>
          )}
          {lateCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--warn-bg)', color: 'var(--warn)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
              {lateCount} tâche{lateCount > 1 ? 's' : ''} en retard
            </span>
          )}
        </div>
      )}

      {addForm && mode === 'gantt' && (
        <AddTaskForm
          lots={ganttTasks.map(t => ({ id: t.id, label: t.title }))}
          onAdd={addTaskFromForm}
          onCancel={() => setAddForm(false)}
        />
      )}

      {mode === 'matrix' ? (
        <LogementMatrix tasks={ganttTasks} />
      ) : (
        <PlanningGantt
          tasks={displayTasks}
          commitments={commitments}
          operationId={getCurrentProjectId() ?? 'current'}
          onDelayCauseChange={(id, cause) => setGanttTasks(prev => updateTaskInList(prev, id, { delay_cause: cause }))}
          onProgress={handleProgress}
          onPlannedDates={(id, updates) => handleTaskUpdate(id, {
            ...(updates.start !== undefined ? { planned_start: updates.start } : {}),
            ...(updates.end !== undefined ? { planned_end: updates.end } : {}),
          })}
          onActualStart={(id, date) => handleTaskUpdate(id, { actual_start: date ?? undefined })}
          onActualEnd={(id, date) => handleTaskUpdate(id, { actual_end: date ?? undefined })}
          onDependencyAdd={(id, depId) =>
            setGanttTasks(prev => mapTaskInList(prev, id, t => ({ ...t, dependencies: [...t.dependencies.filter(d => d !== depId), depId] })))
          }
          onDependencyRemove={(id, depId) =>
            setGanttTasks(prev => mapTaskInList(prev, id, t => ({ ...t, dependencies: t.dependencies.filter(d => d !== depId) })))
          }
          onSubTaskAdd={addSubTaskFromForm}
        />
      )}
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
