// Barre de tâche à trois couches : contractuel (référence), réel (constaté),
// prévision (uniquement quand elle diffère du contractuel — jamais 4 couches
// à la fois : le prévisionnel n'est affiché QUE lorsqu'il y a un écart).
import type { MouseEvent as ReactMouseEvent } from 'react'
import { PlanningTask } from '../../../types/planning'
import { TimelineScale, xForDate, widthForRange } from '../../../lib/planningViewModel'

export const BAR_HEIGHT = 16

interface Props {
  task: PlanningTask
  scale: TimelineScale
  today: Date
  onEnter?: (e: ReactMouseEvent) => void
  onLeave?: () => void
  onClick?: () => void
}

export function GanttBar({ task, scale, today, onEnter, onLeave, onClick }: Props) {
  const contractX = xForDate(task.contract.start, scale)
  const contractW = widthForRange(task.contract.start, task.contract.end, scale)

  const actualStart = task.actual.start
  const actualEndUsed = task.actual.end ?? (actualStart ? today : undefined)
  const hasActual = !!(actualStart && actualEndUsed)
  const actualX = hasActual ? xForDate(actualStart!, scale) : 0
  const actualW = hasActual ? widthForRange(actualStart!, actualEndUsed!, scale) : 0

  const showForecast = !!(task.forecast.start && task.forecast.end)
  const forecastX = showForecast ? xForDate(task.forecast.start!, scale) : 0
  const forecastW = showForecast ? widthForRange(task.forecast.start!, task.forecast.end!, scale) : 0
  const forecastLate = (task.variance.forecastDays ?? 0) > 0

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      aria-label={`${task.title} — ${task.progress}%`}
    >
      {/* Contractuel : trait de référence, toujours visible */}
      <div style={{
        position: 'absolute', left: contractX, width: contractW, height: BAR_HEIGHT, top: '50%',
        transform: 'translateY(-50%)', border: '1.5px solid var(--navy)', borderRadius: 4,
        background: task.isCritical ? 'rgba(220,38,38,.06)' : 'rgba(2,69,122,.05)',
        boxSizing: 'border-box',
      }} />

      {/* Prévision : hachuré, seulement quand elle diffère du contractuel */}
      {showForecast && (
        <div style={{
          position: 'absolute', left: forecastX, width: forecastW, height: BAR_HEIGHT, top: '50%',
          transform: 'translateY(-50%)', borderRadius: 4,
          background: forecastLate
            ? 'repeating-linear-gradient(45deg, var(--warn), var(--warn) 4px, transparent 4px, transparent 8px)'
            : 'repeating-linear-gradient(45deg, var(--ok), var(--ok) 4px, transparent 4px, transparent 8px)',
          opacity: 0.55,
        }} />
      )}

      {/* Réel : remplissage plein, ce qui s'est vraiment passé */}
      {hasActual && (
        <div style={{
          position: 'absolute', left: actualX, width: actualW, height: BAR_HEIGHT - 4, top: '50%',
          transform: 'translateY(-50%)', borderRadius: 3,
          background: task.progress >= 100 ? 'var(--ok)' : 'var(--accent)',
        }} />
      )}
    </div>
  )
}
