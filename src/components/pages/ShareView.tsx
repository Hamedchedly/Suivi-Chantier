import { useState } from 'react'
import { Lock, MapPin } from 'lucide-react'
import { Snapshot } from '../../lib/share'
import { GanttViewState } from '../../types/gantt'
import { overallProgress, maxDrift, lateTasks, lotSummaries } from '../../lib/schedule'
import { projectFinance, euros } from '../../lib/finance'
import { LOGEMENTS } from '../../data/zones'
import GanttTable from '../gantt/GanttTable'
import '../../styles/gantt.css'

const logementLabel = (id?: string) => (id ? LOGEMENTS.find(l => l.id === id)?.label ?? id : '')

export function ShareView({ snapshot }: { snapshot: Snapshot }) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const today = new Date()

  const tasks = snapshot.tasks
  const openReserves = snapshot.reserves.filter(r => r.status === 'open')
  const progress = overallProgress(tasks)
  const drift = maxDrift(tasks)
  const late = lateTasks(tasks, today)
  const lots = lotSummaries(tasks, today)
  const pf = projectFinance(snapshot.marches, snapshot.avenants, snapshot.situations)

  const startDate = new Date(); startDate.setDate(startDate.getDate() - 21); startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(); endDate.setDate(endDate.getDate() + 63)
  const viewState: GanttViewState = {
    view: 'week', startDate, endDate, depsVisible: true, expandedTasks,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: '24px' }}>
      {/* Read-only banner */}
      <div style={{ background: 'linear-gradient(180deg, #0d3f68, #0b3b60)', color: '#fff', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#9bc4df', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          <Lock size={12} /> Vue partagée — lecture seule
        </div>
        <h1 style={{ margin: '4px 0 0', fontSize: '18px', color: '#fff' }}>{snapshot.project.name}</h1>
        <div style={{ fontSize: '12px', color: '#9bc4df' }}>
          Réf. {snapshot.project.ref} • {snapshot.project.address}
        </div>
        <div style={{ fontSize: '11px', color: '#7fa8c8', marginTop: '2px' }}>
          Instantané du {new Date(snapshot.createdAt).toLocaleDateString('fr')}
        </div>
      </div>

      <div style={{ padding: '14px 12px', maxWidth: '900px', margin: '0 auto' }}>
        {/* KPIs */}
        <div className="kpi-grid" style={{ marginBottom: '16px' }}>
          <Kpi label="Avancement" value={`${progress}%`} variant="ok" />
          <Kpi label="Dérive max" value={`+${drift} j`} variant={drift > 0 ? 'warn' : undefined} />
          <Kpi label="Retards" value={String(late.length)} variant={late.length > 0 ? 'warn' : undefined} />
          <Kpi label="Réserves" value={String(openReserves.length)} variant={openReserves.length > 0 ? 'warn' : undefined} />
        </div>

        {/* Planning (read-only) */}
        <h2 className="section-title" style={{ marginBottom: '8px' }}>Planning</h2>
        <div style={{ overflow: 'hidden', borderRadius: '6px', border: '1px solid #e3e9ee', marginBottom: '20px' }}>
          <GanttTable
            tasks={tasks}
            viewState={viewState}
            readOnly
            onToggleExpanded={(id) => setExpandedTasks(prev => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id); else next.add(id)
              return next
            })}
          />
        </div>

        {/* Finance summary */}
        <h2 className="section-title" style={{ marginBottom: '8px' }}>Finances</h2>
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <FinItem label="Budget (HT)" value={euros(pf.budget)} />
            <FinItem label="Facturé" value={`${euros(pf.billed)} (${pf.billedPct}%)`} />
            <FinItem label="Payé" value={euros(pf.paid)} />
            <FinItem label="Reste" value={euros(pf.remaining)} />
          </div>
          <div style={{ height: '10px', borderRadius: '5px', background: 'var(--line)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${pct(pf.paid, pf.budget)}%`, background: 'var(--ok)' }} />
            <div style={{ width: `${pct(pf.billed - pf.paid, pf.budget)}%`, background: 'var(--navy2)' }} />
          </div>
        </div>

        {/* Lots */}
        <h2 className="section-title" style={{ marginBottom: '8px' }}>Avancement par lot</h2>
        <div style={{ marginBottom: '20px' }}>
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

        {/* Open reserves */}
        <h2 className="section-title" style={{ marginBottom: '8px' }}>Réserves ouvertes ({openReserves.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {openReserves.length === 0 && <div className="card" style={{ fontSize: '13px', color: 'var(--muted)' }}>Aucune réserve ouverte.</div>}
          {openReserves.map(r => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <strong style={{ color: 'var(--navy)', fontSize: '13px' }}>{r.number}</strong>
                <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, background: r.priority === 'high' ? 'var(--bad-bg)' : r.priority === 'medium' ? '#fef3c7' : '#eef2f6', color: r.priority === 'high' ? 'var(--bad)' : r.priority === 'medium' ? '#b45309' : 'var(--muted)' }}>
                  {r.priority === 'high' ? 'Haute' : r.priority === 'medium' ? 'Moyenne' : 'Faible'}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ink)' }}>{r.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                <MapPin size={11} /> {logementLabel(r.logementId)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: '10px', color: '#9bb0c2', marginTop: '24px' }}>
          Suivi-Chantier — instantané en lecture seule, non modifiable.
        </div>
      </div>
    </div>
  )
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0
}

function Kpi({ label, value, variant }: { label: string; value: string; variant?: 'ok' | 'warn' }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${variant || ''}`}>{value}</div>
    </div>
  )
}

function FinItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--navy)' }}>{value}</div>
    </div>
  )
}
