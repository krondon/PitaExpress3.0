import { getSupabaseServiceRoleClient } from './server';

export interface ExchangeRateRecord {
  id?: number;
  rate: number;
  source: string;
  timestamp?: string;
  is_fallback?: boolean;
  api_response?: any;
  created_at?: string;
}

export interface LatestRateResult {
  rate: number;
  source: string;
  timestamp: string;
  age_minutes: number;
}

/**
 * Guarda una nueva tasa de cambio en la base de datos
 */
export async function saveExchangeRate(
  rate: number,
  source: string,
  is_fallback: boolean = false,
  api_response?: any
): Promise<ExchangeRateRecord | null> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from('exchange_rates')
      .insert({
        rate,
        source,
        is_fallback,
        api_response: api_response || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving exchange rate:', error);
      return null;
    }


    return data;
  } catch (error) {
    console.error('Error in saveExchangeRate:', error);
    return null;
  }
}

/**
 * Obtiene la última tasa válida (no fallback) de la base de datos
 */
export async function getLatestValidExchangeRate(): Promise<LatestRateResult | null> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .rpc('get_latest_valid_exchange_rate');

    if (error) {
      console.error('Error getting latest valid exchange rate:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn('[ExchangeRate] No valid rates found in database');
      return null;
    }

    const result = data[0] as LatestRateResult;


    return result;
  } catch (error) {
    console.error('Error in getLatestValidExchangeRate:', error);
    return null;
  }
}

/**
 * Obtiene la última tasa de cualquier tipo (incluso fallback)
 */
export async function getLatestExchangeRate(): Promise<ExchangeRateRecord | null> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error getting latest exchange rate:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getLatestExchangeRate:', error);
    return null;
  }
}

/**
 * Obtiene el historial de tasas de cambio
 */
export async function getExchangeRateHistory(
  limit: number = 50,
  onlyValid: boolean = false
): Promise<ExchangeRateRecord[]> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    let query = supabase
      .from('exchange_rates')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (onlyValid) {
      query = query.eq('is_fallback', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting exchange rate history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getExchangeRateHistory:', error);
    return [];
  }
}

/**
 * Limpia registros antiguos (mantiene solo los últimos 1000)
 */
export async function cleanupOldExchangeRates(): Promise<number> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .rpc('cleanup_old_exchange_rates');

    if (error) {
      console.error('Error cleaning up old exchange rates:', error);
      return 0;
    }

    const deletedCount = data || 0;
    if (deletedCount > 0) {

    }

    return deletedCount;
  } catch (error) {
    console.error('Error in cleanupOldExchangeRates:', error);
    return 0;
  }
}

/**
 * Verifica si una tasa es válida según criterios de negocio
 */
export function isValidExchangeRate(rate: number): boolean {
  return !isNaN(rate) && rate > 10 && rate < 500;
}

/**
 * Determina si una tasa necesita actualización basado en su antigüedad
 */
export function shouldUpdateRate(lastUpdated: Date, maxAgeMinutes: number = 30): boolean {
  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes >= maxAgeMinutes;
}
