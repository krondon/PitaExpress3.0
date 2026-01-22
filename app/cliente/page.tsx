
"use client";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useClientContext } from '@/lib/ClientContext';
import { useClientOrders } from '@/hooks/use-client-orders';
import { useTheme } from 'next-themes';
import dynamicImport from 'next/dynamic';
import { useClientLayoutContext } from '@/lib/ClientLayoutContext';
import Header from '@/components/layout/Header';
import { useNotifications } from '@/hooks/use-notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  DollarSign,
  Star,
  ShoppingCart,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Calendar,
  MapPin,
  User,
  Shield,
  Zap
} from 'lucide-react';
import Link from 'next/link';

// Lazy load components
const QuickActions = dynamicImport(() => import('@/components/dashboard/QuickActions'), {
  loading: () => <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-24 bg-slate-200 animate-pulse rounded-lg" />
    ))}
  </div>
});

const RecentOrders = dynamicImport(() => import('@/components/dashboard/RecentOrders'), {
  loading: () => <div className="space-y-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-16 bg-slate-200 animate-pulse rounded-lg" />
    ))}
  </div>
});

// Datos mock para el cliente
const CLIENT_STATS = {
  totalOrders: 12,
  pendingOrders: 3,
  completedOrders: 8,
  totalSpent: 4850,
  activeShipments: 2
};

import { useTranslation } from '@/hooks/useTranslation';

import { TFunction } from '@/hooks/useTranslation';
const QUICK_ACTIONS = (t: TFunction) => ([
  {
    id: 'new_order',
    title: t('client.quickActions.newOrder'),
    description: t('client.quickActions.newOrderDesc'),
    icon: ShoppingCart,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-600',
    hoverBg: 'hover:bg-blue-50',
    hoverBorder: 'hover:border-blue-300',
    href: '/cliente/mis-pedidos'
  }
]);

const RECENT_ORDERS = [
  {
    id: 'ORD-2024-001',
    productName: 'IPHONE 15 PRO MAX',
    status: 'EN TRANSITO',
    progress: 75,
    estimatedDelivery: '2024-01-20',
    price: 1319,
    trackingNumber: 'TRK-123456789',
    statusColor: 'bg-orange-100 text-orange-800 border-orange-200',
    progressColor: 'bg-orange-500',
    icon: Truck
  },
  {
    id: 'ORD-2024-002',
    productName: 'MACBOOK AIR M2',
    status: 'PROCESANDO',
    progress: 45,
    estimatedDelivery: '2024-01-25',
    price: 1199,
    trackingNumber: 'TRK-987654321',
    statusColor: 'bg-blue-100 text-blue-800 border-blue-200',
    progressColor: 'bg-blue-500',
    icon: Package
  },
  {
    id: 'ORD-2024-003',
    productName: 'AIRPODS PRO',
    status: 'ENTREGADO',
    progress: 100,
    estimatedDelivery: '2024-01-15',
    price: 249,
    trackingNumber: 'TRK-456789123',
    statusColor: 'bg-green-100 text-green-800 border-green-200',
    progressColor: 'bg-green-500',
    icon: CheckCircle
  }
];

