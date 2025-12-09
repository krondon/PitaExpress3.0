import { NextRequest, NextResponse } from 'next/server';
import {
  saveExchangeRate,
  getLatestValidExchangeRate,
  getLatestExchangeRate,
  isValidExchangeRate,
  cleanupOldExchangeRates
} from '@/lib/supabase/exchange-rates';

// Función para obtener la tasa de cambio oficial del BCV
async function fetchExchangeRate(): Promise<number> {
  try {
    // Intentar obtener la tasa oficial del BCV desde DollarVzla API
    const response = await fetch('https://api.dollarvzla.com/v1/exchange-rates', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MornaProject/1.0'
      },
      // Timeout reducido a 3s para evitar bloqueos largos
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Validar estructura de respuesta
    if (!data || !data.exchangeRates || !Array.isArray(data.exchangeRates)) {
      throw new Error('Invalid API response structure');
    }

    // Buscar específicamente la tasa del BCV
    const bcvRate = data.exchangeRates.find((rate: any) =>
      rate.sourceCode && rate.sourceCode.toLowerCase() === 'bcv'
    );

    if (!bcvRate || !bcvRate.value) {
      throw new Error('BCV rate not found in API response');
    }

    const rate = parseFloat(bcvRate.value);

    // Validar que la tasa sea razonable usando la función utilitaria
    if (!isValidExchangeRate(rate)) {
      throw new Error(`Invalid BCV exchange rate value: ${rate}`);
    }

    return rate;

  } catch (error: any) {
    console.warn('Warning: Primary BCV API failed (using fallback):', error.message);

    // Fallback: Intentar con pyDolarVenezuela para obtener BCV
    try {
      const fallbackResponse = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page?page=bcv', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MornaProject/1.0'
        },
        signal: AbortSignal.timeout(3000)
      });

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData && fallbackData.monitors && Array.isArray(fallbackData.monitors)) {
          const bcvMonitor = fallbackData.monitors.find((monitor: any) =>
            monitor.title && monitor.title.toLowerCase().includes('bcv')
          );

          if (bcvMonitor && bcvMonitor.price) {
            const fallbackRate = parseFloat(bcvMonitor.price);
            if (isValidExchangeRate(fallbackRate)) {
              return fallbackRate;
            }
          }
        }
      }
    } catch (fallbackError) {
      console.error('Fallback BCV API also failed:', fallbackError);
    }

    // Segundo fallback: Usar una API alternativa para BCV
    try {
      const altResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MornaProject/1.0'
        },
        signal: AbortSignal.timeout(3000)
      });

      if (altResponse.ok) {
        const altData = await altResponse.json();
        if (altData && altData.rates && altData.rates.VES) {
          const vesRate = parseFloat(altData.rates.VES);
          if (isValidExchangeRate(vesRate)) {
            return vesRate;
          }
        }
      }
    } catch (altError) {
      console.error('Alternative API also failed:', altError);
    }

    throw error;
  }
}

