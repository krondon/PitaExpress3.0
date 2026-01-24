"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useAdminLayoutContext } from '@/lib/AdminLayoutContext';
import Header from '@/components/layout/Header';
import {
  Save,
  RefreshCw,
  DollarSign,
  Plane,
  Ship,
  Package,
  Calculator,
  Clock,
  Percent,
  Globe,
  Settings,
  AlertTriangle,
  CheckCircle,
  Users,
  Bell,
  Sun,
  Moon,
  Loader2,
  Wifi,
  WifiOff,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/hooks/useTranslation';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useExchangeRateBinance } from '@/hooks/useExchangeRateBinance';
import { useRealtimeBusinessConfig } from '@/hooks/use-realtime-business-config';
import ExchangeRateManager from '@/components/admin/ExchangeRateManager';
import { useTimeTranslations } from '@/hooks/useTimeTranslations';
import ApiHealthMonitor from '@/components/admin/ApiHealthMonitor';

interface BusinessConfig {
  // Parámetros de envío
  airShippingRate: number;
  seaShippingRate: number;
  // Eliminados días de entrega

  // Parámetros financieros
  usdRate: number;
  cnyRate: number;
  binanceRate: number;
  binanceRateSell: number;
  profitMargin: number;
  // usdDiscountPercent eliminado

  // Parámetros operativos adicionales
  maxQuotationsPerMonth?: number;
  maxModificationsPerOrder?: number;
  quotationValidityDays?: number;
  paymentDeadlineDays?: number;

  // Notificaciones y alertas
  alertsAfterDays?: number;

  // Configuración de accesos
  sessionTimeout: number;

  // Configuración de tasa de cambio
  auto_update_exchange_rate: boolean;
  auto_update_exchange_rate_cny: boolean;
  auto_update_binance_rate: boolean;
  auto_update_binance_rate_sell: boolean;
}

export default function ConfiguracionPage() {
  // Supabase client para obtener usuario
  const supabase = useMemo(() => createClientComponentClient(), []);
  // Estado de montaje
  const [mounted, setMounted] = useState(false);
  // Efecto para asegurar que el usuario esté logueado y obtener su id (solo después de montar)
  useEffect(() => {
    if (!mounted) return;
    const checkUser = async () => {
      const { data: userData, error } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        // Intentar obtener el id de localStorage
        const localId = localStorage.getItem('currentUserId');
        if (!localId) {
          window.location.href = '/login-register';
        }
        // Si existe en localStorage, NO redirigir
      } else {
        // Guardar el id en localStorage por si se necesita en otras partes
        localStorage.setItem('currentUserId', user.id);
      }
    };
    checkUser();
  }, [supabase, mounted]);


  // (Eliminado segundo useEffect duplicado de sesión)

  const { t } = useTranslation();
  const { getTimeAgo, translateSource } = useTimeTranslations();
  const { toggleMobileMenu } = useAdminLayoutContext();
  const { theme } = useTheme();
  const [config, setConfig] = useState<BusinessConfig>({
    airShippingRate: 8.50,
    seaShippingRate: 180.00,
    usdRate: 36.25,
    cnyRate: 7.25,
    binanceRate: 299.51,
    binanceRateSell: 299.51,
    profitMargin: 25,
    maxQuotationsPerMonth: 5,
    maxModificationsPerOrder: 2,
    quotationValidityDays: 7,
    paymentDeadlineDays: 3,
    alertsAfterDays: 7,
    sessionTimeout: 60,
    auto_update_exchange_rate: false,
    auto_update_exchange_rate_cny: false,
    auto_update_binance_rate: false,
    auto_update_binance_rate_sell: false
  });

  // Referencia al estado base para detectar cambios
  const baseConfigRef = useRef<BusinessConfig | null>(null);
  const [baselineVersion, setBaselineVersion] = useState(0);

  // Estado de fetching en curso (carga inicial / refetch)
  const [isFetching, setIsFetching] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  // Estado para auditoría
  const [lastAdmin, setLastAdmin] = useState<{ id: string; updated_at: string } | null>(null);
  const [lastAdminName, setLastAdminName] = useState<string>("");
  const { toast } = useToast();

  // =============================
  // Realtime: recibir row directo y mapear a estado UI (sin refetch)
  // =============================
  const handleRealtimeConfigRow = useCallback((row: any, eventType: string) => {
    if (!row) return;
    // Mapear columnas snake_case → estado camelCase de UI
    const mapped: Partial<BusinessConfig> = {};
    const mapPairs: [keyof BusinessConfig, string][] = [
      ['usdRate', 'usd_rate'],
      ['cnyRate', 'cny_rate'],
      ['binanceRate', 'binance_rate'],
      ['binanceRateSell', 'binance_rate_sell'],
      ['profitMargin', 'profit_margin'],
      ['airShippingRate', 'air_shipping_rate'],
      ['seaShippingRate', 'sea_shipping_rate'],
      ['alertsAfterDays', 'alerts_after_days'],
      // switches (ya están en snake en UI)
      ['auto_update_exchange_rate', 'auto_update_exchange_rate'],
      ['auto_update_exchange_rate_cny', 'auto_update_exchange_rate_cny'],
      ['auto_update_binance_rate', 'auto_update_binance_rate'],
      ['auto_update_binance_rate_sell', 'auto_update_binance_rate_sell']
    ];
    let changed = false;
    mapPairs.forEach(([uiKey, dbKey]) => {
      if (Object.prototype.hasOwnProperty.call(row, dbKey)) {
        const newVal = row[dbKey];
        // Comparar con baseline (si existe)
        const currentBaselineVal = baseConfigRef.current ? (baseConfigRef.current as any)[uiKey] : undefined;
        if (currentBaselineVal !== newVal) {
          (mapped as any)[uiKey] = newVal;
          changed = true;
        }
      }
    });
    if (changed) {
      setConfig(prev => {
        const merged = { ...prev, ...mapped };
        baseConfigRef.current = { ...merged }; // actualizar baseline para evitar marcar cambios locales
        return merged;
      });
      setBaselineVersion(v => v + 1);
    } else {
      // Aunque no haya cambios de valores (porque ya estaban aplicados localmente) igual registrar auditoría
    }
    if (row.updated_at) {
      try { setLastSaved(new Date(row.updated_at)); } catch { }
    }
    if (row.admin_id) {
      const sameAdmin = lastAdmin?.id === row.admin_id;
      // Actualizar siempre si cambia updated_at o cambia el admin
      if (!sameAdmin || (lastAdmin && lastAdmin.updated_at !== row.updated_at)) {
        setLastAdmin({ id: row.admin_id, updated_at: row.updated_at || new Date().toISOString() });
        const cacheKey = `adminName:${row.admin_id}`;
        const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
        if (cached) {
          setLastAdminName(cached);
        } else {
          fetch(`/api/admin-name?uid=${row.admin_id}`)
            .then(r => r.json())
            .then(r => { if (r.success && r.name) { setLastAdminName(r.name); sessionStorage.setItem(cacheKey, r.name); } })
            .catch(() => { });
        }
      }
    }
  }, []);

  useRealtimeBusinessConfig(handleRealtimeConfigRow);

  // Callback estable para actualizar la tasa USD
  const handleRateUpdate = useCallback((newRate: number) => {
    setConfig(prev => {
      if (prev.usdRate === newRate) return prev;
      return { ...prev, usdRate: newRate };
    });
    // Si el modo auto está activo, persistir inmediatamente (sin esperar botón Guardar)
    if (configRef.current?.auto_update_exchange_rate) {
      scheduleAutoPersist('usdRate', { usd_rate: newRate, auto_update_exchange_rate: true });
    } else {
      // Solo marcar como cambio manual pendiente
      setBaselineVersion(v => v + 1);
    }
  }, []);

  // Callback estable para actualizar la tasa CNY - SIMPLIFICADO
  const handleRateUpdateCNY = useCallback((newRate: number) => {

    // SIMPLIFICADO: Solo actualizar si es diferente
    setConfig(prev => {
      if (prev.cnyRate === newRate) return prev;
      return { ...prev, cnyRate: newRate };
    });

    // Forzar detección de cambios para activar el botón de guardar
    setBaselineVersion(v => v + 1);
  }, []);

  // Ref para el debounce de la tasa manual USD y CNY
  const manualRateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const manualRateTimeoutRefCNY = useRef<NodeJS.Timeout | null>(null);

  // Función para guardar tasa manual en la base de datos
  const saveManualRate = useCallback(async (manualRate: number) => {
    if (!manualRate || isNaN(manualRate) || manualRate <= 0) return;

    try {
      const response = await fetch('/api/exchange-rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manualRate })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: t('admin.management.financial.manualRateSaved'),
          description: t('admin.management.financial.manualRateSavedDescription', {
            rate: manualRate.toFixed(2),
            currency: 'Bs/USD'
          }),
          variant: "default",
          duration: 3000,
        });
      } else {
        throw new Error(data.error || 'Error al guardar tasa manual');
      }
    } catch (error: any) {
      console.error('Error saving manual rate:', error);
      toast({
        title: "Error al guardar tasa",
        description: error.message || "No se pudo guardar la tasa manual",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [toast]);

  // Función para guardar tasa manual CNY en la base de datos
  const saveManualRateCNY = useCallback(async (manualRate: number) => {
    if (!manualRate || isNaN(manualRate) || manualRate <= 0) return;

    try {
      const response = await fetch('/api/exchange-rate/cny', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manualRate })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: t('admin.management.financial.manualRateSaved'),
          description: t('admin.management.financial.manualRateSavedDescription', {
            rate: manualRate.toFixed(4),
            currency: 'CNY/USD'
          }),
          variant: "default",
          duration: 3000,
        });
      } else {
        throw new Error(data.error || 'Error al guardar tasa manual CNY');
      }
    } catch (error: any) {
      console.error('Error saving manual CNY rate:', error);
      toast({
        title: "Error al guardar tasa CNY",
        description: error.message || "No se pudo guardar la tasa manual CNY",
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [toast]);

  // Función para aplicar cambios en la configuración
  const applyCost = useCallback((field: keyof BusinessConfig, raw: string) => {
    const cleaned = sanitizeCost(raw);
    // Permitir vacío, pero si no es vacío, convertir a número
    const finalValue = cleaned === '' ? '' : (isNaN(parseFloat(cleaned)) ? '' : parseFloat(cleaned));
    setConfig(prev => ({ ...prev, [field]: finalValue }));

    // Forzar detección de cambios para activar el botón de guardar
    setBaselineVersion(v => {

      return v + 1;
    });

    // Si es tasa CNY y la actualización automática está desactivada, guardar en BD solo si es número > 0
    if (field === 'cnyRate' && !config.auto_update_exchange_rate_cny && typeof finalValue === 'number' && finalValue > 0) {
      if (manualRateTimeoutRefCNY.current) {
        clearTimeout(manualRateTimeoutRefCNY.current);
      }
      manualRateTimeoutRefCNY.current = setTimeout(() => {
        saveManualRateCNY(finalValue);
      }, 1500);
    }

    // Si es tasa USD y la actualización automática está desactivada, guardar en BD solo si es número > 0
    if (field === 'usdRate' && !config.auto_update_exchange_rate && typeof finalValue === 'number' && finalValue > 0) {
      if (manualRateTimeoutRef.current) {
        clearTimeout(manualRateTimeoutRef.current);
      }
      manualRateTimeoutRef.current = setTimeout(() => {
        saveManualRate(finalValue);
      }, 1500);
    }
  }, [config.auto_update_exchange_rate_cny, config.auto_update_exchange_rate, saveManualRateCNY, saveManualRate]);

  // Memoizar el valor de autoUpdate USD para evitar loops infinitos
  const autoUpdateUSD = useMemo(() => config.auto_update_exchange_rate, [config.auto_update_exchange_rate]);

  // Hook para manejo de tasa de cambio
  const {
    rate: currentExchangeRate,
    loading: exchangeRateLoading,
    error: exchangeRateError,
    lastUpdated: exchangeRateLastUpdated,
    source: exchangeRateSource,
    refreshRate,
    getTimeSinceUpdate,
    isAutoUpdating
  } = useExchangeRate({
    autoUpdate: autoUpdateUSD,
    interval: 30 * 60 * 1000, // 30 minutos
    onRateUpdate: handleRateUpdate
  });

  // Estado para la tasa CNY (manejado por ExchangeRateManager)
  // Inicializar con el valor actual de config.cnyRate para evitar campo vacío al activar switch
  const [currentExchangeRateCNY, setCurrentExchangeRateCNY] = useState<number | null>(config.cnyRate);
  const [exchangeRateLoadingCNY, setExchangeRateLoadingCNY] = useState(false);
  const [exchangeRateErrorCNY, setExchangeRateErrorCNY] = useState<string | null>(null);
  const [exchangeRateLastUpdatedCNY, setExchangeRateLastUpdatedCNY] = useState<Date | null>(null);
  const [exchangeRateSourceCNY, setExchangeRateSourceCNY] = useState<string>('');

  // Inicializar información de CNY cuando se activa el switch
  useEffect(() => {
    if (config.auto_update_exchange_rate_cny && !exchangeRateLastUpdatedCNY) {
      // Si el switch está activo pero no hay fecha de actualización, inicializar
      setExchangeRateLastUpdatedCNY(new Date());
      setExchangeRateSourceCNY(t('admin.management.financial.sources.pbocOfficial'));
    }
  }, [config.auto_update_exchange_rate_cny, exchangeRateLastUpdatedCNY, t]);
  // Estado para el ícono Wi-Fi de CNY (debe reflejar el estado del switch)
  const isAutoUpdatingCNY = config.auto_update_exchange_rate_cny;

  // Debug: Log del estado del switch CNY


  // Memoizar el valor de autoUpdate Binance para evitar loops infinitos
  const autoUpdateBinance = useMemo(() => config.auto_update_binance_rate, [config.auto_update_binance_rate]);

  // Callback temporal para actualizar la tasa Binance (se actualizará después de definir scheduleAutoPersist)
  const handleBinanceRateUpdateTemp = useCallback((newRate: number) => {
    setConfig(prev => {
      if (prev.binanceRate === newRate) return prev;
      return { ...prev, binanceRate: newRate };
    });
    setBaselineVersion(v => v + 1);
  }, []);

  // Hook para manejo de tasa de cambio Binance
  const {
    rate: currentExchangeRateBinance,
    loading: exchangeRateLoadingBinance,
    error: exchangeRateErrorBinance,
    lastUpdated: exchangeRateLastUpdatedBinance,
    source: exchangeRateSourceBinance,
    refreshRate: refreshRateBinance,
    getTimeSinceUpdate: getTimeSinceUpdateBinance,
    isAutoUpdating: isAutoUpdatingBinance
  } = useExchangeRateBinance({
    autoUpdate: autoUpdateBinance,
    interval: 30 * 60 * 1000, // 30 minutos
    onRateUpdate: handleBinanceRateUpdateTemp,
    tradeType: 'BUY' // Tasa de compra
  });

  // Hook para tasa de VENTA (SELL) de Binance
  const handleBinanceRateUpdateSellTemp = useCallback((newRate: number) => {
    setConfig(prev => {
      if (prev.binanceRateSell === newRate) return prev;
      return { ...prev, binanceRateSell: newRate };
    });
    setBaselineVersion(v => v + 1);
  }, []);

  const autoUpdateBinanceSell = useMemo(() => config.auto_update_binance_rate_sell, [config.auto_update_binance_rate_sell]);

  const {
    rate: currentExchangeRateBinanceSell,
    loading: exchangeRateLoadingBinanceSell,
    error: exchangeRateErrorBinanceSell,
    lastUpdated: exchangeRateLastUpdatedBinanceSell,
    source: exchangeRateSourceBinanceSell,
    refreshRate: refreshRateBinanceSell,
    getTimeSinceUpdate: getTimeSinceUpdateBinanceSell,
    isAutoUpdating: isAutoUpdatingBinanceSell
  } = useExchangeRateBinance({
    autoUpdate: autoUpdateBinanceSell,
    interval: 30 * 60 * 1000, // 30 minutos
    onRateUpdate: handleBinanceRateUpdateSellTemp,
    tradeType: 'SELL' // Tasa de venta
  });

  // Callback para recibir actualizaciones del ExchangeRateManager
  const handleExchangeRateUpdate = useCallback((newRate: number) => {


    setCurrentExchangeRateCNY(newRate);
    setExchangeRateLastUpdatedCNY(new Date());
    setExchangeRateSourceCNY('Oficial PBOC');
    setExchangeRateLoadingCNY(false);
    setExchangeRateErrorCNY(null);

    // Actualizar el config para que el input muestre el valor de la API inmediatamente
    setConfig(prev => {
      if (prev.cnyRate === newRate) return prev;
      return { ...prev, cnyRate: newRate };
    });
    if (configRef.current?.auto_update_exchange_rate_cny) {
      scheduleAutoPersist('cnyRate', { cny_rate: newRate, auto_update_exchange_rate_cny: true });
    } else {
      setBaselineVersion(v => v + 1);
    }
  }, [config.cnyRate, currentExchangeRateCNY]);

  // Función de refrescar CNY - SIMPLE
  const refreshRateCNY = useCallback(() => {

    // Forzar actualización manual
    setExchangeRateLoadingCNY(true);
    setExchangeRateErrorCNY(null);

    // Simular llamada a API (esto debería conectarse con el hook real)
    setTimeout(() => {
      const newRate = 7.14; // Valor simulado - debería venir de la API real
      setExchangeRateLoadingCNY(false);
      setExchangeRateLastUpdatedCNY(new Date());
      setExchangeRateSourceCNY(t('admin.management.financial.liveApi'));

      // Mostrar mensaje de "Tasa actualizada"
      toast({
        title: t('admin.management.financial.rateUpdated'),
        description: t('admin.management.financial.rateUpdatedDescription', {
          rate: newRate,
          currency: 'CNY/USD'
        }),
        variant: "default",
        duration: 3000,
      });
    }, 1000);
  }, [toast]);

  const getTimeSinceUpdateCNY = useCallback(() => {
    if (!exchangeRateLastUpdatedCNY) return 'Nunca';
    const now = new Date();
    const diffMs = now.getTime() - exchangeRateLastUpdatedCNY.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Hace menos de 1 minuto';
    if (diffMins === 1) return 'Hace 1 minuto';
    if (diffMins < 60) return `Hace ${diffMins} minutos`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return 'Hace 1 hora';
    return `Hace ${diffHours} horas`;
  }, [exchangeRateLastUpdatedCNY]);

  // ========== BINANCE RATE (USDT → VES) - MODO MANUAL ==========
  // Sin auto-actualización, solo edición manual del campo

  // Estado para la calculadora de conversión USDT → VES
  const [usdtAmount, setUsdtAmount] = useState<number>(100); // Para calculadora de compra
  const [usdtAmountSell, setUsdtAmountSell] = useState<number>(100); // Para calculadora de venta
  // Nueva función central para traer la config SIEMPRE desde API (fuente única)
  const fetchConfig = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      const data = await res.json();
      console.log('[Admin/Gestion] Config fetched from API:', data);
      if (data.success && data.config) {
        const db = data.config;
        const mapped: BusinessConfig = {
          airShippingRate: db.air_shipping_rate ?? 8.50,
          seaShippingRate: db.sea_shipping_rate ?? 180.00,
          usdRate: db.usd_rate ?? 36.25,
          cnyRate: db.cny_rate ?? 7.25,
          binanceRate: db.binance_rate ?? 299.51,
          binanceRateSell: db.binance_rate_sell ?? 299.51,
          profitMargin: db.profit_margin ?? 25,
          maxQuotationsPerMonth: db.max_quotations_per_month ?? 5,
          maxModificationsPerOrder: db.max_modifications_per_order ?? 2,
          quotationValidityDays: db.quotation_validity_days ?? 7,
          paymentDeadlineDays: db.payment_deadline_days ?? 3,
          alertsAfterDays: db.alerts_after_days ?? 7,
          sessionTimeout: db.session_timeout ?? 60,
          auto_update_exchange_rate: db.auto_update_exchange_rate ?? false,
          auto_update_exchange_rate_cny: db.auto_update_exchange_rate_cny ?? false,
          auto_update_binance_rate: db.auto_update_binance_rate ?? false,
          auto_update_binance_rate_sell: db.auto_update_binance_rate_sell ?? false
        };
        setConfig(mapped);
        baseConfigRef.current = { ...mapped };
        if (db.updated_at) {
          try { setLastSaved(new Date(db.updated_at)); } catch { }
        }
        if (db.admin_id) {
          const cacheKey = `adminName:${db.admin_id}`;
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            setLastAdminName(cached);
          } else {
            fetch(`/api/admin-name?uid=${db.admin_id}`)
              .then(r => r.json())
              .then(r => { if (r.success && r.name) { setLastAdminName(r.name); sessionStorage.setItem(cacheKey, r.name); } else setLastAdminName('Administrador'); })
              .catch(() => setLastAdminName('Administrador'));
          }
          setLastAdmin({ id: db.admin_id, updated_at: db.updated_at || new Date().toISOString() });
        }
        setBaselineVersion(v => v + 1);

      } else {
        console.warn('[Admin] Config API returned empty');
      }
    } catch (e) {
      console.error('[Admin] Error fetching config', e);
    } finally {
      setIsFetching(false);
      setMounted(true);
    }
  }, []);

  // Control de refetch en foco con throttle para evitar “salto” visual al volver rápidamente
  // Solo primera carga: luego todo dependerá de realtime + guardado explícito
  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // Cleanup effect para el timeout de tasa manual
  useEffect(() => {
    return () => {
      if (manualRateTimeoutRef.current) {
        clearTimeout(manualRateTimeoutRef.current);
      }
      if (manualRateTimeoutRefCNY.current) {
        clearTimeout(manualRateTimeoutRefCNY.current);
      }
    };
  }, []);



  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Obtener usuario actual de Supabase correctamente
      const { data: userData, error } = await supabase.auth.getUser();
      let user = userData?.user;
      let adminId = user?.id;
      // Si no hay usuario, intentar obtener el id de localStorage
      if (!adminId) {
        adminId = localStorage.getItem('currentUserId') || undefined;
      }
      if (!adminId) {
        let msg = 'No se pudo obtener el id del administrador (ni de sesión ni de localStorage)';
        throw new Error(msg);
      }
      // Solo guardar los campos globales requeridos y datos de auditoría
      const configToSave = {
        usd_rate: config.usdRate,
        auto_update_exchange_rate: config.auto_update_exchange_rate,
        cny_rate: config.cnyRate,
        auto_update_exchange_rate_cny: config.auto_update_exchange_rate_cny,
        binance_rate: config.binanceRate,
        binance_rate_sell: config.binanceRateSell,
        auto_update_binance_rate: config.auto_update_binance_rate,
        auto_update_binance_rate_sell: config.auto_update_binance_rate_sell,
        profit_margin: config.profitMargin,
        air_shipping_rate: config.airShippingRate,
        sea_shipping_rate: config.seaShippingRate,
        alerts_after_days: config.alertsAfterDays,
        admin_id: adminId
      };
      console.log('[Admin/Gestion] Saving config to API:', configToSave);
      // Guardar configuración en base de datos a través de la API
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSave)
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Error saving configuration');
      }
      // Preferir updated_at devuelto por la API; fallback al now local
      if (data.config && data.config.updated_at) {
        try { setLastSaved(new Date(data.config.updated_at)); } catch { setLastSaved(new Date()); }
      } else {
        setLastSaved(new Date());
      }
      // Actualizar info de auditoría
      setLastAdmin({
        id: adminId,
        updated_at: (data.config && data.config.updated_at) ? data.config.updated_at : new Date().toISOString()
      });
      // Forzar nombre inmediato del propio usuario (sin esperar evento realtime)
      try {
        const cacheKey = `adminName:${adminId}`;
        const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
        if (cached) {
          setLastAdminName(cached);
        } else {
          fetch(`/api/admin-name?uid=${adminId}`)
            .then(r => r.json())
            .then(r => { if (r.success && r.name) { setLastAdminName(r.name); sessionStorage.setItem(cacheKey, r.name); } });
        }
      } catch { }
      toast({
        title: t('admin.management.messages.configSaved'),
        description: t('admin.management.messages.configSavedGlobal'),
      });
      // Actualizar baseline para futuras comparaciones
      baseConfigRef.current = {
        usdRate: config.usdRate,
        auto_update_exchange_rate: config.auto_update_exchange_rate,
        cnyRate: config.cnyRate,
        auto_update_exchange_rate_cny: config.auto_update_exchange_rate_cny,
        binanceRate: config.binanceRate,
        binanceRateSell: config.binanceRateSell,
        auto_update_binance_rate: config.auto_update_binance_rate,
        auto_update_binance_rate_sell: config.auto_update_binance_rate_sell,
        profitMargin: config.profitMargin,
        airShippingRate: config.airShippingRate,
        seaShippingRate: config.seaShippingRate,
        alertsAfterDays: config.alertsAfterDays,
        sessionTimeout: config.sessionTimeout,
        maxQuotationsPerMonth: config.maxQuotationsPerMonth,
        maxModificationsPerOrder: config.maxModificationsPerOrder,
        quotationValidityDays: config.quotationValidityDays,
        paymentDeadlineDays: config.paymentDeadlineDays
      };
      setBaselineVersion(v => v + 1); // forzar recomputo de hasChanges
      // Refetch inmediato (garantizar sólo datos de API como fuente)
      await fetch('/api/config', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          if (d.success && d.config) {
            const db = d.config;
            const mapped: BusinessConfig = {
              airShippingRate: db.air_shipping_rate ?? 8.50,
              seaShippingRate: db.sea_shipping_rate ?? 180.00,
              usdRate: db.usd_rate ?? 36.25,
              cnyRate: db.cny_rate ?? 7.25,
              binanceRate: db.binance_rate ?? 299.51,
              binanceRateSell: db.binance_rate_sell ?? 299.51,
              profitMargin: db.profit_margin ?? 25,
              maxQuotationsPerMonth: db.max_quotations_per_month ?? 5,
              maxModificationsPerOrder: db.max_modifications_per_order ?? 2,
              quotationValidityDays: db.quotation_validity_days ?? 7,
              paymentDeadlineDays: db.payment_deadline_days ?? 3,
              alertsAfterDays: db.alerts_after_days ?? 7,
              sessionTimeout: db.session_timeout ?? 60,
              auto_update_exchange_rate: db.auto_update_exchange_rate ?? false,
              auto_update_exchange_rate_cny: db.auto_update_exchange_rate_cny ?? false,
              auto_update_binance_rate: db.auto_update_binance_rate ?? false,
              auto_update_binance_rate_sell: db.auto_update_binance_rate_sell ?? false
            };
            setConfig(mapped);
            baseConfigRef.current = { ...mapped };
            setBaselineVersion(v => v + 1);
          }
        });
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({
        title: "Error al guardar",
        description: error.message || "No se pudieron guardar los cambios en la base de datos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Actualiza el config y guarda inmediatamente si es campo global
  const updateConfig = (field: keyof BusinessConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Sólo marcar que hay cambios; el guardado ocurre en handleSave
    setBaselineVersion(v => v + 1);
  };

  // =============================
  // Persistencia automática para tasas en modo auto
  // =============================
  const autoPersistingRef = useRef<Record<string, boolean>>({});
  const autoPersistTimersRef = useRef<Record<string, any>>({});
  const persistAutoRate = useCallback(async (partial: Record<string, any>, fieldKey: 'usdRate' | 'cnyRate' | 'binanceRate' | 'binanceRateSell') => {
    try {
      if (autoPersistingRef.current[fieldKey]) return; // evitar solapamiento
      autoPersistingRef.current[fieldKey] = true;
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...partial })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Error auto-persistiendo tasa');
      // Ajustar baseline solo para los campos modificados para que no se active Guardar
      setConfig(prev => {
        const updated = { ...prev } as any;
        if (typeof partial.usd_rate !== 'undefined') updated.usdRate = partial.usd_rate;
        if (typeof partial.cny_rate !== 'undefined') updated.cnyRate = partial.cny_rate;
        if (typeof partial.binance_rate !== 'undefined') updated.binanceRate = partial.binance_rate;
        baseConfigRef.current = { ...updated };
        return updated;
      });
      if (data.config?.updated_at) {
        try { setLastSaved(new Date(data.config.updated_at)); } catch { }
      }
      // Evitar incrementar baselineVersion innecesariamente (ya sincronizado)

    } catch (e) {
      console.error('[AutoPersist] Error', e);
      // Si falla, marcar cambio pendiente para permitir Guardar manual
      setBaselineVersion(v => v + 1);
    } finally {
      autoPersistingRef.current[fieldKey] = false;
    }
  }, []);

  const scheduleAutoPersist = useCallback((fieldKey: 'usdRate' | 'cnyRate' | 'binanceRate' | 'binanceRateSell', payload: Record<string, any>) => {
    // Limpiar timer previo
    if (autoPersistTimersRef.current[fieldKey]) {
      clearTimeout(autoPersistTimersRef.current[fieldKey]);
    }
    // Debounce (ej: 1.2s); evita escribir en DB con demasiada frecuencia si llegan bursts
    autoPersistTimersRef.current[fieldKey] = setTimeout(() => {
      persistAutoRate(payload, fieldKey);
    }, 1200);
  }, [persistAutoRate]);

  // Comparar configuraciones usando ref para evitar loops infinitos
  const configRef = useRef(config);
  configRef.current = config;

  // Callback completo para actualizar la tasa Binance (definido después de scheduleAutoPersist)
  const handleBinanceRateUpdate = useCallback((newRate: number) => {
    setConfig(prev => {
      if (prev.binanceRate === newRate) return prev;
      return { ...prev, binanceRate: newRate };
    });
    // Si el modo auto está activo, persistir inmediatamente (sin esperar botón Guardar)
    if (configRef.current?.auto_update_binance_rate) {
      scheduleAutoPersist('binanceRate', { binance_rate: newRate, auto_update_binance_rate: true });
    } else {
      // Solo marcar como cambio manual pendiente
      setBaselineVersion(v => v + 1);
    }
  }, [scheduleAutoPersist]);

  // Efecto para forzar actualización inmediata cuando se activa el auto-update o al montar (compra)
  useEffect(() => {
    if (config.auto_update_binance_rate && refreshRateBinance) {
      // Forzar actualización inmediata cuando se activa el switch o al montar con auto-update activo
      const timer = setTimeout(() => {
        refreshRateBinance();
      }, 500); // Pequeño delay para asegurar que el hook esté listo
      return () => clearTimeout(timer);
    }
  }, [config.auto_update_binance_rate, refreshRateBinance]);

  // Efecto para forzar actualización inmediata cuando se activa el auto-update o al montar (venta)
  useEffect(() => {
    if (config.auto_update_binance_rate_sell && refreshRateBinanceSell) {
      // Forzar actualización inmediata cuando se activa el switch o al montar con auto-update activo
      const timer = setTimeout(() => {
        refreshRateBinanceSell();
      }, 700); // Pequeño delay adicional para evitar sobrecarga
      return () => clearTimeout(timer);
    }
  }, [config.auto_update_binance_rate_sell, refreshRateBinanceSell]);

  // Efecto para manejar auto-persistencia cuando cambie la tasa de Binance (compra)
  useEffect(() => {
    if (currentExchangeRateBinance !== null && config.auto_update_binance_rate) {
      // Usar el callback completo para actualizar y persistir
      handleBinanceRateUpdate(currentExchangeRateBinance);
    }
  }, [currentExchangeRateBinance, config.auto_update_binance_rate, handleBinanceRateUpdate]);

  // Efecto para manejar auto-persistencia cuando cambie la tasa de Binance (venta)
  useEffect(() => {
    if (currentExchangeRateBinanceSell !== null && config.auto_update_binance_rate_sell) {
      // Actualizar la tasa de venta
      setConfig(prev => {
        if (prev.binanceRateSell === currentExchangeRateBinanceSell) return prev;
        return { ...prev, binanceRateSell: currentExchangeRateBinanceSell };
      });
      if (configRef.current?.auto_update_binance_rate_sell) {
        scheduleAutoPersist('binanceRateSell', { binance_rate_sell: currentExchangeRateBinanceSell, auto_update_binance_rate_sell: true });
      } else {
        setBaselineVersion(v => v + 1);
      }
    }
  }, [currentExchangeRateBinanceSell, config.auto_update_binance_rate_sell, scheduleAutoPersist]);

  const hasChanges = useMemo(() => {
    if (!baseConfigRef.current) {

      return false;
    }

    // Validar que ningún campo relevante sea 0 o vacío
    const requiredFields: (keyof BusinessConfig)[] = [
      'airShippingRate',
      'seaShippingRate',
      'usdRate',
      'cnyRate',
      'binanceRate',
      'binanceRateSell',
      'profitMargin'
    ];
    for (const field of requiredFields) {
      const value = configRef.current[field];
      if (value === 0 || value === null || typeof value === 'undefined') {
        return false;
      }
    }
    const hasChangesResult = JSON.stringify(baseConfigRef.current) !== JSON.stringify(configRef.current);

    return hasChangesResult;
  }, [baselineVersion]); // Solo depende de baselineVersion, no de config

  // =============================
  // Sanitizadores / Validaciones
  // =============================
  const MAX_COST_INT_DIGITS = 7; // costos: hasta 7 cifras en parte entera
  const MAX_DAY_VALUE = 365;    // días: máximo 365

  const sanitizeCost = (raw: string) => {
    if (raw === '') return '';
    let v = raw.replace(/[^0-9.,]/g, '').replace(',', '.');
    const parts = v.split('.');
    let intPart = parts[0].slice(0, MAX_COST_INT_DIGITS);
    let decPart = parts[1] ? parts[1].slice(0, 2) : '';
    // Evitar que el usuario empiece con ceros largos (pero permitir 0.x)
    if (intPart.length > 1 && intPart.startsWith('0')) {
      intPart = intPart.replace(/^0+/, '') || '0';
    }
    return decPart ? `${intPart}.${decPart}` : intPart;
  };


  // Eliminada función para días de entrega

  const applySingleDay = (field: keyof BusinessConfig, raw: string) => {
    let onlyDigits = raw.replace(/\D/g, '');
    if (onlyDigits.length > 4) onlyDigits = onlyDigits.slice(0, 4);
    let num = onlyDigits === '' ? 0 : parseInt(onlyDigits, 10);
    if (num > MAX_DAY_VALUE) num = MAX_DAY_VALUE;
    updateConfig(field, num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Loading ya montado, ahora sí traducción
  if (isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('admin.management.common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ExchangeRateManager independiente */}
      <ExchangeRateManager
        onRateUpdate={handleExchangeRateUpdate}
        autoUpdate={config.auto_update_exchange_rate_cny}
      />


      {/* Header personalizado con botón de guardar */}
      <header className={mounted && theme === 'dark' ? 'bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-40' : 'bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40'}>
        <div className="px-4 md:px-5 lg:px-6 py-4">
          <div className="flex flex-col md:flex-row items-starts md:items-center justify-between gap-4 md:gap-6">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMobileMenu}
                className={`lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>

              <div>
                <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.management.header.title')}</h1>
                <p className={`text-sm md:text-base ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('admin.management.header.subtitle')}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {(lastSaved || lastAdmin) && (
                <div className={`text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  <Clock className="w-4 h-4 inline mr-1" />
                  {lastSaved && (
                    <>{t('admin.management.financial.lastSaved', { date: lastSaved.toLocaleString('es-VE') })}</>
                  )}
                  {lastAdmin && lastAdmin.id && lastAdmin.updated_at && (
                    <>
                      <span className="mx-1">|</span>
                      <span>
                        {t('admin.management.financial.changeMadeBy', {
                          userName: lastAdminName || lastAdmin.id,
                          date: new Date(lastAdmin.updated_at).toLocaleString('es-VE')
                        })}
                      </span>
                    </>
                  )}
                </div>
              )}
              <Button
                onClick={() => {

                  handleSave();
                }}
                disabled={isLoading || !hasChanges}
                className={`w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg transition-all duration-300 ${(!hasChanges || isLoading) ? 'opacity-50 cursor-not-allowed hover:shadow-lg' : 'hover:shadow-xl'}`}
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isLoading ? t('admin.management.actions.saving') : (hasChanges ? t('admin.management.actions.save') : t('admin.management.actions.save'))}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className={`w-full max-w-none space-y-6 md:space-y-8 ${mounted && theme === 'dark' ? 'bg-slate-900' : ''}`}>
        {/* Alert de advertencia */}
        <Alert className={`border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/30`}>
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className={`text-orange-800 dark:text-orange-200`}>
            <strong>{t('admin.management.warning.title')}</strong> {t('admin.management.warning.description')}
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="shipping" className="space-y-6 md:space-y-8">
          <TabsList className={`grid w-full grid-cols-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm place-items-center`}>
            <TabsTrigger value="shipping" className="flex items-center space-x-2 text-xs md:text-sm">
              <Package className="w-4 h-4" />
              <span>{t('admin.management.tabs.shipping')}</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center space-x-2 text-xs md:text-sm">
              <DollarSign className="w-4 h-4" />
              <span>{t('admin.management.tabs.financial')}</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center space-x-2 text-xs md:text-sm">
              <Activity className="w-4 h-4" />
              <span>{t('admin.management.tabs.monitoring', { fallback: 'Monitoreo' })}</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB: Configuración de Envíos */}
          <TabsContent value="shipping" className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* Envío Aéreo */}
              <Card className={`shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm`}>
                <CardHeader>
                  <CardTitle className={`flex items-center text-black dark:text-white text-base md:text-lg`}>
                    <Plane className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                    {t('admin.management.shipping.airExpress')}
                  </CardTitle>
                  <CardDescription className={`text-black dark:text-slate-300 text-sm`}>
                    {t('admin.management.shipping.airDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="airRate" className="text-sm md:text-base">{t('admin.management.shipping.ratePerKg')}</Label>
                    <div className="relative">
                      <DollarSign className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4`} />
                      <Input
                        id="airRate"
                        type="number"
                        step="0.01"
                        min={0}
                        value={config.airShippingRate}
                        onChange={(e) => applyCost('airShippingRate', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <p className={`text-xs text-slate-500 dark:text-slate-400`}>{t('admin.management.shipping.costPerKg')}</p>
                  </div>

                  <Separator />

                  {/* Eliminados campos de días de entrega para envío aéreo */}
                </CardContent>
              </Card>

              {/* Envío Marítimo */}
              <Card className={`shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm`}>
                <CardHeader>
                  <CardTitle className={`flex items-center text-black dark:text-white text-base md:text-lg`}>
                    <Ship className="w-5 h-5 mr-2 text-teal-600 dark:text-teal-400" />
                    {t('admin.management.shipping.seaEconomic')}
                  </CardTitle>
                  <CardDescription className={`text-black dark:text-slate-300 text-sm`}>
                    {t('admin.management.shipping.seaDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="seaRate" className="text-sm md:text-base">{t('admin.management.shipping.ratePerCubicMeter')}</Label>
                    <div className="relative">
                      <DollarSign className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4`} />
                      <Input
                        id="seaRate"
                        type="number"
                        step="0.01"
                        min={0}
                        value={config.seaShippingRate}
                        onChange={(e) => applyCost('seaShippingRate', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <p className={`text-xs text-slate-500 dark:text-slate-400`}>{t('admin.management.shipping.costPerCubicMeter')}</p>
                  </div>

                  <Separator />

                  {/* Eliminados campos de días de entrega para envío marítimo */}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: Configuración Financiera */}
          <TabsContent value="financial" className="space-y-6 md:space-y-8">
            {/* Margen de Ganancia - Primero */}
            <div className="w-full flex justify-center">
              <Card className={`shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm max-w-md w-full`}>
                <CardHeader>
                  <CardTitle className={`flex items-center text-black dark:text-white text-base md:text-lg`}>
                    <Percent className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
                    {t('admin.management.financial.profitMarginTitle')}
                  </CardTitle>
                  <CardDescription className={`text-black dark:text-slate-300 text-sm`}>
                    {t('admin.management.financial.profitabilityConfig')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="profit" className="text-sm md:text-base">{t('admin.management.financial.profitMargin')}</Label>
                    <Input
                      id="profit"
                      type="number"
                      min={0}
                      max={100}
                      value={config.profitMargin}
                      onChange={(e) => {
                        let value = parseFloat(e.target.value);
                        if (e.target.value === "") {
                          updateConfig('profitMargin', 0);
                          return;
                        }
                        if (isNaN(value)) value = 0;
                        if (value < 0) value = 0;
                        if (value > 100) value = 100;
                        updateConfig('profitMargin', value);
                      }}
                      className={config.profitMargin < 0 || config.profitMargin > 100 ? 'border-red-400' : ''}
                      disabled={isLoading}
                    />
                    {(config.profitMargin < 0 || config.profitMargin > 100) && (
                      <p className={`text-xs text-red-600 dark:text-red-400`}>El margen debe estar entre 0% y 100%.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Primera fila: Tasa Venezuela y Tasa China */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Tarjeta Venezuela */}
              <Card className={`shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm`}>
                <CardHeader>
                  <CardTitle className={`flex items-center text-black dark:text-white text-base md:text-lg`}>
                    <Globe className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                    {t('admin.management.financial.venezuelaRateTitle') !== 'admin.management.financial.venezuelaRateTitle' ? t('admin.management.financial.venezuelaRateTitle') : 'Tasa Venezuela'}
                  </CardTitle>
                  <CardDescription className={`text-black dark:text-slate-300 text-sm`}>
                    {t('admin.management.financial.venezuelaRateDesc') !== 'admin.management.financial.venezuelaRateDesc' ? t('admin.management.financial.venezuelaRateDesc') : 'Valor de cambio USD → Bs'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className={`space-y-3 p-4 border border-green-200 dark:border-green-800 rounded-lg bg-green-50/50 dark:bg-green-900/20`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🇻🇪</span>
                      <Label className={`text-sm font-semibold text-green-800 dark:text-green-300`}>{t('admin.management.financial.veRateLabel')}</Label>
                    </div>
                    <div className="relative">
                      <Input
                        id="usdRate"
                        type="number"
                        value={config.usdRate}
                        onChange={e => updateConfig('usdRate', Number(e.target.value))}
                        className="pr-12"
                        title={config.auto_update_exchange_rate ? "Campo bloqueado: Auto-actualización activada" : "Editar tasa manualmente"}
                        disabled={isLoading || exchangeRateLoading || config.auto_update_exchange_rate}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => refreshRate(true)}
                        disabled={isLoading || exchangeRateLoading}
                        className={`absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-slate-700`}
                        title="Actualizar tasa desde BCV"
                      >
                        {exchangeRateLoading ? (
                          <RefreshCw className={`h-4 w-4 animate-spin text-black dark:text-white`} />
                        ) : (
                          <RefreshCw className={`h-4 w-4 text-black dark:text-white`} />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between space-x-2 mt-2">
                      <div className="flex items-center space-x-2">
                        {isAutoUpdating ? (
                          <Wifi className="h-4 w-4 text-green-600" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-gray-400" />
                        )}
                        <Label htmlFor="autoUpdate" className="text-xs cursor-pointer">
                          {t('admin.management.financial.autoUpdateBCV')}
                        </Label>
                      </div>
                      <Switch
                        id="autoUpdate"
                        checked={config.auto_update_exchange_rate}
                        disabled={isLoading}
                        onCheckedChange={(checked) => {
                          if (isLoading) return;
                          setConfig(prev => ({ ...prev, auto_update_exchange_rate: checked }));
                          setBaselineVersion(v => v + 1);
                        }}
                      />
                    </div>
                    {exchangeRateLastUpdated && (
                      <div className={`text-xs text-gray-600 dark:text-slate-400 mt-2`}>
                        <div className="flex items-center justify-between">
                          <span>{t('admin.management.financial.updated')}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getTimeAgo(exchangeRateLastUpdated)}
                          </Badge>
                        </div>
                        {exchangeRateSource && (
                          <div className="flex items-center justify-between mt-1">
                            <span>{t('admin.management.financial.source')}</span>
                            <span className="font-medium">{translateSource(exchangeRateSource)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              {/* Tarjeta China */}
              <Card className={`shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm`}>
                <CardHeader>
                  <CardTitle className={`flex items-center text-black dark:text-white text-base md:text-lg`}>
                    <Globe className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                    {t('admin.management.financial.chinaRateTitle') !== 'admin.management.financial.chinaRateTitle' ? t('admin.management.financial.chinaRateTitle') : 'Tasa China'}
                  </CardTitle>
                  <CardDescription className={`text-black dark:text-slate-300 text-sm`}>
                    {t('admin.management.financial.chinaRateDesc') !== 'admin.management.financial.chinaRateDesc' ? t('admin.management.financial.chinaRateDesc') : 'Valor de cambio USD → CNY'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className={`space-y-3 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-900/20`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🇨🇳</span>
                      <Label className={`text-sm font-semibold text-red-800 dark:text-red-300`}>{t('admin.management.financial.cnRateLabel')}</Label>
                    </div>
                    <div className="relative">
                      <Input
                        id="cnyRate"
                        type="number"
                        step="0.0001"
                        min={0}
                        value={config.auto_update_exchange_rate_cny ?
                          (currentExchangeRateCNY !== null ? currentExchangeRateCNY : '') :
                          config.cnyRate}
                        onChange={(e) => applyCost('cnyRate', e.target.value)}
                        className={exchangeRateErrorCNY ? 'border-red-300 pr-12' : 'pr-12'}
                        disabled={isLoading || exchangeRateLoadingCNY || config.auto_update_exchange_rate_cny}
                        placeholder="7.2500"
                        title={config.auto_update_exchange_rate_cny ? "Campo bloqueado: Auto-actualización activada" : "Editar tasa manualmente"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={refreshRateCNY}
                        disabled={isLoading || exchangeRateLoadingCNY}
                        className={`absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-slate-700`}
                        title="Actualizar tasa desde API"
                      >
                        {exchangeRateLoadingCNY ? (
                          <RefreshCw className={`h-4 w-4 animate-spin text-black dark:text-white`} />
                        ) : (
                          <RefreshCw className={`h-4 w-4 text-black dark:text-white`} />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between space-x-2 mt-2">
                      <div className="flex items-center space-x-2">
                        {isAutoUpdatingCNY ? (
                          <Wifi className="h-4 w-4 text-green-600" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-gray-400" />
                        )}
                        <Label htmlFor="autoUpdateCNY" className="text-xs cursor-pointer">
                          {t('admin.management.financial.autoUpdateAPI')}
                        </Label>
                      </div>
                      <Switch
                        id="autoUpdateCNY"
                        checked={config.auto_update_exchange_rate_cny}
                        disabled={isLoading}
                        onCheckedChange={(checked) => {
                          if (isLoading) return;
                          setConfig(prev => ({ ...prev, auto_update_exchange_rate_cny: checked }));
                          setBaselineVersion(v => v + 1);
                        }}
                      />
                    </div>
                    {exchangeRateLastUpdatedCNY && (
                      <div className={`text-xs text-gray-600 dark:text-slate-400 mt-2`}>
                        <div className="flex items-center justify-between">
                          <span>{t('admin.management.financial.updated')}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getTimeAgo(exchangeRateLastUpdatedCNY)}
                          </Badge>
                        </div>
                        {exchangeRateSourceCNY && (
                          <div className="flex items-center justify-between mt-1">
                            <span>{t('admin.management.financial.source')}</span>
                            <span className="font-medium">{translateSource(exchangeRateSourceCNY)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Segunda fila: Tasa Binance y Margen de Ganancia */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-6">
              {/* Tarjeta Binance */}
              <Card className={`shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm`}>
                <CardHeader>
                  <CardTitle className={`flex items-center text-black dark:text-white text-base md:text-lg`}>
                    <Globe className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                    {t('admin.management.financial.binanceRateTitle')} (Compra)
                  </CardTitle>
                  <CardDescription className={`text-black dark:text-slate-300 text-sm`}>
                    {t('admin.management.financial.binanceRateBuyDesc') !== 'admin.management.financial.binanceRateBuyDesc'
                      ? t('admin.management.financial.binanceRateBuyDesc')
                      : 'Tasa de compra VES → USDT (5 ofertas más altas)'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className={`space-y-3 p-4 border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50/50 dark:bg-orange-900/20`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🪙</span>
                      <Label className={`text-sm font-semibold text-orange-800 dark:text-orange-300`}>Tasa STABLECOIN</Label>
                    </div>
                    <div className="relative">
                      <Input
                        id="binanceRate"
                        type="number"
                        step="0.01"
                        min={0}
                        value={config.auto_update_binance_rate ?
                          (currentExchangeRateBinance !== null ? parseFloat(currentExchangeRateBinance.toFixed(2)) : '') :
                          config.binanceRate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setConfig(prev => ({ ...prev, binanceRate: val }));
                          setBaselineVersion(v => v + 1);
                        }}
                        className={exchangeRateErrorBinance ? 'border-red-300 pr-12' : 'pr-12'}
                        disabled={isLoading || exchangeRateLoadingBinance || config.auto_update_binance_rate}
                        placeholder="299.51"
                        title={config.auto_update_binance_rate ? "Campo bloqueado: Auto-actualización activada" : "Editar tasa manualmente"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => refreshRateBinance()}
                        disabled={isLoading || exchangeRateLoadingBinance}
                        className={`absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-slate-700`}
                        title="Actualizar tasa desde STABLECOIN"
                      >
                        {exchangeRateLoadingBinance ? (
                          <RefreshCw className={`h-4 w-4 animate-spin text-black dark:text-white`} />
                        ) : (
                          <RefreshCw className={`h-4 w-4 text-black dark:text-white`} />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between space-x-2 mt-2">
                      <div className="flex items-center space-x-2">
                        {isAutoUpdatingBinance ? (
                          <Wifi className="h-4 w-4 text-green-600" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-gray-400" />
                        )}
                        <Label htmlFor="autoUpdateBinance" className="text-xs cursor-pointer">
                          {t('admin.management.financial.autoUpdateBinance') !== 'admin.management.financial.autoUpdateBinance'
                            ? t('admin.management.financial.autoUpdateBinance')
                            : 'Actualización automática Binance'}
                        </Label>
                      </div>
                      <Switch
                        id="autoUpdateBinance"
                        checked={config.auto_update_binance_rate}
                        disabled={isLoading}
                        onCheckedChange={(checked) => {
                          if (isLoading) return;
                          setConfig(prev => ({ ...prev, auto_update_binance_rate: checked }));
                          setBaselineVersion(v => v + 1);
                        }}
                      />
                    </div>
                    {exchangeRateLastUpdatedBinance && (
                      <div className={`text-xs text-gray-600 dark:text-slate-400 mt-2`}>
                        <div className="flex items-center justify-between">
                          <span>{t('admin.management.financial.updated')}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getTimeAgo(exchangeRateLastUpdatedBinance)}
                          </Badge>
                        </div>
                        {exchangeRateSourceBinance && (
                          <div className="flex items-center justify-between mt-1">
                            <span>{t('admin.management.financial.source')}</span>
                            <span className="font-medium">{translateSource(exchangeRateSourceBinance)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Calculadora de Conversión USDT → VES */}
                    <div className={`mt-4 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-lg`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className={`w-5 h-5 text-orange-600 dark:text-orange-400`} />
                        <h4 className={`text-sm font-semibold text-orange-900 dark:text-orange-200`}>{t('admin.management.financial.calculadoraTitle')}</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Input USDT */}
                        <div className="space-y-2">
                          <Label htmlFor="usdtCalc" className={`text-xs text-orange-800 dark:text-orange-300`}>{t('admin.management.financial.calculadoraCantidadUSDT')}</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-orange-600 font-semibold">₮</span>
                            <Input
                              id="usdtCalc"
                              type="number"
                              step="0.01"
                              min={0}
                              value={usdtAmount}
                              onChange={(e) => setUsdtAmount(parseFloat(e.target.value) || 0)}
                              className="pl-8 border-orange-300 focus:border-orange-500 focus:ring-orange-500"
                            />
                          </div>
                        </div>

                        {/* Output VES */}
                        <div className="space-y-2">
                          <Label className={`text-xs text-orange-800 dark:text-orange-300`}>{t('admin.management.financial.calculadoraEquivalenteVES')}</Label>
                          <div className="relative">
                            <div className={`flex items-center h-10 px-3 bg-white dark:bg-slate-700 border border-orange-300 dark:border-orange-700 rounded-md`}>
                              <span className={`text-lg font-bold text-orange-600 dark:text-orange-400`}>
                                {(usdtAmount * (config.auto_update_binance_rate ? (currentExchangeRateBinance || config.binanceRate) : config.binanceRate)).toLocaleString('es-VE', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })} Bs
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info adicional */}
                      <div className={`mt-3 pt-3 border-t border-orange-200 dark:border-orange-800`}>
                        <p className={`text-xs text-orange-700 dark:text-orange-300`}>
                          📊 {t('admin.management.financial.calculadoraUsandoTasa')} <span className="font-semibold">{config.auto_update_binance_rate ? (currentExchangeRateBinance !== null ? currentExchangeRateBinance.toFixed(2) : config.binanceRate.toFixed(2)) : config.binanceRate.toFixed(2)} Bs/USDT</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tarjeta Binance VENTA */}
              <Card className={`shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm`}>
                <CardHeader>
                  <CardTitle className={`flex items-center text-black dark:text-white text-base md:text-lg`}>
                    <Globe className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                    {t('admin.management.financial.binanceRateTitle')} (Venta)
                  </CardTitle>
                  <CardDescription className={`text-black dark:text-slate-300 text-sm`}>
                    {t('admin.management.financial.binanceRateSellDesc') !== 'admin.management.financial.binanceRateSellDesc'
                      ? t('admin.management.financial.binanceRateSellDesc')
                      : 'Tasa de venta USDT → VES (5 ofertas más altas)'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className={`space-y-3 p-4 border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50/50 dark:bg-orange-900/20`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🪙</span>
                      <Label className={`text-sm font-semibold text-orange-800 dark:text-orange-300`}>Tasa STABLECOIN</Label>
                    </div>
                    <div className="relative">
                      <Input
                        id="binanceRateSell"
                        type="number"
                        step="0.01"
                        min={0}
                        value={config.auto_update_binance_rate_sell ?
                          (currentExchangeRateBinanceSell !== null ? parseFloat(currentExchangeRateBinanceSell.toFixed(2)) : '') :
                          config.binanceRateSell}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setConfig(prev => ({ ...prev, binanceRateSell: val }));
                          setBaselineVersion(v => v + 1);
                        }}
                        className={exchangeRateErrorBinanceSell ? 'border-red-300 pr-12' : 'pr-12'}
                        disabled={isLoading || exchangeRateLoadingBinanceSell || config.auto_update_binance_rate_sell}
                        placeholder="299.51"
                        title={config.auto_update_binance_rate_sell ? "Campo bloqueado: Auto-actualización activada" : "Editar tasa manualmente"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => refreshRateBinanceSell()}
                        disabled={isLoading || exchangeRateLoadingBinanceSell}
                        className={`absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-slate-700`}
                        title="Actualizar tasa de venta desde STABLECOIN"
                      >
                        {exchangeRateLoadingBinanceSell ? (
                          <RefreshCw className={`h-4 w-4 animate-spin text-black dark:text-white`} />
                        ) : (
                          <RefreshCw className={`h-4 w-4 text-black dark:text-white`} />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between space-x-2 mt-2">
                      <div className="flex items-center space-x-2">
                        {isAutoUpdatingBinanceSell ? (
                          <Wifi className="h-4 w-4 text-green-600" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-gray-400" />
                        )}
                        <Label htmlFor="autoUpdateBinanceSell" className="text-xs cursor-pointer">
                          {t('admin.management.financial.autoUpdateBinanceSell') !== 'admin.management.financial.autoUpdateBinanceSell'
                            ? t('admin.management.financial.autoUpdateBinanceSell')
                            : 'Actualización automática Binance [Venta]'}
                        </Label>
                      </div>
                      <Switch
                        id="autoUpdateBinanceSell"
                        checked={config.auto_update_binance_rate_sell}
                        disabled={isLoading}
                        onCheckedChange={(checked) => {
                          if (isLoading) return;
                          setConfig(prev => ({ ...prev, auto_update_binance_rate_sell: checked }));
                          setBaselineVersion(v => v + 1);
                        }}
                      />
                    </div>
                    {exchangeRateLastUpdatedBinanceSell && (
                      <div className={`text-xs text-gray-600 dark:text-slate-400 mt-2`}>
                        <div className="flex items-center justify-between">
                          <span>{t('admin.management.financial.updated')}</span>
                          <Badge variant="secondary" className="text-xs">
                            {getTimeAgo(exchangeRateLastUpdatedBinanceSell)}
                          </Badge>
                        </div>
                        {exchangeRateSourceBinanceSell && (
                          <div className="flex items-center justify-between mt-1">
                            <span>{t('admin.management.financial.source')}</span>
                            <span className="font-medium">{translateSource(exchangeRateSourceBinanceSell)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Calculadora de Conversión USDT → VES (Venta) */}
                    <div className={`mt-4 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-lg`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className={`w-5 h-5 text-orange-600 dark:text-orange-400`} />
                        <h4 className={`text-sm font-semibold text-orange-900 dark:text-orange-200`}>{t('admin.management.financial.calculadoraTitle')}</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Input USDT */}
                        <div className="space-y-2">
                          <Label htmlFor="usdtCalcSell" className={`text-xs text-orange-800 dark:text-orange-300`}>{t('admin.management.financial.calculadoraCantidadUSDT')}</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-orange-600 font-semibold">₮</span>
                            <Input
                              id="usdtCalcSell"
                              type="number"
                              step="0.01"
                              min={0}
                              value={usdtAmountSell}
                              onChange={(e) => setUsdtAmountSell(parseFloat(e.target.value) || 0)}
                              className="pl-8 border-orange-300 focus:border-orange-500 focus:ring-orange-500"
                            />
                          </div>
                        </div>

                        {/* Output VES */}
                        <div className="space-y-2">
                          <Label className={`text-xs text-orange-800 dark:text-orange-300`}>{t('admin.management.financial.calculadoraEquivalenteVES')}</Label>
                          <div className="relative">
                            <div className={`flex items-center h-10 px-3 bg-white dark:bg-slate-700 border border-orange-300 dark:border-orange-700 rounded-md`}>
                              <span className={`text-lg font-bold text-orange-600 dark:text-orange-400`}>
                                {(usdtAmountSell * (config.auto_update_binance_rate_sell ? (currentExchangeRateBinanceSell || config.binanceRateSell) : config.binanceRateSell)).toLocaleString('es-VE', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })} Bs
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Info adicional */}
                      <div className={`mt-3 pt-3 border-t border-orange-200 dark:border-orange-800`}>
                        <p className={`text-xs text-orange-700 dark:text-orange-300`}>
                          📊 {t('admin.management.financial.calculadoraUsandoTasa')} <span className="font-semibold">{config.auto_update_binance_rate_sell ? (currentExchangeRateBinanceSell !== null ? currentExchangeRateBinanceSell.toFixed(2) : config.binanceRateSell.toFixed(2)) : config.binanceRateSell.toFixed(2)} Bs/USDT</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alert azul debajo de las tasas */}
            <div className="mt-4">
              <Alert className={`border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30`}>
                <CheckCircle className={`h-4 w-4 text-blue-600 dark:text-blue-400`} />
                <AlertDescription className={`text-blue-700 dark:text-blue-200`}>
                  <div dangerouslySetInnerHTML={{ __html: t('admin.management.financial.configurationAlert') }} />
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          {/* TAB: Monitoreo de APIs */}
          <TabsContent value="monitoring" className="space-y-6 md:space-y-8">
            <ApiHealthMonitor />
          </TabsContent>

          {/* Opción Seguridad eliminada */}
        </Tabs>

        {/* Panel de Resumen */}
        <Card className={`shadow-lg border-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm`}>
          <CardHeader>
            <CardTitle className={`flex items-center text-black dark:text-white text-base md:text-lg`}>
              <Calculator className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              {t('admin.management.summary.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
              <div className={`text-center p-3 bg-white dark:bg-slate-700 rounded-lg`}>
                <p className={`text-slate-600 dark:text-slate-300`}>{t('admin.management.summary.airShipping')}</p>
                <p className={`font-bold text-blue-600 dark:text-blue-400`}>{formatCurrency(config.airShippingRate)}/kg</p>
              </div>
              <div className={`text-center p-3 bg-white dark:bg-slate-700 rounded-lg`}>
                <p className={`text-slate-600 dark:text-slate-300`}>{t('admin.management.summary.seaShipping')}</p>
                <p className={`font-bold text-teal-600 dark:text-teal-400`}>{formatCurrency(config.seaShippingRate)}/m³</p>
              </div>
              <div className={`text-center p-3 bg-white dark:bg-slate-700 rounded-lg`}>
                <p className={`text-slate-600 dark:text-slate-300`}>🇻🇪 USD → Bs</p>
                <p className={`font-bold text-green-600 dark:text-green-400`}>{config.auto_update_exchange_rate ? (currentExchangeRate || config.usdRate) : config.usdRate} Bs</p>
              </div>
              <div className={`text-center p-3 bg-white dark:bg-slate-700 rounded-lg`}>
                <p className={`text-slate-600 dark:text-slate-300`}>🇨🇳 USD → CNY</p>
                <p className={`font-bold text-red-600 dark:text-red-400`}>{config.auto_update_exchange_rate_cny ? (currentExchangeRateCNY || config.cnyRate) : config.cnyRate} CNY</p>
              </div>
              <div className={`text-center p-3 bg-white dark:bg-slate-700 rounded-lg`}>
                <p className={`text-slate-600 dark:text-slate-300`}>🪙 VES → USDT</p>
                <p className={`font-bold text-orange-600 dark:text-orange-400`}>{config.auto_update_binance_rate ? (currentExchangeRateBinance !== null ? currentExchangeRateBinance.toFixed(2) : config.binanceRate.toFixed(2)) : config.binanceRate.toFixed(2)} Bs</p>
              </div>
              <div className={`text-center p-3 bg-white dark:bg-slate-700 rounded-lg`}>
                <p className={`text-slate-600 dark:text-slate-300`}>{t('admin.management.summary.margin')}</p>
                <p className={`font-bold text-purple-600 dark:text-purple-400`}>{config.profitMargin}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}