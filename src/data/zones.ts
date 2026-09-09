export interface Logement {
  id: string
  label: string
}

export interface Zone {
  id: string
  label: string
  logements: Logement[]
}

export const ZONES: Zone[] = [
  {
    id: 'BAT-A',
    label: 'Bâtiment A',
    logements: [
      { id: 'A-101', label: 'Logt A-101' },
      { id: 'A-102', label: 'Logt A-102' },
    ],
  },
  {
    id: 'BAT-B',
    label: 'Bâtiment B',
    logements: [
      { id: 'B-201', label: 'Logt B-201' },
      { id: 'B-202', label: 'Logt B-202' },
    ],
  },
  {
    id: 'COMMUNS',
    label: 'Communs',
    logements: [{ id: 'COM', label: 'Parties communes' }],
  },
]

// Flat lookup: logement id -> its label and zone
export const LOGEMENTS = ZONES.flatMap(z =>
  z.logements.map(l => ({ ...l, zoneId: z.id, zoneLabel: z.label })),
)
