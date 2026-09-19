// Panneau détail d'une tâche (section 27) : avancement, les trois réalités,
// écarts, engagements (dernier + historique), dépendances, cause du retard.
// Tout est lu depuis PlanningTask — rien n'est recalculé ici.
import { useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { PlanningTask } from '../../../types/planning'
import { DelayCause, DELAY_CAUSE_LABEL } from '../../../types/gantt'
import { GanttDependency } from './GanttDependency'

const fmt = (d?: Date) => (d ? d.toLocaleDateString('fr') : '—')

interface Props {
  task: PlanningTask
  allTasksById: Map<string, PlanningTask>
  onClose: () => void
  onDelayCauseChange?: (cause: DelayCause | undefined) => void
  onDependencyRemove?: (predecessorId: string) => void
}

export function GanttDetails({ task, allTasksById, onClose, onDelayCauseChange, onDependencyRemove }: Props) {
  const [showHistory, setShowHistory] = useState(false)
  const v = task.variance

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,27,72,.4)', zIndex: 300 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(400px, 92vw)', background: '#fff', zIndex: 301, boxShadow: '-8px 0 30px rgba(2,27,72,.22)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg, #02457A, #001B48)', color: '#fff', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--sky)', fontWeight: 700 }}>
                {task.lotId}{task.isMilestone ? ' · jalon' : ''}{task.isCritical ? ' · critique' : ''}
              </div>
              <h2 style={{ color: '#fff', margin: '4px 0 0', fontSize: 17, lineHeight: 1.25 }}>{task.title}</h2>
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
          </div>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {/* Avancement */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Avancement</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{task.progress}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${task.progress}%` }} /></div>
          </div>

          <Section title="Contractuel">
            <Row label="Début" value={fmt(task.contract.start)} />
            <Row label="Fin" value={fmt(task.contract.end)} />
          </Section>

          <Section title="Réel">
            <Row label="Début" value={fmt(task.actual.start)} />
            <Row label="Fin" value={task.actual.end ? fmt(task.actual.end) : (task.actual.start ? 'en cours' : '—')} />
          </Section>

          {task.forecast.end && (
            <Section title="Prévision">
              <Row label="Début" value={fmt(task.forecast.start)} />
              <Row label="Fin" value={fmt(task.forecast.end)} />
            </Section>
          )}

          <Section title="Écarts">
            <Row label="Démarrage" value={days(v.startDays)} tone={tone(v.startDays)} />
            <Row label="Fin" value={days(v.endDays)} tone={tone(v.endDays)} />
            <Row label="Prévisionnel" value={days(v.forecastDays)} tone={tone(v.forecastDays)} />
            {v.commitmentDays !== null && <Row label="Engagement" value={days(v.commitmentDays)} tone={tone(v.commitmentDays)} />}
          </Section>

          {task.delayCause !== undefined || onDelayCauseChange ? (
            <Section title="Cause du retard">
              {onDelayCauseChange ? (
                <select
                  value={task.delayCause ?? ''}
                  onChange={e => onDelayCauseChange(e.target.value ? (e.target.value as DelayCause) : undefined)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}
                >
                  <option value="">—</option>
                  {(Object.keys(DELAY_CAUSE_LABEL) as DelayCause[]).map(c => (
                    <option key={c} value={c}>{DELAY_CAUSE_LABEL[c]}</option>
                  ))}
                </select>
              ) : (
                <Row label="Déclarée" value={task.delayCause ? DELAY_CAUSE_LABEL[task.delayCause] : '—'} />
              )}
            </Section>
          ) : null}

          <Section title={`Engagements${task.commitments.length > 1 ? ` (${task.commitments.length})` : ''}`}>
            {task.latestCommitment ? (
              <>
                <Row label="Promis le" value={fmt(new Date(task.latestCommitment.at))} />
                <Row label="Échéance" value={fmt(new Date(task.latestCommitment.promisedEnd))} />
                <Row
                  label="Statut"
                  value={task.latestCommitment.outcome === 'kept' ? 'Tenu' : task.latestCommitment.outcome === 'broken' ? 'Non tenu' : 'En attente'}
                  tone={task.latestCommitment.outcome === 'broken' ? 'bad' : task.latestCommitment.outcome === 'kept' ? 'ok' : undefined}
                />
                {task.commitments.length > 1 && (
                  <button
                    onClick={() => setShowHistory(s => !s)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--navy)', fontSize: 11, fontWeight: 700, padding: '6px 0 0' }}
                  >
                    {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Historique complet
                  </button>
                )}
                {showHistory && task.commitments.slice(1).map(c => (
                  <div key={c.id} style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 0 0 16px' }}>
                    {fmt(new Date(c.at))} → promis {fmt(new Date(c.promisedEnd))}
                    {c.outcome === 'broken' && ' — non tenu'}
                    {c.outcome === 'kept' && ' — tenu'}
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aucun engagement.</div>
            )}
          </Section>

          <Section title="Dépendances">
            {task.dependencies.length > 0 ? (
              task.dependencies.map(dep => (
                <GanttDependency
                  key={dep.predecessorId}
                  dependency={dep}
                  title={allTasksById.get(dep.predecessorId)?.title ?? dep.predecessorId}
                  onRemove={onDependencyRemove ? () => onDependencyRemove(dep.predecessorId) : undefined}
                />
              ))
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aucune liaison.</div>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
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

function days(n: number | null): string {
  if (n === null) return '—'
  if (n === 0) return 'à jour'
  return n > 0 ? `+${n} j` : `${n} j`
}

function tone(n: number | null): 'ok' | 'bad' | undefined {
  if (n === null || n === 0) return undefined
  return n > 0 ? 'bad' : 'ok'
}
