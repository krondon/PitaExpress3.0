-- ============================================
-- CORRECCIÓN DE PERMISOS DE CHAT
-- ============================================
-- Este script habilita la edición y borrado de mensajes propios.
-- Ejecutar en el Editor SQL de Supabase.

-- Permitir a los usuarios actualizar sus propios mensajes enviados
-- (Necesario para editar contenido o marcar como eliminado)
CREATE POLICY "Users can update their sent messages"
  ON chat_messages
  FOR UPDATE
  USING (
    auth.uid() = sender_id
  )
  WITH CHECK (
    auth.uid() = sender_id
  );
