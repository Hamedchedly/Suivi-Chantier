import { useState } from 'react'
import { X } from 'lucide-react'
import { GanttTask } from '../../types/gantt'
import { driftDays } from '../../lib/schedule'
import { getTaskUnits, getZoneRefs } from '../../lib/repo'
import { unitIdsForTask } from '../../lib/units'

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  'completed': { label: 'Terminé', color: '#15803d', bg: '#e6f6ec' },
  'in-progress': { label: 'En cours', color: '#018ABE', bg: '#e7f0fb' },
  'delayed': { label: 'En retard', color: '#dc2626', bg: '#fdecec' },
  'blocked': { label: 'Bloqué', color: '#dc2626', bg: '#fdecec' },
  'not-started': { label: 'Non démarré', color: '#5b7183', bg: '#eef2f6' },
  'cancelled': { label: 'Annulé', color: '#6b21a8', bg: '#f3e8ff' },
}
/** Zones rattachées à la tâche (via « Bâtiments & zones »), pour affichage. */
const zonesOfTask = (taskId: string): string => {
  const labels = new Map(getZoneRefs().map(z => [z.refId, z.label]))
  const names = unitIdsForTask(getTaskUnits(), taskId).map(id => labels.get(id) ?? id)
  return names.length ? names.join(', ') : '—'
}
const fmt = (d?: Date) => (d ? d.toLocaleDateString('fr') : '—')

interface Props {
  task: GanttTask
  onClose: () => void
  onProgress?: (taskId: string, progress: number) => void
  /** Modifie les dates planifiées (déclenche l'auto-planification). */
  onDates?: (taskId: string, updates: { planned_start?: Date; planned_end?: Date }) => void
  /** Saisir / corriger la date de début réelle. */
  onActualStart?: (taskId: string, date: Date | null) => void
  /** Permet de corriger la date de fin réelle (tâches historiques). */
  onActualEnd?: (taskId: string, date: Date | null) => void
  /** Modifie la méthode de calcul forecast. */
  onForecastMethod?: (taskId: string, method: 'actual_rate' | 'contractual_duration' | 'manual') => void
  /** Marge totale (jours) issue du CPM — absente pour les regroupements. */
  totalFloat?: number
  /** Toutes les tâches disponibles pour ajouter des liaisons. */
  allTasks?: GanttTask[]
  /** Ajouter un prédécesseur à cette tâche. */
  onDependencyAdd?: (taskId: string, depId: string) => void
  /** Retirer un prédécesseur de cette tâche. */
  onDependencyRemove?: (taskId: string, depId: string) => void
}

const isoDate = (d: Date) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const parseDate = (s: string) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd) }

