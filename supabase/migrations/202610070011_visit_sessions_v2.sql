-- Visite v2 : une ligne par session de visite, document JSON complet.
-- Écrite à la sortie de chaque lot / logement / page et à la clôture
-- (src/lib/visitV2/store.ts). RLS strict sur auth.uid().

create table if not exists public.visit_sessions_v2 (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  project_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists visit_sessions_v2_project_idx
  on public.visit_sessions_v2 (user_id, project_id);

alter table public.visit_sessions_v2 enable row level security;

drop policy if exists visit_sessions_v2_select on public.visit_sessions_v2;
drop policy if exists visit_sessions_v2_insert on public.visit_sessions_v2;
drop policy if exists visit_sessions_v2_update on public.visit_sessions_v2;
drop policy if exists visit_sessions_v2_delete on public.visit_sessions_v2;

create policy visit_sessions_v2_select on public.visit_sessions_v2 for select using (user_id = auth.uid());
create policy visit_sessions_v2_insert on public.visit_sessions_v2 for insert with check (user_id = auth.uid());
create policy visit_sessions_v2_update on public.visit_sessions_v2 for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy visit_sessions_v2_delete on public.visit_sessions_v2 for delete using (user_id = auth.uid());
