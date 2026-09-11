// Sélection multiple : logique pure, partagée par les listes qui autorisent la
// suppression en lot (réserves, visites…). Aucune dépendance à React.

export type Selection = ReadonlySet<string>

export const EMPTY_SELECTION: Selection = new Set<string>()

export function toggle(selection: Selection, id: string): Selection {
  const next = new Set(selection)
  if (next.has(id)) next.delete(id); else next.add(id)
  return next
}

/**
 * Case « tout sélectionner » : coche l'ensemble des identifiants visibles, ou
 * les décoche tous s'ils le sont déjà. Les éléments hors filtre ne sont jamais
 * touchés — on ne supprime que ce que l'utilisateur voit.
 */
export function toggleAll(selection: Selection, ids: string[]): Selection {
  if (ids.length > 0 && ids.every(id => selection.has(id))) {
    const next = new Set(selection)
    ids.forEach(id => next.delete(id))
    return next
  }
  const next = new Set(selection)
  ids.forEach(id => next.add(id))
  return next
}

export function allSelected(selection: Selection, ids: string[]): boolean {
  return ids.length > 0 && ids.every(id => selection.has(id))
}

/** Ne garde que les identifiants encore présents — après une suppression. */
export function prune(selection: Selection, ids: string[]): Selection {
  const keep = new Set(ids)
  return new Set([...selection].filter(id => keep.has(id)))
}

export function removeSelected<T extends { id: string }>(items: T[], selection: Selection): T[] {
  return items.filter(i => !selection.has(i.id))
}

/** « 3 réserves sélectionnées » — accord en genre et en nombre. */
export function selectionLabel(count: number, singular: string, feminine = false): string {
  const e = feminine ? 'e' : ''
  if (count <= 1) return `${count} ${singular} sélectionné${e}`
  return `${count} ${singular}s sélectionné${e}s`
}
