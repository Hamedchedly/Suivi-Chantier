import { Play, AlertTriangle, CalendarClock, MapPin } from 'lucide-react'
import type { Page } from '../../App'
import { GanttTask } from '../../types/gantt'
import { GANTT_TASKS } from '../../data/ganttMockData'
import { loadState } from '../../lib/storage'
import { Reserve } from '../../lib/reserves'
import {
  overallProgress, maxDrift, lateTasks, tasksForToday, lotSummaries, driftDays,
} from '../../lib/schedule'
import { LOGEMENTS } from '../../data/zones'

interface HomeProps {
  onNavigate: (page: Page) => void
}

const logementLabel = (id?: string) => (id ? LOGEMENTS.find(l => l.id === id)?.label ?? id : '')

export function Home({ onNavigate }: HomeProps) {
  const today = new Date()
  const tasks = loadState<GanttTask[]>('sc-gantt-v2', GANTT_TASKS)
  const reserves = loadState<Reserve[]>('sc-reserves-v1', [])

  const progress = overallProgress(tasks)
  const drift = maxDrift(tasks)
  const late = lateTasks(tasks, today)
  const todo = tasksForToday(tasks, today)
  const lots = lotSummaries(tasks, today)
  const openReserves = reserves.filter(r => r.status === 'open')
  const highReserves = openReserves.filter(r => r.priority === 'high')

  const risks = [
    ...late.map(t => ({ key: `late-${t.id}`, label: `${t.title} en retard`, sub: `échéance ${t.planned_end.toLocaleDateString('fr')}` })),
    ...lots.filter(l => l.drift > 0).map(l => ({ key: `drift-${l.lotId}`, label: `${l.title.replace(/^LOT \d+ - /, '')} : +${l.drift} j de dérive`, sub: 'vs planning contractuel' })),
    ...highReserves.map(r => ({ key: `res-${r.id}`, label: `${r.number} — ${r.description}`, sub: `${logementLabel(r.logementId)} • priorité haute` })),
  ]

  return (
    <div style={{ padding: '16px 12px', paddingBottom: '16px' }}>
      {/* KPIs */}
      <div className="kpi-grid">
        <KPICard label="Avancement" value={`${progress}%`} variant="ok" />
        <KPICard label="Dérive max" value={`+${drift} j`} variant={drift > 0 ? 'warn' : undefined} />
        <KPICard label="Retards" value={late.length} variant={late.length > 0 ? 'warn' : undefined} />
        <KPICard label="Réserves" value={openReserves.length} variant={openReserves.length > 0 ? 'warn' : undefined} />
      </div>

      <button className="btn-primary" onClick={() => onNavigate('cr')}>
        <Play size={16} />
        Nouvelle visite de chantier
      </button>

      {/* À faire aujourd'hui */}
      <section>
        <h2 className="section-title"><CalendarClock size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />À faire aujourd'hui</h2>
        {todo.length === 0 ? (
          <div className="card" style={{ fontSize: '13px', color: 'var(--muted)' }}>Aucune tâche active aujourd'hui.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todo.map(t => (
              <button key={t.id} onClick={() => onNavigate('gantt')} style={rowCard}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>{t.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <MapPin size={11} /> {logementLabel(t.logement_id)} • {t.progress}%{driftDays(t) > 0 ? ` • +${driftDays(t)} j` : ''}
                  </div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: t.status === 'delayed' || t.status === 'blocked' ? 'var(--bad)' : 'var(--navy-2)' }}>{t.progress}%</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Risques chantier */}
      <section>
        <h2 className="section-title"><AlertTriangle size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Risques chantier</h2>
        {risks.length === 0 ? (
          <div className="card" style={{ fontSize: '13px', color: 'var(--ok)' }}>Aucun risque identifié. 👍</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {risks.slice(0, 6).map(r => (
              <div key={r.key} style={{ display: 'flex', gap: '10px', alignItems: 'start', background: '#fff', border: '1px solid var(--line)', borderLeft: '3px solid var(--bad)', borderRadius: '8px', padding: '10px 12px' }}>
                <AlertTriangle size={16} color="var(--bad)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{r.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lots */}
      <section>
        <h2 className="section-title">Lots</h2>
        <div>
          {lots.map(lot => (
            <div key={lot.lotId} className="lot-card">
              <div className="lot-header">
                <div>
                  <div className="lot-name">{lot.lotId}</div>
                  <div className="lot-desc">{lot.title.replace(/^LOT \d+ - /, '')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="lot-progress">{lot.progress}%</div>
                  <div className={`lot-status ${lot.late ? 'late' : 'ok'}`}>{lot.late ? 'Retard' : 'À jour'}</div>
                </div>
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${lot.late ? 'late' : ''}`} style={{ width: `${lot.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function KPICard({ label, value, variant }: { label: string; value: string | number; variant?: 'ok' | 'warn' }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${variant || ''}`}>{value}</div>
    </div>
  )
}

const rowCard: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', width: '100%', background: '#fff', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer' }
