import { NextRequest } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { shouldSendEmail, sendOrderStateEmail } from '@/lib/email-notifications';
import { shouldSendWhatsApp, sendOrderWhatsApp } from '@/lib/whatsapp-notifications';

export async function PATCH(req: NextRequest) {
  try {
    const { orderId, nextState } = await req.json();
    if (!orderId || typeof nextState !== 'number') {
      return Response.json({ error: 'orderId y nextState son requeridos' }, { status: 400 });
    }
    const supabase = getSupabaseServiceRoleClient();

    // Obtener client_id antes de actualizar (para email/WhatsApp)
    const { data: order } = await supabase
      .from('orders')
      .select('id, client_id')
      .eq('id', orderId)
      .single();

    const { error } = await supabase
      .from('orders')
      .update({ state: nextState })
      .eq('id', orderId);
    if (error) throw error;

    // Cuando el estado es 3, 5, 9 o 11, notificar al cliente por email y WhatsApp
    if (order?.client_id && shouldSendEmail(nextState)) {
      sendOrderStateEmail(String(orderId), nextState, order.client_id).catch(() => {});
    }
    if (order?.client_id && shouldSendWhatsApp(nextState)) {
      sendOrderWhatsApp(String(orderId), nextState, order.client_id).catch(() => {});
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message || 'Error actualizando estado' }, { status: 500 });
  }
}
