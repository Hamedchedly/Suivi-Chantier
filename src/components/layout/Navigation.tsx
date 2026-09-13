import { Page, PRIMARY_NAV, GESTION_PAGES } from './navConfig'

interface NavigationProps {
  currentPage: Page
  onPageChange: (page: Page) => void
  onOpenGestion: () => void
  /** Un module masqué si l'utilisateur n'y a pas accès. */
  canAccess?: (page: Page) => boolean
}

export function Navigation({ currentPage, onPageChange, onOpenGestion, canAccess }: NavigationProps) {
  const can = (id: Page | 'gestion') =>
    id === 'gestion' ? GESTION_PAGES.some(p => !canAccess || canAccess(p)) : (!canAccess || canAccess(id as Page))
  return (
    <nav className="bot-nav">
      {PRIMARY_NAV.filter(({ id }) => can(id)).map(({ id, label, icon: Icon }) => {
        const active = id === 'gestion' ? GESTION_PAGES.includes(currentPage) : currentPage === id
        return (
          <button
            key={id}
            className={`bnav${active ? ' active' : ''}`}
            onClick={() => (id === 'gestion' ? onOpenGestion() : onPageChange(id as Page))}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
