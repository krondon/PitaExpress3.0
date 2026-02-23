-- Preferencias de notificaciones para clientes (correo y WhatsApp).
-- Solo aplica a clientes; al enviar notificaciones se respeta cada valor.
ALTER TABLE public.userlevel
ADD COLUMN IF NOT EXISTS notifications_email boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notifications_whatsapp boolean DEFAULT false;

COMMENT ON COLUMN public.userlevel.notifications_email IS 'Cliente recibe notificaciones por correo (solo clientes). Default true.';
COMMENT ON COLUMN public.userlevel.notifications_whatsapp IS 'Cliente recibe notificaciones por WhatsApp (solo clientes). Default false; se guarda para cuando esté habilitado.';
