import { useState } from 'react'
import { Plus, Camera, Calendar, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import type { Visit, VisitZone, visitCounts as visitCountsType } from '../../lib/visits'
import {
  ZONE_META, lotLabel, sectionLabel, badge, zoneRow, visitCard,
} from './visiteStyles'

interface Props {
  visit: Visit
  zones: VisitZone[]
  counts: ReturnType<typeof visitCountsType>
  remainingCount: number
  photos: { length: number }
  onOpenZone: (refId: string) => void
  onAddObservation: () => void
  onAddPhoto: () => void
  onTerminate: () => void
}

export function VisiteSessionView(props: Props) {
  const { visit, zones, counts, remainingCount, photos, onOpenZone, onAddObservation, onAddPhoto, onTerminate } = props
  const [showCompleted, setShowCompleted] = useState(false)

  const progressPercent = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0

  return (
    <div style={{ paddingBottom: '90px' }}>
      {/* Header Progress Card */}
      <div style={{ background: '#f0f9ff', border: '1px solid #e0f2fe', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: '#0369a1', marginBottom: '8px', fontWeight: 600 }}>Progression</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#0284c7' }}>{counts.done}</div>
          <div style={{ fontSize: '14px', color: '#475569' }}>/ {counts.total} zones</div>
        </div>
        <div style={{ height: '8px', background: '#cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#0284c7', width: `${progressPercent}%`, transition: 'width 300ms ease' }} />
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '24px' }}>
        <div style={{ background: '#dcfce7', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>{counts.done}</div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>Terminées</div>
        </div>
        <div style={{ background: '#fef3c7', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>{counts.to_review}</div>
          <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>À revoir</div>
        </div>
        <div style={{ background: '#fee2e2', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{counts.blocked}</div>
          <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>Bloquées</div>
        </div>
        <div style={{ background: '#e2e8f0', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#64748b' }}>{counts.not_started}</div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>Restantes</div>
        </div>
      </div>

      {/* Zones List */}
      <div style={sectionLabel}>À visiter</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
        {zones
          .filter(z => z.closedAt === undefined || showCompleted)
          .map(z => {
            const state = z.tasks.length === 0 ? 'not_started' : z.tasks.every(t => t.state === 'ok') ? 'done' : 'in_progress'
            const m = ZONE_META[state]
            const works = z.tasks.length > 0 ? Math.round(z.tasks.reduce((sum, t) => sum + (t.progress ?? 0), 0) / z.tasks.length) : 0
            return (
              <button
                key={z.refId}
                onClick={() => onOpenZone(z.refId)}
                style={{
                  ...zoneRow,
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr auto auto',
                  alignItems: 'center',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.dot, justifySelf: 'center' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy)' }}>{z.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Avancement {works}%</div>
                </div>
                <span style={{ ...badge, background: m.bg, color: m.fg, whiteSpace: 'nowrap' }}>{m.label}</span>
                <ChevronRight size={14} color="var(--muted)" />
              </button>
            )
          })}
      </div>

      {remainingCount === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 16px', background: '#f1f5f9', borderRadius: '8px', marginBottom: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
          <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: '4px' }}>Tous les logements ont été contrôlés</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Générer le compte rendu maintenant</div>
        </div>
      )}

      {/* Bottom Actions */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '12px', paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))', display: 'flex', gap: '8px', zIndex: 20 }}>
        <button
          onClick={onAddObservation}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '6px',
            background: '#f1f5f9',
            color: 'var(--navy)',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          + Obs.
        </button>
        <button
          onClick={onAddPhoto}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '6px',
            background: '#f1f5f9',
            color: 'var(--navy)',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          📷 Photo
        </button>
        <button
          onClick={onTerminate}
          disabled={remainingCount > 0}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '6px',
            background: remainingCount > 0 ? '#cbd5e1' : '#0284c7',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            cursor: remainingCount > 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Terminer
        </button>
      </div>
    </div>
  )
}
