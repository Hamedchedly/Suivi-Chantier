// ────────────────────────────────────────────────────────────────────────────
// Persistence boundary (repository).
//
// This module is the ONLY place the app reads/writes persisted data. Today it is
// backed by localStorage. To move to Supabase later (once authentication is
// enabled — RLS on the live DB requires auth.uid()), swap the bodies below for
// Supabase queries; call sites (components) do not change.
//
// Supabase mapping (for the future backend sprint), project "Suivi-Chantier":
//   getGanttTasks / saveGanttTasks   ↔ public.tasks (+ schedule_items, progress_entries)
//   getReserves    / saveReserves    ↔ public.observations (type = reserve) or a reserves table
//   getVisits2     / saveVisits2     ↔ public.visits (+ visit_zones, visit_task_checks)
//   getLotsConfig  / saveLotsConfig  ↔ public.lots (+ lot_assignments, companies)
// Each of those tables is RLS-protected via is_operation_member(operation_id),
// so a Supabase implementation must run as an authenticated user.
// ────────────────────────────────────────────────────────────────────────────

import { GanttTask } from '../types/gantt'
import { GANTT_TASKS } from '../data/ganttMockData'
import { Reserve } from './reserves'
import { Marche, Avenant, Situation } from './finance'
import { DEFAULT_MARCHES, DEFAULT_AVENANTS, DEFAULT_SITUATIONS } from '../data/financeMock'
import { Rfi, Visa, Doc } from './admin'
import { DEFAULT_RFIS, DEFAULT_VISAS, DEFAULT_DOCS } from '../data/adminMock'
import { AlertActions } from './alerts'
import { DpgfLine } from './dpgf'
import { DEFAULT_DPGF } from '../data/dpgfMock'
import { ActivityEvent, ActivityType, pushEvent } from './activity'
import { Meeting } from './meetings'
import { DEFAULT_MEETINGS } from '../data/meetingsMock'
import { Visit as VisitSession, buildZonesFromPlanning, type ZoneRef, type TaskState } from './visits'
import { DateCommitment } from './commitments'
import { LOGEMENTS } from '../data/zones'
import { loadState, saveState } from './storage'

// Versioned storage keys (bump the suffix when a stored shape changes).
const KEYS = {
  gantt: 'sc-gantt-v2',
  reserves: 'sc-reserves-v1',
  lotsConfig: 'sc-lots-config-v1',
  marches: 'sc-marches-v1',
  avenants: 'sc-avenants-v1',
  situations: 'sc-situations-v1',
  rfis: 'sc-rfis-v1',
  visas: 'sc-visas-v1',
  docs: 'sc-docs-v1',
  alertActions: 'sc-alert-actions-v1',
  holidays: 'sc-holidays-v1',
  dpgf: 'sc-dpgf-v1',
  ganttPrefs: 'sc-gantt-prefs-v1',
  activity: 'sc-activity-v1',
  meetings: 'sc-meetings-v1',
  visits: 'sc-visits-v3',
  commitments: 'sc-commitments-v1',
  visitKinds: 'sc-visit-kinds-v1',
} as const

const _tA = (() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d })()
const _agoH = (h: number) => new Date(_tA.getTime() - h * 3600000).toISOString()
const DEFAULT_ACTIVITY: ActivityEvent[] = [
  { id: 's1', at: _agoH(3), type: 'reserve', message: 'Réserve R-002 créée — fuite raccord CVC (Logt B-201)' },
  { id: 's2', at: _agoH(26), type: 'finance', message: 'Avenant validé — Modification réseau CVC RDC (+15 000 €)' },
  { id: 's3', at: _agoH(50), type: 'visit', message: 'Visite du 04/09/2026 enregistrée' },
]

export type GanttGroup = 'lot' | 'zone' | 'chrono'
export interface GanttPrefs {
  zoom: number
  group: GanttGroup
  autoSchedule: boolean   // propager les décalages aux tâches liées
}
const DEFAULT_GANTT_PREFS: GanttPrefs = { zoom: 1, group: 'lot', autoSchedule: true }

export interface Holiday {
  start: Date
  end: Date
  label?: string
}

const _today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()
const _addDays = (n: number) => new Date(_today.getTime() + n * 86400000)
const DEFAULT_HOLIDAYS: Holiday[] = [
  { start: _addDays(28), end: _addDays(35), label: 'Congés' },
]

// ── Entity types owned by the repository ────────────────────────────────────

export interface LotContact {
  id: string
  name: string
  company: string
  contactName: string
  email: string
  phone: string
}

// ── Default seeds (used until the user creates their own data) ───────────────

