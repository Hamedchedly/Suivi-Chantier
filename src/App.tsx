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

  // NOTE: Authentication temporarily disabled for demo
  // Uncomment auth checks when ready to enable

  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured, running in demo mode')
  }

  // Auto-select first operation or use demo mode
  const fallbackOperation: Operation = {
    id: 'demo-op-001',
    name: 'Gambetta — Réhabilitation',
    address: '111 Rue Gambetta, 51100 Reims',
    reference_interne: 'GAM-2026-001',
    moa: 'Mairie de Reims',
    moe: 'Cabinet Architecture XYZ',
    amo: 'Conseil en Réhabilitation',
    start_date: '2026-01-15',
    contractual_end_date: '2026-12-31',
    budget_global: 1500000,
    operation_type: 'lots_separes',
    status: 'travaux',
    created_at: '2026-01-01',
    created_by: 'demo-user',
  }

  const currentOperation = selected || operations[0] || fallbackOperation

  return (
    <AppShell operation={currentOperation} currentScreen={tab} onNavigate={(screen) => setTab(screen as Tab)}>
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="p-4 bg-[#fdecec] border border-[#fca5a5] rounded-lg text-[#b91c1c] mb-6">
            {error}
          </div>
        )}

        {observationTarget ? (
          <ObservationDetail
            operationId={currentOperation.id}
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
            operation={currentOperation}
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
          <NewDashboard />
        ) : tab === 'visit' ? (
          <VisitForm
            operationId={currentOperation.id}
            units={units}
            lots={lots}
            onOpenTask={(taskId, unitId) => setHistoryTarget({ taskId, unitId })}
            onOpenObservation={openObservation}
          />
        ) : tab === 'planning' ? (
          <SchedulePanel operation={currentOperation} units={units} lots={lots} />
        ) : null}

        {tab === 'admin' && (
          <Administration operationId={currentOperation.id} units={units} lots={lots} companies={companies} assignments={assignments} reload={loadData} />
        )}
      </div>
    </AppShell>
  )
}
