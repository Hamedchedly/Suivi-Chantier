import { describe, expect, it } from 'vitest'
import {
  currentProgress, progressJustBefore, appendProgressEntry, deriveCalculatedEntries,
  genesisEntryFor, withGenesisEntries, ProgressHistoryEntry,
} from './progressHistory'
import { GanttTask } from '../types/gantt'

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

let seq = 0
const entry = (effective_date: string, new_progress: number, over: Partial<ProgressHistoryEntry> = {}): ProgressHistoryEntry => ({
  id: `e${seq++}`, taskId: 'T-1', effective_date, created_at: over.created_at ?? `${effective_date}T00:00:00.000Z`,
  old_progress: 0, new_progress, source: 'manual',
  ...over,
})

const task = (over: Partial<GanttTask> = {}): GanttTask => ({
  id: 'T-1', lot_id: 'L05', title: 'Doublage',
  planned_start: d('2026-02-16'), planned_end: d('2026-03-08'), planned_duration: 15,
  progress: 0, status: 'not-started', priority: 'medium',
  dependencies: [], is_milestone: false, is_critical: false,
  ...over,
})

describe('currentProgress', () => {
  it('fallback (0 par défaut) sans historique', () => {
    expect(currentProgress([])).toBe(0)
    expect(currentProgress([], 42)).toBe(42)
  })

  it('dernière entrée par ordre chronologique (effective_date), pas par ordre d’insertion', () => {
    const history = [entry('2026-09-21', 70), entry('2026-09-10', 0), entry('2026-09-15', 30)]
    expect(currentProgress(history)).toBe(70)
  })

  it('à effective_date égale, created_at départage (le plus récemment saisi gagne)', () => {
    const history = [
      entry('2026-09-15', 30, { created_at: '2026-09-15T08:00:00.000Z' }),
      entry('2026-09-15', 50, { created_at: '2026-09-15T14:00:00.000Z' }),
    ]
    expect(currentProgress(history)).toBe(50)
  })
})

describe('progressJustBefore', () => {
  it('0 si aucune entrée antérieure', () => {
    expect(progressJustBefore([entry('2026-09-15', 30)], '2026-09-10', '2026-09-10T00:00:00.000Z')).toBe(0)
  })

  it('renvoie l’état juste avant le point d’insertion', () => {
    const history = [entry('2026-09-10', 0), entry('2026-09-15', 30)]
    expect(progressJustBefore(history, '2026-09-21', '2026-09-21T00:00:00.000Z')).toBe(30)
  })
})

describe('appendProgressEntry', () => {
  it('ajoute une nouvelle entrée sans jamais supprimer les précédentes', () => {
    const h1 = appendProgressEntry([], { taskId: 'T-1', effective_date: '2026-09-10', new_progress: 0, source: 'manual' })
    const h2 = appendProgressEntry(h1, { taskId: 'T-1', effective_date: '2026-09-15', new_progress: 30, source: 'manual' })
    expect(h2).toHaveLength(2)
    expect(currentProgress(h2)).toBe(30)
  })

  it('une visite qui se réécrit (même visitId+taskId) remplace sa PROPRE entrée, pas les autres', () => {
    const h1 = appendProgressEntry([], { taskId: 'T-1', effective_date: '2026-09-15', new_progress: 30, source: 'visit', visitId: 'V1' })
    const h2 = appendProgressEntry(h1, { taskId: 'T-1', effective_date: '2026-09-10', new_progress: 0, source: 'visit', visitId: 'V0' })
    const h3 = appendProgressEntry(h2, { taskId: 'T-1', effective_date: '2026-09-15', new_progress: 20, source: 'visit', visitId: 'V1' })
    expect(h3).toHaveLength(2) // V1 corrigée en place, V0 toujours là
    expect(currentProgress(h3)).toBe(20)
  })

  it('deux visites différentes s’ajoutent toujours (jamais de remplacement croisé)', () => {
    const h1 = appendProgressEntry([], { taskId: 'T-1', effective_date: '2026-09-10', new_progress: 10, source: 'visit', visitId: 'V1' })
    const h2 = appendProgressEntry(h1, { taskId: 'T-1', effective_date: '2026-09-20', new_progress: 40, source: 'visit', visitId: 'V2' })
    expect(h2).toHaveLength(2)
  })

  it('renseigne old_progress à partir de l’état juste avant', () => {
    const h1 = appendProgressEntry([], { taskId: 'T-1', effective_date: '2026-09-10', new_progress: 20, source: 'manual' })
    const h2 = appendProgressEntry(h1, { taskId: 'T-1', effective_date: '2026-09-15', new_progress: 60, source: 'manual' })
    expect(h2[1].old_progress).toBe(20)
  })
})

describe('deriveCalculatedEntries', () => {
  it('une entrée par tâche PARENTE dont l’avancement calculé a changé', () => {
    const before = [task({ id: 'L', progress: 0, children: [task({ id: 'c1', progress: 0 })] })]
    const after = [task({ id: 'L', progress: 50, children: [task({ id: 'c1', progress: 100 })] })]
    const out = deriveCalculatedEntries(before, after, { effective_date: '2026-09-15' })
    expect(out).toHaveLength(1)
    expect(out[0].taskId).toBe('L')
    expect(out[0].source).toBe('calculated')
    expect(out[0].old_progress).toBe(0)
    expect(out[0].new_progress).toBe(50)
  })

  it('aucune entrée si l’avancement du parent n’a pas changé', () => {
    const before = [task({ id: 'L', progress: 50, children: [task({ id: 'c1', progress: 50 })] })]
    const after = [task({ id: 'L', progress: 50, children: [task({ id: 'c1', progress: 50 })] })]
    expect(deriveCalculatedEntries(before, after, { effective_date: '2026-09-15' })).toHaveLength(0)
  })

  it('ne produit jamais d’entrée pour une feuille (pas de children)', () => {
    const before = [task({ id: 'T-1', progress: 0 })]
    const after = [task({ id: 'T-1', progress: 40 })]
    expect(deriveCalculatedEntries(before, after, { effective_date: '2026-09-15' })).toHaveLength(0)
  })
})

describe('genesisEntryFor / withGenesisEntries', () => {
  it('null pour une tâche parente (pas de genèse directe)', () => {
    expect(genesisEntryFor(task({ children: [task({ id: 'c1' })] }))).toBeNull()
  })

  it('reproduit fidèlement la progression déjà stockée, jamais une donnée inventée', () => {
    const t = task({ progress: 65, actual_start: d('2026-03-01') })
    const g = genesisEntryFor(t)
    expect(g?.new_progress).toBe(65)
    expect(g?.effective_date).toBe('2026-03-01')
  })

  it('created_at à l’époque Unix : toujours supplantée par une vraie observation', () => {
    const g = genesisEntryFor(task({ progress: 20 }))
    expect(g?.created_at).toBe(new Date(0).toISOString())
  })

  it('withGenesisEntries ne backfille que les tâches sans historique existant', () => {
    const tasks = [task({ id: 'T-1', progress: 20 }), task({ id: 'T-2', progress: 80 })]
    const existing = [entry('2026-09-10', 20)]
    existing[0].taskId = 'T-1'
    const out = withGenesisEntries(tasks, existing)
    expect(out.filter(h => h.taskId === 'T-1')).toHaveLength(1) // pas de doublon
    expect(out.filter(h => h.taskId === 'T-2')).toHaveLength(1) // backfillée
  })
})
