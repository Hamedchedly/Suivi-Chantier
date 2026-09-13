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
import { MonCompte } from './components/pages/MonCompte'
import { Projets } from './components/pages/Projets'
import { Structure } from './components/pages/Structure'
import { Navigation } from './components/layout/Navigation'
import { SideNav } from './components/layout/SideNav'
import { GestionSheet } from './components/layout/GestionSheet'
import { Topbar } from './components/layout/Topbar'
import { AccountMenu } from './components/layout/AccountMenu'
import type { Page } from './components/layout/navConfig'
import { readShareFromUrl } from './lib/share'
import { runBackHandler } from './lib/backHandler'
import {
  getUsers, saveUsers, getSession, saveSession, logActivity,
  getProjects, saveProjects, getCurrentProjectId, setCurrentProjectId, deleteProjectData,
} from './lib/repo'
import { User, Session, findUser, isSuperadmin, hasFeature, type Feature } from './lib/auth'
import { Project, findProject, projectLabel, projectSubtitle, resolveCurrent } from './lib/projects'
import { isSupabaseConfigured } from './lib/supabase'
import { currentProfileUser, onAuthChange, signOutRemote } from './lib/supabaseAuth'
import { initRemoteSession, disableSync, clearLocalAppState } from './lib/sync'

export type { Page }

