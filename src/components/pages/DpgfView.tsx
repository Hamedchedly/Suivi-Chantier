import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { DpgfLine, lineTotal, lotTotal, grandTotal, groupByLot } from '../../lib/dpgf'
import { getDpgf, saveDpgf } from '../../lib/repo'
import { euros } from '../../lib/finance'

const LOT_LABELS: Record<string, string> = {
  L05: 'LOT 05 — Menuiseries', L06: 'LOT 06 — Électricité', L07: 'LOT 07 — CVC', L08: 'LOT 08 — Embellissements',
}
const lotLabel = (id: string) => LOT_LABELS[id] ?? id
const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : 0 }

export function DpgfView() {
  const [lines, setLines] = useState<DpgfLine[]>(getDpgf)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { saveDpgf(lines) }, [lines])

  const update = (id: string, patch: Partial<DpgfLine>) =>
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
  const remove = (id: string) => setLines(prev => prev.filter(l => l.id !== id))
  const addLine = (lotId: string) =>
    setLines(prev => [...prev, { id: `dl${Date.now()}`, lotId, designation: '', unite: 'u', quantite: 0, prixUnitaire: 0 }])

  // Import an .xlsx: expects columns Lot | Désignation | Unité | Quantité | PU (headers, case-insensitive).
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const wb = XLSX.read(await file.arrayBuffer())
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
      const pick = (r: Record<string, unknown>, keys: string[]) => {
        const k = Object.keys(r).find(x => keys.some(t => x.toLowerCase().includes(t)))
        return k ? r[k] : undefined
      }
      const imported: DpgfLine[] = rows.map((r, i) => ({
        id: `imp${Date.now()}-${i}`,
        lotId: String(pick(r, ['lot']) ?? 'L05').toUpperCase().replace(/[^L0-9]/g, '') || 'L05',
        designation: String(pick(r, ['désign', 'design', 'libell']) ?? ''),
        unite: String(pick(r, ['unit', 'unité']) ?? 'u'),
        quantite: num(String(pick(r, ['quant', 'qté', 'qte']) ?? 0)),
        prixUnitaire: num(String(pick(r, ['pu', 'prix']) ?? 0)),
      })).filter(l => l.designation)
      if (imported.length) setLines(prev => [...prev, ...imported])
    } catch { /* ignore malformed file */ }
    if (fileRef.current) fileRef.current.value = ''
  }

  const groups = groupByLot(lines)

  return (
    <div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Total DPGF (HT)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--navy)' }}>{euros(grandTotal(lines))}</div>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onImport} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()} style={importBtn}><Upload size={15} /> Importer Excel</button>
      </div>

      {groups.map(({ lotId, lines: ll }) => (
        <div key={lotId} style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '13px' }}>{lotLabel(lotId)}</div>
            <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '13px' }}>{euros(lotTotal(lines, lotId))}</div>
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: '12px', background: '#fff' }}>
            <table style={{ width: '100%', minWidth: '520px', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: 'var(--navy)' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Désignation</th>
                  <th style={th}>Unité</th>
                  <th style={th}>Qté</th>
                  <th style={th}>PU HT</th>
                  <th style={{ ...th, textAlign: 'right' }}>Montant HT</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {ll.map(l => (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={td}><input value={l.designation} onChange={e => update(l.id, { designation: e.target.value })} placeholder="Désignation" style={{ ...cell, textAlign: 'left', minWidth: '160px' }} /></td>
                    <td style={td}><input value={l.unite} onChange={e => update(l.id, { unite: e.target.value })} disabled={l.forfait} style={{ ...cell, width: '54px', textAlign: 'center', opacity: l.forfait ? 0.5 : 1 }} /></td>
                    {l.forfait ? (
                      <td style={td} colSpan={2}><input value={String(l.montantForfait ?? 0)} onChange={e => update(l.id, { montantForfait: num(e.target.value) })} placeholder="Montant forfait HT" style={{ ...cell, width: '100%', textAlign: 'right' }} /></td>
                    ) : (
                      <>
                        <td style={td}><input value={String(l.quantite)} onChange={e => update(l.id, { quantite: num(e.target.value) })} style={{ ...cell, width: '64px', textAlign: 'right' }} /></td>
                        <td style={td}><input value={String(l.prixUnitaire)} onChange={e => update(l.id, { prixUnitaire: num(e.target.value) })} style={{ ...cell, width: '78px', textAlign: 'right' }} /></td>
                      </>
                    )}
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap' }}>{euros(lineTotal(l))}</td>
                    <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => update(l.id, { forfait: !l.forfait })} title="Basculer forfait" style={{ border: '1px solid var(--line)', borderRadius: '6px', background: l.forfait ? 'var(--sky-soft)' : '#fff', color: l.forfait ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', padding: '3px 7px', fontSize: '10px', fontWeight: 700, marginRight: '4px' }}>Fft</button>
                      <button onClick={() => remove(l.id)} style={{ border: 'none', background: 'none', color: 'var(--bad)', cursor: 'pointer', padding: 2, verticalAlign: 'middle' }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => addLine(lotId)} style={addBtn}><Plus size={13} /> Ligne</button>
        </div>
      ))}
    </div>
  )
}

const th: React.CSSProperties = { padding: '8px 8px', textAlign: 'center', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.03em', fontWeight: 700 }
const td: React.CSSProperties = { padding: '4px 6px', textAlign: 'center' }
const cell: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: '6px', padding: '6px 7px', fontSize: '12px', background: '#fff', boxSizing: 'border-box' }
const importBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 13px', borderRadius: '10px', border: 'none', background: 'var(--navy)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }
const addBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '6px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '12px', fontWeight: 600, color: 'var(--navy)', cursor: 'pointer' }
