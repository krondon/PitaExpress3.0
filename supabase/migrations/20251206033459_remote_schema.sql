

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."deliverytype" AS ENUM (
    'office',
    'warehouse',
    'express',
    'pickup',
    'delivery'
);


ALTER TYPE "public"."deliverytype" OWNER TO "postgres";


COMMENT ON TYPE "public"."deliverytype" IS 'delivery type';



CREATE TYPE "public"."order_state" AS ENUM (
    'pendiente cotizacion china',
    'pendiente cotizacion vzla',
    'esperando pago cliente',
    'en transito vzla',
    'en transito china',
    'entregado'
);


ALTER TYPE "public"."order_state" OWNER TO "postgres";


CREATE TYPE "public"."pais_tipo" AS ENUM (
    'vzla',
    'china'
);


ALTER TYPE "public"."pais_tipo" OWNER TO "postgres";


CREATE TYPE "public"."shippingType" AS ENUM (
    'maritime',
    'air',
    'doorToDoor'
);


ALTER TYPE "public"."shippingType" OWNER TO "postgres";


COMMENT ON TYPE "public"."shippingType" IS 'shippingType';



CREATE OR REPLACE FUNCTION "public"."assign_order_to_employee"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    vzla_employee_id UUID;
    china_employee_id UUID;
BEGIN
    -- Lógica para asignar a un empleado de Vzla
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

    -- Lógica para asignar a un empleado de China
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

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_order_to_employee"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_order_to_least_busy_employee_safe"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  least_busy_employee_china UUID;
  least_busy_employee_vzla UUID;
BEGIN
  -- seguridad de search_path
  PERFORM set_config('search_path', '', false);

  -- Si ya hay asignación explícita, no hacemos nada
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN

    -- Asignación para China (si no está asignado)
    IF (NEW."asignedEChina" IS NULL AND (NEW.country IS NULL OR LOWER(NEW.country) = 'china')) THEN
      SELECT e.user_id
      INTO least_busy_employee_china
      FROM public.employees e
      JOIN public.userlevel ul ON e.user_id = ul.id
      WHERE LOWER(ul.user_level) = 'china'
      ORDER BY (
        SELECT COUNT(*) FROM public.orders o WHERE o."asignedEChina" = e.user_id AND (o.status IS NULL OR o.status <> 'completed')
      ) ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1;

      IF least_busy_employee_china IS NOT NULL THEN
        NEW."asignedEChina" := least_busy_employee_china;
      END IF;
    END IF;

    -- Asignación para Vzla (si no está asignado)
    IF (NEW."asignedEVzla" IS NULL AND (NEW.country IS NULL OR LOWER(NEW.country) = 'vzla' OR LOWER(NEW.country) = 'venezuela')) THEN
      SELECT e.user_id
      INTO least_busy_employee_vzla
      FROM public.employees e
      JOIN public.userlevel ul ON e.user_id = ul.id
      WHERE LOWER(ul.user_level) = 'vzla' OR LOWER(ul.user_level) = 'venezuela'
      ORDER BY (
        SELECT COUNT(*) FROM public.orders o WHERE o."asignedEVzla" = e.user_id AND (o.status IS NULL OR o.status <> 'completed')
      ) ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1;

      IF least_busy_employee_vzla IS NOT NULL THEN
        NEW."asignedEVzla" := least_busy_employee_vzla;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_order_to_least_busy_employee_safe"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_order_to_least_busy_employees"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    least_busy_employee_china UUID;
    least_busy_employee_vzla UUID;
