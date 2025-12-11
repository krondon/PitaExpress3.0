import { NextRequest, NextResponse } from 'next/server';
import { getAllApiHealthStats } from '@/lib/supabase/api-health-logs';
import { getLatestValidExchangeRate, getLatestExchangeRate } from '@/lib/supabase/exchange-rates';

export const revalidate = 0; // Deshabilitar cache para este endpoint

export async function GET(request: NextRequest) {
  try {
    // Obtener estadísticas de todas las APIs (igual que simple-test que funciona)
    console.log('[Health Endpoint] Llamando a getAllApiHealthStats()...');
    const apiStats = await getAllApiHealthStats();
    console.log('[Health Endpoint] getAllApiHealthStats retornó:', apiStats?.length || 0, 'APIs');
    console.log('[Health Endpoint] Tipo:', typeof apiStats, Array.isArray(apiStats) ? '(es array)' : '(NO es array)');
    if (apiStats && apiStats.length > 0) {
      console.log('[Health Endpoint] Primeras 2 APIs:', apiStats.slice(0, 2).map(a => ({ name: a.api_name, status: a.status })));
    }
    
    // Obtener la fuente actual (última tasa válida o de BD)
    const currentRate = await getLatestValidExchangeRate();
    const anyRate = await getLatestExchangeRate();

    // Determinar estado general
    const hasWorkingApi = apiStats.some(stat => stat.status === 'up');
    const hasDegradedApi = apiStats.some(stat => stat.status === 'degraded');
    
    let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (!hasWorkingApi && !hasDegradedApi) {
      overallStatus = 'down';
    } else if (!hasWorkingApi || hasDegradedApi) {
      overallStatus = 'degraded';
    }

    // Determinar fuente actual
    let currentSource: {
      type: 'api' | 'database';
      rate: number;
      age_hours: number;
      source_name: string;
    };

    if (currentRate) {
      currentSource = {
        type: 'database',
        rate: currentRate.rate,
        age_hours: Math.floor(currentRate.age_minutes / 60),
        source_name: currentRate.source
      };
    } else if (anyRate) {
      const ageMinutes = anyRate.timestamp || anyRate.created_at
        ? Math.floor((new Date().getTime() - new Date(anyRate.timestamp || anyRate.created_at || '').getTime()) / (1000 * 60))
        : 0;
      currentSource = {
        type: 'database',
        rate: anyRate.rate,
        age_hours: Math.floor(ageMinutes / 60),
        source_name: anyRate.source || 'Base de Datos'
      };
    } else {
      // Tasa por defecto
      currentSource = {
        type: 'database',
        rate: 166.58,
        age_hours: 999,
        source_name: 'Tasa por Defecto'
      };
    }

    const responseData = {
      overall_status: overallStatus,
      apis: apiStats || [], // Asegurar que siempre sea un array
      current_source: currentSource,
      last_update: new Date().toISOString()
    };
    
    console.log('[Health Endpoint] Retornando respuesta con', responseData.apis.length, 'APIs');
    
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error: any) {
    console.error('Error in health endpoint:', error);
    return NextResponse.json({
      overall_status: 'unknown',
      error: error.message || 'Error al obtener estado de APIs',
      last_update: new Date().toISOString()
    }, { status: 500 });
  }
}

