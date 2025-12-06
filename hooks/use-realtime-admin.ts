import { useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function useRealtimeAdmin(onOrdersUpdate: () => void, onUsersUpdate: () => void, onAlertsUpdate: () => void) {
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    // Suscripción para orders
    const ordersChannel = supabase
      .channel('admin-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {

          onOrdersUpdate();
        }
      )
      .subscribe();

    // Suscripción para users
    const usersChannel = supabase
      .channel('admin-users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload) => {

          onUsersUpdate();
        }
      )
      .subscribe();

    // Suscripción para alerts (asumiendo tabla alerts)
    const alertsChannel = supabase
      .channel('admin-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
        },
        (payload) => {

          onAlertsUpdate();
        }
      )
      .subscribe();

    // Limpiar suscripciones
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(alertsChannel);
    };
  }, [supabase, onOrdersUpdate, onUsersUpdate, onAlertsUpdate]);
}
