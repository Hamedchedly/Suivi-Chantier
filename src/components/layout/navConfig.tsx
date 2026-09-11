import { Home, BarChart3, FolderOpen, Bell, Settings, ClipboardList, Euro, FileText, ClipboardCheck, Building2 } from 'lucide-react'

export type Page = 'home' | 'gantt' | 'visite' | 'cr' | 'entreprises' | 'finances' | 'config' | 'rapports' | 'alertes'

export const GESTION_PAGES: Page[] = ['cr', 'entreprises', 'finances', 'rapports']

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
  { id: 'cr' as Page, label: 'Réserves & réunions', desc: 'Réserves de chantier & relevés de réunions', icon: ClipboardList },
  { id: 'entreprises' as Page, label: 'Entreprises', desc: 'Lots, actions, engagements et historique', icon: Building2 },
  { id: 'finances' as Page, label: 'Finances', desc: 'Marchés, avenants, situations', icon: Euro },
  { id: 'rapports' as Page, label: 'Rapports & documents', desc: 'CR de visite, RFI, visas, GED', icon: FileText },
]
