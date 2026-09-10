import { ClipboardList, Flag, Euro, BarChart3, FileText, AlertTriangle, Check } from 'lucide-react'
import { getActivity } from '../../lib/repo'
import { ActivityType, relativeTime, groupByDay } from '../../lib/activity'

const META: Record<ActivityType, { color: string; bg: string; Icon: typeof ClipboardList }> = {
  visit: { color: '#02457A', bg: '#e7f0fb', Icon: ClipboardList },
  reserve: { color: '#b45309', bg: '#fdf1e0', Icon: Flag },
  resolve: { color: '#15803d', bg: '#e6f6ec', Icon: Check },
  finance: { color: '#018ABE', bg: '#e7f0fb', Icon: Euro },
  planning: { color: '#02457A', bg: '#e7f0fb', Icon: BarChart3 },
  alert: { color: '#dc2626', bg: '#fdecec', Icon: AlertTriangle },
  doc: { color: '#5b7183', bg: '#eef2f6', Icon: FileText },
}

export function Journal() {
  const events = getActivity()
  const now = new Date()
  const groups = groupByDay(events)

  if (events.length === 0) {
    return <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>Aucune activité enregistrée.</div>
  }

  return (
    <div>
      {groups.map(g => (
        <div key={g.day} style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '8px' }}>{g.label}</div>
          <div style={{ position: 'relative', paddingLeft: '8px' }}>
            {g.events.map((e, i) => {
              const m = META[e.type] ?? META.doc
              const Icon = m.Icon
              return (
                <div key={e.id} style={{ display: 'flex', gap: '10px', paddingBottom: i === g.events.length - 1 ? 0 : '14px', position: 'relative' }}>
                  {/* timeline line */}
                  {i !== g.events.length - 1 && <div style={{ position: 'absolute', left: '15px', top: '30px', bottom: 0, width: '2px', background: 'var(--line)' }} />}
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ flex: 1, paddingTop: '2px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--ink)' }}>{e.message}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{relativeTime(e.at, now)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
