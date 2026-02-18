-- Idioma preferido del cliente (solo se usa para notificaciones email/WhatsApp a clientes).
-- Valores: 'es', 'en', 'zh'. Por defecto 'es'.
ALTER TABLE public.userlevel
ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'es';

COMMENT ON COLUMN public.userlevel.preferred_language IS 'Idioma preferido para correos y WhatsApp (solo aplica a clientes). Valores: es, en, zh.';
