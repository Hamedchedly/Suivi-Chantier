// Vue mobile du nouveau Gantt (section 8 du brief) : ne reproduit pas la
// grille desktop compressée — une carte par tâche, l'essentiel lisible sans
// zoomer. Le Gantt horizontal reste accessible via « Voir timeline ».
import { ChevronRight, GanttChartSquare } from 'lucide-react'
import { PlanningTask } from '../../../types/planning'

const fmt = (d?: Date) => (d ? d.toLocaleDateString('fr') : '—')

function flattenLeaves(tasks: PlanningTask[], acc: PlanningTask[] = []): PlanningTask[] {
  for (const t of tasks) {
    if (t.children?.length) flattenLeaves(t.children, acc)
    else acc.push(t)
  }
  return acc
}

interface Props {
  tasks: PlanningTask[]
  onSelect: (task: PlanningTask) => void
  onShowTimeline: () => void
}

export function GanttMobileList({ tasks, onSelect, onShowTimeline }: Props) {
  const leaves = flattenLeaves(tasks)

  return (
    <div>
      <button
        onClick={onShowTimeline}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
          fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--navy)', border: 'none',
          borderRadius: 8, padding: '10px 12px', cursor: 'pointer', marginBottom: 12,
        }}
      >
        <GanttChartSquare size={15} /> Voir timeline
      </button>

      {leaves.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Aucune tâche planifiée.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {leaves.map(t => (
          <MobileCard key={t.id} task={t} onClick={() => onSelect(t)} />
        ))}
      </div>
    </div>
  )
}

function MobileCard({ task, onClick }: { task: PlanningTask; onClick: () => void }) {
  const v = task.variance
  const overdue = task.progress < 100 && task.status !== 'cancelled' && new Date().getTime() > task.contract.end.getTime()
  const alert = task.status === 'blocked' ? 'Bloquée' : overdue ? 'Dépassement contractuel' : null
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className="card"
      style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {task.lotId}{task.isMilestone ? ' · jalon' : ''}{task.isCritical ? ' · critique' : ''}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{task.title}</div>
        </div>
        <ChevronRight size={16} color="var(--muted)" style={{ flexShrink: 0, marginTop: 2 }} />
      </div>

      {alert && (
        <span style={{
          alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, color: 'var(--bad)', background: 'var(--bad-bg)',
          padding: '2px 8px', borderRadius: 999,
        }}>
          {alert}
        </span>
      )}

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>
          <span>Avancement</span><span style={{ fontWeight: 700, color: 'var(--accent)' }}>{task.progress}%</span>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${task.progress}%` }} /></div>
      </div>

      <Line label="Contractuel" value={`${fmt(task.contract.start)} → ${fmt(task.contract.end)}`} />
      <Line label="Réel" value={task.actual.start ? `${fmt(task.actual.start)} → ${task.actual.end ? fmt(task.actual.end) : 'en cours'}` : '—'} />
      {task.forecast.end && <Line label="Prévision" value={`${fmt(task.forecast.start)} → ${fmt(task.forecast.end)}`} />}
      {v.forecastDays !== null && (
        <Line
          label="Écart prévisionnel"
          value={v.forecastDays > 0 ? `+${v.forecastDays} jours` : v.forecastDays === 0 ? 'à jour' : `${v.forecastDays} jours`}
          tone={v.forecastDays > 0 ? 'bad' : v.forecastDays < 0 ? 'ok' : undefined}
        />
      )}
    </div>
  )
}

function Line({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'ok' ? 'var(--ok)' : 'var(--ink)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color }}>{value}</span>
    </div>
  )
}
