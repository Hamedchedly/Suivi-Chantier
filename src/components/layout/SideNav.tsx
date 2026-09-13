import { Page, PRIMARY_NAV, GESTION_PAGES } from './navConfig'

/** Marque « mini-planning » de l'application : barres d'avancement + repère du jour. */
function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <rect x="6" y="16" width="40" height="7" rx="3.5" fill="#FFFFFF" opacity=".22" />
      <rect x="6" y="16" width="29" height="7" rx="3.5" fill="#97CADB" />
      <rect x="6" y="26" width="40" height="7" rx="3.5" fill="#FFFFFF" opacity=".22" />
      <rect x="6" y="26" width="22" height="7" rx="3.5" fill="#FFFFFF" />
      <rect x="6" y="36" width="40" height="7" rx="3.5" fill="#FFFFFF" opacity=".22" />
      <rect x="6" y="36" width="35" height="7" rx="3.5" fill="#56B6D6" />
      <rect x="32" y="12" width="3" height="35" rx="1.5" fill="#FFFFFF" opacity=".9" />
    </svg>
  )
}

interface Props {
  currentPage: Page
  onPageChange: (p: Page) => void
  onOpenGestion: () => void
  /** Opération affichée — rappelée sous le titre pour éviter toute confusion. */
  projectName: string
  canAccess?: (page: Page) => boolean
}

export function SideNav({ currentPage, onPageChange, onOpenGestion, projectName, canAccess }: Props) {
  const can = (id: Page | 'gestion') =>
    id === 'gestion' ? GESTION_PAGES.some(p => !canAccess || canAccess(p)) : (!canAccess || canAccess(id as Page))
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
        {PRIMARY_NAV.filter(({ id }) => can(id)).map(({ id, label, icon: Icon }) => {
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
