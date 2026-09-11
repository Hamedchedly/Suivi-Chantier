import { Home, BarChart3, FolderOpen, Bell, Settings, ClipboardList, Euro, FileText, ClipboardCheck } from 'lucide-react'

export type Page = 'home' | 'gantt' | 'visite' | 'cr' | 'finances' | 'config' | 'rapports' | 'alertes'

export const GESTION_PAGES: Page[] = ['cr', 'finances', 'rapports']

// Primary navigation entries (shared by the desktop sidebar and the mobile bottom bar).
export const PRIMARY_NAV = [
  { id: 'home' as Page, label: 'Accueil', icon: Home },
  { id: 'gantt' as Page, label: 'Planning', icon: BarChart3 },
  { id: 'visite' as Page, label: 'Visite', icon: ClipboardCheck },
  { id: 'gestion' as const, label: 'Gestion', icon: FolderOpen }, // opens the Gestion sheet
  { id: 'alertes' as Page, label: 'Alertes', icon: Bell },
  { id: 'config' as Page, label: 'Config', icon: Settings },
]

export const GESTION_ITEMS = [
  { id: 'cr' as Page, label: 'Comptes rendus', desc: 'Visites & réserves', icon: ClipboardList },
  { id: 'finances' as Page, label: 'Finances', desc: 'Marchés, avenants, situations', icon: Euro },
  { id: 'rapports' as Page, label: 'Rapports & documents', desc: 'CR auto, RFI, visas, GED', icon: FileText },
]
