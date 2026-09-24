import { useState, useMemo, useEffect, useRef } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { GanttTask } from '../../types/gantt'
import {
  getGanttTasks, saveGanttTasks, getHolidays, getGanttPrefs, logActivity,
  getUnits, getTaskUnits, getZoneRefs, getCommitments, getCurrentProjectId,
  getProgressHistory, saveProgressHistory, getActualDateOverrides, saveActualDateOverrides,
} from '../../lib/repo'
import { Breadcrumbs, buildGanttBreadcrumbs } from '../layout/Breadcrumbs'
import { createTask, createSubTask, recomputeAll, durationBetween, setTaskDependencies } from '../../lib/planning'
import { maxDrift, lateTasks, flattenLeaves } from '../../lib/schedule'
import { applyDerivedActualDates, ActualDateField, ActualDateOverride } from '../../lib/actualDates'
import { appendProgressEntry, deriveCalculatedEntries, withGenesisEntries, isoDay } from '../../lib/progressHistory'
import { weightedProgress } from '../../lib/rollup'
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

const findTaskInList = (list: GanttTask[], id: string): GanttTask | undefined => {
  for (const t of list) {
    if (t.id === id) return t
    if (t.children?.length) { const found = findTaskInList(t.children, id); if (found) return found }
  }
  return undefined
}

