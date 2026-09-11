import { describe, expect, it } from 'vitest'
import { nextMarkerNumber, undoLast, clamp01, toPixels, summarizeAnnotations, type Annotation } from './annotations'

const mk = (over: Partial<Annotation>): Annotation => ({ id: 'a', type: 'arrow', color: '#000', x1: 0, y1: 0, ...over })

describe('nextMarkerNumber', () => {
  it('starts at 1 with no markers', () => {
    expect(nextMarkerNumber([])).toBe(1)
    expect(nextMarkerNumber([mk({ type: 'arrow' })])).toBe(1)
  })
  it('increments past the highest existing marker', () => {
    expect(nextMarkerNumber([mk({ type: 'marker', n: 1 }), mk({ type: 'marker', n: 3 })])).toBe(4)
  })
})

describe('undoLast', () => {
  it('drops the last annotation', () => {
    const list = [mk({ id: '1' }), mk({ id: '2' })]
    expect(undoLast(list).map(a => a.id)).toEqual(['1'])
  })
  it('is safe on empty', () => {
    expect(undoLast([])).toEqual([])
  })
})

describe('clamp01', () => {
  it('clamps into [0,1]', () => {
    expect(clamp01(-0.2)).toBe(0)
    expect(clamp01(1.5)).toBe(1)
    expect(clamp01(0.4)).toBe(0.4)
  })
})

describe('toPixels', () => {
  it('denormalizes coordinates to pixel space', () => {
    const p = toPixels(mk({ x1: 0.5, y1: 0.5, x2: 1, y2: 0.25 }), 200, 100)
    expect(p).toMatchObject({ x1: 100, y1: 50, x2: 200, y2: 25 })
  })
  it('maps freehand points', () => {
    const p = toPixels(mk({ type: 'freehand', points: [{ x: 0.5, y: 1 }] }), 200, 100)
    expect(p.points).toEqual([{ x: 100, y: 100 }])
  })
})

describe('summarizeAnnotations', () => {
  it('describes counts', () => {
    expect(summarizeAnnotations([])).toBe('aucune annotation')
    expect(summarizeAnnotations([mk({})])).toBe('1 annotation')
    expect(summarizeAnnotations([mk({}), mk({})])).toBe('2 annotations')
  })
})
