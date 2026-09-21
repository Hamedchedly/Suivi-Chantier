// ────────────────────────────────────────────────────────────────────────────
// LE rollup d'avancement — une seule règle, réutilisée partout où un parent
// (tâche, lot, logement, opération) doit remonter l'avancement de ses enfants.
//
// Remplace cinq implémentations dupliquées et incohérentes (recomputeTask/
// recomputeLot dans planning.ts, overallProgress dans schedule.ts, makeParent
// dans pages/Gantt.tsx, aggregate dans LogementMatrix.tsx, lot() dans
// gambettaData.ts) qui faisaient chacune une moyenne simple, sans pondération,
// avec des exclusions de milestone incohérentes d'un endroit à l'autre.
//
// Règle : moyenne pondérée par planned_duration (« durée contractuelle » —
// règle de repli explicite demandée en l'absence de toute pondération
// existante dans le moteur), milestones et tâches N/A exclus.
//
// Module pur : aucune entrée/sortie.
// ────────────────────────────────────────────────────────────────────────────

export interface RollupItem {
  progress: number
  planned_duration: number
  is_milestone: boolean
  is_na?: boolean
}

/**
 * Moyenne pondérée par planned_duration, milestones et N/A exclus. Jamais NaN :
 * si tous les items pesables ont une durée <= 0 (données legacy sans durée),
 * replie sur une moyenne simple plutôt que de produire 0% de façon trompeuse.
 */
export function weightedProgress(items: RollupItem[]): number {
  const weighable = items.filter(i => !i.is_milestone && !i.is_na)
  if (!weighable.length) return 0

  const totalWeight = weighable.reduce((s, i) => s + Math.max(0, i.planned_duration), 0)
  if (totalWeight <= 0) {
    return Math.round(weighable.reduce((s, i) => s + i.progress, 0) / weighable.length)
  }
  return Math.round(weighable.reduce((s, i) => s + i.progress * Math.max(0, i.planned_duration), 0) / totalWeight)
}
