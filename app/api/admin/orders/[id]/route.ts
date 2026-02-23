import { NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { NotificationsFactory } from '@/lib/notifications';
import { shouldSendEmail, sendOrderStateEmail } from '@/lib/email-notifications';
import { shouldSendWhatsApp, sendOrderWhatsApp } from '@/lib/whatsapp-notifications';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseServiceRoleClient();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('DELETE /api/admin/orders/[id] error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('DELETE /api/admin/orders/[id] exception:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseServiceRoleClient();
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const body = await req.json().catch(() => ({}));
    const update: Record<string, any> = {};

    // Sanitizar URLs para cumplir constraints (misma lógica que POST)
    const sanitizeUrl = (u: any) => {
      if (typeof u !== 'string') return null;
      let raw = u.trim();
      if (!/^https?:\/\//i.test(raw)) return null;
      try {
        const urlObj = new URL(raw);
        const canonical = `${urlObj.origin}${urlObj.pathname}`;
        raw = decodeURIComponent(canonical);
      } catch { /* keep raw */ }
      raw = raw.replace(/[^A-Za-z0-9._~:\/#?&=+\-]/g, '-');
      if (raw.length > 255) raw = raw.slice(0, 255);
      if (!/^https?:\/\/[A-Za-z0-9./_~:=+\-]+$/i.test(raw)) return null;
      return raw;
    };

    // Allow updating select fields
    if (typeof body.description === 'string') update.description = body.description;
    if (typeof body.state === 'number' && body.state >= 1 && body.state <= 13) update.state = body.state;
    if (typeof body.pdfRoutes === 'string') {
      const safePdf = sanitizeUrl(body.pdfRoutes);
      if (safePdf) update.pdfRoutes = safePdf; // si es inválida, omitir para evitar error
    }
    if (Array.isArray(body.imgs)) {
      const safeImgs = body.imgs.map(sanitizeUrl).filter(Boolean);
      update.imgs = safeImgs;
    }
    if (Array.isArray(body.links)) {
      const safeLinksRaw = body.links.map(sanitizeUrl).filter(Boolean);
      update.links = safeLinksRaw.slice(0, 1); // por si hay constraint de máx 1 link
    }
  // Nota: Asignaciones se omiten por ahora hasta confirmar columnas/valores exactos

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

  const { data, error } = await supabase
      .from('orders')
      .update(update)
      .eq('id', id)
  .select('id, state, description, pdfRoutes, imgs, links')
      .single();

    if (error) {
      console.error('PATCH /api/admin/orders/[id] error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    // Notificaciones si cambia estado
    try {
      if (typeof body.state === 'number' && data?.id) {
        const orderId = String(data.id);
        const stateNum = body.state as number;
        const stateName = getStateName(stateNum);

        // Obtener client_id
        const { data: orderFull } = await supabase.from('orders').select('client_id').eq('id', id).single();
        if (orderFull?.client_id) {
          if (stateNum === 3) {
            // Solo enviar la notificación específica de cotización lista para evitar duplicados
            const quoteNotif = NotificationsFactory.client.quoteReady({ orderId });
            // Dedupe: si ya existe una notificación igual para este pedido/usuario, omitir
            const { data: existing } = await supabase
              .from('notifications')
              .select('id')
              .eq('audience_type', 'user')
              .eq('audience_value', orderFull.client_id)
              .eq('order_id', orderId)
              .eq('title', quoteNotif.title)
              .limit(1);
            if (!existing || existing.length === 0) {
              await supabase.from('notifications').insert([
                {
                  audience_type: 'user',
                  audience_value: orderFull.client_id,
                  title: quoteNotif.title,
                  description: quoteNotif.description,
                  href: quoteNotif.href,
                  severity: quoteNotif.severity,
                  user_id: orderFull.client_id,
                  order_id: orderId,
                },
              ]);
            }
          } else {
            const notif = NotificationsFactory.client.orderStatusChanged({ orderId, status: stateName });
            await supabase.from('notifications').insert([
              {
                audience_type: 'user',
                audience_value: orderFull.client_id,
                title: notif.title,
                description: notif.description,
                href: notif.href,
                severity: notif.severity,
                user_id: orderFull.client_id,
                order_id: orderId,
              },
            ]);
          }
        }

        if (stateNum === 4) {
          const notifVzla = NotificationsFactory.venezuela.newAssignedOrder({ orderId });
          await supabase.from('notifications').insert([
            {
              audience_type: 'role',
              audience_value: 'venezuela',
              title: notifVzla.title,
              description: notifVzla.description,
              href: notifVzla.href,
              severity: notifVzla.severity,
              order_id: orderId,
            },
          ]);
        }

        // Notificar a Pagos cuando entre a validación (estado 4)
        if (stateNum === 4) {
          const notifPagos = NotificationsFactory.pagos.newAssignedOrder({ orderId });
          await supabase.from('notifications').insert([
            {
              audience_type: 'role',
              audience_value: 'pagos',
              title: notifPagos.title,
              description: notifPagos.description,
              href: notifPagos.href,
              severity: notifPagos.severity,
              unread: true,
              order_id: orderId,
            },
          ]);
        }

        // Notificar a China cuando el pedido esté listo para empaquetar (estado 5)
        if (stateNum === 5) {
          const notifChinaPack = NotificationsFactory.china.readyToPack({ orderId });
          const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
          const { data: existingPack } = await supabase
            .from('notifications')
            .select('id')
            .eq('audience_type', 'role')
            .eq('audience_value', 'china')
            .eq('order_id', orderId)
            .eq('title', notifChinaPack.title)
            .gte('created_at', since)
            .limit(1);
          if (!existingPack || existingPack.length === 0) {
            await supabase.from('notifications').insert([
              {
                audience_type: 'role',
                audience_value: 'china',
                title: notifChinaPack.title,
                description: notifChinaPack.description,
                href: notifChinaPack.href,
                severity: notifChinaPack.severity,
                order_id: orderId,
              },
            ]);
          }
        }

        // Email y WhatsApp al cliente cuando el estado es 3, 5, 9 o 11
        if (orderFull?.client_id && shouldSendEmail(stateNum)) {
          sendOrderStateEmail(orderId, stateNum, orderFull.client_id).catch(() => {});
        }
        if (orderFull?.client_id && shouldSendWhatsApp(stateNum)) {
          sendOrderWhatsApp(orderId, stateNum, orderFull.client_id).catch(() => {});
        }
      }
    } catch (notifyErr) {
      console.error('Admin update order notification error:', notifyErr);
    }

    return NextResponse.json({ ok: true, data }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('PATCH /api/admin/orders/[id] exception:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

function getStateName(state: number): string {
  const stateNames: Record<number, string> = {
    1: 'Pedido creado',
    2: 'Recibido',
    3: 'Cotizado',
    4: 'Asignado Venezuela',
    5: 'En procesamiento',
    6: 'Preparando envío',
    7: 'Listo para envío',
    8: 'Enviado',
    9: 'En tránsito',
    10: 'En aduana',
    11: 'En almacén Venezuela',
    12: 'Listo para entrega',
    13: 'Entregado',
  };
  return stateNames[state] || 'Estado desconocido';
}
