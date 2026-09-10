import { Marche, Avenant, Situation } from '../lib/finance'

export const DEFAULT_MARCHES: Marche[] = [
  { id: 'M05', lotId: 'L05', company: 'SMP Aménagement', amountHT: 120000 },
  { id: 'M06', lotId: 'L06', company: 'Soveclim Services', amountHT: 95000 },
  { id: 'M07', lotId: 'L07', company: 'Soveclim Services', amountHT: 180000 },
  { id: 'M08', lotId: 'L08', company: 'Soretherm', amountHT: 75000 },
]

export const DEFAULT_AVENANTS: Avenant[] = [
  { id: 'AV1', marcheId: 'M07', label: 'Modification réseau CVC RDC', amountHT: 15000, status: 'approved', date: '2026-08-20' },
  { id: 'AV2', marcheId: 'M05', label: 'Renfort isolation combles', amountHT: 5000, status: 'proposed', date: '2026-09-05' },
  { id: 'AV3', marcheId: 'M08', label: 'Moins-value peinture façade', amountHT: -3000, status: 'approved', date: '2026-09-02' },
]

export const DEFAULT_SITUATIONS: Situation[] = [
  { id: 'S05-1', marcheId: 'M05', number: 1, date: '2026-07-31', amountHT: 40000, status: 'paid' },
  { id: 'S05-2', marcheId: 'M05', number: 2, date: '2026-08-31', amountHT: 55000, status: 'paid' },
  { id: 'S06-1', marcheId: 'M06', number: 1, date: '2026-08-31', amountHT: 30000, status: 'paid' },
  { id: 'S07-1', marcheId: 'M07', number: 1, date: '2026-07-31', amountHT: 60000, status: 'paid' },
  { id: 'S07-2', marcheId: 'M07', number: 2, date: '2026-08-31', amountHT: 40000, status: 'pending' },
  { id: 'S08-1', marcheId: 'M08', number: 1, date: '2026-08-31', amountHT: 20000, status: 'pending' },
]
