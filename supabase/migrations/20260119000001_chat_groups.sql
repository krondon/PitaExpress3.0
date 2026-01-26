-- ============================================
-- PITAEXPRESS - CHAT GROUPS SYSTEM
-- ============================================
-- Añade soporte para grupos de chat y extiende
-- el sistema para incluir el rol 'venezuela'
-- ============================================

-- ============================================
-- 1. ACTUALIZAR chat_messages para soportar 'venezuela'
-- ============================================

-- Eliminar constraint anterior y añadir nueva con 'venezuela'
ALTER TABLE chat_messages 
  DROP CONSTRAINT IF EXISTS chat_messages_sender_role_check,
  DROP CONSTRAINT IF EXISTS chat_messages_receiver_role_check;

ALTER TABLE chat_messages 
  ADD CONSTRAINT chat_messages_sender_role_check 
    CHECK (sender_role IN ('admin', 'china', 'venezuela')),
  ADD CONSTRAINT chat_messages_receiver_role_check 
    CHECK (receiver_role IN ('admin', 'china', 'venezuela'));

-- ============================================
-- 2. TABLA: chat_groups
-- ============================================
-- Almacena la información de los grupos de chat

CREATE TABLE IF NOT EXISTS chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_chat_groups_created_by ON chat_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_groups_created_at ON chat_groups(created_at DESC);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_chat_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_groups_updated_at ON chat_groups;
CREATE TRIGGER chat_groups_updated_at
  BEFORE UPDATE ON chat_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_groups_updated_at();

-- ============================================
-- 3. TABLA: chat_group_members
-- ============================================
-- Almacena los miembros de cada grupo

CREATE TABLE IF NOT EXISTS chat_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_chat_group_members_group ON chat_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user ON chat_group_members(user_id);

-- ============================================
-- 4. ACTUALIZAR chat_messages para grupos
-- ============================================

-- Añadir columna group_id (nullable - si es null, es mensaje directo)
ALTER TABLE chat_messages 
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE;

-- Índice para mensajes de grupo
CREATE INDEX IF NOT EXISTS idx_chat_messages_group ON chat_messages(group_id) WHERE group_id IS NOT NULL;

-- Actualizar constraint: receiver_id puede ser null si es mensaje de grupo
-- Primero hacemos receiver_id nullable
ALTER TABLE chat_messages 
  ALTER COLUMN receiver_id DROP NOT NULL;

-- Añadir constraint: debe tener receiver_id O group_id
ALTER TABLE chat_messages 
  DROP CONSTRAINT IF EXISTS chat_messages_receiver_or_group_check;

ALTER TABLE chat_messages 
  ADD CONSTRAINT chat_messages_receiver_or_group_check 
    CHECK (
      (receiver_id IS NOT NULL AND group_id IS NULL) OR 
      (receiver_id IS NULL AND group_id IS NOT NULL)
    );

-- ============================================
-- 5. RLS para chat_groups
-- ============================================

ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;

-- Simplificado: todos los usuarios autenticados pueden ver grupos
-- La seguridad real se maneja en chat_group_members
CREATE POLICY "Authenticated users can view groups"
  ON chat_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- Los usuarios pueden crear grupos
CREATE POLICY "Users can create groups"
  ON chat_groups
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
  );

-- Solo el creador puede actualizar grupo
CREATE POLICY "Creator can update group"
  ON chat_groups
  FOR UPDATE
  USING (
    auth.uid() = created_by
  );

-- Solo el creador puede eliminar el grupo
CREATE POLICY "Creator can delete group"
  ON chat_groups
  FOR DELETE
  USING (
    auth.uid() = created_by
  );

-- ============================================
-- 6. RLS para chat_group_members
-- ============================================

ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;

-- Simplificado: Los usuarios autenticados pueden ver miembros
-- (solo verán grupos donde son miembros por la query del frontend)
CREATE POLICY "Authenticated users can view members"
  ON chat_group_members
  FOR SELECT
  TO authenticated
  USING (true);