BEGIN
    -- Buscar empleado de China menos ocupado
    SELECT e.user_id INTO least_busy_employee_china
    FROM employees e
    JOIN userlevel ul ON e.user_id = ul.id
    WHERE ul.user_level = 'china'
    ORDER BY (SELECT COUNT(*) FROM orders WHERE orders."asignedEChina" = e.user_id) ASC
    LIMIT 1
    FOR UPDATE;

    -- Buscar empleado de Venezuela menos ocupado
    SELECT e.user_id INTO least_busy_employee_vzla
    FROM employees e
    JOIN userlevel ul ON e.user_id = ul.id
    WHERE ul.user_level = 'vzla'
    ORDER BY (SELECT COUNT(*) FROM orders WHERE orders."asignedEVzla" = e.user_id) ASC
    LIMIT 1
    FOR UPDATE;

    -- Asignar empleados a la nueva orden
    NEW."asignedEChina" := least_busy_employee_china;
    NEW."asignedEVzla" := least_busy_employee_vzla;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_order_to_least_busy_employees"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_binance_rates"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM exchange_rates_binance
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_binance_rates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_exchange_rates_cny"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    WITH ranked_rates AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "timestamp" DESC) as rn
        FROM exchange_rates_cny
    )
    DELETE FROM exchange_rates_cny 
    WHERE id IN (
        SELECT id 
        FROM ranked_rates 
        WHERE rn > 1000
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_exchange_rates_cny"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_message"("message_id" "uuid", "user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  msg RECORD;
BEGIN
  SELECT * INTO msg FROM chat_messages WHERE id = message_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF msg.sender_id = user_id THEN
    UPDATE chat_messages SET deleted_by_sender = TRUE WHERE id = message_id;
    RETURN TRUE;
  ELSIF msg.receiver_id = user_id THEN
    UPDATE chat_messages SET deleted_by_receiver = TRUE WHERE id = message_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;


ALTER FUNCTION "public"."delete_message"("message_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_conversations"("admin_user_id" "uuid") RETURNS TABLE("user_id" "uuid", "user_email" "text", "user_name" "text", "last_message" "text", "last_message_time" timestamp with time zone, "unread_count" bigint, "last_file_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH china_users AS (
    -- Obtener todos los usuarios con rol 'china' que han chateado con el admin
    SELECT DISTINCT
      CASE
        WHEN cm.sender_id = admin_user_id THEN cm.receiver_id
        ELSE cm.sender_id
      END as china_user_id
    FROM chat_messages cm
    WHERE cm.sender_id = admin_user_id OR cm.receiver_id = admin_user_id
  ),
  last_messages AS (
    -- Obtener el último mensaje de cada conversación
    SELECT DISTINCT ON (
      CASE
        WHEN cm.sender_id = admin_user_id THEN cm.receiver_id
        ELSE cm.sender_id
      END
    )
      CASE
        WHEN cm.sender_id = admin_user_id THEN cm.receiver_id
        ELSE cm.sender_id
      END as china_user_id,
      cm.message,
      cm.created_at,
      cm.file_url
    FROM chat_messages cm
    WHERE cm.sender_id = admin_user_id OR cm.receiver_id = admin_user_id
    ORDER BY
      CASE
        WHEN cm.sender_id = admin_user_id THEN cm.receiver_id
        ELSE cm.sender_id
      END,
      cm.created_at DESC
  ),
  unread_counts AS (
    -- Contar mensajes no leídos por conversación
    SELECT
      cm.sender_id as china_user_id,
      COUNT(*) as unread
    FROM chat_messages cm
    WHERE cm.receiver_id = admin_user_id
      AND cm.read = FALSE
    GROUP BY cm.sender_id
  )
  SELECT
    cu.china_user_id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', au.email) as user_name,
    lm.message,
    lm.created_at,
    COALESCE(uc.unread, 0),
    lm.file_url
  FROM china_users cu
  LEFT JOIN auth.users au ON au.id = cu.china_user_id
  LEFT JOIN last_messages lm ON lm.china_user_id = cu.china_user_id
  LEFT JOIN unread_counts uc ON uc.china_user_id = cu.china_user_id
  ORDER BY lm.created_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."get_admin_conversations"("admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_binance_rate_history"("result_limit" integer DEFAULT 20, "only_valid" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "rate" numeric, "source" "text", "rate_timestamp" timestamp with time zone, "is_fallback" boolean, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF only_valid THEN
    RETURN QUERY
    SELECT 
      er.id,
      er.rate,
      er.source,
      er.timestamp AS rate_timestamp,
      er.is_fallback,
      er.metadata
    FROM exchange_rates_binance er
    WHERE er.is_fallback = FALSE
    ORDER BY er.timestamp DESC
    LIMIT result_limit;
  ELSE
    RETURN QUERY
    SELECT 
      er.id,
      er.rate,
      er.source,
      er.timestamp AS rate_timestamp,
      er.is_fallback,
      er.metadata
    FROM exchange_rates_binance er
    ORDER BY er.timestamp DESC
    LIMIT result_limit;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_binance_rate_history"("result_limit" integer, "only_valid" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chat_conversations_v2"("current_user_id" "uuid") RETURNS TABLE("user_id" "uuid", "user_email" "text", "user_name" "text", "last_message" "text", "last_message_time" timestamp with time zone, "unread_count" bigint, "last_file_url" "text", "is_hidden" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH relevant_messages AS (
    -- Obtener mensajes donde el usuario es sender o receiver
    -- Y filtrar los que han sido eliminados por el usuario
    SELECT 
      cm.id,
      cm.sender_id,
      cm.receiver_id,
      cm.message,
      cm.created_at,
      cm.file_url,
      cm.read,
      cm.deleted_by_sender,
      cm.deleted_by_receiver
    FROM chat_messages cm
    WHERE (cm.sender_id = current_user_id AND cm.deleted_by_sender = FALSE)
       OR (cm.receiver_id = current_user_id AND cm.deleted_by_receiver = FALSE)
  ),
  conversations AS (
    -- Identificar con quién es la conversación
    SELECT DISTINCT
      CASE
        WHEN rm.sender_id = current_user_id THEN rm.receiver_id
        ELSE rm.sender_id
      END as other_user_id
    FROM relevant_messages rm
  ),
  hidden_status AS (
    -- Verificar si la conversación está oculta y desde cuándo
    SELECT 
      hidden_user_id, 
      created_at as hidden_since
    FROM chat_hidden_conversations
    WHERE chat_hidden_conversations.user_id = current_user_id
  ),
  last_messages AS (
    -- Obtener el último mensaje válido para cada conversación
    SELECT DISTINCT ON (c.other_user_id)
      c.other_user_id,
      rm.message,
      rm.created_at,
      rm.file_url
    FROM conversations c
    JOIN relevant_messages rm ON 
      (rm.sender_id = c.other_user_id OR rm.receiver_id = c.other_user_id)
    LEFT JOIN hidden_status hs ON hs.hidden_user_id = c.other_user_id
    WHERE 
      -- Solo mostrar mensajes posteriores a la fecha de ocultamiento (si existe)
      (hs.hidden_since IS NULL OR rm.created_at > hs.hidden_since)
    ORDER BY c.other_user_id, rm.created_at DESC
  ),
  unread_counts AS (
    -- Contar no leídos (solo mensajes visibles)
    SELECT
      rm.sender_id as other_user_id,
      COUNT(*) as unread
    FROM relevant_messages rm
    LEFT JOIN hidden_status hs ON hs.hidden_user_id = rm.sender_id
    WHERE rm.receiver_id = current_user_id
      AND rm.read = FALSE
      AND (hs.hidden_since IS NULL OR rm.created_at > hs.hidden_since)
    GROUP BY rm.sender_id
  )
  SELECT
    lm.other_user_id as user_id,
    au.email as user_email,
    -- Prioridad de nombres:
    -- 1. Si es administrador -> Mostrar siempre 'Administrador'
    -- 2. Si es empleado/cliente -> Mostrar su nombre real
    CASE
      WHEN adm.user_id IS NOT NULL THEN 'Administrador'
      ELSE COALESCE(
        emp.name,
        cli.name,
        au.raw_user_meta_data->>'name',
        au.email
      )
    END as user_name,
    lm.message as last_message,
    lm.created_at as last_message_time,
    COALESCE(uc.unread, 0) as unread_count,
    lm.file_url as last_file_url,
    (hs.hidden_user_id IS NOT NULL) as is_hidden
  FROM last_messages lm
  JOIN auth.users au ON au.id = lm.other_user_id
  LEFT JOIN unread_counts uc ON uc.other_user_id = lm.other_user_id
  LEFT JOIN hidden_status hs ON hs.hidden_user_id = lm.other_user_id
  -- Joins para obtener nombres reales
  LEFT JOIN employees emp ON emp.user_id = lm.other_user_id
  LEFT JOIN clients cli ON cli.user_id = lm.other_user_id
  LEFT JOIN administrators adm ON adm.user_id = lm.other_user_id
  ORDER BY lm.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_chat_conversations_v2"("current_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_valid_binance_rate"() RETURNS TABLE("rate" numeric, "rate_timestamp" timestamp with time zone, "source" "text", "age_minutes" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    er.rate,
    er.timestamp AS rate_timestamp,
    er.source,
    EXTRACT(EPOCH FROM (NOW() - er.timestamp))::INTEGER / 60 AS age_minutes
  FROM exchange_rates_binance er
  WHERE er.is_fallback = FALSE
    AND er.timestamp >= NOW() - INTERVAL '24 hours'
  ORDER BY er.timestamp DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_latest_valid_binance_rate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_valid_exchange_rate_cny"() RETURNS TABLE("rate" numeric, "source" character varying, "timestamp" timestamp with time zone, "age_minutes" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        er.rate,
        er.source,
        er."timestamp",
        EXTRACT(EPOCH FROM (NOW() - er."timestamp"))::INTEGER / 60 as age_minutes
    FROM exchange_rates_cny er
    WHERE er.is_fallback = FALSE
      AND er.rate > 5.0 
      AND er.rate < 10.0
      AND er."timestamp" >= (NOW() - INTERVAL '7 days')
    ORDER BY er."timestamp" DESC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_latest_valid_exchange_rate_cny"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_state_history"("p_order_id" integer) RETURNS TABLE("id" integer, "state" integer, "previous_state" integer, "timestamp" timestamp with time zone, "changed_by" "text", "notes" "text", "state_name" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    osh.id,
    osh.state,
    osh.previous_state,
    osh."timestamp",
    osh.changed_by,
    osh.notes,
    CASE osh.state
      WHEN 1 THEN 'Pedido creado'
      WHEN 2 THEN 'Recibido'
      WHEN 3 THEN 'Cotizado'
      WHEN 4 THEN 'Asignado Venezuela'
      WHEN 5 THEN 'En procesamiento'
      WHEN 6 THEN 'Preparando envío'
      WHEN 7 THEN 'Listo para envío'
      WHEN 8 THEN 'Enviado'
      WHEN 9 THEN 'En tránsito'
      WHEN 10 THEN 'En aduana'
      WHEN 11 THEN 'En almacén Venezuela'
      WHEN 12 THEN 'Listo para entrega'
      WHEN 13 THEN 'Entregado'
      ELSE 'Estado desconocido'
    END AS state_name
  FROM order_state_history osh
  WHERE osh.order_id = p_order_id
  ORDER BY osh."timestamp" ASC;
END;
$$;


ALTER FUNCTION "public"."get_order_state_history"("p_order_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_timeline"("p_order_id" integer) RETURNS TABLE("step_id" "text", "step_key" "text", "step_name" "text", "completed" boolean, "step_timestamp" timestamp with time zone, "location" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_order_state INTEGER;
BEGIN
  -- Obtener el estado actual del pedido
  SELECT state INTO current_order_state FROM orders WHERE id = p_order_id;
  
  RETURN QUERY
  SELECT 
    s.id_paso::TEXT as step_id,
    s.clave_paso as step_key,
    s.nombre_paso as step_name,
    (current_order_state >= s.estado_requerido) as completed,
    h.fecha_cambio as step_timestamp,
    s.ubicacion as location
  FROM (
    VALUES 
      -- MAPEO CORRECTO: Cliente ve 6 pasos que corresponden a estados específicos de BD
      (1, 'created', 'Pedido creado', 1, '—'),           -- Estado 1: Pedido creado
      (2, 'processing', 'En procesamiento', 5, '—'),     -- Estado 5: En procesamiento  
      (3, 'shipped', 'Enviado', 8, '—'),                 -- Estado 8: Enviado
      (4, 'in-transit', 'En tránsito', 9, 'En ruta'),    -- Estado 9: En tránsito
      (5, 'customs', 'En aduana', 10, 'En ruta'),        -- Estado 10: En aduana
      (6, 'delivered', 'Entregado', 13, '—')             -- Estado 13: Entregado
  ) AS s(id_paso, clave_paso, nombre_paso, estado_requerido, ubicacion)
  LEFT JOIN (
    SELECT 
      state,
      MIN("timestamp") as fecha_cambio
    FROM order_state_history 
    WHERE order_id = p_order_id 
    GROUP BY state
  ) h ON h.state = s.estado_requerido
  ORDER BY s.id_paso;
END;
$$;


ALTER FUNCTION "public"."get_order_timeline"("p_order_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_messages_count"("for_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO unread_count
  FROM chat_messages
  WHERE receiver_id = for_user_id
    AND read = FALSE;
  
  RETURN COALESCE(unread_count, 0);
END;
$$;


ALTER FUNCTION "public"."get_unread_messages_count"("for_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("user_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  found_user_id uuid;
BEGIN
  -- Buscar en auth.users
  SELECT id INTO found_user_id
  FROM auth.users 
  WHERE email = user_email
  LIMIT 1;
  
  -- Si no encuentra en auth.users, buscar en tabla pública users si existe
  IF found_user_id IS NULL THEN
    SELECT id INTO found_user_id
    FROM public.users 
    WHERE email = user_email
    LIMIT 1;
  END IF;
  
  RETURN found_user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_id_by_email"("user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_userlevel"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.userlevel (id, user_level)
  values (new.id, 'Client')
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_userlevel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_order_state_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Solo registrar si el estado realmente cambió
  IF (TG_OP = 'UPDATE' AND OLD.state IS DISTINCT FROM NEW.state) OR TG_OP = 'INSERT' THEN
    INSERT INTO order_state_history (
      order_id,
      state,
      previous_state,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      NEW.state,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.state ELSE NULL END,
      'system', -- por defecto, se puede cambiar por el usuario real en el futuro
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'Pedido creado'
        ELSE 'Estado actualizado'
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_order_state_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_user_roles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  user_name TEXT;
BEGIN
  -- Si la operación es un INSERT o un UPDATE donde el nivel cambió
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.user_level IS DISTINCT FROM NEW.user_level)) THEN

    -- Obtener el nombre completo del usuario desde la tabla auth.users
    SELECT raw_user_meta_data->>'full_name' INTO user_name
    FROM auth.users
    WHERE id = NEW.id;

    -- Borra al usuario de todas las tablas de roles
    DELETE FROM public.administrators WHERE user_id = NEW.id;
    DELETE FROM public.clients WHERE user_id = NEW.id;
    DELETE FROM public.employees WHERE user_id = NEW.id;

    -- Inserta al usuario en la tabla correcta
    IF NEW.user_level = 'Admin' THEN
      -- Inserta al usuario 'Admin' en las tres tablas
      INSERT INTO public.administrators (user_id, name) VALUES (NEW.id, user_name);
      INSERT INTO public.clients (user_id, name) VALUES (NEW.id, user_name);
      INSERT INTO public.employees (user_id, name) VALUES (NEW.id, user_name);
    ELSIF NEW.user_level = 'Client' THEN
      INSERT INTO public.clients (user_id, name) VALUES (NEW.id, user_name);
    ELSIF NEW.user_level IN ('Vzla', 'China', 'Pagos') THEN
      INSERT INTO public.employees (user_id, name) VALUES (NEW.id, user_name);
    END IF;

  END IF;
  
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."manage_user_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."metricas_con_cambio"() RETURNS TABLE("total_orders" integer, "completed_orders" integer, "pending_orders" integer, "transit" integer, "efficiency" numeric, "total_orders_change" numeric, "completed_orders_change" numeric, "pending_orders_change" numeric, "transit_change" numeric, "efficiency_change" numeric)
    LANGUAGE "sql"
    AS $$
  with ultimos as (
    select *
    from reportes
    order by created_at desc
    limit 2
  )
  select
    ultimos[1].total_orders,
    ultimos[1].completed_orders,
    ultimos[1].pending_orders,
    ultimos[1].transit,
    ultimos[1].efficiency,
    case when ultimos[2].total_orders > 0 then ((ultimos[1].total_orders - ultimos[2].total_orders) * 100.0 / ultimos[2].total_orders) else null end as total_orders_change,
    case when ultimos[2].completed_orders > 0 then ((ultimos[1].completed_orders - ultimos[2].completed_orders) * 100.0 / ultimos[2].completed_orders) else null end as completed_orders_change,
    case when ultimos[2].pending_orders > 0 then ((ultimos[1].pending_orders - ultimos[2].pending_orders) * 100.0 / ultimos[2].pending_orders) else null end as pending_orders_change,
    case when ultimos[2].transit > 0 then ((ultimos[1].transit - ultimos[2].transit) * 100.0 / ultimos[2].transit) else null end as transit_change,
    case when ultimos[2].efficiency > 0 then ((ultimos[1].efficiency - ultimos[2].efficiency) * 100.0 / ultimos[2].efficiency) else null end as efficiency_change
  from (select array_agg(r order by r.created_at desc) as ultimos from reportes r limit 2) t
$$;


ALTER FUNCTION "public"."metricas_con_cambio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pedidos_por_mes"() RETURNS TABLE("mes" "text", "entregados" integer, "pendientes" integer)
    LANGUAGE "sql"
    AS $$
  SELECT
    TO_CHAR(created_at, 'Mon') AS mes,
    SUM(CASE WHEN state = 8 THEN 1 ELSE 0 END) AS entregados,
    SUM(CASE WHEN state <> 8 THEN 1 ELSE 0 END) AS pendientes
  FROM orders
  GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at)
  ORDER BY DATE_TRUNC('month', MIN(created_at));
$$;


ALTER FUNCTION "public"."pedidos_por_mes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_elapsed_time"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.elapsed_time := CURRENT_DATE - NEW.created_at::date;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_elapsed_time"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_chat_messages_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_chat_messages_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_chat_typing_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_chat_typing_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_elapsed_time"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE orders
  SET elapsed_time = CURRENT_DATE - created_at::date;
END;
$$;


ALTER FUNCTION "public"."update_elapsed_time"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_employee_user_level_function"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE employees
    SET user_level = NEW.user_level
    WHERE user_id = NEW.id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_employee_user_level_function"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_reviews_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_order_reviews_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_alternatives_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_product_alternatives_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_user_password"("user_id" "uuid", "password" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  stored_password text;
  is_valid boolean;
BEGIN
  -- Obtener la contraseña cifrada del usuario
  SELECT encrypted_password INTO stored_password
  FROM auth.users 
  WHERE id = user_id;
  
  -- Si no encuentra usuario, retornar false
  IF stored_password IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar contraseña usando el mismo método que Supabase (crypt)
  -- Supabase usa crypt() con salting para almacenar contraseñas
  is_valid := (stored_password = crypt(password, stored_password));
  
  RETURN is_valid;
END;
$$;


ALTER FUNCTION "public"."verify_user_password"("user_id" "uuid", "password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_user_password_direct"("user_email" "text", "user_password" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_record auth.users;
  is_valid boolean;
BEGIN
  -- Buscar usuario por email
  SELECT * INTO user_record 
  FROM auth.users 
  WHERE email = user_email;
  
  -- Si no encuentra usuario, retornar false
  IF user_record.id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar contraseña
  is_valid := (user_record.encrypted_password = crypt(user_password, user_record.encrypted_password));
  
  RETURN is_valid;
END;
$$;


ALTER FUNCTION "public"."verify_user_password_direct"("user_email" "text", "user_password" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."administrators" (
    "user_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL
);


ALTER TABLE "public"."administrators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."air_shipments" (
    "order_id" bigint NOT NULL,
    "awb_number" "text" NOT NULL,
    "airline_code" character varying[] NOT NULL,
    "flight_number" character varying[] NOT NULL,
    "origin_airport" character varying NOT NULL,
    "destination_airport" character varying NOT NULL,
    "etd" timestamp with time zone NOT NULL,
    "eta" timestamp with time zone NOT NULL,
    "actual_departure" timestamp with time zone NOT NULL,
    "actual_arrival" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."air_shipments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."air_shipments"."awb_number" IS 'Air Waybill number, unique for each shipment';



COMMENT ON COLUMN "public"."air_shipments"."airline_code" IS 'IATA code of the airline (e.g., ''LH'' for Lufthansa)';



COMMENT ON COLUMN "public"."air_shipments"."origin_airport" IS 'IATA code of the origin airport (e.g., ''JFK'')';



COMMENT ON COLUMN "public"."air_shipments"."destination_airport" IS 'IATA code of the destination airport (e.g., ''LAX'')';



COMMENT ON COLUMN "public"."air_shipments"."etd" IS 'Estimated Time of Departure';



COMMENT ON COLUMN "public"."air_shipments"."eta" IS 'Estimated Time of arrival';



ALTER TABLE "public"."air_shipments" ALTER COLUMN "order_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."air_shipments_shipment_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."boxes" (
    "box_id" bigint NOT NULL,
    "state" integer,
    "creation_date" timestamp with time zone DEFAULT "now"(),
    "container_id" bigint,
    "name" "text"
);


ALTER TABLE "public"."boxes" OWNER TO "postgres";


ALTER TABLE "public"."boxes" ALTER COLUMN "box_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."boxes_box_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."business_config" (
    "id" bigint NOT NULL,
    "admin_id" "uuid",
    "usd_rate" numeric(12,4) NOT NULL,
    "auto_update_exchange_rate" boolean DEFAULT false NOT NULL,
    "cny_rate" numeric(12,4) NOT NULL,
    "auto_update_exchange_rate_cny" boolean DEFAULT true NOT NULL,
    "profit_margin" numeric(5,2) DEFAULT 0 NOT NULL,
    "air_shipping_rate" numeric(12,2) NOT NULL,
    "sea_shipping_rate" numeric(12,2) NOT NULL,
    "alerts_after_days" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "binance_rate" numeric(10,4) DEFAULT 42.00,
    "auto_update_binance_rate" boolean DEFAULT false,
    "binance_rate_sell" numeric(10,2) DEFAULT 299.51,
    "auto_update_binance_rate_sell" boolean DEFAULT false
);


ALTER TABLE "public"."business_config" OWNER TO "postgres";


COMMENT ON COLUMN "public"."business_config"."binance_rate" IS 'Tasa de cambio USDT → VES desde Binance P2P';



COMMENT ON COLUMN "public"."business_config"."auto_update_binance_rate" IS 'Activar auto-actualización de tasa Binance desde APIs externas';



COMMENT ON COLUMN "public"."business_config"."binance_rate_sell" IS 'Tasa de venta USDT → VES (Binance P2P) - Promedio de las 5 ofertas más altas';



COMMENT ON COLUMN "public"."business_config"."auto_update_binance_rate_sell" IS 'Activar/desactivar auto-actualización de la tasa de venta de Binance P2P';



CREATE SEQUENCE IF NOT EXISTS "public"."business_config_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."business_config_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."business_config_id_seq" OWNED BY "public"."business_config"."id";



CREATE TABLE IF NOT EXISTS "public"."chat_hidden_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "hidden_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_hidden_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_hidden_conversations" IS 'Almacena qué conversaciones ha ocultado cada usuario de su vista';



COMMENT ON COLUMN "public"."chat_hidden_conversations"."user_id" IS 'Usuario que oculta la conversación';



COMMENT ON COLUMN "public"."chat_hidden_conversations"."hidden_user_id" IS 'Usuario con quien tiene la conversación oculta';



CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "sender_role" "text" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "receiver_role" "text" NOT NULL,
    "message" "text",
    "file_url" "text",
    "file_name" "text",
    "file_type" "text",
    "file_size" integer,
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_edited" boolean DEFAULT false,
    "deleted_by_sender" boolean DEFAULT false,
    "deleted_by_receiver" boolean DEFAULT false,
    "is_deleted" boolean DEFAULT false,
    CONSTRAINT "chat_messages_receiver_role_check" CHECK (("receiver_role" = ANY (ARRAY['admin'::"text", 'china'::"text"]))),
    CONSTRAINT "chat_messages_sender_role_check" CHECK (("sender_role" = ANY (ARRAY['admin'::"text", 'china'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_typing_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "typing_to_id" "uuid" NOT NULL,
    "is_typing" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_typing_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "user_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "email" "text",
    CONSTRAINT "clients_cedula_check" CHECK (("length"("email") <= 10))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."containers" (
    "container_id" bigint NOT NULL,
    "state" integer,
    "creation_date" timestamp with time zone DEFAULT "now"(),
    "name" "text",
    "tracking_number" "text",
    "tracking_company" "text",
    "arrive_date" "date",
    "tracking_link" "text"
);


ALTER TABLE "public"."containers" OWNER TO "postgres";


ALTER TABLE "public"."containers" ALTER COLUMN "container_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."containers_container_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."employees" (
    "user_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "assigned_orders" integer DEFAULT 0,
    "completed_orders" integer DEFAULT 0,
    "efficiency" smallint,
    "pending_orders" integer DEFAULT 0,
    "transit" integer DEFAULT 0,
    "user_level" "text"
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_rates" (
    "id" bigint NOT NULL,
    "rate" numeric(10,4) NOT NULL,
    "source" character varying(100) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "is_fallback" boolean DEFAULT false,
    "api_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "exchange_rates_rate_check" CHECK (("rate" > (0)::numeric))
);


ALTER TABLE "public"."exchange_rates" OWNER TO "postgres";


COMMENT ON TABLE "public"."exchange_rates" IS 'Historial de tasas de cambio USD/VES';



COMMENT ON COLUMN "public"."exchange_rates"."rate" IS 'Tasa de cambio en Bolívares por USD';



COMMENT ON COLUMN "public"."exchange_rates"."source" IS 'Fuente de la tasa (BCV, API, etc.)';



COMMENT ON COLUMN "public"."exchange_rates"."is_fallback" IS 'TRUE si es fallback, FALSE si es de API';



COMMENT ON COLUMN "public"."exchange_rates"."api_response" IS 'Respuesta completa de la API';



CREATE TABLE IF NOT EXISTS "public"."exchange_rates_binance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rate" numeric(10,4) NOT NULL,
    "source" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_fallback" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "trade_type" "text" DEFAULT 'BUY'::"text",
    CONSTRAINT "exchange_rates_binance_trade_type_check" CHECK (("trade_type" = ANY (ARRAY['BUY'::"text", 'SELL'::"text"])))
);


ALTER TABLE "public"."exchange_rates_binance" OWNER TO "postgres";


COMMENT ON TABLE "public"."exchange_rates_binance" IS 'Almacena el historial de tasas de cambio de Binance P2P (USDT → VES)';



COMMENT ON COLUMN "public"."exchange_rates_binance"."rate" IS 'Tasa de cambio USDT → VES';



COMMENT ON COLUMN "public"."exchange_rates_binance"."source" IS 'Fuente de la tasa (Monitor Venezuela, AirTM, Manual, etc.)';



COMMENT ON COLUMN "public"."exchange_rates_binance"."timestamp" IS 'Fecha y hora de la tasa';



COMMENT ON COLUMN "public"."exchange_rates_binance"."is_fallback" IS 'Indica si esta tasa es un fallback (no proviene de API externa)';



COMMENT ON COLUMN "public"."exchange_rates_binance"."metadata" IS 'Información adicional sobre la tasa (errores, advertencias, etc.)';



COMMENT ON COLUMN "public"."exchange_rates_binance"."trade_type" IS 'Tipo de operación: BUY (compra VES→USDT) o SELL (venta USDT→VES)';



CREATE TABLE IF NOT EXISTS "public"."exchange_rates_cny" (
    "id" bigint NOT NULL,
    "rate" numeric(10,4) NOT NULL,
    "source" character varying(100) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "is_fallback" boolean DEFAULT false,
    "api_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exchange_rates_cny" OWNER TO "postgres";


COMMENT ON TABLE "public"."exchange_rates_cny" IS 'Tabla para almacenar tasas de cambio USD → CNY (Yuan Chino)';



COMMENT ON COLUMN "public"."exchange_rates_cny"."rate" IS 'Tasa de cambio: 1 USD = X CNY';



COMMENT ON COLUMN "public"."exchange_rates_cny"."source" IS 'Fuente de la tasa (API, Manual, etc.)';



COMMENT ON COLUMN "public"."exchange_rates_cny"."timestamp" IS 'Fecha y hora de la tasa';



COMMENT ON COLUMN "public"."exchange_rates_cny"."is_fallback" IS 'Indica si es una tasa de respaldo';



COMMENT ON COLUMN "public"."exchange_rates_cny"."api_response" IS 'Respuesta completa de la API (JSON)';



CREATE SEQUENCE IF NOT EXISTS "public"."exchange_rates_cny_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exchange_rates_cny_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exchange_rates_cny_id_seq" OWNED BY "public"."exchange_rates_cny"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."exchange_rates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exchange_rates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exchange_rates_id_seq" OWNED BY "public"."exchange_rates"."id";



CREATE TABLE IF NOT EXISTS "public"."maritime_shipments" (
    "order_id" bigint NOT NULL,
    "actual_arrival" "date" NOT NULL,
    "vessel_name" character varying[] NOT NULL,
    "voyage_number" "text",
    "etd" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "eta" timestamp with time zone NOT NULL,
    "actual_departure" timestamp with time zone[] NOT NULL,
    "container_id" character varying[] NOT NULL,
    "origin_port" "text"
);


ALTER TABLE "public"."maritime_shipments" OWNER TO "postgres";


COMMENT ON TABLE "public"."maritime_shipments" IS 'envios maritimos';



COMMENT ON COLUMN "public"."maritime_shipments"."actual_arrival" IS 'Actual arrival date';



COMMENT ON COLUMN "public"."maritime_shipments"."voyage_number" IS 'Voyage number of the vessel';



COMMENT ON COLUMN "public"."maritime_shipments"."etd" IS 'Estimated Time of Departure';



COMMENT ON COLUMN "public"."maritime_shipments"."eta" IS 'Estimated Time of Arrival';



COMMENT ON COLUMN "public"."maritime_shipments"."origin_port" IS 'port o origin';



CREATE TABLE IF NOT EXISTS "public"."notification_reads" (
    "notification_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "audience_type" "text" NOT NULL,
    "audience_value" "text" NOT NULL,
    "role" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "href" "text",
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "unread" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "order_id" "text",
    "payment_id" "text",
    CONSTRAINT "notifications_audience_type_check" CHECK (("audience_type" = ANY (ARRAY['role'::"text", 'user'::"text"]))),
    CONSTRAINT "notifications_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warn'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" integer NOT NULL,
    "client_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "review_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."order_reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_reviews" IS 'Almacena las reseñas y calificaciones de los clientes sobre pedidos completados';



COMMENT ON COLUMN "public"."order_reviews"."rating" IS 'Calificación de 1 a 5 estrellas';



COMMENT ON COLUMN "public"."order_reviews"."review_text" IS 'Texto de la reseña escrita por el cliente';



CREATE TABLE IF NOT EXISTS "public"."order_state_history" (
    "id" integer NOT NULL,
    "order_id" integer NOT NULL,
    "state" integer NOT NULL,
    "previous_state" integer,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "changed_by" "text",
    "notes" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_state_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_state_history" IS 'Historial completo de cambios de estado de pedidos';



COMMENT ON COLUMN "public"."order_state_history"."order_id" IS 'Referencia al pedido';



COMMENT ON COLUMN "public"."order_state_history"."state" IS 'Nuevo estado (1-13)';



COMMENT ON COLUMN "public"."order_state_history"."previous_state" IS 'Estado anterior';



COMMENT ON COLUMN "public"."order_state_history"."timestamp" IS 'Fecha y hora del cambio';



COMMENT ON COLUMN "public"."order_state_history"."changed_by" IS 'Usuario que realizó el cambio';



COMMENT ON COLUMN "public"."order_state_history"."notes" IS 'Notas adicionales sobre el cambio';



CREATE SEQUENCE IF NOT EXISTS "public"."order_state_history_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_state_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."order_state_history_id_seq" OWNED BY "public"."order_state_history"."id";



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "uuid" DEFAULT "gen_random_uuid"(),
    "elapsed_time" integer,
    "state" smallint DEFAULT '1'::smallint,
    "asignedEChina" "uuid",
    "asignedEVzla" "uuid",
    "order_origin" "public"."pais_tipo",
    "imgs" "text"[],
    "links" "text"[],
    "shippingType" "public"."shippingType" DEFAULT 'air'::"public"."shippingType" NOT NULL,
    "deliveryType" "public"."deliverytype" DEFAULT 'office'::"public"."deliverytype" NOT NULL,
    "productName" "text",
    "estimatedBudget" numeric,
    "quantity" integer NOT NULL,
    "reputation" double precision,
    "description" "text",
    "pdfRoutes" "text",
    "totalQuote" double precision,
    "box_id" bigint,
    "specifications" "text",
    "sendChina" boolean DEFAULT false,
    "unitQuote" numeric,
    "shippingPrice" numeric,
    "height" numeric,
    "width" numeric,
    "long" numeric,
    "weight" numeric,
    "alternative_product_name" "text",
    "alternative_description" "text",
    "alternative_image_url" "text",
    CONSTRAINT "orders_imgs_check" CHECK ((("imgs" IS NULL) OR ("array_length"("imgs", 1) IS NULL) OR ("length"("array_to_string"("imgs", ','::"text")) < 500))),
    CONSTRAINT "orders_links_check" CHECK ((("array_length"("links", 1) IS NULL) OR ("length"("array_to_string"("links", ')'::"text")) <= 80)))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."orders" IS 'Ordenes o Pedidos que hace un cliente';



COMMENT ON COLUMN "public"."orders"."asignedEChina" IS 'Asignacion por ID de un empleado en China';



COMMENT ON COLUMN "public"."orders"."imgs" IS 'rutas de las imagenes del pedidos en el storage, separadaas por comas y minimo de caracteres por ruta de 50';



COMMENT ON COLUMN "public"."orders"."alternative_product_name" IS 'Name of the alternative product offered by China when original is not found';



COMMENT ON COLUMN "public"."orders"."alternative_description" IS 'Description of the alternative product';



COMMENT ON COLUMN "public"."orders"."alternative_image_url" IS 'URL of the alternative product image';



ALTER TABLE "public"."orders" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."orders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" bigint NOT NULL,
    "payment_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_id" bigint,
    "amount" double precision NOT NULL,
    "currency" character varying NOT NULL,
    "payment_method" character varying NOT NULL,
    "payment_date" "date" DEFAULT "now"(),
    "payment_status" character varying NOT NULL,
    "transaction_id" character varying,
    "exchange_rate" double precision NOT NULL
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


ALTER TABLE "public"."payments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pagos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_alternatives" (
    "id" bigint NOT NULL,
    "order_id" bigint NOT NULL,
    "alternative_product_name" "text" NOT NULL,
    "alternative_description" "text",
    "alternative_image_url" "text",
    "alternative_price" numeric(10,2),
    "proposed_by_china_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "client_response_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "product_alternatives_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."product_alternatives" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_alternatives" IS 'Almacena alternativas de productos propuestas por China cuando no encuentran el producto exacto solicitado';



COMMENT ON COLUMN "public"."product_alternatives"."order_id" IS 'ID del pedido original';



COMMENT ON COLUMN "public"."product_alternatives"."alternative_product_name" IS 'Nombre del producto alternativo propuesto';



COMMENT ON COLUMN "public"."product_alternatives"."alternative_description" IS 'Descripción detallada de la alternativa y por qué se propone';



COMMENT ON COLUMN "public"."product_alternatives"."alternative_image_url" IS 'URL de la imagen del producto alternativo';



COMMENT ON COLUMN "public"."product_alternatives"."alternative_price" IS 'Precio propuesto para la alternativa';



COMMENT ON COLUMN "public"."product_alternatives"."proposed_by_china_id" IS 'ID del empleado de China que propuso la alternativa';



COMMENT ON COLUMN "public"."product_alternatives"."status" IS 'Estado: pending (pendiente), accepted (aceptada), rejected (rechazada)';



COMMENT ON COLUMN "public"."product_alternatives"."client_response_notes" IS 'Notas o comentarios del cliente al aceptar/rechazar';



CREATE SEQUENCE IF NOT EXISTS "public"."product_alternatives_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."product_alternatives_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."product_alternatives_id_seq" OWNED BY "public"."product_alternatives"."id";



CREATE OR REPLACE VIEW "public"."user_phones" AS
 SELECT "id",
    ("raw_user_meta_data" ->> 'phone'::"text") AS "phone"
   FROM "auth"."users";


ALTER VIEW "public"."user_phones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."userlevel" (
    "id" "uuid" NOT NULL,
    "user_level" "text" DEFAULT 'Client'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_image" "text"
);


ALTER TABLE "public"."userlevel" OWNER TO "postgres";


ALTER TABLE ONLY "public"."business_config" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."business_config_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exchange_rates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."exchange_rates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exchange_rates_cny" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."exchange_rates_cny_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."order_state_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."order_state_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."product_alternatives" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."product_alternatives_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."administrators"
    ADD CONSTRAINT "administrators_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."air_shipments"
    ADD CONSTRAINT "air_shipments_pkey" PRIMARY KEY ("order_id");



ALTER TABLE ONLY "public"."boxes"
    ADD CONSTRAINT "boxes_pkey" PRIMARY KEY ("box_id");



ALTER TABLE ONLY "public"."business_config"
    ADD CONSTRAINT "business_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_hidden_conversations"
    ADD CONSTRAINT "chat_hidden_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_hidden_conversations"
    ADD CONSTRAINT "chat_hidden_conversations_user_id_hidden_user_id_key" UNIQUE ("user_id", "hidden_user_id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_typing_status"
    ADD CONSTRAINT "chat_typing_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_typing_status"
    ADD CONSTRAINT "chat_typing_status_user_id_typing_to_id_key" UNIQUE ("user_id", "typing_to_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_cedula_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."containers"
    ADD CONSTRAINT "containers_pkey" PRIMARY KEY ("container_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."exchange_rates_binance"
    ADD CONSTRAINT "exchange_rates_binance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_rates_cny"
    ADD CONSTRAINT "exchange_rates_cny_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maritime_shipments"
    ADD CONSTRAINT "maritime_shipments_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."maritime_shipments"
    ADD CONSTRAINT "maritime_shipments_pkey" PRIMARY KEY ("order_id");



ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("notification_id", "user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_reviews"
    ADD CONSTRAINT "order_reviews_order_id_client_id_key" UNIQUE ("order_id", "client_id");



ALTER TABLE ONLY "public"."order_reviews"
    ADD CONSTRAINT "order_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_state_history"
    ADD CONSTRAINT "order_state_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "pagos_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "pagos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "pagos_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."product_alternatives"
    ADD CONSTRAINT "product_alternatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."userlevel"
    ADD CONSTRAINT "userlevel_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_binance_is_fallback" ON "public"."exchange_rates_binance" USING "btree" ("is_fallback");



CREATE INDEX "idx_binance_source" ON "public"."exchange_rates_binance" USING "btree" ("source");



CREATE INDEX "idx_binance_timestamp" ON "public"."exchange_rates_binance" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_chat_hidden_target" ON "public"."chat_hidden_conversations" USING "btree" ("hidden_user_id");



CREATE INDEX "idx_chat_hidden_user" ON "public"."chat_hidden_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_chat_messages_conversation" ON "public"."chat_messages" USING "btree" ("sender_id", "receiver_id", "created_at" DESC);



CREATE INDEX "idx_chat_messages_created_at" ON "public"."chat_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_chat_messages_receiver" ON "public"."chat_messages" USING "btree" ("receiver_id");



CREATE INDEX "idx_chat_messages_sender" ON "public"."chat_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_chat_messages_unread" ON "public"."chat_messages" USING "btree" ("receiver_id", "read") WHERE ("read" = false);



CREATE INDEX "idx_chat_typing_to" ON "public"."chat_typing_status" USING "btree" ("typing_to_id");



CREATE INDEX "idx_chat_typing_user" ON "public"."chat_typing_status" USING "btree" ("user_id");



CREATE INDEX "idx_exchange_rates_binance_trade_type" ON "public"."exchange_rates_binance" USING "btree" ("trade_type", "timestamp" DESC);



CREATE INDEX "idx_exchange_rates_cny_is_fallback" ON "public"."exchange_rates_cny" USING "btree" ("is_fallback");



CREATE INDEX "idx_exchange_rates_cny_source" ON "public"."exchange_rates_cny" USING "btree" ("source");



CREATE INDEX "idx_exchange_rates_cny_timestamp" ON "public"."exchange_rates_cny" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_exchange_rates_fallback" ON "public"."exchange_rates" USING "btree" ("is_fallback");



CREATE INDEX "idx_exchange_rates_source" ON "public"."exchange_rates" USING "btree" ("source");



CREATE INDEX "idx_exchange_rates_timestamp" ON "public"."exchange_rates" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_order_reviews_client_id" ON "public"."order_reviews" USING "btree" ("client_id");



CREATE INDEX "idx_order_reviews_created_at" ON "public"."order_reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_order_reviews_order_id" ON "public"."order_reviews" USING "btree" ("order_id");



CREATE INDEX "idx_order_state_history_order_id" ON "public"."order_state_history" USING "btree" ("order_id");



CREATE INDEX "idx_order_state_history_state" ON "public"."order_state_history" USING "btree" ("state");



CREATE INDEX "idx_order_state_history_timestamp" ON "public"."order_state_history" USING "btree" ("timestamp");



CREATE INDEX "idx_product_alternatives_created_at" ON "public"."product_alternatives" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_product_alternatives_order_id" ON "public"."product_alternatives" USING "btree" ("order_id");



CREATE INDEX "idx_product_alternatives_status" ON "public"."product_alternatives" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "assign_order_on_insert" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."assign_order_to_employee"();



CREATE OR REPLACE TRIGGER "chat_messages_updated_at" BEFORE UPDATE ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_messages_updated_at"();



CREATE OR REPLACE TRIGGER "chat_typing_updated_at" BEFORE UPDATE ON "public"."chat_typing_status" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_typing_updated_at"();



CREATE OR REPLACE TRIGGER "manage_user_roles_trigger" AFTER INSERT OR UPDATE ON "public"."userlevel" FOR EACH ROW EXECUTE FUNCTION "public"."manage_user_roles"();



CREATE OR REPLACE TRIGGER "mandar-mensaje" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://bgzsodcydkjqehjafbkv.supabase.co/functions/v1/mandar-mensaje', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnenNvZGN5ZGtqcWVoamFmYmt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIzMjk5NywiZXhwIjoyMDY5ODA4OTk3fQ.l-Zy-x7Qb1vAcSGauv8qokkBy9aLXNYu_qFjoih8J08"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "order_reviews_updated_at" BEFORE UPDATE ON "public"."order_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_reviews_updated_at"();



CREATE OR REPLACE TRIGGER "set_elapsed_time" BEFORE INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_elapsed_time"();



CREATE OR REPLACE TRIGGER "tr_order_state_change" AFTER INSERT OR UPDATE OF "state" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."log_order_state_change"();



CREATE OR REPLACE TRIGGER "trg_set_updated_at" BEFORE UPDATE ON "public"."business_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_userlevel_set_updated_at" BEFORE UPDATE ON "public"."userlevel" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_product_alternatives_updated_at" BEFORE UPDATE ON "public"."product_alternatives" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_alternatives_updated_at"();



CREATE OR REPLACE TRIGGER "update_employee_user_level" AFTER INSERT OR UPDATE ON "public"."userlevel" FOR EACH ROW EXECUTE FUNCTION "public"."update_employee_user_level_function"();



ALTER TABLE ONLY "public"."administrators"
    ADD CONSTRAINT "administrators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."air_shipments"
    ADD CONSTRAINT "air_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_hidden_conversations"
    ADD CONSTRAINT "chat_hidden_conversations_hidden_user_id_fkey" FOREIGN KEY ("hidden_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_hidden_conversations"
    ADD CONSTRAINT "chat_hidden_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_typing_status"
    ADD CONSTRAINT "chat_typing_status_typing_to_id_fkey" FOREIGN KEY ("typing_to_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_typing_status"
    ADD CONSTRAINT "chat_typing_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "fk_box" FOREIGN KEY ("box_id") REFERENCES "public"."boxes"("box_id");



ALTER TABLE ONLY "public"."boxes"
    ADD CONSTRAINT "fk_container" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("container_id");



ALTER TABLE ONLY "public"."maritime_shipments"
    ADD CONSTRAINT "maritime_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_reads"
    ADD CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_reviews"
    ADD CONSTRAINT "order_reviews_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_reviews"
    ADD CONSTRAINT "order_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_state_history"
    ADD CONSTRAINT "order_state_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_asignedEChina_fkey" FOREIGN KEY ("asignedEChina") REFERENCES "public"."employees"("user_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_asignedEVzla_fkey" FOREIGN KEY ("asignedEVzla") REFERENCES "public"."employees"("user_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("user_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "pagos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_alternatives"
    ADD CONSTRAINT "product_alternatives_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_alternatives"
    ADD CONSTRAINT "product_alternatives_proposed_by_china_id_fkey" FOREIGN KEY ("proposed_by_china_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."userlevel"
    ADD CONSTRAINT "userlevel_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Administrators can view all alternatives" ON "public"."product_alternatives" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."administrators"
  WHERE ("administrators"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can update any review" ON "public"."order_reviews" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."administrators"
  WHERE ("administrators"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admins can view all reviews" ON "public"."order_reviews" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."administrators"
  WHERE ("administrators"."user_id" = "auth"."uid"()))));



CREATE POLICY "Allow authenticated delete on binance rates" ON "public"."exchange_rates_binance" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated insert on binance rates" ON "public"."exchange_rates_binance" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated update on binance rates" ON "public"."exchange_rates_binance" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow public read access on binance rates" ON "public"."exchange_rates_binance" FOR SELECT USING (true);



CREATE POLICY "Allow public read access on exchange_rates" ON "public"."exchange_rates" FOR SELECT USING (true);



CREATE POLICY "Allow service role write access on exchange_rates" ON "public"."exchange_rates" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Clients can create reviews for their own orders" ON "public"."order_reviews" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."user_id" = "auth"."uid"()) AND ("clients"."user_id" = "order_reviews"."client_id")))) AND (EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_reviews"."order_id") AND ("orders"."client_id" = "order_reviews"."client_id") AND ("orders"."state" = 13)))) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."order_reviews" "existing"
  WHERE (("existing"."order_id" = "order_reviews"."order_id") AND ("existing"."client_id" = "order_reviews"."client_id")))))));



CREATE POLICY "Clients can update their alternatives" ON "public"."product_alternatives" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."clients" "c" ON (("c"."user_id" = "o"."client_id")))
  WHERE (("o"."id" = "product_alternatives"."order_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."clients" "c" ON (("c"."user_id" = "o"."client_id")))
  WHERE (("o"."id" = "product_alternatives"."order_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Clients can update their own reviews" ON "public"."order_reviews" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."user_id" = "auth"."uid"()) AND ("clients"."user_id" = "order_reviews"."client_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."user_id" = "auth"."uid"()) AND ("clients"."user_id" = "order_reviews"."client_id")))));



CREATE POLICY "Clients can view their alternatives" ON "public"."product_alternatives" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."clients" "c" ON (("c"."user_id" = "o"."client_id")))
  WHERE (("o"."id" = "product_alternatives"."order_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Clients can view their own reviews" ON "public"."order_reviews" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."user_id" = "auth"."uid"()) AND ("clients"."user_id" = "order_reviews"."client_id")))));



CREATE POLICY "Employees can create alternatives" ON "public"."product_alternatives" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Employees can view all alternatives" ON "public"."product_alternatives" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Employees can view all reviews" ON "public"."order_reviews" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Only admins can delete reviews" ON "public"."order_reviews" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."administrators"
  WHERE ("administrators"."user_id" = "auth"."uid"()))));



CREATE POLICY "Service role can read all orders" ON "public"."orders" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Users can delete their sent messages" ON "public"."chat_messages" FOR DELETE USING (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can delete their typing status" ON "public"."chat_typing_status" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can hide conversations for themselves" ON "public"."chat_hidden_conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their typing status" ON "public"."chat_typing_status" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their hidden conversations" ON "public"."chat_hidden_conversations" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can send messages" ON "public"."chat_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can unhide their own conversations" ON "public"."chat_hidden_conversations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update received messages" ON "public"."chat_messages" FOR UPDATE USING (("auth"."uid"() = "receiver_id")) WITH CHECK (("auth"."uid"() = "receiver_id"));



CREATE POLICY "Users can update their sent messages" ON "public"."chat_messages" FOR UPDATE USING (("auth"."uid"() = "sender_id")) WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can update their typing status" ON "public"."chat_typing_status" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own hidden conversations" ON "public"."chat_hidden_conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own messages" ON "public"."chat_messages" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Users can view typing status directed to them" ON "public"."chat_typing_status" FOR SELECT USING ((("auth"."uid"() = "typing_to_id") OR ("auth"."uid"() = "user_id")));



ALTER TABLE "public"."air_shipments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_hidden_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_typing_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exchange_rates_binance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maritime_shipments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_reads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_reads_delete_own" ON "public"."notification_reads" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_reads_insert_own" ON "public"."notification_reads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_reads_select_own" ON "public"."notification_reads" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert_authenticated" ON "public"."notifications" FOR INSERT WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "notifications_read_all" ON "public"."notifications" FOR SELECT USING (true);



CREATE POLICY "notifications_update_authenticated" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "notifications_update_owner" ON "public"."notifications" FOR UPDATE USING ((("audience_type" = 'user'::"text") AND ("user_id" IS NOT NULL) AND ("auth"."uid"() = "user_id"))) WITH CHECK ((("audience_type" = 'user'::"text") AND ("user_id" IS NOT NULL) AND ("auth"."uid"() = "user_id")));



ALTER TABLE "public"."order_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_alternatives" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "userlevel_read_own" ON "public"."userlevel" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."administrators";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."air_shipments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."boxes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."business_config";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_typing_status";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."clients";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."containers";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."employees";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."exchange_rates";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."exchange_rates_binance";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."exchange_rates_cny";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notification_reads";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_reviews";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_state_history";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."payments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."userlevel";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."assign_order_to_employee"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_order_to_employee"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_order_to_employee"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_order_to_least_busy_employee_safe"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_order_to_least_busy_employee_safe"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_order_to_least_busy_employee_safe"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_order_to_least_busy_employees"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_order_to_least_busy_employees"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_order_to_least_busy_employees"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_binance_rates"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_binance_rates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_binance_rates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_exchange_rates_cny"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_exchange_rates_cny"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_exchange_rates_cny"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_message"("message_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_message"("message_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_message"("message_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_conversations"("admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_conversations"("admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_conversations"("admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_binance_rate_history"("result_limit" integer, "only_valid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_binance_rate_history"("result_limit" integer, "only_valid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_binance_rate_history"("result_limit" integer, "only_valid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chat_conversations_v2"("current_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_chat_conversations_v2"("current_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chat_conversations_v2"("current_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_valid_binance_rate"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_valid_binance_rate"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_valid_binance_rate"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_valid_exchange_rate_cny"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_valid_exchange_rate_cny"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_valid_exchange_rate_cny"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_state_history"("p_order_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_state_history"("p_order_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_state_history"("p_order_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_timeline"("p_order_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_timeline"("p_order_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_timeline"("p_order_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_messages_count"("for_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_messages_count"("for_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_messages_count"("for_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_userlevel"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_userlevel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_userlevel"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_order_state_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_order_state_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_order_state_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."manage_user_roles"() TO "anon";
GRANT ALL ON FUNCTION "public"."manage_user_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."manage_user_roles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."metricas_con_cambio"() TO "anon";
GRANT ALL ON FUNCTION "public"."metricas_con_cambio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."metricas_con_cambio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pedidos_por_mes"() TO "anon";
GRANT ALL ON FUNCTION "public"."pedidos_por_mes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pedidos_por_mes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_elapsed_time"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_elapsed_time"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_elapsed_time"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_messages_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_messages_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_messages_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_typing_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_typing_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_typing_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_elapsed_time"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_elapsed_time"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_elapsed_time"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_employee_user_level_function"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_employee_user_level_function"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_employee_user_level_function"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_reviews_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_reviews_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_reviews_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_alternatives_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_alternatives_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_alternatives_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_user_password"("user_id" "uuid", "password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_user_password"("user_id" "uuid", "password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_user_password"("user_id" "uuid", "password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_user_password_direct"("user_email" "text", "user_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_user_password_direct"("user_email" "text", "user_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_user_password_direct"("user_email" "text", "user_password" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."administrators" TO "anon";
GRANT ALL ON TABLE "public"."administrators" TO "authenticated";
GRANT ALL ON TABLE "public"."administrators" TO "service_role";



GRANT ALL ON TABLE "public"."air_shipments" TO "anon";
GRANT ALL ON TABLE "public"."air_shipments" TO "authenticated";
GRANT ALL ON TABLE "public"."air_shipments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."air_shipments_shipment_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."air_shipments_shipment_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."air_shipments_shipment_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."boxes" TO "anon";
GRANT ALL ON TABLE "public"."boxes" TO "authenticated";
GRANT ALL ON TABLE "public"."boxes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."boxes_box_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."boxes_box_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."boxes_box_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."business_config" TO "anon";
GRANT ALL ON TABLE "public"."business_config" TO "authenticated";
GRANT ALL ON TABLE "public"."business_config" TO "service_role";



GRANT ALL ON SEQUENCE "public"."business_config_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."business_config_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."business_config_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."chat_hidden_conversations" TO "anon";
GRANT ALL ON TABLE "public"."chat_hidden_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_hidden_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_typing_status" TO "anon";
GRANT ALL ON TABLE "public"."chat_typing_status" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_typing_status" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."containers" TO "anon";
GRANT ALL ON TABLE "public"."containers" TO "authenticated";
GRANT ALL ON TABLE "public"."containers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."containers_container_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."containers_container_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."containers_container_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_rates" TO "anon";
GRANT ALL ON TABLE "public"."exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rates" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_rates_binance" TO "anon";
GRANT ALL ON TABLE "public"."exchange_rates_binance" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rates_binance" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_rates_cny" TO "anon";
GRANT ALL ON TABLE "public"."exchange_rates_cny" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rates_cny" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exchange_rates_cny_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exchange_rates_cny_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exchange_rates_cny_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exchange_rates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exchange_rates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exchange_rates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."maritime_shipments" TO "anon";
GRANT ALL ON TABLE "public"."maritime_shipments" TO "authenticated";
GRANT ALL ON TABLE "public"."maritime_shipments" TO "service_role";



GRANT ALL ON TABLE "public"."notification_reads" TO "anon";
GRANT ALL ON TABLE "public"."notification_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_reads" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_reviews" TO "anon";
GRANT ALL ON TABLE "public"."order_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."order_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."order_state_history" TO "anon";
GRANT ALL ON TABLE "public"."order_state_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_state_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_state_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_state_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_state_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pagos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pagos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pagos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_alternatives" TO "anon";
GRANT ALL ON TABLE "public"."product_alternatives" TO "authenticated";
GRANT ALL ON TABLE "public"."product_alternatives" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_alternatives_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_alternatives_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_alternatives_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_phones" TO "anon";
GRANT ALL ON TABLE "public"."user_phones" TO "authenticated";
GRANT ALL ON TABLE "public"."user_phones" TO "service_role";



GRANT ALL ON TABLE "public"."userlevel" TO "anon";
GRANT ALL ON TABLE "public"."userlevel" TO "authenticated";
GRANT ALL ON TABLE "public"."userlevel" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























