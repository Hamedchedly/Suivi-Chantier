import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AccountBar, Login } from './components/Login'
import { Administration } from './components/Administration'
import { Dashboard } from './components/Dashboard'
import { ObservationDetail } from './components/ObservationDetail'
import { OperationForm } from './components/OperationForm'
import { VisitForm } from './components/VisitForm'
import { SchedulePanel } from './components/SchedulePanel'
import { operationData } from './lib/data'
import { createOperation, listOperations } from './lib/operations'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Company, Lot, Operation, OperationForm as OperationValues, Unit } from './lib/types'

type Tab = 'dashboard' | 'visit' | 'admin' | 'planning'
type ObservationTarget = { observationId: string; taskId: string | null; unitId: string | null; origin: 'task' | 'visit' | 'dashboard' }
export default function App() {
 const [operations, setOperations] = useState<Operation[]>([]); const [selected, setSelected] = useState<Operation | null>(null); const [tab, setTab] = useState<Tab>('dashboard'); const [units, setUnits] = useState<Unit[]>([]); const [lots, setLots] = useState<Lot[]>([]); const [companies, setCompanies] = useState<Company[]>([]); const [assignments, setAssignments] = useState<{ lot_id: string; unit_id: string | null; scope: string }[]>([]); const [historyTarget, setHistoryTarget] = useState<{ taskId: string; unitId: string | null } | null>(null); const [observationTarget, setObservationTarget] = useState<ObservationTarget | null>(null); const [session, setSession] = useState<Session | null>(null); const [authReady, setAuthReady] = useState(false); const [error, setError] = useState<string | null>(null)
 const loadOperations = async () => { if (!supabase) return; try { setOperations(await listOperations()) } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.') } }
 const loadData = async () => { if (!selected) return; try { const data = await operationData(selected.id); setUnits(data.units); setLots(data.lots); setCompanies(data.companies); setAssignments(data.assignments) } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.') } }
 useEffect(() => {
   if (!supabase) { setAuthReady(true); return }
   let mounted = true
   void supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setAuthReady(true) } })
   const { data: subscription } = supabase.auth.onAuthStateChange((_event, current) => { setSession(current) })
   return () => { mounted = false; subscription.subscription.unsubscribe() }
 }, [])
 useEffect(() => { if (session) { setSelected(null); setHistoryTarget(null); setObservationTarget(null); setTab('dashboard'); void loadOperations() } else { setOperations([]) } }, [session])
 useEffect(() => { void loadData() }, [selected])
 useEffect(() => { setHistoryTarget(null); setObservationTarget(null) }, [selected])
 async function addOperation(values: OperationValues) { const operation = await createOperation(values); setOperations((current) => [operation, ...current]); setSelected(operation) }
 async function signOut() { await supabase?.auth.signOut() }
 const openObservation = (observationId: string, context: { taskId: string | null; unitId: string | null; origin: 'task' | 'visit' | 'dashboard' }) => setObservationTarget({ observationId, ...context })
 if (!isSupabaseConfigured) return <main className="app-shell"><p className="eyebrow">Suivi chantier</p><h1>Connexion requise</h1><section className="notice">Configurez <code>VITE_SUPABASE_URL</code> avec <code>https://YOUR_PROJECT_REF.supabase.co</code> et la clé anon du projet dans <code>.env</code>.</section></main>
 if (!authReady) return <main className="app-shell auth-shell"><section className="panel auth-card"><p className="eyebrow">Suivi-Chantier</p><h1>Chargement…</h1></section></main>
 if (!session) return <Login onSignedIn={() => void loadOperations()} />
 if (!selected) return <main className="app-shell"><header className="page-head"><div><p className="eyebrow">Suivi chantier</p><h1>SUIVI CHANTIER</h1></div><AccountBar email={session.user.email ?? ''} onSignOut={() => void signOut()} /></header>{error && <p className="notice error">{error}</p>}<section className="panel"><h2>Opérations actives</h2>{operations.length ? <ul className="cards">{operations.map((operation) => <li key={operation.id}><button className="card" onClick={() => setSelected(operation)}><strong>{operation.name}</strong><span>{operation.address ?? 'Adresse non renseignée'}</span></button></li>)}</ul> : <p>Aucune opération accessible avec ce compte.</p>}</section><section className="panel"><h2>+ NOUVELLE OPÉRATION</h2><OperationForm onSubmit={addOperation} disabled={false}/></section></main>
 return <main className="app-shell"><header className="compact page-head"><div><button className="back" onClick={() => setSelected(null)}>← Opérations</button><p className="eyebrow">{selected.name}</p><h1>TABLEAU DE BORD</h1></div><AccountBar email={session.user.email ?? ''} onSignOut={() => void signOut()} /></header>{error && <p className="notice error">{error}</p>}{observationTarget ? <ObservationDetail operationId={selected.id} observationId={observationTarget.observationId} units={units} lots={lots} onBack={() => { const back = observationTarget; setObservationTarget(null); if (back.origin === 'task') setHistoryTarget({ taskId: back.taskId ?? '', unitId: back.unitId }); else if (back.origin === 'visit') setTab('visit'); else setTab('dashboard') }} /> : historyTarget ? <Dashboard operation={selected} units={units} lots={lots} companies={companies} initialTaskId={historyTarget.taskId} initialUnitId={historyTarget.unitId} onExitHistory={() => { setHistoryTarget(null); setTab('visit') }} onOpenObservation={openObservation} /> : tab === 'dashboard' ? <Dashboard operation={selected} units={units} lots={lots} companies={companies} onStartVisit={() => setTab('visit')} onOpenObservation={openObservation}/> : tab === 'visit' ? <VisitForm operationId={selected.id} units={units} lots={lots} onOpenTask={(taskId, unitId) => setHistoryTarget({ taskId, unitId })} onOpenObservation={openObservation}/> : tab === 'planning' ? <SchedulePanel operation={selected} units={units} lots={lots}/> : null} {tab === 'admin' && <Administration operationId={selected.id} units={units} lots={lots} companies={companies} assignments={assignments} reload={loadData}/>}<nav><button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Tableau de bord</button><button className={tab === 'visit' ? 'active' : ''} onClick={() => setTab('visit')}>Visite</button><button className={tab === 'planning' ? 'active' : ''} onClick={() => setTab('planning')}>Planning</button><button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Administration</button></nav></main>
}