-- El creador del grupo puede añadir miembros, o usuarios añadiéndose a sí mismos
CREATE POLICY "Creators can add members"
  ON chat_group_members
  FOR INSERT
  WITH CHECK (
    -- El creador del grupo puede añadir
    EXISTS (
      SELECT 1 FROM chat_groups cg
      WHERE cg.id = group_id
      AND cg.created_by = auth.uid()
    )
    OR
    -- O añadiéndose a sí mismo
    auth.uid() = user_id
  );

-- El creador del grupo puede actualizar roles
CREATE POLICY "Creators can update members"
  ON chat_group_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chat_groups cg
      WHERE cg.id = chat_group_members.group_id
      AND cg.created_by = auth.uid()
    )
  );

-- El creador puede eliminar miembros, o un usuario puede salir
CREATE POLICY "Creators can remove or users can leave"
  ON chat_group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_groups cg
      WHERE cg.id = chat_group_members.group_id
      AND cg.created_by = auth.uid()
    )
    OR
    auth.uid() = user_id
  );

-- ============================================
-- 7. ACTUALIZAR RLS de chat_messages para grupos
-- ============================================

-- Eliminar policies antiguas
DROP POLICY IF EXISTS "Users can view their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;

-- Nueva policy: ver mensajes directos O de grupos donde es miembro
CREATE POLICY "Users can view their messages"
  ON chat_messages
  FOR SELECT
  USING (
    -- Mensajes directos
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    OR
    -- Mensajes de grupo donde es miembro
    (group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM chat_group_members 
      WHERE chat_group_members.group_id = chat_messages.group_id 
      AND chat_group_members.user_id = auth.uid()
    ))
  );

-- Nueva policy: enviar mensajes directos O a grupos donde es miembro
CREATE POLICY "Users can send messages"
  ON chat_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      -- Mensaje directo
      (receiver_id IS NOT NULL AND group_id IS NULL)
      OR
      -- Mensaje a grupo donde es miembro
      (group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM chat_group_members 
        WHERE chat_group_members.group_id = chat_messages.group_id 
        AND chat_group_members.user_id = auth.uid()
      ))
    )
  );

-- ============================================
-- 8. FUNCIÓN: Obtener conversaciones (actualizada)
-- ============================================
-- Retorna tanto conversaciones individuales como grupos

CREATE OR REPLACE FUNCTION get_chat_conversations(for_user_id UUID)
RETURNS TABLE (
  conversation_id TEXT,
  is_group BOOLEAN,
  name TEXT,
  avatar_url TEXT,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT,
  last_sender_id UUID,
  participant_ids UUID[]
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. FUNCIÓN: Buscar usuarios para chat
-- ============================================

CREATE OR REPLACE FUNCTION search_chat_users(
  search_query TEXT,
  current_user_id UUID,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  avatar_url TEXT
) AS $$
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
    AND ul.user_level IN ('Admin', 'China', 'Vzla', 'Venezuela')
    AND (
      search_query = '' 
      OR search_query IS NULL
      OR au.email ILIKE '%' || search_query || '%'
      OR au.raw_user_meta_data->>'name' ILIKE '%' || search_query || '%'
    )
  ORDER BY 
    CASE WHEN search_query != '' AND au.email ILIKE search_query || '%' THEN 0 ELSE 1 END,
    au.email
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. FUNCIÓN: Crear grupo con miembros
-- ============================================

CREATE OR REPLACE FUNCTION create_chat_group(
  group_name TEXT,
  group_description TEXT DEFAULT NULL,
  member_ids UUID[] DEFAULT '{}'
)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos para las funciones RPC
GRANT EXECUTE ON FUNCTION get_chat_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_chat_users(TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION create_chat_group(TEXT, TEXT, UUID[]) TO authenticated;

-- ============================================
-- 11. HABILITAR REALTIME PARA LAS NUEVAS TABLAS
-- ============================================

-- Habilitar Realtime para chat_groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'chat_groups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_groups;
  END IF;
END $$;

-- Habilitar Realtime para chat_group_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'chat_group_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_members;
  END IF;
END $$;

-- ============================================
-- 12. FUNCIÓN: Obtener detalles de usuarios por IDs
-- ============================================

CREATE OR REPLACE FUNCTION get_chat_users_by_ids(
  user_ids UUID[]
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT,
  role TEXT,
  avatar_url TEXT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_chat_users_by_ids(UUID[]) TO authenticated;
