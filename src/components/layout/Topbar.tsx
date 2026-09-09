interface TopbarProps {
  title: string
  sub?: string
  eyebrow?: string
}

export function Topbar({ title, sub, eyebrow = 'Suivi Chantier' }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {sub && <div className="topbar-sub">{sub}</div>}
    </header>
  )
}
