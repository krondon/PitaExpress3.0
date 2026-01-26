
-- Permitir a los creadores actualizar sus grupos (para nombre, descripción, avatar)
CREATE POLICY "Creators can update their groups"
  ON chat_groups
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
