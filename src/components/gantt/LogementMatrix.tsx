import { GanttTask } from '../../types/gantt'
import { LOGEMENTS } from '../../data/zones'
import { isLate } from '../../lib/schedule'

interface LogementMatrixProps {
  tasks: GanttTask[]
}

function cellColor(task: GanttTask | undefined, today: Date): { bg: string; fg: string; label: string } {
  if (!task) return { bg: '#f1f5f9', fg: '#b8c4ce', label: '—' }
  if (task.progress >= 100) return { bg: '#dcfce7', fg: '#15803d', label: '100%' }
  if (isLate(task, today) || task.status === 'delayed' || task.status === 'blocked') {
    return { bg: '#fdecec', fg: '#dc2626', label: `${task.progress}%` }
  }
  if (task.progress > 0) return { bg: '#e7f0fb', fg: '#018ABE', label: `${task.progress}%` }
  return { bg: '#f1f5f9', fg: '#5b7183', label: '0%' }
}

export default function LogementMatrix({ tasks }: LogementMatrixProps) {
  const today = new Date()
  const lots = tasks.filter(t => t.children?.length)

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e4ecf2', borderRadius: '8px', background: '#fff' }}>
      <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%', fontSize: '12px' }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', left: 0, zIndex: 2, background: '#f8fafc', padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e4ecf2', minWidth: '140px', color: '#02457A', fontSize: '11px' }}>
              Lot \ Logement
            </th>
            {LOGEMENTS.map(l => (
              <th key={l.id} style={{ padding: '8px 6px', textAlign: 'center', borderBottom: '1px solid #e4ecf2', borderLeft: '1px solid #eef2f6', color: '#02457A', fontSize: '10px', minWidth: '64px', whiteSpace: 'nowrap' }}>
                {l.label}
                <div style={{ fontSize: '8px', color: '#9bb0c2', fontWeight: 400 }}>{l.zoneLabel}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lots.map(lot => {
            const byLogement = new Map<string, GanttTask>()
            for (const child of lot.children ?? []) {
              if (child.logement_id) byLogement.set(child.logement_id, child)
            }
            return (
              <tr key={lot.id}>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: '#fff', padding: '8px 12px', borderBottom: '1px solid #eef2f6', fontWeight: 600, color: lot.is_critical ? '#dc2626' : '#02457A', fontSize: '11px' }}>
                  {lot.title.replace(/^LOT \d+ - /, '')}
                  <div style={{ fontSize: '9px', color: '#9bb0c2', fontWeight: 400 }}>{lot.lot_id}</div>
                </td>
                {LOGEMENTS.map(l => {
                  const t = byLogement.get(l.id)
                  const c = cellColor(t, today)
                  return (
                    <td key={l.id} style={{ padding: '4px', borderBottom: '1px solid #eef2f6', borderLeft: '1px solid #eef2f6', textAlign: 'center' }}>
                      <div
                        title={t ? `${t.title} • ${t.progress}%` : 'Pas de tâche'}
                        style={{ background: c.bg, color: c.fg, borderRadius: '6px', padding: '8px 4px', fontWeight: 600, fontSize: '11px', cursor: t ? 'default' : 'default' }}
                      >
                        {c.label}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
