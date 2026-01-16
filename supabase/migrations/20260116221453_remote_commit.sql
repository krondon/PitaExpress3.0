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

CREATE OR REPLACE FUNCTION public.get_admin_id_by_email(admin_email text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT id 
  FROM public.userlevel
  WHERE user_level = 'Admin'
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_chat_conversations_v2(requested_user_id uuid)
 RETURNS TABLE(user_id uuid, user_email text, user_name text, last_message text, last_message_time timestamp with time zone, unread_count bigint, last_file_url text, is_hidden boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  WITH relevant_messages AS (
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
    FROM public.chat_messages cm
    WHERE (cm.sender_id = requested_user_id AND cm.deleted_by_sender = FALSE)
       OR (cm.receiver_id = requested_user_id AND cm.deleted_by_receiver = FALSE)
  ),
  conversations AS (
    SELECT DISTINCT
      CASE
        WHEN rm.sender_id = requested_user_id THEN rm.receiver_id
        ELSE rm.sender_id
      END as other_user_id
    FROM relevant_messages rm
  ),
  hidden_status AS (
    SELECT 
      chc.hidden_user_id, 
      chc.created_at as hidden_since
    FROM public.chat_hidden_conversations chc
    WHERE chc.user_id = requested_user_id
  ),
  last_messages AS (
    SELECT DISTINCT ON (c.other_user_id)
      c.other_user_id,
      rm.message,
      rm.created_at,
      rm.file_url
    FROM conversations c
    JOIN relevant_messages rm ON 
      (rm.sender_id = c.other_user_id OR rm.receiver_id = c.other_user_id)
    LEFT JOIN hidden_status hs ON hs.hidden_user_id = c.other_user_id
    WHERE (hs.hidden_since IS NULL OR rm.created_at > hs.hidden_since)
    ORDER BY c.other_user_id, rm.created_at DESC
  ),
  unread_counts AS (
    SELECT
      rm.sender_id as other_user_id,
      COUNT(*) as unread
    FROM relevant_messages rm
    LEFT JOIN hidden_status hs ON hs.hidden_user_id = rm.sender_id
    WHERE rm.receiver_id = requested_user_id
      AND rm.read = FALSE
      AND (hs.hidden_since IS NULL OR rm.created_at > hs.hidden_since)
    GROUP BY rm.sender_id
  )
  SELECT
    lm.other_user_id as user_id,
    COALESCE(au.email, '')::text as user_email,
    CASE
      WHEN adm.user_id IS NOT NULL THEN 'Administrador'
      ELSE COALESCE(
        emp.name,
        cli.name,
        (au.raw_user_meta_data->>'name')::text,
        au.email::text,
        'Usuario Desconocido'
      )
    END as user_name,
    lm.message as last_message,
    lm.created_at as last_message_time,
    COALESCE(uc.unread, 0) as unread_count,
    lm.file_url as last_file_url, -- CORRECCIÓN: lm.file_url (del CTE) -> last_file_url (output)
    (hs.hidden_user_id IS NOT NULL) as is_hidden
  FROM last_messages lm
  JOIN auth.users au ON au.id = lm.other_user_id
  LEFT JOIN unread_counts uc ON uc.other_user_id = lm.other_user_id
  LEFT JOIN hidden_status hs ON hs.hidden_user_id = lm.other_user_id
  LEFT JOIN public.employees emp ON emp.user_id = lm.other_user_id
  LEFT JOIN public.clients cli ON cli.user_id = lm.other_user_id
  LEFT JOIN public.administrators adm ON adm.user_id = lm.other_user_id
  ORDER BY lm.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_chat_conversations_v3()
 RETURNS TABLE(conversation_id uuid, participant_id uuid, participant_name text, participant_role text, last_message text, last_message_time timestamp with time zone, unread_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  RETURN QUERY
  SELECT DISTINCT ON (c.id)
    c.id as conversation_id,
    CASE 
      WHEN c.participant1_id = current_user_id THEN c.participant2_id
      ELSE c.participant1_id
    END as participant_id,
    COALESCE(
      (SELECT name FROM public.clients WHERE user_id = 
        CASE WHEN c.participant1_id = current_user_id THEN c.participant2_id ELSE c.participant1_id END),
      (SELECT name FROM public.administrators WHERE user_id = 
        CASE WHEN c.participant1_id = current_user_id THEN c.participant2_id ELSE c.participant1_id END),
      'Usuario'
    ) as participant_name,
    'user' as participant_role,
    COALESCE(m.content, '') as last_message,
    COALESCE(m.created_at, c.created_at) as last_message_time,
    (SELECT COUNT(*) FROM public.chat_messages WHERE conversation_id = c.id AND sender_id != current_user_id AND read = false)::bigint as unread_count
  FROM public.chat_conversations c
  LEFT JOIN LATERAL (
    SELECT content, created_at 
    FROM public.chat_messages 
    WHERE conversation_id = c.id 
    ORDER BY created_at DESC 
    LIMIT 1
  ) m ON true
  WHERE c.participant1_id = current_user_id OR c.participant2_id = current_user_id
  ORDER BY c.id, m.created_at DESC NULLS LAST;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_chat_conversations_v3(p_user_id uuid)
 RETURNS TABLE(user_id uuid, user_email text, user_name text, last_message text, last_message_time timestamp with time zone, unread_count bigint, last_file_url text, is_hidden boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
             BEGIN
               RETURN QUERY
               WITH relevant_messages AS (
                 SELECT 
                   m.id, m.sender_id, m.receiver_id, m.content, m.read, m.created_at, m.file_url,
                   CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END as other_user_id
                 FROM public.chat_messages m
                 WHERE m.sender_id = p_user_id OR m.receiver_id = p_user_id
               ),
               hidden_status AS (
                 SELECT ch.hidden_user_id, ch.hidden_since
                 FROM public.chat_hidden ch
                 WHERE ch.user_id = p_user_id
               ),
               last_messages AS (
                 SELECT DISTINCT ON (rm.other_user_id)
                   rm.other_user_id,
                   rm.content as message,
                   rm.created_at,
                   rm.file_url
                 FROM relevant_messages rm
                 ORDER BY rm.other_user_id, rm.created_at DESC
               ),
               unread_counts AS (
                 SELECT 
                   rm.sender_id as other_user_id,
                   COUNT(*) as unread
                 FROM relevant_messages rm
                 LEFT JOIN hidden_status hs ON hs.hidden_user_id = rm.sender_id
                 WHERE rm.receiver_id = p_user_id
                   AND rm.read = FALSE
                   AND (hs.hidden_since IS NULL OR rm.created_at > hs.hidden_since)
                 GROUP BY rm.sender_id
               )
               SELECT 
                 lm.other_user_id,
                 COALESCE(au.email, '')::text,
                 CASE 
                   WHEN adm.user_id IS NOT NULL THEN 'Administrador'
                   ELSE COALESCE(
                     emp.name,
                     cli.name,
                     (au.raw_user_meta_data->>'name')::text,
                     au.email::text,
                     'Usuario Desconocido'
                   )
                 END,
                 lm.message,
                 lm.created_at,
                 COALESCE(uc.unread, 0),
                 lm.file_url,
                 (hs.hidden_user_id IS NOT NULL)
               FROM last_messages lm
               JOIN auth.users au ON au.id = lm.other_user_id
               LEFT JOIN unread_counts uc ON uc.other_user_id = lm.other_user_id
               LEFT JOIN hidden_status hs ON hs.hidden_user_id = lm.other_user_id
               LEFT JOIN public.employees emp ON emp.user_id = lm.other_user_id
               LEFT JOIN public.clients cli ON cli.user_id = lm.other_user_id
               LEFT JOIN public.administrators adm ON adm.user_id = lm.other_user_id
               ORDER BY lm.created_at DESC;
             END;
             $function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.administrators
    WHERE user_id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_max_state_reached()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Only update if new state is positive and greater than current max
  IF NEW.state > 0 AND NEW.state > COALESCE(NEW.max_state_reached, 0) THEN
    NEW.max_state_reached := NEW.state;
  END IF;
  
  -- If this is an INSERT and state is positive, set initial max
  IF TG_OP = 'INSERT' AND NEW.state > 0 THEN
    NEW.max_state_reached := NEW.state;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_userlevel();


