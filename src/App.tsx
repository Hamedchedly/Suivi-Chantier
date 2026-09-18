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
import { Landing } from './components/pages/Landing'
import { DemoRequest } from './components/pages/DemoRequest'
import { DemoRequests } from './components/pages/DemoRequests'
import { ForgotPassword } from './components/pages/ForgotPassword'
import { ResetPassword } from './components/pages/ResetPassword'
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
  getTrash, saveTrash, getAdminMessages, type AdminMessage,
} from './lib/repo'
import { User, Session, findUser, isSuperadmin, hasFeature, type Feature } from './lib/auth'
import { Project, TrashedProject, findProject, projectLabel, projectSubtitle, resolveCurrent } from './lib/projects'
import { isSupabaseConfigured } from './lib/supabase'
import { currentProfileUser, onAuthChange, signOutRemote } from './lib/supabaseAuth'
import { initRemoteSession, disableSync, clearLocalAppState } from './lib/sync'

export type { Page }

// ── URL routing helpers ──────────────────────────────────────────────────────

const PAGE_ROUTES: Record<Page, string> = {
  home: '/',
  gantt: '/planning',
  visite: '/visite',
  cr: '/cr',
  entreprises: '/entreprises',
  finances: '/finances',
  rapports: '/rapports',
  alertes: '/alertes',
  structure: '/structure',
  config: '/config',
  comptes: '/comptes',
  demandes: '/demandes',
  projets: '/projets',
  moncompte: '/moncompte',
}

const ROUTES_PAGE: Record<string, Page> = Object.entries(PAGE_ROUTES).reduce(
  (acc, [page, route]) => ({ ...acc, [route]: page as Page }),
  {} as Record<string, Page>
)

const getPageFromUrl = (): Page => {
  const path = window.location.pathname
  return ROUTES_PAGE[path] ?? 'home'
}

