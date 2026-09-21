// ────────────────────────────────────────────────────────────────────────────
// GATE DE STABILISATION — Scénario 2 : avancement (0/25/50/80/100, N/A, bloquée).
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { deriveTaskStatus } from './planningEngine'
import { statusFor, stateAfterEdit } from './visits'
import { weightedProgress } from './rollup'

describe('GATE 2 — valeurs simples d’avancement', () => {
  it('0/25/50/80/100 sont acceptées telles quelles par le statut dérivé', () => {
    expect(deriveTaskStatus(0, 'not-started')).toBe('not-started')
    expect(deriveTaskStatus(25, 'not-started')).toBe('in-progress')
    expect(deriveTaskStatus(50, 'in-progress')).toBe('in-progress')
    expect(deriveTaskStatus(80, 'in-progress')).toBe('in-progress')
    expect(deriveTaskStatus(100, 'in-progress')).toBe('completed')
  })
})

describe('GATE 2 — N/A jamais interprété comme 0 %', () => {
  it('une tâche N/A est EXCLUE du rollup, pas comptée comme 0', () => {
    const withoutNa = weightedProgress([{ progress: 100, planned_duration: 5, is_milestone: false }])
    const withNaAt50 = weightedProgress([
      { progress: 100, planned_duration: 5, is_milestone: false },
      { progress: 50, planned_duration: 5, is_milestone: false, is_na: true }, // la valeur n'importe pas, elle est exclue
    ])
    expect(withNaAt50).toBe(withoutNa) // même résultat qu'en l'absence totale de la tâche N/A
    expect(withNaAt50).toBe(100) // et surtout pas tiré vers 0 par une fausse inclusion
  })
})

describe('GATE 2 — tâche bloquée : conserve son avancement, peut être débloquée', () => {
  it('50 % → bloquée : la tâche garde 50 %, seul le statut passe à blocked', () => {
    // Le passage à "bloquée" (visite : blockedBy renseigné) ne touche jamais
    // check.progress — seul statusFor()/deriveTaskStatus() changent le statut.
    const blockedStatus = statusFor({ taskId: 't', lotId: 'L', title: 'T', state: 'blocked', progress: 50 }, 'in-progress')
    expect(blockedStatus).toBe('blocked')
    // Le progress lui-même n'est décidé que par check.progress, jamais remis à 0 par le blocage.
  })

  it('une tâche à 55 % peut être bloquée sans perdre son avancement', () => {
    const check = { taskId: 't', lotId: 'L', title: 'T', state: 'not_checked' as const, progress: 55, blockedBy: ['other-task'] }
    expect(stateAfterEdit(check)).toBe('blocked')
    expect(check.progress).toBe(55) // inchangé
  })

  it('BUG CONFIRMÉ (pré-existant) — bloquée → 60 % ne débloquait pas : deriveTaskStatus traite "blocked" comme collant, y compris quand statusFor a déjà décidé que ce n’est plus le cas', () => {
    // Reproduction exacte : la visite précédente avait bloqué la tâche
    // (t.status === 'blocked' persisté). Dans CETTE visite, le blocage est
    // levé (blockedBy vidé) et l'avancement est poussé à 60 puis 100.
    const currentStoredStatus = 'blocked' as const // ce que porte encore le GanttTask

    // Sans le correctif : deriveTaskStatus(60, 'blocked') restait bloqué à tort.
    expect(deriveTaskStatus(60, currentStoredStatus)).toBe('blocked') // confirme le piège dans deriveTaskStatus lui-même (attendu, protège l'appel direct)

    // Avec statusFor (le chemin réellement emprunté par applyVisitToPlanning),
    // le correctif doit court-circuiter ce piège dès lors que la visite EN
    // COURS ne signale plus de blocage (check.state !== 'blocked').
    const checkUnblockedAt60 = { taskId: 't', lotId: 'L', title: 'T', state: 'ok' as const, progress: 60 }
    expect(statusFor(checkUnblockedAt60, currentStoredStatus)).toBe('in-progress') // plus 'blocked'

    const checkUnblockedAt100 = { taskId: 't', lotId: 'L', title: 'T', state: 'ok' as const, progress: 100 }
    expect(statusFor(checkUnblockedAt100, currentStoredStatus)).toBe('completed') // atteint bien "terminé"
  })

  it('100 % reste "completed" même si le statut de départ était autre chose que blocked', () => {
    expect(deriveTaskStatus(100, 'not-started')).toBe('completed')
    expect(deriveTaskStatus(100, 'delayed')).toBe('completed')
  })

  it('un blocage RÉEL (toujours actif cette visite) reste prioritaire sur l’avancement, à 100 % y compris', () => {
    const stillBlocked = { taskId: 't', lotId: 'L', title: 'T', state: 'blocked' as const, progress: 100, blockedBy: ['x'] }
    expect(statusFor(stillBlocked, 'in-progress')).toBe('blocked') // un vrai blocage n'est jamais écrasé par le %
  })
})
