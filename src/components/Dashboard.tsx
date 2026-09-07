import { useEffect, useMemo, useState } from 'react'
import { listObservationEvents, listObservationsByOperation, listProgressByOperation, listTasksByOperation } from '../lib/data'
import { evolution, filterHistoryRows, itemPoints, latestPerTask, latestPerTaskAndUnit, metricsFromPoints, type ScopeMetrics } from '../lib/dashboard'
import { buildObservationViews, filterObservationViewsByUnit, observationsForTask, observationStatusLabel, type ObservationView } from '../lib/observations'
import { filterApplicableTasks } from '../lib/scope'
import type { Lot, Operation, ProgressEntry, Task, Unit } from '../lib/types'

type Props = {
  operation: Operation
  units: Unit[]
  lots: Lot[]
  initialTaskId?: string | null
  initialUnitId?: string | null
  onExitHistory?: () => void
  onOpenObservation?: (observationId: string, context: { taskId: string | null; unitId: string | null; origin: 'task' | 'visit' }) => void
}

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'blocked', label: 'Bloqué' },
  { value: 'postponed', label: 'Reporté' },
  { value: 'done', label: 'Terminé' },
  { value: 'not_started', label: 'Non commencé' }
]

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.filter((option) => option.value !== '').map((option) => [option.value, option.label])
)

const formatPercent = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : `${Math.round(value)} %`

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('fr-FR')

