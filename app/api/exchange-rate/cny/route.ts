import { NextRequest, NextResponse } from 'next/server';
import {
  saveExchangeRateCNY,
  getLatestValidExchangeRateCNY,
  getLatestExchangeRateCNY,
  isValidExchangeRateCNY,
  cleanupOldExchangeRatesCNY
} from '@/lib/supabase/exchange-rates-cny';

// Función para obtener la tasa de cambio USD → CNY con múltiples APIs
async function fetchUSDToCNYRate(): Promise<number> {
  // Lista de APIs en orden de prioridad
  const apis = [
    {
      name: 'ExchangeRate-API',
      url: 'https://api.exchangerate-api.com/v4/latest/USD',
      parser: (data: any) => data?.rates?.CNY
    },
    {
      name: 'Fawazahmed0',
      url: 'https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd/cny.json',
      parser: (data: any) => data?.cny
    },
    {
      name: 'CurrencyAPI-Free',
      url: 'https://api.currencyapi.com/v3/latest?apikey=free&currencies=CNY&base_currency=USD',
      parser: (data: any) => data?.data?.CNY?.value
    },
    {
      name: 'ExchangeRates-IO',
      url: 'https://api.exchangerates.io/v1/latest?access_key=free&symbols=CNY&base=USD',
      parser: (data: any) => data?.rates?.CNY
    },
    {
      name: 'Fixer-Free',
      url: 'https://api.fixer.io/latest?base=USD&symbols=CNY',
      parser: (data: any) => data?.rates?.CNY
    }
  ];

  let lastError: any = null;

  // Intentar cada API en orden
  for (const api of apis) {
    try {


      const response = await fetch(api.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MornaProject/1.0'
        },
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const rate = api.parser(data);

      if (!rate) {
        throw new Error(`CNY rate not found in ${api.name} response`);
      }

      const parsedRate = parseFloat(rate);

      if (!isValidExchangeRateCNY(parsedRate)) {
        throw new Error(`Invalid CNY exchange rate value from ${api.name}: ${parsedRate}`);
      }


      return parsedRate;

    } catch (error) {
      console.warn(`[CNY] ${api.name} failed, trying next...`);
      lastError = error;
      continue; // Intentar siguiente API
    }
  }

  // Si todas las APIs fallaron, lanzar error
  console.error('[CNY] All APIs failed:', lastError);
  throw new Error(`All CNY APIs failed. Last error: ${lastError?.message}`);
}

