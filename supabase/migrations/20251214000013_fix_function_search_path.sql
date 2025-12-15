-- Fix security warnings: mutable search_path in functions
-- Setting search_path to empty string or 'public' makes it immutable

-- Fix is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.administrators
    WHERE user_id = auth.uid()
  );
END;
$$;

-- Fix get_chat_conversations_v3 function
CREATE OR REPLACE FUNCTION public.get_chat_conversations_v3()
RETURNS TABLE (
  conversation_id uuid,
  participant_id uuid,
  participant_name text,
  participant_role text,
  last_message text,
  last_message_time timestamptz,
  unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- Fix get_admin_id_by_email function
CREATE OR REPLACE FUNCTION public.get_admin_id_by_email(admin_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT user_id INTO admin_id
  FROM public.administrators
  WHERE email = admin_email
  LIMIT 1;
  
  RETURN admin_id;
END;
$$;

-- Fix update_max_state_reached function
CREATE OR REPLACE FUNCTION public.update_max_state_reached()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;
