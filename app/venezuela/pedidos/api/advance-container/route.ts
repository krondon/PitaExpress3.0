import { NextRequest } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { shouldSendEmail, sendOrderStateEmail } from '@/lib/email-notifications';
import { shouldSendWhatsApp, sendOrderWhatsApp } from '@/lib/whatsapp-notifications';

export async function PATCH(req: NextRequest) {
  try {
    const { containerId, nextState } = await req.json();
    if (!containerId || typeof nextState !== 'number') {
      return Response.json({ error: 'containerId y nextState son requeridos' }, { status: 400 });
    }
    const supabase = getSupabaseServiceRoleClient();
    const { error } = await supabase
      .from('containers')
      .update({ state: nextState })
      .eq('container_id', containerId);
    if (error) throw error;

    // Si el contenedor fue marcado como recibido (p.ej. nextState === 4),
    // actualizar en cascada: cajas -> estado 5, pedidos -> estado 11 (Llegó a Vzla)
    if (nextState === 4) {
      // Obtener ids de las cajas del contenedor
      const { data: boxes, error: boxesErr } = await supabase
        .from('boxes')
        .select('box_id')
        .eq('container_id', containerId);
      if (boxesErr) throw boxesErr;

      const boxIds = (boxes || [])
        .map((b: any) => b.box_id)
        .filter((id: any) => id !== null && id !== undefined);

      if (boxIds.length > 0) {
        // Actualizar cajas a estado 5
        const { error: updBoxesErr } = await supabase
          .from('boxes')
          .update({ state: 5 })
          .in('box_id', boxIds as any);
        if (updBoxesErr) throw updBoxesErr;

        // Actualizar pedidos de esas cajas a estado 11 (Llegó a Venezuela)
        // y obtener client_id para notificaciones
        const { data: ordersData, error: ordersErr } = await supabase
          .from('orders')
          .select('id, client_id')
          .in('box_id', boxIds as any);

        if (ordersErr) throw ordersErr;

        const { error: updOrdersErr } = await supabase
          .from('orders')
          .update({ state: 11 })
          .in('box_id', boxIds as any);
        if (updOrdersErr) throw updOrdersErr;

        // Enviar notificaciones de WhatsApp y Email (estado 11)
        if (ordersData && ordersData.length > 0) {
          const notificationPromises: Promise<void>[] = [];
          for (const order of ordersData) {
            if (order.client_id && shouldSendEmail(11)) {
              notificationPromises.push(sendOrderStateEmail(String(order.id), 11, order.client_id));
            }
            if (order.client_id && shouldSendWhatsApp(11)) {
              notificationPromises.push(sendOrderWhatsApp(String(order.id), 11, order.client_id));
            }
          }
          // Esperamos a que todas las notificaciones se envíen (o fallen) antes de cerrar la conexión
          await Promise.allSettled(notificationPromises);
        }
      }
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message || 'Error actualizando estado de contenedor' }, { status: 500 });
  }
}
