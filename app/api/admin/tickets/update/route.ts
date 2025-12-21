import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function PUT(request: NextRequest) {
    try {
        const supabase = getSupabaseServiceRoleClient();

        // Parse request body
        const body = await request.json();
        const { id, user_name } = body;

        // Validate input
        if (!id || typeof id !== 'number') {
            return NextResponse.json(
                { error: 'ID de ticket inválido' },
                { status: 400 }
            );
        }

        if (!user_name || typeof user_name !== 'string' || user_name.trim().length < 3) {
            return NextResponse.json(
                { error: 'El nombre del usuario debe tener al menos 3 caracteres' },
                { status: 400 }
            );
        }

        // Update ticket
        const { data: ticket, error: updateError } = await supabase
            .from('tickets')
            .update({
                user_name: user_name.trim()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating ticket:', updateError);

            if (updateError.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'Ticket no encontrado' },
                    { status: 404 }
                );
            }

            return NextResponse.json(
                { error: 'Error al actualizar ticket' },
                { status: 500 }
            );
        }

        return NextResponse.json({ ticket });

    } catch (error) {
        console.error('Unexpected error in PUT /api/admin/tickets/update:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
