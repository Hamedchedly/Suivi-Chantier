import { useMemo, useState, type FormEvent } from 'react'
import {
  addProgress,
  createObservation,
  createObservationEvent,
  effectiveAssignments,
  lastProgressForUnit,
  listObservationEvents,
  listObservationsByOperation,
  listTasksByOperation,
  startVisit,
  updateObservationStatus
} from '../lib/data'
import { latestByTask, progressAverage, type ProgressRow } from '../lib/progress'
import {
  OBSERVATION_STATUS_OPTIONS,
  buildObservationEventInsert,
  buildObservationInsert,
  buildObservationViews,
  observationsForLocation,
  type ObservationView
} from '../lib/observations'
import { filterApplicableTasks } from '../lib/scope'
import type { Lot, Task, Unit } from '../lib/types'

type Props = { operationId: string; units: Unit[]; lots: Lot[]; onOpenTask?: (taskId: string, unitId: string | null) => void; onOpenObservation?: (observationId: string, context: { taskId: string | null; unitId: string | null; origin: 'task' | 'visit' }) => void }

interface TaskDraft { percentage: number; status: string; comment: string }

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Non commencé' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done', label: 'Terminé' },
  { value: 'blocked', label: 'Bloqué' },
  { value: 'postponed', label: 'Reporté' },
  { value: 'not_applicable', label: 'Non applicable' }
]

const QUICK_PERCENTAGES = [0, 25, 50, 75, 100]
const emptyDraft = (): TaskDraft => ({ percentage: 0, status: 'not_started', comment: '' })
const autoStatus = (percentage: number): string => percentage >= 100 ? 'done' : percentage > 0 ? 'in_progress' : 'not_started'
const formatPercent = (value: number | null | undefined): string => value === null || value === undefined ? '—' : `${Math.round(value)} %`
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('fr-FR')

