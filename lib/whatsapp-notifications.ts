import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type { ClientLanguage } from '@/lib/email-templates';
import { getClientNotificationSettings } from '@/lib/client-notification-lang';

const SUPERAPI_URL = 'https://v4.iasuperapi.com/api/v1/send-message';

const BRAND = '— Pita Express';

function getOrderMessageByLang(lang: ClientLanguage, state: 3 | 5 | 9 | 11, productName: string, orderId: string): string {
    const pid = `#${orderId}${productName ? ` (${productName})` : ''}`;
    if (lang === 'en') {
        const msgs: Record<number, string> = {
            3: `📋 *Quote ready*\n\nYour order ${pid} has been quoted.\nPlease review the quote and make the payment to continue.\n\n${BRAND}`,
            5: `✅ *Payment confirmed!*\n\nThe payment for your order ${pid} has been validated.\nYour order is ready to be packed.\n\n${BRAND}`,
            9: `🚢 *Order shipped*\n\nYour order ${pid} is on its way from China to Venezuela.\nWe will notify you when it arrives.\n\n${BRAND}`,
            11: `🇻🇪 *Your order has arrived in Venezuela!*\n\nYour order ${pid} has been received at our offices.\nIt will soon be ready for pickup or delivery.\n\n${BRAND}`,
        };
        return msgs[state];
    }
    if (lang === 'zh') {
        const msgs: Record<number, string> = {
            3: `📋 *报价已就绪*\n\n您的订单 ${pid} 已报价。\n请查看报价并付款以继续。\n\n${BRAND}`,
            5: `✅ *付款已确认！*\n\n您的订单 ${pid} 的付款已核实。\n您的订单已准备打包。\n\n${BRAND}`,
            9: `🚢 *订单已发货*\n\n您的订单 ${pid} 正在从中国运往委内瑞拉。\n到达后我们会通知您。\n\n${BRAND}`,
            11: `🇻🇪 *您的订单已到达委内瑞拉！*\n\n您的订单 ${pid} 已在我们办事处签收。\n即将可自提或配送。\n\n${BRAND}`,
        };
        return msgs[state];
    }
    const es: Record<number, string> = {
        3: `📋 *Cotización lista*\n\nTu pedido ${pid} ha sido cotizado.\nPor favor, revisa la cotización y realiza el pago para continuar.\n\n${BRAND}`,
        5: `✅ *¡Pago confirmado!*\n\nEl pago de tu pedido ${pid} ha sido validado.\nTu pedido está listo para ser empaquetado.\n\n${BRAND}`,
        9: `🚢 *Pedido enviado*\n\nTu pedido ${pid} ya va en camino de China a Venezuela.\nTe avisaremos cuando llegue.\n\n${BRAND}`,
        11: `🇻🇪 *¡Tu pedido llegó a Venezuela!*\n\nTu pedido ${pid} ha sido recibido en nuestras oficinas.\nPronto estará listo para retiro o entrega.\n\n${BRAND}`,
    };
    return es[state];
}

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

        const settings = await getClientNotificationSettings(supabase, clientId);
        if (!settings.notifications_whatsapp) {
            console.log(`[WhatsApp] Cliente ${clientId} tiene notificaciones por WhatsApp desactivadas, omitiendo pedido #${orderIdStr}`);
            return;
        }
        const message = getOrderMessageByLang(settings.lang, state, productName, orderIdStr);

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

/**
 * Enviar WhatsApp al cliente cuando China propone una alternativa de producto.
 * Fire-and-forget.
 */
export async function sendProductAlternativeWhatsApp(
    orderId: string | number,
    clientId: string,
    originalProductName: string,
    alternativeProductName: string
): Promise<void> {
    const token = process.env.SUPERAPI_TOKEN;
    if (!token) {
        console.warn('[WhatsApp] SUPERAPI_TOKEN no configurado, omitiendo envío de alternativa');
        return;
    }

    try {
        const supabase = getSupabaseServiceRoleClient();

        const { data: phoneData, error: phoneError } = await supabase
            .from('user_phones')
            .select('phone')
            .eq('id', clientId)
            .single();

        if (phoneError || !phoneData?.phone) {
            console.warn(`[WhatsApp] No se encontró teléfono para clientId=${clientId}:`, phoneError?.message);
            return;
        }

        const orderIdStr = String(orderId);
        const settings = await getClientNotificationSettings(supabase, clientId);
        if (!settings.notifications_whatsapp) {
            console.log(`[WhatsApp] Cliente ${clientId} tiene notificaciones por WhatsApp desactivadas, omitiendo alternativa pedido #${orderId}`);
            return;
        }
        const pid = `#${orderIdStr}${originalProductName ? ` (${originalProductName})` : ''}`;
        const message = settings.lang === 'en'
            ? `🔄 *New product alternative*\n\nFor your order ${pid} we suggest this alternative:\n\n*${alternativeProductName}*\n\nGo to your client panel to review and accept or reject.\n\n${BRAND}`
            : settings.lang === 'zh'
                ? `🔄 *商品替代方案*\n\n您的订单 ${pid} 我们建议以下替代：\n\n*${alternativeProductName}*\n\n请到客户面板查看并接受或拒绝。\n\n${BRAND}`
                : `🔄 *Nueva alternativa de producto*\n\nPara tu pedido ${pid} te proponemos esta alternativa:\n\n*${alternativeProductName}*\n\nEntra a tu panel de cliente para revisarla y aceptar o rechazar.\n\n${BRAND}`;

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
            console.log(`[WhatsApp] ✅ Alternativa enviada a ${phoneData.phone} — Pedido #${orderId}`);
        } else {
            console.warn(`[WhatsApp] ⚠️ Error enviando alternativa a ${phoneData.phone}:`, result);
        }
    } catch (err) {
        console.error(`[WhatsApp] Excepción en sendProductAlternativeWhatsApp (pedido #${orderId}):`, err);
    }
}
