import { getSupabaseBrowserClient } from './client';

export interface ExchangeRateBinance {
  id?: string;
  rate: number;
  source: string;
  timestamp: string;
  is_fallback: boolean;
  trade_type?: 'BUY' | 'SELL';
  metadata?: any;
}

/**
 * Validar que la tasa de Binance sea razonable (USDT → VES)
 * Rango aproximado: 100 - 500 Bs (puede variar según mercado)
 */
export function isValidBinanceRate(rate: number): boolean {
  return !isNaN(rate) && rate > 0 && rate < 1000;
}

/**
 * Guardar tasa de cambio de Binance en la base de datos
 */
export async function saveBinanceRate(
  rate: number,
  source: string,
  isFallback: boolean,
  metadata?: any,
  tradeType: 'BUY' | 'SELL' = 'BUY'
): Promise<void> {
  try {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase
      .from('exchange_rates_binance')
      .insert({
        rate,
        source,
        is_fallback: isFallback,
        trade_type: tradeType,
        metadata: metadata || {},
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('Error saving Binance rate to database:', error);
      throw error;
    }


  } catch (error) {
    console.error('Error in saveBinanceRate:', error);
    // No lanzar error para no interrumpir el flujo
  }
}

/**
 * Obtener la última tasa válida de Binance (no fallback, menos de 24h)
 */
export async function getLatestValidBinanceRate(tradeType: 'BUY' | 'SELL' = 'BUY'): Promise<{
  rate: number;
  timestamp: string;
  source: string;
  age_minutes: number;
} | null> {
  try {
    const supabase = getSupabaseBrowserClient();

    // Query directa más simple (sin función SQL)
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    let query = supabase
      .from('exchange_rates_binance')
      .select('*')
      .eq('is_fallback', false)
      .eq('trade_type', tradeType)
      .gte('timestamp', oneDayAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(1);

    const { data, error } = await query;

    if (error) {
      console.error('[Binance Rate] Error fetching from DB:', error);
      return null;
    }

    if (!data || data.length === 0) {

      return null;
    }

    const rateData = data[0];

    // Calcular edad en minutos
    const now = new Date();
    const rateTime = new Date(rateData.timestamp);
    const ageMinutes = Math.floor((now.getTime() - rateTime.getTime()) / (1000 * 60));



    return {
      rate: parseFloat(rateData.rate),
      timestamp: rateData.timestamp,
      source: rateData.source,
      age_minutes: ageMinutes
    };
  } catch (error) {
    console.error('Error in getLatestValidBinanceRate:', error);
    return null;
  }
}

/**
 * Obtener cualquier tasa de Binance (incluso fallback o antigua)
 */
export async function getLatestBinanceRate(tradeType: 'BUY' | 'SELL' = 'BUY'): Promise<{
  rate: number;
  timestamp: string;
  source: string;
} | null> {
  try {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase
      .from('exchange_rates_binance')
      .select('*')
      .eq('trade_type', tradeType)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {

      return null;
    }

    return {
      rate: data.rate,
      timestamp: data.timestamp,
      source: data.source
    };
  } catch (error) {
    console.error('Error in getLatestBinanceRate:', error);
    return null;
  }
}

/**
 * Obtener historial de tasas de Binance
 */
export async function getBinanceRateHistory(
  limit: number = 20,
  onlyValid: boolean = false,
  tradeType?: 'BUY' | 'SELL'
): Promise<ExchangeRateBinance[]> {
  try {
    const supabase = getSupabaseBrowserClient();

    // Si hay función SQL, usarla; si no, query directa
    let query = supabase
      .from('exchange_rates_binance')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (onlyValid) {
      query = query.eq('is_fallback', false);
    }

    if (tradeType) {
      query = query.eq('trade_type', tradeType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching Binance rate history:', error);
      return [];
    }

    // Mapear los datos para que coincidan con la interfaz
    return (data || []).map((item: any) => ({
      id: item.id,
      rate: parseFloat(item.rate),
      source: item.source,
      timestamp: item.timestamp,
      is_fallback: item.is_fallback,
      trade_type: item.trade_type,
      metadata: item.metadata
    }));
  } catch (error) {
    console.error('Error in getBinanceRateHistory:', error);
    return [];
  }
}

/**
 * Limpiar registros antiguos de Binance (mantener últimos 30 días)
 */
export async function cleanupOldBinanceRates(): Promise<void> {
  try {
    const supabase = getSupabaseBrowserClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from('exchange_rates_binance')
      .delete()
      .lt('timestamp', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('Error cleaning up old Binance rates:', error);
    } else {

    }
  } catch (error) {
    console.error('Error in cleanupOldBinanceRates:', error);
  }
}
