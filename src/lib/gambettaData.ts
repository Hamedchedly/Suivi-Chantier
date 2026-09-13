// ────────────────────────────────────────────────────────────────────────────
// Opération RÉELLE « 111 rue Gambetta » (Reims) — données issues du planning et
// des marchés N17 (source : 260908 GAMBETTA, réf. ER.T2286). Générée depuis le
// jeu d'injection ; chargeable en un clic depuis « Mes opérations ».
// ────────────────────────────────────────────────────────────────────────────

import type { GanttTask, TaskStatus } from '../types/gantt'
import type { Marche } from './finance'
import type { Reserve } from './reserves'
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

const reserves: Reserve[] = [
  { id: 'gr-0', number: 'R-001', lotId: '', logementId: '', description: 'Transmission des MAJ Planning Travaux', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'action', crNo: 0, company: 'TOUS', dueDate: '2025-12-02' },
  { id: 'gr-1', number: 'R-002', lotId: '', logementId: '', description: 'Réunion entre BUCZEK et PFC pour mutualisation des moyens (échaffaudages) à programmer', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'observation', crNo: 1, company: 'BUCZEK / PFC' },
  { id: 'gr-2', number: 'R-003', lotId: '', logementId: '', description: 'Demande de stationnement véhicule devant chantier', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'observation', crNo: 3 },
  { id: 'gr-3', number: 'R-004', lotId: '', logementId: '', description: 'Fiches techniques et notes de calcul à transmettre au BCT et à PN', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'observation', crNo: 1, company: 'TOUS' },
  { id: 'gr-4', number: 'R-005', lotId: '', logementId: '', description: 'MOA indique l\'importance de respecter le format de fichier transmis comme indiqué dans la première page du présent compte rendu.', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'observation', crNo: 3, company: 'TOUS' },
  { id: 'gr-5', number: 'R-006', lotId: 'LOT01', logementId: '', description: 'Remise des clés de chantier', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'action', crNo: 10, company: 'LERICHE', dueDate: '2026-04-30' },
  { id: 'gr-6', number: 'R-007', lotId: 'LOT01', logementId: '', description: 'Fin de travaux', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: undefined, company: 'LERICHE', meetingDate: '2026-09-08' },
  { id: 'gr-7', number: 'R-008', lotId: 'LOT02', logementId: '', description: 'Disjoncteur 10 A à prévoir sur le tableau Elec pour le désenfumage', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 4, company: 'SOVECLIM', meetingDate: '2026-09-08' },
  { id: 'gr-8', number: 'R-009', lotId: 'LOT02', logementId: '', description: 'Emplacement de centrale SSI pour le désenfumage', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 4, company: 'MOA' },
  { id: 'gr-9', number: 'R-010', lotId: 'LOT02', logementId: '', description: 'Remise des clés de chantier', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'action', crNo: 11, company: 'BUCZEK', dueDate: '2026-04-30' },
  { id: 'gr-10', number: 'R-011', lotId: 'LOT02', logementId: '', description: 'Fin de travaux', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: undefined, company: 'BUCZEK', meetingDate: '2026-09-08' },
  { id: 'gr-11', number: 'R-012', lotId: 'LOT03', logementId: '', description: 'Retard sur les travaux de finition peinture', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'action', crNo: 13, company: 'PFC', dueDate: '2026-06-16' },
  { id: 'gr-12', number: 'R-013', lotId: 'LOT03', logementId: '', description: 'Le local commercial situé au RDC', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'action', crNo: 13, company: 'PFC', dueDate: '2026-06-16' },
  { id: 'gr-13', number: 'R-014', lotId: 'LOT03', logementId: '', description: 'Nettoyage de zone de chantier', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'observation', crNo: 15, company: 'PFC' },
  { id: 'gr-14', number: 'R-015', lotId: 'LOT03', logementId: '', description: 'Fin de travaux', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: undefined, company: 'PFC', meetingDate: '2026-09-08' },
  { id: 'gr-15', number: 'R-016', lotId: 'LOT04', logementId: '', description: 'Pose des persiennes à réaliser', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'observation', crNo: 10, company: 'SRK' },
  { id: 'gr-16', number: 'R-017', lotId: 'LOT04', logementId: '', description: 'Retard sur la finition des bavettes', priority: 'medium', status: 'obsolete', createdAt: '2026-09-08', kind: 'observation', crNo: 13, company: 'SRK' },
  { id: 'gr-17', number: 'R-018', lotId: 'LOT04', logementId: '', description: 'Finition des bavettes réalisée', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'observation', crNo: 15, company: 'SRK' },
  { id: 'gr-18', number: 'R-019', lotId: 'LOT04', logementId: '', description: 'Fin de travaux', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: undefined, company: 'SRK', meetingDate: '2026-09-08' },
  { id: 'gr-19', number: 'R-020', lotId: 'LOT05', logementId: '', description: 'Les clés d\'accès au chantier seront disponibles au siège de Plurial Novilia', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'action', crNo: 2, company: 'MOA', dueDate: '2025-11-28' },
  { id: 'gr-20', number: 'R-021', lotId: 'LOT05', logementId: '', description: 'Transmission du planning prévisionnel et de delais de commande de matériaux', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'action', crNo: 2, company: 'SMP', dueDate: '2025-12-15' },
  { id: 'gr-21', number: 'R-022', lotId: 'LOT05', logementId: '', description: 'Sujet de cloisons dégradés suite à la démolition', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 10, company: 'SMP' },
  { id: 'gr-22', number: 'R-023', lotId: 'LOT05', logementId: '', description: 'Accord pour démol et reprise du doublage Logement 5 RDC batiment C', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'observation', crNo: 13, company: 'SMP' },
  { id: 'gr-23', number: 'R-024', lotId: 'LOT05', logementId: '', description: 'Doublage entrée très endommagé par l\'humidité, avenant pour curage', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 15, company: 'SMP', meetingDate: '2026-09-08' },
  { id: 'gr-24', number: 'R-025', lotId: 'LOT05', logementId: '', description: 'Logement B R+1 - Demande devis pour réamenagement et agrandissement du logement', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 16, company: 'SMP', meetingDate: '2026-09-08' },
  { id: 'gr-25', number: 'R-026', lotId: 'LOT05', logementId: '', description: 'Aucun avancement début septembre', priority: 'high', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 17, company: 'SMP', reminder: true },
  { id: 'gr-26', number: 'R-027', lotId: 'LOT06', logementId: '', description: 'Les clés d\'accès au chantier ont été remis à l\'entreprise', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'observation', crNo: 0, company: 'MOA' },
  { id: 'gr-27', number: 'R-028', lotId: 'LOT06', logementId: '', description: 'Les clés d\'accès au chantier seront disponibles au siège de Plurial Novilia (Non récupérés)', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'action', crNo: 2, company: 'MOA', dueDate: '2025-11-28' },
  { id: 'gr-28', number: 'R-029', lotId: 'LOT06', logementId: '', description: 'Disjoncteur 10 A à prévoir sur le tableau Elec pour le désenfumage', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 4, company: 'SOVECLIM' },
  { id: 'gr-29', number: 'R-030', lotId: 'LOT06', logementId: '', description: 'Passage fourreau pour raccordement ENEDIS', priority: 'high', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 4, company: 'SOVECLIM', reminder: true },
  { id: 'gr-30', number: 'R-031', lotId: 'LOT06', logementId: '', description: 'Déplacement des disjoncteurs à l\'interieurs des logements en cours', priority: 'high', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 12, company: 'SOVECLIM', reminder: true },
  { id: 'gr-31', number: 'R-032', lotId: 'LOT06', logementId: '', description: 'Retard sur l\'avancement', priority: 'high', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 13, company: 'SOVECLIM', reminder: true },
  { id: 'gr-32', number: 'R-033', lotId: 'LOT06', logementId: '', description: 'Priorité sur la finalisation du bâtiment C', priority: 'high', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 16, company: 'SOVECLIM', reminder: true },
  { id: 'gr-33', number: 'R-034', lotId: 'LOT06', logementId: '', description: 'Pas d\'avancement fin aout debut septembre, il impératif de mettre les effectifs necessaires pour avancer', priority: 'high', status: 'open', createdAt: '2026-09-08', kind: 'action', crNo: 17, company: 'SOVECLIM', dueDate: '2026-09-15', reminder: true },
  { id: 'gr-34', number: 'R-035', lotId: 'LOT07', logementId: '', description: 'Retard Travaux', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'observation', crNo: 11, company: 'SORETH.' },
  { id: 'gr-35', number: 'R-036', lotId: 'LOT07', logementId: '', description: 'Interventions au batiment C à démarrer en urgence', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 13, company: 'SORETH.', meetingDate: '2026-09-08' },
  { id: 'gr-36', number: 'R-037', lotId: 'LOT07', logementId: '', description: 'Retard Travaux', priority: 'high', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 15, company: 'SORETH.', reminder: true },
  { id: 'gr-37', number: 'R-038', lotId: 'LOT07', logementId: '', description: 'Pose de bacs de douches reportée pour fin aout', priority: 'medium', status: 'resolved', createdAt: '2026-09-08', kind: 'action', crNo: 16, company: 'SORETH.', dueDate: '2026-08-25' },
  { id: 'gr-38', number: 'R-039', lotId: 'LOT07', logementId: '', description: 'Pose des compteurs individuels annulée - Malus à prévoir sur la prochaine situation', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 16, company: 'SORETH.' },
  { id: 'gr-39', number: 'R-040', lotId: 'LOT07', logementId: '', description: 'Pose de bacs de douches demarrée - Manque la pose du bac Bat C RDC et R+1', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'action', crNo: 16, company: 'SORETH.', dueDate: '2026-09-15' },
  { id: 'gr-40', number: 'R-041', lotId: 'LOT08', logementId: '', description: 'Démarrage de travaux de dépose papier-peints et peinture des 2 logements au batiment A', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 12, company: 'SMP', meetingDate: '2026-09-08' },
  { id: 'gr-41', number: 'R-042', lotId: 'LOT08', logementId: '', description: 'Mise en place Claustra local OM', priority: 'high', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 13, company: 'SMP', reminder: true },
  { id: 'gr-42', number: 'R-043', lotId: 'LOT08', logementId: '', description: 'Peinture partie commune en cours', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 15, company: 'SMP', meetingDate: '2026-09-08' },
  { id: 'gr-43', number: 'R-044', lotId: 'LOT08', logementId: '', description: 'Devis TS peinture étages batiment C', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 16, company: 'SMP', meetingDate: '2026-09-08' },
  { id: 'gr-44', number: 'R-045', lotId: 'LOT08', logementId: '', description: 'Lenteur sur les travaux d\'embeillissements.', priority: 'medium', status: 'open', createdAt: '2026-09-08', kind: 'observation', crNo: 17, company: 'SMP', meetingDate: '2026-09-08' },
]

/** Toutes les tranches de l'opération Gambetta, prêtes pour seedProjectData(). */
export function buildGambettaSeed(): ProjectSeed {
  return { gantt, lotsConfig, marches, reserves }
}
