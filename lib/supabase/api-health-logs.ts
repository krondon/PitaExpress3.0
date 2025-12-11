import { getSupabaseServiceRoleClient } from './server';

export interface ApiHealthLog {
  id?: number;
  api_name: string;
  status: 'success' | 'failed';
  response_time_ms?: number;
  error_message?: string;
  rate_obtained?: number;
  created_at?: string;
}

export interface ApiHealthStats {
  api_name: string;
  status: 'up' | 'down' | 'degraded';
  last_success?: string;
  last_failure?: string;
  response_time_avg?: number;
  success_rate_24h: number;
  total_attempts_24h: number;
  successful_attempts_24h: number;
  current_rate?: number;
}

/**
 * Guarda un log de intento de API
 */
export async function saveApiHealthLog(
  apiName: string,
  status: 'success' | 'failed',
  responseTimeMs?: number,
  errorMessage?: string,
  rateObtained?: number
): Promise<ApiHealthLog | null> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from('api_health_logs')
      .insert({
        api_name: apiName,
        status,
        response_time_ms: responseTimeMs || null,
        error_message: errorMessage || null,
        rate_obtained: rateObtained || null
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving API health log:', error);
      console.error('   API Name:', apiName);
      console.error('   Status:', status);
      console.error('   Error details:', JSON.stringify(error, null, 2));
      return null;
    }

    console.log('✅ API health log saved:', { apiName, status, responseTimeMs, rateObtained });
    return data;
  } catch (error) {
    console.error('❌ Exception in saveApiHealthLog:', error);
    console.error('   API Name:', apiName);
    console.error('   Status:', status);
    return null;
  }
}

/**
 * Obtiene estadísticas de salud de una API en las últimas 24 horas
 */
