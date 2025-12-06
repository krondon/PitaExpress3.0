import { useSupabaseQuery } from './use-supabase-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useClientContext } from '@/lib/ClientContext';
import { useEffect } from 'react';

export interface ClientOrder {
  id: string;
  productName: string;
  // Presupuesto estimado calculado: unitQuote + shippingPrice
  estimatedBudget: number;
  totalQuote: number;
  state: number;
}

export function useClientOrders() {
  const { clientId } = useClientContext();
  const supabase = getSupabaseBrowserClient();

  const queryKey = clientId ? `orders-client-${clientId}` : 'orders-client-undefined';

  const result = useSupabaseQuery<ClientOrder[]>(
    queryKey,
    async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('orders')
        // Traemos los campos necesarios y calculamos estimatedBudget en el cliente
        .select('id, productName, totalQuote, state, unitQuote, shippingPrice')
        .eq('client_id', clientId);
      if (error) throw error;
      // Mapear para exponer estimatedBudget = unitQuote + shippingPrice
      const mapped = (data || []).map((row: any) => {
        const unit = Number(row?.unitQuote ?? 0);
        const ship = Number(row?.shippingPrice ?? 0);
        const estimatedBudget = unit + ship;
        return {
          id: row.id,
          productName: row.productName,
          estimatedBudget,
          totalQuote: Number(row?.totalQuote ?? 0),
          state: row.state,
        } as ClientOrder;
      });
      return mapped;
    },
    { enabled: !!clientId }
  );

  // Agregar realtime
  useEffect(() => {
    if (!clientId) return;

    const ordersChannel = supabase
      .channel(`client-orders-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {

          result.refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [clientId, supabase, result.refetch]);

  return result;
}
