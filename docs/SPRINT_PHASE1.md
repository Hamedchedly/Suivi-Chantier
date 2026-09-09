# PLAN DE SPRINT — PHASE 1

## Stabilisation du socle existant

> Objectif : obtenir un socle propre, sans dette cachée, prêt à recevoir le moteur Gantt  
> Durée estimée : **2–3 semaines**  
> Branche de travail : `develop`

---

## Contexte (résultat de l'audit Phase 0)

### Ce qui fonctionne ✅
- Authentification Supabase + sessions
- Gestion multi-opérations (liste, création, sélection)
- Module Administration (unités, lots, entreprises, affectations)
- Import DPGF (xlsx → tasks)
- Visites + saisie avancement
- Observations + historisation
- Dashboard de base
- Planning : `schedule_items` en base + affichage barres CSS simple
- RLS complet sur toutes les tables
- 8 migrations versionnées et propres
- PWA + déploiement Railway

### Ce qui manque ou est incomplet ⚠️
- `operations` : champs métier manquants (MOA, MOE, AMO, budget, dates contractuelles, statuts étendus)
- `schedule_items` : champs CPM manquants (is_critical, float, baseline, company, wbs_code)
- `schedule_dependencies` : champ `lag_days` manquant
- Tables absentes : `schedule_baselines`, `schedule_calendars`, `reserves`
- Aucune UI pour : marchés, avenants, situations, réserves, RFI, VISA
- TypeScript : `ScheduleItem` incomplet (vs champs SQL réels)
- Aucun test sur : planning, finances, administration

---

## Sprint 1 — Migrations + Types (Jours 1–4)

### Objectif
Aligner la base de données et les types TypeScript sur l'architecture cible. Rien de cassé, seulement des ajouts.

---

### J1 — Migration 009 (enrichissements + nouvelles tables)

**Fichier :** `supabase/migrations/202609090009_gantt_cpm_baseline.sql`

Contenu (voir `DATA_MODEL.md` section 4 pour le SQL complet) :

1. Enrichir `operations` : `reference_interne`, `moa`, `moe`, `amo`, `start_date`, `contractual_end_date`, `budget_global`, `operation_type`, nouveaux statuts
2. Enrichir `lots` : `amount_contract_ht`, `responsible_name`, `lot_status`
3. Enrichir `schedule_items` : `company_id`, `responsible_user_id`, `is_milestone`, `is_critical`, `wbs_code`, `priority`, `baseline_start/end`, champs CPM (`early_start`, `early_finish`, `late_start`, `late_finish`, `total_float`, `free_float`)
4. Enrichir `schedule_dependencies` : `lag_days`
5. Créer `schedule_calendars` + `schedule_calendar_exceptions` (RLS inclus)
6. Créer `schedule_baselines` + `schedule_baseline_items` (RLS inclus)
7. Créer `reserves` (RLS inclus)
8. Indexes manquants

**Checklist J1 :**
```
□ Migration appliquée localement (supabase db push)
□ 0 erreur SQL
□ RLS activé sur chaque nouvelle table
□ Triggers assert_same_operation étendus si nécessaire
□ Migration idempotente (IF NOT EXISTS sur ADD COLUMN)
```

---

### J2 — Mise à jour types TypeScript

**Fichier :** `src/lib/types.ts`

Mettre à jour ou ajouter :

```typescript
// Operation étendu
export type OperationStatus =
  | 'preparation' | 'consultation' | 'travaux' | 'opr'
  | 'reception' | 'levee_reserves' | 'cloturee' | 'archived' | 'active'

export type Operation = {
  id: string
  name: string
  address: string | null
  reference_interne: string | null
  moa: string | null
  moe: string | null
  amo: string | null
  start_date: string | null
  contractual_end_date: string | null
  budget_global: number | null
  operation_type: 'entreprise_generale' | 'lots_separes'
  status: OperationStatus
  created_at: string
}

// ScheduleItem enrichi (voir DATA_MODEL.md)
export type ScheduleStatus = 'not_started' | 'in_progress' | 'done' | 'blocked' | 'postponed' | 'cancelled'
export type Priority = 'low' | 'normal' | 'high' | 'critical'
export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'

export type ScheduleItem = { /* voir DATA_MODEL.md */ }
export type ScheduleDependency = { /* voir DATA_MODEL.md */ }
export type ScheduleBaseline = { /* voir DATA_MODEL.md */ }
export type Reserve = { /* voir DATA_MODEL.md */ }
```

**Checklist J2 :**
```
□ tsc --noEmit → 0 erreur
□ Tous les composants existants compilent sans any
□ data.ts mis à jour pour retourner les nouveaux champs
□ listScheduleItems retourne les champs CPM
```

