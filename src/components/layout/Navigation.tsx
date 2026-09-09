import { Home, BarChart3, FileText, Settings, Download } from 'lucide-react'

type Page = 'home' | 'gantt' | 'reports' | 'config'

interface NavigationProps {
  currentPage: Page
  onPageChange: (page: Page) => void
}

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  const nav = [
    { id: 'home' as const, label: 'Accueil', icon: Home },
    { id: 'gantt' as const, label: 'Gantt', icon: BarChart3 },
    { id: 'reports' as const, label: 'CR', icon: FileText },
    { id: 'config' as const, label: 'Config', icon: Settings },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e3e9ee] z-50">
      <div className="max-w-6xl mx-auto grid grid-cols-4 sm:flex sm:justify-center sm:gap-8">
        {nav.map(item => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition border-t-2 ${
                isActive
                  ? 'text-[#0b3b60] border-t-[#185FA5]'
                  : 'text-[#5c6f80] border-t-transparent hover:text-[#0b3b60]'
              }`}
            >
              <Icon size={20} />
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.label.substring(0, 3)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
