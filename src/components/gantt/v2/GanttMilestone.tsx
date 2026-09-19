// Jalon (échéance ponctuelle) : losange sur sa date de référence. Réel > prévision > contractuel.
import type { MouseEvent as ReactMouseEvent } from 'react'
import { PlanningTask } from '../../../types/planning'
import { TimelineScale, xForDate } from '../../../lib/planningViewModel'

interface Props {
  task: PlanningTask
  scale: TimelineScale
  onEnter?: (e: ReactMouseEvent) => void
  onLeave?: () => void
  onClick?: () => void
}

export function GanttMilestone({ task, scale, onEnter, onLeave, onClick }: Props) {
  const date = task.actual.end ?? task.forecast.end ?? task.contract.end
  const x = xForDate(date, scale)
  const done = task.progress >= 100
  const color = done ? 'var(--ok)' : task.forecast.end ? 'var(--warn)' : 'var(--navy)'

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Jalon ${task.title}`}
      style={{
        position: 'absolute', left: x - 6, top: '50%', width: 12, height: 12,
        transform: 'translateY(-50%) rotate(45deg)', background: color, cursor: 'pointer',
        border: '2px solid #fff', boxShadow: '0 0 0 1px ' + color,
      }}
    />
  )
}