---

### J3 — Enrichir `data.ts` + nouveaux selects

Ajouter dans `src/lib/data.ts` :

```typescript
// Planning
export async function listScheduleItems(operation_id: string): Promise<ScheduleItem[]>
export async function listScheduleDependencies(operation_id: string): Promise<ScheduleDependency[]>
export async function createScheduleItem(operation_id: string, values: ScheduleItemValues): Promise<ScheduleItem>
export async function updateScheduleItem(id: string, values: Partial<ScheduleItemValues>): Promise<void>
export async function deleteScheduleItem(id: string, operation_id: string): Promise<void>
export async function upsertScheduleDependency(dep: ScheduleDependency): Promise<void>
export async function deleteScheduleDependency(item_id: string, pred_id: string): Promise<void>

// Baselines
export async function createBaseline(operation_id: string, name: string, items: ScheduleItem[]): Promise<ScheduleBaseline>
export async function listBaselines(operation_id: string): Promise<ScheduleBaseline[]>

// Réserves
export async function listReserves(operation_id: string): Promise<Reserve[]>
export async function createReserve(operation_id: string, values: ReserveValues): Promise<Reserve>
export async function updateReserve(id: string, values: Partial<ReserveValues>): Promise<void>

// Calendriers
export async function getOrCreateCalendar(operation_id: string): Promise<ScheduleCalendar>
export async function listCalendarExceptions(calendar_id: string): Promise<CalendarException[]>
```

**Checklist J3 :**
```
□ Toutes les fonctions typées (pas de any)
□ Gestion erreur consistante (throw error, pas de console.log)
□ Tests unitaires sur les fonctions pures
```

---

### J4 — Tests manquants

Ajouter les tests manquants dans `src/lib/` :

**`src/lib/schedule.test.ts`** (nouveau)
```typescript
// Tests sur le mapping schedule_item → gantt
// Tests sur le calcul de retard (is_late)
// Tests sur la détection tâche critique
```

**`src/lib/data.test.ts`** (nouveau — mocks Supabase)
```typescript
// Tests sur les fonctions de fetch
// Mocks via vitest.mock('@supabase/supabase-js')
```

**Checklist J4 :**
```
□ vitest run → tous les tests passent (existants + nouveaux)
□ Coverage > 60% sur les fonctions pures
```

---

## Sprint 2 — Stabilisation UI (Jours 5–10)

### Objectif
Corriger et enrichir les composants existants sans casser ce qui marche. Préparer les hooks nécessaires au Gantt.

---

### J5–J6 — Enrichir `OperationForm` + `Administration`

**OperationForm** : ajouter les champs manquants
- `reference_interne`
- `moa` / `moe` / `amo`
- `start_date` / `contractual_end_date`
- `budget_global`
- `operation_type` (radio : lots séparés / entreprise générale)
- `status` (select avec tous les statuts)

**Administration** : enrichir le formulaire Lot
- `amount_contract_ht`
- `responsible_name`
- `lot_status`

**Checklist J5–J6 :**
```
□ Formulaire opération enrichi + fonctionnel
□ Formulaire lot enrichi + fonctionnel
□ tsc → 0 erreur
□ UI cohérente avec le design existant
```

---

### J7–J8 — Enrichir `Dashboard`

Le Dashboard actuel est fonctionnel mais basique. L'enrichir avec :

**KPIs opération :**
```
Avancement global (%) = moyenne pondérée des progress_entries
Budget engagé vs budget global
Retard global (jours) = date_fin_prévisionnelle - date_fin_contractuelle
Nombre de tâches en retard
Nombre d'observations ouvertes
```

**Blocs à ajouter :**
```
┌─ Avancement par lot (barres de progression) ─┐
│ LOT 05 ████████████ 82 %                      │
│ LOT 06 ███████      64 %                      │
└───────────────────────────────────────────────┘

┌─ Alertes ────────────────────────────────────┐
│ ⚠ X observations en retard                   │
│ ⚠ X tâches sans avancement depuis 7j         │
└───────────────────────────────────────────────┘
```

**Checklist J7–J8 :**
```
□ KPIs calculés depuis les données réelles
□ Pas de données en dur
□ Responsive mobile
```

---

### J9 — Hooks partagés

Créer `src/hooks/` avec les hooks réutilisables :

```typescript
// src/hooks/useOperation.ts
export function useOperation(operationId: string) {
  // units, lots, companies, assignments
  // loading, error, reload
}

// src/hooks/useSchedule.ts
export function useSchedule(operationId: string) {
  // items, dependencies, baselines
  // loading, error, reload
}

// src/hooks/useAlerts.ts
export function useAlerts(operationId: string) {
  // late tasks, open observations, pending rfis
  // count par type
}
```

