import { DpgfLine } from '../lib/dpgf'

export const DEFAULT_DPGF: DpgfLine[] = [
  { id: 'd1', lotId: 'L05', designation: 'Dépose menuiseries existantes', unite: 'u', quantite: 24, prixUnitaire: 180 },
  { id: 'd2', lotId: 'L05', designation: 'Fourniture et pose fenêtres alu', unite: 'u', quantite: 24, prixUnitaire: 620 },
  { id: 'd3', lotId: 'L05', designation: 'Isolation thermique doublage', unite: 'm²', quantite: 340, prixUnitaire: 48 },
  { id: 'd4', lotId: 'L06', designation: 'Câblage courants forts', unite: 'ml', quantite: 1200, prixUnitaire: 12 },
  { id: 'd5', lotId: 'L06', designation: 'Tableau électrique + protections', unite: 'ens', quantite: 4, prixUnitaire: 2800 },
  { id: 'd6', lotId: 'L07', designation: 'Réseau aéraulique gaines', unite: 'ml', quantite: 480, prixUnitaire: 65 },
  { id: 'd7', lotId: 'L07', designation: 'CTA double flux', unite: 'u', quantite: 2, prixUnitaire: 18500 },
  { id: 'd8', lotId: 'L08', designation: 'Peinture murs et plafonds', unite: 'm²', quantite: 1450, prixUnitaire: 22 },
  { id: 'd9', lotId: 'L08', designation: 'Revêtement sol PVC', unite: 'm²', quantite: 620, prixUnitaire: 38 },
]