const DEFAULT_LOTS: LotContact[] = [
  { id: 'L05', name: 'LOT 05 - Menuiseries int. / Isolation', company: 'SMP Aménagement', contactName: 'Jean Dupont', email: 'j.dupont@smp.fr', phone: '06 12 34 56 78' },
  { id: 'L06', name: 'LOT 06 - Électricité / Contrôle accès', company: 'Soveclim Services', contactName: 'Marie Martin', email: 'm.martin@soveclim.fr', phone: '06 23 45 67 89' },
  { id: 'L07', name: 'LOT 07 - CVC', company: 'Soveclim Services', contactName: 'Pierre Lécuyer', email: 'p.lecuyer@soveclim.fr', phone: '06 34 56 78 90' },
  { id: 'L08', name: 'LOT 08 - Embellissements', company: 'Soretherm', contactName: 'Anne Legrand', email: 'a.legrand@soretherm.fr', phone: '06 45 67 89 01' },
]

const DEFAULT_RESERVES: Reserve[] = [
  { id: 'r1', number: 'R-001', lotId: 'L05', logementId: 'A-101', description: 'Joint de fenêtre séjour mal posé', priority: 'medium', status: 'open', createdAt: '2026-09-04', visitId: 'VS-DEMO', company: 'SMP Aménagement' },
  { id: 'r2', number: 'R-002', lotId: 'L07', logementId: 'B-201', description: 'Fuite au niveau du raccord CVC', priority: 'high', status: 'open', createdAt: '2026-09-08', visitId: 'VS-DEMO', company: 'Soveclim Services' },
  { id: 'r3', number: 'R-003', lotId: 'L08', logementId: 'A-102', description: 'Retouche peinture couloir', priority: 'low', status: 'resolved', createdAt: '2026-08-28' },
]

// ── Planning (Gantt) ─────────────────────────────────────────────────────────

export function getGanttTasks(): GanttTask[] {
  return loadState<GanttTask[]>(KEYS.gantt, GANTT_TASKS)
}

export function saveGanttTasks(tasks: GanttTask[]): void {
  saveState(KEYS.gantt, tasks)
}

/** Per top-level lot (parent) progress, read from the planning. */
export function getLotProgress(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of getGanttTasks()) out[t.lot_id] = t.progress
  return out
}

// ── Reserves ─────────────────────────────────────────────────────────────────

export function getReserves(): Reserve[] {
  return loadState<Reserve[]>(KEYS.reserves, DEFAULT_RESERVES)
}

export function saveReserves(reserves: Reserve[]): void {
  saveState(KEYS.reserves, reserves)
}

// ── Visites / réunions de chantier (session globale) ─────────────────────────
// Supabase mapping (future): visits + visit_zones + visit_task_checks +
// visit_notes (+ the reserves tagged with visit_id for the "à revoir" points).

/** Every logement/commun of the catalog, selectable when opening a session. */
export const ZONE_REFS: ZoneRef[] = LOGEMENTS.map(l => ({
  refId: l.id,
  label: l.label,
  kind: l.zoneId === 'COMMUNS' ? 'commun' : 'logement',
  buildingId: l.zoneId,
  buildingLabel: l.zoneLabel,
}))

/** Demo session: A-101 fully controlled, A-102 half done, B-201 with a reprise. */
const DEFAULT_VISITS: VisitSession[] = [(() => {
  const seeded: Record<string, Record<string, { state: TaskState; progress?: number }>> = {
    'A-101': { L05: { state: 'ok', progress: 100 }, L06: { state: 'ok', progress: 100 }, L07: { state: 'ok', progress: 100 }, L08: { state: 'ok', progress: 90 } },
    'A-102': { L05: { state: 'ok', progress: 100 }, L06: { state: 'ok', progress: 70 } },
    'B-201': { L05: { state: 'ok', progress: 60 }, L07: { state: 'to_review', progress: 20 } },
  }
  const zones = buildZonesFromPlanning(GANTT_TASKS, ZONE_REFS).map(z => {
    const s = seeded[z.refId]
    if (!s) return z
    return { ...z, tasks: z.tasks.map(t => (s[t.lotId] ? { ...t, ...s[t.lotId] } : t)) }
  })
  return {
    id: 'VS-DEMO',
    kind: 'visite' as const,
    date: '2026-09-09',
    title: 'Visite hebdomadaire',
    status: 'en_cours' as const,
    participants: [
      { id: 'p1', name: 'Jean Dupont', role: 'MOE' as const },
      { id: 'p2', name: 'Marie Martin', role: 'MOA' as const },
    ],
    zones,
    notes: [],
    startedAt: '2026-09-09T07:12:00.000Z',
    createdAt: '2026-09-09T07:12:00.000Z',
  }
})()]

export function getVisits(): VisitSession[] {
  return loadState<VisitSession[]>(KEYS.visits, DEFAULT_VISITS)
}

export function saveVisits(visits: VisitSession[]): void {
  saveState(KEYS.visits, visits)
}

