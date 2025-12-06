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

// PATCH: Actualizar estado de alternativa (aceptar/rechazar)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status, client_response_notes } = body;

        // Validaciones
        if (!status || !['accepted', 'rejected'].includes(status)) {
            return NextResponse.json(
                { error: 'status debe ser "accepted" o "rejected"' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseClient();

        // Obtener la alternativa actual
        const { data: alternative, error: fetchError } = await supabase
            .from('product_alternatives')
            .select(`
        *,
        orders:order_id (
          id,
          client_id,
          productName
        )
      `)
            .eq('id', id)
            .single();

        if (fetchError || !alternative) {
            return NextResponse.json(
                { error: 'Alternativa no encontrada' },
                { status: 404 }
            );
        }

        // Verificar que está en estado pending
        if (alternative.status !== 'pending') {
            return NextResponse.json(
                { error: 'Esta alternativa ya fue procesada' },
                { status: 400 }
            );
        }

        // Actualizar la alternativa
        const { data: updated, error: updateError } = await supabase
            .from('product_alternatives')
            .update({
                status,
                client_response_notes,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating alternative:', updateError);
            return NextResponse.json(
                { error: updateError.message },
                { status: 500 }
            );
        }

        // Si fue aceptada, actualizar el pedido con el nuevo producto y regenerar PDF
        if (status === 'accepted') {
            try {
                // 1. Actualizar datos básicos del pedido (SOLO EL NOMBRE DEL PRODUCTO)
                await supabase
                    .from('orders')
                    .update({
                        productName: alternative.alternative_product_name,
                        // MANTENER descripción, especificaciones y URL originales
                    })
                    .eq('id', alternative.order_id);

                // 2. Regenerar PDF con la nueva información
                try {
                    // Obtener datos completos del pedido
                    const { data: fullOrder } = await supabase
                        .from('orders')
                        .select('*')
                        .eq('id', alternative.order_id)
                        .single();

                    if (fullOrder) {
                        // Obtener nombre del cliente manualmente para asegurar
                        let clientName = 'Cliente';
                        if (fullOrder.client_id) {
                            const { data: clientData } = await supabase
                                .from('clients')
                                .select('name')
                                .eq('user_id', fullOrder.client_id)
                                .single();
                            if (clientData?.name) clientName = clientData.name;
                        }

                        const { generateOrderPDF } = await import('@/lib/pdf-generator');

                        // Preparar datos para el PDF
                        // Usamos el NUEVO nombre y la NUEVA imagen, pero mantenemos descripción/specs originales

                        // Extraer URL del producto original (suele estar en links[0])
                        let originalUrl = fullOrder.productUrl || '-';
                        if (Array.isArray(fullOrder.links) && fullOrder.links.length > 0) {
                            originalUrl = fullOrder.links[0];
                        } else if (typeof fullOrder.links === 'string') {
                            try {
                                const parsedLinks = JSON.parse(fullOrder.links);
                                if (Array.isArray(parsedLinks) && parsedLinks.length > 0) originalUrl = parsedLinks[0];
                            } catch {
                                // ignore
                            }
                        }

                        const pdfData = {
                            orderId: fullOrder.id,
                            clientId: fullOrder.client_id,
                            clientName: clientName,
                            date: new Date(fullOrder.created_at).toLocaleDateString('es-ES'),
                            shippingType: fullOrder.shippingType || '-',
                            deliveryVenezuela: fullOrder.deliveryType || '-', // Nota: en BD deliveryType suele ser la dirección/método en Vzla
                            productName: alternative.alternative_product_name, // NUEVO NOMBRE
                            quantity: fullOrder.quantity || 1,
                            description: fullOrder.description || '-', // ORIGINAL
                            specifications: fullOrder.specifications || '-', // ORIGINAL
                            productUrl: originalUrl, // ORIGINAL
                            productImageUrl: alternative.alternative_image_url || null // NUEVA IMAGEN (si hay)
                        };


                        const pdfBuffer = await generateOrderPDF(pdfData);

                        // Subir PDF a Storage
                        const fileName = `pdfs/order_${fullOrder.id}_${Date.now()}.pdf`;
                        const { error: uploadError } = await supabase.storage
                            .from('orders')
                            .upload(fileName, pdfBuffer, {
                                contentType: 'application/pdf',
                                upsert: true
                            });

                        if (uploadError) {
                            console.error('Error uploading regenerated PDF:', uploadError);
                        } else {
                            // Obtener URL pública
                            const { data: { publicUrl } } = supabase.storage
                                .from('orders')
                                .getPublicUrl(fileName);

                            // Actualizar pedido con la nueva URL del PDF
                            await supabase
                                .from('orders')
                                .update({ pdfRoutes: publicUrl })
                                .eq('id', fullOrder.id);


                        }
                    }
                } catch (pdfError) {
                    console.error('Error generating/uploading PDF:', pdfError);
                    // No fallar la request principal si falla el PDF, pero loguear error
                }

                // Crear notificación para China
                await supabase.from('notifications').insert({
                    user_id: alternative.proposed_by_china_id,
                    type: 'product_alternative_accepted',
                    title: 'Alternativa aceptada',
                    message: `El cliente aceptó la alternativa "${alternative.alternative_product_name}".`,
                    metadata: {
                        order_id: alternative.order_id,
                        alternative_id: id,
                        alternative_product: alternative.alternative_product_name,
                        client_notes: client_response_notes, // Include client notes
                    },
                    read: false,
                });
            } catch (error) {
                console.error('Error updating order or creating notification:', error);
                // No fallar si esto falla
            }
        } else if (status === 'rejected') {
            // Crear notificación para China sobre el rechazo
            try {
                await supabase.from('notifications').insert({
                    user_id: alternative.proposed_by_china_id,
                    type: 'product_alternative_rejected',
                    title: 'Alternativa rechazada',
                    message: `El cliente rechazó la alternativa "${alternative.alternative_product_name}".`,
                    metadata: {
                        order_id: alternative.order_id,
                        alternative_id: id,
                        alternative_product: alternative.alternative_product_name,
                        client_notes: client_response_notes,
                    },
                    read: false,
                });
            } catch (error) {
                console.error('Error creating notification:', error);
            }
        }

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error in PATCH /api/product-alternatives/[id]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Eliminar alternativa (solo China puede cancelar su propuesta)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getSupabaseClient();

        // Verificar que existe y está en estado pending
        const { data: alternative, error: fetchError } = await supabase
            .from('product_alternatives')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !alternative) {
            return NextResponse.json(
                { error: 'Alternativa no encontrada' },
                { status: 404 }
            );
        }

        if (alternative.status !== 'pending') {
            return NextResponse.json(
                { error: 'Solo se pueden eliminar alternativas pendientes' },
                { status: 400 }
            );
        }

        // Eliminar
        const { error: deleteError } = await supabase
            .from('product_alternatives')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting alternative:', deleteError);
            return NextResponse.json(
                { error: deleteError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error in DELETE /api/product-alternatives/[id]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
