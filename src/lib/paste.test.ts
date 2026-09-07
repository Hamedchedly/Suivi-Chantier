import { describe, expect, it } from 'vitest'
import { parsePaste } from './paste'

describe('parsePaste', () => {
  it('parses rows with a header line dropped', () => {
    const text = [
      'Désignation\tRéférence\tUnié\tQté\tP.U.\tMontant',
      'Isolation\tISO1\tm2\t120\t12,5\t1500',
      'Enduit\tENDO1\tm2\t80\t8\t640'
    ].join('\n')
    const rows = parsePaste(text)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ designation: 'Isolation', kind: 'item', quantity: '120', unit: 'm2', amount: '1500' })
    expect(rows[1]).toMatchObject({ designation: 'Enduit', kind: 'item' })
  })
  it('classifies lines without financial data as sections', () => {
    const rows = parsePaste('Façade de ITE')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ designation: 'Façade de ITE', kind: 'section' })
  })
  it('drops TOTAL lines and blank lines', () => {
    const rows = parsePaste('TOTAL HT\n\nSous-total')
    expect(rows).toHaveLength(0)
  })
})