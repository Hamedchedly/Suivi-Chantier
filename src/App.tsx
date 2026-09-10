import { useState } from 'react'
import { Home } from './components/pages/Home'
import { Gantt } from './components/pages/Gantt'
import { CR } from './components/pages/CR'
import { Reports } from './components/pages/Reports'
import { Config } from './components/pages/Config'
import { Finances } from './components/pages/Finances'
import { Navigation } from './components/layout/Navigation'
import { Topbar } from './components/layout/Topbar'

export type Page = 'home' | 'gantt' | 'cr' | 'finances' | 'config' | 'rapports'

const PAGE_META: Record<Page, { title: string; sub?: string }> = {
  home:     { title: 'Gambetta — Réhabilitation', sub: 'GAM-2026-001 • 111 Rue Gambetta, Reims' },
  gantt:    { title: 'Planning', sub: 'Déplacez les barres pour modifier les dates' },
  cr:       { title: 'Comptes Rendus', sub: 'Visites de chantier' },
  finances: { title: 'Finances', sub: 'Marchés, avenants & situations' },
  config:   { title: 'Configuration', sub: 'Paramètres du projet' },
  rapports: { title: 'Rapports', sub: 'CRs envoyés et brouillons' },
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const meta = PAGE_META[currentPage]

  return (
    <div className="app-wrapper">
      <Topbar title={meta.title} sub={meta.sub} />
      <div className="app-body">
        {currentPage === 'home'     && <Home onNavigate={setCurrentPage} />}
        {currentPage === 'gantt'    && <Gantt />}
        {currentPage === 'cr'       && <CR />}
        {currentPage === 'finances' && <Finances />}
        {currentPage === 'rapports' && <Reports />}
        {currentPage === 'config'   && <Config />}
      </div>
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
    </div>
  )
}
