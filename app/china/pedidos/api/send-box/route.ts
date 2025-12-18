import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

/**
 * API route para enviar una caja y actualizar los pedidos asociados a estado 9 (enviado)
 * Usa service role para evitar problemas con RLS
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { boxId } = body;

    if (!boxId) {
      return NextResponse.json(
        { error: 'boxId es requerido' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRoleClient();

    // Verificar que la caja tenga pedidos
    const { data: orders, error: countErr } = await supabase
      .from('orders')
      .select('id')
      .eq('box_id', boxId)
      .limit(1);

    if (countErr) {
      console.error('Error verificando pedidos de la caja:', countErr);
      return NextResponse.json(
        { error: 'Error verificando pedidos de la caja' },
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: 'La caja no tiene pedidos' },
        { status: 400 }
      );
    }

    // Obtener el estado actual de la caja para poder revertirlo en caso de error
    const { data: currentBox, error: boxFetchError } = await supabase
      .from('boxes')
      .select('state')
      .eq('box_id', boxId)
      .single();

    if (boxFetchError) {
      console.error('Error obteniendo estado de la caja:', boxFetchError);
      return NextResponse.json(
        { error: 'Error obteniendo estado de la caja' },
        { status: 500 }
      );
    }

    const previousBoxState = currentBox?.state ?? 3;

    // Cambiar estado de la caja a enviado (state = 4)
    const { error: boxUpdateError } = await supabase
      .from('boxes')
      .update({ state: 4 })
      .eq('box_id', boxId);

    if (boxUpdateError) {
      console.error('Error enviando caja:', boxUpdateError);
      return NextResponse.json(
        { error: 'Error actualizando estado de la caja' },
        { status: 500 }
      );
    }

    // Cambiar estado de todos los pedidos a enviado (state = 9)
    const { error: ordersUpdateError, data: updatedOrders } = await supabase
      .from('orders')
      .update({ state: 9 })
      .eq('box_id', boxId)
      .select('id');

    if (ordersUpdateError) {
      console.error('Error actualizando pedidos:', ordersUpdateError);
      
      // Revertir el estado de la caja si falló la actualización de pedidos
      await supabase
        .from('boxes')
        .update({ state: previousBoxState })
        .eq('box_id', boxId);
      
      return NextResponse.json(
        { error: 'Error actualizando pedidos: ' + ordersUpdateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      boxId,
      updatedOrdersCount: updatedOrders?.length || 0
    });

  } catch (error: any) {
    console.error('Error en send-box API:', error);
    return NextResponse.json(
      { error: error.message || 'Error inesperado' },
      { status: 500 }
    );
  }
}
