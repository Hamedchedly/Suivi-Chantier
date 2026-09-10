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
//   getVisits      / saveVisits      ↔ public.visits (+ visit_attendees)
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
import { loadState, saveState } from './storage'

// Versioned storage keys (bump the suffix when a stored shape changes).
const KEYS = {
  gantt: 'sc-gantt-v2',
  reserves: 'sc-reserves-v1',
  visits: 'sc-visits-v1',
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
} as const

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

export interface Visit {
  id: string
  date: string // ISO (yyyy-mm-dd)
  presences: string[]
  zones: string[]
  lots: number
  status: 'brouillon' | 'envoyé'
}

export interface LotContact {
  id: string
  name: string
  company: string
  contactName: string
  email: string
  phone: string
}

// ── Default seeds (used until the user creates their own data) ───────────────

const DEFAULT_VISITS: Visit[] = [
  { id: 'V003', date: '2026-09-09', presences: [], zones: [], lots: 4, status: 'brouillon' },
  { id: 'V002', date: '2026-09-04', presences: [], zones: [], lots: 5, status: 'envoyé' },
  { id: 'V001', date: '2026-08-28', presences: [], zones: [], lots: 5, status: 'envoyé' },
]

const DEFAULT_LOTS: LotContact[] = [
  { id: 'L05', name: 'LOT 05 - Menuiseries int. / Isolation', company: 'SMP Aménagement', contactName: 'Jean Dupont', email: 'j.dupont@smp.fr', phone: '06 12 34 56 78' },
  { id: 'L06', name: 'LOT 06 - Électricité / Contrôle accès', company: 'Soveclim Services', contactName: 'Marie Martin', email: 'm.martin@soveclim.fr', phone: '06 23 45 67 89' },
  { id: 'L07', name: 'LOT 07 - CVC', company: 'Soveclim Services', contactName: 'Pierre Lécuyer', email: 'p.lecuyer@soveclim.fr', phone: '06 34 56 78 90' },
  { id: 'L08', name: 'LOT 08 - Embellissements', company: 'Soretherm', contactName: 'Anne Legrand', email: 'a.legrand@soretherm.fr', phone: '06 45 67 89 01' },
]

const DEFAULT_RESERVES: Reserve[] = [
  { id: 'r1', number: 'R-001', lotId: 'L05', logementId: 'A-101', description: 'Joint de fenêtre séjour mal posé', priority: 'medium', status: 'open', createdAt: '2026-09-04' },
  { id: 'r2', number: 'R-002', lotId: 'L07', logementId: 'B-201', description: 'Fuite au niveau du raccord CVC', priority: 'high', status: 'open', createdAt: '2026-09-08' },
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

/** Push field-measured progress back onto the planning's parent lot tasks. */
export function setLotProgress(progress: Record<string, number>): void {
  const updated = getGanttTasks().map(t => (t.lot_id in progress ? { ...t, progress: progress[t.lot_id] } : t))
  saveGanttTasks(updated)
}

// ── Reserves ─────────────────────────────────────────────────────────────────

export function getReserves(): Reserve[] {
  return loadState<Reserve[]>(KEYS.reserves, DEFAULT_RESERVES)
}

export function saveReserves(reserves: Reserve[]): void {
  saveState(KEYS.reserves, reserves)
}

// ── Visits ───────────────────────────────────────────────────────────────────

export function getVisits(): Visit[] {
  return loadState<Visit[]>(KEYS.visits, DEFAULT_VISITS)
}

export function saveVisits(visits: Visit[]): void {
  saveState(KEYS.visits, visits)
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
