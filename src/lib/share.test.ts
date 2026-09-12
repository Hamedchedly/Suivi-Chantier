import { describe, expect, it } from 'vitest'
import { Snapshot, buildSnapshot, encodeSnapshot, decodeSnapshot } from './share'
import { GanttTask } from '../types/gantt'

// Sans localStorage (environnement node), le repository renvoie un projet vide :
// buildSnapshot est donc testé pour sa forme, et le round-trip sur un instantané
// construit explicitement — c'est lui qui porte les Dates à faire revivre.

const task = (over: Partial<GanttTask> = {}): GanttTask => ({
  id: 'T-1', lot_id: 'L05', title: 'Doublage intérieur',
  planned_start: new Date('2026-02-16T00:00:00Z'),
  planned_end: new Date('2026-03-08T00:00:00Z'),
  planned_duration: 15,
  progress: 40, status: 'in-progress', priority: 'medium',
  dependencies: [], is_milestone: false, is_critical: false,
  ...over,
})

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  v: 1,
  createdAt: '2026-09-08T10:00:00.000Z',
  project: { name: 'Opération test', ref: 'REF-1', address: 'Reims' },
  tasks: [task()],
  reserves: [],
  marches: [],
  avenants: [],
  situations: [],
  ...over,
})

describe('share snapshot encode/decode', () => {
  it('round-trips a snapshot preserving data', () => {
    const snap = snapshot()
    const decoded = decodeSnapshot(encodeSnapshot(snap))
    expect(decoded).not.toBeNull()
    expect(decoded!.v).toBe(1)
    expect(decoded!.tasks.length).toBe(snap.tasks.length)
    expect(decoded!.project.name).toBe('Opération test')
  })

  it('revives Date fields on the tasks', () => {
    const decoded = decodeSnapshot(encodeSnapshot(snapshot()))
    expect(decoded!.tasks[0].planned_start instanceof Date).toBe(true)
    expect(decoded!.tasks[0].planned_end instanceof Date).toBe(true)
    expect(decoded!.tasks[0].planned_start.toISOString()).toBe('2026-02-16T00:00:00.000Z')
  })

  it('strips reserve photos from the snapshot', () => {
    const snap = buildSnapshot()
    expect(snap.reserves.every(r => r.photo === undefined)).toBe(true)
  })

  it('décrit un instantané cohérent même sans projet actif', () => {
    const snap = buildSnapshot()
    expect(snap.v).toBe(1)
    expect(snap.project.name).toBe('Opération')
    expect(snap.tasks).toEqual([])
    expect(snap.zones).toEqual({})
  })

  it('embarque et restitue les libellés de zone', () => {
    const decoded = decodeSnapshot(encodeSnapshot(snapshot({ zones: { 'L5': 'Logement 5' } })))
    expect(decoded!.zones).toEqual({ 'L5': 'Logement 5' })
  })

  it('returns null on garbage input', () => {
    expect(decodeSnapshot('not-a-valid-snapshot')).toBeNull()
    expect(decodeSnapshot('')).toBeNull()
  })
})
