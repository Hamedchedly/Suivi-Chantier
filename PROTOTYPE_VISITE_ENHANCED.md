# Prototype Visite Chantier — Version Améliorée

**Date**: 25 septembre 2026  
**Status**: ✅ Prototype avancé complet avec contrôle global des tâches  
**Lien**: https://claude.ai/artifact/ETjm9MwLFK6KSLc8oqNvSs

## 🎯 Améliorations Principales

### 1. Design Graphique Amélioré

#### Palette de Couleurs Alignée avec la Plateforme
- `--navy: #0f1628` - Couleur primaire pour le texte et la navigation
- `--blue: #0284c7` - Actions principales (héritée du système Suivi-Chantier)
- `--green: #16a34a` - Terminé/Succès
- `--orange: #f59e0b` - À revoir/Attention
- `--red: #dc2626` - Bloqué/Erreur
- `--muted: #94a3b8` - Texte secondaire

#### Badges Sémantiques
- `.badge-info` - Bleu ciel (#e0f2fe)
- `.badge-done` - Vert clair (#dcfce7)
- `.badge-warning` - Orange clair (#fef3c7)
- `.badge-error` - Rouge clair (#fee2e2)
- `.badge-gray` - Gris clair (#f1f5f9)

#### Typographie Hiérarchisée
- **H1**: 28px, weight 800, letter-spacing -0.02em
- **H2**: 20px, weight 700
- **H3**: 14px, weight 700
- **Labels**: 11-13px, uppercase, semi-bold

#### Spacing Cohérent
- Cards: padding 14px, margin-bottom 12px
- Sections: margin-bottom 20px
- Progress bar: hauteur 6px, border-radius 3px

### 2. Nouvelle Fonctionnalité: Contrôle Global des Tâches

**Écran dédié** accessibles depuis l'accueil: "Tâches globales"

#### Visualisation Hiérarchique Complète

```
Logement A205 — Bâtiment A, R+2
├── Lot 04 — Menuiseries ext. (80%)
│   ├── Châssis fenêtres [Slider 0-100]
│   └── Joints d'étanchéité [Slider 0-100]
├── Lot 05 — Menuiseries int. (40%)
│   ├── Portes intérieures [Slider 0-100]
│   ├── Porte séjour [Slider 0-100]
│   └── Porte cuisine [Slider 0-100]
└── Lot 06 — Électricité (60%)
    ├── Tableau électrique [Slider 0-100]
    ├── Prises et interrupteurs [Slider 0-100]
    ├── Prises séjour [Slider 0-100]
    ├── Prises cuisine [Slider 0-100]
    └── Prises chambre [Slider 0-100]
```

#### Contrôles Intuitifs
- **Sliders interactifs** pour ajuster 0-100% directement
- Visuels en **temps réel** pour chaque niveau
- Groupement par lot visible
- Couleurs de hiérarchie: bleue → cyan → turquoise → verte

#### Avantages pour l'Utilisateur
✅ **Pas besoin d'entrer chaque logement** pour ajuster les tâches  
✅ **Vue d'ensemble complète** de la progression  
✅ **Ajustements rapides** avec les sliders  
✅ **Enregistrement rapide** en un clic  
✅ **Idéal pour le rattrapage** ou les corrections groupées  

### 3. Hiérarchie Complète Visualisée

#### Niveaux de Visualisation

**Niveau 0: Logement**
- Affiche le contexte complet: Bâtiment, Étage, Dimensions
- Progression générale prominente
- Accès à tous les lots

**Niveau 1: Lot**
- Compagnie responsable
- Progression du lot
- Liste des tâches

**Niveau 2: Tâche**
- Identifiant clair
- Avancement en %
- État (OK/À revoir/Bloqué)

**Niveau 3: Sous-tâche**
- Héritée de la tâche parent
- Progression individuelle
- Sliders globaux disponibles

#### Codage Couleur Hiérarchique
```
.hierarchy-item.level-0 { border-left: 3px solid #0284c7; background: #e0f2fe; }
.hierarchy-item.level-1 { border-left: 3px solid #06b6d4; background: #e0f7fa; padding-left: 20px; }
.hierarchy-item.level-2 { border-left: 3px solid #14b8a6; background: #f0fdfa; padding-left: 32px; }
.hierarchy-item.level-3 { border-left: 3px solid #10b981; background: #f0fdf4; padding-left: 44px; }
```

### 4. Navigation Améliorée

#### Breadcrumbs Contextuels
Chaque page affiche la position complète:
```
Bâtiment A · R+2 · A205 · Lot 06 · Électricité
```

#### Back Navigation
- Boutons "retour" intuitifs avec icône ←
- Couleur bleue pour la visibilité
- Placement cohérent en haut à gauche

### 5. Responsive Design

#### Mobile (< 768px)
- Colonnes simples (260px min-width)
- Bottom bar fixe avec 3 actions
- Full-width cards
- Safe area pour notch/encoche

#### Tablet/Desktop (768px+)
- Colonnes multi (300px min-width)
- Bottom bar cachée
- Meilleur espacement
- Grid responsive

### 6. États Visuels

#### Progress Bars
- Hauteur 6px pour meilleure lisibilité
- Animation smooth 300ms
- Fond transparent avec alpha: 0.15
- Remplissage #0284c7

#### Boutons
- Padding 12-14px pour zones tactiles généreuses
- Border-radius 6-8px
- Transitions smooth 150ms
- États hover/active clairs

#### Sliders
- Thumb de 20px (facile à manipuler)
- Fond translucide
- Shadow subtil au survol
- Compatible multi-navigateurs

### 7. Écrans Disponibles

| Écran | Fonction | Navigation |
|-------|----------|-----------|
| **Accueil** | Vue générale, progression | Zones / Tâches / Résumé |
| **Zones** | Liste des logements, filtres | Logement détail |
| **Logement** | Vue logement, lots | Lot détail |
| **Lot** | Détail lot, tâches hiérarchiques | Retour logement |
| **Tâches globales** | 🆕 Sliders pour tous les lots | Enregistrer et retour |
| **Résumé** | Statistiques de visite | Finaliser |

## 🔄 Parcours Utilisateur Complets

### Scénario 1: Visite Complète
1. Accueil → Zones
2. Sélectionner logement
3. Contrôler chaque lot
4. Ajouter observations/photos
5. Résumé et CR

### Scénario 2: Rattrapage Rapide
1. Accueil → Tâches globales
2. Voir progression de tous les lots
3. Ajuster sliders au besoin
4. Enregistrer
5. Retour accueil

### Scénario 3: Corrections Groupées
1. Accueil → Tâches globales
2. Chercher tâches à revoir
3. Ajuster 10+ tâches rapidement
4. Sauvegarder tout d'un coup
5. Pas besoin d'entrer chaque logement

## 📊 Données Modélisées

### Structure Logement A205 (Exemple)
```json
{
  "logement": {
    "id": "A205",
    "building": "Bâtiment A",
    "floor": "R+2",
    "area": "62 m²",
    "type": "T3",
    "progress": 65,
    "lots": [
      {
        "id": "04",
        "name": "Menuiseries ext.",
        "company": "Parquet Habitat",
        "progress": 80,
        "tasks": [
          { "name": "Châssis fenêtres", "progress": 80 },
          { "name": "Joints d'étanchéité", "progress": 60 }
        ]
      },
      {
        "id": "05",
        "name": "Menuiseries int.",
        "company": "Parquet Habitat",
        "progress": 40,
        "tasks": [
          {
            "name": "Portes intérieures",
            "progress": 40,
            "subtasks": [
              { "name": "Porte séjour", "progress": 50 },
              { "name": "Porte cuisine", "progress": 30 }
            ]
          }
        ]
      },
      {
        "id": "06",
        "name": "Électricité",
        "company": "ETE Électro",
        "progress": 60,
        "tasks": [
          { "name": "Tableau électrique", "progress": 100 },
          {
            "name": "Prises et interrupteurs",
            "progress": 80,
            "subtasks": [
              { "name": "Prises séjour", "progress": 100 },
              { "name": "Prises cuisine", "progress": 100 },
              { "name": "Prises chambre", "progress": 60 }
            ]
          }
        ]
      }
    ]
  }
}
```

## 🎨 Inspirations du Système Existant

### Héritées de Suivi-Chantier
- Palette de couleurs (--navy, --blue, --green, etc.)
- Badge styles avec backgrounds transparents
- Spacing et sizing patterns
- Typography hierarchy
- Card design avec borders #e2e8f0
- Progress bar styling

### Améliorations Apportées
- Better visual hierarchy
- Clearer task organization
- Global slider controls
- Responsive grid system
- Better context preservation
- Improved mobile experience

## 🚀 Prochaines Étapes

### Phase 3: Intégration React
1. Convertir prototype HTML en composants React
2. Intégrer données réelles de VisitZone
3. Implémenter sliders avec state management
4. Ajouter modales pour observations/photos
5. Connecter à l'API de persistance

### Phase 4: Fonctionnalités Avancées
1. Synchronisation temps réel
2. Offline mode avec sync queue
3. Photos avec annotations
4. Historique des changements
5. Exports PDF

### Phase 5: Performance & Polish
1. Optimisation des rendus React
2. Lazy loading des images
3. Caching des données
4. Animations fluides
5. Tests sur appareils réels

## 📱 Tests Recommandés

- [ ] Prototype mobile sur iPhone SE/12
- [ ] Prototype tablet sur iPad
- [ ] Navigation avec une seule main
- [ ] Sliders avec tactile
- [ ] Bottom bar sur notch
- [ ] Performance avec 50+ logements

## 🔐 Sécurité

✅ Aucun endpoint externe  
✅ Données mockées uniquement  
✅ Prêt pour intégration API  
✅ HTTPS compatible  
✅ Dark mode ready (CSS variables)  

---

**Version**: 2.0 — Design System Aligned  
**Prototype URL**: https://claude.ai/artifact/ETjm9MwLFK6KSLc8oqNvSs  
**Status**: Production-ready UI reference  
