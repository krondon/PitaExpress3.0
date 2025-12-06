import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface AdminOrderListItem {
  id: string;
  state: number;
  productName: string;
  description: string;
  client_id: string;
  clientName: string | null;
  asignedEVzla: string | null;
  asignedEChina: string | null;
  created_at: string;
  estimatedBudget: number | null;
  reputation: number | null;
  pdfRoutes: string | null;
  hasAlternative?: boolean;
  alternativeStatus?: 'pending' | 'accepted' | 'rejected' | null;
  alternativeRejectionReason?: string | null;
}

export function useAdminOrdersList() {
  const supabase = getSupabaseBrowserClient();
  const [data, setData] = useState<AdminOrderListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [{ data: orders, error: ordersError }, { data: clients, error: clientsError }] = await Promise.all([
        supabase
          .from('orders')
          .select('id, state, productName, description, client_id, asignedEVzla, asignedEChina, created_at, estimatedBudget, reputation, pdfRoutes')
          // FIFO: más antiguos primero
          .order('created_at', { ascending: true }),
        supabase
          .from('clients')
          .select('user_id, name'),
      ]);

      if (ordersError) throw ordersError;
      if (clientsError) throw clientsError;

      const orderIds = (orders ?? []).map((o: any) => o.id);
      const { data: alternatives, error: alternativesError } = await supabase
        .from('product_alternatives')
        .select('order_id, status, client_response_notes')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (alternativesError) console.error('Error fetching alternatives:', alternativesError);

      const clientMap = new Map((clients ?? []).map((c: any) => [c.user_id, c.name]));

      const result = (orders ?? []).map((o: any) => {
        const orderAlternatives = alternatives?.filter((a: any) => a.order_id === o.id) || [];
        let alternativeStatus: 'pending' | 'accepted' | 'rejected' | null = null;
        let rejectionReason: string | null = null;

        const pendingAlt = orderAlternatives.find((a: any) => a.status === 'pending');
        const acceptedAlt = orderAlternatives.find((a: any) => a.status === 'accepted');
        const rejectedAlt = orderAlternatives.find((a: any) => a.status === 'rejected');

        if (pendingAlt) {
          alternativeStatus = 'pending';
        } else if (acceptedAlt) {
          alternativeStatus = 'accepted';
        } else if (rejectedAlt) {
          alternativeStatus = 'rejected';
          rejectionReason = rejectedAlt.client_response_notes;
        }

        return {
          id: o.id,
          state: o.state,
          productName: o.productName ?? '',
          description: o.description ?? '',
          client_id: o.client_id,
          clientName: clientMap.get(o.client_id) ?? null,
          asignedEVzla: o.asignedEVzla ?? null,
          asignedEChina: o.asignedEChina ?? null,
          created_at: o.created_at,
          estimatedBudget: o.estimatedBudget ?? null,
          reputation: o.reputation ?? null,
          pdfRoutes: o.pdfRoutes ?? null,
          hasAlternative: alternativeStatus === 'pending',
          alternativeStatus: alternativeStatus,
          alternativeRejectionReason: rejectionReason,
        };
      });

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();

    // Suscripciones realtime para las tablas orders y clients
    const ordersChannel = supabase
      .channel('admin-orders-list-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {

        fetchData();
      })
      .subscribe((status) => {

      });

    const clientsChannel = supabase
      .channel('admin-orders-clients-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {

        fetchData();
      })
      .subscribe((status) => {

      });

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(clientsChannel);
    };
  }, [fetchData, supabase]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
