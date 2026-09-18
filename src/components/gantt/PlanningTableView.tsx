import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { GanttTask } from '../../types/gantt'

interface PlanningTableViewProps {
  tasks: GanttTask[]
  onClose: () => void
  onTaskUpdate?: (taskId: string, updates: Partial<GanttTask>) => void
}

export function PlanningTableView({ tasks, onClose, onTaskUpdate }: PlanningTableViewProps) {
  const fmt = (d?: Date) => (d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

  const flattenTasks = (items: GanttTask[], depth = 0): { task: GanttTask; depth: number }[] => {
    const result: { task: GanttTask; depth: number }[] = []
    for (const task of items) {
      result.push({ task, depth })
      if (task.children?.length) {
        result.push(...flattenTasks(task.children, depth + 1))
      }
    }
    return result
  }

  const flat = flattenTasks(tasks)
  const isLate = (task: GanttTask) => task.actual_end && task.actual_end.getTime() > task.planned_end.getTime()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '95vw', maxHeight: '90vh', width: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e4ecf2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#02457A' }}>Tableau de Planning</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#5b7183' }}>×</button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e4ecf2' }}>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: '#02457A', minWidth: '200px', borderRight: '1px solid #e4ecf2' }}>Tâche</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#02457A', minWidth: '100px', borderRight: '1px solid #e4ecf2' }}>Début contractuel</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#02457A', minWidth: '100px', borderRight: '1px solid #e4ecf2' }}>Fin contractuelle</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#02457A', minWidth: '100px', borderRight: '1px solid #e4ecf2' }}>Début réel</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#02457A', minWidth: '100px', borderRight: '1px solid #e4ecf2' }}>Fin réelle</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#02457A', minWidth: '60px', borderRight: '1px solid #e4ecf2' }}>%</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: '#02457A', minWidth: '150px', borderRight: '1px solid #e4ecf2' }}>Prédécesseurs</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: '#02457A', minWidth: '150px' }}>Successeurs</th>
              </tr>
            </thead>
            <tbody>
              {flat.map(({ task, depth }) => {
                const late = isLate(task)
                const bgColor = late ? '#fee2e2' : depth > 0 ? '#f9fbfd' : '#fff'
                const textColor = late ? '#dc2626' : depth > 0 ? '#5b7183' : '#1f2937'
                return (
                  <tr key={task.id} style={{ background: bgColor, borderBottom: '1px solid #f0f5f9' }}>
                    <td style={{ padding: '10px', color: textColor, fontWeight: depth === 0 ? 600 : 400, paddingLeft: `${10 + depth * 16}px` }}>
                      {task.title}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: textColor }}>
                      {fmt(task.planned_start)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: textColor }}>
                      {fmt(task.planned_end)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: textColor }}>
                      {fmt(task.actual_start)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: textColor, fontWeight: late ? 700 : 400 }}>
                      {fmt(task.actual_end)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', color: textColor, fontWeight: 600 }}>
                      {task.progress}%
                    </td>
                    <td style={{ padding: '10px', color: textColor, fontSize: '11px' }}>
                      {task.dependencies.length > 0 ? task.dependencies.join(', ') : '—'}
                    </td>
                    <td style={{ padding: '10px', color: textColor, fontSize: '11px' }}>
                      —
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
