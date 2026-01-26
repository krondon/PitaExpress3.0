-- Corrige los constraints de la tabla chat_messages para permitir el rol 'pagos' y 'client'
-- Ejecuta este script en el Editor SQL de Supabase

-- 1. Eliminar constraint existente de sender_role
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_role_check;

-- 2. Crear nuevo constraint incluyendo 'pagos' y 'client'
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_role_check 
  CHECK (sender_role IN ('admin', 'china', 'venezuela', 'pagos', 'client'));

-- 3. Eliminar constraint existente de receiver_role
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_receiver_role_check;

-- 4. Crear nuevo constraint incluyendo 'pagos' y 'client' (permitiendo NULL para grupos)
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_receiver_role_check 
  CHECK (receiver_role IN ('admin', 'china', 'venezuela', 'pagos', 'client') OR receiver_role IS NULL);

-- 5. Asegurar políticas RLS para 'pagos' (Validator)
-- Política genérica de inserción (si no existe ya una más restrictiva)
-- NOTA: Si ya existe una política 'Enable insert for authenticated users only', esto no es necesario,
-- pero si hay políticas por rol, podrías necesitar :
-- CREATE POLICY "Enable insert for pagos" ON chat_messages FOR INSERT TO authenticated 
-- WITH CHECK (auth.uid() = sender_id);
