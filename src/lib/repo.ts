// ────────────────────────────────────────────────────────────────────────────
// Persistence boundary (repository).
//
// This module is the ONLY place the app reads/writes persisted data. Today it is
// backed by localStorage. To move to Supabase later (once authentication is
// enabled — RLS on the live DB requires auth.uid()), swap the bodies below for
// Supabase queries; call sites (components) do not change.
//
// MULTI-PROJETS — un utilisateur suit plusieurs chantiers.
//   • Les clés GLOBAL sont communes à toute l'installation : comptes, session,
//     registre des projets, projet actif.
//   • Toutes les autres données sont CLOISONNÉES par projet : la clé réellement
//     écrite est `${base}::${projectId}`. Basculer de projet change donc la
//     totalité des données lues, sans rien déplacer.
//   • Un projet créé démarre VIDE. Aucune donnée de démonstration n'est semée :
//     les jeux d'essai de src/data/ ne servent plus qu'aux tests et aux imports.
//
// Supabase mapping (for the future backend sprint), project "Suivi-Chantier":
//   getProjects    / saveProjects     ↔ public.operations
//   getGanttTasks  / saveGanttTasks   ↔ public.tasks (+ schedule_items, progress_entries)
//   getReserves    / saveReserves     ↔ public.observations
//   getVisits      / saveVisits       ↔ public.visits (+ visit_zones, visit_task_checks)
//   getLotsConfig  / saveLotsConfig   ↔ public.lots (+ lot_assignments, companies)
// Each of those tables is RLS-protected via is_operation_member(operation_id),
// so a Supabase implementation must run as an authenticated user.
// ────────────────────────────────────────────────────────────────────────────

import { GanttTask } from '../types/gantt'
import { Reserve } from './reserves'
import { Marche, Avenant, Situation } from './finance'
import { Rfi, Visa, Doc } from './admin'
import { AlertActions } from './alerts'
import { DpgfLine } from './dpgf'
import { ActivityEvent, ActivityType, pushEvent } from './activity'
import { Meeting } from './meetings'
import { Visit as VisitSession, type ZoneRef } from './visits'
import { Unit, TaskUnitLink, visitableUnits, buildingOf, unitPath } from './units'
import { DateCommitment } from './commitments'
import type { User, Session } from './auth'
import type { Project } from './projects'
import { resolveCurrent } from './projects'
import { loadState, saveState } from './storage'

// ── Clés globales (hors projet) ─────────────────────────────────────────────
const GLOBAL = {
  users: 'sc-users-v1',
  session: 'sc-session-v1',
  projects: 'sc-projects-v1',
  currentProject: 'sc-current-project-v1',
} as const

// ── Clés cloisonnées par projet (suffixées `::<projectId>`) ─────────────────
// Bump the version suffix when a stored shape changes.
const SCOPED = {
  gantt: 'sc-gantt-v2',
  reserves: 'sc-reserves-v1',
  lotsConfig: 'sc-lots-config-v1',
  units: 'sc-units-v1',
  taskUnits: 'sc-task-units-v1',
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

/** Projet sans identifiant : les lectures tombent sur les valeurs par défaut. */
const NO_PROJECT = '-'

/** Clé effective d'une donnée métier pour le projet actif. */
function k(base: string): string {
  return `${base}::${getCurrentProjectId() ?? NO_PROJECT}`
}

// ── Registre des projets ────────────────────────────────────────────────────

export function getProjects(): Project[] {
  return loadState<Project[]>(GLOBAL.projects, [])
}

export function saveProjects(projects: Project[]): void {
  saveState(GLOBAL.projects, projects)
}

/**
 * Projet actif. Toujours cohérent avec le registre : si le projet mémorisé a été
 * supprimé, on retombe sur le premier disponible (et null s'il n'y en a plus).
 */
export function getCurrentProjectId(): string | null {
  const stored = loadState<string | null>(GLOBAL.currentProject, null)
  return resolveCurrent(getProjects(), stored)
}

export function setCurrentProjectId(id: string | null): void {
  saveState(GLOBAL.currentProject, id)
}

/** Purge toutes les données d'un projet supprimé (aucune orpheline en réserve). */
export function deleteProjectData(projectId: string): void {
  for (const base of Object.values(SCOPED)) {
    try { localStorage.removeItem(`${base}::${projectId}`) } catch { /* storage indisponible */ }
  }
}

// ── Entity types owned by the repository ────────────────────────────────────

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

export interface LotContact {
  id: string
  name: string
  company: string
  contactName: string
  email: string
  phone: string
}

// ── Planning (Gantt) ─────────────────────────────────────────────────────────

export function getGanttTasks(): GanttTask[] {
  return loadState<GanttTask[]>(k(SCOPED.gantt), [])
}

export function saveGanttTasks(tasks: GanttTask[]): void {
  saveState(k(SCOPED.gantt), tasks)
}

/** Per top-level lot (parent) progress, read from the planning. */
export function getLotProgress(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of getGanttTasks()) out[t.lot_id] = t.progress
  return out
}

