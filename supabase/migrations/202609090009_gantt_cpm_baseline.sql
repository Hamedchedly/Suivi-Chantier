-- ============================================================
-- Migration 009 — Gantt CPM, Baseline, Réserves, Calendriers
-- Date: 2026-09-09
-- Objectif : Enrichir le schéma pour support complet du moteur Gantt
-- ============================================================

-- 1. Enrichir operations (métadonnées opération)
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

-- Étendre les statuts possibles operations
ALTER TABLE public.operations
  DROP CONSTRAINT IF EXISTS operations_status_check;
ALTER TABLE public.operations
  ADD CONSTRAINT operations_status_check
    CHECK (status IN ('preparation', 'consultation', 'travaux', 'opr', 'reception', 'levee_reserves', 'cloturee', 'archived', 'active'));

-- 2. Enrichir lots (métadonnées lot)
ALTER TABLE public.lots
  ADD COLUMN IF NOT EXISTS amount_contract_ht numeric,
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS lot_status text DEFAULT 'actif'
    CHECK (lot_status IN ('actif', 'suspendu', 'termine', 'resilie'));

-- 3. Enrichir schedule_items (champs CPM, milestone, company, priority)
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

-- Étendre les statuts schedule_items
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

-- 8. Indexes pour performances
CREATE INDEX IF NOT EXISTS schedule_items_operation_lot_idx
  ON public.schedule_items(operation_id, lot_id, sort_order);
CREATE INDEX IF NOT EXISTS schedule_items_operation_unit_idx
  ON public.schedule_items(operation_id, unit_id);
CREATE INDEX IF NOT EXISTS schedule_items_company_idx
  ON public.schedule_items(company_id);
CREATE INDEX IF NOT EXISTS reserves_operation_status_idx
  ON public.reserves(operation_id, status);
CREATE INDEX IF NOT EXISTS reserves_operation_unit_idx
  ON public.reserves(operation_id, unit_id);
CREATE INDEX IF NOT EXISTS reserves_schedule_item_idx
  ON public.reserves(schedule_item_id);
CREATE INDEX IF NOT EXISTS baselines_operation_idx
  ON public.schedule_baselines(operation_id);

-- 9. Trigger pour vérifier intégrité reserves (même operation)
CREATE FUNCTION public.assert_reserve_same_operation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE expected_operation uuid;
BEGIN
  IF new.unit_id IS NOT NULL THEN
    SELECT operation_id INTO expected_operation FROM public.operation_units WHERE id = new.unit_id;
    IF expected_operation IS DISTINCT FROM new.operation_id THEN
      RAISE EXCEPTION 'Reserve unit must belong to the same operation';
    END IF;
  END IF;
  IF new.lot_id IS NOT NULL THEN
    SELECT operation_id INTO expected_operation FROM public.lots WHERE id = new.lot_id;
    IF expected_operation IS DISTINCT FROM new.operation_id THEN
      RAISE EXCEPTION 'Reserve lot must belong to the same operation';
    END IF;
  END IF;
  IF new.schedule_item_id IS NOT NULL THEN
    SELECT operation_id INTO expected_operation FROM public.schedule_items WHERE id = new.schedule_item_id;
    IF expected_operation IS DISTINCT FROM new.operation_id THEN
      RAISE EXCEPTION 'Reserve schedule_item must belong to the same operation';
    END IF;
  END IF;
  IF new.company_id IS NOT NULL THEN
    SELECT operation_id INTO expected_operation FROM public.companies WHERE id = new.company_id;
    IF expected_operation IS DISTINCT FROM new.operation_id THEN
      RAISE EXCEPTION 'Reserve company must belong to the same operation';
    END IF;
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER reserves_same_operation BEFORE INSERT OR UPDATE ON public.reserves
  FOR EACH ROW EXECUTE PROCEDURE public.assert_reserve_same_operation();

-- Migration 009 end
