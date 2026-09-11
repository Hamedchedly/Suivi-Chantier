import type { ReactNode } from 'react'

interface TopbarProps {
  title: string
  sub?: string
  eyebrow?: string
  /** Zone d'actions alignée en haut à droite (menu de compte). */
  right?: ReactNode
}

export function Topbar({ title, sub, eyebrow = 'Suivi Chantier', right }: TopbarProps) {
  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {sub && <div className="topbar-sub">{sub}</div>}
        </div>
        {right && <div style={{ flexShrink: 0, paddingTop: '2px' }}>{right}</div>}
      </div>
    </header>
  )
}
