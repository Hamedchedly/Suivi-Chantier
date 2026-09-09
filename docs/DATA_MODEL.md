# MODÈLE DE DONNÉES — Suivi-Chantier v1.0

> Établi après audit des 8 migrations existantes sur `develop` — Septembre 2026  
> Ce document liste l'existant et les migrations manquantes à créer.

---

## 1. Tables existantes (migrations 001 → 008)

### `operations`
```sql
id uuid PK
name text NOT NULL
address text
status text -- 'active' | 'archived'
created_at timestamptz
created_by uuid → auth.users
```
> **Manque** : `reference_interne`, `moa`, `moe`, `amo`, `start_date`, `contractual_end_date`, `budget_global`, `operation_type` ('entreprise_generale' | 'lots_separes')  
> → **Migration 009** à créer

---

### `operation_members`
```sql
operation_id uuid PK → operations
user_id uuid PK → auth.users
role text -- 'owner' | 'admin' | 'member' | 'viewer'
```
> Complet pour la bêta. Extension `is_superadmin` prévue en phase ultérieure.

---

### `operation_units` (bâtiments / logements)
```sql
id uuid PK
operation_id uuid → operations
parent_id uuid → operation_units (auto-référence)
kind text -- 'building' | 'dwelling' | 'common_area' | 'exterior' | 'zone'
code text
name text NOT NULL
floor text
sort_order integer
created_at timestamptz
```
> Complet. Hiérarchie : building → dwelling/common_area/exterior/zone.

---

### `companies`
```sql
id uuid PK
operation_id uuid → operations
name text NOT NULL
contact_name text
email text
phone text
address text
created_at timestamptz
```
> Complet pour la bêta.

---

### `lots`
```sql
id uuid PK
operation_id uuid → operations
number text
code text
name text NOT NULL
company_id uuid → companies
weighting_method text -- 'simple' | 'weighted'
sort_order integer
```
> **Manque** : `amount_contract_ht`, `responsible_name`, `status`  
> → compléter dans **Migration 009**

---

### `tasks` (lignes DPGF)
```sql
id uuid PK
operation_id uuid → operations
lot_id uuid → lots
parent_id uuid → tasks
reference text
name text NOT NULL
section text
unit text
quantity numeric
unit_price numeric
amount numeric
weight numeric
task_type text -- 'section' | 'item'
sort_order integer
unit_id uuid → operation_units
import_id uuid → dpgf_imports
source_sheet text
source_row integer
source_reference text
source_payload jsonb
```
> ✅ Complet. C'est la ligne DPGF — ne pas confondre avec `schedule_items`.

---

### `dpgf_imports`
```sql
id uuid PK
operation_id uuid → operations
filename text NOT NULL
imported_at timestamptz
imported_by uuid → auth.users
column_mapping jsonb
```

---

### `lot_assignments`
```sql
id uuid PK
operation_id uuid → operations
lot_id uuid → lots
unit_id uuid → operation_units
scope text -- 'operation' | 'building' | 'dwelling' | 'common_area' | 'exterior'
enabled boolean
```

---

### `visits`
```sql
id uuid PK
operation_id uuid → operations
visited_at timestamptz
title text
note text
created_at timestamptz
created_by uuid → auth.users
```
> **Manque** : `weather`, `next_visit_date`, `status`  
> → compléter dans **Migration 009**

---

### `visit_attendees`
```sql
id uuid PK
visit_id uuid → visits
company_id uuid → companies
user_id uuid → auth.users
name text
```

---

### `progress_entries`
```sql
id uuid PK
operation_id uuid → operations
visit_id uuid → visits
unit_id uuid → operation_units
lot_id uuid → lots
task_id uuid → tasks
progressed_at timestamptz
percentage numeric [0..100]
status text -- 'done' | 'in_progress' | 'not_started' | 'blocked' | 'postponed' | 'to_verify' | 'not_applicable' | ...
comment text
created_at timestamptz
created_by uuid → auth.users
```

---

