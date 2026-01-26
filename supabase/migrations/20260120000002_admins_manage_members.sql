
-- Permitir a los administradores actualizar miembros (ej: promover a otros)
CREATE POLICY "Admins can update members"
  ON chat_group_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chat_group_members cgm
      WHERE cgm.group_id = chat_group_members.group_id
      AND cgm.user_id = auth.uid()
      AND cgm.role = 'admin'
    )
  );

-- Permitir a los administradores eliminar miembros
CREATE POLICY "Admins can remove members"
  ON chat_group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_group_members cgm
      WHERE cgm.group_id = chat_group_members.group_id
      AND cgm.user_id = auth.uid()
      AND cgm.role = 'admin'
    )
  );
