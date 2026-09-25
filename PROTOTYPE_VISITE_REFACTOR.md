# Refonte UX/UI du Module Visite Chantier

## Prototype Interactif
Un prototype complet et fonctionnel est disponible à: https://claude.ai/artifact/ETjm9MwLFK6KSLc8oqNvSs

Le prototype démontre:
- ✅ Interface mobile-first avec navigation intuitive
- ✅ Écran d'accueil avec progression visuelle
- ✅ Liste des logements avec filtres rapides (Tous/À faire/À revoir/Terminés)
- ✅ Recherche par numéro de logement
- ✅ Carte de logement avec informations et état
- ✅ Écran de contrôle d'un lot
- ✅ Modification rapide de l'avancement (0% 25% 50% 75% 100%)
- ✅ État du contrôle (Contrôlé/À revoir/Bloqué/N.A.)
- ✅ Affichage de la dernière visite et remarques antérieures
- ✅ Ajout rapide d'observations via bottom sheet
- ✅ Ajout rapide de photos
- ✅ Navigation vers le logement suivant
- ✅ Résumé de visite avec statistiques
- ✅ Compte rendu avec modifications en ligne
- ✅ Gantt dans le CR
- ✅ Responsive desktop avec sidebar (768px+) et grid multi-colonnes

## Composants Créés

### 1. VisiteHome.tsx
- Écran d'accueil avec visite en cours
- Liste des visites récentes
- Bouton "Nouvelle visite"
- Progression visuelle pour visite active

### 2. VisiteZonesList.tsx
- Grille de cartes de logements
- Filtres rapides (tous/à faire/à revoir/terminés)
- Recherche en temps réel
- Responsive grid (1 col mobile, 2+ col desktop)
- Affichage de l'avancement et de l'état

### 3. VisiteSessionView.tsx
- Vue d'accueil de la session (dashboard)
- Carte de progression prominente
- Grille de statistiques (terminées/à revoir/bloquées/restantes)
- Liste des zones avec filtres
- Barre inférieure avec actions rapides (+Obs, 📷 Photo, Terminer)

### 4. VisiteContextHeader.tsx
- Header réutilisable avec contexte
- Breadcrumbs optionnels
- Bouton retour
- Actions optionnelles

### 5. VisiteSummaryBar.tsx
- Barre de résumé rapide (progression, observations, photos, à revoir)
- Lien vers le résumé complet

## Plan d'Implémentation Progressif

### Phase 1: Intégration des nouveaux composants
- [ ] Importer les nouveaux composants dans Visite.tsx
- [ ] Remplacer la vue 'list' par VisiteHome
- [ ] Remplacer la vue 'session' par combinaison VisiteSessionView + VisiteZonesList
- [ ] Ajouter la barre de résumé en haut de la vue session
- [ ] Tester la navigation globale

### Phase 2: Amélioration des écrans existants
- [ ] Améliorer ZoneControl.tsx avec le nouveau header
- [ ] Améliorer LotControl.tsx avec les nouveaux contrôles d'avancement
- [ ] Ajouter les actions rapides (Obs, Photo) en bottom bar

### Phase 3: Responsive desktop
- [ ] Adapter le layout pour 768px+ (sidebar + contenu)
- [ ] Grid responsive pour zones (2-4 colonnes selon l'écran)
- [ ] Masquer bottom bar sur desktop

### Phase 4: Polish final
- [ ] Animations et transitions
- [ ] Accessibility (ARIA labels, focus states)
- [ ] Tests sur appareils réels
- [ ] Optimisation de la performance

## Principes UX Respectés

✅ **Règle 1 - Une action principale par écran**: Chaque écran a un objectif clair
✅ **Règle 2 - Accessible au pouce**: Boutons grands, zones tactiles généreuses
✅ **Règle 3 - Contexte toujours visible**: Header montre localisation (Bâtiment > Logement > Lot)
✅ **Règle 4 - Pas de saisie double**: Préremplissage automatique des champs
✅ **Règle 5 - L'app guide la visite**: Proposition du logement suivant automatiquement

## Logique Métier Conservée

- ✅ Gestion des visites (en_cours, terminée, cr_pret, diffuse, verrouille)
- ✅ Gestion des zones et lots
- ✅ Avancement physique (0-100%)
- ✅ État du contrôle (not_started, in_progress, done, to_review, blocked)
- ✅ Observations et actions (PA/PI)
- ✅ Photos et annotations
- ✅ Synchronisation et historique
- ✅ Génération de CR avec Gantt
- ✅ Carrés de vigilance (carried points)

## Points Critiques à Préserver

1. **Pas de modification du modèle de données** - Les types Visit, VisitZone, etc. restent identiques
2. **Auto-save**: Chaque changement doit être sauvegardé immédiatement
3. **Historique**: Les observations et actions doivent rester reliées au contexte
4. **Gantt partagé**: Le Gantt du CR utilise la même source de données que le Gantt principal
5. **Performance**: Pas de rerendu inutile de la liste lors de la modification d'une zone

## Prochaines Étapes

1. Intégrer VisiteHome dans la vue 'list' du Visite.tsx
2. Créer une nouvelle vue 'zone_list' pour afficher VisiteZonesList
3. Créer une nouvelle vue 'session_summary' pour afficher VisiteSessionView
4. Adapter progressivement ZoneControl et LotControl
5. Tester le flux complet sur mobile et desktop
