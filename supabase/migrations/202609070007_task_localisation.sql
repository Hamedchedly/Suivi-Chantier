-- Prepares the task → localisation link:each task may target one unit of the same operation.
 -- Non-destructive:adds a column, a same-operation guard and read indexes.


 alter table public.tasks add column unit_id uuid references public.operation_units(id) on delete set null;


 create function public.assert_task_unit_same_operation() returns trigger language plpgsql set search_path = public as $$
 declare expected_operation uuid;
 begin
   if new.unit_id is not null then
     select operation_id into expected_operation from public.operation_units where id = new.unit_id;
     if expected_operation is distinct from new.operation_id then
       raise exception 'Task unit must belong to the same operation';
     end if;
   end if;
   return new;
 end;
 $$;
 create trigger tasks_unit_same_operation before insert or update on public.tasks for each row execute procedure public.assert_task_unit_same_operation();


 create index tasks_operation_parent_idx on public.tasks(operation_id, parent_id, sort_order);
 create index tasks_operation_unit_idx on public.tasks(operation_id, unit_id);