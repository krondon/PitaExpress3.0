import { NextRequest } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { shouldSendEmail, sendOrderStateEmail } from '@/lib/email-notifications';
import { shouldSendWhatsApp, sendOrderWhatsApp } from '@/lib/whatsapp-notifications';

export async function PATCH(req: NextRequest) {
  try {
    const { boxId, nextState } = await req.json();
    if (!boxId || typeof nextState !== 'number') {
      return Response.json({ error: 'boxId y nextState son requeridos' }, { status: 400 });
    }
    const supabase = getSupabaseServiceRoleClient();
    // Actualizar estado de la caja
    const { error: boxError } = await supabase
      .from('boxes')
      .update({ state: nextState })
      .eq('box_id', boxId);
    if (boxError) throw boxError;

    // Si la caja se marca "Recibido" (state 6), avanzar pedidos asociados a 11 y notificar al cliente
    if (nextState === 6) {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, client_id')
        .eq('box_id', boxId);
      if (!ordersError && orders?.length) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({ state: 11 })
          .eq('box_id', boxId);
        if (updateError) throw updateError;
        // Email y WhatsApp para cada pedido que pasó a estado 11
        for (const order of orders) {
          if (order.client_id && shouldSendEmail(11)) {
            sendOrderStateEmail(String(order.id), 11, order.client_id).catch(() => {});
          }
          if (order.client_id && shouldSendWhatsApp(11)) {
            sendOrderWhatsApp(String(order.id), 11, order.client_id).catch(() => {});
          }
        }
      }
    }
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message || 'Error actualizando estado de caja' }, { status: 500 });
  }
}
