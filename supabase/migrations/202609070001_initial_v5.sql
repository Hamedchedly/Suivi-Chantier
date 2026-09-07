-- Multi-operation foundation. Business structure is data-driven: no operation, lot or task is seeded here.
create extension if not exists "pgcrypto";

create table public.operations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  address text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id)
);

create table public.operation_members (
  operation_id uuid not null references public.operations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  primary key (operation_id, user_id)
);

create table public.operation_units (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  parent_id uuid references public.operation_units(id) on delete cascade,
  kind text not null check (kind in ('building', 'dwelling', 'common_area', 'exterior', 'zone')),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  code text,
  name text not null,
  weighting_method text not null default 'simple' check (weighting_method in ('simple', 'weighted')),
  sort_order integer not null default 0
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  parent_id uuid references public.tasks(id) on delete cascade,
  reference text,
  name text not null,
  weight numeric not null default 1 check (weight >= 0),
  sort_order integer not null default 0
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  unit_id uuid references public.operation_units(id) on delete set null,
  lot_id uuid references public.lots(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  status text not null default 'new' check (status in ('done', 'cancelled', 'not_started', 'reminder', 'blocked', 'postponed', 'new', 'to_verify')),
  title text not null,
  detail text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  due_date date,
  responsible_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id)
);

create table public.observation_history (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations(id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_by uuid default auth.uid() references auth.users(id),
  action text not null,
  snapshot jsonb not null
);

alter table public.operations enable row level security;
alter table public.operation_members enable row level security;
alter table public.operation_units enable row level security;
alter table public.lots enable row level security;
alter table public.tasks enable row level security;
alter table public.observations enable row level security;
alter table public.observation_history enable row level security;

create function public.is_operation_member(target_operation uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.operation_members where operation_id = target_operation and user_id = auth.uid())
$$;

create policy "members can read operations" on public.operations for select using (public.is_operation_member(id));
create policy "authenticated users create operations" on public.operations for insert to authenticated with check (created_by = auth.uid());
create policy "members can read membership" on public.operation_members for select using (public.is_operation_member(operation_id));
create policy "operation data is visible to members" on public.operation_units for select using (public.is_operation_member(operation_id));
create policy "operation data is visible to members" on public.lots for select using (public.is_operation_member(operation_id));
create policy "operation data is visible to members" on public.tasks for select using (public.is_operation_member(operation_id));
create policy "operation data is visible to members" on public.observations for select using (public.is_operation_member(operation_id));

create function public.add_operation_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.operation_members(operation_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
create trigger operation_owner_after_insert after insert on public.operations for each row execute procedure public.add_operation_owner();

create function public.capture_observation_history() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.observation_history(observation_id, action, snapshot) values (new.id, tg_op, to_jsonb(new));
  return new;
end;
$$;
create trigger observation_history_after_change after insert or update on public.observations for each row execute procedure public.capture_observation_history();
