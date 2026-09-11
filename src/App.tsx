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
import { Login } from './components/pages/Login'
import { Comptes } from './components/pages/Comptes'
import { Navigation } from './components/layout/Navigation'
import { SideNav } from './components/layout/SideNav'
import { GestionSheet } from './components/layout/GestionSheet'
import { Topbar } from './components/layout/Topbar'
import type { Page } from './components/layout/navConfig'
import { readShareFromUrl } from './lib/share'
import { runBackHandler } from './lib/backHandler'
import { getUsers, saveUsers, getSession, saveSession, logActivity } from './lib/repo'
import { User, Session, findUser, isSuperadmin } from './lib/auth'

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
  comptes:  { title: 'Comptes', sub: 'Utilisateurs, droits et accès' },
}

const topLink: React.CSSProperties = {
  border: 'none', background: 'none', color: 'var(--navy-2)',
  fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: '2px 4px',
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [gestionOpen, setGestionOpen] = useState(false)
  const [users, setUsers] = useState<User[]>(getUsers)
  const [session, setSession] = useState<Session | null>(getSession)
  const meta = PAGE_META[currentPage]

  useEffect(() => { saveUsers(users) }, [users])
  useEffect(() => { saveSession(session) }, [session])

  const currentUser = session ? findUser(users, session.userId) ?? null : null
  // While impersonating, this is the super-admin who started it.
  const impersonator = session?.impersonatorId ? findUser(users, session.impersonatorId) ?? null : null

  const signIn = (u: User) => {
    setSession({ userId: u.id, at: new Date().toISOString() })
    setCurrentPage('home')
  }

  const signOut = () => {
    setSession(null)
    setCurrentPage('home')
  }

  const impersonate = (target: User) => {
    if (!currentUser) return
    setSession({ userId: target.id, impersonatorId: impersonator?.id ?? currentUser.id, at: new Date().toISOString() })
    setCurrentPage('home')
    logActivity('doc', `${(impersonator ?? currentUser).username} s'est connecté en tant que « ${target.username} »`)
  }

  const stopImpersonating = () => {
    if (!impersonator) return
    setSession({ userId: impersonator.id, at: new Date().toISOString() })
    setCurrentPage('comptes')
  }

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

  // No session → nothing but the sign-in screen.
  if (!currentUser) return <Login users={users} onSignIn={signIn} />

  const go = (p: Page) => { setCurrentPage(p); setGestionOpen(false) }

  return (
    <div className="app-wrapper">
      <SideNav currentPage={currentPage} onPageChange={go} onOpenGestion={() => setGestionOpen(true)} />

      <div className="app-main">
        {impersonator && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#6d28d9', color: '#fff', fontSize: '12px', fontWeight: 600 }}>
            <span style={{ flex: 1 }}>
              Vous agissez en tant que <strong>{currentUser.displayName}</strong> ({currentUser.username})
            </span>
            <button onClick={stopImpersonating}
              style={{ border: 'none', borderRadius: '16px', padding: '5px 12px', background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              Revenir à {impersonator.username}
            </button>
          </div>
        )}
        <Topbar title={meta.title} sub={meta.sub} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid var(--line)', fontSize: '11px', color: 'var(--muted)' }}>
          <span style={{ flex: 1 }}>
            {currentUser.displayName}
            {isSuperadmin(currentUser) && <strong style={{ color: '#6d28d9' }}> · super-admin</strong>}
          </span>
          {isSuperadmin(currentUser) && currentPage !== 'comptes' && (
            <button onClick={() => go('comptes')} style={topLink}>Comptes</button>
          )}
          <button onClick={signOut} style={topLink}>Déconnexion</button>
        </div>
        <div className="app-body">
          {currentPage === 'comptes' && (
            isSuperadmin(currentUser)
              ? <Comptes users={users} currentUser={currentUser} onChange={setUsers} onImpersonate={impersonate} />
              : <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                  Cette page est réservée aux super-administrateurs.
                </div>
          )}
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
