// Panneau détail d'une tâche (section 27) : avancement, les trois réalités,
// écarts, engagements (dernier + historique), dépendances, cause du retard.
// Tout ce qui est affiché vient de PlanningTask — rien n'est recalculé ici.
// L'édition (avancement, dates, dépendances) délègue au même pipeline que
// l'ancien Gantt (handleProgress/handleTaskUpdate dans pages/Gantt.tsx) via
// les callbacks optionnels : en lecture seule (ShareView, ex.) on les omet.
import { useEffect, useState } from 'react'
import { X, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { PlanningTask } from '../../../types/planning'
import { DelayCause, DELAY_CAUSE_LABEL } from '../../../types/gantt'
import { GanttDependency } from './GanttDependency'

const fmt = (d?: Date) => (d ? d.toLocaleDateString('fr') : '—')
const isoDate = (d: Date): string => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const parseDate = (s: string): Date => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd) }

interface Props {
  task: PlanningTask
  allTasksById: Map<string, PlanningTask>
  onClose: () => void
  onDelayCauseChange?: (cause: DelayCause | undefined) => void
  onDependencyRemove?: (predecessorId: string) => void
  onDependencyAdd?: (predecessorId: string) => void
  onProgress?: (progress: number) => void
  onPlannedDates?: (updates: { start?: Date; end?: Date }) => void
  onActualStart?: (date: Date | null) => void
  onActualEnd?: (date: Date | null) => void
  /** Présent uniquement quand la tâche sélectionnée peut recevoir une sous-tâche
   * (tâche de profondeur 1, sans enfant — voir createSubTask dans lib/planning.ts). */
  onSubTaskAdd?: (title: string, start: string, duration: number) => void
}

