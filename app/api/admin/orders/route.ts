import { NextResponse, NextRequest } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { NotificationsFactory } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const [{ data: orders, error: ordersError }, { data: clients, error: clientsError }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, state, productName, description, client_id, asignedEVzla, asignedEChina, created_at, estimatedBudget, reputation, pdfRoutes, batch_id'),
      supabase
        .from('clients')
        .select('user_id, name'),
    ]);

    if (ordersError) throw ordersError;
    if (clientsError) throw clientsError;

    const clientMap = new Map((clients ?? []).map((c: any) => [c.user_id, c.name]));

    const orderIds = (orders ?? []).map((o: any) => o.id);
    const { data: alternatives, error: alternativesError } = await supabase
      .from('product_alternatives')
      .select('order_id, status, client_response_notes')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false });

    if (alternativesError) console.error('Error fetching alternatives:', alternativesError);

    const result = (orders ?? []).map((o: any) => {
      // Logic to determine alternative status
      const orderAlternatives = alternatives?.filter((a: any) => a.order_id === o.id) || [];
      let alternativeStatus: 'pending' | 'accepted' | 'rejected' | null = null;
      let rejectionReason: string | null = null;

      const pendingAlt = orderAlternatives.find((a: any) => a.status === 'pending');
      const acceptedAlt = orderAlternatives.find((a: any) => a.status === 'accepted');
      const rejectedAlt = orderAlternatives.find((a: any) => a.status === 'rejected');

      if (pendingAlt) {
        alternativeStatus = 'pending';
      } else if (acceptedAlt) {
        alternativeStatus = 'accepted';
      } else if (rejectedAlt) {
        alternativeStatus = 'rejected';
        rejectionReason = rejectedAlt.client_response_notes;
      }

      return {
        id: o.id,
        state: o.state,
        productName: o.productName ?? '',
        description: o.description ?? '',
        client_id: o.client_id,
        clientName: clientMap.get(o.client_id) ?? null,
        asignedEVzla: o.asignedEVzla ?? null,
        asignedEChina: o.asignedEChina ?? null,
        created_at: o.created_at,
        estimatedBudget: o.estimatedBudget ?? null,
        reputation: o.reputation ?? null,
        pdfRoutes: o.pdfRoutes ?? null,
        hasAlternative: alternativeStatus === 'pending',
        alternativeStatus: alternativeStatus,
        alternativeRejectionReason: rejectionReason,
        batch_id: o.batch_id ?? null,
      };
    });

    return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('GET /api/admin/orders error:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

// Crear nuevo pedido (administración) usando service role para evitar restricciones RLS del cliente.
// Valida campos mínimos y devuelve el registro insertado.
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceRoleClient();
    const body = await req.json().catch(() => ({}));

    const {
      client_id,
      productName,
      description = '',
      quantity,
      estimatedBudget,
      deliveryType, // destino en Venezuela (según implementación actual)
      shippingType, // tipo de envío: doorToDoor | air | maritime
      imgs = [],
      links = [],
      pdfRoutes = null,
      state = 1,
      order_origin = 'vzla'
    } = body || {};

    const errors: string[] = [];
    if (!client_id || typeof client_id !== 'string') errors.push('client_id requerido');
    if (!productName || typeof productName !== 'string') errors.push('productName requerido');
    if (quantity === undefined || quantity === null || isNaN(Number(quantity)) || Number(quantity) <= 0) errors.push('quantity inválido');
    if (estimatedBudget === undefined || estimatedBudget === null || isNaN(Number(estimatedBudget)) || Number(estimatedBudget) < 0) errors.push('estimatedBudget inválido');
    if (!deliveryType || typeof deliveryType !== 'string') errors.push('deliveryType requerido');
    if (!shippingType || typeof shippingType !== 'string') errors.push('shippingType requerido');

    if (errors.length) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    // Sanitizar links/imagenes (posibles constraints de longitud / formato)
    const sanitizeUrl = (u: any) => {
      if (typeof u !== 'string') return null;
      let raw = u.trim();
      if (!/^https?:\/\//i.test(raw)) return null;
      try {
        const urlObj = new URL(raw);
        // Canonizar: quitar query y fragment para evitar caracteres % problemáticos en regex del constraint
        const canonical = `${urlObj.origin}${urlObj.pathname}`;
        raw = decodeURIComponent(canonical); // decodificar %XX si es seguro
      } catch { /* ignore and keep raw */ }
      // Remover caracteres potencialmente no permitidos (solo dejar un subconjunto seguro)
      raw = raw.replace(/[^A-Za-z0-9._~:/#?&=+\-]/g, '-');
      if (raw.length > 255) raw = raw.slice(0, 255);
      // Validación final simple
      if (!/^https?:\/\/[A-Za-z0-9./_~:=+\-]+$/i.test(raw)) return null;
      return raw;
    };
    const safeImgs = Array.isArray(imgs) ? imgs.map(sanitizeUrl).filter(Boolean) : [];
    const safeLinksRaw = Array.isArray(links) ? links.map(sanitizeUrl).filter(Boolean) : [];
    // Si el constraint exige máx 1 link, recortar.
    const safeLinks = safeLinksRaw.slice(0, 1);

    const insertPayload: Record<string, any> = {
      client_id,
      productName,
      description,
      quantity: Number(quantity),
      estimatedBudget: Number(estimatedBudget),
      deliveryType, // en la BD actual se está usando así desde el cliente
      shippingType,
      imgs: safeImgs,
      links: safeLinks,
      pdfRoutes,
      state: Number(state) || 1,
      order_origin,
      elapsed_time: null,
      asignedEVzla: null,
      asignedEChina: body.asignedEChina || null, // Permitir override de asignación (Leader-Follower strategy)
      batch_id: body.batch_id || null,
    };

    let { data, error } = await supabase
      .from('orders')
      .insert([insertPayload])
      .select('*')
      .single();

    // Fallback: si el constraint de links falla, reintentar sin links
    if (error && /links?_check/i.test(error.message || '')) {
      console.warn('[orders] links constraint violated, retrying without links/imgs', {
        message: error.message,
        details: error.details,
        attemptedLinks: insertPayload.links,
      });
      const retryPayload = { ...insertPayload, links: [], imgs: [] };
      const retry = await supabase
        .from('orders')
        .insert([retryPayload])
        .select('*')
        .single();
      data = retry.data;
      error = retry.error as any;
      if (!error) {
        return NextResponse.json({ ok: true, data, warning: 'links_removed_due_to_constraint' }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    if (error) {
      console.error('POST /api/admin/orders insert error:', error.message, { details: error.details, payload: insertPayload });
      return NextResponse.json({ error: error.message, details: error.details }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    // Emitir notificaciones post-creación (no bloqueantes)
    try {
      if (data?.client_id) {
        const stateName = (typeof data.state === 'number') ? String(data.state) : undefined;
        const notif = NotificationsFactory.client.orderCreated({ orderId: String(data.id) });
        await supabase.from('notifications').insert([
          {
            audience_type: 'user',
            audience_value: data.client_id,
            title: notif.title,
            description: notif.description,
            href: notif.href,
            severity: notif.severity,
            user_id: data.client_id,
            order_id: String(data.id),
          },
        ]);
      }

      // Si el estado inicial requiere cotización (3), notificar a China

      // Siempre notificar a China que hay nuevo pedido para gestionar/cotizar
      const notifChina = NotificationsFactory.china.newOrderForQuote({ orderId: String(data.id) });
      await supabase.from('notifications').insert([
        {
          audience_type: 'role',
          audience_value: 'china',
          title: notifChina.title,
          description: notifChina.description,
          href: notifChina.href,
          severity: notifChina.severity,
          order_id: String(data.id),
        },
      ]);

      // Notificar a Pagos solo cuando entre en validación (estado 4) – creación inicial no
      if (data?.state === 4) {
        const notifPagos = NotificationsFactory.pagos.newAssignedOrder({ orderId: String(data.id) });
        await supabase.from('notifications').insert([
          {
            audience_type: 'role',
            audience_value: 'pagos',
            title: notifPagos.title,
            description: notifPagos.description,
            href: notifPagos.href,
            severity: notifPagos.severity,
            unread: true,
            order_id: String(data.id),
          },
        ]);
      }

      // Si el estado inicial es 2 (pendiente para China), notificar a China
      if (data?.state === 2) {
        const notifChina2 = NotificationsFactory.china.orderRequiresAttention({ orderId: String(data.id) });
        await supabase.from('notifications').insert([
          {
            audience_type: 'role',
            audience_value: 'china',
            title: notifChina2.title,
            description: notifChina2.description,
            href: notifChina2.href,
            severity: notifChina2.severity,
            order_id: String(data.id),
          },
        ]);
      }

    } catch (notifyErr) {
      console.error('Admin create order notification error:', notifyErr);
    }

    return NextResponse.json({ ok: true, data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('POST /api/admin/orders exception:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
