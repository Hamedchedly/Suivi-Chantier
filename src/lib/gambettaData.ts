// ────────────────────────────────────────────────────────────────────────────
// Opération RÉELLE « 111 rue Gambetta » (Reims) — données issues du planning et
// des marchés N17 (source : 260908 GAMBETTA, réf. ER.T2286). Générée depuis le
// jeu d'injection ; chargeable en un clic depuis « Mes opérations ».
// ────────────────────────────────────────────────────────────────────────────

import type { GanttTask, TaskStatus } from '../types/gantt'
import type { Marche } from './finance'
import type { LotContact, ProjectSeed } from './repo'
import type { ProjectInput } from './projects'

export const GAMBETTA_PROJECT: ProjectInput = {
  name: '111 rue Gambetta',
  reference: 'ER.T2286',
  address: '111 Rue Gambetta, 51100 Reims',
}

const status = (p: number): TaskStatus => (p >= 100 ? 'completed' : p > 0 ? 'in-progress' : 'not-started')

interface LeafSpec { id: string; title: string; s: string; e: string; dur: number; progress: number }
function leaf(lotId: string, x: LeafSpec): GanttTask {
  return {
    id: x.id, parent_id: `LOT-${lotId}`, lot_id: lotId, title: x.title,
    planned_start: new Date(x.s), planned_end: new Date(x.e), planned_duration: x.dur,
    progress: x.progress, status: status(x.progress),
    priority: 'medium', dependencies: [], is_milestone: false, is_critical: false,
  }
}
function lot(lotId: string, title: string, leaves: GanttTask[]): GanttTask {
  const start = new Date(Math.min(...leaves.map(l => l.planned_start.getTime())))
  const end = new Date(Math.max(...leaves.map(l => l.planned_end.getTime())))
  const progress = Math.round(leaves.reduce((s, l) => s + l.progress, 0) / leaves.length)
  return {
    id: `LOT-${lotId}`, lot_id: lotId, title, planned_start: start, planned_end: end,
    planned_duration: 0, progress, status: 'in-progress', priority: 'medium',
    dependencies: [], is_milestone: false, is_critical: false, children: leaves,
  }
}

