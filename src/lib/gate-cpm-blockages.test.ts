// ────────────────────────────────────────────────────────────────────────────
// GATE DE STABILISATION — Scénario 4 : blocages/CPM bidirectionnel,
// suppression isolée, et refus de cycle.
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { GanttTask } from '../types/gantt'
import { addBlockedTask, removeBlockedTask, setTaskDependencies, durationBetween } from './planning'
import { computeCpm, autoSchedule } from './cpm'

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

const leaf = (id: string, over: Partial<GanttTask> = {}): GanttTask => ({
  id, lot_id: 'L', title: id,
  planned_start: d('2026-01-01'), planned_end: d('2026-01-05'),
  planned_duration: durationBetween(d('2026-01-01'), d('2026-01-05')),
  progress: 0, status: 'not-started', priority: 'medium',
  dependencies: [], is_milestone: false, is_critical: false,
  ...over,
})

const lot = (children: GanttTask[]): GanttTask => ({ ...leaf('LOT'), id: 'LOT', title: 'Lot', children })

describe('GATE 4 — blocages bidirectionnels : A bloque B, B bloque C', () => {
  it('A bloque B ⇒ B.dependencies=[A] ; B bloque C ⇒ C.dependencies=[B] (affichage 4 sens via dependencies)', () => {
    const tasks = [lot([leaf('A'), leaf('B'), leaf('C')])]
    const afterAB = addBlockedTask(tasks, 'A', 'B').tasks
    const afterBC = addBlockedTask(afterAB, 'B', 'C').tasks

    const byId = Object.fromEntries(afterBC[0].children!.map(t => [t.id, t]))
    // "A bloque B" / "B bloquée par A"
    expect(byId.B.dependencies).toEqual(['A'])
    // "B bloque C" / "C bloquée par B"
    expect(byId.C.dependencies).toEqual(['B'])
    expect(byId.A.dependencies).toEqual([]) // A elle-même n'a aucun prédécesseur

    // Le CPM voit bien A→B→C comme une vraie chaîne de prédécesseurs.
    const cpm = computeCpm(afterBC)
    expect(cpm.hasCycle).toBe(false)
  })

  it('supprimer A→B fait disparaître la relation DES DEUX CÔTÉS, B→C reste intact', () => {
    const tasks = [lot([leaf('A'), leaf('B'), leaf('C')])]
    let t = addBlockedTask(tasks, 'A', 'B').tasks
    t = addBlockedTask(t, 'B', 'C').tasks
    t = removeBlockedTask(t, 'A', 'B').tasks

    const byId = Object.fromEntries(t[0].children!.map(x => [x.id, x]))
    expect(byId.B.dependencies).toEqual([]) // A→B disparu
    expect(byId.C.dependencies).toEqual(['B']) // B→C intact
  })

  it('retirer une relation ne touche jamais une dépendance posée ailleurs (union, jamais un remplacement)', () => {
    const tasks = [lot([leaf('A'), leaf('B', { dependencies: ['x-pre-existing'] }), leaf('C')])]
    const afterAdd = addBlockedTask(tasks, 'A', 'B').tasks
    expect((afterAdd[0].children!.find(t => t.id === 'B')!).dependencies).toEqual(['x-pre-existing', 'A'])
    const afterRemove = removeBlockedTask(afterAdd, 'A', 'B').tasks
    expect((afterRemove[0].children!.find(t => t.id === 'B')!).dependencies).toEqual(['x-pre-existing'])
  })
})

describe('GATE 4 — cycle A→B→C→A : refusé à la création (pas seulement toléré au calcul)', () => {
  it('DÉFAUT CORRIGÉ — addBlockedTask refuse désormais la relation qui fermerait le cycle', () => {
    const tasks = [lot([leaf('A'), leaf('B'), leaf('C')])]
    let t = addBlockedTask(tasks, 'A', 'B').tasks   // B bloquée par A
    t = addBlockedTask(t, 'B', 'C').tasks           // C bloquée par B
    const closingTheCycle = addBlockedTask(t, 'C', 'A') // A bloquée par C ⇒ fermerait A→B→C→A

    expect(closingTheCycle.ok).toBe(false)
    expect(closingTheCycle.error).toBe('cycle_detected')
    // Le graphe n'a PAS été modifié par la tentative refusée.
    const byId = Object.fromEntries(closingTheCycle.tasks[0].children!.map(x => [x.id, x]))
    expect(byId.A.dependencies).toEqual([])
  })

  it('même refus via setTaskDependencies directement (le vrai point d’entrée unique, utilisé aussi par le Gantt)', () => {
    // A→B→C existe déjà ici ; tenter de fermer le cycle en ajoutant C→A doit être refusé.
    const clean = [lot([leaf('A'), leaf('B', { dependencies: ['A'] }), leaf('C', { dependencies: ['B'] })])]
    const attempt = setTaskDependencies(clean, 'A', ['C']) // fermerait A→B→C→A
    expect(attempt.ok).toBe(false)
    expect(attempt.error).toBe('cycle_detected')
  })

  it('un auto-référencement direct (une tâche qui dépend d’elle-même) est refusé', () => {
    const tasks = [lot([leaf('A')])]
    const attempt = setTaskDependencies(tasks, 'A', ['A'])
    expect(attempt.ok).toBe(false)
    expect(attempt.error).toBe('cycle_detected')
  })

  it('une chaîne légitime à prédécesseurs multiples (diamant, sans cycle) reste acceptée', () => {
    // A→C, B→C, C→D : pas un cycle, doit passer.
    const tasks = [lot([leaf('A'), leaf('B'), leaf('C'), leaf('D')])]
    const withAC = setTaskDependencies(tasks, 'C', ['A'])
    expect(withAC.ok).toBe(true)
    const withBC = setTaskDependencies(withAC.tasks, 'C', ['A', 'B'])
    expect(withBC.ok).toBe(true)
    const withCD = setTaskDependencies(withBC.tasks, 'D', ['C'])
    expect(withCD.ok).toBe(true)
  })

  it('filet de sécurité : même si un cycle existait déjà (donnée legacy), computeCpm/autoSchedule ne plantent jamais et se dégradent proprement', () => {
    const cyclic = [lot([leaf('A', { dependencies: ['C'] }), leaf('B', { dependencies: ['A'] }), leaf('C', { dependencies: ['B'] })])]
    const cpm = computeCpm(cyclic)
    expect(cpm.hasCycle).toBe(true)
    expect(cpm.criticalIds.size).toBe(0)
    const auto = autoSchedule(cyclic)
    expect(auto.shifted).toEqual([])
    expect(auto.tasks).toBe(cyclic) // renvoyé tel quel, aucune mutation hasardeuse
  })
})
