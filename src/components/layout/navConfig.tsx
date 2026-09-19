import {
  Home, BarChart3, Bell, Settings, ClipboardList, Euro, FileText,
  ClipboardCheck, Building2, Network, Files, MoreHorizontal,
} from 'lucide-react'

export type Page =
  | 'home' | 'gantt' | 'visite' | 'cr' | 'entreprises' | 'finances'
  | 'config' | 'rapports' | 'documents' | 'alertes' | 'comptes' | 'projets' | 'moncompte'
  | 'structure' | 'demandes'

/** Pages atteintes depuis la feuille « Plus » — l'onglet reste alors actif. */
export const GESTION_PAGES: Page[] = ['cr', 'entreprises', 'finances', 'rapports', 'documents', 'structure', 'config']

/** Pages de l'espace utilisateur, accessibles par l'icône de compte en haut à droite. */
export const ACCOUNT_PAGES: Page[] = ['projets', 'moncompte', 'comptes', 'demandes']

/**
 * Navigation principale — exactement 5 entrées, autant que de colonnes dans la
 * barre du bas (.bot-nav). Tout ce qui relève du compte est passé dans le menu
 * en haut à droite ; le reste (documents, finances, administration…) est
 * regroupé dans la feuille « Plus ».
 */
export const PRIMARY_NAV = [
  { id: 'home' as Page, label: 'Accueil', icon: Home },
  { id: 'gantt' as Page, label: 'Planning', icon: BarChart3 },
  { id: 'visite' as Page, label: 'Visite', icon: ClipboardCheck },
  { id: 'gestion' as const, label: 'Plus', icon: MoreHorizontal }, // opens the "Plus" sheet
  { id: 'alertes' as Page, label: 'Alertes', icon: Bell },
]

/** Contenu de la feuille « Plus », regroupé par thème plutôt qu'en liste plate. */
export interface GestionItem { id: Page; label: string; desc: string; icon: typeof Home }
export interface GestionGroup { title: string; items: GestionItem[] }

export const GESTION_GROUPS: GestionGroup[] = [
  {
    title: 'Chantier',
    items: [
      { id: 'entreprises', label: 'Entreprises', desc: 'Lots, actions, engagements et historique', icon: Building2 },
    ],
  },
  {
    title: 'Documents',
    items: [
      { id: 'cr', label: 'Comptes rendus', desc: 'Réserves de chantier & relevés de réunions', icon: ClipboardList },
      { id: 'rapports', label: 'Rapports', desc: 'CR de visite envoyés et brouillons', icon: FileText },
      { id: 'documents', label: 'RFI, visas & GED', desc: 'Demandes d’information, visas de plans, documents', icon: Files },
    ],
  },
  {
    title: 'Finances',
    items: [
      { id: 'finances', label: 'Finances', desc: 'Marchés, avenants, situations', icon: Euro },
    ],
  },
  {
    title: 'Administration',
    items: [
      { id: 'structure', label: 'Bâtiments & zones', desc: 'Bâtiments, niveaux, logements et tâches rattachées', icon: Network },
      { id: 'config', label: 'Configuration', desc: 'Lots, dates contractuelles, congés et paramètres', icon: Settings },
    ],
  },
]

/** Liste à plat, pour les usages qui n'ont pas besoin des groupes (ex. filtrage par droits). */
export const GESTION_ITEMS: GestionItem[] = GESTION_GROUPS.flatMap(g => g.items)
