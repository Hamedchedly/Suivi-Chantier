// Info-bulle au survol d'une barre : les trois réalités + l'écart, rien d'autre.
import { PlanningTask } from '../../../types/planning'

const fmt = (d?: Date) => (d ? d.toLocaleDateString('fr') : '—')

interface Props {
  task: PlanningTask
  x: number
  y: number
}

export function GanttTooltip({ task, x, y }: Props) {
  const v = task.variance
  return (
    <div style={{
      position: 'fixed', left: x + 12, top: y + 12, zIndex: 500, pointerEvents: 'none',
      background: '#fff', border: '1px solid var(--line)', borderRadius: 8,
      boxShadow: 'var(--shadow)', padding: '10px 12px', minWidth: 200, fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>{task.title}</div>
      <Line label="Contractuel" value={`${fmt(task.contract.start)} → ${fmt(task.contract.end)}`} />
      <Line label="Réel" value={task.actual.start ? `${fmt(task.actual.start)} → ${fmt(task.actual.end) === '—' ? 'en cours' : fmt(task.actual.end)}` : '—'} />
      {task.forecast.end && <Line label="Prévision" value={`${fmt(task.forecast.start)} → ${fmt(task.forecast.end)}`} />}
      {v.forecastDays !== null && (
        <Line label="Écart prévisionnel" value={v.forecastDays > 0 ? `+${v.forecastDays} j` : `${v.forecastDays} j`} tone={v.forecastDays > 0 ? 'bad' : 'ok'} />
      )}
      <Line label="Avancement" value={`${task.progress}%`} />
    </div>
  )
}

function Line({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'ok' ? 'var(--ok)' : 'var(--ink)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '2px 0' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color }}>{value}</span>
    </div>
  )
}
