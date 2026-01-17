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
  Loader2,
  Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  const [infoModalOpen, setInfoModalOpen] = useState(false);

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
        title: t('common.error'),
        description: t('admin.management.apiHealth.fetchError'),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHealthData();
  };

  const handleTestAllApis = async () => {
    try {
      setRefreshing(true);

      toast({
        title: t('admin.management.apiHealth.testingApis'),
        description: t('admin.management.apiHealth.testingApisDesc'),
      });

      // Llamar al endpoint de health POST que probará todas las APIs individualmente
      const response = await fetch('/api/exchange-rate/health', {
        method: 'POST',
        cache: 'no-store'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t('admin.management.apiHealth.testApisError'));
      }

      const result = await response.json();

      console.log('[Frontend] Resultados de pruebas:', {
        success: result.success,
        apis_tested: result.apis?.length || 0,
        message: result.message
      });

      // Refrescar los datos
      await fetchHealthData();

      toast({
        title: t('admin.management.apiHealth.testsCompleted'),
        description: result.success
          ? t('admin.management.apiHealth.testsCompletedSuccess')
          : t('admin.management.apiHealth.testsCompletedError'),
      });
    } catch (error: any) {
      console.error('Error probando APIs:', error);
      toast({
        title: t('common.error'),
        description: t('admin.management.apiHealth.testApisError') + ' ' + (error.message || t('common.unknownError')),
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
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
        return <Badge className="bg-green-500">{t('admin.management.apiHealth.statusWorking')}</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500">{t('admin.management.apiHealth.statusUnstable')}</Badge>;
      case 'down':
        return <Badge className="bg-red-500">{t('admin.management.apiHealth.statusDown')}</Badge>;
      default:
        return <Badge variant="outline">{t('admin.management.apiHealth.statusUnknown')}</Badge>;
    }
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return t('admin.management.apiHealth.never');
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('admin.management.apiHealth.lessThanMinute');
    if (diffMins < 60) return diffMins === 1
      ? t('admin.management.apiHealth.minutesAgo', { count: diffMins })
      : t('admin.management.apiHealth.minutesAgoPlural', { count: diffMins });
    if (diffHours < 24) return diffHours === 1
      ? t('admin.management.apiHealth.hoursAgo', { count: diffHours })
      : t('admin.management.apiHealth.hoursAgoPlural', { count: diffHours });
    return diffDays === 1
      ? t('admin.management.apiHealth.daysAgo', { count: diffDays })
      : t('admin.management.apiHealth.daysAgoPlural', { count: diffDays });
  };

  const getApiDisplayName = (apiName: string): string => {
    const nameMap: Record<string, string> = {
      'dollarvzla.com': 'DollarVzla.com',
      'exchangerate-api': 'ExchangeRate-API',
      'fawazahmed0_currency_api': 'Fawazahmed0 Currency API',
      'binance_p2p_direct': 'STABLECOIN Direct',
      'pydolarvenezuela_binance': 'PyDolarVenezuela (STABLECOIN)',
      'dollarvzla_binance': 'DollarVzla (STABLECOIN)',
      'exchangerate_api_cny': 'ExchangeRate-API (CNY)',
      'fixer_free_cny': 'Fixer-Free (CNY)'
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
          {t('admin.management.apiHealth.loadError')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estado General */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <div className="flex items-center gap-2 mb-2 sm:mb-0">
              {getStatusIcon(healthData.overall_status)}
              <CardTitle>{t('admin.management.apiHealth.generalStatus')}</CardTitle>
            </div>
            <div className="flex flex-col xs:flex-row gap-2 w-full xs:w-auto mt-2 xs:mt-0">
              <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 xs:flex-none text-blue-600 hover:text-blue-700 hover:bg-blue-50 justify-center"
                  >
                    <Info className="w-4 h-4 mr-2" />
                    {t('admin.management.apiHealth.information')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Info className="w-5 h-5 text-blue-600" />
                      {t('admin.management.apiHealth.infoModal.title')}
                    </DialogTitle>
                    <DialogDescription>
                      {t('admin.management.apiHealth.infoModal.description')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-sm mb-1">{t('admin.management.apiHealth.infoModal.downApisTitle')}</h4>
                          <p className="text-sm text-muted-foreground">
                            {t('admin.management.apiHealth.infoModal.downApisDesc')}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Clock className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-sm mb-1">{t('admin.management.apiHealth.infoModal.maintenanceTitle')}</h4>
                          <p className="text-sm text-muted-foreground">
                            {t('admin.management.apiHealth.infoModal.maintenanceDesc')}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-sm mb-1">{t('admin.management.apiHealth.infoModal.contactTitle')}</h4>
                          <p className="text-sm text-muted-foreground">
                            {t('admin.management.apiHealth.infoModal.contactDesc')}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Database className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-sm mb-1">{t('admin.management.apiHealth.infoModal.discrepancyTitle')}</h4>
                          <p className="text-sm text-muted-foreground">
                            {t('admin.management.apiHealth.infoModal.discrepancyDesc')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t">
                      <p className="text-xs text-muted-foreground italic">
                        {t('admin.management.apiHealth.infoModal.supportText')}
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                size="sm"
                onClick={handleTestAllApis}
                disabled={refreshing}
                className="flex-1 xs:flex-none bg-blue-500 hover:bg-blue-600 text-white border-blue-500 justify-center"
              >
                <Activity className="w-4 h-4 mr-2" />
                {t('admin.management.apiHealth.testApis')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex-1 xs:flex-none justify-center"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {t('admin.management.apiHealth.refresh')}
              </Button>
            </div>
          </div>
          <CardDescription>
            {t('admin.management.apiHealth.lastUpdate')} {formatTimeAgo(healthData.last_update)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {getStatusBadge(healthData.overall_status)}
            <span className="text-sm text-muted-foreground">
              {healthData.apis.filter(a => a.status === 'up').length} {t('admin.management.apiHealth.of')} {healthData.apis.length} {t('admin.management.apiHealth.apisFunctioning')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Estado de cada API */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthData.apis
          .sort((a, b) => {
            // Orden de prioridad predefinido (de más importante a menos importante)
            const priorityOrder: Record<string, number> = {
              // BCV APIs (orden de uso)
              'exchangerate-api': 1,
              'fawazahmed0_currency_api': 2,
              'dollarvzla.com': 3,
              // Binance APIs (orden de uso)
              'binance_p2p_direct': 4,
              'pydolarvenezuela_binance': 5,
              'dollarvzla_binance': 6,
              // CNY APIs (orden de uso)
              'exchangerate_api_cny': 7,
              'fixer_free_cny': 8
            };

            // Primero ordenar por status: 'up' primero, luego 'down'
            const statusOrder = { 'up': 0, 'degraded': 1, 'down': 2 };
            const statusDiff = (statusOrder[a.status] || 2) - (statusOrder[b.status] || 2);

            // Si tienen el mismo status, ordenar por prioridad
            if (statusDiff === 0) {
              const priorityA = priorityOrder[a.api_name] || 99;
              const priorityB = priorityOrder[b.api_name] || 99;
              return priorityA - priorityB;
            }

            return statusDiff;
          })
          .map((api) => (
            <Card key={api.api_name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{getApiDisplayName(api.api_name)}</CardTitle>
                  {getStatusIcon(api.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('admin.management.apiHealth.status')}</span>
                  {getStatusBadge(api.status)}
                </div>

                {api.last_success && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('admin.management.apiHealth.lastSuccess')}</span>
                    <span className="text-green-600 dark:text-green-400">{formatTimeAgo(api.last_success)}</span>
                  </div>
                )}

                {api.last_failure && !api.last_success && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('admin.management.apiHealth.lastAttempt')}</span>
                    <span className="text-red-600 dark:text-red-400">{formatTimeAgo(api.last_failure)} ({t('admin.management.apiHealth.failed')})</span>
                  </div>
                )}

                {api.last_failure && api.last_success && new Date(api.last_failure) > new Date(api.last_success) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('admin.management.apiHealth.lastFailure')}</span>
                    <span className="text-yellow-600 dark:text-yellow-400">{formatTimeAgo(api.last_failure)}</span>
                  </div>
                )}

                {api.response_time_avg && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('admin.management.apiHealth.avgTime')}</span>
                    <span>{Math.round(api.response_time_avg)}ms</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('admin.management.apiHealth.successRate24h')}</span>
                  <span className="font-semibold">{api.success_rate_24h.toFixed(1)}%</span>
                </div>

                {api.current_rate && (
                  <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-1 text-sm">
                    <span className="text-muted-foreground">{t('admin.management.apiHealth.currentRate')}</span>
                    <span className="font-semibold">{api.current_rate.toFixed(2)} VES/USD</span>
                  </div>
                )}

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  {api.successful_attempts_24h} {t('admin.management.apiHealth.successfulOf')} {api.total_attempts_24h} {t('admin.management.apiHealth.attempts')}
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
            <CardTitle>{t('admin.management.apiHealth.currentSource')}</CardTitle>
          </div>
          <CardDescription>
            {t('admin.management.apiHealth.currentSourceDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('admin.management.apiHealth.source')}</span>
            <Badge variant="outline">{healthData.current_source.source_name}</Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('admin.management.apiHealth.type')}</span>
            <Badge variant={healthData.current_source.type === 'api' ? 'default' : 'secondary'}>
              {healthData.current_source.type === 'api' ? t('admin.management.apiHealth.externalApi') : t('admin.management.apiHealth.database')}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('admin.management.apiHealth.rate')}</span>
            <span className="text-lg font-bold">{healthData.current_source.rate.toFixed(2)} VES/USD</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('admin.management.apiHealth.age')}</span>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                {healthData.current_source.age_hours < 1
                  ? t('admin.management.apiHealth.lessThanHour')
                  : healthData.current_source.age_hours < 24
                    ? `${healthData.current_source.age_hours} ${healthData.current_source.age_hours === 1 ? t('admin.management.apiHealth.hour') : t('admin.management.apiHealth.hours')}`
                    : `${Math.floor(healthData.current_source.age_hours / 24)} ${Math.floor(healthData.current_source.age_hours / 24) === 1 ? t('admin.management.apiHealth.day') : t('admin.management.apiHealth.days')}`
                }
              </span>
            </div>
          </div>

          {healthData.current_source.age_hours > 24 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('admin.management.apiHealth.ageWarning')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div >
  );
}

