-- 1. Función para manejar la sucesión automática y protección del creador
CREATE OR REPLACE FUNCTION public.handle_group_member_operations()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para manejar bajas de miembros
DROP TRIGGER IF EXISTS tr_handle_group_member_operations ON public.chat_group_members;
CREATE TRIGGER tr_handle_group_member_operations
    BEFORE DELETE ON public.chat_group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_group_member_operations();

-- 2. ACTUALIZAR RLS para chat_group_members
-- Permitir que CUALQUIER administrador del grupo pueda eliminar a otros que no sean dueños

DROP POLICY IF EXISTS "Creators can remove or users can leave" ON chat_group_members;

CREATE POLICY "Admins can remove or users can leave"
  ON chat_group_members
  FOR DELETE
  USING (
    -- Es un administrador del grupo
    EXISTS (
      SELECT 1 FROM chat_group_members cgm
      WHERE cgm.group_id = chat_group_members.group_id
      AND cgm.user_id = auth.uid()
      AND cgm.role = 'admin'
    )
    OR
    -- O el usuario se está saliendo a sí mismo
    auth.uid() = user_id
  );
