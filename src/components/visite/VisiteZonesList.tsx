import { useState, useMemo } from 'react'
import { Search, ChevronRight } from 'lucide-react'
import type { VisitZone } from '../../lib/visits'
import { ZONE_META, badge, zoneRow } from './visiteStyles'

type FilterType = 'all' | 'todo' | 'review' | 'done'

interface Props {
  zones: VisitZone[]
  onSelectZone: (refId: string) => void
}

export function VisiteZonesList(props: Props) {
  const { zones, onSelectZone } = props
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let result = zones

    // Filter by state
    if (filter !== 'all') {
      result = result.filter(z => {
        const state = z.tasks.length === 0 ? 'not_started' : z.tasks.every(t => t.state === 'ok') ? 'done' : z.tasks.some(t => t.state === 'to_review') ? 'to_review' : 'in_progress'
        if (filter === 'todo') return ['not_started', 'in_progress'].includes(state)
        if (filter === 'review') return state === 'to_review'
        if (filter === 'done') return state === 'done'
        return true
      })
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(z => z.label.toLowerCase().includes(q) || z.buildingLabel.toLowerCase().includes(q))
    }

    return result
  }, [zones, filter, search])

  return (
    <div style={{ paddingBottom: '16px' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', scrollBehavior: 'smooth' }}>
        {(['all', 'todo', 'review', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 12px',
              borderRadius: '16px',
              border: 'none',
              background: filter === f ? '#0284c7' : '#f1f5f9',
              color: filter === f ? '#fff' : '#64748b',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease',
            }}
          >
            {f === 'all' && 'Tous'}
            {f === 'todo' && 'À faire'}
            {f === 'review' && 'À revoir'}
            {f === 'done' && 'Terminés'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Chercher un logement..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 10px 10px 36px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Zones Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {filtered.map(z => {
          const state = z.tasks.length === 0 ? 'not_started' : z.tasks.every(t => t.state === 'ok') ? 'done' : z.tasks.some(t => t.state === 'to_review') ? 'to_review' : 'in_progress'
          const m = ZONE_META[state]
          const works = z.tasks.length > 0 ? Math.round(z.tasks.reduce((sum, t) => sum + (t.progress ?? 0), 0) / z.tasks.length) : 0
          const doneCount = z.tasks.filter(t => t.state === 'ok').length

          return (
            <button
              key={z.refId}
              onClick={() => onSelectZone(z.refId)}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.borderColor = '#0284c7'
                el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.borderColor = '#e2e8f0'
                el.style.boxShadow = 'none'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f1628' }}>{z.label}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{z.buildingLabel}</div>
                </div>
                <span style={{ ...badge, background: m.bg, color: m.fg }}>{doneCount}/{z.tasks.length}</span>
              </div>

              {/* Metadata */}
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
                {z.buildingLabel}
              </div>

              {/* Progress bar */}
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ height: '100%', background: '#0284c7', width: `${works}%`, transition: 'width 300ms ease' }} />
              </div>

              {/* Status badges */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                {state === 'done' && <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>✓ Contrôlé</span>}
                {state === 'to_review' && <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>⚠ À revoir</span>}
                {state === 'in_progress' && <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600 }}>En cours</span>}
                {state === 'not_started' && <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>À commencer</span>}
              </div>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
          <div style={{ fontSize: '14px' }}>Aucun logement ne correspond à votre recherche</div>
        </div>
      )}
    </div>
  )
}