// GET: Obtener tasa de cambio actual
export async function GET(request: NextRequest) {
  try {
    // 1. Intentar obtener de APIs externas primero
    let apiRate: number | null = null;
    let apiSource = 'BCV Oficial';
    let apiError: any = null;

    try {
      apiRate = await fetchExchangeRate();

    } catch (error) {
      apiError = error;
      console.error('[ExchangeRate] All APIs failed:', error);
    }

    // 2. Si obtuvimos tasa de API, guardarla y retornarla
    if (apiRate && isValidExchangeRate(apiRate)) {
      // Guardar tasa exitosa en BD
      await saveExchangeRate(apiRate, apiSource, false, {
        success: true,
        apis_used: ['dollarvzla', 'pydolarvenezuela', 'exchangerate-api']
      });

      // Limpiar registros antiguos ocasionalmente (1 de cada 50 requests)
      if (Math.random() < 0.02) {
        cleanupOldExchangeRates().catch(console.error);
      }

      return NextResponse.json({
        success: true,
        rate: apiRate,
        timestamp: new Date().toISOString(),
        source: apiSource,
        from_database: false
      });
    }

    // 3. APIs fallaron, intentar usar última tasa válida de BD

    const lastValidRate = await getLatestValidExchangeRate();

    if (lastValidRate) {


      // Guardar registro de que usamos fallback
      await saveExchangeRate(lastValidRate.rate, lastValidRate.source, true, {
        fallback_reason: 'APIs failed',
        original_error: apiError?.message,
        age_minutes: lastValidRate.age_minutes
      });

      return NextResponse.json({
        success: true,
        rate: lastValidRate.rate,
        timestamp: lastValidRate.timestamp,
        source: lastValidRate.source,
        from_database: true,
        age_minutes: lastValidRate.age_minutes,
        warning: `Usando última tasa conocida de ${lastValidRate.source} (${lastValidRate.age_minutes} minutos de antigüedad) debido a errores en las APIs`
      });
    }

    // 4. No hay tasa válida en BD, usar cualquier tasa (incluso fallback anterior)

    const anyLastRate = await getLatestExchangeRate();

    if (anyLastRate) {


      return NextResponse.json({
        success: true,
        rate: anyLastRate.rate,
        timestamp: anyLastRate.timestamp || new Date().toISOString(),
        source: anyLastRate.source || 'Base de Datos',
        from_database: true,
        warning: 'Usando tasa de respaldo de la base de datos debido a errores en todas las APIs'
      });
    }

    // 5. Último recurso: tasa por defecto y guardarla
    console.error('[ExchangeRate] No rates available anywhere, using hardcoded default');
    const defaultRate = 166.58;

    await saveExchangeRate(defaultRate, 'Hardcoded Default', true, {
      fallback_reason: 'No rates available in APIs or database',
      api_error: apiError?.message
    });

    return NextResponse.json({
      success: true,
      rate: defaultRate,
      timestamp: new Date().toISOString(),
      source: 'Tasa por Defecto',
      from_database: false,
      warning: 'Usando tasa por defecto debido a errores en todas las APIs y ausencia de datos históricos'
    });

  } catch (error: any) {
    console.error('Critical error in exchange rate endpoint:', error);

    return NextResponse.json({
      success: false,
      error: 'Error crítico al obtener tasa de cambio',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST: Actualizar tasa de cambio (para uso interno)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { manualRate, forceRefresh } = body;

    // Si hay tasa manual, guardarla y usarla
    if (manualRate && isValidExchangeRate(parseFloat(manualRate))) {
      const rate = parseFloat(manualRate);

      // Guardar tasa manual en BD
      await saveExchangeRate(rate, 'Manual', false, {
        manual_update: true,
        updated_by: 'admin_user'
      });

      return NextResponse.json({
        success: true,
        rate: rate,
        timestamp: new Date().toISOString(),
        source: 'Manual',
        from_database: true
      });
    }

    // Si no hay tasa manual, obtener de API y guardar
    try {
      const apiRate = await fetchExchangeRate();

      // Guardar tasa de API en BD
      await saveExchangeRate(apiRate, 'BCV Oficial (Manual Refresh)', false, {
        manual_refresh: true,
        force_refresh: forceRefresh || false
      });

      return NextResponse.json({
        success: true,
        rate: apiRate,
        timestamp: new Date().toISOString(),
        source: 'BCV Oficial (Manual Refresh)',
        from_database: false
      });
    } catch (apiError: any) {
      // Si falla API, usar última tasa válida de BD
      const lastValidRate = await getLatestValidExchangeRate();

      if (lastValidRate) {
        return NextResponse.json({
          success: true,
          rate: lastValidRate.rate,
          timestamp: lastValidRate.timestamp,
          source: lastValidRate.source,
          from_database: true,
          age_minutes: lastValidRate.age_minutes,
          warning: `API falló durante actualización manual. Usando última tasa válida de ${lastValidRate.source}`
        });
      }

      // Si no hay nada en BD, retornar error
      throw new Error(`Failed to fetch from API and no valid rates in database: ${apiError.message}`);
    }

  } catch (error: any) {
    console.error('Error in POST exchange rate:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update exchange rate',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
