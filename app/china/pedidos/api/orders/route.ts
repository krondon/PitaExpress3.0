import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Esta función obtiene los pedidos con el nombre del cliente
// Esta función obtiene los pedidos con el nombre del cliente
async function getOrdersWithClientName(page: number = 1, limit: number = 50, empleadoId?: string | null) {
  const supabase = getSupabaseClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Construir query base
  let query = supabase
    .from('orders')
    .select('id, quantity, productName, deliveryType, shippingType, state, client_id, asignedEChina, created_at, description, pdfRoutes, totalQuote', { count: 'exact' })
    .gte('state', 0); // Incluir cancelados (estado 0)

  // Filtrar por empleado si se proporciona
  if (empleadoId) {
    query = query.eq('asignedEChina', empleadoId);
  } else {
    query = query.not('asignedEChina', 'is', null);
  }

  // Aplicar paginación y orden
  const { data: orders, count, error: ordersError } = await query
    .order('created_at', { ascending: false })
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
