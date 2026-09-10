import { Home, BarChart3, FileText, Settings, ClipboardList, Euro } from 'lucide-react'

type Page = 'home' | 'gantt' | 'cr' | 'finances' | 'config' | 'rapports'

interface NavigationProps {
  currentPage: Page
  onPageChange: (page: Page) => void
}

const NAV_ITEMS = [
  { id: 'home' as const,    label: 'Accueil',  icon: Home },
  { id: 'gantt' as const,   label: 'Planning', icon: BarChart3 },
  { id: 'cr' as const,      label: 'CR',       icon: ClipboardList },
  { id: 'finances' as const,label: 'Finances', icon: Euro },
  { id: 'config' as const,  label: 'Config',   icon: Settings },
  { id: 'rapports' as const,label: 'Rapports', icon: FileText },
]

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  return (
    <nav className="bot-nav">
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`bnav${currentPage === id ? ' active' : ''}`}
          onClick={() => onPageChange(id)}
        >
          <Icon size={20} strokeWidth={1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
