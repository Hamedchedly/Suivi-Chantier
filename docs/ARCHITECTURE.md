# ARCHITECTURE CIBLE — Suivi-Chantier v1.0

> Établie après audit complet de la branche `develop` — Septembre 2026  
> Basée sur l'état réel du code, des migrations et des types TypeScript existants.

---

## 1. Principes fondamentaux

### Source de vérité unique
**Supabase/PostgreSQL est l'unique source de vérité.**  
Aucune donnée métier ne doit être codée en dur dans le frontend. Toutes les entités sont rattachées à une `operation_id`.

### Architecture multi-opérations
L'application gère N opérations sur une même instance. Chaque opération possède ses propres bâtiments, lots, planning, finances et documents. L'isolation est garantie au niveau SQL par RLS (Row Level Security).

### Objet central : `schedule_item`
Le `schedule_item` est le **moteur temporel** de l'application. Il ne se contente pas d'afficher des dates — il orchestre le planning, détecte les retards, calcule le chemin critique, et connecte le terrain (observations, RFI, réserves) au calendrier.

### Information saisie une fois, réutilisée partout
Une entreprise, un lot, un logement ou une tâche saisis une fois alimentent automatiquement tous les modules : planning, CR, RFI, dashboard, marché.

---

## 2. Stack technique (existant, à conserver)

| Couche | Technologie | Version |
|---|---|---|
| Frontend | React + TypeScript | React 19, TS 5.9 |
| Build | Vite | 7.1 |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) | 2.57 |
| PWA | vite-plugin-pwa | 1.0 |
| Tests | Vitest | 3.2 |
| Déploiement | Railway | — |
| Import Excel | xlsx (SheetJS) | 0.18 |

**À ajouter pour le Gantt :**
- `gantt-task-react` (MIT) — rendu Gantt Canvas (voir doc GANTT_LIBRARY.md)
- ou solution canvas maison inspirée de DingPlan selon décision phase 2

---

## 3. Structure des modules

### État actuel (branche `develop`)

```
✅ Authentification          Supabase Auth, session, RLS
✅ Opérations                CRUD, liste, sélection
✅ Administration            Unités, lots, entreprises, affectations
✅ Import DPGF               xlsx → tasks avec mapping colonnes
✅ Visites                   Création, saisie avancement par tâche/unité
✅ Observations              CRUD, historisation, événements, priorité
✅ Avancement                progress_entries par visite/lot/tâche
✅ Dashboard                 Vue agrégée par opération
🟡 Planning                  schedule_items en base, affichage Gantt basique (barres CSS)
🟡 Finances                  markets/amendments/situations en base, UI non développée
⬜ Réserves                  Non développé (spécialisation observations)
⬜ RFI                       Non développé
⬜ VISA                      Non développé
⬜ CR automatique            Non développé
⬜ CPM / Baseline            Non développé
⬜ Alertes                   Non développé
```

### Modules cibles (v1.0 MVP)

```
OPÉRATION
├── Dashboard (pilotage)        ← enrichir
├── Planning / Gantt            ← refondre (PRIORITÉ 1)
│   ├── Vue Lots (Swimlanes)
│   ├── Vue Logements
│   ├── CPM / Chemin critique
│   └── Baseline / Versions
├── Terrain
│   ├── Visites                 ← enrichir
│   ├── Observations            ← enrichir
│   └── Réserves                ← créer
├── Administratif
│   ├── RFI                     ← créer
│   └── VISA                    ← créer
├── Finances
│   ├── Marchés                 ← UI à créer (base SQL OK)
│   ├── Avenants                ← UI à créer (base SQL OK)
│   └── Situations              ← UI à créer (base SQL OK)
└── CR automatique              ← phase 7
```

---

## 4. Architecture des données (vue haut niveau)

```
operations
    │
    ├── operation_members           (rôles : owner / admin / member / viewer)
    │
    ├── operation_units             (building → dwelling / common_area / exterior / zone)
    │
    ├── companies
    │
    ├── lots ──────────── companies
    │   └── tasks (DPGF)
    │       └── dpgf_imports
    │
    ├── schedule_items ──────────── lots / tasks / units
    │   ├── schedule_dependencies   (FS / SS / FF / SF + lag)
    │   ├── schedule_baselines      [à créer]
    │   └── schedule_calendars      [à créer]
    │
    ├── visits
    │   ├── visit_attendees
    │   └── progress_entries ─────── lots / tasks / units
    │
    ├── observations ────────────── units / lots / tasks / schedule_items
    │   ├── observation_events
    │   └── observation_history
    │
    ├── reserves [à créer] ──────── units / lots / schedule_items
    │
    ├── rfis [à créer] ─────────── lots / companies / schedule_items
    │   └── rfi_events
    │
    ├── submittals [à créer] ────── lots / companies
    │   └── submittal_events
    │
    ├── markets ─────────────────── lots / companies
    │   ├── market_amendments
    │   └── market_situations
    │
    ├── photos [à créer] ────────── visit / observation / reserve / task / unit
    │
    └── activity_log [à créer]
```

---

## 5. Flux de données

### Flux principal (création → clôture)

```
Créer opération
    ↓
Importer DPGF → tasks (lots, sections, items, montants)
    ↓
Créer planning → schedule_items (liés aux tasks + lots + units)
    ↓
Moteur Gantt → dépendances, durées, CPM
    ↓
Visite chantier → progress_entries + observations
    ↓
Retards détectés → alertes + impact CPM
    ↓
RFI / VISA → liés aux schedule_items concernés
    ↓
Situations financières → liées aux marchés/lots
    ↓
CR généré automatiquement depuis toutes ces données
    ↓
Réserves OPR → suivi levée
    ↓
Clôture opération
```

