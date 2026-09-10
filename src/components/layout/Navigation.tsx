import { Page, PRIMARY_NAV, GESTION_PAGES } from './navConfig'

interface NavigationProps {
  currentPage: Page
  onPageChange: (page: Page) => void
  onOpenGestion: () => void
}

export function Navigation({ currentPage, onPageChange, onOpenGestion }: NavigationProps) {
  return (
    <nav className="bot-nav">
      {PRIMARY_NAV.map(({ id, label, icon: Icon }) => {
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