### `observations`
```sql
id uuid PK
operation_id uuid → operations
unit_id uuid → operation_units
lot_id uuid → lots
task_id uuid → tasks
status text -- 'new' | 'done' | 'blocked' | 'postponed' | 'cancelled' | 'to_verify' | 'reminder' | 'not_started'
title text NOT NULL
detail text
priority text -- 'low' | 'normal' | 'high' | 'critical'
due_date date
responsible_user_id uuid → auth.users
created_at timestamptz
created_by uuid → auth.users
```
> **Manque** : `schedule_item_id` (lien vers le planning)  
> → compléter dans **Migration 009**

---

### `observation_events`
```sql
id uuid PK
observation_id uuid → observations
visit_id uuid → visits
status text
note text
occurred_at timestamptz
created_by uuid → auth.users
```

---

### `observation_history`
```sql
id uuid PK
observation_id uuid → observations
changed_at timestamptz
changed_by uuid → auth.users
action text
snapshot jsonb
```

---

### `schedule_items` (planning Gantt)
```sql
id uuid PK
operation_id uuid → operations
lot_id uuid → lots
task_id uuid → tasks       -- lien vers la ligne DPGF
unit_id uuid → operation_units
parent_id uuid → schedule_items
title text NOT NULL
planned_start date
planned_end date
planned_duration integer   -- jours ouvrés
actual_start date
actual_end date
actual_duration integer
progress numeric [0..100]
status text
notes text
sort_order integer
created_at timestamptz
```
> **Manque** : `company_id`, `responsible_user_id`, `is_milestone`, `is_critical`, `baseline_start`, `baseline_end`, `total_float`, `free_float`, `early_start`, `early_finish`, `late_start`, `late_finish`, `priority`, `wbs_code`  
> → compléter dans **Migration 009**

---

### `schedule_dependencies`
```sql
schedule_item_id uuid PK → schedule_items
predecessor_id uuid PK → schedule_items
dependency_type text -- 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'
```
> **Manque** : `lag_days integer` (décalage positif ou négatif)  
> → compléter dans **Migration 009**

---

### `markets`
```sql
id uuid PK
operation_id uuid → operations
lot_id uuid → lots
company_id uuid → companies
reference text
name text NOT NULL
initial_amount_ht numeric
initial_amount_ttc numeric
created_at timestamptz
```

---

### `market_amendments`
```sql
id uuid PK
market_id uuid → markets
description text NOT NULL
reason text
requested_amount numeric
negotiated_amount numeric
approved_amount numeric
status text -- 'draft' | 'submitted' | 'approved' | 'rejected'
created_at timestamptz
```

---

### `market_situations`
```sql
id uuid PK
market_id uuid → markets
number text NOT NULL
period_start date
period_end date
issued_at date
period_amount numeric
cumulative_amount numeric
paid_amount numeric
status text -- 'draft' | 'issued' | 'approved' | 'paid' | 'rejected'
```

---

## 2. Tables à créer

### `schedule_baselines` — **Migration 009**
```sql
id uuid PK
operation_id uuid → operations
name text NOT NULL              -- 'Planning V0 contractuel', 'Planning V1', ...
created_at timestamptz
created_by uuid → auth.users
notes text
```

### `schedule_baseline_items` — **Migration 009**
```sql
id uuid PK
baseline_id uuid → schedule_baselines
schedule_item_id uuid → schedule_items
title text                      -- copie snapshot
planned_start date
planned_end date
planned_duration integer
```
> Snapshot figé au moment de la création de la baseline.

---

### `schedule_calendars` — **Migration 009**
```sql
id uuid PK
operation_id uuid → operations
name text NOT NULL              -- 'Calendrier standard'
work_saturday boolean DEFAULT false
work_sunday boolean DEFAULT false
```

### `schedule_calendar_exceptions` — **Migration 009**
```sql
id uuid PK
calendar_id uuid → schedule_calendars
exception_date date NOT NULL
is_working boolean DEFAULT false -- true = jour ouvré, false = jour chômé
label text                       -- 'Fermeture août', 'Jour férié', ...
```

---

### `reserves` — **Migration 009**
```sql
id uuid PK
operation_id uuid → operations
number text                          -- numéro séquentiel auto
unit_id uuid → operation_units
lot_id uuid → lots
schedule_item_id uuid → schedule_items
title text NOT NULL
description text
priority text -- 'low' | 'normal' | 'high' | 'critical'
responsible_user_id uuid → auth.users
company_id uuid → companies
due_date date
status text -- 'open' | 'in_progress' | 'declared_resolved' | 'to_verify' | 'validated' | 'rejected'
resolved_at date
resolution_proof text
created_at timestamptz
created_by uuid → auth.users
```

