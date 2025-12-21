import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseServiceRoleClient();

        // Fetch all tickets with print count
        const { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select(`
        *,
        print_count:print_history(count)
      `)
            .order('created_at', { ascending: false });

        if (ticketsError) {
            console.error('Error fetching tickets:', ticketsError);
            return NextResponse.json(
                { error: 'Error al obtener tickets' },
                { status: 500 }
            );
        }

        // Transform data to include print count
        const ticketsWithCount = tickets.map((ticket: any) => ({
            ...ticket,
            print_count: ticket.print_count?.[0]?.count || 0
        }));

        return NextResponse.json({ tickets: ticketsWithCount });

    } catch (error) {
        console.error('Unexpected error in GET /api/admin/tickets:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