// GET: Obtener tasa de cambio USD → CNY actual
export async function GET(request: NextRequest) {
  try {
    // 1. Intentar obtener de APIs externas primero
    let apiRate: number | null = null;
    let apiSource = 'Oficial PBOC';
    let apiError: any = null;

    try {
      apiRate = await fetchUSDToCNYRate();

    } catch (error) {
      apiError = error;
      console.error('[ExchangeRate CNY] All APIs failed:', error);
    }

    // 2. Si obtuvimos tasa de API, guardarla y retornarla
    if (apiRate && isValidExchangeRateCNY(apiRate)) {
      // Guardar tasa exitosa en BD
      await saveExchangeRateCNY(apiRate, apiSource, false, {
        success: true,
        apis_used: ['exchangerate-api', 'fawazahmed0', 'currencyapi', 'exchangerates-io', 'fixer']
      });

      // Limpiar registros antiguos ocasionalmente (1 de cada 50 requests)
      if (Math.random() < 0.02) {
        cleanupOldExchangeRatesCNY().catch(console.error);
      }

      return NextResponse.json({
        success: true,
        rate: apiRate,
        timestamp: new Date().toISOString(),
        source: apiSource,
        from_database: false,
        currency_pair: 'USD/CNY'
      });
    }

    // 3. APIs fallaron, intentar usar última tasa válida de BD

    const lastValidRate = await getLatestValidExchangeRateCNY();

    if (lastValidRate) {


      // Guardar registro de que usamos fallback
      await saveExchangeRateCNY(lastValidRate.rate, lastValidRate.source, true, {
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
        currency_pair: 'USD/CNY',
        warning: `Usando última tasa conocida de ${lastValidRate.source} (${lastValidRate.age_minutes} minutos de antigüedad) debido a errores en las APIs`
      });
    }

    // 4. No hay tasa válida en BD, usar cualquier tasa (incluso fallback anterior)

    const anyLastRate = await getLatestExchangeRateCNY();

    if (anyLastRate) {


      return NextResponse.json({
        success: true,
        rate: anyLastRate.rate,
        timestamp: anyLastRate.timestamp || new Date().toISOString(),
        source: anyLastRate.source || 'Base de Datos',
        from_database: true,
        currency_pair: 'USD/CNY',
        warning: 'Usando tasa de respaldo de la base de datos debido a errores en todas las APIs'
      });
    }

    // 5. Último recurso: tasa por defecto y guardarla
    console.error('[ExchangeRate CNY] No rates available anywhere, using hardcoded default');
    const defaultRate = 7.25; // Tasa aproximada USD → CNY

    await saveExchangeRateCNY(defaultRate, 'Hardcoded Default', true, {
      fallback_reason: 'No rates available in APIs or database',
      api_error: apiError?.message
    });

    return NextResponse.json({
      success: true,
      rate: defaultRate,
      timestamp: new Date().toISOString(),
      source: 'Tasa por Defecto',
      from_database: false,
      currency_pair: 'USD/CNY',
      warning: 'Usando tasa por defecto debido a errores en todas las APIs y ausencia de datos históricos'
    });

  } catch (error: any) {
    console.error('Critical error in CNY exchange rate endpoint:', error);

    return NextResponse.json({
      success: false,
      error: 'Error crítico al obtener tasa de cambio USD→CNY',
      details: error.message,
      timestamp: new Date().toISOString(),
      currency_pair: 'USD/CNY'
    }, { status: 500 });
  }
}

// POST: Actualizar tasa de cambio USD → CNY (para uso interno)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { manualRate, forceRefresh } = body;

    // Si hay tasa manual, guardarla y usarla
    if (manualRate && isValidExchangeRateCNY(parseFloat(manualRate))) {
      const rate = parseFloat(manualRate);

      // Guardar tasa manual en BD
      await saveExchangeRateCNY(rate, 'Manual', false, {
        manual_update: true,
        updated_by: 'admin_user'
      });

      return NextResponse.json({
        success: true,
        rate: rate,
        timestamp: new Date().toISOString(),
        source: 'Manual',
        from_database: true,
        currency_pair: 'USD/CNY'
      });
    }

    // Si no hay tasa manual, obtener de API y guardar
    try {
      const apiRate = await fetchUSDToCNYRate();

      // Guardar tasa de API en BD
      await saveExchangeRateCNY(apiRate, 'Oficial PBOC (Manual Refresh)', false, {
        manual_refresh: true,
        force_refresh: forceRefresh || false
      });

      return NextResponse.json({
        success: true,
        rate: apiRate,
        timestamp: new Date().toISOString(),
        source: 'Oficial PBOC (Manual Refresh)',
        from_database: false,
        currency_pair: 'USD/CNY'
      });
    } catch (apiError: any) {
      // Si falla API, usar última tasa válida de BD
      const lastValidRate = await getLatestValidExchangeRateCNY();

      if (lastValidRate) {
        return NextResponse.json({
          success: true,
          rate: lastValidRate.rate,
          timestamp: lastValidRate.timestamp,
          source: lastValidRate.source,
          from_database: true,
          age_minutes: lastValidRate.age_minutes,
          currency_pair: 'USD/CNY',
          warning: `API falló durante actualización manual. Usando última tasa válida de ${lastValidRate.source}`
        });
      }

      // Si no hay nada en BD, retornar error
      throw new Error(`Failed to fetch from API and no valid rates in database: ${apiError.message}`);
    }

  } catch (error: any) {
    console.error('Error in POST CNY exchange rate:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to update USD→CNY exchange rate',
      timestamp: new Date().toISOString(),
      currency_pair: 'USD/CNY'
    }, { status: 500 });
  }
}