---

### `rfis` — **Migration 010**
```sql
id uuid PK
operation_id uuid → operations
number text                          -- numéro séquentiel auto
title text NOT NULL
question text NOT NULL
lot_id uuid → lots
company_id uuid → companies
unit_id uuid → operation_units
schedule_item_id uuid → schedule_items
requestor_user_id uuid → auth.users
assignee_user_id uuid → auth.users
requested_at date
response_due_date date
response text
status text -- 'draft' | 'open' | 'pending' | 'answered' | 'validated' | 'closed'
created_at timestamptz
created_by uuid → auth.users
```

### `rfi_events` — **Migration 010**
```sql
id uuid PK
rfi_id uuid → rfis
status text
note text
occurred_at timestamptz
created_by uuid → auth.users
```

---

### `submittals` (VISA) — **Migration 010**
```sql
id uuid PK
operation_id uuid → operations
number text
title text NOT NULL
document_ref text
lot_id uuid → lots
company_id uuid → companies
version text
submitted_at date
submitted_by uuid → auth.users
reviewer_user_id uuid → auth.users
decision text -- 'approved' | 'approved_with_comments' | 'rejected' | 'resubmit'
comments text
status text -- 'to_submit' | 'submitted' | 'under_review' | 'approved_with_obs' | 'approved' | 'rejected' | 'to_resubmit'
created_at timestamptz
```

### `submittal_events` — **Migration 010**
```sql
id uuid PK
submittal_id uuid → submittals
status text
note text
occurred_at timestamptz
created_by uuid → auth.users
```

---

### `photos` — **Migration 011**
```sql
id uuid PK
operation_id uuid → operations
storage_path text NOT NULL       -- chemin Supabase Storage
filename text
caption text
taken_at timestamptz
-- Liaisons multiples (toutes nullables)
visit_id uuid → visits
observation_id uuid → observations
reserve_id uuid → reserves
task_id uuid → tasks
unit_id uuid → operation_units
schedule_item_id uuid → schedule_items
created_at timestamptz
created_by uuid → auth.users
```

---

### `activity_log` — **Migration 011**
```sql
id uuid PK
operation_id uuid → operations
user_id uuid → auth.users
action text NOT NULL             -- 'schedule.update', 'rfi.create', 'observation.close', ...
entity_type text                 -- 'schedule_item' | 'rfi' | 'reserve' | ...
entity_id uuid
payload jsonb                    -- données contextuelles
occurred_at timestamptz
```

---

## 3. Plan des migrations

| N° | Fichier | Contenu |
|---|---|---|
| 001–008 | ✅ Existant | Fondations, business model, DPGF, planning, finance |
| **009** | `202609090009_gantt_cpm_baseline.sql` | Enrichir `operations`, `lots`, `schedule_items`, `schedule_dependencies` ; créer `schedule_baselines`, `schedule_baseline_items`, `schedule_calendars`, `schedule_calendar_exceptions`, `reserves` |
| **010** | `202609090010_rfi_visa.sql` | `rfis`, `rfi_events`, `submittals`, `submittal_events` ; lien `observations.schedule_item_id` |
| **011** | `202609090011_photos_activity.sql` | `photos`, `activity_log` |
| **012** | `202609090012_visits_enrichment.sql` | Enrichir `visits` (`weather`, `next_visit_date`, `status`) |

---

## 4. Migration 009 (Gantt + CPM + Baseline + Réserves)

