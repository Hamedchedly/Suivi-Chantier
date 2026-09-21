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
import { PlanningSnapshot, ChangeLogEntry } from './planningHistory'
import type { User, Session } from './auth'
import type { Project, TrashedProject } from './projects'
import {
  resolveCurrent, findOrphanProjectIds, restoreOrphanProject as restoreOrphanProjectPure,
  diagnoseProjectsRegistry as diagnoseProjectsRegistryPure,
} from './projects'
import type { OrphanRestoreInput, ProjectsDiagnosis, Result } from './projects'
import { loadState, saveState, removeState } from './storage'

// ── Messages administrateur ──────────────────────────────────────────────────
export interface AdminMessage {
  id: string
  kind: 'overlay' | 'banner' | 'ticker'
  text: string
  active: boolean
  createdAt: string
}

// ── Clés globales (hors projet) ─────────────────────────────────────────────
const GLOBAL = {
  users: 'sc-users-v1',
  session: 'sc-session-v1',
  projects: 'sc-projects-v1',
  currentProject: 'sc-current-project-v1',
  trash: 'sc-trash-v1',
  adminMessages: 'sc-admin-messages-v1',
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
  projectMemo: 'sc-project-memo-v1',
  projectRules: 'sc-project-rules-v1',
  planningHistory: 'sc-planning-history-v1',
  changeLog: 'sc-change-log-v1',
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

/** Toutes les clés du cache local, telles quelles (lecture seule). */
function allLocalStorageKeys(): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
  } catch { /* localStorage indisponible */ }
  return keys
}

/**
 * Audit (lecture seule) : identifiants de projet référencés par au moins une
 * clé cloisonnée du cache local mais absents du registre `sc-projects-v1`.
 * Ne restaure rien, ne supprime rien — signale seulement (voir
 * findOrphanProjectIds, lib/projects.ts, et le rapport d'audit
 * docs/AUDIT_ACACIAS_E2E_2026-09-21.md §A pour l'incident qui a motivé cette
 * fonction).
 */
export function findOrphanProjects(): string[] {
  return findOrphanProjectIds(getProjects().map(p => p.id), allLocalStorageKeys())
}

/**
 * Diagnostic complet et READ-ONLY du registre face aux données réellement
 * présentes en local (voir diagnoseProjectsRegistry, lib/projects.ts). N'écrit
 * jamais rien — un simple constat à afficher ou à journaliser.
 */
export function diagnoseProjects(): ProjectsDiagnosis {
  return diagnoseProjectsRegistryPure(getProjects(), allLocalStorageKeys())
}

/**
 * Réinscrit un projet orphelin (données cloisonnées connues, entrée absente
 * de sc-projects-v1) dans le registre local, avec son id EXACT et les
 * métadonnées fournies — jamais de nouvel id, jamais de données métier
 * créées ou modifiées. Passe par saveProjects (donc par le write-through
 * habituel si la sync est active) : c'est le même chemin qu'une création
 * normale, seule la provenance de l'id diffère.
 */
export function restoreOrphanProject(input: OrphanRestoreInput): Result<Project[]> {
  const result = restoreOrphanProjectPure(getProjects(), input)
  if (result.ok) saveProjects(result.projects)
  return result
}

// ── Corbeille des opérations (suppression réversible) ────────────────────────
// Une opération supprimée y est déplacée SANS purger ses données : on peut la
// restaurer telle quelle. La purge définitive (deleteProjectData) n'intervient
// qu'à la suppression définitive depuis la corbeille.

export function getTrash(): TrashedProject[] {
  return loadState<TrashedProject[]>(GLOBAL.trash, [])
}

export function saveTrash(trash: TrashedProject[]): void {
  saveState(GLOBAL.trash, trash)
}

/** Purge toutes les données d'un projet supprimé (aucune orpheline en réserve). */
export function deleteProjectData(projectId: string): void {
  // removeState propage la suppression au miroir serveur quand la sync est active.
  for (const base of Object.values(SCOPED)) {
    removeState(`${base}::${projectId}`)
  }
}

/** Données métier d'un projet, tranche par tranche — pour amorcer un exemple. */
export interface ProjectSeed {
  gantt?: unknown; reserves?: unknown; lotsConfig?: unknown; units?: unknown
  taskUnits?: unknown; marches?: unknown; avenants?: unknown; situations?: unknown
  meetings?: unknown; visits?: unknown; commitments?: unknown; holidays?: unknown
  dpgf?: unknown; activity?: unknown
}

