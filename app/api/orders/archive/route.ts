
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

        // Client: Soft delete (independent visibility)
        // Exclude -1 (payment rejected) because client can still pay again or cancel
        if (role === 'client') {
            const { data, error } = await supabase
                .from('orders')
                .update({ archived_by_client: true })
                .eq('client_id', userId)
                .in('state', [-2, 13]) // Solo cancelados y entregados, NO pago rechazado
                .eq('archived_by_client', false)
                .select();

            if (error) throw error;
            return NextResponse.json({ count: data?.length || 0 });
        }

        // China: Soft delete (independent visibility)
        if (role === 'china') {
            const { data, error } = await supabase
                .from('orders')
                .update({ archived_by_china: true })
                .in('state', [-2, -1, 13])
                .eq('archived_by_china', false)
                .select();

            if (error) throw error;
            return NextResponse.json({ count: data?.length || 0 });
        }

        // Venezuela: Soft delete (independent visibility)
        if (role === 'vzla') {
            const { data, error } = await supabase
                .from('orders')
                .update({ archived_by_vzla: true })
                .in('state', [-2, -1, 13])
                .eq('archived_by_vzla', false)
                .select();

            if (error) throw error;
            return NextResponse.json({ count: data?.length || 0 });
        }

        // Pagos: Soft delete (independent visibility) - payment states
        if (role === 'pagos') {
            const { data, error } = await supabase
                .from('orders')
                .update({ archived_by_pagos: true })
                .in('state', [5, -1])
                .eq('archived_by_pagos', false)
                .select();

            if (error) throw error;
            return NextResponse.json({ count: data?.length || 0 });
        }

        // Admin: DELETE permanent (only orders older than 30 days)
        if (role === 'admin') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Delete cancelled and delivered orders older than 30 days
            const { data, error } = await supabase
                .from('orders')
                .delete()
                .in('state', [-2, -1, 13])
                .lt('updated_at', thirtyDaysAgo.toISOString())
                .select();

            if (error) throw error;
            return NextResponse.json({ count: data?.length || 0 });
        }

        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    } catch (error: any) {
        console.error('Error archiving orders:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
