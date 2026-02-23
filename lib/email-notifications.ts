import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { getClientNotificationSettings } from '@/lib/client-notification-lang';
import { getOrderStateEmailByLang, getProductAlternativeEmailByLang } from '@/lib/email-templates-i18n';

// Estados que disparan email al cliente
const EMAIL_STATES = [3, 5, 9, 11] as const;

type EmailState = typeof EMAIL_STATES[number];

export function shouldSendEmail(state: number): state is EmailState {
    return (EMAIL_STATES as readonly number[]).includes(state);
}

/**
 * Enviar email de notificación al cliente cuando su pedido cambia de estado.
 * Diseñado para ser fire-and-forget (no debería bloquear la respuesta del API).
 */
export async function sendOrderStateEmail(
    orderId: string | number,
    state: EmailState,
    clientId: string
): Promise<void> {
    try {
        const supabase = getSupabaseServiceRoleClient();

        // 1. Obtener email del cliente desde Supabase Auth
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(clientId);
        if (userError || !userData?.user?.email) {
            console.warn(`[Email] No se pudo obtener email para clientId=${clientId}:`, userError?.message);
            return;
        }

        const clientEmail = userData.user.email;
        const clientName = userData.user.user_metadata?.full_name
            || userData.user.user_metadata?.name
            || null;

        // 2. Obtener info del pedido
        const { data: order } = await supabase
            .from('orders')
            .select('id, productName')
            .eq('id', Number(orderId))
            .single();

        const productName = order?.productName || '';
        const orderIdStr = String(orderId);

        // 3. Preferencias del cliente (idioma y si acepta notificaciones por correo)
        const settings = await getClientNotificationSettings(supabase, clientId);
        if (!settings.notifications_email) {
            console.log(`[Email] Cliente ${clientId} tiene notificaciones por correo desactivadas, omitiendo pedido #${orderIdStr}`);
            return;
        }
        if (settings.lang !== 'es') {
            console.log(`[Email] Idioma del cliente ${clientId}: ${settings.lang} (pedido #${orderIdStr}, estado ${state})`);
        }
        const emailData = getOrderStateEmailByLang(settings.lang, state, orderIdStr, productName, clientName ?? undefined);

        const result = await sendEmail({
            to: clientEmail,
            subject: emailData.subject,
            html: emailData.html,
        });

        if (result.success) {
            console.log(`[Email] ✅ Email enviado a ${clientEmail} — Estado ${state}, Pedido #${orderId}`);
        } else {
            console.warn(`[Email] ⚠️ Error enviando email a ${clientEmail}:`, result.error);
        }
    } catch (err) {
        console.error(`[Email] Excepción en sendOrderStateEmail (pedido #${orderId}, estado ${state}):`, err);
    }
}

/**
 * Enviar email al cliente cuando China propone una alternativa de producto.
 * Fire-and-forget.
 */
export async function sendProductAlternativeEmail(
    orderId: string | number,
    clientId: string,
    originalProductName: string,
    alternativeProductName: string
): Promise<void> {
    try {
        const supabase = getSupabaseServiceRoleClient();

        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(clientId);
        if (userError || !userData?.user?.email) {
            console.warn(`[Email] No se pudo obtener email para clientId=${clientId}:`, userError?.message);
            return;
        }

        const clientEmail = userData.user.email;
        const clientName = userData.user.user_metadata?.full_name
            || userData.user.user_metadata?.name
            || undefined;

        const settings = await getClientNotificationSettings(supabase, clientId);
        if (!settings.notifications_email) {
            console.log(`[Email] Cliente ${clientId} tiene notificaciones por correo desactivadas, omitiendo alternativa pedido #${orderId}`);
            return;
        }
        if (settings.lang !== 'es') {
            console.log(`[Email] Idioma del cliente ${clientId}: ${settings.lang} (email alternativa, pedido #${orderId})`);
        }
        const emailData = getProductAlternativeEmailByLang(
            settings.lang,
            String(orderId),
            originalProductName || '',
            alternativeProductName,
            clientName
        );

        const result = await sendEmail({
            to: clientEmail,
            subject: emailData.subject,
            html: emailData.html,
        });

        if (result.success) {
            console.log(`[Email] ✅ Email de alternativa enviado a ${clientEmail} — Pedido #${orderId}`);
        } else {
            console.warn(`[Email] ⚠️ Error enviando email de alternativa a ${clientEmail}:`, result.error);
        }
    } catch (err) {
        console.error(`[Email] Excepción en sendProductAlternativeEmail (pedido #${orderId}):`, err);
    }
}
