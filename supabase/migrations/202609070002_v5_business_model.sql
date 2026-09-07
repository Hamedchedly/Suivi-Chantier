-- V5 business model. All records are scoped to an operation and protected by membership RLS.
alter table public.operation_units add column code text, add column floor text;
alter table public.lots add column company_id uuid, add column number text;
alter table public.tasks add column section text, add column unit text, add column quantity numeric, add column unit_price numeric, add column amount numeric;

create table public.companies (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null references public.operations(id) on delete cascade,
  name text not null, contact_name text, email text, phone text, address text, created_at timestamptz not null default now()
);
alter table public.lots add constraint lots_company_id_fkey foreign key (company_id) references public.companies(id) on delete set null;

create table public.lot_assignments (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  unit_id uuid references public.operation_units(id) on delete cascade,
  scope text not null check (scope in ('operation', 'building', 'dwelling', 'common_area', 'exterior')),
  created_at timestamptz not null default now(),
  unique nulls not distinct (lot_id, unit_id)
);

create table public.visits (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null references public.operations(id) on delete cascade,
  visited_at timestamptz not null default now(), title text, note text, created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id)
);
create table public.visit_attendees (
  id uuid primary key default gen_random_uuid(), visit_id uuid not null references public.visits(id) on delete cascade, company_id uuid references public.companies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null, name text
);
create table public.progress_entries (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null references public.operations(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete set null, unit_id uuid references public.operation_units(id) on delete set null,
  lot_id uuid not null references public.lots(id) on delete cascade, task_id uuid references public.tasks(id) on delete set null,
  progressed_at timestamptz not null default now(), percentage numeric check (percentage between 0 and 100),
  status text not null check (status in ('done', 'cancelled', 'not_started', 'reminder', 'blocked', 'postponed', 'new', 'to_verify', 'not_applicable')),
  comment text, created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id)
);
create table public.observation_events (
  id uuid primary key default gen_random_uuid(), observation_id uuid not null references public.observations(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete set null, status text not null check (status in ('done', 'cancelled', 'not_started', 'reminder', 'blocked', 'postponed', 'new', 'to_verify')),
  note text, occurred_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id)
);

alter table public.companies enable row level security;
alter table public.lot_assignments enable row level security;
alter table public.visits enable row level security;
alter table public.visit_attendees enable row level security;
alter table public.progress_entries enable row level security;
alter table public.observation_events enable row level security;

create function public.can_manage_operation(target_operation uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.operation_members where operation_id = target_operation and user_id = auth.uid() and role in ('owner', 'admin'))
$$;
create function public.can_edit_operation(target_operation uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.operation_members where operation_id = target_operation and user_id = auth.uid() and role in ('owner', 'admin', 'member'))
$$;

-- Read access is membership-only. Write access deliberately excludes viewers.
create policy "members read companies" on public.companies for select using (public.is_operation_member(operation_id));
create policy "admins manage companies" on public.companies for all using (public.can_manage_operation(operation_id)) with check (public.can_manage_operation(operation_id));
create policy "members read assignments" on public.lot_assignments for select using (public.is_operation_member(operation_id));
create policy "admins manage assignments" on public.lot_assignments for all using (public.can_manage_operation(operation_id)) with check (public.can_manage_operation(operation_id));
create policy "members read visits" on public.visits for select using (public.is_operation_member(operation_id));
create policy "members create visits" on public.visits for insert with check (public.can_edit_operation(operation_id) and created_by = auth.uid());
create policy "members update visits" on public.visits for update using (public.can_edit_operation(operation_id)) with check (public.can_edit_operation(operation_id));
create policy "members read attendees" on public.visit_attendees for select using (exists (select 1 from public.visits v where v.id = visit_id and public.is_operation_member(v.operation_id)));
create policy "members add attendees" on public.visit_attendees for insert with check (exists (select 1 from public.visits v where v.id = visit_id and public.can_edit_operation(v.operation_id)));
create policy "members read progress" on public.progress_entries for select using (public.is_operation_member(operation_id));
create policy "members append progress" on public.progress_entries for insert with check (public.can_edit_operation(operation_id) and created_by = auth.uid());
create policy "members read observation history" on public.observation_history for select using (exists (select 1 from public.observations o where o.id = observation_id and public.is_operation_member(o.operation_id)));
create policy "members read observation events" on public.observation_events for select using (exists (select 1 from public.observations o where o.id = observation_id and public.is_operation_member(o.operation_id)));
create policy "members append observation events" on public.observation_events for insert with check (created_by = auth.uid() and exists (select 1 from public.observations o where o.id = observation_id and public.can_edit_operation(o.operation_id)));

-- Complete the original foundation policies with safe administrator/member write paths.
create policy "admins manage units" on public.operation_units for all using (public.can_manage_operation(operation_id)) with check (public.can_manage_operation(operation_id));
create policy "admins manage lots" on public.lots for all using (public.can_manage_operation(operation_id)) with check (public.can_manage_operation(operation_id));
create policy "admins manage tasks" on public.tasks for all using (public.can_manage_operation(operation_id)) with check (public.can_manage_operation(operation_id));
create policy "members create observations" on public.observations for insert with check (public.can_edit_operation(operation_id) and created_by = auth.uid());
create policy "members update observations" on public.observations for update using (public.can_edit_operation(operation_id)) with check (public.can_edit_operation(operation_id));
create policy "admins update operations" on public.operations for update using (public.can_manage_operation(id)) with check (public.can_manage_operation(id));
