import { describe, expect, it } from 'vitest'
import { buildSnapshot, encodeSnapshot, decodeSnapshot } from './share'

describe('share snapshot encode/decode', () => {
  it('round-trips a snapshot preserving data', () => {
    const snap = buildSnapshot()
    const decoded = decodeSnapshot(encodeSnapshot(snap))
    expect(decoded).not.toBeNull()
    expect(decoded!.v).toBe(1)
    expect(decoded!.tasks.length).toBe(snap.tasks.length)
    expect(decoded!.marches.length).toBe(snap.marches.length)
  })

  it('revives Date fields on the tasks', () => {
    const decoded = decodeSnapshot(encodeSnapshot(buildSnapshot()))
    expect(decoded!.tasks[0].planned_start instanceof Date).toBe(true)
    expect(decoded!.tasks[0].planned_end instanceof Date).toBe(true)
  })

  it('strips reserve photos from the snapshot', () => {
    const snap = buildSnapshot()
    expect(snap.reserves.every(r => r.photo === undefined)).toBe(true)
  })

  it('returns null on garbage input', () => {
    expect(decodeSnapshot('not-a-valid-snapshot')).toBeNull()
    expect(decodeSnapshot('')).toBeNull()
  })
})
