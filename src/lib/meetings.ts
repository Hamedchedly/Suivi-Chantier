// Réunions de chantier : décisions actées et actions suivies (responsable + échéance).

export type ActionStatus = 'todo' | 'done'

export interface Decision {
  id: string
  text: string
}

export interface MeetingAction {
  id: string
  ref: string            // A-001
  text: string
  assignee: string
  dueDate: string        // ISO yyyy-mm-dd
  status: ActionStatus
}

export interface Meeting {
  id: string
  date: string           // ISO yyyy-mm-dd
  title: string
  attendees: string[]
  decisions: Decision[]
  actions: MeetingAction[]
}

/** Toutes les actions, tous comptes rendus confondus. */
export function allActions(meetings: Meeting[]): MeetingAction[] {
  return meetings.flatMap(m => m.actions)
}

export function openActions(meetings: Meeting[]): MeetingAction[] {
  return allActions(meetings).filter(a => a.status === 'todo')
}

/** Actions non faites dont l'échéance est dépassée. */
export function overdueActions(meetings: Meeting[], today: Date): MeetingAction[] {
  const t = new Date(today); t.setHours(0, 0, 0, 0)
  return openActions(meetings).filter(a => new Date(a.dueDate + 'T00:00:00').getTime() < t.getTime())
}

/** Prochaine référence séquentielle A-00N. */
export function nextActionRef(meetings: Meeting[]): string {
  const max = allActions(meetings).reduce((m, a) => {
    const n = parseInt(a.ref.replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `A-${String(max + 1).padStart(3, '0')}`
}
