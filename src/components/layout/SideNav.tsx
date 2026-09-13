import { Page, PRIMARY_NAV, GESTION_PAGES } from './navConfig'

/** Marque « mini-planning » de l'application. */
function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="8" y="19" width="34" height="7" rx="3.5" fill="#97CADB" />
      <rect x="8" y="30" width="24" height="7" rx="3.5" fill="#FFFFFF" />
      <rect x="8" y="41" width="30" height="7" rx="3.5" fill="#D6E8EE" />
    </svg>
  )
}

interface Props {
  currentPage: Page
  onPageChange: (p: Page) => void
  onOpenGestion: () => void
  /** Opération affichée — rappelée sous le titre pour éviter toute confusion. */
  projectName: string
}

export function SideNav({ currentPage, onPageChange, onOpenGestion, projectName }: Props) {
  return (
    <nav className="side-nav">
      <div className="snav-brand">
        <div className="snav-logo"><LogoMark size={22} /></div>
        <div>
          <div className="snav-title">Suivi Chantier</div>
          <div className="snav-sub" title={projectName}>{projectName}</div>
        </div>
      </div>
      <div className="snav-items">
        {PRIMARY_NAV.map(({ id, label, icon: Icon }) => {
          const active = id === 'gestion' ? GESTION_PAGES.includes(currentPage) : currentPage === id
          return (
            <button
              key={id}
              className={`snav-item${active ? ' active' : ''}`}
              onClick={() => (id === 'gestion' ? onOpenGestion() : onPageChange(id as Page))}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
      <div className="snav-foot">v5 · prototype</div>
    </nav>
  )
}