```sql
-- ============================================================
-- Migration 009 — Gantt CPM, Baseline, Réserves
-- ============================================================

-- 1. Enrichir operations
ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS reference_interne text,
  ADD COLUMN IF NOT EXISTS moa text,
  ADD COLUMN IF NOT EXISTS moe text,
  ADD COLUMN IF NOT EXISTS amo text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS contractual_end_date date,
  ADD COLUMN IF NOT EXISTS budget_global numeric,
  ADD COLUMN IF NOT EXISTS operation_type text DEFAULT 'lots_separes'
    CHECK (operation_type IN ('entreprise_generale', 'lots_separes'));

-- Étendre les statuts possibles
ALTER TABLE public.operations
  DROP CONSTRAINT IF EXISTS operations_status_check;
ALTER TABLE public.operations
  ADD CONSTRAINT operations_status_check
    CHECK (status IN ('preparation', 'consultation', 'travaux', 'opr', 'reception', 'levee_reserves', 'cloturee', 'archived', 'active'));

-- 2. Enrichir lots
ALTER TABLE public.lots
  ADD COLUMN IF NOT EXISTS amount_contract_ht numeric,
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS lot_status text DEFAULT 'actif'
    CHECK (lot_status IN ('actif', 'suspendu', 'termine', 'resilie'));

-- 3. Enrichir schedule_items (champs CPM + milestone + company)
ALTER TABLE public.schedule_items
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_milestone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_critical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wbs_code text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  -- Baseline snapshot sur l'item courant
  ADD COLUMN IF NOT EXISTS baseline_start date,
  ADD COLUMN IF NOT EXISTS baseline_end date,
  -- Champs CPM (calculés par le moteur, stockés en cache)
  ADD COLUMN IF NOT EXISTS early_start date,
  ADD COLUMN IF NOT EXISTS early_finish date,
  ADD COLUMN IF NOT EXISTS late_start date,
  ADD COLUMN IF NOT EXISTS late_finish date,
  ADD COLUMN IF NOT EXISTS total_float integer,
  ADD COLUMN IF NOT EXISTS free_float integer;

-- Statuts planning étendus
ALTER TABLE public.schedule_items
  DROP CONSTRAINT IF EXISTS schedule_items_status_check;
ALTER TABLE public.schedule_items
  ADD CONSTRAINT schedule_items_status_check
    CHECK (status IN ('not_started', 'in_progress', 'done', 'blocked', 'postponed', 'cancelled'));

-- 4. Ajouter lag sur schedule_dependencies
ALTER TABLE public.schedule_dependencies
  ADD COLUMN IF NOT EXISTS lag_days integer NOT NULL DEFAULT 0;

-- 5. Calendriers de travail
CREATE TABLE IF NOT EXISTS public.schedule_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Calendrier standard',
  work_saturday boolean NOT NULL DEFAULT false,
  work_sunday boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_calendar_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES public.schedule_calendars(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  is_working boolean NOT NULL DEFAULT false,
  label text,
  UNIQUE (calendar_id, exception_date)
);

ALTER TABLE public.schedule_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_calendar_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read calendars"
  ON public.schedule_calendars FOR SELECT
  USING (public.is_operation_member(operation_id));
CREATE POLICY "admins manage calendars"
  ON public.schedule_calendars FOR ALL
  USING (public.can_manage_operation(operation_id))
  WITH CHECK (public.can_manage_operation(operation_id));
CREATE POLICY "members read calendar exceptions"
  ON public.schedule_calendar_exceptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.schedule_calendars c
    WHERE c.id = calendar_id AND public.is_operation_member(c.operation_id)
  ));
CREATE POLICY "admins manage calendar exceptions"
  ON public.schedule_calendar_exceptions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.schedule_calendars c
    WHERE c.id = calendar_id AND public.can_manage_operation(c.operation_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.schedule_calendars c
    WHERE c.id = calendar_id AND public.can_manage_operation(c.operation_id)
  ));

-- 6. Baselines planning
CREATE TABLE IF NOT EXISTS public.schedule_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.schedule_baseline_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id uuid NOT NULL REFERENCES public.schedule_baselines(id) ON DELETE CASCADE,
  schedule_item_id uuid NOT NULL REFERENCES public.schedule_items(id) ON DELETE CASCADE,
  title text NOT NULL,
  planned_start date,
  planned_end date,
  planned_duration integer,
  UNIQUE (baseline_id, schedule_item_id)
);

ALTER TABLE public.schedule_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_baseline_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read baselines"
  ON public.schedule_baselines FOR SELECT
  USING (public.is_operation_member(operation_id));
CREATE POLICY "admins manage baselines"
  ON public.schedule_baselines FOR ALL
  USING (public.can_manage_operation(operation_id))
  WITH CHECK (public.can_manage_operation(operation_id));
CREATE POLICY "members read baseline items"
  ON public.schedule_baseline_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.schedule_baselines b
    WHERE b.id = baseline_id AND public.is_operation_member(b.operation_id)
  ));
CREATE POLICY "admins manage baseline items"
  ON public.schedule_baseline_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.schedule_baselines b
    WHERE b.id = baseline_id AND public.can_manage_operation(b.operation_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.schedule_baselines b
    WHERE b.id = baseline_id AND public.can_manage_operation(b.operation_id)
  ));

-- 7. Réserves
CREATE SEQUENCE IF NOT EXISTS reserve_number_seq;

CREATE TABLE IF NOT EXISTS public.reserves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  number text NOT NULL,
  unit_id uuid REFERENCES public.operation_units(id) ON DELETE SET NULL,
  lot_id uuid REFERENCES public.lots(id) ON DELETE SET NULL,
  schedule_item_id uuid REFERENCES public.schedule_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'declared_resolved', 'to_verify', 'validated', 'rejected')),
  resolved_at date,
  resolution_proof text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id)
);

ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read reserves"
  ON public.reserves FOR SELECT
  USING (public.is_operation_member(operation_id));
CREATE POLICY "members create reserves"
  ON public.reserves FOR INSERT
  WITH CHECK (public.can_edit_operation(operation_id) AND created_by = auth.uid());
CREATE POLICY "members update reserves"
  ON public.reserves FOR UPDATE
  USING (public.can_edit_operation(operation_id))
  WITH CHECK (public.can_edit_operation(operation_id));

-- Index
CREATE INDEX IF NOT EXISTS schedule_items_operation_lot_idx
  ON public.schedule_items(operation_id, lot_id, sort_order);
CREATE INDEX IF NOT EXISTS schedule_items_operation_unit_idx
  ON public.schedule_items(operation_id, unit_id);
CREATE INDEX IF NOT EXISTS reserves_operation_status_idx
  ON public.reserves(operation_id, status);
CREATE INDEX IF NOT EXISTS reserves_operation_unit_idx
  ON public.reserves(operation_id, unit_id);
```

