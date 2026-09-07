import { useEffect, useMemo, useState } from 'react'
import {
  createObservationEvent,
  getObservation,
  listObservationEvents,
  listObservationHistory,
  listOperationMembers,
  listTasksByOperation,
  updateObservation,
  updateObservationStatus
} from '../lib/data'
import {
  OBSERVATION_PRIORITY_OPTIONS,
  OBSERVATION_STATUS_OPTIONS,
  buildObservationEventInsert,
  buildTimeline,
  dueDateLabel,
  dueDateState,
  observationPriorityLabel,
  observationStatusLabel,
  shortUser
} from '../lib/observations'
import type { Lot, Observation, ObservationEvent, ObservationHistory, OperationMember, Task, Unit } from '../lib/types'

type Props = {
  operationId: string
  observationId: string
  units: Unit[]
  lots: Lot[]
  onBack: () => void
}

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('fr-FR')
const todayString = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const ACTION_LABEL: Record<string, string> = {
  INSERT: 'Création (audit automatique)',
  UPDATE: 'Modification (audit automatique)'
}

export function ObservationDetail({ operationId, observationId, units, lots, onBack }: Props) {
  const [observation, setObservation] = useState<Observation | null>(null)
  const [events, setEvents] = useState<ObservationEvent[]>([])
  const [auditRows, setAuditRows] = useState<ObservationHistory[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<OperationMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDetail, setEditDetail] = useState('')
  const [editPriority, setEditPriority] = useState('normal')
  const [editDue, setEditDue] = useState('')
  const [newStatus, setNewStatus] = useState('new')
  const [statusNote, setStatusNote] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const [found, history, operationTasks, operationMembers] = await Promise.all([
          getObservation(operationId, observationId),
          listObservationHistory(observationId),
          listTasksByOperation(operationId),
          listOperationMembers(operationId)
        ])
        const foundEvents = found ? await listObservationEvents([found.id]) : []
        if (cancelled) return
        setObservation(found)
        setEvents(foundEvents)
        setAuditRows(history)
        setTasks(operationTasks)
        setMembers(operationMembers)
        if (found) {
          setEditTitle(found.title)
          setEditDetail(found.detail ?? '')
          setEditPriority(found.priority ?? 'normal')
          setEditDue(found.due_date ?? '')
          setNewStatus(found.status)
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Erreur de chargement.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [operationId, observationId])

  const unitName = (unitId: string | null): string => {
    const unit = units.find((candidate) => candidate.id === unitId)
    return unit ? `${unit.code ?? ''} ${unit.name}`.trim() : unitId ? unitId.slice(0, 8) : '—'
  }
  const lotLabel = (lotId: string | null): string => {
    const lot = lots.find((candidate) => candidate.id === lotId)
    return lot ? `${lot.number ?? lot.code ?? ''} ${lot.name}`.trim() : lotId ? lotId.slice(0, 8) : '—'
  }
  const taskLabel = (taskId: string | null): string => {
    const task = tasks.find((candidate) => candidate.id === taskId)
    return task ? task.name : taskId ? taskId.slice(0, 8) : '—'
  }
  const memberRoleOf = (userId: string | null): string | null =>
    userId ? members.find((member) => member.user_id === userId)?.role ?? null : null

  const timeline = useMemo(() => buildTimeline(events, auditRows), [events, auditRows])
  const dueState = observation ? dueDateState(observation.due_date, todayString()) : 'none'

  async function reloadDetail() {
    const found = await getObservation(operationId, observationId)
    const history = await listObservationHistory(observationId)
    const foundEvents = found ? await listObservationEvents([found.id]) : []
    if (found) {
      setObservation(found)
      setEvents(foundEvents)
      setAuditRows(history)
    }
  }

  async function saveEdit() {
    if (!observation || !editTitle.trim()) return
    setBusy(true)
    try {
      const updated = await updateObservation(operationId, observation.id, {
        title: editTitle.trim(),
        detail: editDetail.trim() || null,
        priority: editPriority,
        due_date: editDue || null
      })
      setObservation(updated)
      setEditDue(updated.due_date ?? '')
      setEditOpen(false)
      await reloadDetail()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function saveStatusChange() {
    if (!observation) return
    setBusy(true)
    try {
      await updateObservationStatus(operationId, observation.id, newStatus)
      await createObservationEvent(buildObservationEventInsert({ observation_id: observation.id, status: newStatus, note: statusNote.trim() || null }))
      setStatusOpen(false)
      setStatusNote('')
      await reloadDetail()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Mise à jour impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <section className="stack"><p className="eyebrow">Observation</p><h2>Fiche observation</h2><p className="notice">Chargement…</p></section>
  }
  if (error) {
    return <section className="stack"><p className="eyebrow">Observation</p><h2>Fiche observation</h2><p className="notice error">{error}</p></section>
  }
  if (!observation) {
    return <section className="stack"><p className="eyebrow">Observation</p><h2>Fiche observation</h2><p className="notice">Observation introuvable.</p><button type="button" className="link" onClick={onBack}>← Retour</button></section>
  }

  const responsible = observation.responsible_user_id
    ? `${shortUser(observation.responsible_user_id)}${memberRoleOf(observation.responsible_user_id) ? ` (${memberRoleOf(observation.responsible_user_id)})` : ''}`
    : 'Non assigné'

  return (
    <section className="stack">
      <p className="eyebrow">Observation</p>
      <button type="button" className="link" onClick={onBack}>← Retour</button>
      <div className="panel">
        <h2>{observation.title}</h2>
        <dl className="kv">
          <dt>Statut</dt><dd>{observationStatusLabel(observation.status)}</dd>
          <dt>Priorité</dt><dd>{observationPriorityLabel(observation.priority)}</dd>
          <dt>Créée le</dt><dd>{formatDate(observation.created_at)}{observation.created_by ? ` par ${shortUser(observation.created_by)}` : ''}</dd>
          <dt>Échéance</dt><dd>{observation.due_date ? `${formatDate(observation.due_date)} — ${dueDateLabel(dueState)}` : 'Aucune échéance'}</dd>
          <dt>Localisation</dt><dd>{unitName(observation.unit_id)}</dd>
          <dt>Contexte</dt><dd>{observation.lot_id ? `Lot ${lotLabel(observation.lot_id)}` : 'Aucun lot'}{observation.task_id ? ` · Tâche ${taskLabel(observation.task_id)}` : ''}</dd>
          <dt>Responsable</dt><dd>{responsible}</dd>
        </dl>
        {observation.detail && <p>{observation.detail}</p>}
        <p className="muted">Responsable : seule la liste des membres (user_id, rôle) est lisible via RLS — aucun nom/prénom exploitable. La modification du responsable est volontairement non exposée.</p>
        <div className="row">
          <button type="button" className="mini" onClick={() => setEditOpen((open) => !open)}>{editOpen ? 'Fermer' : 'Modifier'}</button>
          <button type="button" className="mini" onClick={() => setStatusOpen((open) => !open)}>{statusOpen ? 'Fermer' : 'Changer le statut'}</button>
        </div>
        {editOpen && (
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void saveEdit() }}>
            <label>Titre<input required value={editTitle} onChange={(event) => setEditTitle(event.target.value)}/></label>
            <label>Description<textarea value={editDetail} onChange={(event) => setEditDetail(event.target.value)}/></label>
            <label>Priorité<select value={editPriority} onChange={(event) => setEditPriority(event.target.value)}>
              {OBSERVATION_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></label>
            <label>Échéance<input type="date" value={editDue} onChange={(event) => setEditDue(event.target.value)}/></label>
            <button disabled={busy || !editTitle.trim()}>{busy ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
          </form>
        )}
        {statusOpen && (
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void saveStatusChange() }}>
            <label>Nouveau statut<select value={newStatus} onChange={(event) => setNewStatus(event.target.value)}>
              {OBSERVATION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></label>
            <label>Note d’évolution<textarea value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder="Facultatif"/></label>
            <button disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le statut'}</button>
          </form>
        )}
      </div>

      <div className="panel">
        <h3>Historique ({timeline.length})</h3>
        {timeline.length === 0 && <p className="notice">Aucun historique.</p>}
        <ul className="history">
          {timeline.map((item) => (
            <li key={item.id} className="history-entry">
              <span className="history-date">{formatDate(item.date)}</span>
              <strong>{item.source === 'event' ? (item.status ? observationStatusLabel(item.status) : 'Événement') : ACTION_LABEL[item.action ?? ''] ?? `Audit (${item.action ?? '?'})`}</strong>
              {item.source === 'event' && item.note && <p className="note">« {item.note} »</p>}
              {item.source === 'audit' && item.status && <p className="muted">Statut dans le snapshot : {observationStatusLabel(item.status)}</p>}
              <p className="muted">par {shortUser(item.changedBy)}{item.source === 'event' ? ' · événement' : ' · audit automatique'}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3>Photos</h3>
        <p className="muted">Fonctionnalité à venir (stockage dédié, hors base64).</p>
      </div>
    </section>
  )
}