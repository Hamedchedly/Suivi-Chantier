import { describe, it, expect } from 'vitest'
import {
  durationBetween, endFromDuration, recomputeLot, recomputeAll,
  createLot, createTask, renameTask, setTaskDates, removeTask, leafIds,
} from './planning'
import { GanttTask } from '../types/gantt'

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

const task = (id: string, over: Partial<GanttTask> & { start: string; end: string }): GanttTask => ({
  id, lot_id: over.lot_id ?? 'L05', title: over.title ?? id,
  planned_start: d(over.start), planned_end: d(over.end),
  planned_duration: durationBetween(d(over.start), d(over.end)),
  progress: over.progress ?? 0, status: 'not-started', priority: 'medium',
  dependencies: [], is_milestone: over.is_milestone ?? false, is_critical: false,
})

describe('durées', () => {
  it('compte les jours bornes comprises', () => {
    expect(durationBetween(d('2026-01-01'), d('2026-01-05'))).toBe(5)
    expect(durationBetween(d('2026-01-01'), d('2026-01-01'))).toBe(1)
  })
  it('déduit la fin d’une durée', () => {
    expect(endFromDuration(d('2026-01-01'), 5)).toEqual(d('2026-01-05'))
    expect(endFromDuration(d('2026-01-01'), 1)).toEqual(d('2026-01-01'))
  })
})

describe('createLot', () => {
  it('refuse un libellé vide', () => {
    expect(createLot([], { code: 'L01', title: '  ' }).error).toBe('title_required')
  })
  it('crée un lot vide prêt à recevoir des tâches', () => {
    const r = createLot([], { code: ' L01 ', title: ' Démolition ' })
    expect(r.ok).toBe(true)
    expect(r.task?.lot_id).toBe('L01')
    expect(r.task?.title).toBe('Démolition')
    expect(r.task?.children).toEqual([])
  })
  it('refuse un code de lot déjà pris', () => {
    const a = createLot([], { code: 'L01', title: 'A' })
    expect(createLot(a.tasks, { code: 'l01', title: 'B' }).error).toBe('code_taken')
  })
  it('tolère un code vide en générant un identifiant', () => {
    const r = createLot([], { code: '', title: 'Sans code' })
    expect(r.ok).toBe(true)
    expect(r.task?.lot_id).toBeTruthy()
  })
})

describe('createTask', () => {
  const base = createLot([], { code: 'L01', title: 'Lot' }).tasks
  const lotId = base[0].id

  it('signale un lot inconnu', () => {
    expect(createTask(base, 'nope', { title: 'T', start: d('2026-01-01') }).error).toBe('lot_not_found')
  })
  it('ajoute une tâche datée par durée', () => {
    const r = createTask(base, lotId, { title: 'Curage', start: d('2026-01-01'), duration: 5 })
    const t = r.tasks[0].children![0]
    expect(t.title).toBe('Curage')
    expect(t.planned_end).toEqual(d('2026-01-05'))
    expect(t.parent_id).toBe(lotId)
    expect(t.lot_id).toBe('L01')
  })
  it('accepte une fin explicite et calcule la durée', () => {
    const r = createTask(base, lotId, { title: 'X', start: d('2026-01-01'), end: d('2026-01-10') })
    expect(r.tasks[0].children![0].planned_duration).toBe(10)
  })
  it('remonte les bornes du lot depuis ses tâches', () => {
    let s = createTask(base, lotId, { title: 'A', start: d('2026-01-01'), end: d('2026-01-05') }).tasks
    s = createTask(s, lotId, { title: 'B', start: d('2026-01-10'), end: d('2026-01-20') }).tasks
    const lot = s[0]
    expect(lot.planned_start).toEqual(d('2026-01-01'))
    expect(lot.planned_end).toEqual(d('2026-01-20'))
  })
  it('corrige une fin antérieure au début', () => {
    const r = createTask(base, lotId, { title: 'X', start: d('2026-01-10'), end: d('2026-01-01') })
    expect(r.tasks[0].children![0].planned_end).toEqual(d('2026-01-10'))
  })
})