export function VisitForm({ operationId, units, lots, onOpenTask, onOpenObservation }: Props) {
  const [unitId, setUnitId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [visitId, setVisitId] = useState<string | null>(null)
  const [effective, setEffective] = useState<{ lot_id: string; enabled: boolean }[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [history, setHistory] = useState<ProgressRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [unitObservations, setUnitObservations] = useState<ObservationView[]>([])
  const [obsFormOpen, setObsFormOpen] = useState(false)
  const [obsContent, setObsContent] = useState('')
  const [obsLotId, setObsLotId] = useState('')
  const [obsTaskId, setObsTaskId] = useState('')
  const [obsStatus, setObsStatus] = useState('new')
  const [obsDueDate, setObsDueDate] = useState('')
  const [obsSaving, setObsSaving] = useState(false)

  const buildings = units.filter((unit) => unit.kind === 'building')
  const standalone = units.filter((unit) => unit.kind === 'common_area' || unit.kind === 'exterior' || unit.kind === 'zone')
  const childrenOf = (building: Unit): Unit[] => units.filter((unit) => unit.parent_id === building.id && unit.kind === 'dwelling')

  const applicableLots = useMemo(() => {
    const enabled = new Set(effective.filter((entry) => entry.enabled).map((entry) => entry.lot_id))
    return lots.filter((lot) => enabled.has(lot.id))
  }, [lots, effective])
  const applicableLotIds = useMemo(() => new Set(applicableLots.map((lot) => lot.id)), [applicableLots])

  const latestByTaskId = useMemo(() => latestByTask(history), [history])

  const tasksForUnit = useMemo(
    () => filterApplicableTasks(tasks.filter((task) => applicableLotIds.has(task.lot_id)), unitId, units),
    [tasks, unitId, units, applicableLotIds]
  )
  const tasksByLot = useMemo(() => {
    const grouped = new Map<string, Task[]>()
    for (const task of tasksForUnit) {
      const list = grouped.get(task.lot_id) ?? []
      list.push(task)
      grouped.set(task.lot_id, list)
    }
    return grouped
  }, [tasksForUnit])

  const selectedUnit = units.find((unit) => unit.id === unitId)

  const draftOf = (state: Record<string, TaskDraft>, taskId: string): TaskDraft => state[taskId] ?? emptyDraft()

  const setDraft = (taskId: string, patch: Partial<TaskDraft>) =>
    setDrafts((previous) => ({ ...previous, [taskId]: { ...draftOf(previous, taskId), ...patch } }))

  async function reloadObservations(id: string) {
    const allObservations = await listObservationsByOperation(operationId)
    const scoped = observationsForLocation(allObservations, id)
    const events = scoped.length ? await listObservationEvents(scoped.map((observation) => observation.id)) : []
    setUnitObservations(buildObservationViews(scoped, events))
  }

  const obsTaskOptions = useMemo(
    () => (obsLotId ? tasks.filter((task) => task.lot_id === obsLotId && task.task_type === 'item') : []),
    [obsLotId, tasks]
  )

  const lotLabel = (lotId: string | null): string => {
    if (!lotId) return ''
    const lot = lots.find((candidate) => candidate.id === lotId)
    return lot ? `${lot.number ?? lot.code ?? ''} ${lot.name}`.trim() : ''
  }

  async function submitObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!unitId || !obsContent.trim()) return
    setObsSaving(true)
    try {
      const activeVisit = await ensureVisit()
      const created = await createObservation(buildObservationInsert(operationId, {
        title: obsContent.trim(),
        unit_id: unitId,
        lot_id: obsLotId || null,
        task_id: obsTaskId || null,
        status: obsStatus,
        due_date: obsDueDate || null
      }))
      await createObservationEvent(buildObservationEventInsert({ observation_id: created.id, visit_id: activeVisit, status: obsStatus, note: obsContent.trim() }))
      await reloadObservations(unitId)
      setObsContent('')
      setObsLotId('')
      setObsTaskId('')
      setObsStatus('new')
      setObsDueDate('')
      setObsFormOpen(false)
      setMessage('Observation enregistrée.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setObsSaving(false)
    }
  }

  async function changeObservationStatus(observation: ObservationView, status: string) {
    if (!unitId) return
    try {
      const activeVisit = await ensureVisit()
      await updateObservationStatus(operationId, observation.id, status)
      await createObservationEvent(buildObservationEventInsert({ observation_id: observation.id, visit_id: activeVisit, status }))
      await reloadObservations(unitId)
      setMessage('Statut de l’observation mis à jour.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mise à jour impossible.')
    }
  }

  async function changeUnit(id: string) {
    setUnitId(id)
    setTasks([])
    setEffective([])
    setHistory([])
    setSaved({})
    setUnitObservations([])
    if (!id) return
    setLoading(true)
    try {
      const assigned = await effectiveAssignments(id)
      setEffective(assigned)
      const operationTasks = await listTasksByOperation(operationId)
      const rows = await lastProgressForUnit(operationId, id)
      setTasks(operationTasks)
      setHistory(rows)
      await reloadObservations(id)
      const defaults: Record<string, TaskDraft> = {}
      for (const task of operationTasks) {
        const row = latestByTask(rows).get(task.id)
        defaults[task.id] = {
          percentage: row?.percentage ?? 0,
          status: row ? row.status ?? autoStatus(row.percentage ?? 0) : 'not_started',
          comment: ''
        }
      }
      setDrafts(defaults)
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }

  async function ensureVisit(): Promise<string> {
    if (visitId) return visitId
    const visit = await startVisit(operationId, { title: title.trim() || null, note: null })
    setVisitId(visit.id)
    return visit.id
  }

  async function saveRow(draftKey: string, lotId: string, label: string, taskId: string | null) {
    if (!unitId) return
    setSaving(true)
    try {
      const draft = draftOf(drafts, draftKey)
      const activeVisit = await ensureVisit()
      await addProgress(operationId, activeVisit, unitId, lotId, taskId, draft.percentage, draft.status, draft.comment.trim())
      const rows = await lastProgressForUnit(operationId, unitId)
      setHistory(rows)
      setSaved((previous) => ({ ...previous, [draftKey]: true }))
      const statusLabel = STATUS_OPTIONS.find((option) => option.value === draft.status)?.label ?? draft.status
      setMessage(`${label} : ${formatPercent(draft.percentage)} (${statusLabel}) enregistré.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  function lotProgress(lotId: string): number | null {
    const items = (tasksByLot.get(lotId) ?? []).filter((task) => task.task_type === 'item')
    return progressAverage(
      items.map((task) => {
        const row = latestByTaskId.get(task.id)
        return { percentage: row?.percentage ?? null, status: row?.status ?? 'not_started', quantity: task.quantity, amount: task.amount }
      }),
      'simple'
    )
  }

  return (
    <section className="stack">
      <h2>Visite</h2>
      {message && <p className="notice">{message}</p>}
      {loading && <p className="notice">Chargement…</p>}

      {!unitId ? (
        <>
          <p>Choisissez la localisation visitée.</p>
          {buildings.map((building) => {
            const children = childrenOf(building)
            return (
              <div key={building.id}>
                <h3>{building.code ?? ''} {building.name}</h3>
                {children.length === 0 && <p className="notice">Aucun logement dans ce bâtiment.</p>}
                {children.map((unit) => (
                  <button key={unit.id} type="button" className="card" onClick={() => void changeUnit(unit.id)}>
                    <strong>{unit.code ?? ''} {unit.name}</strong>
                    <span>{building.name}{unit.floor ? ` · ${unit.floor}` : ''}</span>
                  </button>
                ))}
              </div>
            )
          })}
          {standalone.length > 0 && (
            <div>
              <h3>Parties communes et extérieurs</h3>
              {standalone.map((unit) => (
                <button key={unit.id} type="button" className="card" onClick={() => void changeUnit(unit.id)}>
                  <strong>{unit.code ?? ''} {unit.name}</strong>
                  <span>Localisation directe</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="panel">
            <p className="eyebrow">Localisation visitée</p>
            <h3>{selectedUnit?.code ?? ''} {selectedUnit?.name}</h3>
            <p>
              {selectedUnit?.parent_id
                ? `${buildings.find((building) => building.id === selectedUnit?.parent_id)?.name ?? ''}${selectedUnit?.floor ? ` · ${selectedUnit.floor}` : ''}`
                : 'Localisation directe'}
            </p>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Objet de la visite (facultatif)"/>
            <button type="button" className="link" onClick={() => void changeUnit('')}>← Changer de localisation</button>
          </div>

          <div className="panel">
            <div className="row">
              <h3>Observations ({unitObservations.length})</h3>
              <button type="button" className="mini" onClick={() => setObsFormOpen((open) => !open)}>{obsFormOpen ? 'Fermer' : '+ Ajouter une observation'}</button>
            </div>
            {obsFormOpen && (
              <form className="form-grid" onSubmit={(event) => void submitObservation(event)}>
                <label>Description<textarea required value={obsContent} onChange={(event) => setObsContent(event.target.value)} placeholder="Contenu de l’observation"/></label>
                <label>Lot<select value={obsLotId} onChange={(event) => { setObsLotId(event.target.value); setObsTaskId('') }}>
                  <option value="">Aucun lot</option>
                  {applicableLots.map((lot) => <option key={lot.id} value={lot.id}>{lot.number ?? lot.code ?? ''} {lot.name}</option>)}
                </select></label>
                <label>Tâche<select value={obsTaskId} onChange={(event) => setObsTaskId(event.target.value)} disabled={!obsLotId}>
                  <option value="">Aucune tâche</option>
                  {obsTaskOptions.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}
                </select></label>
                <label>Statut<select value={obsStatus} onChange={(event) => setObsStatus(event.target.value)}>
                  {OBSERVATION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select></label>
                <label>Échéance<input type="date" value={obsDueDate} onChange={(event) => setObsDueDate(event.target.value)}/></label>
                <button disabled={obsSaving || !obsContent.trim()}>{obsSaving ? 'Enregistrement…' : 'Enregistrer l’observation'}</button>
                <p className="muted">Photos : bouton prévu — stockage/annotation traités dans une étape dédiée (pas de base64 en base).</p>
              </form>
            )}
            {unitObservations.length === 0
              ? <p className="notice">Aucune observation pour cette localisation.</p>
              : (
                <ul className="history">
                  {unitObservations.map((view) => (
                    <li key={view.id} className="history-entry">
                      <span className="history-date">{formatDate(view.date)}</span>
                      <p>{view.content}</p>
                      <p className="muted">{view.lotId ? lotLabel(view.lotId) : ''}{view.visitId ? ' · liée à la visite' : ''}{view.createdBy ? ` · par ${view.createdBy.slice(0, 8)}` : ''}</p>
                      <div className="row">
                        <select value={view.status ?? 'new'} onChange={(event) => void changeObservationStatus(view, event.target.value)} aria-label="Statut de l’observation">
                          {OBSERVATION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        {onOpenObservation && <button type="button" className="link" onClick={() => onOpenObservation(view.id, { taskId: view.taskId, unitId, origin: 'visit' })}>Fiche observation</button>}
                        {view.taskId && onOpenTask && <button type="button" className="link" onClick={() => onOpenTask(view.taskId as string, unitId)}>Fiche tâche</button>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </div>

          {applicableLots.length === 0 && <p className="notice">Aucun lot applicable à cette localisation.</p>}
          {applicableLots.map((lot) => {
            const lotTasks = tasksByLot.get(lot.id) ?? []
            const progress = lotProgress(lot.id)
            const hasItems = lotTasks.some((task) => task.task_type === 'item')
            return (
              <div key={lot.id} className="panel">
                <h3>{lot.number ?? lot.code ?? ''} — {lot.name} <span className="metric">{formatPercent(progress)}</span></h3>
                {lotTasks.length === 0 && <p className="notice">Aucune tâche DPGF configurée pour ce lot.</p>}
                {lotTasks.map((task) =>
                  task.task_type === 'section' ? (
                    <h4 key={task.id}>{task.name}</h4>
                  ) : (
                    <ProgressCard
                      key={task.id}
                      task={task}
                      draft={draftOf(drafts, task.id)}
                      last={latestByTaskId.get(task.id)}
                      saving={saving}
                      saved={Boolean(saved[task.id])}
                      onDraft={(patch) => setDraft(task.id, patch)}
                      onSave={() => void saveRow(task.id, task.lot_id, task.name, task.id)}
                      onOpenTask={onOpenTask ? () => onOpenTask(task.id, unitId) : undefined}
                    />
                  )
                )}
                {!hasItems && (
                  <LegacyLotCard
                    lotLabel={`${lot.number ?? lot.code ?? ''} ${lot.name}`}
                    draft={draftOf(drafts, `lot:${lot.id}`)}
                    saving={saving}
                    saved={Boolean(saved[`lot:${lot.id}`])}
                    onDraft={(patch) => setDraft(`lot:${lot.id}`, patch)}
                    onSave={() => void saveRow(`lot:${lot.id}`, lot.id, `${lot.number ?? lot.code ?? ''} ${lot.name}`, null)}
                  />
                )}
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}

function Controls(props: { draft: TaskDraft; saving: boolean; saved: boolean; onDraft: (patch: Partial<TaskDraft>) => void; onSave: () => void }) {
  const { draft, saving, saved, onDraft, onSave } = props
  return (
    <div className="visit-controls">
      <div className="chips">
        {QUICK_PERCENTAGES.map((percentage) => (
          <button key={percentage} type="button" className={draft.percentage === percentage ? 'mini active' : 'mini'} onClick={() => onDraft({ percentage })}>{percentage}%</button>
        ))}
      </div>
      <div className="slider-row">
        <input type="range" min={0} max={100} step={5} value={draft.percentage} onChange={(event) => onDraft({ percentage: Number(event.target.value) })} aria-label="Avancement"/>
        <strong>{formatPercent(draft.percentage)}</strong>
      </div>
      <select value={draft.status} onChange={(event) => onDraft({ status: event.target.value })}>
        {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <input value={draft.comment} onChange={(event) => onDraft({ comment: event.target.value })} placeholder="Note (ex. : reste le local technique…)"/>
      <button type="button" disabled={saving} onClick={onSave}>{saved ? '✓ Enregistré' : 'Enregistrer l’avancement'}</button>
    </div>
  )
}

function ProgressCard(props: { task: Task; draft: TaskDraft; last: ProgressRow | undefined; saving: boolean; saved: boolean; onDraft: (patch: Partial<TaskDraft>) => void; onSave: () => void; onOpenTask?: () => void }) {
  const { task, last, onOpenTask, ...controls } = props
  return (
    <div className="task-entry">
      <div className="task-line">
        <strong>{task.name}</strong>
        {task.reference ? <span className="muted"> ({task.reference})</span> : null}
      </div>
      {last
        ? <p className="last-line">Dernière visite : {formatDate(last.progressed_at)} · {formatPercent(last.percentage)}{last.comment ? ` · « ${last.comment} »` : ''}</p>
        : <p className="last-line muted">Nouvelle tâche suivie</p>}
      <Controls {...controls} />
      {onOpenTask && <button type="button" className="link" onClick={onOpenTask}>Voir l’historique</button>}
    </div>
  )
}

function LegacyLotCard(props: { lotLabel: string; draft: TaskDraft; saving: boolean; saved: boolean; onDraft: (patch: Partial<TaskDraft>) => void; onSave: () => void }) {
  const { lotLabel, ...controls } = props
  return (
    <div className="task-entry">
      <div className="task-line">
        <strong>Saisie par lot — {lotLabel}</strong>
      </div>
      <p className="last-line muted">Avancement global du lot (sans découpage en tâches).</p>
      <Controls {...controls} />
    </div>
  )
}