### Connexion Planning ↔ Terrain (différenciateur clé)

```
schedule_item
    │
    ├── observations (plusieurs)
    ├── reserves (plusieurs)
    ├── rfis (plusieurs)
    ├── photos (plusieurs)
    └── progress_entries (avancement réel)
    
→ Si avancement_réel < avancement_théorique : alerte retard
→ Si RFI ouverte sur tâche critique : alerte blocage
→ Impact affiché dans CPM et dashboard
```

---

## 6. Sécurité et RLS

### Fonctions RLS existantes (à conserver)

```sql
is_operation_member(operation_id)  -- lecture tous membres
can_edit_operation(operation_id)   -- écriture owner/admin/member
can_manage_operation(operation_id) -- administration owner/admin
```

### Rôles MVP (version bêta simplifiée)

| Rôle | Lecture | Création/Edit | Administration | Dev bypass |
|---|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ | — |
| `admin` | ✅ | ✅ | ✅ | — |
| `member` | ✅ | ✅ | ❌ | — |
| `viewer` | ✅ | ❌ | ❌ | — |
| `dev` (futur) | ✅ | ✅ | ✅ | ✅ |

> Note : En bêta, 2 rôles suffisent en pratique (admin + member). Le système existant supporte déjà les 4 rôles. Le mode `dev` sera un bypass ajouté en phase ultérieure via un flag `is_superadmin` sur le profil utilisateur.

---

## 7. Organisation du code frontend

### Structure cible (React + TypeScript)

```
src/
├── App.tsx                         ← routing principal
├── main.tsx
├── styles.css
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── NavBar.tsx
│   │   └── AccountBar.tsx
│   │
│   ├── operations/
│   │   ├── OperationList.tsx
│   │   └── OperationForm.tsx
│   │
│   ├── dashboard/
│   │   └── Dashboard.tsx           ← enrichir
│   │
│   ├── gantt/                      ← MODULE PRIORITAIRE
│   │   ├── GanttPanel.tsx          ← conteneur principal
│   │   ├── GanttCanvas.tsx         ← rendu canvas/svg
│   │   ├── GanttRow.tsx
│   │   ├── GanttDependency.tsx
│   │   ├── GanttToolbar.tsx
│   │   └── GanttSidebar.tsx
│   │
│   ├── visits/
│   │   └── VisitForm.tsx           ← existant
│   │
│   ├── observations/
│   │   ├── ObservationDetail.tsx   ← existant
│   │   └── ObservationList.tsx
│   │
│   ├── reserves/                   ← à créer
│   ├── rfis/                       ← à créer
│   ├── finances/                   ← à créer (UI)
│   └── admin/
│       └── Administration.tsx      ← existant
│
├── lib/
│   ├── supabase.ts                 ← existant
│   ├── types.ts                    ← enrichir
│   ├── data.ts                     ← existant, à enrichir
│   ├── operations.ts               ← existant
│   ├── observations.ts             ← existant
│   ├── progress.ts                 ← existant
│   ├── schedule.ts                 ← à créer (moteur Gantt)
│   ├── cpm.ts                      ← à créer (algorithme CPM)
│   ├── calendar.ts                 ← à créer (jours ouvrés)
│   └── alerts.ts                   ← à créer
│
└── hooks/
    ├── useOperation.ts
    ├── useSchedule.ts
    └── useAlerts.ts
```

---

## 8. Conventions de développement

### Règles absolues

1. **Ne jamais recréer une table existante** — vérifier les migrations avant tout ALTER ou CREATE.
2. **Ne jamais dupliquer un modèle** — `Task` est la ligne DPGF, `ScheduleItem` est la ligne planning. Ce sont deux entités distinctes.
3. **Toutes les migrations sont versionnées** — format `YYYYMMDDNNNN_description.sql`.
4. **RLS toujours activé** — chaque nouvelle table doit avoir `enable row level security` et ses policies.
5. **Les données restent dans Supabase** — les photos vont dans Supabase Storage, jamais dans Git.
6. **TypeScript strict** — pas de `any`, pas de `as unknown as X`.

### Checklist avant chaque PR

```
□ tsc --noEmit → 0 erreur
□ eslint → 0 warning
□ vitest run → tous les tests passent
□ Migration vérifiée (idempotente si possible)
□ RLS vérifié sur les nouvelles tables
□ Pas de donnée métier codée en dur
□ Pas de fonctionnalité existante supprimée
```

---

## 9. Déploiement

| Environnement | Plateforme | Branche |
|---|---|---|
| Production | Railway | `main` |
| Développement | Local + Supabase local | `develop` |
| Features | PR vers `develop` | `feature/*` |

> `develop` est la branche de référence. Toutes les nouvelles fonctionnalités partent de `develop` et y reviennent avant de monter vers `main`.

---

## 10. Axes d'évolution (post-MVP — hors scope bêta)

- **Mode hors-ligne** : PWA offline avec sync différée (Service Worker + IndexedDB)
- **GED / Plans annotables** : upload PDF, versions, épingles (type Fieldwire)
- **IA planning** : génération WBS depuis prompt, analyse des retards
- **IA CR** : rédaction automatique depuis les données chantier
- **Détection d'anomalies** : vision IA sur photos (type AI ConstructionSiteMonitoring)
- **Rôle Dev/superadmin** : bypass RLS, force-update toute entrée

---

*Document vivant — à mettre à jour à chaque fin de phase.*