const gantt: GanttTask[] = [
  lot('GENERAL', 'Généralités', [
    leaf('GENERAL', { id: 'g-GENERAL-0', title: 'Installation de chantier', s: '2025-11-10', e: '2025-11-16', dur: 5, progress: 100 }),
    leaf('GENERAL', { id: 'g-GENERAL-1', title: 'Réception des travaux', s: '2026-07-27', e: '2026-08-16', dur: 15, progress: 0 }),
  ]),
  lot('LOT01', 'LOT 01 — Démolition / Structure', [
    leaf('LOT01', { id: 'g-LOT01-0', title: 'Curage logement RC Bâtiment C', s: '2025-11-17', e: '2025-11-23', dur: 5, progress: 100 }),
    leaf('LOT01', { id: 'g-LOT01-1', title: 'Démolition du plancher', s: '2025-11-17', e: '2025-12-14', dur: 20, progress: 100 }),
    leaf('LOT01', { id: 'g-LOT01-2', title: 'Reconstitution du plancher', s: '2026-03-09', e: '2026-03-29', dur: 15, progress: 100 }),
  ]),
  lot('LOT02', 'LOT 02 — Couverture', [
    leaf('LOT02', { id: 'g-LOT02-0', title: 'Installations des moyens d\'accès', s: '2025-12-22', e: '2025-12-28', dur: 5, progress: 100 }),
    leaf('LOT02', { id: 'g-LOT02-1', title: 'Bâtiment B', s: '2025-12-22', e: '2026-01-04', dur: 10, progress: 100 }),
    leaf('LOT02', { id: 'g-LOT02-2', title: 'Bâtiment A', s: '2026-02-09', e: '2026-02-22', dur: 10, progress: 100 }),
    leaf('LOT02', { id: 'g-LOT02-3', title: 'Travaux de reprise de charpente', s: '2026-01-19', e: '2026-02-15', dur: 20, progress: 100 }),
    leaf('LOT02', { id: 'g-LOT02-4', title: 'Bâtiment B', s: '2026-01-26', e: '2026-02-15', dur: 15, progress: 100 }),
    leaf('LOT02', { id: 'g-LOT02-5', title: 'Bâtiment A Coté Cour Int.', s: '2026-02-16', e: '2026-03-08', dur: 15, progress: 100 }),
    leaf('LOT02', { id: 'g-LOT02-6', title: 'Bâtiment A Coté Rue', s: '2026-03-23', e: '2026-04-12', dur: 15, progress: 100 }),
    leaf('LOT02', { id: 'g-LOT02-7', title: 'Désenfumage', s: '2026-03-09', e: '2026-03-15', dur: 5, progress: 100 }),
  ]),
  lot('LOT03', 'LOT 03 — Façade / ITE', [
    leaf('LOT03', { id: 'g-LOT03-0', title: 'Installations des moyens d\'accès', s: '2026-01-26', e: '2026-02-08', dur: 10, progress: 100 }),
    leaf('LOT03', { id: 'g-LOT03-1', title: 'Bâtiment C', s: '2026-01-26', e: '2026-02-01', dur: 5, progress: 100 }),
    leaf('LOT03', { id: 'g-LOT03-2', title: 'Bâtiment B', s: '2026-02-02', e: '2026-02-22', dur: 15, progress: 100 }),
    leaf('LOT03', { id: 'g-LOT03-3', title: 'Bâtiment A', s: '2026-02-23', e: '2026-03-01', dur: 5, progress: 100 }),
    leaf('LOT03', { id: 'g-LOT03-4', title: 'Rénovation de façade sur rue', s: '2026-03-02', e: '2026-03-22', dur: 15, progress: 100 }),
    leaf('LOT03', { id: 'g-LOT03-5', title: 'Peinture et lasure', s: '2026-04-13', e: '2026-06-07', dur: 40, progress: 100 }),
    leaf('LOT03', { id: 'g-LOT03-6', title: 'Travaux de finition', s: '2026-05-25', e: '2026-06-14', dur: 15, progress: 100 }),
  ]),
  lot('LOT04', 'LOT 04 — Menuiseries extérieures / serrurerie', [
    leaf('LOT04', { id: 'g-LOT04-0', title: 'Délais de fabrication', s: '2025-12-22', e: '2026-02-08', dur: 35, progress: 100 }),
    leaf('LOT04', { id: 'g-LOT04-1', title: 'Fenêtres PVC', s: '2026-02-09', e: '2026-02-22', dur: 10, progress: 100 }),
    leaf('LOT04', { id: 'g-LOT04-2', title: 'Rénovation des persiennes', s: '2026-03-23', e: '2026-04-05', dur: 10, progress: 100 }),
    leaf('LOT04', { id: 'g-LOT04-3', title: 'Portes d\'entrée extérieure', s: '2026-02-09', e: '2026-02-22', dur: 10, progress: 100 }),
  ]),
  lot('LOT05', 'LOT 05 — Menuiserie intérieure / isolation intérieure', [
    leaf('LOT05', { id: 'g-LOT05-0', title: 'Doublage intérieur', s: '2026-02-16', e: '2026-03-08', dur: 15, progress: 100 }),
    leaf('LOT05', { id: 'g-LOT05-1', title: 'TS Doublage Batiment C RDC', s: '2026-02-16', e: '2026-02-17', dur: 2, progress: 100 }),
    leaf('LOT05', { id: 'g-LOT05-2', title: 'TS Doublage Entrée', s: '2026-09-07', e: '2026-09-08', dur: 2, progress: 0 }),
    leaf('LOT05', { id: 'g-LOT05-3', title: 'Faux-plafonds', s: '2026-03-02', e: '2026-03-15', dur: 10, progress: 0 }),
    leaf('LOT05', { id: 'g-LOT05-4', title: 'Portes SS et portes de rangements', s: '2026-03-16', e: '2026-03-22', dur: 5, progress: 0 }),
    leaf('LOT05', { id: 'g-LOT05-5', title: 'Cloisonnement logement', s: '2026-03-16', e: '2026-03-29', dur: 10, progress: 100 }),
    leaf('LOT05', { id: 'g-LOT05-6', title: 'TS Cloisonnement logement B R+1', s: '2026-09-07', e: '2026-09-08', dur: 2, progress: 0 }),
    leaf('LOT05', { id: 'g-LOT05-7', title: 'Claustra bois (local OM / PAC)', s: '2026-03-30', e: '2026-04-05', dur: 5, progress: 0 }),
    leaf('LOT05', { id: 'g-LOT05-8', title: 'Isolation sous face plancher', s: '2026-04-06', e: '2026-04-19', dur: 10, progress: 0 }),
    leaf('LOT05', { id: 'g-LOT05-9', title: 'Reprise d\'isolation des combles', s: '2026-04-20', e: '2026-04-26', dur: 5, progress: 0 }),
  ]),
  lot('LOT06', 'LOT 06 — Electricité / contrôle d\'accès', [
    leaf('LOT06', { id: 'g-LOT06-0', title: 'Mise en sécurité Elec des logements', s: '2026-03-23', e: '2026-06-14', dur: 60, progress: 50 }),
    leaf('LOT06', { id: 'g-LOT06-1', title: 'Création d\'alimentation pour VR', s: '2026-03-23', e: '2026-06-14', dur: 60, progress: 70 }),
    leaf('LOT06', { id: 'g-LOT06-2', title: 'Passage Fourreau ENEDIS', s: '2026-03-30', e: '2026-04-05', dur: 5, progress: 0 }),
    leaf('LOT06', { id: 'g-LOT06-3', title: 'Travaux de reprises du logement n°5', s: '2026-04-20', e: '2026-05-31', dur: 30, progress: 50 }),
    leaf('LOT06', { id: 'g-LOT06-4', title: 'Alimentations diverses', s: '2026-03-30', e: '2026-06-07', dur: 50, progress: 30 }),
    leaf('LOT06', { id: 'g-LOT06-5', title: 'Eclairage communs et extérieurs', s: '2026-05-18', e: '2026-06-14', dur: 20, progress: 0 }),
    leaf('LOT06', { id: 'g-LOT06-6', title: 'Vidéophonie', s: '2026-06-15', e: '2026-06-28', dur: 10, progress: 0 }),
  ]),
  lot('LOT07', 'LOT 07 — Plomberie / ventilation / chauffage', [
    leaf('LOT07', { id: 'g-LOT07-0', title: 'Travaux de plomberie/sanitaire', s: '2026-03-23', e: '2026-07-19', dur: 85, progress: 60 }),
    leaf('LOT07', { id: 'g-LOT07-1', title: 'Remplacement de ballon ECS', s: '2026-05-04', e: '2026-07-05', dur: 45, progress: 20 }),
    leaf('LOT07', { id: 'g-LOT07-2', title: 'Travaux de ventilation', s: '2026-04-06', e: '2026-06-21', dur: 55, progress: 0 }),
    leaf('LOT07', { id: 'g-LOT07-3', title: 'Travaux de chauffage', s: '2026-04-13', e: '2026-06-07', dur: 40, progress: 0 }),
  ]),
  lot('LOT08', 'LOT 08 — Embellissements', [
    leaf('LOT08', { id: 'g-LOT08-0', title: 'Travaux de peinture interieurs', s: '2026-06-01', e: '2026-07-05', dur: 25, progress: 0 }),
    leaf('LOT08', { id: 'g-LOT08-1', title: 'Travaux de sols souples', s: '2026-06-29', e: '2026-07-26', dur: 20, progress: 0 }),
    leaf('LOT08', { id: 'g-LOT08-2', title: 'Travaux de faience', s: '2026-07-06', e: '2026-07-19', dur: 10, progress: 0 }),
  ]),
]

