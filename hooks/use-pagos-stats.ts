import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface PagoStatsResult {
  pending: number;
  completed: number;
  totalAmount: number; // suma en USD (totalQuote o estimatedBudget fallback)
}

interface UsePagosStats extends PagoStatsResult {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Determina el monto base a sumar
function resolveAmount(order: any) {
  if (typeof order?.totalQuote === 'number') return order.totalQuote;
  if (typeof order?.estimatedBudget === 'number') return order.estimatedBudget;
  return 0;
}

/**
 * Hook para estadísticas del rol Pagos.
 * Cuenta pedidos en estado 4 (pendiente de verificación) y >=5 (validados / posteriores)
 * y suma montos.
 */
export function usePagosStats(pollMs: number = 0): UsePagosStats {
  const supabase = getSupabaseBrowserClient();
  const [stats, setStats] = useState<PagoStatsResult>({ pending: 0, completed: 0, totalAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const compute = useCallback((rows: any[]) => {
    let pending = 0; let completed = 0; let totalAmount = 0;
    for (const r of rows) {
      if (r.state === 4) {
        pending++;
        totalAmount += resolveAmount(r);
      } else if (r.state >= 5) {
        completed++;
        totalAmount += resolveAmount(r);
      }
    }
    return { pending, completed, totalAmount };
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      // Traer solo columnas necesarias para reducir payload
      const { data, error } = await supabase
        .from('orders')
        .select('id,state,totalQuote,estimatedBudget')
        .gte('state', 4)

        .limit(2000); // safety cap
      if (error) throw error;
      const comp = compute(data || []);
      setStats(comp);
    } catch (e: any) {
      setError(e.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [supabase, compute]);

  // Realtime: cualquier cambio en orders que pueda afectar stats (INSERT/UPDATE/DELETE)
  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel('pagos-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        // Debounce múltiples eventos seguidos
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchStats(), 160);
      })
      .subscribe();

    chanRef.current = channel;
    return () => {
      if (chanRef.current) supabase.removeChannel(chanRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchStats, supabase]);

  // Polling opcional (fail-safe)
  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(fetchStats, pollMs);
    return () => clearInterval(id);
  }, [pollMs, fetchStats]);

  return { ...stats, loading, error, refresh: fetchStats };
}
