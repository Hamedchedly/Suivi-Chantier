import { useState } from 'react'
import { Meetings } from './Meetings'
import { CrTable } from './CrTable'
import { Notes } from './Notes'
import { Breadcrumbs, buildCrBreadcrumbs } from '../layout/Breadcrumbs'

type Section = 'journal' | 'reunions' | 'notes'
const LABEL: Record<Section, string> = { journal: 'Journal CR', reunions: 'Réunions', notes: 'Notes & suivi' }

export function CR() {
  const [section, setSection] = useState<Section>('journal')
  const breadcrumbs = buildCrBreadcrumbs(section)

  const segmented = (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#eef2f6', padding: '3px', borderRadius: '8px' }}>
      {(['journal', 'notes', 'reunions'] as const).map(s => (
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
        <Breadcrumbs crumbs={breadcrumbs} />
        {segmented}
        <Meetings />
      </div>
    )
  }

  if (section === 'notes') {
    return (
      <div>
        <div style={{ padding: '12px 12px 0' }}>
          <Breadcrumbs crumbs={breadcrumbs} />
          {segmented}
        </div>
        <Notes />
      </div>
    )
  }

  return (
    <div>
      <div style={{ padding: '12px 12px 0' }}>
        <Breadcrumbs crumbs={breadcrumbs} />
        {segmented}
      </div>
      <CrTable />
    </div>
  )
}