Ces hooks sont les fondations du Gantt (phase 2) et du Dashboard enrichi.

---

### J10 — Corrections et polish

**Vérifications globales :**
```
□ tsc --noEmit → 0 erreur TypeScript
□ eslint → 0 warning
□ vitest run → tous les tests passent
□ Build Vite → 0 erreur
□ PWA manifest correct
□ Navigation mobile responsive
□ Aucune donnée métier codée en dur
□ Aucune table recréée
□ RLS intègre sur toutes les tables
□ README à jour
```

---

## Sprint 3 — Réserves + Préparation Gantt (Jours 11–15)

### Objectif
Livrer le module Réserves (valeur métier immédiate), et poser les bases du composant Gantt pour la Phase 2.

---

### J11–J13 — Module Réserves

**Nouveau composant** : `src/components/reserves/ReserveList.tsx`

Fonctionnalités :
- Liste des réserves de l'opération
- Filtres : lot / unité / statut / priorité / entreprise
- Création rapide (titre, lot, unité, priorité, échéance)
- Changement de statut
- Lien avec logement et lot

**Navigation** : ajouter un onglet "Réserves" dans la nav principale.

**Checklist J11–J13 :**
```
□ CRUD réserves fonctionnel
□ Filtres opérationnels
□ Numérotation automatique (R-001, R-002, ...)
□ RLS respecté
□ Tests sur les fonctions lib/reserves.ts
```

---

### J14–J15 — Spike Gantt

**Objectif :** installer `gantt-task-react`, afficher les `schedule_items` existants dans le vrai composant Gantt, valider que l'intégration est possible sans friction.

```bash
npm install gantt-task-react
```

**Composant cible (spike) :** `src/components/gantt/GanttPanel.tsx`

```typescript
// Mapping minimal ScheduleItem → Task gantt-task-react
// Affichage lecture seule des items existants
// Validation zoom / scroll
// Validation rendu barres + jalons
```

Ce spike permet de **confirmer la décision librairie** avant de s'y investir pleinement en Phase 2.

**Checklist J14–J15 :**
```
□ gantt-task-react installé
□ GanttPanel.tsx créé (lecture seule)
□ Les schedule_items Gambetta s'affichent correctement
□ Drag & drop visuellement OK (sans save Supabase)
□ Décision confirmée : on continue avec cette lib OU on pivote
□ SchedulePanel.tsx (ancien) conservé mais non affiché
```

---

## Critères de sortie Phase 1

La Phase 1 est **terminée et validée** quand :

```
□ Migration 009 appliquée et stable
□ Types TypeScript alignés sur le schéma SQL
□ tsc → 0 erreur | eslint → 0 warning | vitest → vert
□ Build prod → succès
□ Dashboard enrichi avec KPIs réels
□ OperationForm avec tous les champs métier
□ Module Réserves opérationnel
□ Spike Gantt validé (gantt-task-react affiché)
□ Hooks useOperation / useSchedule créés
□ Aucune fonctionnalité existante cassée
□ RLS intègre
□ Docs ARCHITECTURE.md + DATA_MODEL.md commités
```

---

## Ce que la Phase 1 ne fait PAS (dans scope Phase 2)

- ❌ Drag & drop sauvegardé en base
- ❌ Dépendances interactives
- ❌ CPM / chemin critique
- ❌ Baseline / versions planning
- ❌ RFI / VISA
- ❌ Finances (UI marchés/situations)
- ❌ Mode hors-ligne
- ❌ Export PDF
- ❌ CR automatique

---

## Estimation globale Phase 1

| Sprint | Durée | Livrable |
|---|---|---|
| Sprint 1 (J1–J4) | 4 jours | Migrations + Types + Data layer |
| Sprint 2 (J5–J10) | 6 jours | UI enrichie + Dashboard + Hooks |
| Sprint 3 (J11–J15) | 5 jours | Module Réserves + Spike Gantt |
| **Total Phase 1** | **~15 jours** | **Socle propre + Gantt spike** |

---

## Ordre de priorité des tâches (si délai réduit)

Si la Phase 1 doit être compressée à 10 jours :

1. **Indispensable** : Migration 009 + Types TypeScript (J1–J2)
2. **Indispensable** : data.ts schedule fonctions (J3)
3. **Indispensable** : Spike Gantt gantt-task-react (J4–J5)
4. **Important** : Module Réserves (J6–J8)
5. **Utile** : Dashboard KPIs (J9)
6. **Optionnel** : Hooks partagés (J10)
7. **Reporté** : Tests supplémentaires, OperationForm enrichi

---

*Après Phase 1 validée → démarrer `feature/gantt-engine` depuis `develop`.*
