-- ============================================
-- MEJORAS DEL SISTEMA DE CHAT
-- ============================================
-- 1. Soporte para editar y eliminar mensajes
-- 2. Soporte para eliminar/ocultar conversaciones
-- 3. Obtención de nombres reales de usuarios

-- 1. Nuevas columnas en chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_by_sender BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_by_receiver BOOLEAN DEFAULT FALSE;

-- 2. Tabla para conversaciones ocultas (si no existe)
CREATE TABLE IF NOT EXISTS chat_hidden_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, hidden_user_id)
);

-- Index para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_chat_hidden_user ON chat_hidden_conversations(user_id);

-- Habilitar RLS
ALTER TABLE chat_hidden_conversations ENABLE ROW LEVEL SECURITY;

-- Policies para chat_hidden_conversations
CREATE POLICY "Users can manage their hidden conversations"
  ON chat_hidden_conversations
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Función RPC mejorada para obtener conversaciones (con nombres reales y filtro de ocultos)
CREATE OR REPLACE FUNCTION get_chat_conversations_v2(current_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT,
  last_file_url TEXT,
  is_hidden BOOLEAN
) AS $$
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
    COALESCE(au.raw_user_meta_data->>'name', au.email) as user_name,
    lm.message as last_message,
    lm.created_at as last_message_time,
    COALESCE(uc.unread, 0) as unread_count,
    lm.file_url as last_file_url,
    (hs.hidden_user_id IS NOT NULL) as is_hidden
  FROM last_messages lm
  JOIN auth.users au ON au.id = lm.other_user_id
  LEFT JOIN unread_counts uc ON uc.other_user_id = lm.other_user_id
  LEFT JOIN hidden_status hs ON hs.hidden_user_id = lm.other_user_id
  ORDER BY lm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función para marcar mensaje como eliminado (soft delete)
CREATE OR REPLACE FUNCTION delete_message(message_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
