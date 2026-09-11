import { describe, expect, it } from 'vitest'
import { GanttTask, TaskStatus } from '../types/gantt'
import { Reserve } from './reserves'
import { buildAlerts, activeAlerts, flaggedAlerts, levelOf } from './alerts'

const day = (iso: string) => new Date(iso + 'T00:00:00')

const leaf = (id: string, o: Partial<GanttTask> & { start: string; end: string }): GanttTask => ({
  id, lot_id: o.lot_id ?? 'L05', title: o.title ?? id,
  planned_start: day(o.start), planned_end: day(o.end), planned_duration: 1,
  baseline_start: day(o.start), baseline_end: o.baseline_end ? (o.baseline_end as Date) : day(o.end),
  progress: o.progress ?? 0, status: (o.status ?? 'not-started') as TaskStatus,
  priority: 'medium', dependencies: [], is_milestone: o.is_milestone ?? false, is_critical: o.is_critical ?? false,
  logement_id: o.logement_id,
})
const parent = (id: string, children: GanttTask[]): GanttTask => ({ ...leaf(id, { start: '2026-01-01', end: '2026-01-10' }), children })
const reserve = (id: string, priority: Reserve['priority'], status: Reserve['status']): Reserve =>
  ({ id, number: `R-${id}`, lotId: 'L05', logementId: 'A-101', description: 'desc', priority, status, createdAt: '2026-01-01' })

const today = day('2026-01-15')

describe('levelOf', () => {
  it('buckets by severity', () => {
    expect(levelOf(100)).toBe('critique')
    expect(levelOf(60)).toBe('eleve')
    expect(levelOf(30)).toBe('moyen')
  })
})

describe('buildAlerts selection & priority', () => {
  const tasks = [parent('L05', [
    leaf('t-blocked', { start: '2026-01-01', end: '2026-01-10', status: 'blocked', progress: 20 }),
    leaf('t-late-crit', { start: '2026-01-01', end: '2026-01-05', progress: 40, is_critical: true }),
    leaf('t-ok', { start: '2026-01-20', end: '2026-01-25', progress: 0 }),
  ])]
  const reserves = [reserve('1', 'high', 'open'), reserve('2', 'low', 'resolved')]

  it('emits blocked + late-critical + high reserve, sorted by severity', () => {
    const a = buildAlerts(tasks, reserves, today)
    expect(a[0].type).toBe('blocked')
    expect(a[0].severity).toBe(100)
    expect(a.some(x => x.type === 'late-critical' && x.severity === 90)).toBe(true)
    expect(a.some(x => x.type === 'reserve-high')).toBe(true)
    // resolved reserve is not emitted
    expect(a.some(x => x.id === 'reserve-2')).toBe(false)
    // future task is not late
    expect(a.some(x => x.id.includes('t-ok'))).toBe(false)
  })

  it('skips milestones', () => {
    const t = [parent('L', [leaf('m', { start: '2026-01-01', end: '2026-01-05', is_milestone: true, status: 'blocked' })])]
    expect(buildAlerts(t, [], today)).toHaveLength(0)
  })
})

describe('actions de réunion en retard', () => {
  it('remonte une action non faite dont l’échéance est dépassée', () => {
    const meetings = [{
      id: 'm1', date: '2026-01-01', title: 'RC', attendees: [], decisions: [],
      actions: [
        { id: 'x1', ref: 'A-001', text: 'Transmettre la note', assignee: 'Soveclim', dueDate: '2026-01-05', status: 'todo' as const },
        { id: 'x2', ref: 'A-002', text: 'Fait', assignee: 'MOE', dueDate: '2026-01-05', status: 'done' as const },
        { id: 'x3', ref: 'A-003', text: 'À venir', assignee: 'MOE', dueDate: '2026-02-01', status: 'todo' as const },
      ],
    }]
    const a = buildAlerts([], [], today, {}, meetings)
    expect(a).toHaveLength(1)
    expect(a[0].type).toBe('action-overdue')
    expect(a[0].severity).toBe(75)
    expect(a[0].title).toContain('A-001')
  })
})

describe('actions: resolved & flagged', () => {
  const tasks = [parent('L05', [leaf('t', { start: '2026-01-01', end: '2026-01-05', progress: 10, status: 'blocked' })])]

  it('marks resolved and keeps it out of active', () => {
    // La tâche déclenche aussi une alerte de dérive (10 jours au-delà de sa fin) :
    // on vérifie le sort de l'alerte résolue, pas le nombre total d'alertes.
    const alerts = buildAlerts(tasks, [], today, { 'blocked-t': { resolved: true } })
    expect(alerts.find(a => a.id === 'blocked-t')?.resolved).toBe(true)
    expect(activeAlerts(alerts).some(a => a.id === 'blocked-t')).toBe(false)
  })

  it('flags for meeting and sorts flagged first', () => {
    const two = [parent('L05', [
      leaf('a', { start: '2026-01-20', end: '2026-01-25', status: 'blocked', progress: 0 }),
      leaf('b', { start: '2026-01-01', end: '2026-01-05', progress: 10 }),
    ])]
    const alerts = buildAlerts(two, [], today, { 'late-b': { flagged: true } })
    expect(alerts[0].id).toBe('late-b')          // flagged bubbles to top despite lower severity
    expect(flaggedAlerts(alerts)).toHaveLength(1)
  })
})
