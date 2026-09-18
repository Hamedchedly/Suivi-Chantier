import { useState } from 'react'
import { X, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { GanttTask } from '../../types/gantt'
import { getZoneRefs, getTaskUnits } from '../../lib/repo'
import { unitIdsForTask } from '../../lib/units'

interface PlanningTableViewProps {
  tasks: GanttTask[]
  onClose: () => void
  onTaskUpdate?: (taskId: string, updates: Partial<GanttTask>) => void
  onReorder?: (taskId: string, newIndex: number) => void
}

export function PlanningTableView({ tasks, onClose, onTaskUpdate, onReorder }: PlanningTableViewProps) {
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)

  const fmt = (d?: Date) => (d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

  const isLate = (task: GanttTask) => task.actual_end && task.actual_end.getTime() > task.planned_end.getTime()

  // Flatten all tasks (roots + children)
  const allTasks = tasks.flatMap(t => [t, ...(t.children ?? [])])

  // Get all zones
  const zoneRefs = getZoneRefs()
  const links = getTaskUnits()

  // Build structure: zone -> tasks with that zone
  const zoneMap = new Map<string, GanttTask[]>()
  for (const zone of zoneRefs) {
    const zoneTasks = allTasks.filter(t => unitIdsForTask(links, t.id).includes(zone.refId))
    if (zoneTasks.length > 0) {
      zoneMap.set(zone.refId, zoneTasks)
    }
  }

  const toggleZone = (zoneId: string) => {
    setExpandedZones(prev => {
      const next = new Set(prev)
      if (next.has(zoneId)) next.delete(zoneId)
      else next.add(zoneId)
      return next
    })
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
    setDraggedTaskId(taskId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, taskId: string) => {
    e.preventDefault()
    setDragOverTaskId(taskId)
  }

  const handleDragLeave = () => {
    setDragOverTaskId(null)
  }

  const handleDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault()
    const sourceTaskId = e.dataTransfer.getData('text/plain')
    if (sourceTaskId && sourceTaskId !== targetTaskId && onReorder) {
      const allTasksList = allTasks
      const sourceIndex = allTasksList.findIndex(t => t.id === sourceTaskId)
      const targetIndex = allTasksList.findIndex(t => t.id === targetTaskId)
      if (sourceIndex !== -1 && targetIndex !== -1) {
        onReorder(sourceTaskId, targetIndex)
      }
    }
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '95vw', maxHeight: '90vh', width: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e4ecf2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#02457A' }}>Tableau de Planning par Zone</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#5b7183' }}>×</button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e4ecf2', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: '#02457A', minWidth: '30px' }} />
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: '#02457A', minWidth: '220px', borderRight: '1px solid #e4ecf2' }}>Bâtiment / Logement / Tâche</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#02457A', minWidth: '90px', borderRight: '1px solid #e4ecf2' }}>Début<br/>contractuel</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#02457A', minWidth: '90px', borderRight: '1px solid #e4ecf2' }}>Fin<br/>contractuelle</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#02457A', minWidth: '90px', borderRight: '1px solid #e4ecf2' }}>Début<br/>réel</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#02457A', minWidth: '90px', borderRight: '1px solid #e4ecf2' }}>Fin<br/>réelle</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#02457A', minWidth: '50px', borderRight: '1px solid #e4ecf2' }}>%</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: '#02457A', minWidth: '150px' }}>Prédécesseurs</th>
              </tr>
            </thead>
            <tbody>
              {zoneRefs.map(zone => {
                const zoneTasks = zoneMap.get(zone.refId) || []
                if (zoneTasks.length === 0) return null

                const isExpanded = expandedZones.has(zone.refId)

                return (
                  <tr key={zone.refId}>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <div style={{ background: '#f0f5f9', borderBottom: '1px solid #e4ecf2' }}>
                        <button
                          onClick={() => toggleZone(zone.refId)}
                          style={{ width: '100%', padding: '10px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#02457A' }}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span>{zone.buildingLabel} — {zone.label}</span>
                          <span style={{ fontSize: '11px', color: '#5b7183', fontWeight: 400 }}>({zoneTasks.length} tâche{zoneTasks.length > 1 ? 's' : ''})</span>
                        </button>
                      </div>
                      {isExpanded && (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <tbody>
                            {zoneTasks.map(task => {
                              const late = isLate(task)
                              const bgColor = late ? '#fee2e2' : '#fff'
                              const textColor = late ? '#dc2626' : '#1f2937'
                              const isDraggedOver = dragOverTaskId === task.id && draggedTaskId !== task.id

                              return (
                                <tr
                                  key={task.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, task.id)}
                                  onDragOver={handleDragOver}
                                  onDragEnter={(e) => handleDragEnter(e, task.id)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, task.id)}
                                  style={{
                                    background: isDraggedOver ? '#e0e7ff' : bgColor,
                                    borderBottom: '1px solid #f0f5f9',
                                    opacity: draggedTaskId === task.id ? 0.5 : 1,
                                    cursor: 'grab'
                                  }}
                                >
                                  <td style={{ padding: '10px 6px', textAlign: 'center', color: '#5b7183' }}>
                                    <GripVertical size={14} />
                                  </td>
                                  <td style={{ padding: '10px', color: textColor, fontWeight: 600, borderRight: '1px solid #e4ecf2', paddingLeft: '40px' }}>
                                    {task.title}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center', color: textColor, borderRight: '1px solid #e4ecf2' }}>
                                    {fmt(task.planned_start)}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center', color: textColor, borderRight: '1px solid #e4ecf2' }}>
                                    {fmt(task.planned_end)}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center', color: textColor, borderRight: '1px solid #e4ecf2' }}>
                                    {fmt(task.actual_start)}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center', color: textColor, fontWeight: late ? 700 : 400, borderRight: '1px solid #e4ecf2' }}>
                                    {fmt(task.actual_end)}
                                  </td>
                                  <td style={{ padding: '10px', textAlign: 'center', color: textColor, fontWeight: 600, borderRight: '1px solid #e4ecf2' }}>
                                    {task.progress}%
                                  </td>
                                  <td style={{ padding: '10px', color: textColor, fontSize: '11px' }}>
                                    {task.dependencies.length > 0 ? task.dependencies.join(', ') : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
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
