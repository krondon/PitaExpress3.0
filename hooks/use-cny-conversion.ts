import { useState, useEffect, useCallback } from 'react';

interface CNYConversionHook {
  convertToCNY: (usdAmount: number) => number;
  formatCNYPrice: (usdAmount: number) => string;
  cnyRate: number;
  loading: boolean;
  error: string | null;
}

export const useCNYConversion = (): CNYConversionHook => {
  const [cnyRate, setCnyRate] = useState<number>(7.25); // Valor por defecto
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Función para obtener la tasa CNY
  const fetchCNYRate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/exchange-rate/cny', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(data.error || 'Failed to fetch CNY exchange rate');
      }

      const newRate = parseFloat(data.rate?.toString() || '7.25');
      if (isNaN(newRate) || newRate <= 0) {
        throw new Error('Invalid CNY rate received from API');
      }

      setCnyRate(newRate);

    } catch (err: any) {
      const errorMessage = err.message || 'Error al obtener tasa CNY';
      setError(errorMessage);
      console.error('[CNY Conversion] Error:', err);
      // Mantener el valor por defecto en caso de error
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar tasa inicial (solo una vez al montar)
  useEffect(() => {
    let mounted = true;
    fetchCNYRate().finally(() => {
      mounted = false;
    });
    return () => {
      mounted = false;
    };
  }, []); // Sin dependencias para evitar re-ejecuciones

  // Función para convertir USD a CNY
  const convertToCNY = useCallback((usdAmount: number): number => {
    if (!usdAmount || isNaN(usdAmount) || usdAmount <= 0) return 0;
    return usdAmount * cnyRate;
  }, [cnyRate]);

  // Función para formatear precio en CNY
  const formatCNYPrice = useCallback((usdAmount: number): string => {
    const cnyAmount = convertToCNY(usdAmount);
    if (cnyAmount === 0) return '¥0.00';
    
    // Formatear con separadores de miles y 2 decimales
    return `¥${cnyAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }, [convertToCNY]);

  return {
    convertToCNY,
    formatCNYPrice,
    cnyRate,
    loading,
    error
  };
};