describe('recomputeLot', () => {
  it('moyenne l’avancement des tâches, jalons exclus', () => {
    const lot: GanttTask = {
      ...task('L', { start: '2026-01-01', end: '2026-01-10' }),
      children: [
        task('a', { start: '2026-01-01', end: '2026-01-05', progress: 100 }),
        task('b', { start: '2026-01-06', end: '2026-01-10', progress: 0 }),
        task('m', { start: '2026-01-10', end: '2026-01-10', is_milestone: true, progress: 0 }),
      ],
    }
    expect(recomputeLot(lot).progress).toBe(50)
  })
  it('laisse un lot sans enfant inchangé', () => {
    const lot = task('L', { start: '2026-01-01', end: '2026-01-10' })
    expect(recomputeLot(lot)).toEqual(lot)
  })
})

describe('setTaskDates', () => {
  let tasks = createLot([], { code: 'L01', title: 'Lot' }).tasks
  const lotId = tasks[0].id
  tasks = createTask(tasks, lotId, { title: 'A', start: d('2026-01-01'), duration: 5 }).tasks
  const taskId = tasks[0].children![0].id

  it('déplace le début en gardant la durée', () => {
    const r = setTaskDates(tasks, taskId, { start: d('2026-01-10') })
    const t = r.tasks[0].children![0]
    expect(t.planned_start).toEqual(d('2026-01-10'))
    expect(t.planned_end).toEqual(d('2026-01-14'))
  })
  it('recalcule la durée quand on change la fin', () => {
    const r = setTaskDates(tasks, taskId, { end: d('2026-01-20') })
    expect(r.tasks[0].children![0].planned_duration).toBe(20)
  })
  it('ignore une fin avant le début', () => {
    const r = setTaskDates(tasks, taskId, { end: d('2025-12-01') })
    expect(r.tasks[0].children![0].planned_end).toEqual(d('2026-01-05'))
  })
})

describe('renameTask & removeTask', () => {
  let tasks = createLot([], { code: 'L01', title: 'Lot' }).tasks
  const lotId = tasks[0].id
  tasks = createTask(tasks, lotId, { title: 'A', start: d('2026-01-01'), duration: 5 }).tasks
  tasks = createTask(tasks, lotId, { title: 'B', start: d('2026-01-10'), duration: 5 }).tasks
  const aId = tasks[0].children![0].id

  it('renomme une tâche', () => {
    expect(renameTask(tasks, aId, ' Curage ').tasks[0].children![0].title).toBe('Curage')
  })
  it('refuse un renommage vide', () => {
    expect(renameTask(tasks, aId, '  ').error).toBe('title_required')
  })
  it('supprime une tâche et recalcule le lot', () => {
    const r = removeTask(tasks, aId)
    expect(r.tasks[0].children).toHaveLength(1)
    expect(r.tasks[0].planned_start).toEqual(d('2026-01-10'))
  })
  it('supprime un lot entier', () => {
    const r = removeTask(tasks, lotId)
    expect(r.tasks).toHaveLength(0)
  })
  it('signale une cible inconnue', () => {
    expect(removeTask(tasks, 'nope').error).toBe('not_found')
  })
})

describe('leafIds & recomputeAll', () => {
  it('liste les identifiants de tâches feuilles', () => {
    let tasks = createLot([], { code: 'L01', title: 'Lot' }).tasks
    tasks = createTask(tasks, tasks[0].id, { title: 'A', start: d('2026-01-01'), duration: 5 }).tasks
    expect(leafIds(tasks)).toHaveLength(1)
  })
  it('recalcule tous les lots sans toucher aux feuilles orphelines', () => {
    const t = task('solo', { start: '2026-01-01', end: '2026-01-05' })
    expect(recomputeAll([t])).toEqual([t])
  })
})
