-- Connexion par e-mail OU identifiant + demandes de démo (auto-inscription).
--
-- • profiles.username : identifiant court, unique, insensible à la casse (citext).
-- • email_for_login(identifier) : résout un identifiant OU un e-mail vers l'e-mail,
--   avant sign-in (le client Supabase s'authentifie toujours par e-mail).
--   SECURITY DEFINER (contourne la RLS de profiles), exposé à anon.
-- • demo_requests : le demandeur s'inscrit (fonction Edge « demo-signup »,
--   service_role) avec un compte DÉSACTIVÉ ; le super-admin valide et ouvre les
--   modules. RLS : super-admin uniquement (aucun accès anonyme direct).

create extension if not exists citext;
alter table public.profiles add column if not exists username citext unique;

create or replace function public.email_for_login(identifier text)
returns text language sql security definer set search_path = public as $$
  select email from public.profiles
  where lower(email) = lower(identifier) or username = identifier
  limit 1
$$;
revoke all on function public.email_for_login(text) from public;
grant execute on function public.email_for_login(text) to anon, authenticated;

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text,
  email text,
  company text,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.demo_requests enable row level security;
drop policy if exists demo_requests_admin_all on public.demo_requests;
create policy demo_requests_admin_all on public.demo_requests
  for all using (public.is_superadmin()) with check (public.is_superadmin());