/** Pages dont le titre ne dépend pas de l'opération affichée. */
const PAGE_META: Partial<Record<Page, { title: string; sub?: string }>> = {
  gantt:    { title: 'Planning', sub: 'Déplacez les barres pour modifier les dates' },
  visite:   { title: 'Visites & réunions', sub: 'Sessions de contrôle terrain' },
  cr:       { title: 'Réserves & réunions', sub: 'Réserves de chantier & relevés de réunions' },
  entreprises: { title: 'Entreprises', sub: 'Lots, actions, engagements et historique' },
  finances: { title: 'Finances', sub: 'Marchés, avenants & situations' },
  config:   { title: 'Configuration', sub: 'Paramètres du projet' },
  structure: { title: 'Bâtiments & zones', sub: 'Décrivez le chantier et rattachez-y les tâches' },
  rapports: { title: 'Rapports', sub: 'CRs envoyés et brouillons' },
  alertes:  { title: 'Alertes & vigilance', sub: 'Retards, dérives et points à évoquer' },
  comptes:  { title: 'Comptes', sub: 'Utilisateurs, droits et accès' },
  projets:  { title: 'Mes opérations', sub: 'Créer, ouvrir et gérer vos chantiers' },
  moncompte: { title: 'Mon compte', sub: 'Adresse e-mail et mot de passe' },
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [gestionOpen, setGestionOpen] = useState(false)
  const [users, setUsers] = useState<User[]>(getUsers)
  const [session, setSession] = useState<Session | null>(getSession)
  const [projects, setProjects] = useState<Project[]>(getProjects)
  const [projectId, setProjectId] = useState<string | null>(getCurrentProjectId)

  // Authentification serveur (Supabase) quand elle est configurée ; sinon mode
  // local (comptes en navigateur). L'interface est identique dans les deux cas.
  const [remoteReady, setRemoteReady] = useState(!isSupabaseConfigured)
  const [remoteUser, setRemoteUser] = useState<User | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    let syncedUid: string | null = null

    const handle = async (_event: unknown, sbSession: { user: { id: string } } | null) => {
      if (!alive) return
      // Déconnexion : couper la sync et purger le cache local (pas de fuite entre comptes).
      if (!sbSession) {
        disableSync(); clearLocalAppState(); syncedUid = null
        setRemoteUser(null); setRemoteReady(true)
        return
      }
      // Nouvelle session (connexion / rechargement) : fusion locale ↔ serveur
      // (dernière-écriture-gagne), puis activation du write-through.
      const uid = sbSession.user.id
      if (uid !== syncedUid) {
        await initRemoteSession(uid)
        if (!alive) return
        syncedUid = uid
        setProjects(getProjects()); setProjectId(getCurrentProjectId())
      }
      const u = await currentProfileUser()
      if (!alive) return
      setRemoteUser(u); setRemoteReady(true)
    }

    const off = onAuthChange(handle)
    return () => { alive = false; off() }
  }, [])

  useEffect(() => { if (!isSupabaseConfigured) saveUsers(users) }, [users])
  useEffect(() => { if (!isSupabaseConfigured) saveSession(session) }, [session])
  useEffect(() => { saveProjects(projects) }, [projects])
  useEffect(() => { setCurrentProjectId(projectId) }, [projectId])

  const currentUser = isSupabaseConfigured
    ? remoteUser
    : (session ? findUser(users, session.userId) ?? null : null)
  // Impersonation (mode local uniquement) : le super-admin qui l'a lancée.
  const impersonator = !isSupabaseConfigured && session?.impersonatorId
    ? findUser(users, session.impersonatorId) ?? null : null
  const project = findProject(projects, projectId)

  const signIn = (u: User) => {
    setSession({ userId: u.id, at: new Date().toISOString() })
    setCurrentPage('home')
  }

  const signOut = () => {
    if (isSupabaseConfigured) { signOutRemote(); setRemoteUser(null) }
    else setSession(null)
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

  /** Basculer d'opération : toutes les pages se rechargent sur les données du projet. */
  const switchProject = (id: string) => {
    setProjectId(id)
    setCurrentPage('home')
    setGestionOpen(false)
  }

  /** Supprimer une opération purge ses données et rebascule sur une autre. */
  const removeProject = (id: string) => {
    deleteProjectData(id)
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id)
      setProjectId(cur => (cur === id ? resolveCurrent(next, null) : cur))
      return next
    })
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

  // Auth serveur : bref écran de chargement le temps de récupérer la session.
  if (isSupabaseConfigured && !remoteReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg,#02457A,#001B48)', color: '#cfe0ee', fontSize: '14px' }}>
        Chargement…
      </div>
    )
  }

  // No session → nothing but the sign-in screen.
  if (!currentUser) {
    return (
      <Login
        remote={isSupabaseConfigured}
        users={users}
        onSignIn={signIn}
        onRemoteSignedIn={() => setCurrentPage('home')}
      />
    )
  }

  // Droits d'accès par module. Accueil / Mes opérations / Mon compte sont
  // toujours ouverts ; « Comptes » reste réservé au super-admin.
  const PAGE_FEATURE: Partial<Record<Page, Feature>> = {
    gantt: 'gantt', visite: 'visite', cr: 'cr', entreprises: 'entreprises',
    finances: 'finances', rapports: 'rapports', alertes: 'alertes',
    structure: 'structure', config: 'config',
  }
  const allowed = (p: Page): boolean => {
    if (p === 'comptes') return isSuperadmin(currentUser)
    const f = PAGE_FEATURE[p]
    return f ? hasFeature(currentUser, f) : true
  }

  const go = (p: Page) => { setCurrentPage(allowed(p) ? p : 'home'); setGestionOpen(false) }

  // Sans opération, seul l'espace « Mes opérations » a du sens.
  const noProject = !project
  const page: Page = noProject && currentPage !== 'moncompte' && currentPage !== 'comptes'
    ? 'projets'
    : currentPage

  const meta = PAGE_META[page] ?? {
    title: project ? projectLabel(project) : 'Mes opérations',
    sub: project ? projectSubtitle(project) : undefined,
  }

  const accountMenu = (
    <AccountMenu
      user={currentUser}
      projects={projects}
      currentProjectId={projectId}
      onSwitchProject={switchProject}
      onNavigate={go}
      onSignOut={signOut}
    />
  )

  return (
    <div className="app-wrapper">
      <SideNav
        currentPage={page}
        onPageChange={go}
        onOpenGestion={() => setGestionOpen(true)}
        projectName={project ? projectLabel(project) : 'Aucune opération'}
        canAccess={allowed}
      />

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
        <Topbar title={meta.title} sub={meta.sub} right={accountMenu} />
        <div className="app-body">
          {page === 'projets' && (
            <Projets
              projects={projects}
              currentProjectId={projectId}
              currentUser={currentUser}
              onChange={setProjects}
              onSwitch={switchProject}
              onDelete={removeProject}
            />
          )}
          {page === 'moncompte' && <MonCompte users={users} currentUser={currentUser} onChange={setUsers} remote={isSupabaseConfigured} />}
          {page === 'comptes' && (
            isSuperadmin(currentUser)
              ? <Comptes users={users} currentUser={currentUser} onChange={setUsers} onImpersonate={impersonate} remote={isSupabaseConfigured} />
              : <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                  Cette page est réservée aux super-administrateurs.
                </div>
          )}
          {page === 'home'     && <Home onNavigate={go} />}
          {!allowed(page) && page !== 'home' && page !== 'projets' && page !== 'moncompte' && page !== 'comptes' && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              Ce module n'est pas activé pour votre compte. Demandez à un super-administrateur.
            </div>
          )}
          {allowed('gantt') && page === 'gantt'    && <Gantt />}
          {allowed('visite') && page === 'visite'   && <Visite />}
          {allowed('cr') && page === 'cr'       && <CR />}
          {allowed('entreprises') && page === 'entreprises' && <Entreprises />}
          {allowed('finances') && page === 'finances' && <Finances />}
          {allowed('rapports') && page === 'rapports' && <Reports onNavigate={go} />}
          {allowed('alertes') && page === 'alertes'  && <Alertes />}
          {allowed('structure') && page === 'structure' && <Structure />}
          {allowed('config') && page === 'config'   && <Config project={project ?? null} onProjectChange={setProjects} projects={projects} />}
        </div>
      </div>

      <Navigation currentPage={page} onPageChange={go} onOpenGestion={() => setGestionOpen(true)} canAccess={allowed} />
      <GestionSheet open={gestionOpen} currentPage={page} onClose={() => setGestionOpen(false)} onPick={go} canAccess={allowed} />
    </div>
  )
}
