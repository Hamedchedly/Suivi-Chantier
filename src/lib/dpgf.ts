// DPGF — Décomposition du Prix Global et Forfaitaire (quantitatif par lot).
// Pure helpers only.

export interface DpgfLine {
  id: string
  lotId: string
  designation: string
  unite: string          // m², u, ml, ens, forfait…
  quantite: number
  prixUnitaire: number   // € HT
  forfait?: boolean      // lump sum: amount entered directly (montantForfait)
  montantForfait?: number
}

/** Line amount: forfait → the lump sum; otherwise quantity × unit price (HT). */
export function lineTotal(l: DpgfLine): number {
  if (l.forfait) return l.montantForfait ?? 0
  return l.quantite * l.prixUnitaire
}

/** Sum of a lot's lines (HT). */
export function lotTotal(lines: DpgfLine[], lotId: string): number {
  return lines.filter(l => l.lotId === lotId).reduce((s, l) => s + lineTotal(l), 0)
}

/** Grand total across all lines (HT). */
export function grandTotal(lines: DpgfLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0)
}

/** Group lines by lot id, preserving insertion order of lots. */
export function groupByLot(lines: DpgfLine[]): { lotId: string; lines: DpgfLine[] }[] {
  const order: string[] = []
  const map = new Map<string, DpgfLine[]>()
  for (const l of lines) {
    if (!map.has(l.lotId)) { map.set(l.lotId, []); order.push(l.lotId) }
    map.get(l.lotId)!.push(l)
  }
  return order.map(lotId => ({ lotId, lines: map.get(lotId)! }))
}
