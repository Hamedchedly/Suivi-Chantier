alter table public.tasks add column source_sheet text, add column source_row integer, add column source_reference text;
alter table public.lot_assignments add column enabled boolean not null default true;

create table public.dpgf_imports (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null references public.operations(id) on delete cascade,
  filename text not null, imported_at timestamptz not null default now(), imported_by uuid not null default auth.uid() references auth.users(id),
  column_mapping jsonb not null default '{}'::jsonb
);
alter table public.dpgf_imports enable row level security;
create policy "members read DPGF imports" on public.dpgf_imports for select using (public.is_operation_member(operation_id));
create policy "admins create DPGF imports" on public.dpgf_imports for insert with check (public.can_manage_operation(operation_id) and imported_by = auth.uid());

-- Resolves a location's effective lots. A local assignment takes precedence over its direct building assignment;
-- rows with enabled=false explicitly turn inherited applicability off.
create function public.effective_lot_assignments(target_unit uuid) returns table(lot_id uuid, enabled boolean, source text) language sql stable security definer set search_path = public as $$
  with recursive ancestors as (select id, parent_id, 0 depth from public.operation_units where id = target_unit union all select u.id, u.parent_id, a.depth + 1 from public.operation_units u join ancestors a on a.parent_id = u.id),
  ranked as (select la.lot_id, la.enabled, case when a.depth = 0 then 'specific' else 'inherited' end source, row_number() over (partition by la.lot_id order by a.depth) position from public.lot_assignments la join ancestors a on a.id = la.unit_id)
  select lot_id, enabled, source from ranked where position = 1
$$;