export async function getApiHealthStats(apiName: string): Promise<ApiHealthStats> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const twentyFourHoursAgoISO = twentyFourHoursAgo.toISOString();

    // Obtener todos los logs de las últimas 24 horas
    console.log(`[Health] Buscando logs para '${apiName}' desde ${twentyFourHoursAgoISO}`);
    console.log(`[Health] Hora actual: ${new Date().toISOString()}`);
    
    const { data: logs, error } = await supabase
      .from('api_health_logs')
      .select('*')
      .eq('api_name', apiName)
      .gte('created_at', twentyFourHoursAgoISO)
      .order('created_at', { ascending: false });
    
    console.log(`[Health] ${apiName}: Query ejecutada. Error:`, error ? JSON.stringify(error) : 'null');
    console.log(`[Health] ${apiName}: Logs retornados:`, logs?.length || 0);
    
    // Debug: también verificar si hay logs con este nombre sin filtro de tiempo
    const { data: allLogs, error: allLogsError } = await supabase
      .from('api_health_logs')
      .select('api_name, created_at')
      .eq('api_name', apiName)
      .limit(5);
    
    if (!allLogsError && allLogs && allLogs.length > 0) {
      console.log(`[Health] ${apiName}: Encontrados ${allLogs.length} logs totales (sin filtro de tiempo)`);
      console.log(`[Health] ${apiName}: Últimos logs:`, allLogs.map(l => ({ date: l.created_at })));
    } else if (!allLogsError) {
      console.log(`[Health] ${apiName}: NO se encontraron logs con este nombre exacto en la BD`);
    }

    if (error) {
      console.error(`[Health] ❌ ERROR getting stats for ${apiName}:`, error);
      console.error(`[Health] Error code:`, error.code);
      console.error(`[Health] Error message:`, error.message);
      console.error(`[Health] Error details:`, JSON.stringify(error, null, 2));
      // En lugar de retornar null, retornar un objeto por defecto
      return {
        api_name: apiName,
        status: 'down' as const,
        success_rate_24h: 0,
        total_attempts_24h: 0,
        successful_attempts_24h: 0
      };
    }

    console.log(`[Health] ${apiName}: ${logs?.length || 0} logs encontrados en últimas 24h`);
    
    // Si no hay logs en las últimas 24h, buscar el último log de esta API (para mostrar al menos algo)
    if (!logs || logs.length === 0) {
      const { data: lastLog, error: lastLogError } = await supabase
        .from('api_health_logs')
        .select('*')
        .eq('api_name', apiName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!lastLogError && lastLog) {
        console.log(`[Health] ${apiName}: Encontrado último log (más antiguo de 24h) del ${lastLog.created_at}`);
      }
    }

    if (!logs || logs.length === 0) {
      console.log(`[Health] ${apiName}: Sin logs en últimas 24h`);
      
      // Buscar el último log de esta API (sin filtro de tiempo) para mostrar información
      const { data: lastLog } = await supabase
        .from('api_health_logs')
        .select('*')
        .eq('api_name', apiName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (lastLog) {
        const lastLogDate = new Date(lastLog.created_at);
        const hoursAgo = (Date.now() - lastLogDate.getTime()) / (1000 * 60 * 60);
        console.log(`[Health] ${apiName}: Último log hace ${hoursAgo.toFixed(1)} horas`);
        
        // Si el último log es exitoso pero tiene más de 24h, mostrar como 'degraded'
        return {
          api_name: apiName,
          status: lastLog.status === 'success' && hoursAgo < 48 ? 'degraded' : 'down',
          last_success: lastLog.status === 'success' ? lastLog.created_at : undefined,
          last_failure: lastLog.status === 'failed' ? lastLog.created_at : undefined,
          success_rate_24h: 0,
          total_attempts_24h: 0,
          successful_attempts_24h: 0,
          current_rate: lastLog.status === 'success' ? lastLog.rate_obtained || undefined : undefined
        };
      }
      
      // Sin logs en absoluto
      console.log(`[Health] ${apiName}: Sin logs en absoluto, retornando estado 'down'`);
      return {
        api_name: apiName,
        status: 'down',
        success_rate_24h: 0,
        total_attempts_24h: 0,
        successful_attempts_24h: 0
      };
    }

    const successfulLogs = logs.filter(log => log.status === 'success');
    const failedLogs = logs.filter(log => log.status === 'failed');
    
    const lastSuccess = successfulLogs[0];
    const lastFailure = failedLogs[0];

    // Calcular tiempo promedio de respuesta solo de los exitosos
    const responseTimes = successfulLogs
      .map(log => log.response_time_ms)
      .filter((time): time is number => time !== null && time !== undefined);
    
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : undefined;

    const successRate = (successfulLogs.length / logs.length) * 100;

    // Determinar estado
    let status: 'up' | 'down' | 'degraded' = 'up';
    if (successRate === 0) {
      status = 'down';
    } else if (successRate < 70) {
      status = 'degraded';
    }

    const result = {
      api_name: apiName,
      status,
      last_success: lastSuccess?.created_at,
      last_failure: lastFailure?.created_at,
      response_time_avg: avgResponseTime,
      success_rate_24h: Math.round(successRate * 100) / 100,
      total_attempts_24h: logs.length,
      successful_attempts_24h: successfulLogs.length,
      current_rate: lastSuccess?.rate_obtained || undefined
    };
    
    console.log(`[Health] ✅ ${apiName}: Stats calculadas exitosamente:`, {
      status: result.status,
      attempts: result.total_attempts_24h,
      success_rate: result.success_rate_24h
    });
    
    return result;
  } catch (error: any) {
    console.error(`[Health] ❌ EXCEPTION in getApiHealthStats for ${apiName}:`, error);
    console.error(`[Health] Stack:`, error?.stack);
    // En lugar de retornar null, retornar un objeto por defecto
    return {
      api_name: apiName,
      status: 'down' as const,
      success_rate_24h: 0,
      total_attempts_24h: 0,
      successful_attempts_24h: 0
    };
  }
}

/**
 * Obtiene estadísticas de todas las APIs
 */
