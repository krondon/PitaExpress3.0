set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.assign_order_to_employee()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    vzla_employee_id UUID;
    china_employee_id UUID;
BEGIN
    -- Lógica para asignar a un empleado de Vzla
    IF NEW."asignedEVzla" IS NOT NULL THEN
        -- Si ya viene asignado manualmente, solo actualizamos el contador del empleado
        UPDATE employees
        SET assigned_orders = assigned_orders + 1
        WHERE user_id = NEW."asignedEVzla";
    ELSE
        -- Asignación automática
        SELECT user_id INTO vzla_employee_id
        FROM employees
        WHERE user_level = 'Vzla'
        ORDER BY assigned_orders ASC
        LIMIT 1;

        IF vzla_employee_id IS NOT NULL THEN
            -- Asignación directa al registro que se está insertando
            NEW."asignedEVzla" := vzla_employee_id;
            
            UPDATE employees
            SET assigned_orders = assigned_orders + 1
            WHERE user_id = vzla_employee_id;
        END IF;
    END IF;

    -- Lógica para asignar a un empleado de China
    IF NEW."asignedEChina" IS NOT NULL THEN
        -- Si ya viene asignado manualmente, solo actualizamos el contador del empleado
        UPDATE employees
        SET assigned_orders = assigned_orders + 1
        WHERE user_id = NEW."asignedEChina";
    ELSE
        -- Asignación automática
        SELECT user_id INTO china_employee_id
        FROM employees
        WHERE user_level = 'China'
        ORDER BY assigned_orders ASC
        LIMIT 1;

        IF china_employee_id IS NOT NULL THEN
            -- Asignación directa al registro que se está insertando
            NEW."asignedEChina" := china_employee_id;
            
            UPDATE employees
            SET assigned_orders = assigned_orders + 1
            WHERE user_id = china_employee_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$
;

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "storage"."objects";
create policy "Enable insert for authenticated users only"
on "storage"."objects"
as permissive
for insert
to authenticated
with check (true);



DROP POLICY IF EXISTS "Enable read access for all users" ON "storage"."objects";
create policy "Enable read access for all users"
on "storage"."objects"
as permissive
for select
to public
using (true);



DROP POLICY IF EXISTS "Enable upload policy for anon users 1icilt1_0" ON "storage"."objects";
create policy "Enable upload policy for anon users 1icilt1_0"
on "storage"."objects"
as permissive
for insert
to anon
with check ((bucket_id = 'orders'::text));



DROP POLICY IF EXISTS "Users can delete their own avatar" ON "storage"."objects";
create policy "Users can delete their own avatar"
on "storage"."objects"
as permissive
for delete
to public
using (((bucket_id = 'avatar'::text) AND ((auth.uid())::text = split_part(name, '-avatar'::text, 1))));



DROP POLICY IF EXISTS "Users can update their own avatar" ON "storage"."objects";
create policy "Users can update their own avatar"
on "storage"."objects"
as permissive
for update
to public
using (((bucket_id = 'avatar'::text) AND ((auth.uid())::text = split_part(name, '-avatar'::text, 1))));



DROP POLICY IF EXISTS "Users can upload their own avatar" ON "storage"."objects";
create policy "Users can upload their own avatar"
on "storage"."objects"
as permissive
for insert
to public
with check (((bucket_id = 'avatar'::text) AND ((auth.uid())::text = split_part(name, '-avatar'::text, 1))));



DROP POLICY IF EXISTS "Users can view their own avatar" ON "storage"."objects";
create policy "Users can view their own avatar"
on "storage"."objects"
as permissive
for select
to public
using (((bucket_id = 'avatar'::text) AND ((auth.uid())::text = split_part(name, '-avatar'::text, 1))));



DROP POLICY IF EXISTS "orders_delete_auth" ON "storage"."objects";
create policy "orders_delete_auth"
on "storage"."objects"
as permissive
for delete
to authenticated
using ((bucket_id = 'orders'::text));



DROP POLICY IF EXISTS "orders_insert_auth" ON "storage"."objects";
create policy "orders_insert_auth"
on "storage"."objects"
as permissive
for insert
to authenticated
with check ((bucket_id = 'orders'::text));



DROP POLICY IF EXISTS "orders_read_public" ON "storage"."objects";
create policy "orders_read_public"
on "storage"."objects"
as permissive
for select
to public
using ((bucket_id = 'orders'::text));



DROP POLICY IF EXISTS "orders_update_auth" ON "storage"."objects";
create policy "orders_update_auth"
on "storage"."objects"
as permissive
for update
to authenticated
using ((bucket_id = 'orders'::text))
with check ((bucket_id = 'orders'::text));
