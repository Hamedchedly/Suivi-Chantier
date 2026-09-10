import { X } from 'lucide-react'
import { GanttTask } from '../../types/gantt'
import { driftDays } from '../../lib/schedule'
import { LOGEMENTS } from '../../data/zones'

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  'completed': { label: 'Terminé', color: '#15803d', bg: '#e6f6ec' },
  'in-progress': { label: 'En cours', color: '#018ABE', bg: '#e7f0fb' },
  'delayed': { label: 'En retard', color: '#dc2626', bg: '#fdecec' },
  'blocked': { label: 'Bloqué', color: '#dc2626', bg: '#fdecec' },
  'not-started': { label: 'Non démarré', color: '#5b7183', bg: '#eef2f6' },
  'cancelled': { label: 'Annulé', color: '#6b21a8', bg: '#f3e8ff' },
}
const logementLabel = (id?: string) => (id ? LOGEMENTS.find(l => l.id === id)?.label ?? id : '—')
const fmt = (d?: Date) => (d ? d.toLocaleDateString('fr') : '—')

interface Props {
  task: GanttTask
  onClose: () => void
  onProgress?: (taskId: string, progress: number) => void
  /** Marge totale (jours) issue du CPM — absente pour les regroupements. */
  totalFloat?: number
}

export function TaskDetail({ task, onClose, onProgress, totalFloat }: Props) {
  const drift = driftDays(task)
  const st = STATUS_LABEL[task.status] ?? STATUS_LABEL['not-started']

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,27,72,.4)', zIndex: 300 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(380px, 92vw)', background: '#fff', zIndex: 301, boxShadow: '-8px 0 30px rgba(2,27,72,.22)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg, #02457A, #001B48)', color: '#fff', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--sky)', fontWeight: 700 }}>
                Tâche {task.is_milestone ? '· jalon' : ''}{task.is_critical ? ' · critique' : ''}
              </div>
              <h2 style={{ color: '#fff', margin: '4px 0 0', fontSize: '17px', lineHeight: 1.25 }}>{task.title}</h2>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: '8px', padding: '6px', cursor: 'pointer', flexShrink: 0 }}><X size={16} /></button>
          </div>
          <span style={{ display: 'inline-block', marginTop: '10px', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
        </div>

        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {/* Progress */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Avancement</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)' }}>{task.progress}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${task.progress}%` }} /></div>
            {onProgress && !task.is_milestone && (
              <input type="range" min={0} max={100} step={5} value={task.progress} onChange={e => onProgress(task.id, Number(e.target.value))} style={{ width: '100%', marginTop: '8px' }} />
            )}
          </div>

          <Row label="Lot" value={task.lot_id || '—'} />
          <Row label="Logement" value={logementLabel(task.logement_id)} />
          <div style={{ height: '1px', background: 'var(--line)', margin: '10px 0' }} />
          <Row label="Contractuel — début" value={fmt(task.baseline_start)} />
          <Row label="Contractuel — fin" value={fmt(task.baseline_end)} />
          <Row label="Planifié — début" value={fmt(task.planned_start)} />
          <Row label="Planifié — fin" value={fmt(task.planned_end)} />
          <Row label="Dérive" value={drift > 0 ? `+${drift} j` : 'à jour'} tone={drift > 0 ? 'bad' : 'ok'} />
          {totalFloat !== undefined && (
            <Row
              label="Marge totale"
              value={totalFloat <= 0 ? 'aucune (critique)' : `${totalFloat} j`}
              tone={totalFloat <= 0 ? 'bad' : 'ok'}
            />
          )}
          {task.dependencies.length > 0 && (
            <>
              <div style={{ height: '1px', background: 'var(--line)', margin: '10px 0' }} />
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>Prédécesseurs</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {task.dependencies.map(d => <span key={d} style={{ fontSize: '11px', background: '#eef2f6', color: 'var(--navy)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>{d}</span>)}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'ok' ? 'var(--ok)' : 'var(--ink)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', padding: '5px 0' }}>
      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color }}>{value}</span>
    </div>
  )
}
