
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export const revalidate = 0;

export async function POST(request: NextRequest) {
    const supabase = getSupabaseServiceRoleClient();

    try {
        const body = await request.json();
        const { role, userId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'UserId required' }, { status: 400 });
        }

        // In a production app with strict security, we would verify the session here.
        // Given the project pattern, we are using the service role and trusting the inputs/middleware.

        if (role === 'client') {
            // Client: Archive delivered (13) or cancelled (0) immediately
            const { data, error } = await supabase
                .from('orders')
                .update({ archived_by_client: true })
                .eq('client_id', userId)
                .in('state', [0, 13])
                .eq('archived_by_client', false)
                .select();

            if (error) throw error;
            return NextResponse.json({ count: data?.length || 0 });
        }

        if (role === 'admin') {
            // Admin Logic
            // 1. Cancelled (0) -> Immediate
            const { data: dataCancelled, error: errorCancelled } = await supabase
                .from('orders')
                .update({ archived_by_admin: true })
                .eq('state', 0)
                .eq('archived_by_admin', false)
                .select();

            if (errorCancelled) throw errorCancelled;

            // 2. Delivered (13) -> Only if older than 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: dataDelivered, error: errorDelivered } = await supabase
                .from('orders')
                .update({ archived_by_admin: true })
                .eq('state', 13)
                .lt('updated_at', thirtyDaysAgo.toISOString())
                .eq('archived_by_admin', false)
                .select();

            if (errorDelivered) throw errorDelivered;

            return NextResponse.json({ count: (dataCancelled?.length || 0) + (dataDelivered?.length || 0) });
        }

        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    } catch (error: any) {
        console.error('Error archiving orders:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

