import { GanttTask } from '../types/gantt'
import { Reserve } from './reserves'
import { Meeting, overdueActions } from './meetings'
import { flattenLeaves, isLate, lotSummaries } from './schedule'

export type AlertType = 'blocked' | 'late-critical' | 'lot-drift' | 'late' | 'action-overdue' | 'reserve-high' | 'reserve-open'
export type AlertLevel = 'critique' | 'eleve' | 'moyen'

export interface AlertAction { resolved?: boolean; flagged?: boolean }
export type AlertActions = Record<string, AlertAction>

export interface Alert {
  id: string
  type: AlertType
  level: AlertLevel
  severity: number       // 0-100, drives ordering
  title: string
  detail: string
  flagged: boolean       // "à évoquer en réunion"
  resolved: boolean      // confirmed resolved by the user
}

export function levelOf(severity: number): AlertLevel {
  if (severity >= 80) return 'critique'
  if (severity >= 50) return 'eleve'
  return 'moyen'
}

/**
 * Derive the project's vigilance items from live state and apply user actions.
 * Selection & priority (severity):
 *   100 point bloquant · 90 retard critique · 80 dérive ≥7j · 75 action en
 *   retard · 70 retard · 60 réserve haute · 50 dérive 1–6j · 30 réserve ouverte
 * Alerts disappear automatically when their underlying condition is gone
 * (task completed, reserve resolved, drift recovered). The `resolved` flag lets
 * the user confirm resolution manually; `flagged` pins it for the next meeting.
 */
export function buildAlerts(
  tasks: GanttTask[],
  reserves: Reserve[],
  today: Date,
  actions: AlertActions = {},
  meetings: Meeting[] = [],
): Alert[] {
  const raw: { id: string; type: AlertType; severity: number; title: string; detail: string }[] = []

  for (const t of flattenLeaves(tasks)) {
    if (t.is_milestone) continue
    const loc = t.logement_id ? ` — ${t.logement_id}` : ''
    if (t.status === 'blocked') {
      raw.push({ id: `blocked-${t.id}`, type: 'blocked', severity: 100, title: `Point bloquant : ${t.title}`, detail: `Tâche bloquée${loc}` })
    } else if (isLate(t, today)) {
      raw.push({
        id: `late-${t.id}`,
        type: t.is_critical ? 'late-critical' : 'late',
        severity: t.is_critical ? 90 : 70,
        title: `${t.title} en retard`,
        detail: `Échéance ${t.planned_end.toLocaleDateString('fr')} • ${t.progress}%`,
      })
    }
  }

  for (const l of lotSummaries(tasks, today)) {
    if (l.drift > 0) {
      raw.push({
        id: `drift-${l.lotId}`,
        type: 'lot-drift',
        severity: l.drift >= 7 ? 80 : 50,
        title: `${l.title.replace(/^LOT \d+ - /, '')} : +${l.drift} j de dérive`,
        detail: 'vs planning contractuel',
      })
    }
  }

  for (const a of overdueActions(meetings, today)) {
    raw.push({
      id: `action-${a.id}`,
      type: 'action-overdue',
      severity: 75,
      title: `${a.ref} — ${a.text}`,
      detail: `Action en retard · ${a.assignee} · échéance ${new Date(a.dueDate + 'T00:00:00').toLocaleDateString('fr')}`,
    })
  }

  for (const r of reserves.filter(x => x.status === 'open')) {
    raw.push({
      id: `reserve-${r.id}`,
      type: r.priority === 'high' ? 'reserve-high' : 'reserve-open',
      severity: r.priority === 'high' ? 60 : 30,
      title: `${r.number} — ${r.description}`,
      detail: r.priority === 'high' ? 'Réserve haute priorité' : 'Réserve ouverte',
    })
  }

  return raw
    .map(a => ({
      ...a,
      level: levelOf(a.severity),
      flagged: !!actions[a.id]?.flagged,
      resolved: !!actions[a.id]?.resolved,
    }))
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.severity - a.severity)
}

export function activeAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(a => !a.resolved)
}

export function flaggedAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(a => a.flagged && !a.resolved)
}
