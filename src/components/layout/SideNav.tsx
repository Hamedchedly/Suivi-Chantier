import { HardHat } from 'lucide-react'
import { Page, PRIMARY_NAV, GESTION_PAGES } from './navConfig'

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
        <div className="snav-logo"><HardHat size={20} /></div>
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
