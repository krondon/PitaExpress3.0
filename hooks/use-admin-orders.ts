import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { PENDING_STATES, TRANSIT_STATES, DELIVERED_STATES } from '@/lib/constants/orderStates';

export interface AdminOrder {
  id: string;
  estimatedBudget: number;
}

export function useAdminOrders() {
  const supabase = getSupabaseBrowserClient();
  const [data, setData] = useState<{
    totalPedidos: number;
    pedidosPendientes: number;
    pedidosTransito: number;
    pedidosEntregados: number;
    totalIngresos: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [totalActivosRes, pendientesRes, transitoRes, entregadosRes, ingresosRes] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).or('state.gte.1,state.lte.12'), // Active = 1..12
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('state', PENDING_STATES as any),
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('state', TRANSIT_STATES as any),
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('state', DELIVERED_STATES as any),
        // Ingresos: Solo ordenes validadas/pagadas (state >= 5, que corresponden a enviadas/procesando ya con pago confirmado)
        supabase.from('orders').select('totalQuote, estimatedBudget').gte('state', 5),
      ]);

      if (totalActivosRes.error) throw totalActivosRes.error;
      if (pendientesRes.error) throw pendientesRes.error;
      if (transitoRes.error) throw transitoRes.error;
      if (entregadosRes.error) throw entregadosRes.error;
      if (ingresosRes.error) throw ingresosRes.error;

      const totalPedidos = totalActivosRes.count ?? 0;
      const pedidosPendientes = pendientesRes.count ?? 0;
      const pedidosTransito = transitoRes.count ?? 0;
      const pedidosEntregados = entregadosRes.count ?? 0;
      // Usar totalQuote si existe (cotización real), fallback a budget
      const totalIngresos = (ingresosRes.data ?? []).reduce((acc: number, row: any) => {
        const val = row.totalQuote || row.estimatedBudget || 0;
        return acc + Number(val);
      }, 0);

      setData({ totalPedidos, pedidosPendientes, pedidosTransito, pedidosEntregados, totalIngresos });
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();

    // Suscripción realtime para la tabla orders
    const ordersChannel = supabase
      .channel('admin-orders-stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {

        fetchData();
      })
      .subscribe((status) => {

      });

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [fetchData, supabase]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
