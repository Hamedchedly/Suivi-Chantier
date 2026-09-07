-- Replaces the original trigger function without altering prior migrations.
-- Each relation-specific NEW field is only accessed inside its own table branch.
create or replace function public.assert_same_operation() returns trigger language plpgsql set search_path = public as $$
declare expected_operation uuid;
begin
  if tg_table_name = 'operation_units' then
    if new.parent_id is not null then
      select operation_id into expected_operation from public.operation_units where id = new.parent_id;
      if expected_operation is distinct from new.operation_id then raise exception 'Unit parent must belong to the same operation'; end if;
    end if;
  elsif tg_table_name = 'lots' then
    if new.company_id is not null then
      select operation_id into expected_operation from public.companies where id = new.company_id;
      if expected_operation is distinct from new.operation_id then raise exception 'Lot company must belong to the same operation'; end if;
    end if;
  elsif tg_table_name = 'tasks' then
    select operation_id into expected_operation from public.lots where id = new.lot_id;
    if expected_operation is distinct from new.operation_id then raise exception 'Task lot must belong to the same operation'; end if;
  elsif tg_table_name = 'lot_assignments' then
    select operation_id into expected_operation from public.lots where id = new.lot_id;
    if expected_operation is distinct from new.operation_id then raise exception 'Assigned lot must belong to the same operation'; end if;
    if new.unit_id is not null then
      select operation_id into expected_operation from public.operation_units where id = new.unit_id;
      if expected_operation is distinct from new.operation_id then raise exception 'Assigned unit must belong to the same operation'; end if;
    end if;
  elsif tg_table_name = 'progress_entries' then
    select operation_id into expected_operation from public.lots where id = new.lot_id;
    if expected_operation is distinct from new.operation_id then raise exception 'Progress lot must belong to the same operation'; end if;
    if new.task_id is not null then
      select operation_id into expected_operation from public.tasks where id = new.task_id;
      if expected_operation is distinct from new.operation_id then raise exception 'Progress task must belong to the same operation'; end if;
    end if;
  end if;
  return new;
end;
$$;

-- Explicit, idempotent seed helper. It never runs automatically and needs a real Auth user UUID.
-- DPGF rows are intentionally excluded: they must be imported from the source workbook.
create or replace function public.seed_gambetta_111_operation(owner_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare operation_uuid uuid;
begin
  if not exists (select 1 from auth.users where id = owner_id) then raise exception 'owner_id must reference an existing auth user'; end if;
  select id into operation_uuid from public.operations where name = '111 Rue Gambetta — 51100 Reims' and address = '111 Rue Gambetta, 51100 Reims' limit 1;
  if operation_uuid is null then
    insert into public.operations(name, address, created_by) values ('111 Rue Gambetta — 51100 Reims', '111 Rue Gambetta, 51100 Reims', owner_id) returning id into operation_uuid;
  end if;
  insert into public.operation_members(operation_id, user_id, role) values (operation_uuid, owner_id, 'owner') on conflict (operation_id, user_id) do nothing;
  insert into public.companies(operation_id, name)
    select operation_uuid, source.name from (values ('LERICHE'), ('BUCZEK'), ('PFC ISOLATION'), ('LA SERRURERIE REMOISE'), ('SMP AMENAGEMENT'), ('SOVECLIM SERVICES'), ('SORETHERM')) source(name)
    where not exists (select 1 from public.companies c where c.operation_id = operation_uuid and c.name = source.name);
  insert into public.lots(operation_id, number, code, name, company_id, sort_order)
    select operation_uuid, source.number, source.number, source.name, c.id, source.sort_order from (values
      ('LOT01', 'Démolition / Structure', 'LERICHE', 1), ('LOT02', 'Couverture', 'BUCZEK', 2), ('LOT03', 'Façade / ITE', 'PFC ISOLATION', 3), ('LOT04', 'Menuiseries extérieures / Serrurerie', 'LA SERRURERIE REMOISE', 4),
      ('LOT05', 'Menuiseries intérieures / Isolation intérieure', 'SMP AMENAGEMENT', 5), ('LOT06', 'Electricité / Contrôle d’accès', 'SOVECLIM SERVICES', 6), ('LOT07', 'CVC', 'SORETHERM', 7), ('LOT08', 'Embellissements', 'SMP AMENAGEMENT', 8)
    ) source(number, name, company_name, sort_order) join public.companies c on c.operation_id = operation_uuid and c.name = source.company_name
    where not exists (select 1 from public.lots l where l.operation_id = operation_uuid and l.number = source.number);
  insert into public.operation_units(operation_id, kind, code, name, sort_order)
    select operation_uuid, 'building', source.code, source.name, source.sort_order from (values ('A', 'Bâtiment A', 1), ('B', 'Bâtiment B', 2), ('C', 'Bâtiment C', 3)) source(code, name, sort_order)
    where not exists (select 1 from public.operation_units u where u.operation_id = operation_uuid and u.code = source.code);
  insert into public.operation_units(operation_id, kind, code, name, sort_order)
    select operation_uuid, 'common_area', source.code, source.name, source.sort_order from (values ('COUR_AB', 'Cour commune BAT A/B', 4), ('COUR_BC', 'Cour commune BAT B/C', 5)) source(code, name, sort_order)
    where not exists (select 1 from public.operation_units u where u.operation_id = operation_uuid and u.code = source.code);
  insert into public.operation_units(operation_id, parent_id, kind, code, name, floor, sort_order)
    select operation_uuid, building.id, 'dwelling', source.code, 'Logement ' || source.code, source.floor, source.sort_order from (values ('3', 'A', 'R+2', 1), ('4', 'A', 'R+2', 2), ('1', 'B', 'RDC', 3), ('2', 'B', 'R+1', 4), ('5', 'C', 'RDC', 5), ('6', 'C', 'R+1', 6), ('7', 'C', 'R+2', 7)) source(code, building_code, floor, sort_order)
      join public.operation_units building on building.operation_id = operation_uuid and building.code = source.building_code
    where not exists (select 1 from public.operation_units u where u.operation_id = operation_uuid and u.kind = 'dwelling' and u.code = source.code);
  insert into public.lot_assignments(operation_id, lot_id, unit_id, scope, enabled)
    select operation_uuid, lot.id, unit.id, 'dwelling', true from (values ('LOT08', '3'), ('LOT08', '4'), ('LOT08', '5'), ('LOT08', '6'), ('LOT08', '7'), ('LOT06', '5'), ('LOT06', '6'), ('LOT07', 'A'), ('LOT07', 'B'), ('LOT07', 'C')) source(lot_number, unit_code)
      join public.lots lot on lot.operation_id = operation_uuid and lot.number = source.lot_number
      join public.operation_units unit on unit.operation_id = operation_uuid and unit.code = source.unit_code
    where not exists (select 1 from public.lot_assignments assignment where assignment.lot_id = lot.id and assignment.unit_id = unit.id);
  return operation_uuid;
end;
$$;
revoke execute on function public.seed_gambetta_111_operation(uuid) from public, anon, authenticated;
