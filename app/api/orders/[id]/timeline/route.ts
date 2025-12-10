import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export const revalidate = 0;

interface TimelineStep {
  step_id: string;
  step_key: string;
  step_name: string;
  completed: boolean;
  timestamp: string | null;
  location: string;
}

interface StateHistoryRecord {
  id: number;
  state: number;
  previous_state: number | null;
  timestamp: string;
  changed_by: string;
  notes: string;
  state_name: string;
}

// GET /api/orders/[id]/timeline - Obtener timeline del pedido
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'ID de pedido inválido' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRoleClient();

    // Verificar que el pedido existe y obtener campos necesarios
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, state, created_at, shippingType, deliveryType')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Pedido no encontrado' },
        { status: 404 }
      );
    }

    // Obtener el timeline usando la función SQL
    const { data: timeline, error: timelineError } = await supabase
      .rpc('get_order_timeline', { p_order_id: orderId });

    if (timelineError) {
      console.error('Error getting timeline:', timelineError);
      console.error('Timeline error details:', timelineError.message, timelineError.details);
      // Fallback: generar timeline básico
      return generateBasicTimeline(order);
    }



    // Obtener historial completo para información adicional
    const { data: history, error: historyError } = await supabase
      .rpc('get_order_state_history', { p_order_id: orderId });

    if (historyError) {
      console.error('Error getting history:', historyError);
    }

    // Determinar ubicaciones según tipo de envío
    const shippingType = order?.shippingType || null;
    const clientLocation = order?.deliveryType || '—'; // deliveryType contiene la ciudad de destino en Venezuela
    
    const getLocationForStep = (stepKey: string): string => {
      if (stepKey === 'created') {
        return clientLocation;
      } else if (stepKey === 'processing') {
        return 'Nanjing, China';
      } else if (stepKey === 'shipped') {
        if (shippingType === 'air') {
          return 'Enping, China';
        } else if (shippingType === 'maritime') {
          return 'Yiwu, China';
        }
        return '—';
      } else if (stepKey === 'customs') {
        return 'Venezuela';
      }
      return '—';
    };

    // Formatear respuesta y actualizar ubicaciones según tipo de envío
    const formattedTimeline = timeline.map((step: any) => {
      // Siempre usar la función para determinar ubicación según el tipo de envío
      // Esto asegura que las ubicaciones sean consistentes (ej: "Venezuela" para customs)
      const stepLocation = getLocationForStep(step.step_key);
      
      return {
        id: step.step_id,
        status: step.step_key,
        description: step.step_name,
        location: stepLocation,
        timestamp: step.step_timestamp ? formatTimestamp(step.step_timestamp) : '—',
        completed: step.completed || false
      };
    });

    return NextResponse.json({
      success: true,
      orderId,
      timeline: formattedTimeline,
      history: history || [],
      lastUpdate: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error in timeline API:', error);
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// Función para generar timeline básico como fallback
function generateBasicTimeline(order: any) {
  const steps = [
    { id: '1', key: 'created', name: 'Pedido creado' },
    { id: '2', key: 'processing', name: 'En procesamiento' },
    { id: '3', key: 'shipped', name: 'Enviado' },
    { id: '4', key: 'in-transit', name: 'En tránsito' },
    { id: '5', key: 'customs', name: 'En aduana' },
    { id: '6', key: 'delivered', name: 'Entregado' },
  ];

  const statusIndexMap: Record<string, number> = {
    'created': 0,
    'processing': 1,
    'shipped': 2,
    'in-transit': 3,
    'customs': 4,
    'delivered': 5,
  };

  // Mapear estado numérico a estado de UI
  let currentStatus = 'created';
  if (order.state >= 13) currentStatus = 'delivered';
  else if (order.state >= 10) currentStatus = 'customs';
  else if (order.state >= 8) currentStatus = 'in-transit';
  else if (order.state >= 5) currentStatus = 'shipped';
  else if (order.state >= 2) currentStatus = 'processing';

  const currentIndex = statusIndexMap[currentStatus] || 0;

  // Determinar ubicaciones según tipo de envío
  const shippingType = order?.shippingType || null;
  const clientLocation = order?.deliveryType || '—'; // deliveryType contiene la ciudad de destino en Venezuela
  
  const getLocationForStep = (stepKey: string, index: number): string => {
    if (stepKey === 'created') {
      return clientLocation;
    } else if (stepKey === 'processing') {
      return 'Nanjing, China';
    } else if (stepKey === 'shipped') {
      if (shippingType === 'air') {
        return 'Enping, China';
      } else if (shippingType === 'maritime') {
        return 'Yiwu, China';
      }
      return '—';
    } else if (stepKey === 'customs') {
      return 'Venezuela';
    }
    return '—';
  };

  const timeline = steps.map((step, index) => ({
    id: step.id,
    status: step.key,
    description: step.name,
    location: index <= currentIndex ? getLocationForStep(step.key, index) : '—',
    timestamp: index === 0 ? formatTimestamp(order.created_at) : '—',
    completed: index <= currentIndex
  }));

  return NextResponse.json({
    success: true,
    orderId: order.id,
    timeline,
    history: [],
    lastUpdate: new Date().toISOString(),
    fallback: true
  });
}

// Función para formatear timestamps
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
}
