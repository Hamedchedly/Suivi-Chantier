// Simple copy/paste helper for DPGF-style task lists.
// Fixed, documented column order: tabs separated:
// Désignation, Référence, Unité, Quantité, P.U., Montant.

export interface PasteTaskRow {
  reference: string
  designation: string
  unit: string
  quantity: string
  unit_price: string
  amount: string
  kind: 'section' | 'item'
}

const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toUpperCase()

const looksLikeHeader = (cells: string[]): boolean =>
  /desig|designation|intitul|prestation/i.test(normalize(cells[0] ?? ''))

export function parsePaste(text: string): PasteTaskRow[] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.split('\t').map((cell) => cell.trim()))
    .filter((cells) => cells.some((cell) => cell !== ''))
  if (lines.length && looksLikeHeader(lines[0])) lines.shift()
  const rows: PasteTaskRow[] = []
  for (const cells of lines) {
    const designation = cells[0] ?? ''
    const reference = cells[1] ?? ''
    const unit = cells[2] ?? ''
    const quantity = cells[3] ?? ''
    const unit_price = cells[4] ?? ''
    const amount = cells[5] ?? ''
    if (designation === '' && reference === '' && unit === '' && quantity === '' && unit_price === '' && amount === '') continue
    if (/^(total|sous[\s-]?total)/i.test(designation)) continue
    const hasOperational = quantity !== '' || unit_price !== '' || amount !== '' || unit !== ''
    rows.push({ reference, designation, unit, quantity, unit_price, amount, kind: hasOperational ? 'item' : 'section' })
  }
  return rows
}