// ── Reserves ─────────────────────────────────────────────────────────────────

export function getReserves(): Reserve[] {
  return loadState<Reserve[]>(k(SCOPED.reserves), [])
}

export function saveReserves(reserves: Reserve[]): void {
  saveState(k(SCOPED.reserves), reserves)
}

// ── Visites / réunions de chantier (session globale) ─────────────────────────
// Supabase mapping (future): visits + visit_zones + visit_task_checks +
// visit_notes (+ the reserves tagged with visit_id for the "à revoir" points).

/**
 * Structure de l'opération : bâtiments, niveaux, logements, communs, extérieurs.
 * Vide tant que l'utilisateur n'a pas décrit son chantier (écran « Structure »).
 */
export function getUnits(): Unit[] {
  return loadState<Unit[]>(k(SCOPED.units), [])
}

export function saveUnits(units: Unit[]): void {
  saveState(k(SCOPED.units), units)
}

/** Rattachements tâche de planning ↔ unité, saisis dans un sens ou dans l'autre. */
export function getTaskUnits(): TaskUnitLink[] {
  return loadState<TaskUnitLink[]>(k(SCOPED.taskUnits), [])
}

export function saveTaskUnits(links: TaskUnitLink[]): void {
  saveState(k(SCOPED.taskUnits), links)
}

/**
 * Zones proposées à l'ouverture d'une session : les unités réellement
 * parcourables (logements, communs, extérieurs), rattachées à leur bâtiment.
 * Dérivé de la structure — il n'y a qu'une seule source de vérité.
 */
export function getZoneRefs(): ZoneRef[] {
  const units = getUnits()
  return visitableUnits(units).map(u => {
    const building = buildingOf(units, u.id) ?? u
    return {
      refId: u.id,
      label: u.code ? `${u.name} (${u.code})` : u.name,
      kind: u.kind === 'dwelling' ? 'logement' : 'commun',
      buildingId: building.id,
      buildingLabel: building.name,
    }
  })
}

/** Chemin complet d'une unité — « Bâtiment A › R+1 › Logement 3 ». */
export function zoneFullPath(unitId: string): string {
  return unitPath(getUnits(), unitId)
}

export function getVisits(): VisitSession[] {
  return loadState<VisitSession[]>(k(SCOPED.visits), [])
}

export function saveVisits(visits: VisitSession[]): void {
  saveState(k(SCOPED.visits), visits)
}

/** Session names the user added beyond "visite" / "réunion", kept for reuse. */
export function getVisitKinds(): string[] {
  return loadState<string[]>(k(SCOPED.visitKinds), [])
}

export function saveVisitKinds(kinds: string[]): void {
  saveState(k(SCOPED.visitKinds), kinds)
}

// ── Comptes & session ───────────────────────────────────────────────────────
// Demo credentials for the prototype. They are stored — and compared — in the
// browser, so they gate the interface, not the data. See lib/auth.ts.

const DEFAULT_USERS: User[] = [
  { id: 'u-user', username: 'user', password: 'user', role: 'user', displayName: 'Utilisateur', createdAt: '2026-09-01T08:00:00.000Z' },
  { id: 'u-super', username: 'superadmin', password: 'superadmin', role: 'superadmin', displayName: 'Super-administrateur', createdAt: '2026-09-01T08:00:00.000Z' },
]

export function getUsers(): User[] {
  return loadState<User[]>(GLOBAL.users, DEFAULT_USERS)
}

export function saveUsers(users: User[]): void {
  saveState(GLOBAL.users, users)
}

export function getSession(): Session | null {
  return loadState<Session | null>(GLOBAL.session, null)
}

export function saveSession(session: Session | null): void {
  saveState(GLOBAL.session, session)
}

