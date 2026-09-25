// Une ligne du Gantt, scindée en deux : le libellé (volet gauche, ne scrolle
// jamais à l'horizontale) et la frise (volet droit, bar/jalon + engagement).
// Les deux widgets restent alignés car l'orchestrateur les rend dans deux
// volets synchronisés verticalement — voir GanttHeader.tsx.
import { memo } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { PlanningTask } from '../../../types/planning'
import { TimelineScale, xForDate, timelineWidth } from '../../../lib/planningViewModel'
import { GanttBar } from './GanttBar'
import { GanttMilestone } from './GanttMilestone'
import { sameRenderTask } from './ganttMemo'

export const ROW_HEIGHT = 34

interface LabelProps {
  task: PlanningTask
  depth: number
  isLot: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
  onSelect: (task: PlanningTask) => void
  highlighted?: boolean
  /** Groupe (lot ou tâche à enfants) terminé au sens isTaskGroupCompleted —
   * calculé une fois par l'orchestrateur (Gantt.tsx), jamais recalculé ici :
   * dépend des feuilles du sous-arbre, que sameRenderTask ne compare pas. */
  isCompleted?: boolean
}

export const GanttRowLabel = memo(function GanttRowLabel({ task, depth, isLot, isExpanded, onToggleExpand, onSelect, highlighted, isCompleted }: LabelProps) {
  return (
    <div
      style={{
        height: ROW_HEIGHT, display: 'flex', alignItems: 'center', gap: 6,
        paddingLeft: 10 + depth * 16, paddingRight: 8, borderBottom: '1px solid var(--line)',
        background: highlighted ? 'rgba(220,38,38,.04)' : isLot ? '#f8fafc' : '#fff', cursor: 'pointer',
      }}
      onClick={() => (isLot && onToggleExpand ? onToggleExpand() : onSelect(task))}
    >
      {isLot ? (
        <span style={{ flexShrink: 0, color: 'var(--muted)' }}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      ) : (
        <span style={{ width: 14, flexShrink: 0 }} />
      )}
      <span style={{
        fontSize: 12, fontWeight: (isLot || (task.progress > 0 && task.progress < 100)) ? 700 : 500, color: isLot ? 'var(--navy)' : task.isNa ? 'var(--muted)' : 'var(--ink)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>
        {task.title}
      </span>
      {task.isCritical && <span title="Chemin critique" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--bad)', flexShrink: 0 }} />}
      {isLot && isCompleted && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'var(--ok)', background: 'rgba(21,128,61,.1)',
          borderRadius: 999, padding: '2px 7px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.03em',
        }}>
          Terminé
        </span>
      )}
      {task.isNa && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'var(--muted)', background: 'rgba(107,114,128,.1)',
          borderRadius: 999, padding: '2px 7px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.03em',
        }}>
          N/A
        </span>
      )}
      <span style={{ fontSize: 10, fontWeight: 700, color: task.isNa ? 'var(--muted)' : 'var(--muted)', flexShrink: 0 }}>{task.isNa ? '—' : `${task.progress}%`}</span>
    </div>
  )
}, (prev, next) =>
  prev.depth === next.depth &&
  prev.isLot === next.isLot &&
  prev.isExpanded === next.isExpanded &&
  prev.highlighted === next.highlighted &&
  prev.isCompleted === next.isCompleted &&
  prev.onSelect === next.onSelect &&
  prev.onToggleExpand === next.onToggleExpand &&
  sameRenderTask(prev.task, next.task))

interface TimelineProps {
  task: PlanningTask
  scale: TimelineScale
  today: Date
  onSelect: (task: PlanningTask) => void
  onHover: (task: PlanningTask, e: ReactMouseEvent) => void
  onLeave: () => void
  highlighted?: boolean
}

export const GanttRowTimeline = memo(function GanttRowTimeline({ task, scale, today, onSelect, onHover, onLeave, highlighted }: TimelineProps) {
  const commitmentX = task.latestCommitment ? xForDate(new Date(task.latestCommitment.promisedEnd), scale) : null

  return (
    <div
      style={{ position: 'relative', height: ROW_HEIGHT, width: timelineWidth(scale), borderBottom: '1px solid var(--line)', background: highlighted ? 'rgba(220,38,38,.04)' : undefined }}
      onClick={() => onSelect(task)}
    >
      {task.isMilestone ? (
        <GanttMilestone task={task} scale={scale} onEnter={e => onHover(task, e)} onLeave={onLeave} />
      ) : (
        <GanttBar task={task} scale={scale} today={today} onEnter={e => onHover(task, e)} onLeave={onLeave} />
      )}
      {commitmentX !== null && (
        <div
          title={`Engagement : ${task.latestCommitment!.promisedEnd}`}
          style={{
            position: 'absolute', left: commitmentX - 4, top: 2, width: 8, height: 8,
            transform: 'rotate(45deg)', background: '#fff', border: '2px solid var(--warn)',
          }}
        />
      )}
    </div>
  )
}, (prev, next) =>
  prev.highlighted === next.highlighted &&
  prev.today.getTime() === next.today.getTime() &&
  prev.scale.start.getTime() === next.scale.start.getTime() &&
  prev.scale.end.getTime() === next.scale.end.getTime() &&
  prev.scale.dayWidth === next.scale.dayWidth &&
  prev.scale.zoom === next.scale.zoom &&
  prev.onSelect === next.onSelect &&
  prev.onHover === next.onHover &&
  prev.onLeave === next.onLeave &&
  sameRenderTask(prev.task, next.task))
