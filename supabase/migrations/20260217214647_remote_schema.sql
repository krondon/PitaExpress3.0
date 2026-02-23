set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_chat_group(group_name text, group_description text DEFAULT NULL::text, member_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_group_id UUID;
  member_id UUID;
BEGIN
  -- Crear el grupo
  INSERT INTO chat_groups (name, description, created_by)
  VALUES (group_name, group_description, auth.uid())
  RETURNING id INTO new_group_id;
  
  -- Añadir al creador como admin
  INSERT INTO chat_group_members (group_id, user_id, role)
  VALUES (new_group_id, auth.uid(), 'admin');
  
  -- Añadir los demás miembros
  FOREACH member_id IN ARRAY member_ids
  LOOP
    IF member_id != auth.uid() THEN
      INSERT INTO chat_group_members (group_id, user_id, role)
      VALUES (new_group_id, member_id, 'member')
      ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
  
  RETURN new_group_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_full_code(base_code text, created_date timestamp with time zone)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Format: base_code + DDMMYY
  RETURN base_code || TO_CHAR(created_date, 'DDMMYY');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_next_base_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  next_id INTEGER;
BEGIN
  -- Get next ID from sequence. Explicitly referencing public schema for table
  SELECT COALESCE(MAX(id), 0) + 1 INTO next_id FROM public.tickets;
  
  -- Return code with format PL + 4 digits
  RETURN 'PL' || LPAD(next_id::TEXT, 4, '0');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_chat_conversations(for_user_id uuid)
 RETURNS TABLE(conversation_id text, is_group boolean, name text, avatar_url text, last_message text, last_message_time timestamp with time zone, unread_count bigint, last_sender_id uuid, participant_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  -- Conversaciones individuales
  WITH individual_convos AS (
    SELECT DISTINCT
      CASE
        WHEN cm.sender_id = for_user_id THEN cm.receiver_id
        ELSE cm.sender_id
      END as other_user_id
    FROM chat_messages cm
    WHERE (cm.sender_id = for_user_id OR cm.receiver_id = for_user_id)
      AND cm.group_id IS NULL
      AND cm.receiver_id IS NOT NULL
  ),
  individual_last_msgs AS (
    SELECT DISTINCT ON (ic.other_user_id)
      ic.other_user_id,
      cm.message,
      cm.created_at,
      cm.sender_id
    FROM individual_convos ic
    JOIN chat_messages cm ON (
      (cm.sender_id = for_user_id AND cm.receiver_id = ic.other_user_id)
      OR (cm.sender_id = ic.other_user_id AND cm.receiver_id = for_user_id)
    )
    WHERE cm.group_id IS NULL
    ORDER BY ic.other_user_id, cm.created_at DESC
  ),
  individual_unread AS (
    SELECT
      cm.sender_id as other_user_id,
      COUNT(*) as unread
    FROM chat_messages cm
    WHERE cm.receiver_id = for_user_id
      AND cm.read = FALSE
      AND cm.group_id IS NULL
    GROUP BY cm.sender_id
  ),
  individual_results AS (
    SELECT
      'user_' || ic.other_user_id::TEXT as conv_id,
      FALSE as is_grp,
      COALESCE(au.raw_user_meta_data->>'name', au.email) as conv_name,
      au.raw_user_meta_data->>'avatar_url' as conv_avatar,
      ilm.message as last_msg,
      ilm.created_at as last_time,
      COALESCE(iu.unread, 0) as unread_cnt,
      ilm.sender_id as last_sender,
      ARRAY[ic.other_user_id] as participants
    FROM individual_convos ic
    LEFT JOIN auth.users au ON au.id = ic.other_user_id
    LEFT JOIN individual_last_msgs ilm ON ilm.other_user_id = ic.other_user_id
    LEFT JOIN individual_unread iu ON iu.other_user_id = ic.other_user_id
  ),
  -- Grupos
  group_convos AS (
    SELECT cg.id as group_id, cg.name, cg.avatar_url
    FROM chat_groups cg
    JOIN chat_group_members cgm ON cgm.group_id = cg.id
    WHERE cgm.user_id = for_user_id
  ),
  group_last_msgs AS (
    SELECT DISTINCT ON (gc.group_id)
      gc.group_id,
      cm.message,
      cm.created_at,
      cm.sender_id
    FROM group_convos gc
    LEFT JOIN chat_messages cm ON cm.group_id = gc.group_id
    ORDER BY gc.group_id, cm.created_at DESC
  ),
  group_unread AS (
    SELECT
      cm.group_id,
      COUNT(*) as unread
    FROM chat_messages cm
    WHERE cm.group_id IN (SELECT group_id FROM group_convos)
      AND cm.sender_id != for_user_id
      AND cm.read = FALSE
    GROUP BY cm.group_id
  ),
  group_members AS (
    SELECT
      cgm.group_id,
      ARRAY_AGG(cgm.user_id) as member_ids
    FROM chat_group_members cgm
    WHERE cgm.group_id IN (SELECT group_id FROM group_convos)
    GROUP BY cgm.group_id
  ),
  group_results AS (
    SELECT
      'group_' || gc.group_id::TEXT as conv_id,
      TRUE as is_grp,
      gc.name as conv_name,
      gc.avatar_url as conv_avatar,
      glm.message as last_msg,
      glm.created_at as last_time,
      COALESCE(gu.unread, 0) as unread_cnt,
      glm.sender_id as last_sender,
      gm.member_ids as participants
    FROM group_convos gc
    LEFT JOIN group_last_msgs glm ON glm.group_id = gc.group_id
    LEFT JOIN group_unread gu ON gu.group_id = gc.group_id
    LEFT JOIN group_members gm ON gm.group_id = gc.group_id
  )
  -- Combinar resultados
  SELECT * FROM individual_results
  UNION ALL
  SELECT * FROM group_results
  ORDER BY last_time DESC NULLS LAST;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_chat_users_by_ids(user_ids uuid[])
 RETURNS TABLE(user_id uuid, email text, name text, role text, avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    COALESCE(au.raw_user_meta_data->>'name', au.email)::TEXT as user_name,
    COALESCE(ul.user_level, 'unknown')::TEXT as user_role,
    (au.raw_user_meta_data->>'avatar_url')::TEXT as avatar
  FROM auth.users au
  LEFT JOIN userlevel ul ON ul.id = au.id
  WHERE au.id = ANY(user_ids);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_group_member_operations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_group_owner_id UUID;
    v_new_owner_id UUID;
BEGIN
    -- Obtener el ID del creador actual del grupo
    SELECT created_by INTO v_group_owner_id FROM public.chat_groups WHERE id = OLD.group_id;

    -- CASO A: BLOQUEO DE ELIMINACIÓN DEL CREADOR
    -- Si alguien intenta eliminar al creador (y no es el creador saliendo voluntariamente)
    IF OLD.user_id = v_group_owner_id AND auth.uid() != v_group_owner_id THEN
        RAISE EXCEPTION 'No se puede eliminar al creador del grupo.';
    END IF;

    -- CASO B: SUCESIÓN AUTOMÁTICA
    -- Si el creador sale voluntariamente
    IF OLD.user_id = v_group_owner_id AND auth.uid() = v_group_owner_id THEN
        -- Buscar al siguiente dueño:
        -- 1. Otros administradores
        -- 2. El miembro más antiguo
        SELECT user_id INTO v_new_owner_id
        FROM public.chat_group_members
        WHERE group_id = OLD.group_id AND user_id != OLD.user_id
        ORDER BY (role = 'admin') DESC, joined_at ASC
        LIMIT 1;

        -- Si hay un sucesor, transferir propiedad
        IF v_new_owner_id IS NOT NULL THEN
            UPDATE public.chat_groups 
            SET created_by = v_new_owner_id 
            WHERE id = OLD.group_id;
            
            -- Asegurar que el nuevo dueño tenga rango admin
            UPDATE public.chat_group_members
            SET role = 'admin'
            WHERE group_id = OLD.group_id AND user_id = v_new_owner_id;
        END IF;
    END IF;

    RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_group_messages_read(p_group_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
    update chat_messages
    set read = true
    where group_id = p_group_id
      and sender_id <> p_user_id
      and read = false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.populate_message_sender_info()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    SELECT 
        COALESCE(raw_user_meta_data->>'name', email),
        raw_user_meta_data->>'avatar_url'
    INTO 
        NEW.sender_name,
        NEW.sender_avatar
    FROM auth.users
    WHERE id = NEW.sender_id;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_chat_users(search_query text, current_user_id uuid, result_limit integer DEFAULT 20)
 RETURNS TABLE(user_id uuid, email text, name text, role text, avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::TEXT,
    COALESCE(au.raw_user_meta_data->>'name', au.email)::TEXT as user_name,
    COALESCE(ul.user_level, 'unknown')::TEXT as user_role,
    (au.raw_user_meta_data->>'avatar_url')::TEXT as avatar
  FROM auth.users au
  LEFT JOIN userlevel ul ON ul.id = au.id
  WHERE au.id != current_user_id
    AND ul.user_level IN ('Admin', 'China', 'Vzla', 'Venezuela', 'Pagos', 'pagos') -- Added Pagos/pagos
    AND (
      search_query = '' 
      OR search_query IS NULL
      OR au.email ILIKE '%' || search_query || '%'
      OR (au.raw_user_meta_data->>'name') ILIKE '%' || search_query || '%'
    )
  ORDER BY 
    CASE WHEN search_query != '' AND au.email ILIKE search_query || '%' THEN 0 ELSE 1 END,
    au.email
  LIMIT result_limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_chat_groups_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_tickets_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- Triggers de protección de storage (storage.protect_delete) existen en Supabase Cloud
-- pero no en local; se omiten aquí para que la migración aplique en local sin error.

