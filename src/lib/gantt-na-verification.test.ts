import { describe, it, expect } from 'vitest'
import { weightedProgress } from './rollup'

describe('Gantt N/A Verification Tests — 0% ≠ N/A', () => {
  it('Scenario 1 : 0% tâche ≠ N/A tâche dans l\'UI', () => {
    // Une tâche à 0% est une tâche réelle non commencée
    const task0 = { progress: 0, planned_duration: 10, is_milestone: false, is_na: false }

    // Une tâche N/A est une tâche qui ne s\'applique pas ici
    const taskNA = { progress: 0, planned_duration: 10, is_milestone: false, is_na: true }

    // Elles ont le même progress (0) mais un sens différent
    expect(task0.progress).toBe(taskNA.progress) // Les deux à 0%
    expect(task0.is_na).not.toBe(taskNA.is_na) // Mais status différent
  })

  it('Scenario 2 : 100% + 100% + N/A = 100% (N/A exclu du rollup)', () => {
    const items = [
      { progress: 100, planned_duration: 5, is_milestone: false, is_na: false },
      { progress: 100, planned_duration: 5, is_milestone: false, is_na: false },
      { progress: 0, planned_duration: 999, is_milestone: false, is_na: true },
    ]

    const result = weightedProgress(items)
    // (100*5 + 100*5) / 10 = 100
    // N/A (durée 999) est exclu
    expect(result).toBe(100)
  })

  it('Scenario 3 : 0% + 100% + N/A = 50% (N/A exclu)', () => {
    const items = [
      { progress: 0, planned_duration: 5, is_milestone: false, is_na: false },
      { progress: 100, planned_duration: 5, is_milestone: false, is_na: false },
      { progress: 0, planned_duration: 999, is_milestone: false, is_na: true },
    ]

    const result = weightedProgress(items)
    // (0*5 + 100*5) / 10 = 50
    expect(result).toBe(50)
  })

  it('Scenario 4 : N/A seul = 0% (pas de tâche pesable)', () => {
    const items = [
      { progress: 0, planned_duration: 10, is_milestone: false, is_na: true },
    ]

    const result = weightedProgress(items)
    // Aucune tâche pesable (N/A exclu) → retour 0
    expect(result).toBe(0)
  })

  it('Scenario 5 : Milestone + 100% + N/A = 100% (milestone ET N/A excls)', () => {
    const items = [
      { progress: 100, planned_duration: 10, is_milestone: false, is_na: false },
      { progress: 100, planned_duration: 0, is_milestone: true, is_na: false },
      { progress: 0, planned_duration: 999, is_milestone: false, is_na: true },
    ]

    const result = weightedProgress(items)
    // (100*10) / 10 = 100
    // Milestone ET N/A exclus
    expect(result).toBe(100)
  })

  it('Scenario 6 : Milestone (100%) + N/A (0%) + 100% = 100%', () => {
    const items = [
      { progress: 100, planned_duration: 0, is_milestone: true, is_na: false }, // Jalon
      { progress: 0, planned_duration: 10, is_milestone: false, is_na: true }, // N/A
      { progress: 100, planned_duration: 10, is_milestone: false, is_na: false }, // Tâche réelle
    ]

    const result = weightedProgress(items)
    // (100*10) / 10 = 100
    expect(result).toBe(100)
  })

  it('Scenario 7 : Trois N/A + une tâche à 50% = 50%', () => {
    const items = [
      { progress: 0, planned_duration: 10, is_milestone: false, is_na: true },
      { progress: 0, planned_duration: 10, is_milestone: false, is_na: true },
      { progress: 0, planned_duration: 10, is_milestone: false, is_na: true },
      { progress: 50, planned_duration: 10, is_milestone: false, is_na: false },
    ]

    const result = weightedProgress(items)
    // (50*10) / 10 = 50
    // Les trois N/A sont exclus
    expect(result).toBe(50)
  })

  it('Scenario 8 : Deux tâches 75% + une N/A 0% = 75% (poids égal)', () => {
    const items = [
      { progress: 75, planned_duration: 10, is_milestone: false, is_na: false },
      { progress: 75, planned_duration: 10, is_milestone: false, is_na: false },
      { progress: 0, planned_duration: 10, is_milestone: false, is_na: true },
    ]

    const result = weightedProgress(items)
    // (75*10 + 75*10) / 20 = 75
    expect(result).toBe(75)
  })

  it('Scenario 9 : Tous les items sont N/A = 0%', () => {
    const items = [
      { progress: 50, planned_duration: 10, is_milestone: false, is_na: true },
      { progress: 100, planned_duration: 10, is_milestone: false, is_na: true },
      { progress: 30, planned_duration: 10, is_milestone: false, is_na: true },
    ]

    const result = weightedProgress(items)
    expect(result).toBe(0)
  })

  it('Scenario 10 : Mélange complexe : 30% (10j) + 80% (5j) + N/A (999j) + Milestone (0j) = ~43%', () => {
    const items = [
      { progress: 30, planned_duration: 10, is_milestone: false, is_na: false },
      { progress: 80, planned_duration: 5, is_milestone: false, is_na: false },
      { progress: 0, planned_duration: 999, is_milestone: false, is_na: true }, // Exclu
      { progress: 100, planned_duration: 0, is_milestone: true, is_na: false }, // Exclu
    ]

    const result = weightedProgress(items)
    // (30*10 + 80*5) / 15 = (300 + 400) / 15 = 700 / 15 = 46.67 → 47
    expect(result).toBe(47)
  })

  it('Scenario 11 : N/A ne provoque pas artificiellement un retard', () => {
    // Si une tâche N/A était comptée à 0% dans le parent, ça ferait baisser la progr parent
    const itemsWithoutNA = [
      { progress: 100, planned_duration: 50, is_milestone: false, is_na: false },
    ]
    const resultWithout = weightedProgress(itemsWithoutNA)
    expect(resultWithout).toBe(100)

    const itemsWithNA = [
      { progress: 100, planned_duration: 50, is_milestone: false, is_na: false },
      { progress: 0, planned_duration: 50, is_milestone: false, is_na: true },
    ]
    const resultWith = weightedProgress(itemsWithNA)
    expect(resultWith).toBe(100) // Inchangé malgré la présence de N/A à 0%
  })

  it('Scenario 12 : Vérification de la formule pondérée avec N/A', () => {
    // Test mathématique précis
    // 40% sur 8j + 60% sur 12j + N/A = (40*8 + 60*12) / (8+12) = (320 + 720) / 20 = 1040/20 = 52%
    const items = [
      { progress: 40, planned_duration: 8, is_milestone: false, is_na: false },
      { progress: 60, planned_duration: 12, is_milestone: false, is_na: false },
      { progress: 0, planned_duration: 1000, is_milestone: false, is_na: true },
    ]

    const result = weightedProgress(items)
    expect(result).toBe(52)
  })
})
