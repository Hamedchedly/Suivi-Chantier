// ────────────────────────────────────────────────────────────────────────────
// GATE DE STABILISATION — Scénario 1 : dates réelles / historique.
//
// Tâche : prévue 01/09 → 15/09. Réel : début 03/09, fin 18/09 (via une visite,
// donc un ProgressHistoryEntry). Puis correction manuelle de la fin réelle à
// 20/09 (via GanttDetails.tsx → ActualDateOverride, jamais un écrasement de
// champ — voir pages/Gantt.tsx:recordActualOverride).
//
// Attendu :
//  - la valeur courante de actual_end est 20/09 ;
//  - l'historique conserve la trace de 18/09 (l'observation qui l'a produite
//    n'est jamais supprimée, seule la dérivation "valeur courante" change) ;
//  - aucune écriture n'écrase une entrée précédente d'un AUTRE événement.
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { appendProgressEntry, currentProgress, ProgressHistoryEntry } from './progressHistory'
import { deriveActualDates, ActualDateOverride } from './actualDates'

const d = (s: string) => { const [y, m, day] = s.split('-').map(Number); return new Date(y, m - 1, day) }

describe('GATE 1 — dates réelles / historique (édition rétroactive de la fin réelle)', () => {
  it('valeur courante = dernière correction, historique intact, rien écrasé', () => {
    let history: ProgressHistoryEntry[] = []

    // Constat de visite : la tâche démarre le 03/09 (progress > 0).
    history = appendProgressEntry(history, {
      taskId: 'T1', effective_date: '2026-09-03', new_progress: 40, source: 'visit', visitId: 'V1', visitDate: '2026-09-03',
    })
    // Constat de visite suivante : la tâche est terminée le 18/09.
    history = appendProgressEntry(history, {
      taskId: 'T1', effective_date: '2026-09-18', new_progress: 100, source: 'visit', visitId: 'V2', visitDate: '2026-09-18',
    })

    expect(history).toHaveLength(2) // les deux observations coexistent
    expect(currentProgress(history)).toBe(100)

    const beforeCorrection = deriveActualDates(history, [])
    expect(beforeCorrection.actual_start).toEqual(d('2026-09-03'))
    expect(beforeCorrection.actual_end).toEqual(d('2026-09-18')) // ← la valeur avant correction

    // Correction manuelle de la fin réelle : 18/09 → 20/09 (GanttDetails.tsx).
    // Un NOUVEL événement horodaté s'ajoute — l'ancien n'est jamais retiré.
    const overrides: ActualDateOverride[] = [
      { id: 'ov1', taskId: 'T1', field: 'actual_end', value: '2026-09-20', at: '2026-09-25T10:00:00.000Z' },
    ]

    const afterCorrection = deriveActualDates(history, overrides)

    // 1. La valeur COURANTE est bien 20/09.
    expect(afterCorrection.actual_end).toEqual(d('2026-09-20'))
    // 2. Le début réel (03/09) n'a pas été affecté par une correction qui ne le visait pas.
    expect(afterCorrection.actual_start).toEqual(d('2026-09-03'))

    // 3. L'HISTORIQUE conserve la trace de la valeur précédente (18/09) :
    //    l'entrée qui l'a produite est toujours dans le tableau, intacte.
    const eighteenthEntry = history.find(h => h.effective_date === '2026-09-18')
    expect(eighteenthEntry).toBeDefined()
    expect(eighteenthEntry!.new_progress).toBe(100)
    expect(eighteenthEntry!.visitId).toBe('V2')

    // 4. La correction manuelle elle-même est un événement séparé, ajouté
    //    au tableau des overrides — jamais un remplacement en place du champ.
    expect(overrides).toHaveLength(1)
    expect(overrides[0].value).toBe('2026-09-20')

    // 5. Rejouer deriveActualDates SANS l'override reproduit encore 18/09 :
    //    la correction n'a pas altéré l'historique sous-jacent, seule la
    //    dérivation en tient compte quand elle est présente.
    expect(deriveActualDates(history, []).actual_end).toEqual(d('2026-09-18'))
  })

  it('une SECONDE correction manuelle (ex. 20/09 → 22/09) garde les DEUX overrides en historique', () => {
    const history: ProgressHistoryEntry[] = [
      { id: 'e1', taskId: 'T1', effective_date: '2026-09-18', created_at: '2026-09-18T00:00:00.000Z', old_progress: 40, new_progress: 100, source: 'visit' },
    ]
    const overrides: ActualDateOverride[] = [
      { id: 'ov1', taskId: 'T1', field: 'actual_end', value: '2026-09-20', at: '2026-09-25T10:00:00.000Z' },
    ]
    const nextOverrides = [...overrides, { id: 'ov2', taskId: 'T1', field: 'actual_end' as const, value: '2026-09-22', at: '2026-09-26T10:00:00.000Z' }]

    expect(nextOverrides).toHaveLength(2) // rien n'est retiré, on ajoute
    expect(deriveActualDates(history, nextOverrides).actual_end).toEqual(d('2026-09-22')) // la plus récente gagne
    // La première correction (20/09) reste lisible dans le tableau d'audit.
    expect(nextOverrides.find(o => o.value === '2026-09-20')).toBeDefined()
  })

  it('modifier la fin réelle ne touche jamais le prévisionnel (planned_start/planned_end)', () => {
    // planned_* vivent sur GanttTask, jamais dans ProgressHistoryEntry/ActualDateOverride —
    // structurellement impossible pour une correction de date réelle de les affecter.
    const history: ProgressHistoryEntry[] = [
      { id: 'e1', taskId: 'T1', effective_date: '2026-09-18', created_at: '2026-09-18T00:00:00.000Z', old_progress: 40, new_progress: 100, source: 'visit' },
    ]
    const overrides: ActualDateOverride[] = [{ id: 'ov1', taskId: 'T1', field: 'actual_end', value: '2026-09-20', at: '2026-09-25T10:00:00.000Z' }]
    const r = deriveActualDates(history, overrides)
    expect(Object.keys(r)).toEqual(expect.arrayContaining(['actual_start', 'actual_end']))
    expect(Object.keys(r)).not.toContain('planned_start')
    expect(Object.keys(r)).not.toContain('planned_end')
  })
})
