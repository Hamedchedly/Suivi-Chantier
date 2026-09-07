-- Validation hardening added after the V5 data-model audit.  Existing migrations remain immutable.
create index operation_units_operation_parent_idx on public.operation_units(operation_id, parent_id, sort_order);
create index lots_operation_sort_idx on public.lots(operation_id, sort_order);
create index tasks_operation_lot_sort_idx on public.tasks(operation_id, lot_id, sort_order);
create index lot_assignments_operation_unit_idx on public.lot_assignments(operation_id, unit_id);
create index visits_operation_date_idx on public.visits(operation_id, visited_at desc);
create index progress_entries_operation_lookup_idx on public.progress_entries(operation_id, unit_id, lot_id, task_id, progressed_at desc);
create index observation_events_observation_date_idx on public.observation_events(observation_id, occurred_at);

create function public.assert_same_operation() returns trigger language plpgsql set search_path = public as $$
declare expected_operation uuid;
begin
  if tg_table_name = 'operation_units' and new.parent_id is not null then
    select operation_id into expected_operation from public.operation_units where id = new.parent_id;
    if expected_operation is distinct from new.operation_id then raise exception 'Unit parent must belong to the same operation'; end if;
  elsif tg_table_name = 'lots' and new.company_id is not null then
    select operation_id into expected_operation from public.companies where id = new.company_id;
    if expected_operation is distinct from new.operation_id then raise exception 'Lot company must belong to the same operation'; end if;
  elsif tg_table_name = 'tasks' then
    select operation_id into expected_operation from public.lots where id = new.lot_id;
    if expected_operation is distinct from new.operation_id then raise exception 'Task lot must belong to the same operation'; end if;
  elsif tg_table_name = 'lot_assignments' then
    select operation_id into expected_operation from public.lots where id = new.lot_id;
    if expected_operation is distinct from new.operation_id then raise exception 'Assigned lot must belong to the same operation'; end if;
    if new.unit_id is not null then select operation_id into expected_operation from public.operation_units where id = new.unit_id; if expected_operation is distinct from new.operation_id then raise exception 'Assigned unit must belong to the same operation'; end if; end if;
  elsif tg_table_name = 'progress_entries' then
    select operation_id into expected_operation from public.lots where id = new.lot_id;
    if expected_operation is distinct from new.operation_id then raise exception 'Progress lot must belong to the same operation'; end if;
    if new.task_id is not null then select operation_id into expected_operation from public.tasks where id = new.task_id; if expected_operation is distinct from new.operation_id then raise exception 'Progress task must belong to the same operation'; end if; end if;
  end if;
  return new;
end;
$$;
create trigger operation_units_same_operation before insert or update on public.operation_units for each row execute procedure public.assert_same_operation();
create trigger lots_same_operation before insert or update on public.lots for each row execute procedure public.assert_same_operation();
create trigger tasks_same_operation before insert or update on public.tasks for each row execute procedure public.assert_same_operation();
create trigger lot_assignments_same_operation before insert or update on public.lot_assignments for each row execute procedure public.assert_same_operation();
create trigger progress_entries_same_operation before insert or update on public.progress_entries for each row execute procedure public.assert_same_operation();

-- Membership changes are administrative. Viewers cannot self-elevate or write operation data.
create policy "admins manage operation membership" on public.operation_members for all using (public.can_manage_operation(operation_id)) with check (public.can_manage_operation(operation_id));
