import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// GET /api/admin/reviews - Obtener todas las reseñas de pedidos
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceRoleClient();

    // Obtener todas las reseñas con información del pedido y cliente
    const { data: reviews, error: reviewsError } = await supabase
      .from('order_reviews')
      .select(`
        id,
        order_id,
        client_id,
        rating,
        review_text,
        created_at,
        orders:order_id (
          id,
          productName,
          state
        ),
        clients:client_id (
          user_id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      return NextResponse.json(
        { error: 'Error al obtener las reseñas', details: reviewsError.message },
        { status: 500 }
      );
    }

    // Formatear la respuesta
    const formattedReviews = (reviews || []).map((review: any) => ({
      id: review.id,
      orderId: review.order_id,
      orderProductName: review.orders?.productName || 'N/A',
      orderState: review.orders?.state || null,
      clientId: review.client_id,
      clientName: review.clients?.name || 'Cliente desconocido',
      rating: review.rating,
      reviewText: review.review_text,
      createdAt: review.created_at,
    }));

    return NextResponse.json({
      success: true,
      reviews: formattedReviews,
      count: formattedReviews.length,
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error: any) {
    console.error('Error in GET /api/admin/reviews:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error.message 
      },
      { status: 500 }
    );
  }
}