export async function getAllApiHealthStats(): Promise<ApiHealthStats[]> {
  try {
    // APIs de BCV (tasa de cambio USD/VES)
    const bcvApis = ['dollarvzla.com', 'pydolarvenezuela', 'exchangerate-api'];
    
    // APIs de Binance P2P
    const binanceApis = ['binance_p2p_direct', 'pydolarvenezuela_binance', 'dollarvzla_binance'];
    
    // Todas las APIs
    const allApis = [...bcvApis, ...binanceApis];
    
    console.log('[Health] Buscando estadísticas para:', allApis);
    
    const statsPromises = allApis.map(async (api) => {
      try {
        console.log(`[Health] Procesando API: ${api}`);
        const stat = await getApiHealthStats(api);
        // getApiHealthStats nunca retorna null ahora, siempre retorna un objeto válido
        console.log(`[Health] ${api}: Stats obtenidas - status: ${stat.status}, attempts: ${stat.total_attempts_24h}`);
        return stat;
      } catch (err: any) {
        console.error(`[Health] Error obteniendo stats para ${api}:`, err);
        console.error(`[Health] Stack:`, err.stack);
        return {
          api_name: api,
          status: 'down' as const,
          success_rate_24h: 0,
          total_attempts_24h: 0,
          successful_attempts_24h: 0
        };
      }
    });
    
    console.log('[Health] Esperando que todas las promesas se resuelvan...');
    const stats = await Promise.all(statsPromises);
    
    console.log('[Health] Todas las promesas resueltas. Total:', stats.length);
    console.log('[Health] Tipo de stats:', typeof stats, Array.isArray(stats) ? '(es array)' : '(NO es array)');
    
    // Debug: verificar cada stat individualmente
    stats.forEach((stat, index) => {
      console.log(`[Health] Stat ${index}:`, {
        type: typeof stat,
        is_null: stat === null,
        is_undefined: stat === undefined,
        has_api_name: stat && 'api_name' in stat,
        api_name: stat?.api_name || 'N/A'
      });
    });
    
    // Filtrar cualquier valor null o undefined (por si acaso)
    const validStats = stats.filter((s): s is ApiHealthStats => {
      const isValid = s !== null && s !== undefined && typeof s === 'object' && 'api_name' in s;
      if (!isValid) {
        console.warn('[Health] ⚠️ Stat inválido filtrado:', s);
      }
      return isValid;
    });
    
    console.log('[Health] ===== RESUMEN FINAL =====');
    console.log('[Health] Total de promesas resueltas:', stats.length);
    console.log('[Health] Total de estadísticas válidas:', validStats.length);
    console.log('[Health] Detalles:', validStats.map(s => ({ 
      name: s?.api_name, 
      status: s?.status, 
      attempts: s?.total_attempts_24h,
      success_rate: s?.success_rate_24h 
    })));
    
    if (validStats.length !== stats.length) {
      console.warn('[Health] ⚠️ Se filtraron', stats.length - validStats.length, 'estadísticas inválidas');
      console.warn('[Health] Stats originales (primeros 3):', stats.slice(0, 3));
    }
    
    console.log('[Health] Retornando array con', validStats.length, 'elementos');
    console.log('[Health] =========================');
    
    return validStats;
  } catch (error: any) {
    console.error('[Health] ❌ EXCEPTION CRÍTICA en getAllApiHealthStats:', error);
    console.error('[Health] Error message:', error?.message);
    console.error('[Health] Error stack:', error?.stack);
    console.error('[Health] Error details:', JSON.stringify(error, null, 2));
    // En lugar de retornar array vacío, lanzar el error para que se vea en los logs
    // Pero también retornar array vacío para que el frontend no se rompa
    console.error('[Health] Retornando array vacío debido a excepción');
    return [];
  }
}

/**
 * Obtiene los últimos logs de una API
 */
export async function getRecentApiLogs(
  apiName: string,
  limit: number = 50
): Promise<ApiHealthLog[]> {
  try {
    const supabase = getSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from('api_health_logs')
      .select('*')
      .eq('api_name', apiName)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting recent API logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getRecentApiLogs:', error);
    return [];
  }
}

