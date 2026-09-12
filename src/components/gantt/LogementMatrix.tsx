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

export default function LogementMatrix({ tasks }: LogementMatrixProps) {
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

  // Avancement des tâches d'un lot concernant une zone : moyenne + retard si l'une est en retard.
  const aggregate = (lot: GanttTask, unitId: string) => {
    const concerned = (lot.children ?? []).filter(c => taskConcernsUnit(units, links, c.id, unitId))
    if (concerned.length === 0) return null
    const progress = Math.round(concerned.reduce((s, c) => s + c.progress, 0) / concerned.length)
    const late = concerned.some(c => isLate(c, today) || c.status === 'delayed' || c.status === 'blocked')
    return { progress, late }
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e4ecf2', borderRadius: '8px', background: '#fff' }}>
      <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%', fontSize: '12px' }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', left: 0, zIndex: 2, background: '#f8fafc', padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e4ecf2', minWidth: '140px', color: '#02457A', fontSize: '11px' }}>
              Lot \ Zone
            </th>
            {zones.map(z => (
              <th key={z.refId} style={{ padding: '8px 6px', textAlign: 'center', borderBottom: '1px solid #e4ecf2', borderLeft: '1px solid #eef2f6', color: '#02457A', fontSize: '10px', minWidth: '64px', whiteSpace: 'nowrap' }}>
                {z.label}
                <div style={{ fontSize: '8px', color: '#9bb0c2', fontWeight: 400 }}>{z.buildingLabel}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lots.map(lot => (
            <tr key={lot.id}>
              <td style={{ position: 'sticky', left: 0, zIndex: 1, background: '#fff', padding: '8px 12px', borderBottom: '1px solid #eef2f6', fontWeight: 600, color: lot.is_critical ? '#dc2626' : '#02457A', fontSize: '11px' }}>
                {lot.title.replace(/^LOT \d+ - /, '')}
                <div style={{ fontSize: '9px', color: '#9bb0c2', fontWeight: 400 }}>{lot.lot_id}</div>
              </td>
              {zones.map(z => {
                const agg = aggregate(lot, z.refId)
                const c = cellColor(agg)
                return (
                  <td key={z.refId} style={{ padding: '4px', borderBottom: '1px solid #eef2f6', borderLeft: '1px solid #eef2f6', textAlign: 'center' }}>
                    <div title={agg ? `${z.label} • ${agg.progress}%` : 'Aucune tâche rattachée'}
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
  )
}
