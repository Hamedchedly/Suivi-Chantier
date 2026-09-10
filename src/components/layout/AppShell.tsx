import { useState, ReactNode } from 'react'
import { Home, BarChart3, FileText, Settings } from 'lucide-react'
import type { Operation } from '../../lib/types'

interface AppShellProps {
  operation: Operation | null
  children: ReactNode
  currentScreen: string
  onNavigate: (screen: string) => void
}

export function AppShell({ operation, children, currentScreen, onNavigate }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  const navItems = [
    { id: 'dashboard', label: 'Accueil', icon: Home },
    { id: 'gantt', label: 'Planning', icon: BarChart3 },
    { id: 'visits', label: 'Visites', icon: FileText },
    { id: 'reports', label: 'CR', icon: FileText },
    { id: 'config', label: 'Config', icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-[#f1f5f9] text-[#16222e]">
      {/* Desktop Sidebar */}
      {!isMobile && sidebarOpen && (
        <aside className="w-64 bg-white border-r border-[#e4ecf2] shadow-sm overflow-y-auto">
          <div className="p-6 border-b border-[#e4ecf2]">
            <h1 className="text-2xl font-bold text-[#02457A] mb-1">Suivi-Chantier</h1>
            {operation && (
              <p className="text-sm text-[#5b7183]">{operation.name}</p>
            )}
          </div>

          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentScreen === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#018ABE] text-white'
                      : 'text-[#5b7183] hover:bg-[#f1f5f9]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-[#e4ecf2] p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#02457A]">
            {navItems.find(n => n.id === currentScreen)?.label || 'Suivi-Chantier'}
          </h2>
          {!isMobile && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-[#5b7183] hover:text-[#02457A] transition-colors"
            >
              {sidebarOpen ? '←' : '→'}
            </button>
          )}
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4ecf2] flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentScreen === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center justify-center py-3 px-4 flex-1 transition-colors ${
                  isActive
                    ? 'text-[#018ABE] border-t-2 border-[#018ABE]'
                    : 'text-[#5b7183]'
                }`}
              >
                <Icon size={24} />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
