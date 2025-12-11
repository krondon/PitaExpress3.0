'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Database,
  Loader2
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';

interface ApiHealthStats {
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

interface HealthResponse {
  overall_status: 'healthy' | 'degraded' | 'down';
  apis: ApiHealthStats[];
  current_source: {
    type: 'api' | 'database';
    rate: number;
    age_hours: number;
    source_name: string;
  };
  last_update: string;
}

export default function ApiHealthMonitor() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealthData = async () => {
    try {
      // Agregar timestamp para evitar caché del navegador
      const timestamp = Date.now();
      const response = await fetch(`/api/exchange-rate/health?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch health data');
      const data = await response.json();
      console.log('[Frontend] Health data recibida:', data);
      console.log('[Frontend] Número de APIs:', data.apis?.length || 0);
      console.log('[Frontend] Tipo de apis:', typeof data.apis, Array.isArray(data.apis) ? '(es array)' : '(NO es array)');
      if (data.apis && data.apis.length > 0) {
        console.log('[Frontend] Primeras 2 APIs:', data.apis.slice(0, 2));
      }
      setHealthData(data);
    } catch (error: any) {
      console.error('Error fetching health data:', error);
      toast({
        title: 'Error',
        description: 'No se pudo obtener el estado de las APIs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    // Actualizar cada 30 segundos
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHealthData();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'down':
        return <WifiOff className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return <Badge className="bg-green-500">Funcionando</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500">Inestable</Badge>;
      case 'down':
        return <Badge className="bg-red-500">Caída</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Hace menos de 1 minuto';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  };

  const getApiDisplayName = (apiName: string): string => {
    const nameMap: Record<string, string> = {
      'dollarvzla.com': 'DollarVzla.com',
      'pydolarvenezuela': 'PyDolarVenezuela',
      'exchangerate-api': 'ExchangeRate-API',
      'binance_p2p_direct': 'Binance P2P Direct',
      'pydolarvenezuela_binance': 'PyDolarVenezuela (Binance)',
      'dollarvzla_binance': 'DollarVzla (Binance)'
    };
    return nameMap[apiName] || apiName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  if (!healthData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No se pudo cargar el estado de las APIs
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estado General */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(healthData.overall_status)}
              <CardTitle>Estado General del Sistema</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
          <CardDescription>
            Última actualización: {formatTimeAgo(healthData.last_update)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {getStatusBadge(healthData.overall_status)}
            <span className="text-sm text-muted-foreground">
              {healthData.apis.filter(a => a.status === 'up').length} de {healthData.apis.length} APIs funcionando
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Estado de cada API */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthData.apis.map((api) => (
          <Card key={api.api_name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{getApiDisplayName(api.api_name)}</CardTitle>
                {getStatusIcon(api.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estado:</span>
                {getStatusBadge(api.status)}
              </div>
              
              {api.last_success && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Último éxito:</span>
                  <span>{formatTimeAgo(api.last_success)}</span>
                </div>
              )}
              
              {api.response_time_avg && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tiempo promedio:</span>
                  <span>{Math.round(api.response_time_avg)}ms</span>
                </div>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tasa de éxito (24h):</span>
                <span className="font-semibold">{api.success_rate_24h.toFixed(1)}%</span>
              </div>
              
              {api.current_rate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tasa actual:</span>
                  <span className="font-semibold">{api.current_rate.toFixed(2)} VES/USD</span>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground pt-2 border-t">
                {api.successful_attempts_24h} exitosos de {api.total_attempts_24h} intentos
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fuente Actual */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            <CardTitle>Fuente Actual de Tasa de Cambio</CardTitle>
          </div>
          <CardDescription>
            Información sobre la tasa de cambio que se está utilizando actualmente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Fuente:</span>
            <Badge variant="outline">{healthData.current_source.source_name}</Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tipo:</span>
            <Badge variant={healthData.current_source.type === 'api' ? 'default' : 'secondary'}>
              {healthData.current_source.type === 'api' ? 'API Externa' : 'Base de Datos'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tasa:</span>
            <span className="text-lg font-bold">{healthData.current_source.rate.toFixed(2)} VES/USD</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Antigüedad:</span>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                {healthData.current_source.age_hours < 1 
                  ? 'Menos de 1 hora'
                  : healthData.current_source.age_hours < 24
                  ? `${healthData.current_source.age_hours} hora${healthData.current_source.age_hours > 1 ? 's' : ''}`
                  : `${Math.floor(healthData.current_source.age_hours / 24)} día${Math.floor(healthData.current_source.age_hours / 24) > 1 ? 's' : ''}`
                }
              </span>
            </div>
          </div>
          
          {healthData.current_source.age_hours > 24 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                La tasa actual tiene más de 24 horas de antigüedad. Se recomienda actualizar.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