/** Session names the user added beyond "visite" / "réunion", kept for reuse. */
export function getVisitKinds(): string[] {
  return loadState<string[]>(KEYS.visitKinds, [])
}

export function saveVisitKinds(kinds: string[]): void {
  saveState(KEYS.visitKinds, kinds)
}

// ── Engagements de dates pris par les entreprises ───────────────────────────

export function getCommitments(): DateCommitment[] {
  return loadState<DateCommitment[]>(KEYS.commitments, [])
}

export function saveCommitments(c: DateCommitment[]): void {
  saveState(KEYS.commitments, c)
}

// ── Lots configuration ───────────────────────────────────────────────────────

export function getLotsConfig(): LotContact[] {
  return loadState<LotContact[]>(KEYS.lotsConfig, DEFAULT_LOTS)
}

export function saveLotsConfig(lots: LotContact[]): void {
  saveState(KEYS.lotsConfig, lots)
}

// ── Finances (marchés / avenants / situations) ──────────────────────────────
// Supabase mapping: markets, market_amendments, market_situations.

export function getMarches(): Marche[] {
  return loadState<Marche[]>(KEYS.marches, DEFAULT_MARCHES)
}
export function saveMarches(m: Marche[]): void {
  saveState(KEYS.marches, m)
}

export function getAvenants(): Avenant[] {
  return loadState<Avenant[]>(KEYS.avenants, DEFAULT_AVENANTS)
}
export function saveAvenants(a: Avenant[]): void {
  saveState(KEYS.avenants, a)
}

export function getSituations(): Situation[] {
  return loadState<Situation[]>(KEYS.situations, DEFAULT_SITUATIONS)
}
export function saveSituations(s: Situation[]): void {
  saveState(KEYS.situations, s)
}

// ── Administratif (RFI / VISA / GED) ────────────────────────────────────────
// Supabase mapping (future): rfis, submittals/visas, documents tables.

export function getRfis(): Rfi[] {
  return loadState<Rfi[]>(KEYS.rfis, DEFAULT_RFIS)
}
export function saveRfis(r: Rfi[]): void {
  saveState(KEYS.rfis, r)
}

export function getVisas(): Visa[] {
  return loadState<Visa[]>(KEYS.visas, DEFAULT_VISAS)
}
export function saveVisas(v: Visa[]): void {
  saveState(KEYS.visas, v)
}

export function getDocs(): Doc[] {
  return loadState<Doc[]>(KEYS.docs, DEFAULT_DOCS)
}
export function saveDocs(d: Doc[]): void {
  saveState(KEYS.docs, d)
}

// ── Alertes (actions utilisateur : résolu / épinglé réunion) ────────────────

export function getAlertActions(): AlertActions {
  return loadState<AlertActions>(KEYS.alertActions, {})
}
export function saveAlertActions(a: AlertActions): void {
  saveState(KEYS.alertActions, a)
}

// ── Congés / périodes non travaillées ───────────────────────────────────────

export function getHolidays(): Holiday[] {
  return loadState<Holiday[]>(KEYS.holidays, DEFAULT_HOLIDAYS)
}
export function saveHolidays(h: Holiday[]): void {
  saveState(KEYS.holidays, h)
}

// ── DPGF (quantitatif) ──────────────────────────────────────────────────────

export function getDpgf(): DpgfLine[] {
  return loadState<DpgfLine[]>(KEYS.dpgf, DEFAULT_DPGF)
}
export function saveDpgf(lines: DpgfLine[]): void {
  saveState(KEYS.dpgf, lines)
}

// ── Préférences Gantt (zoom, regroupement) — persistées ─────────────────────

export function getGanttPrefs(): GanttPrefs {
  return { ...DEFAULT_GANTT_PREFS, ...loadState<Partial<GanttPrefs>>(KEYS.ganttPrefs, {}) }
}
export function saveGanttPrefs(p: GanttPrefs): void {
  saveState(KEYS.ganttPrefs, p)
}

// ── Journal d'activité ──────────────────────────────────────────────────────

export function getActivity(): ActivityEvent[] {
  return loadState<ActivityEvent[]>(KEYS.activity, DEFAULT_ACTIVITY)
}
export function saveActivity(events: ActivityEvent[]): void {
  saveState(KEYS.activity, events)
}
/** Append an event to the journal (read-modify-write). */
export function logActivity(type: ActivityType, message: string): void {
  saveActivity(pushEvent(getActivity(), type, message))
}

// ── Réunions / décisions / actions ──────────────────────────────────────────

export function getMeetings(): Meeting[] {
  return loadState<Meeting[]>(KEYS.meetings, DEFAULT_MEETINGS)
}
export function saveMeetings(m: Meeting[]): void {
  saveState(KEYS.meetings, m)
}
