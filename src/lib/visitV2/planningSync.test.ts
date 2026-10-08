import { describe, it, expect } from 'vitest'
import type { GanttTask } from '../../types/gantt'
import { syncSessionToPlanning } from './planningSync'
import type { V2Session, V2Unit } from './model'

const dates = { planned_start: new Date(2026, 0, 1), planned_end: new Date(2026, 0, 10), planned_duration: 10, is_milestone: false, dependencies: [] }
const task = (id: string, progress: number): GanttTask =>
  ({ id, lot_id: 'L1', title: id, status: 'not-started', progress, ...dates }) as unknown as GanttTask
const lot = (children: GanttTask[]): GanttTask =>
  ({ id: 'LOT-L1', lot_id: 'L1', title: 'Lot 1', status: 'not-started', progress: 0, ...dates, children }) as unknown as GanttTask

const unit = (id: string, tasks: { id: string; progress?: number }[]): V2Unit => ({
  id, label: id, buildingId: 'B', buildingLabel: 'Bâtiment', tasks: tasks.map(t => ({ id: t.id, title: t.id, lotId: 'L1', na: false, progress: t.progress })),
})

const session = (units: V2Unit[]): V2Session => ({
  id: 'S1', date: '2026-10-07', kindLabel: 'Visite', status: 'en_cours',
  startedAt: '2026-10-07T08:00:00Z', updatedAt: '2026-10-07T08:00:00Z',
  units, baseline: {}, remarks: [], acknowledged: [],
})

const now = new Date('2026-10-07T10:00:00Z')

describe('synchronisation session → planning + historique', () => {
  it('ne touche à rien sans observation', () => {
    const tasks = [lot([task('a', 50)])]
    const r = syncSessionToPlanning({ tasks, history: [], overrides: [], session: session([unit('U1', [{ id: 'a' }])]), now })
    expect(r.tasks).toBe(tasks)
    expect(r.history).toEqual([])
  })

  it('écrit une entrée visit par tâche, datée de la session', () => {
    const tasks = [lot([task('a', 0)])]
    const r = syncSessionToPlanning({ tasks, history: [], overrides: [], session: session([unit('U1', [{ id: 'a', progress: 35 }])]), now })
    const visit = r.history.filter(h => h.source === 'visit')
    expect(visit).toHaveLength(1)
    expect(visit[0]).toMatchObject({ taskId: 'a', new_progress: 35, effective_date: '2026-10-07', visitId: 'S1' })
  })

  it('une nouvelle synchro de la même session remplace l entrée au lieu de la dupliquer', () => {
    const tasks = [lot([task('a', 0)])]
    const first = syncSessionToPlanning({ tasks, history: [], overrides: [], session: session([unit('U1', [{ id: 'a', progress: 35 }])]), now })
    const second = syncSessionToPlanning({ tasks, history: first.history, overrides: [], session: session([unit('U1', [{ id: 'a', progress: 60 }])]), now })
    const visit = second.history.filter(h => h.source === 'visit' && h.taskId === 'a')
    expect(visit).toHaveLength(1)
    expect(visit[0].new_progress).toBe(60)
  })

  it('dérive la date de début réel à la première observation et la fin à 100 %', () => {
    const tasks = [lot([task('a', 0)])]
    const started = syncSessionToPlanning({ tasks, history: [], overrides: [], session: session([unit('U1', [{ id: 'a', progress: 35 }])]), now })
    const leaf = started.tasks[0].children![0]
    expect(leaf.actual_start?.getTime()).toBe(new Date(2026, 9, 7).getTime())
    expect(leaf.actual_end).toBeUndefined()
    const done = syncSessionToPlanning({ tasks, history: [], overrides: [], session: session([unit('U1', [{ id: 'a', progress: 100 }])]), now })
    expect(done.tasks[0].children![0].actual_end?.getTime()).toBe(new Date(2026, 9, 7).getTime())
  })

  it('crée une entrée calculated pour le parent', () => {
    const tasks = [lot([task('a', 0), task('b', 0)])]
    const r = syncSessionToPlanning({
      tasks, history: [], overrides: [],
      session: session([unit('U1', [{ id: 'a', progress: 100 }, { id: 'b', progress: 0 }])]), now,
    })
    const calc = r.history.filter(h => h.source === 'calculated')
    expect(calc.map(c => c.taskId)).toEqual(['LOT-L1'])
    expect(calc[0].new_progress).toBe(r.tasks[0].progress)
  })

  it('garde une date de début réel antérieure déjà connue (genèse)', () => {
    const existing = { ...task('a', 50), actual_start: new Date(2026, 0, 3) } as GanttTask
    const tasks = [lot([existing])]
    const r = syncSessionToPlanning({ tasks, history: [], overrides: [], session: session([unit('U1', [{ id: 'a', progress: 50 }])]), now })
    expect(r.tasks[0].children![0].actual_start?.getTime()).toBe(new Date(2026, 0, 3).getTime())
  })
})
