-- Fix remaining security warning for get_chat_conversations_v3 with parameter
-- This version has p_user_id uuid parameter and needs SET search_path = ''

CREATE OR REPLACE FUNCTION public.get_chat_conversations_v3(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  user_email text,
  user_name text,
  last_message text,
  last_message_time timestamptz,
  unread_count bigint,
  last_file_url text,
  is_hidden boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
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
             $function$;

COMMENT ON FUNCTION public.get_chat_conversations_v3(uuid) IS 'Chat conversations using SECURITY INVOKER to respect RLS and auth access';
