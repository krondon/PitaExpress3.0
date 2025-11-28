import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// POST /api/orders/[id]/review - Crear reseña de un pedido
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderIdNum = parseInt(id);
    
    if (isNaN(orderIdNum)) {
      return NextResponse.json(
        { error: 'ID de pedido inválido' },
        { status: 400 }
      );
    }

    // Leer el body completo una sola vez
    let body: any = {};
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Error al procesar la solicitud. Body inválido.' },
        { status: 400 }
      );
    }
    
    const { userId, rating, reviewText } = body;

    // Obtener userId autenticado
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'No autenticado. userId requerido' },
        { status: 401 }
      );
    }

    // Obtener client_id del usuario
    const supabase = getSupabaseServiceRoleClient();
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (clientError || !clientData) {
      return NextResponse.json(
        { error: 'Usuario no es un cliente' },
        { status: 403 }
      );
    }

    const clientId = clientData.user_id;

    // Validar que el pedido existe y pertenece al cliente
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, state, client_id')
      .eq('id', orderIdNum)
      .eq('client_id', clientId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Pedido no encontrado o no pertenece al cliente' },
        { status: 404 }
      );
    }

    // Validar que el pedido está completado al 100% (state = 13)
    if (order.state !== 13) {
      return NextResponse.json(
        { error: 'Solo se pueden calificar pedidos completados al 100%' },
        { status: 400 }
      );
    }

    // Verificar si ya existe una reseña para este pedido
    const { data: existingReview, error: checkError } = await supabase
      .from('order_reviews')
      .select('id')
      .eq('order_id', orderIdNum)
      .eq('client_id', clientId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing review:', checkError);
      return NextResponse.json(
        { error: 'Error al verificar reseña existente' },
        { status: 500 }
      );
    }

    if (existingReview) {
      return NextResponse.json(
        { error: 'Ya has calificado este pedido' },
        { status: 400 }
      );
    }

    // Validar rating (1-5)
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'La calificación debe ser un número entre 1 y 5' },
        { status: 400 }
      );
    }

    // Validar reviewText (opcional pero recomendado)
    if (reviewText && typeof reviewText !== 'string') {
      return NextResponse.json(
        { error: 'El texto de la reseña debe ser una cadena de texto' },
        { status: 400 }
      );
    }

    // Crear la reseña
    let review: any;
    let insertError: any;
    
    try {
      const result = await supabase
        .from('order_reviews')
        .insert({
          order_id: orderIdNum,
          client_id: clientId,
          rating: rating,
          review_text: reviewText || null,
        })
        .select()
        .single();
      
      review = result.data;
      insertError = result.error;
    } catch (dbError: any) {
      console.error('Database error creating review:', dbError);
      return NextResponse.json(
        { 
          error: 'Error al crear la reseña en la base de datos',
          details: dbError.message || 'Error desconocido',
          hint: 'Verifica que la tabla order_reviews existe en la base de datos'
        },
        { status: 500 }
      );
    }

    if (insertError) {
      console.error('Error creating review:', insertError);
      return NextResponse.json(
        { 
          error: 'Error al crear la reseña',
          details: insertError.message,
          code: insertError.code,
          hint: insertError.code === '42P01' ? 'La tabla order_reviews no existe. Ejecuta el SQL de migración.' : undefined
        },
        { status: 500 }
      );
    }
    
    if (!review) {
      return NextResponse.json(
        { error: 'No se pudo crear la reseña. Datos no devueltos.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        orderId: review.order_id,
        rating: review.rating,
        reviewText: review.review_text,
        createdAt: review.created_at,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error in POST /api/orders/[id]/review:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET /api/orders/[id]/review - Obtener reseña del cliente para un pedido
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderIdNum = parseInt(id);
    
    if (isNaN(orderIdNum)) {
      return NextResponse.json(
        { error: 'ID de pedido inválido' },
        { status: 400 }
      );
    }

    // Obtener userId de los query parameters (GET no tiene body)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'No autenticado. userId requerido' },
        { status: 401 }
      );
    }

    // Obtener client_id del usuario
    const supabase = getSupabaseServiceRoleClient();
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (clientError || !clientData) {
      return NextResponse.json(
        { error: 'Usuario no es un cliente' },
        { status: 403 }
      );
    }

    const clientId = clientData.user_id;

    // Obtener la reseña del cliente para este pedido
    const { data: review, error: reviewError } = await supabase
      .from('order_reviews')
      .select('id, rating, review_text, created_at')
      .eq('order_id', orderIdNum)
      .eq('client_id', clientId)
      .maybeSingle();

    if (reviewError) {
      console.error('Error fetching review:', reviewError);
      return NextResponse.json(
        { error: 'Error al obtener la reseña' },
        { status: 500 }
      );
    }

    if (!review) {
      return NextResponse.json({
        exists: false,
        review: null,
      });
    }

    return NextResponse.json({
      exists: true,
      review: {
        id: review.id,
        rating: review.rating,
        reviewText: review.review_text,
        createdAt: review.created_at,
      },
    });

  } catch (error: any) {
    console.error('Error in GET /api/orders/[id]/review:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error.message 
      },
      { status: 500 }
    );
  }
}


