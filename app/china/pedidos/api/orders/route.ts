import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';


// Esta función obtiene los pedidos con el nombre del cliente
// Esta función obtiene los pedidos con el nombre del cliente
async function getOrdersWithClientName(page: number = 1, limit: number = 50, empleadoId?: string | null) {
  const supabase = getSupabaseServiceRoleClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Construir query base - incluir estados 1-8 (proceso normal) y cancelados que China ya vio
  // Cancelados: solo si max_state_reached >= 1 (China ya interactuó con el pedido)
  let query = supabase
    .from('orders')
    .select('id, quantity, productName, deliveryType, shippingType, state, client_id, asignedEChina, created_at, description, pdfRoutes, totalQuote, batch_id, archived_by_china, max_state_reached, imgs, links, unitQuote, shippingPrice, estimatedBudget', { count: 'exact' })
    .or('and(state.gte.1,state.lte.8),and(state.in.(-2,-1),max_state_reached.gte.1)') // Normal + cancelados que llegaron a China
    .eq('archived_by_china', false); // Excluir los que China ya ocultó

  // Filtrar por empleado si se proporciona
  if (empleadoId) {
    // Para empleados específicos: sus pedidos asignados + no asignados en estados iniciales
    query = query.or(`asignedEChina.eq.${empleadoId},and(asignedEChina.is.null,state.in.(1,2,3))`);
  }
  // Si NO se pasa empleadoId (caso Admin): mostrar TODOS los pedidos sin filtrar por asignación
  // Esto permite que Admin vea todos los pedidos independientemente de a quién estén asignados

  // Aplicar paginación y orden
  const { data: orders, count, error: ordersError } = await query
    .order('id', { ascending: false })
    .range(from, to);

  if (ordersError) throw ordersError;

  if (!orders || orders.length === 0) {
    return { data: [], total: 0 };
  }

  // Traer clientes
  const clientIds = Array.from(new Set(orders.map(o => o.client_id)));
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('user_id, name')
    .in('user_id', clientIds);

  if (clientsError) throw clientsError;

  // Traer alternativas para los pedidos de esta página
  const orderIds = orders.map(o => o.id);
  const { data: alternatives, error: alternativesError } = await supabase
    .from('product_alternatives')
    .select('order_id, status, client_response_notes')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });

  if (alternativesError) console.error('Error fetching alternatives:', alternativesError);

  // Join manual en JS
  const mappedOrders = orders.map(order => {
    const client = clients?.find(c => c.user_id === order.client_id);

    // Buscar alternativas para este pedido
    const orderAlternatives = alternatives?.filter(a => a.order_id === order.id) || [];

    // Determinar el estado de la alternativa a mostrar
    let alternativeStatus: 'pending' | 'accepted' | 'rejected' | null = null;
    let rejectionReason: string | null = null;

    const pendingAlt = orderAlternatives.find(a => a.status === 'pending');
    const acceptedAlt = orderAlternatives.find(a => a.status === 'accepted');
    const rejectedAlt = orderAlternatives.find(a => a.status === 'rejected');

    if (pendingAlt) {
      alternativeStatus = 'pending';
    } else if (acceptedAlt) {
      alternativeStatus = 'accepted';
    } else if (rejectedAlt) {
      alternativeStatus = 'rejected';
      rejectionReason = rejectedAlt.client_response_notes;
    }

    return {
      id: order.id,
      quantity: order.quantity,
      productName: order.productName,
      deliveryType: order.deliveryType,
      shippingType: order.shippingType,
      state: order.state,
      asignedEChina: order.asignedEChina,
      clientName: client ? client.name : null,
      created_at: order.created_at,
      specifications: order.description,
      pdfRoutes: order.pdfRoutes ?? '',
      totalQuote: order.totalQuote ?? null,
      hasAlternative: alternativeStatus === 'pending',
      alternativeStatus: alternativeStatus,
      alternativeRejectionReason: rejectionReason,
      batch_id: order.batch_id ?? null,
      imgs: (order as any).imgs ?? [],
      links: (order as any).links ?? [],
      unitQuote: (order as any).unitQuote ?? null,
      shippingPrice: (order as any).shippingPrice ?? null,
      estimatedBudget: (order as any).estimatedBudget ?? null,
    };
  });

  return { data: mappedOrders, total: count || 0 };
}

// API Route para Next.js App Router (app router)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const empleadoId = url.searchParams.get('asignedEChina');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10'); // Default 10 per page

    const result = await getOrdersWithClientName(page, limit, empleadoId);

    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
