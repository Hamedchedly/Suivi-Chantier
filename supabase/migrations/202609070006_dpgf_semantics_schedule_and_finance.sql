-- Generic extensions for source DPGF, scheduling and financial tracking. No project data is seeded here.
alter table public.tasks add column task_type text not null default 'item' check (task_type in ('section', 'item')),
  add column source_payload jsonb not null default '{}'::jsonb;
alter table public.tasks add constraint task_progressable_check check ((task_type = 'item') or (weight = 0));
create index tasks_import_source_idx on public.tasks(import_id, source_sheet, source_row);

create table public.schedule_items (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null, task_id uuid references public.tasks(id) on delete set null,
  unit_id uuid references public.operation_units(id) on delete set null, parent_id uuid references public.schedule_items(id) on delete set null,
  title text not null, planned_start date, planned_end date, planned_duration integer check (planned_duration is null or planned_duration >= 0),
  actual_start date, actual_end date, actual_duration integer check (actual_duration is null or actual_duration >= 0),
  progress numeric check (progress between 0 and 100), status text, notes text, sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.schedule_dependencies (
  schedule_item_id uuid not null references public.schedule_items(id) on delete cascade,
  predecessor_id uuid not null references public.schedule_items(id) on delete restrict,
  dependency_type text not null default 'finish_to_start' check (dependency_type in ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
  primary key (schedule_item_id, predecessor_id), check (schedule_item_id <> predecessor_id)
);
create table public.markets (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null, company_id uuid references public.companies(id) on delete set null,
  reference text, name text not null, initial_amount_ht numeric, initial_amount_ttc numeric, created_at timestamptz not null default now()
);
create table public.market_amendments (
  id uuid primary key default gen_random_uuid(), market_id uuid not null references public.markets(id) on delete cascade,
  description text not null, reason text, requested_amount numeric, negotiated_amount numeric, approved_amount numeric,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')), created_at timestamptz not null default now()
);
create table public.market_situations (
  id uuid primary key default gen_random_uuid(), market_id uuid not null references public.markets(id) on delete cascade,
  number text not null, period_start date, period_end date, issued_at date, period_amount numeric, cumulative_amount numeric, paid_amount numeric,
  status text not null default 'draft' check (status in ('draft', 'issued', 'approved', 'paid', 'rejected')), unique (market_id, number)
);
alter table public.schedule_items enable row level security;
alter table public.schedule_dependencies enable row level security;
alter table public.markets enable row level security;
alter table public.market_amendments enable row level security;
alter table public.market_situations enable row level security;
create policy "members read schedule" on public.schedule_items for select using (public.is_operation_member(operation_id));
create policy "admins manage schedule" on public.schedule_items for all using (public.can_manage_operation(operation_id)) with check (public.can_manage_operation(operation_id));
create policy "members read schedule dependencies" on public.schedule_dependencies for select using (exists (select 1 from public.schedule_items s where s.id = schedule_item_id and public.is_operation_member(s.operation_id)));
create policy "admins manage schedule dependencies" on public.schedule_dependencies for all using (exists (select 1 from public.schedule_items s where s.id = schedule_item_id and public.can_manage_operation(s.operation_id))) with check (exists (select 1 from public.schedule_items s where s.id = schedule_item_id and public.can_manage_operation(s.operation_id)));
create policy "members read markets" on public.markets for select using (public.is_operation_member(operation_id));
create policy "admins manage markets" on public.markets for all using (public.can_manage_operation(operation_id)) with check (public.can_manage_operation(operation_id));
create policy "members read amendments" on public.market_amendments for select using (exists (select 1 from public.markets m where m.id = market_id and public.is_operation_member(m.operation_id)));
create policy "admins manage amendments" on public.market_amendments for all using (exists (select 1 from public.markets m where m.id = market_id and public.can_manage_operation(m.operation_id))) with check (exists (select 1 from public.markets m where m.id = market_id and public.can_manage_operation(m.operation_id)));
create policy "members read situations" on public.market_situations for select using (exists (select 1 from public.markets m where m.id = market_id and public.is_operation_member(m.operation_id)));
create policy "admins manage situations" on public.market_situations for all using (exists (select 1 from public.markets m where m.id = market_id and public.can_manage_operation(m.operation_id))) with check (exists (select 1 from public.markets m where m.id = market_id and public.can_manage_operation(m.operation_id)));

create function public.assert_schedule_item_same_operation() returns trigger language plpgsql set search_path = public as $$
declare expected_operation uuid;
begin
  if new.lot_id is not null then select operation_id into expected_operation from public.lots where id = new.lot_id; if expected_operation is distinct from new.operation_id then raise exception 'Schedule lot must belong to the same operation'; end if; end if;
  if new.task_id is not null then select operation_id into expected_operation from public.tasks where id = new.task_id; if expected_operation is distinct from new.operation_id then raise exception 'Schedule task must belong to the same operation'; end if; end if;
  if new.unit_id is not null then select operation_id into expected_operation from public.operation_units where id = new.unit_id; if expected_operation is distinct from new.operation_id then raise exception 'Schedule unit must belong to the same operation'; end if; end if;
  return new;
end;
$$;
create trigger schedule_items_same_operation before insert or update on public.schedule_items for each row execute procedure public.assert_schedule_item_same_operation();