/** Écrit les tranches fournies dans les clés cloisonnées d'un projet donné. */
export function seedProjectData(projectId: string, data: ProjectSeed): void {
  const write = (base: string, value: unknown) => {
    if (value !== undefined) saveState(`${base}::${projectId}`, value)
  }
  write(SCOPED.gantt, data.gantt)
  write(SCOPED.reserves, data.reserves)
  write(SCOPED.lotsConfig, data.lotsConfig)
  write(SCOPED.units, data.units)
  write(SCOPED.taskUnits, data.taskUnits)
  write(SCOPED.marches, data.marches)
  write(SCOPED.avenants, data.avenants)
  write(SCOPED.situations, data.situations)
  write(SCOPED.meetings, data.meetings)
  write(SCOPED.visits, data.visits)
  write(SCOPED.commitments, data.commitments)
  write(SCOPED.holidays, data.holidays)
  write(SCOPED.dpgf, data.dpgf)
  write(SCOPED.activity, data.activity)
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
  /** 'conge' = non travaillé (grisé sur le Gantt) ; 'event' = événement spécial (chaleur, pluie…) */
  kind?: 'conge' | 'event'
  eventType?: 'chaleur' | 'pluie' | 'autre'
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

const GANTT_DATE_FIELDS = [
  'planned_start', 'planned_end', 'actual_start', 'actual_end',
  'forecast_start', 'forecast_end', 'baseline_start', 'baseline_end',
] as const

/**
 * Filet de lecture : tout le pipeline Planning (CPM, prévision, analyse —
 * cpm.ts, forecast.ts, planningEngine.ts, planning.ts) appelle .getTime()
 * sur ces champs en tenant pour acquis que ce sont de vraies instances Date,
 * comme le exige le type GanttTask. loadState() les revive correctement
 * quand la donnée a été écrite par l'application (storage.ts encode une
 * Date en { __date: ISOString }) — mais une valeur arrivée par un autre
 * chemin (correction directe en base, import) peut être une chaîne ISO
 * brute que le reviver générique ignore (il ne reconnaît que { __date }).
 * Sans ce filet, la première tâche concernée fait planter tout l'écran
 * Planning avec une TypeError (« …getTime is not a function ») dès le
 * montage — voir le rapport de diagnostic du bug Planning.
 */
function normalizeGanttTaskDates(t: GanttTask): GanttTask {
  const next = { ...t }
  for (const field of GANTT_DATE_FIELDS) {
    const v = next[field]
    if (v !== undefined && !(v instanceof Date)) next[field] = new Date(v as unknown as string)
  }
  if (next.children?.length) next.children = next.children.map(normalizeGanttTaskDates)
  return next
}

export function getGanttTasks(): GanttTask[] {
  return loadState<GanttTask[]>(k(SCOPED.gantt), []).map(normalizeGanttTaskDates)
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

// ── Mémo projet ─────────────────────────────────────────────────────────────

export function getProjectMemo(): string {
  return loadState<string>(k(SCOPED.projectMemo), '')
}

export function saveProjectMemo(memo: string): void {
  saveState(k(SCOPED.projectMemo), memo)
}

/** Règles/consignes projet affichées automatiquement en tête de chaque CR PDF. */
export function getProjectRules(): string[] {
  return loadState<string[]>(k(SCOPED.projectRules), [])
}

export function saveProjectRules(rules: string[]): void {
  saveState(k(SCOPED.projectRules), rules)
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

// ── Historique du planning ───────────────────────────────────────────────────

export function getPlanningHistory(): PlanningSnapshot[] {
  return loadState<PlanningSnapshot[]>(k(SCOPED.planningHistory), [])
}
export function savePlanningHistory(h: PlanningSnapshot[]): void {
  saveState(k(SCOPED.planningHistory), h)
}
export function getChangeLog(): ChangeLogEntry[] {
  return loadState<ChangeLogEntry[]>(k(SCOPED.changeLog), [])
}
export function saveChangeLog(l: ChangeLogEntry[]): void {
  saveState(k(SCOPED.changeLog), l)
}

// ── Messages administrateur (globaux, toutes opérations) ────────────────────

export function getAdminMessages(): AdminMessage[] {
  return loadState<AdminMessage[]>(GLOBAL.adminMessages, [])
}
export function saveAdminMessages(msgs: AdminMessage[]): void {
  saveState(GLOBAL.adminMessages, msgs)
}
