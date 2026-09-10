import { Meeting } from '../lib/meetings'

export const DEFAULT_MEETINGS: Meeting[] = [
  {
    id: 'RC-12',
    date: '2026-09-08',
    title: 'Réunion de chantier n°12',
    attendees: ['Jean Dupont (MOE)', 'Marie Martin (MOA)', 'Pierre Lécuyer (Soveclim)'],
    decisions: [
      { id: 'd1', text: 'Validation du calepinage menuiseries indice B' },
      { id: 'd2', text: 'Report de la pose CVC B-201 après reprise du support' },
    ],
    actions: [
      { id: 'a1', ref: 'A-001', text: 'Transmettre la note de calcul CVC mise à jour', assignee: 'Soveclim', dueDate: '2026-09-09', status: 'todo' },
      { id: 'a2', ref: 'A-002', text: 'Reprendre le support mur R+2 avant pose', assignee: 'SMP Aménagement', dueDate: '2026-09-15', status: 'todo' },
      { id: 'a3', ref: 'A-003', text: 'Diffuser le PV de réception support', assignee: 'MOE', dueDate: '2026-09-05', status: 'done' },
    ],
  },
  {
    id: 'RC-11',
    date: '2026-09-01',
    title: 'Réunion de chantier n°11',
    attendees: ['Jean Dupont (MOE)', 'Anne Legrand (Soretherm)'],
    decisions: [{ id: 'd3', text: 'Nuancier peinture retenu : gamme claire' }],
    actions: [
      { id: 'a4', ref: 'A-004', text: 'Commander les revêtements de sol', assignee: 'Soretherm', dueDate: '2026-09-12', status: 'todo' },
    ],
  },
]
