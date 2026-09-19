// Panneau « Analyse du planning » (section 21) + chemin critique (section 20).
// Aucun score arbitraire : uniquement des comptes et des jours d'écart.
import { useState } from 'react'
import { X } from 'lucide-react'
import { PlanningAnalysis, CriticalPathResult } from '../../../types/planning'

const fmt = (d: Date | null) => (d ? d.toLocaleDateString('fr') : '—')

interface Props {
  analysis: PlanningAnalysis
  criticalPath: CriticalPathResult
  taskTitleById: Map<string, string>
  onClose: () => void
}

export function GanttAnalysis({ analysis: a, criticalPath: cp, taskTitleById, onClose }: Props) {
  const [showCritical, setShowCritical] = useState(false)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,27,72,.4)', zIndex: 300 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 92vw)', background: '#fff', zIndex: 301, boxShadow: '-8px 0 30px rgba(2,27,72,.22)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg, #02457A, #001B48)', color: '#fff', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#fff', margin: 0, fontSize: 16 }}>Analyse du planning</h2>
          <button onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}><X size={16} /></button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            <Kpi label="Tâches" value={a.totalTasks} />
            <Kpi label="Terminées" value={a.completed} tone="ok" />
            <Kpi label="En cours" value={a.inProgress} />
            <Kpi label="Non commencées" value={a.notStarted} />
            <Kpi label="En dérive" value={a.drifting} tone={a.drifting > 0 ? 'bad' : 'ok'} />
          </div>

          <Section title="Fin de chantier">
            <Row label="Fin contractuelle" value={fmt(a.contractEnd)} />
            <Row label="Fin réelle (à date)" value={fmt(a.actualEnd)} />
            <Row label="Fin prévisionnelle" value={fmt(a.forecastEnd)} />
            {a.varianceDays !== null && (
              <Row label="Écart prévisionnel" value={a.varianceDays > 0 ? `+${a.varianceDays} j` : `${a.varianceDays} j`} tone={a.varianceDays > 0 ? 'bad' : 'ok'} />
            )}
          </Section>

          <Section title="Principaux écarts">
            {a.topVariances.length > 0 ? (
              a.topVariances.slice(0, 8).map(v => (
                <Row key={v.lotId} label={v.title} value={`+${v.days} j`} tone="bad" />
              ))
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aucun écart constaté.</div>
            )}
          </Section>

          <Section title="Chemin critique">
            {!showCritical ? (
              <button
                onClick={() => setShowCritical(true)}
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', background: '#eef2f6', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
              >
                Calculer le chemin critique
              </button>
            ) : !cp.available ? (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aucun chemin critique calculable.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                {cp.path.map((id, i) => (
                  <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--bad)', borderRadius: 10, padding: '2px 8px' }}>
                      {taskTitleById.get(id) ?? id}
                    </span>
                    {i < cp.path.length - 1 && <span style={{ color: 'var(--bad)' }}>→</span>}
                  </span>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'bad' }) {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'ok' ? 'var(--ok)' : 'var(--navy)'
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'ok' ? 'var(--ok)' : 'var(--ink)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
    </div>
  )
}