export function Dashboard({ operation, units, lots, initialTaskId = null, initialUnitId = null, onExitHistory, onOpenObservation }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<ProgressEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lotFilter, setLotFilter] = useState('')
  const [buildingFilter, setBuildingFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [locationFilter, setLocationFilter] = useState(initialUnitId ?? '')
  const [observationViews, setObservationViews] = useState<ObservationView[]>([])
  const [observationsLoading, setObservationsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const [operationTasks, operationEntries] = await Promise.all([
          listTasksByOperation(operation.id),
          listProgressByOperation(operation.id)
        ])
        if (cancelled) return
        setTasks(operationTasks)
        setEntries(operationEntries)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [operation.id])

  const latestOp = useMemo(() => latestPerTask(entries), [entries])
  const latestPerUnit = useMemo(() => latestPerTaskAndUnit(entries), [entries])
  const buildings = useMemo(() => units.filter((unit) => unit.kind === 'building'), [units])
  const unitName = (unitId: string | null): string => {
    const unit = units.find((candidate) => candidate.id === unitId)
    return unit ? `${unit.code ?? ''} ${unit.name}`.trim() : '—'
  }

  const globalPoints = useMemo(
    () => itemPoints(tasks.filter((task) => lots.some((lot) => lot.id === task.lot_id)), (taskId) => latestOp.get(taskId)),
    [tasks, lots, latestOp]
  )
  const globalMetrics = useMemo(() => metricsFromPoints(globalPoints), [globalPoints])

  const visibleLots = useMemo(
    () => lots.filter((lot) => !lotFilter || lot.id === lotFilter).sort((a, b) => a.sort_order - b.sort_order),
    [lots, lotFilter]
  )

  const unitContext = useMemo(() => {
    const map = new Map<string, { points: ReturnType<typeof itemPoints>; metrics: ScopeMetrics }>()
    for (const unit of units) {
      const applicable = filterApplicableTasks(tasks, unit.id, units).filter((task) => task.task_type === 'item')
      const points = itemPoints(applicable, (taskId) => latestPerUnit.get(`${taskId}|${unit.id}`))
      map.set(unit.id, { points, metrics: metricsFromPoints(points) })
    }
    return map
  }, [tasks, units, latestPerUnit])

  const buildingCards = useMemo(
    () =>
      buildings
        .filter((building) => !buildingFilter || building.id === buildingFilter)
        .map((building) => {
          const children = units.filter((unit) => unit.parent_id === building.id)
          const rolls = children.map((unit) => ({ unit, context: unitContext.get(unit.id) }))
          const tracked = rolls.filter((roll) => roll.context && roll.context.metrics.tracked > 0)
          const averages = tracked
            .map((roll) => roll.context?.metrics.average)
            .filter((value): value is number => typeof value === 'number')
          const average = averages.length ? averages.reduce((sum, value) => sum + value, 0) / averages.length : null
          return { building, rolls, average }
        }),
    [buildings, buildingFilter, units, unitContext]
  )

  const lotCards = useMemo(
    () =>
      visibleLots.map((lot) => {
        const lotTasks = tasks.filter((task) => task.lot_id === lot.id)
        const points = itemPoints(lotTasks, (taskId) => latestOp.get(taskId))
        const metrics = metricsFromPoints(points)
        const items = lotTasks
          .filter((task) => task.task_type === 'item' && (!statusFilter || latestOp.get(task.id)?.status === statusFilter))
          .sort((a, b) => a.sort_order - b.sort_order)
        return { lot, metrics, items }
      }),
    [visibleLots, tasks, latestOp, statusFilter]
  )

  const lotOptions = [...lots].sort((a, b) => a.sort_order - b.sort_order)

  const taskHistory = useMemo(() => {
    if (!selectedTask) return []
    return entries
      .filter((entry) => entry.task_id === selectedTask.id)
      .sort((a, b) => a.progressed_at.localeCompare(b.progressed_at) || a.created_at.localeCompare(b.created_at))
  }, [selectedTask, entries])

  const filteredHistory = useMemo(
    () => filterHistoryRows(taskHistory, locationFilter || null),
    [taskHistory, locationFilter]
  )

  const seriesEvolution = useMemo(
    () => (selectedTask ? evolution(filteredHistory) : { latest: null, previous: null, deltaPoints: null, direction: 'none' as const, first: false }),
    [selectedTask, filteredHistory]
  )

  const historyLocations = useMemo(() => {
    const ids = new Set(taskHistory.map((row) => row.unit_id).filter((id): id is string => id !== null))
    return units.filter((unit) => ids.has(unit.id))
  }, [taskHistory, units])

  useEffect(() => {
    if (!initialTaskId || selectedTask || tasks.length === 0) return
    const found = tasks.find((task) => task.id === initialTaskId)
    if (found) {
      setSelectedTask(found)
      setLocationFilter(initialUnitId ?? '')
    }
  }, [tasks, initialTaskId, initialUnitId, selectedTask])

  useEffect(() => {
    if (!selectedTask) {
      setObservationViews([])
      return
    }
    let cancelled = false
    setObservationsLoading(true)
    void (async () => {
      try {
        const observations = observationsForTask(await listObservationsByOperation(operation.id), selectedTask.id, selectedTask.lot_id)
        const events = await listObservationEvents(observations.map((observation) => observation.id))
        if (!cancelled) setObservationViews(buildObservationViews(observations, events))
      } catch {
        if (!cancelled) setObservationViews([])
      } finally {
        if (!cancelled) setObservationsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [selectedTask, operation.id])

  const filteredObservations = useMemo(
    () => filterObservationViewsByUnit(observationViews, locationFilter || null),
    [observationViews, locationFilter]
  )

  const lotName = (lotId: string): string => lots.find((lot) => lot.id === lotId)?.name ?? ''
  const taskScopeLabel = (task: Task): string =>
    task.unit_id ? `Localisée — ${unitName(task.unit_id)}` : 'Générale au lot'

  if (loading) {
    return <section className="stack"><p className="eyebrow">{operation.name}</p><h2>Tableau de bord</h2><p className="notice">Chargement…</p></section>
  }
  if (error) {
    return <section className="stack"><p className="eyebrow">{operation.name}</p><h2>Tableau de bord</h2><p className="notice error">{error}</p></section>
  }
  if (selectedTask) {
    const latest = seriesEvolution.latest
    const onBack = onExitHistory ?? (() => setSelectedTask(null))
    return (
      <section className="stack">
        <p className="eyebrow">{operation.name}</p>
        <h2>Historique de la tâche</h2>
        <button type="button" className="link" onClick={onBack}>← Retour</button>
        <div className="panel">
          <p className="eyebrow">{lotName(selectedTask.lot_id)}</p>
          <h3>{selectedTask.name}{selectedTask.reference ? ` (${selectedTask.reference})` : ''}</h3>
          <p className="muted">{taskScopeLabel(selectedTask)}</p>
          <div className="filters">
            <label>Localisation<select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
              <option value="">Toutes les localisations</option>
              {historyLocations.map((unit) => <option key={unit.id} value={unit.id}>{unit.code ?? ''} {unit.name}</option>)}
            </select></label>
          </div>
          {filteredHistory.length === 0
            ? <p className="notice">Aucune progression enregistrée pour cette tâche et cette localisation.</p>
            : latest && (
              <>
                <dl className="kv">
                  <dt>Dernière visite</dt><dd>{formatDate(latest.progressed_at)}</dd>
                  <dt>Avancement</dt><dd>{formatPercent(latest.percentage)}</dd>
                  <dt>Statut</dt><dd>{latest.status ? STATUS_LABEL[latest.status] ?? latest.status : '—'}</dd>
                </dl>
                {latest.comment && <div className="note-block"><h4>NOTE DE PROGRESSION</h4><p>« {latest.comment} »</p></div>}
              </>
            )}
          {filteredHistory.length > 0 && (
            seriesEvolution.first
              ? <p className="muted">Première saisie.</p>
              : seriesEvolution.latest && seriesEvolution.previous && seriesEvolution.latest.percentage !== null && seriesEvolution.previous.percentage !== null
                ? <p className={seriesEvolution.direction === 'down' ? 'delta down' : 'delta'}>
                    {formatPercent(seriesEvolution.previous.percentage)} → {formatPercent(seriesEvolution.latest.percentage)}
                    {seriesEvolution.direction === 'up' ? ` · +${seriesEvolution.deltaPoints} points` : seriesEvolution.direction === 'down' ? ` · Baisse de ${-seriesEvolution.deltaPoints!} points` : ' · inchangé'}
                  </p>
                : <p className="muted">Progression non chiffrée sur la dernière visite.</p>
          )}
        </div>
        <h3>Historique ({filteredHistory.length})</h3>
        <ul className="history">
          {filteredHistory.map((row) => (
            <li key={row.id} className="history-entry">
              <span className="history-date">{formatDate(row.progressed_at)}</span>
              <strong>{formatPercent(row.percentage)}</strong>
              <span>{row.status ? STATUS_LABEL[row.status] ?? row.status : '—'}</span>
              {row.comment && <p className="note">« {row.comment} »</p>}
              <p className="muted">Localisation : {unitName(row.unit_id)}{row.created_by ? ` · par ${row.created_by.slice(0, 8)}` : ''}</p>
            </li>
          ))}
        </ul>
        <h3>Observations ({filteredObservations.length})</h3>
        {observationsLoading && <p className="notice">Chargement…</p>}
        {!observationsLoading && filteredObservations.length === 0 && <p className="notice">Aucune observation enregistrée pour cette tâche.</p>}
        <ul className="history">
          {filteredObservations.map((view) => (
            <li key={view.id} className="history-entry">
              <span className="history-date">{formatDate(view.date)}</span>
              <strong>{observationStatusLabel(view.status)}</strong>
              <p>{view.content}</p>
              <p className="muted">Localisation : {unitName(view.unitId)}{view.visitId ? ' · liée à une visite' : ''}{view.createdBy ? ` · par ${view.createdBy.slice(0, 8)}` : ''}</p>
              {onOpenObservation && (
                <div className="row">
                  <button type="button" className="link" onClick={() => onOpenObservation(view.id, { taskId: view.taskId, unitId: locationFilter || null, origin: 'task' })}>Fiche observation</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className="stack">
      <p className="eyebrow">{operation.name}</p>
      <h2>Tableau de bord</h2>

      <div className="panel big">
        <h3>Avancement global</h3>
        <p className="metric big-number">{globalMetrics.average === null ? 'Non suivie' : formatPercent(globalMetrics.average)}</p>
        <Bar value={globalMetrics.average} />
        <p className="muted">
          {globalMetrics.tracked}/{globalMetrics.total} tâches suivies · {globalMetrics.done} terminées · {globalMetrics.blocked} bloquées
          {globalMetrics.untracked > 0 ? ` · ${globalMetrics.untracked} non suivies` : ''}
        </p>
      </div>

      <div className="filters">
        <select value={lotFilter} onChange={(event) => setLotFilter(event.target.value)} aria-label="Filtre lot">
          <option value="">Tous les lots</option>
          {lotOptions.map((lot) => <option key={lot.id} value={lot.id}>{lot.number ?? lot.code ?? ''} {lot.name}</option>)}
        </select>
        <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)} aria-label="Filtre bâtiment">
          <option value="">Tous les bâtiments</option>
          {buildings.map((building) => <option key={building.id} value={building.id}>{building.code ?? ''} {building.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtre statut">
          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <h3>Lots</h3>
      {lotCards.length === 0 && <p className="notice">Aucun lot{lotFilter ? ' pour ce filtre' : ''}.</p>}
      {lotCards.map(({ lot, metrics, items }) => (
        <details key={lot.id} className="panel">
          <summary>
            <strong>{lot.number ?? lot.code ?? ''} — {lot.name}</strong>
            <span>{metrics.average === null ? 'Non suivie' : formatPercent(metrics.average)}</span>
          </summary>
          <Bar value={metrics.average} />
          <p className="muted">
            {metrics.total} tâche(s) · {metrics.started} commencée(s) · {metrics.done} terminée(s) · {metrics.blocked} bloquée(s)
            {metrics.untracked > 0 ? ` · ${metrics.untracked} non suivie(s)` : ''}
          </p>
          {items.length > 0 && (
            <ul className="task-list">
              {items.map((item) => {
                const snapshot = latestOp.get(item.id)
                return (
                  <li key={item.id}>
                    <button type="button" className="task-link" onClick={() => setSelectedTask(item)}>
                      <span>{item.name}</span>
                      <span className={snapshot?.status === 'blocked' ? 'status-blocked' : ''}>{formatPercent(snapshot?.percentage)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {items.length === 0 && <p className="muted">Aucune tâche correspondant au filtre de statut.</p>}
        </details>
      ))}

      <h3>Bâtiments</h3>
      {buildingCards.length === 0 && <p className="notice">Aucun bâtiment{buildingFilter ? ' pour ce filtre' : ''}.</p>}
      {buildingCards.map(({ building, rolls, average }) => (
        <details key={building.id} className="panel">
          <summary>
            <strong>{building.code ?? ''} {building.name}</strong>
            <span>{average === null ? 'Non suivie' : formatPercent(average)}</span>
          </summary>
          <Bar value={average} />
          <ul className="task-list">
            {rolls.map(({ unit, context }) => (
              <li key={unit.id}>
                <span className="task-link">
                  <span>{unit.code ?? ''} {unit.name}{unit.floor ? ` · ${unit.floor}` : ''}</span>
                  <span>{context && context.metrics.tracked > 0 ? formatPercent(context.metrics.average) : 'Non suivie'}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}

      {globalMetrics.total === 0 && <p className="notice">Aucune donnée de progression — créez une visite puis renseignez l’avancement des tâches.</p>}
    </section>
  )
}

function Bar({ value }: { value: number | null }) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value))
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(width)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill" style={{ width: `${width}%` }} />
    </div>
  )
}