import { useState } from 'react'
import { Reserves } from './Reserves'
import { Meetings } from './Meetings'

// Visits and their compte-rendus are produced by the dedicated Visite module
// (primary navigation). This page groups the two field registers that live
// alongside them: réserves and réunions.
type Section = 'reserves' | 'reunions'

export function CR() {
  const [section, setSection] = useState<Section>('reserves')

  const segmented = (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#eef2f6', padding: '3px', borderRadius: '8px' }}>
      {(['reserves', 'reunions'] as const).map(s => (
        <button
          key={s}
          onClick={() => setSection(s)}
          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: section === s ? '#fff' : 'transparent', color: section === s ? '#02457A' : '#5b7183', boxShadow: section === s ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}
        >
          {s === 'reserves' ? 'Réserves' : 'Réunions'}
        </button>
      ))}
    </div>
  )

  if (section === 'reunions') {
    return (
      <div style={{ padding: '12px', paddingBottom: '80px' }}>
        {segmented}
        <Meetings />
      </div>
    )
  }

  return (
    <div>
      <div style={{ padding: '12px 12px 0' }}>{segmented}</div>
      <Reserves />
    </div>
  )
}
