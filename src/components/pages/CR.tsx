import { useState } from 'react'
import { Reserves } from './Reserves'
import { Meetings } from './Meetings'
import { CrTable } from './CrTable'

// Visits and their compte-rendus are produced by the dedicated Visite module
// (primary navigation). This page groups the field registers that live alongside
// them: réserves (terrain), le tableau CR (points/mémos + import), et réunions.
type Section = 'reserves' | 'tableau' | 'reunions'
const LABEL: Record<Section, string> = { reserves: 'Réserves', tableau: 'Tableau CR', reunions: 'Réunions' }

export function CR() {
  const [section, setSection] = useState<Section>('tableau')

  const segmented = (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#eef2f6', padding: '3px', borderRadius: '8px' }}>
      {(['reserves', 'tableau', 'reunions'] as const).map(s => (
        <button
          key={s}
          onClick={() => setSection(s)}
          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: section === s ? '#fff' : 'transparent', color: section === s ? '#02457A' : '#5b7183', boxShadow: section === s ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}
        >
          {LABEL[s]}
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

  if (section === 'tableau') {
    return (
      <div>
        <div style={{ padding: '12px 12px 0' }}>{segmented}</div>
        <CrTable />
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
