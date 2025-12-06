import { getSupabaseServiceRoleClient } from './server';

export interface ExchangeRateRecordCNY {
  id?: number;
  rate: number;
  source: string;
  timestamp?: string;
  is_fallback?: boolean;
  api_response?: any;
  created_at?: string;
}

export interface LatestRateResultCNY {
  rate: number;
  source: string;
  timestamp: string;
  age_minutes: number;
}

/**
 * Guarda una nueva tasa de cambio USD→CNY en la base de datos
 */
export async function saveExchangeRateCNY(
  rate: number,
  source: string,
  is_fallback: boolean = false,
  api_response?: any
): Promise<ExchangeRateRecordCNY | null> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from('exchange_rates_cny')
      .insert({
        rate,
        source,
        is_fallback,
        api_response: api_response || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving CNY exchange rate:', error);
      return null;
    }


    return data;
  } catch (error) {
    console.error('Error in saveExchangeRateCNY:', error);
    return null;
  }
}

/**
 * Obtiene la última tasa válida USD→CNY (no fallback) de la base de datos
 */
export async function getLatestValidExchangeRateCNY(): Promise<LatestRateResultCNY | null> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .rpc('get_latest_valid_exchange_rate_cny');

    if (error) {
      console.error('Error getting latest valid CNY exchange rate:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn('[ExchangeRate CNY] No valid rates found in database');
      return null;
    }

    const result = data[0] as LatestRateResultCNY;


    return result;
  } catch (error) {
    console.error('Error in getLatestValidExchangeRateCNY:', error);
    return null;
  }
}

/**
 * Obtiene la última tasa USD→CNY de cualquier tipo (incluso fallback)
 */
export async function getLatestExchangeRateCNY(): Promise<ExchangeRateRecordCNY | null> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from('exchange_rates_cny')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error getting latest CNY exchange rate:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getLatestExchangeRateCNY:', error);
    return null;
  }
}

/**
 * Obtiene el historial de tasas de cambio USD→CNY
 */
export async function getExchangeRateHistoryCNY(
  limit: number = 50,
  onlyValid: boolean = false
): Promise<ExchangeRateRecordCNY[]> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    let query = supabase
      .from('exchange_rates_cny')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (onlyValid) {
      query = query.eq('is_fallback', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting CNY exchange rate history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getExchangeRateHistoryCNY:', error);
    return [];
  }
}

/**
 * Limpia registros antiguos CNY (mantiene solo los últimos 1000)
 */
export async function cleanupOldExchangeRatesCNY(): Promise<number> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .rpc('cleanup_old_exchange_rates_cny');

    if (error) {
      console.error('Error cleaning up old CNY exchange rates:', error);
      return 0;
    }

    const deletedCount = data || 0;
    if (deletedCount > 0) {

    }

    return deletedCount;
  } catch (error) {
    console.error('Error in cleanupOldExchangeRatesCNY:', error);
    return 0;
  }
}

/**
 * Verifica si una tasa USD→CNY es válida según criterios de negocio
 */
export function isValidExchangeRateCNY(rate: number): boolean {
  // USD→CNY típicamente está entre 6.0 y 8.0
  return !isNaN(rate) && rate > 5.0 && rate < 10.0;
}

/**
 * Determina si una tasa CNY necesita actualización basado en su antigüedad
 */
export function shouldUpdateRateCNY(lastUpdated: Date, maxAgeMinutes: number = 30): boolean {
  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes >= maxAgeMinutes;
}
