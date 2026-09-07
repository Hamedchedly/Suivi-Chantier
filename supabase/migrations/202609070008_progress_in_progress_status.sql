-- Allows the operational status 'in_progress' (En cours) used during visits,
-- distinct from the physical percentage. Non-destructive: replaces the CHECK only.
alter table public.progress_entries drop constraint if exists progress_entries_status_check;
alter table public.progress_entries add constraint progress_entries_status_check check (status in ('done', 'cancelled', 'not_started', 'reminder', 'blocked', 'postponed', 'new', 'to_verify', 'not_applicable', 'in_progress'));