---

## 5. Types TypeScript enrichis (cible)

```typescript
// Enrichissement de ScheduleItem
export type ScheduleItem = {
  id: string
  operation_id: string
  lot_id: string | null
  task_id: string | null
  unit_id: string | null
  parent_id: string | null
  company_id: string | null
  responsible_user_id: string | null
  title: string
  wbs_code: string | null
  planned_start: string | null
  planned_end: string | null
  planned_duration: number | null
  actual_start: string | null
  actual_end: string | null
  actual_duration: number | null
  progress: number | null
  status: ScheduleStatus | null
  priority: Priority
  is_milestone: boolean
  is_critical: boolean
  baseline_start: string | null
  baseline_end: string | null
  early_start: string | null
  early_finish: string | null
  late_start: string | null
  late_finish: string | null
  total_float: number | null
  free_float: number | null
  notes: string | null
  sort_order: number
}

export type ScheduleStatus = 'not_started' | 'in_progress' | 'done' | 'blocked' | 'postponed' | 'cancelled'
export type Priority = 'low' | 'normal' | 'high' | 'critical'
export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish'

export type ScheduleDependency = {
  schedule_item_id: string
  predecessor_id: string
  dependency_type: DependencyType
  lag_days: number
}

export type ScheduleBaseline = {
  id: string
  operation_id: string
  name: string
  notes: string | null
  created_at: string
  created_by: string | null
}

export type Reserve = {
  id: string
  operation_id: string
  number: string
  unit_id: string | null
  lot_id: string | null
  schedule_item_id: string | null
  title: string
  description: string | null
  priority: Priority
  responsible_user_id: string | null
  company_id: string | null
  due_date: string | null
  status: 'open' | 'in_progress' | 'declared_resolved' | 'to_verify' | 'validated' | 'rejected'
  resolved_at: string | null
  resolution_proof: string | null
  created_at: string
  created_by: string | null
}
```

---

*Document vivant — mis à jour à chaque nouvelle migration.*
