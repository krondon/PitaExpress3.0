import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabaseServiceRoleClient();

        // Parse request body
        const body = await request.json();
        const { ticket_id } = body;

        // Validate input
        if (!ticket_id || typeof ticket_id !== 'number') {
            return NextResponse.json(
                { error: 'ID de ticket inválido' },
                { status: 400 }
            );
        }

        // Verify ticket exists
        const { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .select('id')
            .eq('id', ticket_id)
            .single();

        if (ticketError || !ticket) {
            return NextResponse.json(
                { error: 'Ticket no encontrado' },
                { status: 404 }
            );
        }

        // Record print in history
        const { data: printRecord, error: printError } = await supabase
            .from('print_history')
            .insert({
                ticket_id
            })
            .select()
            .single();

        if (printError) {
            console.error('Error recording print:', printError);
            return NextResponse.json(
                { error: 'Error al registrar impresión' },
                { status: 500 }
            );
        }

        return NextResponse.json({ print_record: printRecord }, { status: 201 });

    } catch (error) {
        console.error('Unexpected error in POST /api/admin/tickets/print:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
