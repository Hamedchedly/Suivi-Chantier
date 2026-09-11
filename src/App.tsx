import { useState, useMemo, useEffect, useRef } from 'react'
import { Home } from './components/pages/Home'
import { Gantt } from './components/pages/Gantt'
import { Visite } from './components/pages/Visite'
import { CR } from './components/pages/CR'
import { Entreprises } from './components/pages/Entreprises'
import { Reports } from './components/pages/Reports'
import { Config } from './components/pages/Config'
import { Finances } from './components/pages/Finances'
import { Alertes } from './components/pages/Alertes'
import { ShareView } from './components/pages/ShareView'
import { Navigation } from './components/layout/Navigation'
import { SideNav } from './components/layout/SideNav'
import { GestionSheet } from './components/layout/GestionSheet'
import { Topbar } from './components/layout/Topbar'
import type { Page } from './components/layout/navConfig'
import { readShareFromUrl } from './lib/share'
import { runBackHandler } from './lib/backHandler'

export type { Page }

const PAGE_META: Record<Page, { title: string; sub?: string }> = {
  home:     { title: 'Gambetta — Réhabilitation', sub: 'GAM-2026-001 • 111 Rue Gambetta, Reims' },
  gantt:    { title: 'Planning', sub: 'Déplacez les barres pour modifier les dates' },
  visite:   { title: 'Visites & réunions', sub: 'Sessions de contrôle terrain' },
  cr:       { title: 'Réserves & réunions', sub: 'Réserves de chantier & relevés de réunions' },
  entreprises: { title: 'Entreprises', sub: 'Lots, actions, engagements et historique' },
  finances: { title: 'Finances', sub: 'Marchés, avenants & situations' },
  config:   { title: 'Configuration', sub: 'Paramètres du projet' },
  rapports: { title: 'Rapports', sub: 'CRs envoyés et brouillons' },
  alertes:  { title: 'Alertes & vigilance', sub: 'Retards, dérives et points à évoquer' },
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [gestionOpen, setGestionOpen] = useState(false)
  const meta = PAGE_META[currentPage]

  // Back button: step back inside the app instead of closing it. A spare
  // history entry is kept ahead of us; each Back consumes it and we push a new
  // one, until there is nothing left to step back to.
  const pageRef = useRef(currentPage)
  pageRef.current = currentPage
  const sheetRef = useRef(gestionOpen)
  sheetRef.current = gestionOpen

  useEffect(() => {
    if (window.location.hash.startsWith('#share=')) return
    history.pushState({ sc: true }, '')
    const onPop = () => {
      const keepInside = () => history.pushState({ sc: true }, '')
      if (sheetRef.current) { setGestionOpen(false); keepInside(); return }
      if (runBackHandler()) { keepInside(); return }
      if (pageRef.current !== 'home') { setCurrentPage('home'); keepInside(); return }
      // at the root with nothing to unwind — let the browser leave
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Shared read-only snapshot link (#share=…): render the MOA view, no app chrome.
  const shared = useMemo(() => readShareFromUrl(), [])
  if (window.location.hash.startsWith('#share=')) {
    if (shared) return <ShareView snapshot={shared} />
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#5b7183', fontSize: '14px' }}>
        Lien de partage invalide ou expiré.
      </div>
    )
  }

  const go = (p: Page) => { setCurrentPage(p); setGestionOpen(false) }

  return (
    <div className="app-wrapper">
      <SideNav currentPage={currentPage} onPageChange={go} onOpenGestion={() => setGestionOpen(true)} />

      <div className="app-main">
        <Topbar title={meta.title} sub={meta.sub} />
        <div className="app-body">
          {currentPage === 'home'     && <Home onNavigate={go} />}
          {currentPage === 'gantt'    && <Gantt />}
          {currentPage === 'visite'   && <Visite />}
          {currentPage === 'cr'       && <CR />}
          {currentPage === 'entreprises' && <Entreprises />}
          {currentPage === 'finances' && <Finances />}
          {currentPage === 'rapports' && <Reports onNavigate={go} />}
          {currentPage === 'alertes'  && <Alertes />}
          {currentPage === 'config'   && <Config />}
        </div>
      </div>

      <Navigation currentPage={currentPage} onPageChange={go} onOpenGestion={() => setGestionOpen(true)} />
      <GestionSheet open={gestionOpen} currentPage={currentPage} onClose={() => setGestionOpen(false)} onPick={go} />
    </div>
  )
}
