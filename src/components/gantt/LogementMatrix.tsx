import { useState } from 'react'
import { GanttTask } from '../../types/gantt'
import { isLate } from '../../lib/schedule'
import { getUnits, getTaskUnits, getZoneRefs } from '../../lib/repo'
import { taskConcernsUnit } from '../../lib/units'

interface LogementMatrixProps {
  tasks: GanttTask[]
}

/** Couleur d'une cellule d'après l'avancement agrégé des tâches concernées. */
function cellColor(agg: { progress: number; late: boolean } | null): { bg: string; fg: string; label: string } {
  if (!agg) return { bg: '#f1f5f9', fg: '#b8c4ce', label: '—' }
  if (agg.progress >= 100) return { bg: '#dcfce7', fg: '#15803d', label: '100%' }
  if (agg.late) return { bg: '#fdecec', fg: '#dc2626', label: `${agg.progress}%` }
  if (agg.progress > 0) return { bg: '#e7f0fb', fg: '#018ABE', label: `${agg.progress}%` }
  return { bg: '#f1f5f9', fg: '#5b7183', label: '0%' }
}

type RowMode = 'unit' | 'building'

/** Une ligne du damier : soit une zone (logement/commun), soit un bâtiment. */
interface RowDef { id: string; label: string; sub: string; unitIds: string[] }

const seg = (on: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600,
  cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? '#02457A' : '#5b7183',
  boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none', whiteSpace: 'nowrap',
})

export default function LogementMatrix({ tasks }: LogementMatrixProps) {
  const [rowMode, setRowMode] = useState<RowMode>('unit')
  const today = new Date()
  const lots = tasks.filter(t => t.children?.length)
  const units = getUnits()
  const links = getTaskUnits()
  const zones = getZoneRefs()

  if (zones.length === 0) {
    return (
      <div style={{ fontSize: '12px', color: '#5b7183', padding: '18px', border: '1px dashed #d1dce5', borderRadius: '10px' }}>
        Aucune zone définie. Décrivez le chantier (bâtiments, logements) et rattachez-y des tâches
        depuis « Bâtiments &amp; zones » pour alimenter ce damier.
      </div>
    )
  }

  // Lignes : une par zone (logement/commun), ou une par bâtiment (agrège ses zones).
  const rows: RowDef[] = rowMode === 'unit'
    ? zones.map(z => ({ id: z.refId, label: z.label, sub: z.buildingLabel, unitIds: [z.refId] }))
    : Object.values(
        zones.reduce<Record<string, RowDef>>((acc, z) => {
          const key = z.buildingId
          if (!acc[key]) acc[key] = { id: key, label: z.buildingLabel, sub: '', unitIds: [] }
          acc[key].unitIds.push(z.refId)
          return acc
        }, {}),
      ).map(b => ({ ...b, sub: `${b.unitIds.length} zone${b.unitIds.length > 1 ? 's' : ''}` }))

  // Avancement des tâches d'un lot concernant une ou plusieurs zones : moyenne,
  // en retard si l'une des tâches concernées est en retard.
  const aggregate = (lot: GanttTask, unitIds: string[]) => {
    const concerned = (lot.children ?? []).filter(c =>
      unitIds.some(u => taskConcernsUnit(units, links, c.id, u)),
    )
    if (concerned.length === 0) return null
    const progress = Math.round(concerned.reduce((s, c) => s + c.progress, 0) / concerned.length)
    const late = concerned.some(c => isLate(c, today) || c.status === 'delayed' || c.status === 'blocked')
    return { progress, late }
  }

  const rowHeader = rowMode === 'unit' ? 'Logement \\ Lot' : 'Bâtiment \\ Lot'

  return (
    <>
      <div style={{ display: 'flex', gap: '4px', background: '#eef2f6', padding: '3px', borderRadius: '8px', marginBottom: '10px', width: 'fit-content' }}>
        <button onClick={() => setRowMode('unit')} style={seg(rowMode === 'unit')}>Par appartement</button>
        <button onClick={() => setRowMode('building')} style={seg(rowMode === 'building')}>Par bâtiment</button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e4ecf2', borderRadius: '8px', background: '#fff' }}>
        <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, zIndex: 2, background: '#f8fafc', padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e4ecf2', minWidth: '150px', color: '#02457A', fontSize: '11px' }}>
                {rowHeader}
              </th>
              {lots.map(lot => (
                <th key={lot.id} style={{ padding: '8px 6px', textAlign: 'center', borderBottom: '1px solid #e4ecf2', borderLeft: '1px solid #eef2f6', color: lot.is_critical ? '#dc2626' : '#02457A', fontSize: '10px', minWidth: '72px', whiteSpace: 'nowrap' }}>
                  {lot.lot_id}
                  <div style={{ fontSize: '8px', color: '#9bb0c2', fontWeight: 400 }} title={lot.title}>
                    {lot.title.replace(/^LOT\s*\d+\s*[—-]\s*/i, '').slice(0, 14)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: '#fff', padding: '8px 12px', borderBottom: '1px solid #eef2f6', fontWeight: 600, color: '#02457A', fontSize: '11px' }}>
                  {row.label}
                  {row.sub && <div style={{ fontSize: '9px', color: '#9bb0c2', fontWeight: 400 }}>{row.sub}</div>}
                </td>
                {lots.map(lot => {
                  const agg = aggregate(lot, row.unitIds)
                  const c = cellColor(agg)
                  return (
                    <td key={lot.id} style={{ padding: '4px', borderBottom: '1px solid #eef2f6', borderLeft: '1px solid #eef2f6', textAlign: 'center' }}>
                      <div title={agg ? `${row.label} • ${lot.title} • ${agg.progress}%` : 'Aucune tâche rattachée'}
                        style={{ background: c.bg, color: c.fg, borderRadius: '6px', padding: '8px 4px', fontWeight: 600, fontSize: '11px' }}>
                        {c.label}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
