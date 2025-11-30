import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseKey);
}

// GET: Obtener alternativas de productos
// Query params: order_id, client_id, status
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('order_id');
        const clientId = searchParams.get('client_id');
        const status = searchParams.get('status');

        const supabase = getSupabaseClient();
        let query = supabase
            .from('product_alternatives')
            .select(`
        *,
        orders:order_id (
          id,
          productName,
          description,
          client_id,
          pdfRoutes
        )
      `)
            .order('created_at', { ascending: false });

        if (orderId) {
            query = query.eq('order_id', orderId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (clientId) {
            // Filtrar por cliente a través de la relación con orders
            query = query.eq('orders.client_id', clientId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching alternatives:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error: any) {
        console.error('Error in GET /api/product-alternatives:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Crear nueva alternativa de producto (solo China)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            order_id,
            alternative_product_name,
            alternative_description,
            alternative_image_url,
            alternative_price,
            proposed_by_china_id,
        } = body;

        // Validaciones
        if (!order_id || !alternative_product_name) {
            return NextResponse.json(
                { error: 'order_id y alternative_product_name son requeridos' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseClient();

        // Verificar que el pedido existe
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, client_id, productName')
            .eq('id', order_id)
            .single();

        if (orderError || !order) {
            return NextResponse.json(
                { error: 'Pedido no encontrado' },
                { status: 404 }
            );
        }

        // Crear la alternativa
        const { data: alternative, error: createError } = await supabase
            .from('product_alternatives')
            .insert({
                order_id,
                alternative_product_name,
                alternative_description,
                alternative_image_url,
                alternative_price,
                proposed_by_china_id,
                status: 'pending',
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating alternative:', createError);
            return NextResponse.json(
                { error: createError.message },
                { status: 500 }
            );
        }

        // Crear notificación para el cliente
        try {
            await supabase.from('notifications').insert({
                user_id: order.client_id,
                type: 'product_alternative_proposed',
                title: 'Nueva alternativa de producto',
                message: `China ha propuesto "${alternative_product_name}" como alternativa para tu pedido.`,
                metadata: {
                    order_id,
                    alternative_id: alternative.id,
                    original_product: order.productName,
                    alternative_product: alternative_product_name,
                },
                read: false,
            });
        } catch (notifError) {
            console.error('Error creating notification:', notifError);
            // No fallar si la notificación falla
        }

        return NextResponse.json(alternative, { status: 201 });
    } catch (error: any) {
        console.error('Error in POST /api/product-alternatives:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
