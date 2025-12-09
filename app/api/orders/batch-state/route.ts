import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { NotificationsFactory } from '@/lib/notifications';

export const revalidate = 0;

interface BatchUpdateStateRequest {
    orderIds: number[];
    state: number;
    changed_by?: string;
    notes?: string;
    ip_address?: string; // Optional, can be derived
}

// Helper to get state name (duplicated/shared)
function getStateName(state: number): string {
    const stateNames: Record<number, string> = {
        1: 'Pedido creado',
        2: 'Recibido',
        3: 'Cotizado',
        4: 'Asignado Venezuela',
        5: 'En procesamiento',
        6: 'Preparando envío',
        7: 'Listo para envío',
        8: 'Enviado',
        9: 'En tránsito',
        10: 'En aduana',
        11: 'En almacén Venezuela',
        12: 'Listo para entrega',
        13: 'Entregado'
    };
    return stateNames[state] || 'Estado desconocido';
}

export async function PUT(request: NextRequest) {
    try {
        const body: BatchUpdateStateRequest = await request.json();
        const { orderIds, state, changed_by, notes } = body;

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return NextResponse.json({ error: 'Lista de IDs de pedidos inválida' }, { status: 400 });
        }

        if (!state || state < 1 || state > 13) {
            return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
        }

        const supabase = getSupabaseServiceRoleClient();
        const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        const clientUserAgent = request.headers.get('user-agent') || 'unknown';

        // Process updates in parallel
        const updatePromises = orderIds.map(async (orderId) => {
            // 1. Get current state
            const { data: currentOrder, error: orderError } = await supabase
                .from('orders')
                .select('id, state, client_id')
                .eq('id', orderId)
                .single();

            if (orderError || !currentOrder) return { id: orderId, success: false, error: 'Not found' };
            if (currentOrder.state === state) return { id: orderId, success: true, message: 'No change' };

            // 2. Update status
            const { error: updateError } = await supabase
                .from('orders')
                .update({ state })
                .eq('id', orderId);

            if (updateError) return { id: orderId, success: false, error: updateError.message };

            // 3. Update history metadata (Trigger creates the row, we update extra fields)
            // Note: This race condition is tricky. We wait a tiny bit or trust the trigger happened?
            // Actually, triggers are synchronous in Postgres transactions usually.
            // But we need to find the specific history record.

            const { error: historyUpdateError } = await supabase
                .from('order_state_history')
                .update({
                    changed_by: changed_by || 'system',
                    notes: notes || 'Estado actualizado vía API (Batch)',
                    ip_address: clientIP,
                    user_agent: clientUserAgent
                })
                .eq('order_id', orderId)
                .eq('state', state)
                .order('timestamp', { ascending: false })
                .limit(1);

            // 4. Notifications
            try {
                const stateName = getStateName(state);

                // Notify Client (if not state 3 special case)
                if (currentOrder.client_id && state !== 3) {
                    const notif = NotificationsFactory.client.orderStatusChanged({ orderId: String(orderId), status: stateName });
                    await supabase.from('notifications').insert([{
                        audience_type: 'user',
                        audience_value: currentOrder.client_id,
                        title: notif.title,
                        description: notif.description,
                        href: notif.href,
                        severity: notif.severity,
                        user_id: currentOrder.client_id,
                        order_id: String(orderId),
                    }]);
                }

                // Notify Roles
                if (state === 4) { // Pagos / Venezuela
                    const notifPagos = NotificationsFactory.pagos.newAssignedOrder({ orderId: String(orderId) });
                    await supabase.from('notifications').insert([{
                        audience_type: 'role',
                        audience_value: 'pagos',
                        title: notifPagos.title,
                        description: notifPagos.description,
                        href: notifPagos.href,
                        severity: notifPagos.severity,
                        unread: true,
                        order_id: String(orderId),
                    }]);
                }
                // Add other notifications if needed (like China state 2/3/5) - keeping it minimal for "Payment" context (State 4) logic mainly
            } catch (e) {
                console.error(`Notification error for order ${orderId}`, e);
            }

            return { id: orderId, success: true };
        });

        const results = await Promise.all(updatePromises);

        // Check if any failed
        const failures = results.filter(r => !r.success);

        return NextResponse.json({
            success: failures.length === 0,
            results,
            message: failures.length > 0 ? 'Algunos pedidos no pudieron actualizarse' : 'Todos los pedidos actualizados correctamente'
        });

    } catch (error: any) {
        console.error('Batch update error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
