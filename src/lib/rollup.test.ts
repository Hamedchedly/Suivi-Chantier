import { describe, expect, it } from 'vitest'
import { weightedProgress, RollupItem } from './rollup'

const item = (progress: number, planned_duration: number, over: Partial<RollupItem> = {}): RollupItem =>
  ({ progress, planned_duration, is_milestone: false, ...over })

describe('weightedProgress', () => {
  it('0 pour une liste vide', () => {
    expect(weightedProgress([])).toBe(0)
  })

  it('moyenne pondérée par planned_duration', () => {
    // 100% sur 7 jours, 0% sur 8 jours → (100*7 + 0*8) / 15 = 46,67 → 47
    expect(weightedProgress([item(100, 7), item(0, 8)])).toBe(47)
  })

  it('poids égaux ⇒ identique à une moyenne simple', () => {
    expect(weightedProgress([item(20, 5), item(80, 5)])).toBe(50)
  })

  it('exclut les milestones du calcul', () => {
    expect(weightedProgress([item(100, 5), item(0, 999, { is_milestone: true })])).toBe(100)
  })

  it('exclut les tâches N/A du calcul', () => {
    expect(weightedProgress([item(100, 5), item(0, 999, { is_na: true })])).toBe(100)
  })

  it('0 quand tous les items sont exclus (milestones/N/A uniquement)', () => {
    expect(weightedProgress([item(50, 5, { is_milestone: true }), item(80, 5, { is_na: true })])).toBe(0)
  })

  it('replie sur une moyenne simple si toutes les durées sont nulles (données sans durée)', () => {
    expect(weightedProgress([item(20, 0), item(80, 0)])).toBe(50)
  })

  it('ignore une durée négative comme un poids nul, sans jamais planter', () => {
    expect(weightedProgress([item(40, -5), item(60, 10)])).toBe(60)
  })
})
