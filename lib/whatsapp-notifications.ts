import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

const SUPERAPI_URL = 'https://v4.iasuperapi.com/api/v1/send-message';

/**
 * Mensajes de WhatsApp para cada estado de pedido que dispara notificación.
 */
const whatsappMessages: Record<number, (productName: string, orderId: string) => string> = {
    3: (productName, orderId) =>
        `📋 *Cotización lista*\n\nTu pedido #${orderId}${productName ? ` (${productName})` : ''} ha sido cotizado.\nPor favor, revisa la cotización y realiza el pago para continuar.\n\n— Pita Express`,
    5: (productName, orderId) =>
        `✅ *¡Pago confirmado!*\n\nEl pago de tu pedido #${orderId}${productName ? ` (${productName})` : ''} ha sido validado.\nTu pedido está listo para ser empaquetado.\n\n— Pita Express`,
    9: (productName, orderId) =>
        `🚢 *Pedido enviado*\n\nTu pedido #${orderId}${productName ? ` (${productName})` : ''} ya va en camino de China a Venezuela.\nTe avisaremos cuando llegue.\n\n— Pita Express`,
    11: (productName, orderId) =>
        `🇻🇪 *¡Tu pedido llegó a Venezuela!*\n\nTu pedido #${orderId}${productName ? ` (${productName})` : ''} ha sido recibido en nuestras oficinas.\nPronto estará listo para retiro o entrega.\n\n— Pita Express`,
};

const WHATSAPP_STATES = [3, 5, 9, 11] as const;
type WhatsAppState = typeof WHATSAPP_STATES[number];

export function shouldSendWhatsApp(state: number): state is WhatsAppState {
    return (WHATSAPP_STATES as readonly number[]).includes(state);
}

/**
 * Enviar mensaje de WhatsApp al cliente vía Superapi.
 * Fire-and-forget — no bloquea la respuesta del API.
 */
export async function sendOrderWhatsApp(
    orderId: string | number,
    state: WhatsAppState,
    clientId: string
): Promise<void> {
    const token = process.env.SUPERAPI_TOKEN;
    if (!token) {
        console.warn('[WhatsApp] SUPERAPI_TOKEN no configurado, omitiendo envío');
        return;
    }

    try {
        const supabase = getSupabaseServiceRoleClient();

        // 1. Obtener teléfono del cliente desde la vista user_phones
        const { data: phoneData, error: phoneError } = await supabase
            .from('user_phones')
            .select('phone')
            .eq('id', clientId)
            .single();

        if (phoneError || !phoneData?.phone) {
            console.warn(`[WhatsApp] No se encontró teléfono para clientId=${clientId}:`, phoneError?.message);
            return;
        }

        // 2. Obtener info del pedido
        const { data: order } = await supabase
            .from('orders')
            .select('id, productName')
            .eq('id', Number(orderId))
            .single();

        const productName = order?.productName || '';
        const orderIdStr = String(orderId);

        // 3. Generar mensaje
        const messageFn = whatsappMessages[state];
        if (!messageFn) return;
        const message = messageFn(productName, orderIdStr);

        // 4. Enviar vía Superapi
        const chatId = `${phoneData.phone}@c.us`;

        const response = await fetch(SUPERAPI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ chatId, message }),
        });

        const result = await response.json();

        if (result.statusCode === 200 || response.ok) {
            console.log(`[WhatsApp] ✅ Mensaje enviado a ${phoneData.phone} — Estado ${state}, Pedido #${orderId}`);
        } else {
            console.warn(`[WhatsApp] ⚠️ Error enviando a ${phoneData.phone}:`, result);
        }
    } catch (err) {
        console.error(`[WhatsApp] Excepción en sendOrderWhatsApp (pedido #${orderId}, estado ${state}):`, err);
    }
}
