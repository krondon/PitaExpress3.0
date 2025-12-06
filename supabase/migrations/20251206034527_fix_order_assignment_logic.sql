CREATE OR REPLACE FUNCTION "public"."assign_order_to_employee"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
            UPDATE orders
            SET "asignedEVzla" = vzla_employee_id
            WHERE id = NEW.id;
            
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
            UPDATE orders
            SET "asignedEChina" = china_employee_id
            WHERE id = NEW.id;
            
            UPDATE employees
            SET assigned_orders = assigned_orders + 1
            WHERE user_id = china_employee_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