function makeParent(id: string, title: string, children: GanttTask[]): GanttTask {
  const min = (f: (c: GanttTask) => number) => new Date(Math.min(...children.map(f)))
  const max = (f: (c: GanttTask) => number) => new Date(Math.max(...children.map(f)))
  const planned_start = min(c => c.planned_start.getTime())
  const planned_end = max(c => c.planned_end.getTime())
  return {
    id, lot_id: children[0]?.lot_id ?? '', title,
    planned_start, planned_end,
    // Une vraie durée (pas 0 codé en dur) : nécessaire pour que le rollup
    // pondéré de ce nœud synthétique pèse correctement dans le niveau
    // au-dessus (buildLogementTree l'appelle en cascade lot→logement→bâtiment).
    planned_duration: durationBetween(planned_start, planned_end),
    progress: weightedProgress(children),
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

  // Écriture localStorage regroupée : évite une écriture synchrone à chaque
  // frappe/drag (slider, dates) — l'état React reste à jour immédiatement,
  // seule la persistance disque est différée. Un flush au démontage garantit
  // qu'une dernière modification faite juste avant de quitter la page n'est
  // jamais perdue.
  const ganttTasksRef = useRef(ganttTasks)
  useEffect(() => { ganttTasksRef.current = ganttTasks }, [ganttTasks])
  useEffect(() => {
    const timeout = setTimeout(() => saveGanttTasks(ganttTasks), 400)
    return () => clearTimeout(timeout)
  }, [ganttTasks])
  useEffect(() => () => { saveGanttTasks(ganttTasksRef.current) }, [])

  // CPM : chemin critique + marges recalculés depuis le réseau de dépendances.
  const cpm = useMemo(() => computeCpm(ganttTasks), [ganttTasks])
  const tasksWithCpm = useMemo(() => applyCriticality(ganttTasks, cpm.criticalIds), [ganttTasks, cpm])

  const displayTasks = useMemo(
    () => group === 'logement' ? buildLogementTree(tasksWithCpm, zoneOpts, concerns) : tasksWithCpm,
    [group, tasksWithCpm, zoneOpts, concerns],
  )

  const drift = useMemo(() => maxDrift(ganttTasks), [ganttTasks])
  const lateCount = useMemo(() => lateTasks(ganttTasks, new Date()).length, [ganttTasks])

  /** Dates contractuelles (planned_start/planned_end) uniquement — les dates
   * réelles ne s'écrivent plus jamais directement sur le champ, voir
   * recordActualOverride ci-dessous.
   *
   * GUARD: Validate task ID exists before updating to prevent synthetic parent
   * IDs from being processed. */
  const handleTaskUpdate = (id: string, updates: { planned_start?: Date; planned_end?: Date }) => {
    const task = findTaskInList(ganttTasks, id)
    if (!task) {
      console.warn(`[handleTaskUpdate] Task ID not found: ${id}. Aborting date update.`)
      return
    }

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
  }

  /**
   * Saisir un avancement historise l'observation (source 'manual', datée
   * d'aujourd'hui), recale le statut, la remontée pondérée sur le lot parent
   * (avec sa propre entrée d'historique 'calculated' si son avancement en
   * découle), puis dérive les dates réelles depuis l'historique complet —
   * jamais un simple écrasement du champ.
   *
   * Lit/écrit ganttTasks directement (pas via l'updater fonctionnel de
   * setGanttTasks) pour garder les effets de bord (lecture/écriture de
   * l'historique) hors de l'updater : StrictMode invoque un updater deux fois
   * en développement, ce qui dupliquerait les entrées d'historique.
   *
   * CRITICAL BUG FIX: Validate that the task ID exists in ganttTasks before
   * modifying. This prevents synthetic parent IDs (grp-lg-*, grp-bld-*) from
   * being processed. These IDs don't exist in the actual task tree and would
   * cause mapTaskInList to silently fail, potentially causing subsequent bugs
   * if the code assumes the task was modified.
   */
  const handleProgress = (id: string, progress: number) => {
    const today = new Date()
    const before = ganttTasks

    // GUARD: Ensure task ID exists in ganttTasks before modifying
    const task = findTaskInList(before, id)
    if (!task) {
      console.warn(`[handleProgress] Task ID not found: ${id}. Aborting progress update.`)
      return
    }

    const bumped = mapTaskInList(before, id, t => ({ ...t, progress, status: deriveTaskStatus(progress, t.status) }))
    const rolledUp = recomputeAll(bumped)

    const effective_date = isoDay(today)
    // Backfill "genèse" pour tout l'arbre AVANT d'ajouter la nouvelle observation :
    // sans ça, appliquer applyDerivedActualDates à tout l'arbre effacerait les
    // dates réelles déjà stockées des tâches non historisées et non touchées ici.
    let history = withGenesisEntries(before, getProgressHistory())
    history = appendProgressEntry(history, { taskId: id, effective_date, new_progress: progress, source: 'manual' })
    history = [...history, ...deriveCalculatedEntries(before, rolledUp, { effective_date })]
    saveProgressHistory(history)

    const withActuals = applyDerivedActualDates(rolledUp, history, getActualDateOverrides())
    setGanttTasks(computeForecasts(withActuals, today, calendar))
  }

  /**
   * Correction manuelle explicite d'une date réelle (GanttDetails.tsx) : un
   * événement horodaté et append-only (ActualDateOverride), jamais un
   * écrasement direct du champ — coexiste avec la dérivation automatique par
   * l'historique (la plus récemment SAISIE des deux l'emporte, voir
   * actualDates.deriveActualDates). Aucune restriction de date future.
   *
   * GUARD: Validate task ID exists before recording override.
   */
  const recordActualOverride = (id: string, field: ActualDateField, date: Date | null) => {
    const task = findTaskInList(ganttTasks, id)
    if (!task) {
      console.warn(`[recordActualOverride] Task ID not found: ${id}. Aborting actual date override.`)
      return
    }

    const overrides: ActualDateOverride[] = [...getActualDateOverrides(), {
      id: `ov-${Date.now()}-${id}-${field}`, taskId: id, field,
      value: date ? isoDay(date) : null, at: new Date().toISOString(),
    }]
    saveActualDateOverrides(overrides)
    setGanttTasks(prev => applyDerivedActualDates(prev, withGenesisEntries(prev, getProgressHistory()), overrides))
  }

  const addTaskFromForm = (lotId: string, title: string, start: string, duration: number) => {
    const [y, m, d] = start.split('-').map(Number)
    const res = createTask(ganttTasks, lotId, { title, start: new Date(y, m - 1, d), duration: Math.max(1, duration) })
    if (res.ok) { setGanttTasks(res.tasks); saveGanttTasks(res.tasks); logActivity('planning', `Tâche ajoutée : ${title}`) }
    setAddForm(false)
  }

  const addSubTaskFromForm = (parentTaskId: string, title: string, start: string, duration: number) => {
    const task = findTaskInList(ganttTasks, parentTaskId)
    if (!task) {
      console.warn(`[addSubTaskFromForm] Parent task ID not found: ${parentTaskId}. Aborting subtask creation.`)
      return
    }

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
          cpm={cpm}
          onDelayCauseChange={(id, cause) => setGanttTasks(prev => updateTaskInList(prev, id, { delay_cause: cause }))}
          onProgress={handleProgress}
          onPlannedDates={(id, updates) => handleTaskUpdate(id, {
            ...(updates.start !== undefined ? { planned_start: updates.start } : {}),
            ...(updates.end !== undefined ? { planned_end: updates.end } : {}),
          })}
          onActualStart={(id, date) => recordActualOverride(id, 'actual_start', date)}
          onActualEnd={(id, date) => recordActualOverride(id, 'actual_end', date)}
          onDependencyAdd={(id, depId) =>
            setGanttTasks(prev => {
              const current = findTaskInList(prev, id)
              if (!current) return prev
              const deps = [...current.dependencies.filter(d => d !== depId), depId]
              // setTaskDependencies refuse toute relation qui fermerait un
              // cycle (voir planning.ts:wouldCreateCycle) — le moteur CPM ne
              // supporte pas les graphes cycliques.
              const res = setTaskDependencies(prev, id, deps)
              if (!res.ok) {
                window.alert(res.error === 'cycle_detected'
                  ? 'Impossible : cette relation créerait une boucle de dépendances (A → … → A).'
                  : 'Impossible d\'ajouter cette dépendance.')
                return prev
              }
              return res.tasks
            })
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