const lotsConfig: LotContact[] = [
  { id: 'LOT01', name: 'LOT 01 — Démolition / Structure', company: 'LERICHE', contactName: '', email: '', phone: '' },
  { id: 'LOT02', name: 'LOT 02 — Couverture', company: 'BUCZEK', contactName: '', email: '', phone: '' },
  { id: 'LOT03', name: 'LOT 03 — Façade / ITE', company: 'PFC ISOLATION', contactName: '', email: '', phone: '' },
  { id: 'LOT04', name: 'LOT 04 — Menuiseries extérieures / serrurerie', company: 'LA SERRURERIE REMOISE', contactName: '', email: '', phone: '' },
  { id: 'LOT05', name: 'LOT 05 — Menuiserie intérieure / isolation intérieure', company: 'SMP AMENAGEMENT', contactName: '', email: '', phone: '' },
  { id: 'LOT06', name: 'LOT 06 — Electricité / contrôle d\'accès', company: 'SOVECLIM SERVICES', contactName: '', email: '', phone: '' },
  { id: 'LOT07', name: 'LOT 07 — Plomberie / ventilation / chauffage', company: 'SORETHERM', contactName: '', email: '', phone: '' },
  { id: 'LOT08', name: 'LOT 08 — Embellissements', company: 'SMP AMENAGEMENT', contactName: '', email: '', phone: '' },
]

const marches: Marche[] = [
  { id: 'gm-0', lotId: 'LOT01', company: 'LERICHE', amountHT: 12782 },
  { id: 'gm-1', lotId: 'LOT02', company: 'BUCZEK', amountHT: 59158 },
  { id: 'gm-2', lotId: 'LOT03', company: 'PFC ISOLATION', amountHT: 31962 },
  { id: 'gm-3', lotId: 'LOT04', company: 'LA SERRURERIE REMOISE', amountHT: 18851 },
  { id: 'gm-4', lotId: 'LOT05', company: 'SMP AMENAGEMENT', amountHT: 19524 },
  { id: 'gm-5', lotId: 'LOT06', company: 'SOVECLIM SERVICES', amountHT: 59395 },
  { id: 'gm-6', lotId: 'LOT07', company: 'SORETHERM', amountHT: 60000 },
  { id: 'gm-7', lotId: 'LOT08', company: 'SMP AMENAGEMENT', amountHT: 30073 },
]

/** Toutes les tranches de l'opération Gambetta, prêtes pour seedProjectData(). */
export function buildGambettaSeed(): ProjectSeed {
  return { gantt, lotsConfig, marches }
}
