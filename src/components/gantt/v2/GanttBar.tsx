// Barre de tâche à trois couches : contractuel (référence), réel (constaté),
// prévision (uniquement quand elle diffère du contractuel — jamais 4 couches
// à la fois : le prévisionnel n'est affiché QUE lorsqu'il y a un écart).
import { memo } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { PlanningTask } from '../../../types/planning'
import { TimelineScale, xForDate, widthForRange } from '../../../lib/planningViewModel'
import { sameRenderTask } from './ganttMemo'

export const BAR_HEIGHT = 16

const RGB_START = [1, 138, 190] // var(--accent) — tâche qui démarre
const RGB_DONE = [21, 128, 61] // var(--ok) — tâche terminée
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)

/** Couleur graduelle bleu → vert selon l'avancement (0 % = accent, 100 % = ok). */
function progressColor(progress: number): string {
  const t = Math.max(0, Math.min(100, progress)) / 100
  const [r, g, b] = [lerp(RGB_START[0], RGB_DONE[0], t), lerp(RGB_START[1], RGB_DONE[1], t), lerp(RGB_START[2], RGB_DONE[2], t)]
  return `rgb(${r}, ${g}, ${b})`
}

const HACHURE_BAD = 'repeating-linear-gradient(45deg, var(--bad), var(--bad) 4px, transparent 4px, transparent 8px)'

/**
 * Couleur de la barre « réel », par priorité :
 * 1. bloquée → rouge hachuré, toujours, quel que soit l'avancement ;
 * 2. dépassement du contractuel alors que la tâche n'est pas terminée →
 *    rouge immédiat, sans attendre un calcul de prévision ;
 * 3. terminée → vert plein ;
 * 4. sinon → dégradé bleu→vert proportionnel à l'avancement.
 */
function realBarStyle(task: PlanningTask, today: Date): { background: string } {
  if (task.status === 'blocked') return { background: HACHURE_BAD }
  const overdue = task.progress < 100 && today.getTime() > task.contract.end.getTime()
  if (overdue) return { background: 'var(--bad)' }
  if (task.progress >= 100) return { background: 'var(--ok)' }
  return { background: progressColor(task.progress) }
}

interface Props {
  task: PlanningTask
  scale: TimelineScale
  today: Date
  onEnter?: (e: ReactMouseEvent) => void
  onLeave?: () => void
  onClick?: () => void
}

export const GanttBar = memo(function GanttBar({ task, scale, today, onEnter, onLeave, onClick }: Props) {
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

  // Dépassement contractuel : rouge immédiat, même sans aucune date réelle
  // saisie — ne dépend jamais d'un calcul de prévision.
  const isBlocked = task.status === 'blocked'
  const isOverdue = task.progress < 100 && task.status !== 'cancelled' && today.getTime() > task.contract.end.getTime()

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
      {/* Contractuel : trait de référence, toujours visible — passe au rouge
          dès dépassement (même tâche non terminée) ou tâche bloquée, sans
          attendre un calcul de prévision. */}
      <div style={{
        position: 'absolute', left: contractX, width: contractW, height: BAR_HEIGHT, top: '50%',
        transform: 'translateY(-50%)', borderRadius: 4, boxSizing: 'border-box',
        border: isBlocked || isOverdue ? '2px solid var(--bad)' : '1.5px solid var(--navy)',
        background: isBlocked
          ? HACHURE_BAD
          : isOverdue ? 'rgba(220,38,38,.16)'
          : task.isCritical ? 'rgba(220,38,38,.06)' : 'rgba(2,69,122,.05)',
        opacity: isBlocked ? 0.6 : 1,
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

      {/* Réel : remplissage plein, ce qui s'est vraiment passé — dégradé
          bleu→vert selon l'avancement, rouge immédiat si dépassement ou
          bloqué, vert plein à 100 %. */}
      {hasActual && (
        <div style={{
          position: 'absolute', left: actualX, width: actualW, height: BAR_HEIGHT - 4, top: '50%',
          transform: 'translateY(-50%)', borderRadius: 3,
          ...realBarStyle(task, today),
        }} />
      )}
    </div>
  )
}, (prev, next) =>
  prev.today.getTime() === next.today.getTime() &&
  prev.scale.start.getTime() === next.scale.start.getTime() &&
  prev.scale.end.getTime() === next.scale.end.getTime() &&
  prev.scale.dayWidth === next.scale.dayWidth &&
  prev.scale.zoom === next.scale.zoom &&
  sameRenderTask(prev.task, next.task))