export function TaskDetail({ task, onClose, onProgress, onDates, onActualStart, onActualEnd, onForecastMethod, totalFloat, allTasks, onDependencyAdd, onDependencyRemove }: Props) {
  const [depSearch, setDepSearch] = useState('')
  const editable = !!onDates && !task.children?.length
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
          <Row label="Zones" value={zonesOfTask(task.id)} />
          <div style={{ height: '1px', background: 'var(--line)', margin: '10px 0' }} />
          {/* Le contractuel EST le prévisionnel : une seule paire de dates saisies. */}
          {editable ? (
            <>
              <EditRow
                label="Contractuel — début"
                value={isoDate(task.planned_start)}
                onChange={v => onDates!(task.id, { planned_start: parseDate(v) })}
              />
              <EditRow
                label="Contractuel — fin"
                value={isoDate(task.planned_end)}
                onChange={v => onDates!(task.id, { planned_end: parseDate(v) })}
              />
            </>
          ) : (
            <>
              <Row label="Contractuel — début" value={fmt(task.planned_start)} />
              <Row label="Contractuel — fin" value={fmt(task.planned_end)} />
            </>
          )}
          {onActualStart ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Réel — début</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="date"
                  value={task.actual_start ? isoDate(task.actual_start) : ''}
                  onChange={e => e.target.value && onActualStart(task.id, parseDate(e.target.value))}
                  style={{ width: '140px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}
                />
                {task.actual_start && (
                  <button onClick={() => onActualStart(task.id, null)} title="Effacer" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, padding: '2px 4px' }}>✕</button>
                )}
              </div>
            </div>
          ) : (
            <Row label="Réel — début" value={fmt(task.actual_start)} />
          )}
          {onActualEnd && task.actual_end ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Réel — fin</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="date"
                  value={isoDate(task.actual_end)}
                  onChange={e => e.target.value && onActualEnd(task.id, parseDate(e.target.value))}
                  style={{ width: '140px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}
                />
                <button
                  onClick={() => onActualEnd(task.id, null)}
                  title="Effacer la date réelle de fin"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, padding: '2px 4px' }}
                >✕</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', padding: '5px 0' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Réel — fin</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  {task.actual_end ? fmt(task.actual_end) : (task.actual_start ? 'en cours' : '—')}
                </span>
                {onActualEnd && !task.actual_end && task.actual_start && (
                  <button
                    onClick={() => onActualEnd(task.id, new Date())}
                    title="Saisir la date de fin réelle"
                    style={{ border: '1px solid var(--line)', background: '#f8fafc', cursor: 'pointer', color: 'var(--navy)', fontSize: 11, padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}
                  >+ fin réelle</button>
                )}
              </div>
            </div>
          )}
          {onForecastMethod && task.forecast_start && (
            <>
              <div style={{ height: '1px', background: 'var(--line)', margin: '10px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Calcul prévision</span>
                <select
                  value={task.forecast_method || 'actual_rate'}
                  onChange={e => onForecastMethod(task.id, e.target.value as 'actual_rate' | 'contractual_duration' | 'manual')}
                  style={{ width: '140px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}
                >
                  <option value="actual_rate">Rythme réel</option>
                  <option value="contractual_duration">Durée contractuelle</option>
                  <option value="manual">Manuel</option>
                </select>
              </div>
            </>
          )}
          <Row label="Écart / contractuel" value={drift > 0 ? `+${drift} j` : 'à jour'} tone={drift > 0 ? 'bad' : 'ok'} />
          {totalFloat !== undefined && (
            <Row
              label="Marge totale"
              value={totalFloat <= 0 ? 'aucune (critique)' : `${totalFloat} j`}
              tone={totalFloat <= 0 ? 'bad' : 'ok'}
            />
          )}
          {/* Dependencies section */}
          <div style={{ height: '1px', background: 'var(--line)', margin: '10px 0' }} />
          <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '6px' }}>Prédécesseurs</div>
          {task.dependencies.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
              {task.dependencies.map(d => {
                const depTask = allTasks?.find(t => t.id === d)
                return (
                  <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#eef2f6', color: 'var(--navy)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                    {depTask ? depTask.title : d}
                    {onDependencyRemove && (
                      <button onClick={() => onDependencyRemove(task.id, d)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                    )}
                  </span>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Aucune liaison</div>
          )}
          {onDependencyAdd && allTasks && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Rechercher une tâche…"
                value={depSearch}
                onChange={e => setDepSearch(e.target.value)}
                style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '11px', color: 'var(--ink)' }}
              />
            </div>
          )}
          {onDependencyAdd && allTasks && depSearch.trim().length > 0 && (
            <div style={{ marginTop: '4px', border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden', maxHeight: '140px', overflowY: 'auto' }}>
              {allTasks
                .filter(t => t.id !== task.id && !task.dependencies.includes(t.id) && t.title.toLowerCase().includes(depSearch.toLowerCase()))
                .slice(0, 8)
                .map(t => (
                  <div
                    key={t.id}
                    onClick={() => { onDependencyAdd(task.id, t.id); setDepSearch('') }}
                    style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer', borderBottom: '1px solid #f0f5f9', color: 'var(--ink)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f5f9')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{t.lot_id}</span> · {t.title}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function EditRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{label}</span>
      <input
        type="date"
        value={value}
        onChange={e => e.target.value && onChange(e.target.value)}
        style={{ width: '150px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}
      />
    </div>
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
