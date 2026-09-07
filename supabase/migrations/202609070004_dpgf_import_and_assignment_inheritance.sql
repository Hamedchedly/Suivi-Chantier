-- Restored DPGF/import block. Depends on migrations 001–003 and preserves their integrity controls.
alter table public.tasks add column source_sheet text, add column source_row integer, add column source_reference text, add column import_id uuid;
alter table public.lot_assignments add column enabled boolean not null default true;

create table public.dpgf_imports (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null references public.operations(id) on delete cascade,
  filename text not null, imported_at timestamptz not null default now(), imported_by uuid not null default auth.uid() references auth.users(id),
  column_mapping jsonb not null default '{}'::jsonb
);
alter table public.dpgf_imports enable row level security;
alter table public.tasks add constraint tasks_import_id_fkey foreign key (import_id) references public.dpgf_imports(id) on delete set null;
create policy "members read DPGF imports" on public.dpgf_imports for select using (public.is_operation_member(operation_id));
create policy "admins create DPGF imports" on public.dpgf_imports for insert with check (public.can_manage_operation(operation_id) and imported_by = auth.uid());

create function public.assert_task_import_same_operation() returns trigger language plpgsql set search_path = public as $$
declare import_operation uuid;
begin
  if new.import_id is not null then
    select operation_id into import_operation from public.dpgf_imports where id = new.import_id;
    if import_operation is distinct from new.operation_id then raise exception 'Task import must belong to the same operation'; end if;
  end if;
  return new;
end;
$$;
create trigger tasks_import_same_operation before insert or update on public.tasks for each row execute procedure public.assert_task_import_same_operation();

create function public.effective_lot_assignments(target_unit uuid) returns table(lot_id uuid, enabled boolean, source text) language sql stable security definer set search_path = public as $$
  with recursive ancestors as (
    select id, parent_id, operation_id, 0 depth from public.operation_units where id = target_unit and public.is_operation_member(operation_id)
    union all select unit.id, unit.parent_id, unit.operation_id, ancestor.depth + 1 from public.operation_units unit join ancestors ancestor on ancestor.parent_id = unit.id
  ), ranked as (
    select assignment.lot_id, assignment.enabled, case when ancestor.depth = 0 then 'specific' else 'inherited' end source,
      row_number() over (partition by assignment.lot_id order by ancestor.depth) position
    from public.lot_assignments assignment join ancestors ancestor on ancestor.id = assignment.unit_id
  ) select lot_id, enabled, source from ranked where position = 1
$$;
