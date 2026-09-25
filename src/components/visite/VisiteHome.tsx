import { Plus, Calendar } from 'lucide-react'
import type { Visit } from '../../lib/visits'
import { fmtFr } from './visiteStyles'

interface Props {
  visits: Visit[]
  onCreateVisit: () => void
  onOpenVisit: (id: string) => void
}

export function VisiteHome(props: Props) {
  const { visits, onCreateVisit, onOpenVisit } = props
  const inProgressVisit = visits.find(v => v.status === 'en_cours')

  return (
    <div style={{ paddingBottom: '16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏗️</div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f1628', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Visite chantier</h1>
      </div>

      {/* Active Visit Card */}
      {inProgressVisit && (
        <div
          onClick={() => onOpenVisit(inProgressVisit.id)}
          style={{
            background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
            border: '1px solid #0284c7',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '32px',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0369a1' }}>EN COURS</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f1628', marginTop: '4px' }}>{inProgressVisit.zones[0]?.buildingLabel || 'Visite'}</div>
            </div>
            <span style={{ fontSize: '20px' }}>⏱️</span>
          </div>
          <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '12px' }}>{fmtFr(inProgressVisit.date)} • {inProgressVisit.zones.filter(z => !z.closedAt).length} zones restantes</div>
          <div style={{ height: '6px', background: 'rgba(2, 132, 199, 0.2)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#0284c7', width: `${Math.round((inProgressVisit.zones.filter(z => z.closedAt).length / inProgressVisit.zones.length) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={onCreateVisit}
        style={{
          width: '100%',
          padding: '16px',
          background: '#0284c7',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'background 150ms ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#0369a1'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#0284c7'}
      >
        <Plus size={20} />
        Nouvelle visite
      </button>

      {/* Recent Visits */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>Visites récentes</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visits.filter(v => v.status !== 'en_cours').slice(0, 5).map(v => (
            <button
              key={v.id}
              onClick={() => onOpenVisit(v.id)}
              style={{
                textAlign: 'left',
                padding: '12px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0284c7'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f1628' }}>{fmtFr(v.date)}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{v.zones.length} zones • {v.zones.filter(z => z.closedAt).length} complétées</div>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: v.status === 'diffuse' ? '#dcfce7' : v.status === 'cr_pret' ? '#fef3c7' : '#e2e8f0',
                  color: v.status === 'diffuse' ? '#15803d' : v.status === 'cr_pret' ? '#b45309' : '#64748b',
                }}>
                  {v.status === 'diffuse' ? '✓ Diffusé' : v.status === 'cr_pret' ? 'CR prêt' : 'Terminée'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
