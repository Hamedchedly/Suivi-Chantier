import { useState } from 'react'
import { AlertTriangle, Check, Flag, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { getGanttTasks, getReserves, getAlertActions, saveAlertActions, logActivity } from '../../lib/repo'
import { buildAlerts, activeAlerts, Alert, AlertLevel, AlertActions } from '../../lib/alerts'
import { Journal } from './Journal'

const LEVEL_META: Record<AlertLevel, { label: string; color: string; bg: string }> = {
  critique: { label: 'Critique', color: '#dc2626', bg: '#fdecec' },
  eleve: { label: 'Élevé', color: '#b45309', bg: '#fdf1e0' },
  moyen: { label: 'À surveiller', color: '#02457A', bg: '#e7f0fb' },
}

export function Alertes() {
  const [actions, setActions] = useState<AlertActions>(getAlertActions)
  const [showResolved, setShowResolved] = useState(false)
  const [tab, setTab] = useState<'vigilance' | 'journal'>('vigilance')

  const tasks = getGanttTasks()
  const reserves = getReserves()
  const all = buildAlerts(tasks, reserves, new Date(), actions)
  const active = activeAlerts(all)
  const resolved = all.filter(a => a.resolved)

  const update = (id: string, patch: { resolved?: boolean; flagged?: boolean }) => {
    setActions(prev => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } }
      saveAlertActions(next)
      return next
    })
  }

  const flaggedCount = active.filter(a => a.flagged).length
  const byLevel = (lvl: AlertLevel) => active.filter(a => a.level === lvl)

  const segmented = (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', background: '#eef2f6', padding: '3px', borderRadius: '8px' }}>
      {(['vigilance', 'journal'] as const).map(t => (
        <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#02457A' : '#5b7183', boxShadow: tab === t ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>
          {t === 'vigilance' ? 'Vigilance' : "Journal d'activité"}
        </button>
      ))}
    </div>
  )

  if (tab === 'journal') {
    return (
      <div style={{ padding: '14px 12px', paddingBottom: '24px' }}>
        {segmented}
        <Journal />
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 12px', paddingBottom: '24px' }}>
      {segmented}
      {/* Summary */}
      <div className="card" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: active.length ? 'var(--bad-bg)' : 'var(--ok-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AlertTriangle size={22} color={active.length ? 'var(--bad)' : 'var(--ok)'} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '15px' }}>
            {active.length === 0 ? 'Aucun point de vigilance' : `${active.length} point${active.length > 1 ? 's' : ''} de vigilance`}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {flaggedCount > 0 ? `${flaggedCount} à évoquer en réunion` : 'Priorisés par gravité'}
          </div>
        </div>
      </div>

      {active.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--ok)', fontSize: '14px', marginBottom: '16px' }}>
          Tout est sous contrôle. 👍
        </div>
      )}

      {(['critique', 'eleve', 'moyen'] as AlertLevel[]).map(lvl => {
        const items = byLevel(lvl)
        if (!items.length) return null
        const meta = LEVEL_META[lvl]
        return (
          <div key={lvl} style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: meta.bg, color: meta.color }}>{meta.label}</span>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map(a => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  meta={LEVEL_META[a.level]}
                  onResolve={() => { update(a.id, { resolved: true }); logActivity('alert', `Point résolu : ${a.title}`) }}
                  onFlag={() => { const willFlag = !a.flagged; update(a.id, { flagged: willFlag }); logActivity('alert', `${willFlag ? 'Épinglé réunion' : 'Désépinglé'} : ${a.title}`) }}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Resolved (collapsible) */}
      {resolved.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <button onClick={() => setShowResolved(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', color: 'var(--muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>
            {showResolved ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            Résolues ({resolved.length})
          </button>
          {showResolved && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {resolved.map(a => (
                <div key={a.id} style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '12px', background: '#f7faf8', opacity: 0.85 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'line-through' }}>{a.title}</div>
                    <button onClick={() => update(a.id, { resolved: false })} style={ghost}><RotateCcw size={13} /> Rouvrir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AlertCard({ alert, meta, onResolve, onFlag }: { alert: Alert; meta: { color: string }; onResolve: () => void; onFlag: () => void }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderLeft: `3px solid ${meta.color}`, borderRadius: '12px', padding: '12px', background: '#fff', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{alert.title}</div>
        {alert.flagged && <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, background: 'var(--warn-bg)', color: 'var(--warn)', whiteSpace: 'nowrap' }}>Réunion</span>}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{alert.detail}</div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        <button onClick={onResolve} style={{ ...action, color: 'var(--ok)' }}><Check size={13} /> Confirmer résolu</button>
        <button onClick={onFlag} style={{ ...action, color: alert.flagged ? 'var(--warn)' : 'var(--muted)', background: alert.flagged ? 'var(--warn-bg)' : '#fff' }}>
          <Flag size={13} /> {alert.flagged ? 'Épinglé' : 'À évoquer en réunion'}
        </button>
      </div>
    </div>
  )
}

const action: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }
const ghost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }
