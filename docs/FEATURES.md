# Suivi-Chantier — Carte des fonctionnalités

> **Usage :** Ce fichier est le point d'entrée pour tout sprint d'amélioration.
> Chaque ligne de tableau pointe vers les fichiers exacts à lire/modifier.
> Mise à jour systématique à chaque nouvelle fonctionnalité.

---

## 1. Architecture générale

| Couche | Rôle | Fichiers clés |
|--------|------|---------------|
| **Routing** | Navigation URL-based (/, /planning, /visite, /cr…) synced avec état React | `src/App.tsx` (PAGE_ROUTES, setUrlForPage, getPageFromUrl) |
| **Persistence** | Unique frontière de lecture/écriture (localStorage aujourd'hui, Supabase demain) | `src/lib/repo.ts` |
| **Navigation** | Stack de vues `View[]` avec push/pop/swap — contrôlée par URL/état | `src/App.tsx`, `src/components/layout/navConfig.tsx` |
| **Shell** | Barre du bas, topbar, feuille Gestion, menu compte | `src/components/layout/AppShell.tsx`, `Topbar.tsx`, `GestionSheet.tsx`, `Navigation.tsx`, `SideNav.tsx` |
| **Auth** | Comptes locaux + rôles (superadmin, chef de projet, entreprise…) | `src/lib/auth.ts`, `src/lib/supabaseAuth.ts` |
| **Sync** | Write-through Supabase (optionnel, nécessite auth) | `src/lib/sync.ts`, `src/lib/supabase.ts` |
| **Données démo** | Opération fictive « Les Tilleuls » pour onboarding | `src/lib/demoData.ts` |
| **Types globaux** | Type `GanttTask` avec 4 couches de dates | `src/types/gantt.ts` |

**Cloisonnement multi-projet :** toutes les clés localStorage autres que GLOBAL sont préfixées `<base>::<projectId>`. Changer de projet = changer de jeu de données complet.

**Routing et historique :** L'URL change avec la navigation ; le bouton retour du navigateur fonctionne nativement. Les routes sont :
- `/` → home (accueil)
- `/planning` → gantt (planning)
- `/visite` → visite (visites & réunions)
- `/cr` → cr (réserves & CR)
- `/entreprises`, `/finances`, `/rapports`, `/alertes`, `/structure`, `/config`, `/comptes`, `/demandes`, `/projets`, `/moncompte`

---

## 2. Module Planning (Gantt)

| Fonctionnalité | Description | Composants | Lib / Logic |
|----------------|-------------|------------|-------------|
| **Tableau Gantt** | Barres de planification sur axe temporel, 4 couches (contractuel/plannifié/réel/prévision), liaisons | `GanttTable.tsx` | `src/types/gantt.ts`, `src/lib/schedule.ts` |
| **Détail de tâche** | Modal date/avancement, édition `actual_end` historique | `TaskDetail.tsx` | `src/types/gantt.ts` |
| **Matrice logements** | Vue damier bâtiment × lot pour l'avancement par zone | `LogementMatrix.tsx` | `src/lib/units.ts` |
| **Regroupements** | Par lot / Par logement (zones) / Chronologique | `Gantt.tsx` (buildTree) | `src/lib/units.ts`, `src/lib/schedule.ts` |
| **Lots expandables** | Cliquer sur un lot déplie/replie les tâches inline (pas de modal) | `GanttTable.tsx` (onToggleExpanded) | — |
| **Bouton ⓘ** | Ouvre le détail d'un lot (lot row) sans dérouler | `GanttTable.tsx` | — |
| **Mode édition** | Modifier/Confirmer/Annuler — readOnly par défaut, snapshot restauré sur Annuler | `Gantt.tsx` (editMode, snapshot) | — |
| **Ajout de tâche** | Bouton « + » toolbar → formulaire (lot, titre, début, durée) | `Gantt.tsx` (AddTaskForm) | `src/lib/planning.ts` (createTask) |
| **CPM / chemin critique** | Calcul des marges et chemin critique depuis le réseau de dépendances | `Gantt.tsx` | `src/lib/cpm.ts` |
| **Auto-planification** | Décale automatiquement les tâches liées après un déplacement | `Gantt.tsx` (handleTaskUpdate) | `src/lib/calendar.ts`, `src/lib/schedule.ts` |
| **Prévision (auto-réplanif)** | Calcul de prévisions sans modifier le planning, puis Appliquer/Conserver/Annuler | `Gantt.tsx` (ForecastPanel) | `src/lib/forecast.ts` |
| **Contractuel (baseline)** | Toggle affichage du planning de référence (gris) | `Gantt.tsx`, `GanttTable.tsx` (showBaseline) | `src/lib/planningHistory.ts` |
| **Analyse des retards** | Panneau détail des retards par lot et par tâche | `Gantt.tsx` (DelayPanel) | `src/lib/schedule.ts` (lateTasks) |
| **Mode ÉCARTS** | Affichage détaillé des écarts : Δ start, Δ end, jours ; couleur-codé (vert/orange/rouge) | `Gantt.tsx` (showEcarts button), `GanttTable.tsx` (calculateEcarts) | `src/components/gantt/GanttTable.tsx` |
| **Verrouiller contractuel** | Figer les dates plannifiées actuelles comme baseline immutable | `Gantt.tsx` (lockBaseline button) | `src/lib/forecast.ts` (lockBaseline) |
| **Méthode de calcul prévision** | Sélection : Rythme réel / Durée contractuelle / Manuel | `TaskDetail.tsx` (forecast_method select) | `src/types/gantt.ts` |
| **Config planning** | Configuration de la durée des lots, jalons, congés | `PlanningConfig.tsx` | `src/lib/repo.ts` (getHolidays) |

---

## 3. Module Visite

La visite est une **session de contrôle de terrain**. Elle passe par plusieurs vues empilées sur un stack interne.

| Fonctionnalité | Description | Vue/Composant | Lib / Logic |
|----------------|-------------|---------------|-------------|
| **Liste des sessions** | Toutes les sessions (visites + réunions) triées ; statut coloré | `Visite.tsx` (vue `'list'`) | `src/lib/visits.ts` |
| **Création de session** | Formulaire : type, date, intervenants, lots sélectionnés | `Visite.tsx` (vue `'new'`) | `src/lib/visits.ts` |
| **Session terrain (zones)** | Contrôle zone par zone : état, avancement par tâche, observations, photos | `ZoneControl.tsx` | `src/lib/visits.ts`, `src/lib/progress.ts` |
| **Masquage lots terminés** | En mode session, masquer les zones/lots complètement terminés ; visible dans "tous les lots" | `Visite.tsx` (session rendering), `visits.ts` (buildZonesFromPlanning) | `src/lib/visits.ts` |
| **Barres d'avancement par zone** | Deux barres visuelles (travaux bleu, contrôle vert) affichant les % pour chaque logement | `Visite.tsx` (zone row rendering) | — |
| **Tâches terminées pliées** | Par défaut, les tâches à 100% affichées en mode compact ; dépliable au clic | `LotControl.tsx` (TaskCard, collapsed state) | — |
| **Points à revoir** | Section affichant les réserves ouvertes non levées rattachées à la zone courante | `ZoneControl.tsx` (CarriedPoints) | `src/lib/reserves.ts` (carriedOverPoints) |
| **Pas de scroll-to-top** | Suppression du scroll automatique lors changement de lot (conservation position) | `LotControl.tsx` (removed useEffect) | — |
| **Menu overflow sous-tâches** | Actions Engagement + Marquer N/A regroupées dans menu 3 points ; confirmation window.confirm() | `LotControl.tsx` (overflow-menu panel) | — |
| **Notes de tâche avec délai** | Bouton « + Note », formulaire inline : texte, toggle Important (rouge), sélecteur délai (1-4 sem) → dueDate | `LotControl.tsx` (noteForm state, submitNote) | — |
| **Éditer titre tâche** | Bouton Pencil sur TaskCard, formulaire inline pour corriger le titre de la tâche en visite | `LotControl.tsx` (editForm state, submitEdit) | — |
| **Contrôle par lot (LotControl)** | Vue lot : TaskCard par tâche, sous-tâches expandables | `LotControl.tsx` | `src/lib/visits.ts` |
| **Ajout tâche depuis visite** | Bouton « + » par lot → crée une tâche dans le planning | `LotControl.tsx` (onAddPlanTask) | `src/lib/planning.ts` (createTask) |
| **Ajout sous-tâche depuis visite** | Bouton « ↳+ » sur TaskCard → crée une sous-tâche | `LotControl.tsx` (onAddSubTask) | `src/lib/planning.ts` (createSubTask) |
| **Réserves (observations/actions)** | Lever une réserve depuis une zone, avec photo, lot, priorité, échéance | `ZoneControl.tsx`, `RemarkForm.tsx` | `src/lib/reserves.ts` |
| **Points reportés** | Points non résolus des visites précédentes rattachés à la zone | `CarriedPoints.tsx` | `src/lib/reserves.ts` (carriedOverPoints) |
| **Notes de session** | Notes générales ou ciblées par entreprise | `SessionNotes.tsx` | `src/lib/visits.ts` |
| **Photos avec annotations** | Capture, annotation (flèches, cercles, texte), légende | `PhotoAnnotator.tsx` | `src/lib/photoStore.ts`, `src/lib/annotations.ts` |
| **Engagements d'entreprise** | Saisir les nouvelles dates promises par entreprise | `LotControl.tsx` | `src/lib/commitments.ts` |
| **CR (Compte Rendu)** | Rédaction du CR : synthèse, intervenants, conclusions, prochaine réunion | `Visite.tsx` (CrEditor) | `src/lib/visits.ts` |
| **Édition CR après diffusion** | Tous les champs restent éditables même après diffusion (audit log actif) | `Visite.tsx` (locked=false) | — |
| **Rapport / export PDF** | Génération du CR imprimable avec toutes les sections | `Visite.tsx` (Report) | `src/lib/visits.ts`, `window.print()` |
| **Relevé par logement** | Dans le rapport : vue Bâtiment → Logement → Lot | `Visite.tsx` (Report, relevéView='logement') | — |
| **Relevé par lot** | Dans le rapport : vue Lot → Bâtiment → Logement | `Visite.tsx` (Report, relevéView='lot') | — |
| **Journal des modifications** | Historique des changements du CR avec auteur, champ, avant/après | `Visite.tsx` (CrEditor, auditLog) | — |
| **Application au planning** | Sur fermeture de session : avancement constaté → dates réelles Gantt | `Visite.tsx` (applyVisitToPlanning) | `src/lib/visits.ts`, `src/lib/actualDates.ts` |

---

## 4. Module CR (Compte Rendu / Réserves)

> **Navigation :** onglet « Gestion » → « Réserves & réunions » → CR

| Fonctionnalité | Description | Composant | Lib / Logic |
|----------------|-------------|-----------|-------------|
| **Journal CR (CrTable)** | Liste paginable de tous les points de CR avec statut coloré ; recherche texte | `CrTable.tsx` | `src/lib/reserves.ts` |
| **Recherche dans CR** | Champ de recherche pour filtrer les points par description, lot, entreprise, numéro | `CrTable.tsx` (searchTerm state, filteredRows) | — |
| **Navigation par n° CR** | Chips « Tous \| CR 1 \| CR 2 … » pour filtrer par numéro de réunion | `CrTable.tsx` (selectedCr) | — |
| **Vue par lot** | Toggle Liste / Par lot : groupé par lot avec cards action/observation | `CrTable.tsx` (view='par-lot') | `src/lib/reserves.ts` (reserveKind) |
| **Ajout de point** | Formulaire inline : description, lot, entreprise, type, n° CR, échéance, rappel | `CrTable.tsx` (AddForm) | `src/lib/reserves.ts` (nextReserveNumber) |
| **Import Excel** | Import .xlsx souple (colonnes reconnues par nom normalisé) | `CrTable.tsx` (onImport, rowToReserve) | `xlsx` (npm) |
| **Édition inline** | Bouton Modifier sur chaque point → formulaire en place | `CrTable.tsx` (EditForm) | — |
| **Suivi de réserve** | Terminé / +1 sem / +2 sem / +4 sem / Commenter / Obsolète | `CrTable.tsx` | `src/lib/reserves.ts` (applyFollowUp) |
| **Attribution crNo** | À la clôture sans n° CR, attribue le crNo courant automatiquement | `CrTable.tsx` (follow) | — |
| **Sélecteur visibilité colonnes** | Cocher/décocher les colonnes à afficher : N°CR, Description, Lot/Entreprise, Type, Échéance, Statut | `CrTable.tsx` (showVisibility, columnVis) | localStorage (sc_cr_columns) |
| **Imprimer journal CR** | Bouton d'impression avec CSS print dédié ; cache les colonnes masquées | `CrTable.tsx` (window.print) | `src/styles.css` (@media print) |
| **Query params (deep linking)** | URL `?crNo=N&view=par-lot&search=terme` pour mémoriser filtres et vue ; synced bidirectionnelle | `CrTable.tsx` (useEffect hooks) | localStorage ↔ URL replaceState |
| **Landscape print mode** | CSS `@media print and (orientation: landscape)` avec redimensionnement ; @page pour marges A4 | `src/styles.css` | CSS @page rules |
| **Notes & suivi consolidé** | Onglet dédié listant tous les suivis de toutes les réserves, triés par date DESC, filtrables | `Notes.tsx` | `src/lib/reserves.ts` |
| **Réunions** | Liste des réunions de chantier (PV, participants, ordre du jour) | `Meetings.tsx` | `src/lib/meetings.ts` |
| **Réserves terrain** | Vue parallèle des réserves liées aux visites de terrain | `Reserves.tsx` | `src/lib/reserves.ts` |

---

## 5. Module Finances

| Fonctionnalité | Description | Composant | Lib / Logic |
|----------------|-------------|-----------|-------------|
| **Marchés** | Saisie des marchés par lot (montant, entreprise, dates) | `Finances.tsx` | `src/lib/finance.ts` |
| **Avenants** | Gestion des avenants (suppléments/déductions) | `Finances.tsx` | `src/lib/finance.ts` |
| **Situations** | Situations de travaux mensuelles, taux d'avancement financier | `Finances.tsx` | `src/lib/finance.ts` |
| **DPG/F** | Import et visualisation du Décompte Prévisionnel Général | `DpgfView.tsx` | `src/lib/dpgf.ts` |
| **Synthèse KPI** | Budget / facturé / payé / reste-à-payer | `Finances.tsx`, `Home.tsx` | `src/lib/finance.ts` |

---

## 6. Module Entreprises

| Fonctionnalité | Description | Composant | Lib / Logic |
|----------------|-------------|-----------|-------------|
| **Fiche entreprise** | Contact, lot, historique des visites, engagements, réserves ouvertes | `Entreprises.tsx` | `src/lib/companies.ts`, `src/lib/commitments.ts` |
| **Engagements** | Dates promises par lot, comparaison avec précédentes | `Entreprises.tsx` | `src/lib/commitments.ts` |

---

## 7. Module Rapports & Documents

| Fonctionnalité | Description | Composant | Lib / Logic |
|----------------|-------------|-----------|-------------|
| **CR de visite (PDF)** | Génération et impression du compte rendu de visite | `Reports.tsx` | `Visite.tsx` (Report), `window.print()` |
| **Lien de partage MOA** | Snapshot compressé dans le hash URL → vue lecture seule pour la MOA | `Reports.tsx` (bouton Partager) | `src/lib/share.ts` (buildSnapshot, buildShareUrl) |
| **Vue partagée (ShareView)** | KPIs + planning readOnly + réserves + finances — sans localStorage | `ShareView.tsx` | `src/lib/share.ts` (decodeSnapshot) |

---

## 8. Module Structure (Bâtiments & Zones)

| Fonctionnalité | Description | Composant | Lib / Logic |
|----------------|-------------|-----------|-------------|
| **Bâtiments & niveaux** | Arborescence bâtiment → niveau → logement / communs / ext. | `Structure.tsx` | `src/lib/repo.ts` (getUnits) |
| **Rattachements tâche→zone** | Associer une tâche du planning à une zone (logement, commun…) | `Structure.tsx` | `src/lib/units.ts`, `src/lib/repo.ts` (getTaskUnits) |

---

## 9. Module Alertes

| Fonctionnalité | Description | Composant | Lib / Logic |
|----------------|-------------|-----------|-------------|
| **Alertes automatiques** | Retards, réserves en dépassement d'échéance, jalons approchants | `Alertes.tsx` | `src/lib/alerts.ts` |

---

## 10. Configuration (opération)

| Fonctionnalité | Description | Composant | Lib / Logic |
|----------------|-------------|-----------|-------------|
| **Lots & entreprises** | Configurer les lots, affecter entreprises et contacts | `Config.tsx` | `src/lib/repo.ts` (getLotsConfig / saveLotsConfig) |
| **Dates contractuelles** | Date début, durée, jalons par lot | `Config.tsx`, `PlanningConfig.tsx` | `src/lib/repo.ts` |
| **Congés & jours fériés** | Calendrier des jours non travaillés | `Config.tsx` | `src/lib/repo.ts` (getHolidays), `src/lib/calendar.ts` |
| **Types de visite** | Paramétrer les types (visite chantier, réunion de synthèse…) | `Config.tsx` | `src/lib/repo.ts` (getVisitKinds) |
| **Règles de projet** | Notes/consignes affichées en tête de chaque CR | `Config.tsx` | `src/lib/repo.ts` (getProjectRules) |

---

## 11. Comptes & Multi-projet

| Fonctionnalité | Description | Composant | Lib / Logic |
|----------------|-------------|-----------|-------------|
| **Multi-opérations** | Gérer plusieurs chantiers en parallèle (cloisonnement par projectId) | `Projets.tsx` | `src/lib/projects.ts`, `src/lib/repo.ts` |
| **Comptes utilisateurs** | Création de comptes, rôles, mot de passe | `Comptes.tsx`, `Login.tsx` | `src/lib/auth.ts` |
| **Mon compte** | Profil, changement de mot de passe | `MonCompte.tsx` | `src/lib/auth.ts` |
| **Projet d'exemple** | Charger « Les Tilleuls » pour tester l'app | `Projets.tsx` | `src/lib/demoData.ts` |

---

## 12. Bibliothèques métier (`src/lib/`)

| Fichier | Rôle | Consommateurs principaux |
|---------|------|--------------------------|
| `repo.ts` | Frontière persistence — SEUL fichier qui lit/écrit localStorage | Tous les composants |
| `reserves.ts` | Types + fonctions pour observations/actions/réserves/CR | `CrTable.tsx`, `Visite.tsx`, `Reserves.tsx` |
| `visits.ts` | Logique de session de visite (états, zones, avancement) | `Visite.tsx` |
| `planning.ts` | Création de tâches/sous-tâches, modification du planning | `Visite.tsx` (LotControl), `Gantt.tsx` |
| `planningHistory.ts` | Baseline (contractuel), snapshot de référence | `Gantt.tsx`, `GanttTable.tsx` |
| `schedule.ts` | Calcul avancement global, dérives, tâches en retard | `Gantt.tsx`, `Home.tsx` |
| `forecast.ts` | Prévision automatique (réplanification sans modifier le planning) | `Gantt.tsx` |
| `cpm.ts` | CPM (Critical Path Method) : chemin critique, marges totales | `Gantt.tsx` |
| `calendar.ts` | Gestion des jours ouvrés / congés pour l'auto-planification | `planning.ts`, `Gantt.tsx` |
| `actualDates.ts` | Mise à jour des dates réelles depuis l'avancement constaté | `Visite.tsx`, `Gantt.tsx` |
| `finance.ts` | Types + calculs marchés, avenants, situations | `Finances.tsx`, `Home.tsx` |
| `dpgf.ts` | Import et structuration du DPGF | `DpgfView.tsx` |
| `meetings.ts` | Modèle des réunions (PV) | `Meetings.tsx` |
| `commitments.ts` | Dates promises entreprises, historique | `Entreprises.tsx`, `Visite.tsx` |
| `units.ts` | Rattachements tâche→zone, filtres | `Gantt.tsx`, `Structure.tsx` |
| `share.ts` | Snapshot LZ-compressé dans le hash URL (partage MOA) | `Reports.tsx`, `ShareView.tsx`, `App.tsx` |
| `sync.ts` | Write-through Supabase (optionnel post-auth) | `App.tsx` |
| `auth.ts` | Comptes locaux, rôles, `canEditLocked`, `isSuperadmin` | `Visite.tsx`, `Comptes.tsx` |
| `storage.ts` | Sérialiseur/désérialiseur date-aware pour JSON round-trip | `repo.ts`, `share.ts` |
| `alerts.ts` | Calcul des alertes (retards, échéances) | `Alertes.tsx`, `Home.tsx` |
| `observations.ts` | Helpers de consolidation des observations multi-visites | `Visite.tsx` |
| `activity.ts` | Journal d'activité (logActivity) | Tous les modules |
| `projects.ts` | CRUD opérations, projet actif | `Projets.tsx`, `App.tsx` |
| `photoStore.ts` | Stockage photos (IndexedDB, downscale, data URL) | `Visite.tsx`, `ZoneControl.tsx` |
| `annotations.ts` | Annotations photo (flèches, formes, texte) | `PhotoAnnotator.tsx` |
| `progress.ts` | Calcul de la progression des zones/lots | `Visite.tsx`, `ZoneControl.tsx` |
| `weeks.ts` | Utilitaires de numéros de semaine ISO | `GanttTable.tsx` |
| `paste.ts` | Parsing de texte collé pour import rapide | `CrTable.tsx` (futur) |
| `scope.ts` | Portée des clés localStorage par projet | `repo.ts` |
| `selection.ts` | Gestion multi-sélection de zones/tâches | `ZoneControl.tsx` |

---

## 13. Flux de données entre modules

```
Visite (terrain)
  └─► applyVisitToPlanning()  ──►  GanttTasks (actual_start/end, progress)
  └─► saveReserves()          ──►  Reserves (observations, actions)
  └─► saveCommitments()       ──►  DateCommitments (dates promises entreprises)

Gantt (planning)
  └─► saveGanttTasks()        ──►  GanttTasks (planned_start/end, baseline)
  └─► createTask/createSubTask ►  GanttTasks (nouvelles tâches)

CrTable (réunions)
  └─► saveReserves()          ──►  Reserves (crNo, suivi, clôture)

Finances
  └─► saveMarches/Situations  ──►  Finance (marchés, situations, avenants)

TOUT ──► repo.ts (localStorage) ──► [Futur : Supabase via sync.ts]
```

---

## 14. Conventions & patterns récurrents

| Pattern | Description | Exemple |
|---------|-------------|---------|
| **Stack navigation** | `push(view)` / `pop()` / `swap(view)` dans `Visite.tsx` | `push({ v: 'session' })` |
| **ghostBtn** | Style de bouton outline réutilisable | `src/components/visite/visiteStyles.ts` |
| **sectionLabel** | Style d'en-tête de section | `visiteStyles.ts` |
| **input** | Style d'input unifié | `visiteStyles.ts` |
| **logActivity** | Tracer toute action métier dans le journal | `logActivity('planning', '...')` |
| **readOnly prop** | Désactiver les interactions de drag/saisie dans GanttTable | `GanttTable.tsx` |
| **LotContact** | Type unifié pour lot + contact entreprise | `src/lib/repo.ts` |
| **Reserve.crNo** | Numéro de réunion du CR | `src/lib/reserves.ts` |
| **GanttTask 4 couches** | `planned_*` / `baseline_*` / `actual_*` / `forecast_*` | `src/types/gantt.ts` |

---

## 15. Déploiement

| Étape | Commande | Cible |
|-------|----------|-------|
| Développement | `git commit develop` | branche locale |
| Intégration | `git checkout main && git merge --ff-only develop` | main local |
| Publication | `git push origin develop main` | GitHub → Vercel (auto) |
| Supabase migration | `supabase db push` (futur) | projet `xphuzuvmjnzwqtdwrabv` |

**Vercel** : build `npm run build`, sortie `dist/`, SPA rewrite dans `vercel.json`.
**Clé Supabase publique** (`sb_publishable_*`) : safe côté client. **Jamais** la `sb_secret_*` dans le code ou Git.

---

*Dernière mise à jour : 2026-09-18 — PARTIE 0-4 complètes (routing URL, export CR).*
