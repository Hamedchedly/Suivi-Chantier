-- Synchronisation clé-valeur par utilisateur : miroir serveur du modèle local
-- de l'application. Chaque clé localStorage (ex. « sc-gantt-v2::p1 ») devient
-- une ligne (user_id, k) → v (JSONB). Additif, RLS strict sur auth.uid().
--
-- La couche src/lib/repo.ts hydrate ces lignes à la connexion et y écrit en
-- miroir (write-through) à chaque sauvegarde ; l'API synchrone des composants
-- reste inchangée. Voir docs/SUPABASE.md.

-- v est nullable : certaines clés valent légitimement null (ex.
-- sc-current-project-v1 quand aucune opération n'est active). Une contrainte
-- NOT NULL ferait échouer le lot d'upsert complet sur ces valeurs.
create table if not exists public.app_state (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  k text not null,
  v jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);

alter table public.app_state enable row level security;

drop policy if exists app_state_select on public.app_state;
drop policy if exists app_state_insert on public.app_state;
drop policy if exists app_state_update on public.app_state;
drop policy if exists app_state_delete on public.app_state;

create policy app_state_select on public.app_state for select using (user_id = auth.uid());
create policy app_state_insert on public.app_state for insert with check (user_id = auth.uid());
create policy app_state_update on public.app_state for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy app_state_delete on public.app_state for delete using (user_id = auth.uid());