// ── Engagements de dates pris par les entreprises ───────────────────────────

export function getCommitments(): DateCommitment[] {
  return loadState<DateCommitment[]>(k(SCOPED.commitments), [])
}

export function saveCommitments(c: DateCommitment[]): void {
  saveState(k(SCOPED.commitments), c)
}

// ── Lots configuration ───────────────────────────────────────────────────────

export function getLotsConfig(): LotContact[] {
  return loadState<LotContact[]>(k(SCOPED.lotsConfig), [])
}

export function saveLotsConfig(lots: LotContact[]): void {
  saveState(k(SCOPED.lotsConfig), lots)
}

// ── Finances (marchés / avenants / situations) ──────────────────────────────
// Supabase mapping: markets, market_amendments, market_situations.

export function getMarches(): Marche[] {
  return loadState<Marche[]>(k(SCOPED.marches), [])
}
export function saveMarches(m: Marche[]): void {
  saveState(k(SCOPED.marches), m)
}

export function getAvenants(): Avenant[] {
  return loadState<Avenant[]>(k(SCOPED.avenants), [])
}
export function saveAvenants(a: Avenant[]): void {
  saveState(k(SCOPED.avenants), a)
}

export function getSituations(): Situation[] {
  return loadState<Situation[]>(k(SCOPED.situations), [])
}
export function saveSituations(s: Situation[]): void {
  saveState(k(SCOPED.situations), s)
}

// ── Administratif (RFI / VISA / GED) ────────────────────────────────────────
// Supabase mapping (future): rfis, submittals/visas, documents tables.

export function getRfis(): Rfi[] {
  return loadState<Rfi[]>(k(SCOPED.rfis), [])
}
export function saveRfis(r: Rfi[]): void {
  saveState(k(SCOPED.rfis), r)
}

export function getVisas(): Visa[] {
  return loadState<Visa[]>(k(SCOPED.visas), [])
}
export function saveVisas(v: Visa[]): void {
  saveState(k(SCOPED.visas), v)
}

export function getDocs(): Doc[] {
  return loadState<Doc[]>(k(SCOPED.docs), [])
}
export function saveDocs(d: Doc[]): void {
  saveState(k(SCOPED.docs), d)
}

// ── Alertes (actions utilisateur : résolu / épinglé réunion) ────────────────

export function getAlertActions(): AlertActions {
  return loadState<AlertActions>(k(SCOPED.alertActions), {})
}
export function saveAlertActions(a: AlertActions): void {
  saveState(k(SCOPED.alertActions), a)
}

// ── Congés / périodes non travaillées ───────────────────────────────────────

export function getHolidays(): Holiday[] {
  return loadState<Holiday[]>(k(SCOPED.holidays), [])
}
export function saveHolidays(h: Holiday[]): void {
  saveState(k(SCOPED.holidays), h)
}

// ── DPGF (quantitatif) ──────────────────────────────────────────────────────

export function getDpgf(): DpgfLine[] {
  return loadState<DpgfLine[]>(k(SCOPED.dpgf), [])
}
export function saveDpgf(lines: DpgfLine[]): void {
  saveState(k(SCOPED.dpgf), lines)
}

// ── Préférences Gantt (zoom, regroupement) — persistées ─────────────────────

export function getGanttPrefs(): GanttPrefs {
  return { ...DEFAULT_GANTT_PREFS, ...loadState<Partial<GanttPrefs>>(k(SCOPED.ganttPrefs), {}) }
}
export function saveGanttPrefs(p: GanttPrefs): void {
  saveState(k(SCOPED.ganttPrefs), p)
}

// ── Journal d'activité ──────────────────────────────────────────────────────

export function getActivity(): ActivityEvent[] {
  return loadState<ActivityEvent[]>(k(SCOPED.activity), [])
}
export function saveActivity(events: ActivityEvent[]): void {
  saveState(k(SCOPED.activity), events)
}
/** Append an event to the journal (read-modify-write). */
export function logActivity(type: ActivityType, message: string): void {
  saveActivity(pushEvent(getActivity(), type, message))
}

// ── Réunions / décisions / actions ──────────────────────────────────────────

export function getMeetings(): Meeting[] {
  return loadState<Meeting[]>(k(SCOPED.meetings), [])
}
export function saveMeetings(m: Meeting[]): void {
  saveState(k(SCOPED.meetings), m)
}
