import { useEffect, useState } from 'react'
import { Administration } from './components/Administration'
import { Dashboard } from './components/Dashboard'
import { OperationForm } from './components/OperationForm'
import { VisitForm } from './components/VisitForm'
import { operationData } from './lib/data'
import { createOperation, listOperations } from './lib/operations'
import { isSupabaseConfigured } from './lib/supabase'
import type { Company, Lot, Operation, OperationForm as OperationValues, Unit } from './lib/types'

type Tab = 'dashboard' | 'visit' | 'admin'
export default function App() {
 const [operations, setOperations] = useState<Operation[]>([]); const [selected, setSelected] = useState<Operation | null>(null); const [tab, setTab] = useState<Tab>('dashboard'); const [units, setUnits] = useState<Unit[]>([]); const [lots, setLots] = useState<Lot[]>([]); const [companies, setCompanies] = useState<Company[]>([]); const [assignments, setAssignments] = useState<{ lot_id: string; unit_id: string | null; scope: string }[]>([]); const [historyTarget, setHistoryTarget] = useState<{ taskId: string; unitId: string | null } | null>(null); const [error, setError] = useState<string | null>(null)
 const loadOperations = async () => { try { setOperations(await listOperations()) } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.') } }
 const loadData = async () => { if (!selected) return; try { const data = await operationData(selected.id); setUnits(data.units); setLots(data.lots); setCompanies(data.companies); setAssignments(data.assignments) } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.') } }
 useEffect(() => { if (isSupabaseConfigured) void loadOperations() }, [])
 useEffect(() => { void loadData() }, [selected])
 useEffect(() => { setHistoryTarget(null) }, [selected])
 async function addOperation(values: OperationValues) { const operation = await createOperation(values); setOperations((current) => [operation, ...current]); setSelected(operation) }
 if (!isSupabaseConfigured) return <main className="app-shell"><p className="eyebrow">Suivi chantier</p><h1>Connexion requise</h1><section className="notice">Configurez <code>VITE_SUPABASE_URL</code> avec <code>https://YOUR_PROJECT_REF.supabase.co</code> et la clé anon du projet dans <code>.env</code>.</section></main>
 if (!selected) return <main className="app-shell"><header><p className="eyebrow">Suivi chantier</p><h1>SUIVI CHANTIER</h1><p>Choisissez une opération pour consulter son suivi.</p></header>{error && <p className="notice error">{error}</p>}<section className="panel"><h2>Opérations actives</h2>{operations.length ? <ul className="cards">{operations.map((operation) => <li key={operation.id}><button className="card" onClick={() => setSelected(operation)}><strong>{operation.name}</strong><span>{operation.address ?? 'Adresse non renseignée'}</span></button></li>)}</ul> : <p>Aucune opération active.</p>}</section><section className="panel"><h2>+ NOUVELLE OPÉRATION</h2><OperationForm onSubmit={addOperation} disabled={false}/></section></main>
 return <main className="app-shell"><header className="compact"><button className="back" onClick={() => setSelected(null)}>← Opérations</button><p className="eyebrow">{selected.name}</p><h1>TABLEAU DE BORD</h1></header>{error && <p className="notice error">{error}</p>}{historyTarget ? <Dashboard operation={selected} units={units} lots={lots} initialTaskId={historyTarget.taskId} initialUnitId={historyTarget.unitId} onExitHistory={() => { setHistoryTarget(null); setTab('visit') }} /> : tab === 'dashboard' ? <Dashboard operation={selected} units={units} lots={lots}/> : tab === 'visit' ? <VisitForm operationId={selected.id} units={units} lots={lots} onOpenTask={(taskId, unitId) => setHistoryTarget({ taskId, unitId })}/> : null} {tab === 'admin' && <Administration operationId={selected.id} units={units} lots={lots} companies={companies} assignments={assignments} reload={loadData}/>}<nav><button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Tableau de bord</button><button className={tab === 'visit' ? 'active' : ''} onClick={() => setTab('visit')}>Visite</button><button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Administration</button></nav></main>
}
