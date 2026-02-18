import { SupabaseClient } from '@supabase/supabase-js';

export type ClientLanguage = 'es' | 'en' | 'zh';

const VALID: ClientLanguage[] = ['es', 'en', 'zh'];

function isClientLevel(userLevel: string | null | undefined): boolean {
  if (!userLevel || typeof userLevel !== 'string') return false;
  return userLevel.trim().toLowerCase() === 'client';
}

/**
 * Obtiene el idioma preferido del cliente desde userlevel.
 * Solo aplica a clientes; si no existe o no es válido, devuelve 'es'.
 * Usa maybeSingle() para no fallar si no hay fila; user_level se acepta en cualquier capitalización.
 */
export async function getClientPreferredLanguage(
  supabase: SupabaseClient,
  clientId: string
): Promise<ClientLanguage> {
  if (!clientId) {
    console.warn('[getClientPreferredLanguage] clientId vacío, usando es');
    return 'es';
  }

  const { data, error } = await supabase
    .from('userlevel')
    .select('preferred_language, user_level')
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    console.warn('[getClientPreferredLanguage] Error leyendo userlevel:', error.message, 'clientId:', clientId);
    return 'es';
  }

  if (!data) {
    console.warn('[getClientPreferredLanguage] No hay fila en userlevel para clientId:', clientId, '→ usando es');
    return 'es';
  }

  if (!isClientLevel(data.user_level)) {
    console.warn('[getClientPreferredLanguage] user_level no es Client:', data.user_level, 'clientId:', clientId, '→ usando es');
    return 'es';
  }

  const raw = (data.preferred_language != null ? String(data.preferred_language).trim() : null) || null;
  if (raw && VALID.includes(raw as ClientLanguage)) {
    return raw as ClientLanguage;
  }

  console.warn('[getClientPreferredLanguage] preferred_language ausente o inválido:', data.preferred_language, 'clientId:', clientId, '→ usando es');
  return 'es';
}

export type ClientNotificationPreferences = {
  lang: ClientLanguage;
  notifications_email: boolean;
  notifications_whatsapp: boolean;
};

/**
 * Obtiene idioma y preferencias de notificación del cliente (una sola consulta).
 * Solo aplica a clientes; si no es cliente o no hay fila, devuelve valores por defecto.
 */
export async function getClientNotificationSettings(
  supabase: SupabaseClient,
  clientId: string
): Promise<ClientNotificationPreferences> {
  const defaults: ClientNotificationPreferences = {
    lang: 'es',
    notifications_email: true,
    notifications_whatsapp: false,
  };
  if (!clientId) return defaults;

  const { data, error } = await supabase
    .from('userlevel')
    .select('preferred_language, user_level, notifications_email, notifications_whatsapp')
    .eq('id', clientId)
    .maybeSingle();

  if (error || !data) return defaults;
  if (!isClientLevel(data.user_level)) return defaults;

  const raw = (data.preferred_language != null ? String(data.preferred_language).trim() : null) || null;
  const lang = (raw && VALID.includes(raw as ClientLanguage)) ? (raw as ClientLanguage) : 'es';
  const notifications_email = data.notifications_email !== false;
  const notifications_whatsapp = data.notifications_whatsapp === true;

  return { lang, notifications_email, notifications_whatsapp };
}
