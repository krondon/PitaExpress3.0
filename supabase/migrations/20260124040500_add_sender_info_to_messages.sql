-- Añadir columnas para denormalización de información del remitente
ALTER TABLE chat_messages 
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_avatar TEXT;

-- Función para poblar la información del remitente automáticamente
CREATE OR REPLACE FUNCTION public.populate_message_sender_info()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para nuevos mensajes
DROP TRIGGER IF EXISTS tr_populate_message_sender_info ON chat_messages;
CREATE TRIGGER tr_populate_message_sender_info
    BEFORE INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.populate_message_sender_info();

-- Poblar mensajes existentes
UPDATE chat_messages cm
SET 
    sender_name = COALESCE(au.raw_user_meta_data->>'name', au.email),
    sender_avatar = au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
WHERE cm.sender_id = au.id
AND cm.sender_name IS NULL;