const setUrlForPage = (page: Page) => {
  const route = PAGE_ROUTES[page]
  if (route && window.location.pathname !== route) {
    window.history.pushState({ sc: true, page }, '', route)
  }
}

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
  demandes: { title: 'Demandes de démo', sub: 'Auto-inscriptions à valider' },
  projets:  { title: 'Mes opérations', sub: 'Créer, ouvrir et gérer vos chantiers' },
  moncompte: { title: 'Mon compte', sub: 'Adresse e-mail et mot de passe' },
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    // Try URL first, then localStorage fallback
    const urlPage = getPageFromUrl()
    if (urlPage !== 'home' && ROUTES_PAGE[window.location.pathname]) return urlPage
    try { return (localStorage.getItem('sc_nav_page') as Page) ?? 'home' } catch { return 'home' }
  })
  const [gestionOpen, setGestionOpen] = useState(false)
  const [users, setUsers] = useState<User[]>(getUsers)
  const [session, setSession] = useState<Session | null>(getSession)
  const [projects, setProjects] = useState<Project[]>(getProjects)
  const [trash, setTrash] = useState<TrashedProject[]>(getTrash)
  const [projectId, setProjectId] = useState<string | null>(getCurrentProjectId)

  // Authentification serveur (Supabase) quand elle est configurée ; sinon mode
  // local (comptes en navigateur). L'interface est identique dans les deux cas.
  const [remoteReady, setRemoteReady] = useState(!isSupabaseConfigured)
  const [remoteUser, setRemoteUser] = useState<User | null>(null)
  // Écrans avant connexion : accueil (vitrine), connexion, demande de démo, oubli.
  type PreAuth = 'landing' | 'login' | 'demo' | 'forgot'
  const [preAuth, setPreAuth] = useState<PreAuth>('landing')
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [recovery, setRecovery] = useState(false) // lien de réinitialisation suivi
  const [adminMsgs, setAdminMsgs] = useState<AdminMessage[]>(getAdminMessages)
  const [overlayDismissed, setOverlayDismissed] = useState(() => {
    try { return sessionStorage.getItem('sc_overlay_seen') === '1' } catch { return false }
  })

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    let syncedUid: string | null = null

    let recovering = false
    const handle = async (event: string, sbSession: { user: { id: string } } | null) => {
      if (!alive) return
      // Lien de réinitialisation suivi : afficher le formulaire de nouveau mot de passe.
      if (event === 'PASSWORD_RECOVERY') {
        recovering = true; setRecovery(true); setRemoteReady(true)
        return
      }
      // Pendant la réinitialisation, ignorer les autres événements jusqu'à la déconnexion.
      if (recovering && event !== 'SIGNED_OUT') { setRemoteReady(true); return }
      // Déconnexion : couper la sync et purger le cache local (pas de fuite entre comptes).
      if (!sbSession) {
        disableSync(); clearLocalAppState(); syncedUid = null; recovering = false
        setRecovery(false); setRemoteUser(null); setRemoteReady(true)
        return
      }
      // Profil d'abord : un compte désactivé (en attente de validation) ne rentre pas.
      const u = await currentProfileUser()
      if (!alive) return
      if (!u || u.disabled) {
        await signOutRemote()
        setAuthNotice(u?.disabled
          ? 'Votre compte est en attente de validation par un administrateur.'
          : null)
        setPreAuth('login')
        return // l'événement SIGNED_OUT qui suit remet remoteUser à null
      }
      // Nouvelle session : fusion locale ↔ serveur, puis activation du write-through.
      const uid = sbSession.user.id
      if (uid !== syncedUid) {
        await initRemoteSession(uid)
        if (!alive) return
        syncedUid = uid
        setProjects(getProjects()); setProjectId(getCurrentProjectId()); setTrash(getTrash())
      }
      setRemoteUser(u); setRemoteReady(true)
    }

    const off = onAuthChange(handle)
    return () => { alive = false; off() }
  }, [])

  useEffect(() => { if (!isSupabaseConfigured) saveUsers(users) }, [users])
  useEffect(() => { if (!isSupabaseConfigured) saveSession(session) }, [session])
  useEffect(() => { saveProjects(projects) }, [projects])
  useEffect(() => { saveTrash(trash) }, [trash])
  useEffect(() => { setCurrentProjectId(projectId) }, [projectId])

  const currentUser = isSupabaseConfigured
    ? remoteUser
    : (session ? findUser(users, session.userId) ?? null : null)
  // Impersonation (mode local uniquement) : le super-admin qui l'a lancée.
  const impersonator = !isSupabaseConfigured && session?.impersonatorId
    ? findUser(users, session.impersonatorId) ?? null : null
  const project = findProject(projects, projectId)

  // Reload admin messages when user navigates (they may have changed in Comptes).
  useEffect(() => { setAdminMsgs(getAdminMessages()) }, [currentPage])

  const signIn = (u: User) => {
    setSession({ userId: u.id, at: new Date().toISOString() })
    setCurrentPage('home')
    // Allow overlay to show again for this session after a new sign-in.
    try { sessionStorage.removeItem('sc_overlay_seen') } catch { /* noop */ }
    setOverlayDismissed(false)
  }

  const signOut = () => {
    if (isSupabaseConfigured) { signOutRemote(); setRemoteUser(null) }
    else setSession(null)
    setCurrentPage('home')
    setAuthNotice(null); setPreAuth('landing')
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

  /**
   * Suppression réversible : l'opération part à la corbeille SANS purger ses
   * données. On rebascule sur une autre opération active.
   */
  const removeProject = (id: string) => {
    const proj = findProject(projects, id)
    if (!proj) return
    setTrash(prev => [{ ...proj, deletedAt: new Date().toISOString() }, ...prev.filter(p => p.id !== id)])
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id)
      setProjectId(cur => (cur === id ? resolveCurrent(next, null) : cur))
      return next
    })
    logActivity('doc', `Opération « ${proj.name} » mise à la corbeille`)
  }

  /** Restaurer une opération depuis la corbeille (données intactes). */
  const restoreProjectFromTrash = (id: string) => {
    const t = trash.find(x => x.id === id)
    if (!t) return
    setTrash(prev => prev.filter(x => x.id !== id))
    const restored: Project = { ...t }
    delete (restored as Partial<TrashedProject>).deletedAt
    setProjects(prev => [...prev, restored])
    logActivity('doc', `Opération « ${t.name} » restaurée`)
  }

  /** Suppression DÉFINITIVE depuis la corbeille : purge les données du projet. */
  const purgeProject = (id: string) => {
    const t = trash.find(x => x.id === id)
    deleteProjectData(id)
    setTrash(prev => prev.filter(x => x.id !== id))
    if (t) logActivity('doc', `Opération « ${t.name} » supprimée définitivement`)
  }

  // ── URL sync: update the browser URL when page changes ────────────────────
  useEffect(() => {
    setUrlForPage(currentPage)
    try { localStorage.setItem('sc_nav_page', currentPage) } catch { /* noop */ }
  }, [currentPage])

  // ── Back button: step back inside the app instead of closing it ──────────
  // A spare history entry is kept ahead of us; each Back consumes it and we
  // push a new one, until there is nothing left to step back to.
  useEffect(() => {
    history.pushState({ sc: true }, '')
  }, [])

  const pageRef = useRef(currentPage)
  pageRef.current = currentPage
  const sheetRef = useRef(gestionOpen)
  sheetRef.current = gestionOpen

  useEffect(() => {
    if (window.location.hash.startsWith('#share=')) return
    const onPop = () => {
      const keepInside = () => history.pushState({ sc: true }, '')
      if (sheetRef.current) { setGestionOpen(false); keepInside(); return }
      if (runBackHandler()) { keepInside(); return }
      // Try to navigate based on URL
      const urlPage = getPageFromUrl()
      if (urlPage !== pageRef.current) { setCurrentPage(urlPage); keepInside(); return }
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

  // Pas de session → parcours avant connexion : accueil (vitrine) par défaut,
  // puis connexion, demande de démo, oubli / réinitialisation de mot de passe.
  if (!currentUser) {
    if (recovery) {
      return (
        <ResetPassword onDone={() => {
          setRecovery(false); setPreAuth('login')
          setAuthNotice('Mot de passe modifié. Connectez-vous avec le nouveau.')
        }} />
      )
    }
    if (preAuth === 'login') {
      return (
        <Login
          remote={isSupabaseConfigured}
          users={users}
          onSignIn={signIn}
          onRemoteSignedIn={() => setCurrentPage('home')}
          onForgot={isSupabaseConfigured ? () => setPreAuth('forgot') : undefined}
          onBack={() => { setAuthNotice(null); setPreAuth('landing') }}
          notice={authNotice}
        />
      )
    }
    if (preAuth === 'forgot') {
      return <ForgotPassword onBack={() => setPreAuth('login')} />
    }
    if (preAuth === 'demo' && isSupabaseConfigured) {
      return <DemoRequest onBack={() => setPreAuth('landing')} onSignIn={() => setPreAuth('login')} />
    }
    return (
      <Landing
        remote={isSupabaseConfigured}
        onConnect={() => { setAuthNotice(null); setPreAuth('login') }}
        onRequestDemo={() => setPreAuth('demo')}
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
    if (p === 'comptes' || p === 'demandes') return isSuperadmin(currentUser)
    const f = PAGE_FEATURE[p]
    return f ? hasFeature(currentUser, f) : true
  }

  const go = (p: Page) => { setCurrentPage(allowed(p) ? p : 'home'); setGestionOpen(false) }

  // Sans opération, seul l'espace « Mes opérations » a du sens.
  const noProject = !project
  const ACCOUNT_ONLY: Page[] = ['moncompte', 'comptes', 'demandes']
  const page: Page = noProject && !ACCOUNT_ONLY.includes(currentPage)
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
      remote={isSupabaseConfigured}
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
        {/* Bandeau fixe admin */}
        {adminMsgs.filter(m => m.active && m.kind === 'banner').map(m => (
          <div key={m.id} style={{ padding: '8px 16px', background: '#c2410c', color: '#fff', fontSize: '12px', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
            {m.text}
          </div>
        ))}
        <Topbar title={meta.title} sub={meta.sub} right={accountMenu} />
        <div className="app-body">
          {page === 'projets' && (
            <Projets
              projects={projects}
              trash={trash}
              currentProjectId={projectId}
              currentUser={currentUser}
              onChange={setProjects}
              onSwitch={switchProject}
              onDelete={removeProject}
              onRestore={restoreProjectFromTrash}
              onPurge={purgeProject}
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
          {page === 'demandes' && (
            isSuperadmin(currentUser)
              ? <DemoRequests />
              : <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                  Cette page est réservée aux super-administrateurs.
                </div>
          )}
          {page === 'home'     && <Home onNavigate={go} />}
          {!allowed(page) && !['home', 'projets', 'moncompte', 'comptes', 'demandes'].includes(page) && (
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

      {/* Bandeau défilant admin (ticker) */}
      {adminMsgs.filter(m => m.active && m.kind === 'ticker').map(m => (
        <div key={m.id} style={{ position: 'fixed', bottom: '56px', left: 0, right: 0, zIndex: 90, background: '#065f46', color: '#ecfdf5', fontSize: '12px', fontWeight: 600, padding: '6px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-block', animation: 'sc-ticker 20s linear infinite', paddingLeft: '100%' }}>
            {m.text}&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;{m.text}
          </span>
        </div>
      ))}

      {/* Overlay admin (une fois par session) */}
      {!overlayDismissed && adminMsgs.filter(m => m.active && m.kind === 'overlay').slice(0, 1).map(m => (
        <div key={m.id} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px' }}>
              Message de l'administrateur
            </div>
            <div style={{ fontSize: '14px', color: '#1e293b', lineHeight: 1.6, marginBottom: '20px', whiteSpace: 'pre-wrap' }}>{m.text}</div>
            <button onClick={() => {
              try { sessionStorage.setItem('sc_overlay_seen', '1') } catch { /* noop */ }
              setOverlayDismissed(true)
            }} style={{ width: '100%', padding: '12px', borderRadius: '9px', border: 'none', background: '#02457A', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
              J'ai lu ce message
            </button>
          </div>
        </div>
      ))}

      <Navigation currentPage={page} onPageChange={go} onOpenGestion={() => setGestionOpen(true)} canAccess={allowed} />
      <GestionSheet open={gestionOpen} currentPage={page} onClose={() => setGestionOpen(false)} onPick={go} canAccess={allowed} />
    </div>
  )
}
