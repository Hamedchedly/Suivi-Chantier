import {
  Home, BarChart3, FolderOpen, Bell, Settings, ClipboardList, Euro, FileText,
  ClipboardCheck, Building2, Network,
} from 'lucide-react'

export type Page =
  | 'home' | 'gantt' | 'visite' | 'cr' | 'entreprises' | 'finances'
  | 'config' | 'rapports' | 'alertes' | 'comptes' | 'projets' | 'moncompte'
  | 'structure'

/** Pages atteintes depuis la feuille « Gestion » — l'onglet reste alors actif. */
export const GESTION_PAGES: Page[] = ['cr', 'entreprises', 'finances', 'rapports', 'structure', 'config']

/** Pages de l'espace utilisateur, accessibles par l'icône de compte en haut à droite. */
export const ACCOUNT_PAGES: Page[] = ['projets', 'moncompte', 'comptes']

/**
 * Navigation principale — exactement 5 entrées, autant que de colonnes dans la
 * barre du bas (.bot-nav). Tout ce qui relève du compte est passé dans le menu
 * en haut à droite ; la configuration du projet est passée dans « Gestion ».
 */
export const PRIMARY_NAV = [
  { id: 'home' as Page, label: 'Accueil', icon: Home },
  { id: 'gantt' as Page, label: 'Planning', icon: BarChart3 },
  { id: 'visite' as Page, label: 'Visite', icon: ClipboardCheck },
  { id: 'gestion' as const, label: 'Gestion', icon: FolderOpen }, // opens the Gestion sheet
  { id: 'alertes' as Page, label: 'Alertes', icon: Bell },
]

/** Contenu de la feuille « Gestion », du suivi courant vers le paramétrage. */
export const GESTION_ITEMS = [
  { id: 'cr' as Page, label: 'Réserves & réunions', desc: 'Réserves de chantier & relevés de réunions', icon: ClipboardList },
  { id: 'entreprises' as Page, label: 'Entreprises', desc: 'Lots, actions, engagements et historique', icon: Building2 },
  { id: 'finances' as Page, label: 'Finances', desc: 'Marchés, avenants, situations', icon: Euro },
  { id: 'rapports' as Page, label: 'Rapports & documents', desc: 'CR de visite, RFI, visas, GED', icon: FileText },
  { id: 'structure' as Page, label: 'Bâtiments & zones', desc: 'Bâtiments, niveaux, logements et tâches rattachées', icon: Network },
  { id: 'config' as Page, label: 'Configuration', desc: 'Lots, dates contractuelles, congés et paramètres', icon: Settings },
]
