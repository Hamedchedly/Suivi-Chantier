import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AppShell } from './components/layout/AppShell'
import { Dashboard as NewDashboard } from './components/screens/Dashboard'
import { Dashboard } from './components/Dashboard'
import { Login, AccountBar } from './components/Login'
import { Administration } from './components/Administration'
import { ObservationDetail } from './components/ObservationDetail'
import { OperationForm } from './components/OperationForm'
import { VisitForm } from './components/VisitForm'
import { SchedulePanel } from './components/SchedulePanel'
import { operationData } from './lib/data'
import { createOperation, listOperations } from './lib/operations'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Company, Lot, Operation, OperationForm as OperationValues, Unit } from './lib/types'

type Tab = 'dashboard' | 'visit' | 'admin' | 'planning'
type ObservationTarget = {
  observationId: string
  taskId: string | null
  unitId: string | null
  origin: 'task' | 'visit' | 'dashboard'
}

export default function App() {
  const [operations, setOperations] = useState<Operation[]>([])
  const [selected, setSelected] = useState<Operation | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [units, setUnits] = useState<Unit[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [assignments, setAssignments] = useState<Array<{ lot_id: string; unit_id: string | null; scope: string }>>([])
  const [historyTarget, setHistoryTarget] = useState<{ taskId: string; unitId: string | null } | null>(null)
  const [observationTarget, setObservationTarget] = useState<ObservationTarget | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOperations = async () => {
    if (!supabase) return
    try {
      setOperations(await listOperations())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.')
    }
  }

  const loadData = async () => {
    if (!selected) return
    try {
      const data = await operationData(selected.id)
      setUnits(data.units)
      setLots(data.lots)
      setCompanies(data.companies)
      setAssignments(data.assignments)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.')
    }
  }

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }
    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setAuthReady(true)
      }
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, current) => {
      setSession(current)
    })
    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session) {
      setSelected(null)
      setHistoryTarget(null)
      setObservationTarget(null)
      setTab('dashboard')
      void loadOperations()
    } else {
      setOperations([])
    }
  }, [session])

  useEffect(() => {
    void loadData()
  }, [selected])

  useEffect(() => {
    setHistoryTarget(null)
    setObservationTarget(null)
  }, [selected])

  async function addOperation(values: OperationValues) {
    const operation = await createOperation(values)
    setOperations((current) => [operation, ...current])
    setSelected(operation)
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  const openObservation = (
    observationId: string,
    context: { taskId: string | null; unitId: string | null; origin: 'task' | 'visit' | 'dashboard' }
  ) => setObservationTarget({ observationId, ...context })

  if (!isSupabaseConfigured)
    return (
      <main className="p-6 text-center">
        <h1 className="text-2xl font-bold">Connexion requise</h1>
        <p className="text-[#5c6f80] mt-2">
          Configurez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local
        </p>
      </main>
    )

  if (!authReady)
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f3f6f9]">
        <div className="text-center">
          <p className="text-[#5c6f80] mb-2">Suivi-Chantier</p>
          <h1 className="text-2xl font-bold text-[#0b3b60]">Chargement…</h1>
        </div>
      </div>
    )

  if (!session) return <Login onSignedIn={() => void loadOperations()} />

  if (!selected)
    return (
      <div className="min-h-screen bg-[#f3f6f9]">
        <header className="bg-white border-b border-[#e3e9ee] p-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-[#5c6f80] text-sm font-medium">Suivi-Chantier</p>
              <h1 className="text-3xl font-bold text-[#0b3b60]">Mes Opérations</h1>
            </div>
            <AccountBar email={session.user.email ?? ''} onSignOut={() => void signOut()} />
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-6">
          {error && (
            <div className="p-4 bg-[#fdecec] border border-[#fca5a5] rounded-lg text-[#b91c1c] mb-6">
              {error}
            </div>
          )}

          <div className="bg-white rounded-lg border border-[#e3e9ee] p-6 mb-6">
            <h2 className="text-xl font-bold text-[#0b3b60] mb-4">Opérations Actives</h2>
            {operations.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {operations.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => setSelected(op)}
                    className="text-left p-4 border border-[#e3e9ee] rounded-lg hover:border-[#185FA5] hover:bg-[#e6f1fb] transition-all"
                  >
                    <div className="font-semibold text-[#0b3b60]">{op.name}</div>
                    <div className="text-sm text-[#5c6f80]">{op.address || 'Adresse non renseignée'}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[#5c6f80]">Aucune opération accessible avec ce compte.</p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-[#e3e9ee] p-6">
            <h2 className="text-xl font-bold text-[#0b3b60] mb-4">+ Nouvelle Opération</h2>
            <OperationForm onSubmit={addOperation} disabled={false} />
          </div>
        </div>
      </div>
    )

  return (
    <AppShell operation={selected} currentScreen={tab} onNavigate={(screen) => setTab(screen as Tab)}>
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="p-4 bg-[#fdecec] border border-[#fca5a5] rounded-lg text-[#b91c1c] mb-6">
            {error}
          </div>
        )}

        {observationTarget ? (
          <ObservationDetail
            operationId={selected.id}
            observationId={observationTarget.observationId}
            units={units}
            lots={lots}
            onBack={() => {
              const back = observationTarget
              setObservationTarget(null)
              if (back.origin === 'task') setHistoryTarget({ taskId: back.taskId ?? '', unitId: back.unitId })
              else if (back.origin === 'visit') setTab('visit')
              else setTab('dashboard')
            }}
          />
        ) : historyTarget ? (
          <Dashboard
            operation={selected}
            units={units}
            lots={lots}
            companies={companies}
            initialTaskId={historyTarget.taskId}
            initialUnitId={historyTarget.unitId}
            onExitHistory={() => {
              setHistoryTarget(null)
              setTab('visit')
            }}
            onOpenObservation={openObservation}
          />
        ) : tab === 'dashboard' ? (
          <Dashboard
            operation={selected}
            units={units}
            lots={lots}
            companies={companies}
            onStartVisit={() => setTab('visit')}
            onOpenObservation={openObservation}
          />
        ) : tab === 'visit' ? (
          <VisitForm
            operationId={selected.id}
            units={units}
            lots={lots}
            onOpenTask={(taskId, unitId) => setHistoryTarget({ taskId, unitId })}
            onOpenObservation={openObservation}
          />
        ) : tab === 'planning' ? (
          <SchedulePanel operation={selected} units={units} lots={lots} />
        ) : null}

        {tab === 'admin' && (
          <Administration operationId={selected.id} units={units} lots={lots} companies={companies} assignments={assignments} reload={loadData} />
        )}
      </div>
    </AppShell>
  )
}
