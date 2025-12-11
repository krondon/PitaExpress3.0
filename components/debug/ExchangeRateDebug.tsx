"use client";

import React, { useState } from 'react';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Database, Wifi, WifiOff, Clock, AlertTriangle } from 'lucide-react';

interface HistoryItem {
  id: number;
  rate: number;
  source: string;
  timestamp: string;
  is_fallback: boolean;
}

export function ExchangeRateDebug() {
  const { 
    rate, 
    loading, 
    error, 
    lastUpdated, 
    source, 
    fromDatabase, 
    ageMinutes, 
    warning,
    refreshRate,
    getTimeSinceUpdate 
  } = useExchangeRate();

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/exchange-rate/history?limit=10');
      const data = await response.json();
      if (data.success) {
        setHistory(data.data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const testApiFailure = async () => {
    // Simular fallo de API haciendo request a endpoint inexistente
    try {
      await fetch('/api/exchange-rate-fake-endpoint');
    } catch (e) {
      // Después del fallo, refrescar para ver el fallback
      setTimeout(() => refreshRate(), 1000);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Exchange Rate Debug Panel
          </CardTitle>
          <CardDescription>
            Monitor del sistema de tasas de cambio con fallback a base de datos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado actual */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {rate ? `${rate.toFixed(2)} Bs` : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">Tasa Actual</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                {fromDatabase ? (
                  <Database className="h-4 w-4 text-orange-500" />
                ) : (
                  <Wifi className="h-4 w-4 text-green-500" />
                )}
                <Badge variant={fromDatabase ? "destructive" : "default"}>
                  {fromDatabase ? 'Base de Datos' : 'API en Vivo'}
                </Badge>
              </div>
              <div className="text-sm text-gray-500">Fuente</div>
            </div>

            <div className="text-center">
              <div className="text-sm font-medium">
                {source || 'N/A'}
              </div>
              <div className="text-sm text-gray-500">Proveedor</div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">
                  {ageMinutes ? `${ageMinutes} min` : getTimeSinceUpdate() || 'N/A'}
                </span>
              </div>
              <div className="text-sm text-gray-500">Antigüedad</div>
            </div>
          </div>

          {/* Warnings */}
          {warning && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">{warning}</div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <WifiOff className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {/* Controles */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => refreshRate(true)}
              disabled={loading}
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar Tasa
            </Button>

            <Button 
              onClick={fetchHistory} 
              disabled={loadingHistory}
              variant="outline"
              size="sm"
            >
              {loadingHistory ? 'Cargando...' : 'Ver Historial'}
            </Button>

            <Button 
              onClick={testApiFailure} 
              variant="destructive"
              size="sm"
            >
              Simular Fallo API
            </Button>
          </div>

          <Separator />

          {/* Información detallada */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Última actualización:</strong><br />
              {lastUpdated ? lastUpdated.toLocaleString() : 'N/A'}
            </div>
            <div>
              <strong>Estado de conexión:</strong><br />
              <Badge variant={loading ? "secondary" : "default"}>
                {loading ? 'Actualizando...' : 'Conectado'}
              </Badge>
            </div>
          </div>

          {/* Historial */}
          {history.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3">Historial Reciente</h4>
                <div className="space-y-2">
                  {history.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.is_fallback ? "destructive" : "default"} className="text-xs">
                          {item.is_fallback ? 'Fallback' : 'API'}
                        </Badge>
                        <span className="font-medium">{item.rate.toFixed(2)} Bs</span>
                        <span className="text-gray-500">({item.source})</span>
                      </div>
                      <span className="text-gray-400">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
