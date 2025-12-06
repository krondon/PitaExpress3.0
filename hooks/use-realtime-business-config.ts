import { useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface BusinessConfigRow {
  id?: number;
  usd_rate?: number;
  cny_rate?: number;
  binance_rate?: number;
  profit_margin?: number;
  air_shipping_rate?: number;
  sea_shipping_rate?: number;
  alerts_after_days?: number;
  auto_update_exchange_rate?: boolean;
  auto_update_exchange_rate_cny?: boolean;
  auto_update_binance_rate?: boolean;
  updated_at?: string;
  admin_id?: string;
  [key: string]: any;
}

type RealtimeHandler = (row: BusinessConfigRow, eventType: string) => void;

// Hook de suscripción que entrega directamente el registro 'new' (o 'old' si delete) sin refetch adicional.
export function useRealtimeBusinessConfig(onRow: RealtimeHandler) {
  const supabase = getSupabaseBrowserClient();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const channel = supabase
      .channel('business-config-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'business_config'
      }, (payload: any) => {
        const row: BusinessConfigRow = payload.new || payload.old || {};

        try {
          onRow(row, payload.eventType);
        } catch (e) {
          console.error('[Realtime][business_config] Error en callback consumidor:', e);
        }
      })
      .subscribe((status) => {

      });

    return () => {
      try {
        supabase.removeChannel(channel);
        subscribedRef.current = false;

      } catch (e) {
        console.warn('[Realtime][business_config] Error cerrando canal', e);
      }
    };
  }, [supabase, onRow]);
}
