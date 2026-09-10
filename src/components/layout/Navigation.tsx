import { useState } from 'react'
import { Home, BarChart3, FolderOpen, Bell, Settings, ClipboardList, Euro, FileText, X } from 'lucide-react'

type Page = 'home' | 'gantt' | 'cr' | 'finances' | 'config' | 'rapports' | 'alertes'

interface NavigationProps {
  currentPage: Page
  onPageChange: (page: Page) => void
}

const GESTION_PAGES: Page[] = ['cr', 'finances', 'rapports']

const GESTION_ITEMS = [
  { id: 'cr' as const, label: 'Comptes rendus', desc: 'Visites & réserves', icon: ClipboardList },
  { id: 'finances' as const, label: 'Finances', desc: 'Marchés, avenants, situations', icon: Euro },
  { id: 'rapports' as const, label: 'Rapports & documents', desc: 'CR auto, RFI, visas, GED', icon: FileText },
]

export function Navigation({ currentPage, onPageChange }: NavigationProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const gestionActive = GESTION_PAGES.includes(currentPage)

  const pick = (id: Page) => { onPageChange(id); setSheetOpen(false) }

  return (
    <>
      {sheetOpen && (
        <>
          <div onClick={() => setSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,27,72,.45)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: '#fff', borderTopLeftRadius: '18px', borderTopRightRadius: '18px', padding: '10px 14px calc(18px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -8px 30px rgba(2,27,72,.25)', maxWidth: '640px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 0 10px' }}>
              <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '15px' }}>Gestion</span>
              <button onClick={() => setSheetOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><X size={18} /></button>
            </div>
            {GESTION_ITEMS.map(({ id, label, desc, icon: Icon }) => (
              <button
                key={id}
                onClick={() => pick(id)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)', background: currentPage === id ? 'var(--sky-soft)' : '#fff', marginBottom: '8px', cursor: 'pointer' }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--sky-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={19} color="var(--navy)" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '14px' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <nav className="bot-nav">
        <button className={`bnav${currentPage === 'home' ? ' active' : ''}`} onClick={() => onPageChange('home')}>
          <Home size={20} strokeWidth={1.8} /><span>Accueil</span>
        </button>
        <button className={`bnav${currentPage === 'gantt' ? ' active' : ''}`} onClick={() => onPageChange('gantt')}>
          <BarChart3 size={20} strokeWidth={1.8} /><span>Planning</span>
        </button>
        <button className={`bnav${gestionActive ? ' active' : ''}`} onClick={() => setSheetOpen(true)}>
          <FolderOpen size={20} strokeWidth={1.8} /><span>Gestion</span>
        </button>
        <button className={`bnav${currentPage === 'alertes' ? ' active' : ''}`} onClick={() => onPageChange('alertes')}>
          <Bell size={20} strokeWidth={1.8} /><span>Alertes</span>
        </button>
        <button className={`bnav${currentPage === 'config' ? ' active' : ''}`} onClick={() => onPageChange('config')}>
          <Settings size={20} strokeWidth={1.8} /><span>Config</span>
        </button>
      </nav>
    </>
  )
}
