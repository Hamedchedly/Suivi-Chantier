import { Rfi, Visa, Doc } from '../lib/admin'

export const DEFAULT_RFIS: Rfi[] = [
  { id: 'di1', ref: 'DI-001', subject: 'Nature du support mur R+2', lotId: 'L05', question: 'Le support existant permet-il la pose des menuiseries prévues ?', answer: 'Oui, après ragréage. Voir plan PLA-12.', status: 'answered', createdAt: '2026-08-25' },
  { id: 'di2', ref: 'DI-002', subject: 'Emplacement tableau électrique', lotId: 'L06', question: 'Confirmer l\'emplacement du TGBT au sous-sol.', status: 'open', createdAt: '2026-09-03' },
  { id: 'di3', ref: 'DI-003', subject: 'Débit CVC logement B-201', lotId: 'L07', question: 'Le débit spécifié est-il compatible avec la CTA existante ?', status: 'open', createdAt: '2026-09-07' },
]

export const DEFAULT_VISAS: Visa[] = [
  { id: 'v1', docName: 'Plan de calepinage menuiseries', index: 'B', lotId: 'L05', status: 'approved', date: '2026-08-28' },
  { id: 'v2', docName: 'Schéma unifilaire électrique', index: 'A', lotId: 'L06', status: 'approved_reserves', date: '2026-09-01' },
  { id: 'v3', docName: 'Note de calcul CVC', index: 'A', lotId: 'L07', status: 'pending', date: '2026-09-06' },
  { id: 'v4', docName: 'Nuancier peinture', index: 'A', lotId: 'L08', status: 'pending', date: '2026-09-08' },
]

export const DEFAULT_DOCS: Doc[] = [
  { id: 'd1', name: 'CCTP Lot 05 Menuiseries', category: 'Marché', version: 'V2', date: '2026-07-10', sizeKb: 1840 },
  { id: 'd2', name: 'Planning général', category: 'Planning', version: 'V5', date: '2026-09-09', sizeKb: 420 },
  { id: 'd3', name: 'PV réception support', category: 'Terrain', version: 'V1', date: '2026-08-20', sizeKb: 260 },
  { id: 'd4', name: 'DOE Lot 06 (provisoire)', category: 'DOE', version: 'V1', date: '2026-09-05', sizeKb: 3120 },
]
