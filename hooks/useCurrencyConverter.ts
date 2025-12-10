import { useState, useEffect, useCallback, useRef } from 'react';

interface CurrencyConfig {
  usdRate: number;
  lastUpdated: string;
}

interface ConversionResult {
  usd: number;
  bolivars: number;
  rate: number;
  formatted: {
    usd: string;
    bolivars: string;
    both: string;
  };
}

interface UseCurrencyConverterReturn {
  convert: (amount: number, fromCurrency: 'USD' | 'VES') => ConversionResult;
  currentRate: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshRate: () => void;
}

export function useCurrencyConverter(): UseCurrencyConverterReturn {
  // Intentar cargar tasa cacheada inmediatamente para mostrar sin delay
  const [rate, setRate] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('pita-exchange-rate-cache');
        if (cached) {
          const { rate: cachedRate, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          // Usar tasa cacheada si tiene menos de 5 minutos
          if (cachedRate && age < 5 * 60 * 1000) {
            return cachedRate;
          }
        }
      } catch (e) {
        // Ignorar errores de localStorage
      }
    }
    return 36.25; // Default fallback rate
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('pita-exchange-rate-cache');
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          return new Date(timestamp);
        }
      } catch (e) {
        // Ignorar errores
      }
    }
    return null;
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Log cuando el hook se inicializa
  useEffect(() => {
    console.warn('🚀 [CurrencyConverter] Hook inicializado, tasa inicial:', rate);
  }, []);

    // Helper seguro para abortar con una razón explícita y limpiar
    const safeAbort = (reason: string) => {
      try {
        if (abortControllerRef.current) {
          if (!abortControllerRef.current.signal.aborted) {
            // Proveer una razón explícita reduce warnings en algunos runtimes
            (abortControllerRef.current as any).abort(reason);
          }
          // Limpieza: evitar reutilizar un controller abortado
          abortControllerRef.current = null;
        }
      } catch (e) {
        // Silenciar cualquier error de abort redundante
        // console.debug('Abort ignore:', e);
      }
    };

  // Función para obtener la tasa de cambio actual
  const fetchCurrentRate = useCallback(async () => {
    // Cancelar petición anterior si existe (sin lanzar error)
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {
        // Ignorar errores al abortar
      }
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      // SIEMPRE intentar obtener la tasa de la API primero (tasa más actualizada)
      try {
        const exchangeResponse = await fetch('/api/exchange-rate', {
          signal: abortControllerRef.current.signal,
          cache: 'no-store', // Evitar caché para obtener tasa actualizada
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        if (exchangeResponse.ok) {
          const exchangeData = await exchangeResponse.json();
          console.log('[CurrencyConverter] Respuesta de API recibida:', exchangeData);
          if (exchangeData.success && exchangeData.rate && !isNaN(exchangeData.rate) && exchangeData.rate > 0) {
            const newRate = parseFloat(exchangeData.rate);
            console.log('✅ [CurrencyConverter] Tasa obtenida de API:', newRate, 'Bs/USD - Fuente:', exchangeData.source);
            setRate(newRate);
            const updateTime = new Date(exchangeData.timestamp);
            setLastUpdated(updateTime);
            // Guardar en caché para uso inmediato en próximas cargas
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('pita-exchange-rate-cache', JSON.stringify({
                  rate: newRate,
                  timestamp: updateTime.getTime(),
                  source: exchangeData.source
                }));
              } catch (e) {
                // Ignorar errores de localStorage
              }
            }
            setError(null); // Limpiar errores previos si la API funciona
            setIsLoading(false);
            return; // Éxito: usar tasa de la API
          } else {
            console.error('⚠️ [CurrencyConverter] Respuesta de API inválida:', exchangeData);
          }
        } else {
          const errorText = await exchangeResponse.text().catch(() => 'No se pudo leer el error');
          console.error('❌ [CurrencyConverter] API respondió con error:', exchangeResponse.status, exchangeResponse.statusText, errorText);
        }
      } catch (apiError: any) {
        // Ignorar errores de abort (son normales cuando se cancela una petición anterior)
        if (apiError.name === 'AbortError' || apiError.message === 'new-fetch' || apiError.message === 'component-unmount' || apiError.message?.includes('abort')) {
          // No mostrar mensaje para abortos normales (son esperados durante el ciclo de vida del componente)
          setIsLoading(false);
          return; // Salir sin error, la nueva petición se hará
        }
        // Si la API falla por otra razón, continuar con fallback a tasa manual
        console.warn('❌ [CurrencyConverter] API exchange-rate falló, usando fallback:', apiError.message || apiError);
      }
      
      // Fallback: Usar tasa de configuración manual si la API falla
      // Intentar obtener desde localStorage primero
      try {
        const savedConfig = localStorage.getItem('businessConfig');
        if (savedConfig) {
          const parsedConfig = JSON.parse(savedConfig);
          if (parsedConfig.usdRate) {
            setRate(parsedConfig.usdRate);
            setLastUpdated(new Date(parsedConfig.lastUpdated || new Date().toISOString()));
            return;
          }
        }
      } catch (e) {
  console.debug('Warn using localStorage config for rate:', e);
      }

      // Fallback a API de config si localStorage no funciona
      try {
        const configResponse = await fetch('/api/config', {
          signal: abortControllerRef.current.signal
        });

        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.success && configData.config && configData.config.usdRate) {
            setRate(configData.config.usdRate);
            setLastUpdated(new Date(configData.config.lastUpdated));
            return;
          }
        }
      } catch (e) {
        console.debug('Warn fetching fallback config:', e);
      }

      // Si todo falla, mantener el valor por defecto (36.25) pero mostrar error
      throw new Error('No se pudo obtener la tasa de cambio. Usando tasa por defecto.');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      
  console.debug('Error fetching currency rate (final fallback):', error);
      setError(error.message || 'Failed to fetch currency rate');
      // Mantener la tasa actual (por defecto o última conocida) en lugar de lanzar error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Función de conversión
  const convert = useCallback((amount: number, fromCurrency: 'USD' | 'VES' = 'USD'): ConversionResult => {
    const numAmount = Number(amount) || 0;
    
    let usd: number;
    let bolivars: number;
    
    if (fromCurrency === 'USD') {
      usd = numAmount;
      bolivars = numAmount * rate;
    } else {
      bolivars = numAmount;
      usd = numAmount / rate;
    }

    return {
      usd,
      bolivars,
      rate,
      formatted: {
        usd: `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        bolivars: `${bolivars.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`,
        both: `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${bolivars.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs)`
      }
    };
  }, [rate]);

  // Función manual para refrescar
  const refreshRate = useCallback(() => {
    fetchCurrentRate();
  }, [fetchCurrentRate]);

  // Efecto para cargar la tasa al montar el componente
  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    // Ejecutar inmediatamente al montar
    if (isMounted) {
      fetchCurrentRate();
    }

    // Actualizar cada 5 minutos (solo si el componente sigue montado)
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchCurrentRate();
      }
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      try {
        if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
            safeAbort('component-unmount');
        }
      } catch (error) {
        // Ignorar errores de abort si ya está abortado
        console.warn('Error aborting controller:', error);
      }
    };
  }, []); // Sin dependencias para evitar re-ejecuciones infinitas

  return {
    convert,
    currentRate: rate,
    isLoading,
    error,
    lastUpdated,
    refreshRate
  };
}