export default function DashboardPage() {
  const { t } = useTranslation();
  // Hooks al inicio y en orden estable
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  const { toggleMobileMenu } = useClientLayoutContext();

  // Obtener el id del cliente autenticado
  const { clientId } = useClientContext();
  const { uiItems: notificationsList, unreadCount, markAllAsRead } = useNotifications({ role: 'client', userId: clientId, limit: 10, enabled: !!clientId });
  // Obtener los pedidos del cliente autenticado
  const { data: clientOrders, loading: ordersLoading, error: ordersError } = useClientOrders();

  // Variables de pedidos
  const totalPedidos = clientOrders?.length ?? 0;
  const pedidosPendientes = clientOrders?.filter(order => order.state >= 1 && order.state <= 5).length ?? 0;
  const pedidosEnTransito = clientOrders?.filter(order => order.state >= 6 && order.state <= 12).length ?? 0;
  const pedidosCompletados = clientOrders?.filter(order => order.state === 13).length ?? 0;
  const totalGastado = clientOrders?.filter(order => order.state >= 4).reduce((acc, order) => acc + (order.totalQuote || 0), 0) ?? 0;

  // Datos de los 3 pedidos más recientes
  const pedidosRecientes = clientOrders?.slice(-3).reverse() ?? [];
  const orderId = pedidosRecientes.map(order => order.id);
  const orderName = pedidosRecientes.map(order => order.productName);

  const orderStatus = pedidosRecientes.map(order => order.state);

  // Helper para formatear números grandes de forma compacta (ej. 38.7B, 1.5M)
  const formatCompactMoney = (amount: number) => {
    // Si es menor a 1 millón, usar formato estándar con 2 decimales
    if (amount < 1_000_000) {
      return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Si es billón (Billion) o más (1,000,000,000)
    if (amount >= 1_000_000_000) {
      return `$${(amount / 1_000_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}B`;
    }

    // Si es millón (Million) o más
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
    }

    return `$${amount.toLocaleString()}`;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mapea el estado numérico a un estado textual (coincide con Mis Pedidos)
  const mapStateToStatus = (state?: number | null): 'pending' | 'quoted' | 'processing' | 'shipped' | 'delivered' | 'cancelled' => {
    if (!state) return 'pending';
    if (state === 3) return 'quoted';
    if (state >= 4 && state <= 7) return 'processing';
    if (state === 8 || state === 9) return 'shipped';
    if (state === 10 || state === 11 || state === 12) return 'processing';
    if (state >= 13) return 'delivered';
    if (state === 2) return 'pending';
    return 'pending';
  };

  // Estilos para el badge según el estado textual (coincide con Mis Pedidos)
  const getStatusColor = (status: string) => {
    const isDark = mounted && theme === 'dark';
    switch (status) {
      case 'pending':
        return isDark ? 'bg-gradient-to-r from-yellow-900/30 to-yellow-800/30 text-yellow-300 border-yellow-700 shadow-sm transition-colors hover:from-yellow-900/50 hover:to-yellow-800/50 hover:ring-1 hover:ring-yellow-500/20 hover:brightness-110' : 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-300 shadow-sm transition-colors hover:from-yellow-50 hover:to-yellow-100 hover:ring-1 hover:ring-yellow-200 hover:brightness-110';
      case 'quoted':
        return isDark ? 'bg-gradient-to-r from-green-900/30 to-green-800/30 text-green-300 border-green-700 shadow-sm transition-colors hover:from-green-900/50 hover:to-green-800/50 hover:ring-1 hover:ring-green-500/20 hover:brightness-110' : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-300 shadow-sm transition-colors hover:from-green-50 hover:to-green-100 hover:ring-1 hover:ring-green-200 hover:brightness-110';
      case 'processing':
        return isDark ? 'bg-gradient-to-r from-blue-900/30 to-blue-800/30 text-blue-300 border-blue-700 shadow-sm transition-colors hover:from-blue-900/50 hover:to-blue-800/50 hover:ring-1 hover:ring-blue-500/20 hover:brightness-110' : 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-300 shadow-sm transition-colors hover:from-blue-50 hover:to-blue-100 hover:ring-1 hover:ring-blue-200 hover:brightness-110';
      case 'shipped':
        return isDark ? 'bg-gradient-to-r from-purple-900/30 to-purple-800/30 text-purple-300 border-purple-700 shadow-sm transition-colors hover:from-purple-900/50 hover:to-purple-800/50 hover:ring-1 hover:ring-purple-500/20 hover:brightness-110' : 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-300 shadow-sm transition-colors hover:from-purple-50 hover:to-purple-100 hover:ring-1 hover:ring-purple-200 hover:brightness-110';
      case 'delivered':
        return isDark ? 'bg-gradient-to-r from-emerald-900/30 to-emerald-800/30 text-emerald-300 border-emerald-700 shadow-sm transition-colors hover:from-emerald-900/50 hover:to-emerald-800/50 hover:ring-1 hover:ring-emerald-500/20 hover:brightness-110' : 'bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border-emerald-300 shadow-sm transition-colors hover:from-emerald-50 hover:to-emerald-100 hover:ring-1 hover:ring-emerald-200 hover:brightness-110';
      case 'cancelled':
        return isDark ? 'bg-gradient-to-r from-red-900/30 to-red-800/30 text-red-300 border-red-700 shadow-sm transition-colors hover:from-red-900/50 hover:to-red-800/50 hover:ring-1 hover:ring-red-500/20 hover:brightness-110' : 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-red-300 shadow-sm transition-colors hover:from-red-50 hover:to-red-100 hover:ring-1 hover:ring-red-200 hover:brightness-110';
      default:
        return isDark ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-slate-300 border-slate-600 shadow-sm transition-colors hover:from-slate-600 hover:to-slate-500 hover:ring-1 hover:ring-slate-500/20 hover:brightness-110' : 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 border-slate-300 shadow-sm transition-colors hover:from-slate-50 hover:to-slate-100 hover:ring-1 hover:ring-slate-200 hover:brightness-110';
    }
  };

  const getStatusText = (status: string) => t(`client.recentOrders.statuses.${status}`) || status;



  // Pantalla de carga hasta que se monte (evita desajustes con theme/SSR)
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600" suppressHydrationWarning>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        notifications={unreadCount || 0}
        onMenuToggle={toggleMobileMenu}
        title={t('client.dashboard.title')}
        subtitle={t('client.dashboard.subtitle')}
        notificationsItems={notificationsList.filter(n => n.unread)}
        onMarkAllAsRead={async () => { await markAllAsRead(); }}
      />

      <div className="p-4 md:p-5 lg:p-6 space-y-6 md:space-y-6 lg:space-y-8">
        {/* Header del Dashboard con Bienvenida */}
        <div className={`rounded-xl p-4 md:p-6 lg:p-8 text-white relative overflow-hidden ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-blue-900 via-blue-800 to-orange-900' : 'bg-gradient-to-r from-blue-500 via-blue-600 to-orange-500'}`}>
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
              <div>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2">{t('client.dashboard.welcome')}</h2>
                <p className={`text-sm md:text-base lg:text-lg ${mounted && theme === 'dark' ? 'text-blue-200' : 'text-blue-100'}`}>{t('client.dashboard.panel')}</p>
                <p className={`mt-2 text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-200'}`}>{t('client.dashboard.manage')}</p>
              </div>
              <div className="grid grid-cols-1 md:flex md:items-center md:space-x-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl lg:text-4xl font-bold">{pedidosEnTransito + pedidosPendientes}</div>
                  <p className={`text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-blue-200' : 'text-blue-100'}`}>{t('client.dashboard.activeShipments')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Principal */}
        <div className="space-y-6 md:space-y-6 lg:space-y-8">
          {/* Estadísticas Principales */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 lg:gap-6">
            <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-blue-800'}`}>{t('client.dashboard.totalOrders')}</CardTitle>
                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'}`}>
                  <Package className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>{totalPedidos}</div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-blue-700'}`}>{t('client.dashboard.ordersPlaced')}</p>
                <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-200'}`}>
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `100%` }}></div>
                </div>
              </CardContent>
            </Card>

            <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-orange-50 border-orange-200'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-orange-800'}`}>{t('client.dashboard.pending')}</CardTitle>
                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-orange-600' : 'bg-orange-500'}`}>
                  <Clock className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-orange-300' : 'text-orange-900'}`}>{pedidosPendientes}</div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-orange-700'}`}>{t('client.dashboard.ordersInProcess')}</p>
                <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-200'}`}>
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${(pedidosPendientes / totalPedidos) * 100}%` }}></div>
                </div>
              </CardContent>
            </Card>

            <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-blue-800'}`}>{t('client.dashboard.inTransit')}</CardTitle>
                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'}`}>
                  <Truck className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>{pedidosEnTransito}</div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-blue-700'}`}>{t('client.dashboard.activeShipmentsShort')}</p>
                <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-200'}`}>
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(pedidosEnTransito / totalPedidos) * 100}%` }}></div>
                </div>
              </CardContent>
            </Card>

            <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-orange-50 border-orange-200'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-orange-800'}`}>{t('client.dashboard.completed')}</CardTitle>
                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-orange-600' : 'bg-orange-500'}`}>
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-orange-300' : 'text-orange-900'}`}>{pedidosCompletados}</div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-orange-700'}`}>{t('client.dashboard.ordersDelivered')}</p>
                <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-200'}`}>
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${(pedidosCompletados / totalPedidos) * 100}%` }}></div>
                </div>
              </CardContent>
            </Card>

            <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-blue-800'}`}>{t('client.dashboard.totalSpent')}</CardTitle>
                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'}`}>
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}
                  title={`$${totalGastado.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                >
                  {formatCompactMoney(totalGastado)}
                </div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-blue-700'}`}>{t('client.dashboard.totalInvestment')}</p>
                <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-200'}`}>
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `100%` }}></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Acciones Rápidas */}
          <Card className={`backdrop-blur-sm hover:shadow-lg transition-shadow ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
            <CardHeader>
              <CardTitle className={`text-xl font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('client.quickActions.title')}</CardTitle>
              <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.quickActions.subtitle')}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
                {QUICK_ACTIONS(t).map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.id} href={action.href}>
                      <Button variant="outline" className={`h-20 md:h-24 flex flex-col gap-2 md:gap-3 ${action.hoverBg} ${action.hoverBorder} transition-all duration-300 group w-full ${mounted && theme === 'dark' ? 'border-slate-600 hover:bg-slate-700' : ''}`}>
                        <div className={`p-2 md:p-3 ${action.bgColor} rounded-lg group-hover:scale-110 transition-all duration-300`}>
                          <Icon className={`h-6 w-6 md:h-8 md:w-8 ${action.textColor}`} />
                        </div>
                        <span className={`text-xs md:text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{action.title}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* MIS PEDIDOS */}
          <Card className={`backdrop-blur-sm hover:shadow-lg transition-shadow ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
            <CardHeader>
              <CardTitle className={`text-xl font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('client.recentOrders.title')}</CardTitle>
              <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.subtitle')}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {pedidosRecientes.length === 0 ? (
                  <div className={`text-center ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('client.recentOrders.noOrders')}</div>
                ) : (
                  pedidosRecientes.map((order, idx) => (
                    <div key={order.id} className={`border rounded-xl p-4 md:p-6 hover:shadow-lg transition-all duration-300 ${mounted && theme === 'dark' ? 'border-slate-600 bg-gradient-to-r from-slate-700 to-slate-600' : 'border-slate-200 bg-gradient-to-r from-slate-50 to-white'}`}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`p-2 md:p-3 rounded-lg ${mounted && theme === 'dark' ? 'bg-slate-600' : 'bg-slate-100'}`}>
                            <Truck className={`h-5 w-5 md:h-6 md:w-6 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} />
                          </div>
                          <div>
                            <p className={`font-bold text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{order.id}</p>
                            <p className={`font-semibold text-lg md:text-xl ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{order.productName}</p>
                          </div>
                        </div>
                        <Badge className={`${getStatusColor(mapStateToStatus(order.state))} font-medium border text-xs md:text-sm`}>
                          {getStatusText(mapStateToStatus(order.state))}
                        </Badge>
                      </div>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs md:text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{t('client.recentOrders.budget')}</span>
                          <span className={`text-xs md:text-sm font-bold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>${order.estimatedBudget?.toLocaleString() ?? 'N/A'}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className={`w-full transition-all duration-300 group text-xs md:text-sm ${mounted && theme === 'dark' ? 'hover:bg-slate-700 hover:border-slate-600 border-slate-600' : 'hover:bg-blue-50 hover:border-blue-300'}`}
                        onClick={() => window.location.href = '/cliente/mis-pedidos'}
                      >
                        <span className="group-hover:scale-105 transition-transform">{t('client.recentOrders.details')}</span>
                        <ArrowRight className="ml-2 h-3 w-3 md:h-4 md:w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}