export function GanttDetails({
  task, allTasksById, onClose, onDelayCauseChange, onDependencyRemove, onDependencyAdd,
  onProgress, onPlannedDates, onActualStart, onActualEnd, onSubTaskAdd,
}: Props) {
  // DEBUG: Log the task being displayed
  console.log('[GanttDetails] rendered with task:', { id: task.id, title: task.title, onProgressAvailable: !!onProgress })

  const [showHistory, setShowHistory] = useState(false)
  const [depSearch, setDepSearch] = useState('')
  const [subTaskForm, setSubTaskForm] = useState(false)

  // CRITICAL: Monitor mount/unmount to verify key prop works
  useEffect(() => {
    console.log(`[GanttDetails.MOUNT] MOUNTED with task ${task.id}`)
    return () => {
      console.log(`[GanttDetails.UNMOUNT] UNMOUNTED from task ${task.id}`)
    }
  }, []) // Empty dependency = only mount/unmount
  // Feedback visuel UNIQUEMENT pendant le glissement du curseur — la vraie source est task.progress.
  // Quand l'utilisateur relâche (onMouseUp/onTouchEnd/onKeyUp), onProgress('taskId', value) met à jour la source.
  // Dès que task.progress change (après onProgress), ce composant reçoit une nouvelle prop et l'affiche.
  const [dragProgress, setDragProgress] = useState<number | null>(null)
  const displayProgress = dragProgress !== null ? dragProgress : task.progress
  const v = task.variance

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,27,72,.4)', zIndex: 300 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(400px, 92vw)', background: '#fff', zIndex: 301, boxShadow: '-8px 0 30px rgba(2,27,72,.22)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg, #02457A, #001B48)', color: '#fff', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--sky)', fontWeight: 700 }}>
                {task.lotId}{task.isMilestone ? ' · jalon' : ''}{task.isCritical ? ' · critique' : ''}{task.isNa ? ' · N/A' : ''}
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
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{displayProgress}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${displayProgress}%` }} /></div>
            {onProgress && !task.isMilestone && !task.children?.length && (
              <input
                type="range" min={0} max={100} step={5} value={displayProgress}
                onChange={e => setDragProgress(Number(e.target.value))}
                onMouseUp={e => { const v = Number((e.target as HTMLInputElement).value); console.log('[GanttDetails.slider] onMouseUp:', { taskId: task.id, newValue: v }); setDragProgress(null); onProgress(v) }}
                onTouchEnd={e => { const v = Number((e.target as HTMLInputElement).value); console.log('[GanttDetails.slider] onTouchEnd:', { taskId: task.id, newValue: v }); setDragProgress(null); onProgress(v) }}
                onKeyUp={e => { const v = Number((e.target as HTMLInputElement).value); console.log('[GanttDetails.slider] onKeyUp:', { taskId: task.id, newValue: v }); setDragProgress(null); onProgress(v) }}
                style={{ width: '100%', marginTop: 8 }}
              />
            )}
          </div>

          <Section title="Contractuel">
            {onPlannedDates && !task.children?.length ? (
              <>
                <EditRow label="Début" value={isoDate(task.contract.start)} onChange={v => onPlannedDates({ start: parseDate(v) })} />
                <EditRow label="Fin" value={isoDate(task.contract.end)} onChange={v => onPlannedDates({ end: parseDate(v) })} />
              </>
            ) : (
              <>
                <Row label="Début" value={fmt(task.contract.start)} />
                <Row label="Fin" value={fmt(task.contract.end)} />
              </>
            )}
          </Section>

          <Section title="Réel">
            {onActualStart && !task.children?.length ? (
              <EditRow
                label="Début" value={task.actual.start ? isoDate(task.actual.start) : ''}
                onChange={v => onActualStart(v ? parseDate(v) : null)} clearable={!!task.actual.start}
                onClear={() => onActualStart(null)}
              />
            ) : (
              <Row label="Début" value={fmt(task.actual.start)} />
            )}
            {onActualEnd && !task.children?.length ? (
              <EditRow
                label="Fin" value={task.actual.end ? isoDate(task.actual.end) : ''}
                onChange={v => onActualEnd(v ? parseDate(v) : null)} clearable={!!task.actual.end}
                onClear={() => onActualEnd(null)}
              />
            ) : (
              <Row label="Fin" value={task.actual.end ? fmt(task.actual.end) : (task.actual.start ? 'en cours' : '—')} />
            )}
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
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: onDependencyAdd ? 8 : 0 }}>Aucune liaison.</div>
            )}
            {onDependencyAdd && (
              <div style={{ marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="Rechercher une tâche…"
                  value={depSearch}
                  onChange={e => setDepSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink)', boxSizing: 'border-box' }}
                />
                {depSearch.trim().length > 0 && (
                  <div style={{ marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', maxHeight: 140, overflowY: 'auto' }}>
                    {[...allTasksById.values()]
                      .filter(t => t.id !== task.id && !task.dependencies.some(d => d.predecessorId === t.id) && t.title.toLowerCase().includes(depSearch.toLowerCase()))
                      .slice(0, 8)
                      .map(t => (
                        <div
                          key={t.id}
                          onClick={() => { onDependencyAdd(t.id); setDepSearch('') }}
                          style={{ padding: '6px 10px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid #f0f5f9', color: 'var(--ink)' }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{t.lotId}</span> · {t.title}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          {onSubTaskAdd && (
            <Section title="Sous-tâche">
              {subTaskForm ? (
                <SubTaskForm
                  onAdd={(title, start, duration) => { onSubTaskAdd(title, start, duration); setSubTaskForm(false) }}
                  onCancel={() => setSubTaskForm(false)}
                />
              ) : (
                <button
                  onClick={() => setSubTaskForm(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: '#eff6ff',
                    color: '#2563eb', fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
                  }}
                >
                  <Plus size={13} /> Ajouter une sous-tâche
                </button>
              )}
            </Section>
          )}
        </div>
      </div>
    </>
  )
}

function SubTaskForm({ onAdd, onCancel }: {
  onAdd: (title: string, start: string, duration: number) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(today)
  const [duration, setDuration] = useState('3')
  const inp: React.CSSProperties = { padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12, color: 'var(--ink)', width: '100%', boxSizing: 'border-box' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de la sous-tâche" style={inp} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inp} />
        <input type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} style={inp} title="Durée (jours)" />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          disabled={!title.trim()}
          onClick={() => onAdd(title.trim(), start, parseInt(duration) || 1)}
          style={{ flex: 1, border: 'none', background: '#018ABE', color: '#fff', fontWeight: 700, fontSize: 12, borderRadius: 6, padding: '7px 10px', cursor: title.trim() ? 'pointer' : 'not-allowed', opacity: title.trim() ? 1 : 0.5 }}
        >
          Ajouter
        </button>
        <button onClick={onCancel} style={{ border: '1px solid var(--line)', background: '#fff', color: 'var(--muted)', fontSize: 12, borderRadius: 6, padding: '7px 10px', cursor: 'pointer' }}>
          Annuler
        </button>
      </div>
    </div>
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

function EditRow({ label, value, onChange, clearable, onClear }: {
  label: string; value: string; onChange: (v: string) => void; clearable?: boolean; onClear?: () => void
}) {
  // Tampon local : le recalcul complet (dates → CPM/forecast/geometry) ne
  // doit se déclencher qu'une fois la sélection terminée, pas à chaque
  // caractère saisi ou étape du sélecteur de date natif.
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="date" value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => { if (local && local !== value) onChange(local) }}
          style={{ width: 140, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}
        />
        {clearable && onClear && (
          <button onClick={onClear} title="Effacer" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, padding: '2px 4px' }}>✕</button>
        )}
      </div>
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
