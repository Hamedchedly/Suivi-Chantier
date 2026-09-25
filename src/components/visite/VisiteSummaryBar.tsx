import { ChevronRight } from 'lucide-react'

interface Props {
  totalZones: number
  completedZones: number
  toReviewCount: number
  photosCount: number
  remarksCount: number
  onShowSummary?: () => void
}

export function VisiteSummaryBar(props: Props) {
  const { totalZones, completedZones, toReviewCount, photosCount, remarksCount, onShowSummary } = props
  const percentage = Math.round((completedZones / totalZones) * 100)

  return (
    <button
      onClick={onShowSummary}
      style={{
        width: '100%',
        background: '#f0f9ff',
        border: '1px solid #e0f2fe',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '16px',
        cursor: onShowSummary ? 'pointer' : 'default',
        transition: 'all 150ms ease',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#0369a1' }}>Progression visite</div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7' }}>{completedZones} / {totalZones} zones</div>
      </div>

      <div style={{ height: '6px', background: '#cbd5e1', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
        <div style={{ height: '100%', background: '#0284c7', width: `${percentage}%`, transition: 'width 300ms ease' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#475569', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <span>📋 {remarksCount} obs</span>
          <span>•</span>
          <span>📷 {photosCount} photos</span>
          <span>•</span>
          <span>⚠️ {toReviewCount} à revoir</span>
        </div>
        {onShowSummary && <ChevronRight size={14} />}
      </div>
    </button>
  )
}
