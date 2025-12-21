import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
    try {
        const supabase = getSupabaseServiceRoleClient();

        // Parse request body
        const body = await request.json();
        const { id } = body;

        // Validate input
        if (!id || typeof id !== 'number') {
            return NextResponse.json(
                { error: 'ID de ticket inválido' },
                { status: 400 }
            );
        }

        // Delete ticket (print_history will be cascade deleted)
        const { error: deleteError } = await supabase
            .from('tickets')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting ticket:', deleteError);

            if (deleteError.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'Ticket no encontrado' },
                    { status: 404 }
                );
            }

            return NextResponse.json(
                { error: 'Error al eliminar ticket' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Unexpected error in DELETE /api/admin/tickets/delete:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
