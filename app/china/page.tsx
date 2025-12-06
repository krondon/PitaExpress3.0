"use client";

// Force dynamic rendering
export const dynamic = 'force-dynamic';
import "../animations/animations.css";
import { useState, useEffect, useCallback } from "react";
import { useChinaOrders } from '@/hooks/use-china-orders';
import { useClientsInfo } from '@/hooks/use-clients-info';
import { useChinaContext } from '@/lib/ChinaContext';
import { useTheme } from "next-themes";
import { useRealtimeChina } from '@/hooks/use-realtime-china';
import { useNotifications } from '@/hooks/use-notifications';
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  ShoppingCart,
  Truck,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  DollarSign,
  MapPin,
  FileText,
  Flag,
  MessageSquare,
  Star,
  Phone,
  Users,
  TrendingUp,
  Calculator,
  Eye,
  Send,
  RefreshCw,
  Download,
  Share2,
  Edit,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Tipos
interface PendingOrder {
  id: string;
  clientName: string;
  clientId: string;
  product: string;
  description: string;
  quantity: number;
  specifications: string;
  supplier: string;
  receivedDate: string;
  status: 'pending' | 'processing' | 'shipped' | 'completed';
  priority: 'low' | 'medium' | 'high';
  estimatedDelivery?: string;
  finalPrice?: number;
  currency?: 'USD' | 'CNY';
}

interface ProcessingOrder {
  id: string;
  clientName: string;
  clientId: string;
  product: string;
  quantity: number;
  supplier: string;
  processingTime: string;
  status: 'processing' | 'quality_check' | 'packaging' | 'ready_to_ship';
  priority: 'low' | 'medium' | 'high';
  estimatedCompletion: string;
}

interface WarehouseItem {
  id: string;
  product: string;
  quantity: number;
  supplier: string;
  location: string;
  lastUpdated: string;
  status: 'available' | 'reserved' | 'low_stock' | 'out_of_stock';
}

import { useTranslation } from '@/hooks/useTranslation';

export default function ChinaDashboard() {
  const { t } = useTranslation();
  // Estado para forzar actualización del componente
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const router = useRouter();
  // Obtener el id del empleado de China autenticado (debe declararse antes de usarlo en callbacks)
  const { chinaId } = useChinaContext();

  // Pedidos asignados al empleado China autenticado
  const { data: chinaOrders, loading: ordersLoading, error: ordersError, refetch: refetchChinaOrders } = useChinaOrders(refreshTrigger);
  // Pending count como en /china/pedidos: mismo mapeo y misma fuente (pedidos asignados al usuario)
  function mapStateToEstado(state: number) {
    if (state >= 5 && state <= 8) return 'enviado';
    if (state === 4) return 'procesando';
    if (state === 3) return 'cotizado';
    if (state === 2) return 'pendiente';
    // Fallback igual que en /china/pedidos
    return 'pendiente';
  }
  const [pendingFromPedidos, setPendingFromPedidos] = useState(0);
  const fetchAssignedPedidosPending = useCallback(async () => {
    try {
      if (!chinaId) { setPendingFromPedidos(0); return; }
      const res = await fetch(`/china/pedidos/api/orders?asignedEChina=${chinaId}`);
      const data = await res.json();
      if (!Array.isArray(data)) { setPendingFromPedidos(0); return; }
      const count = data
        .map((order: any) => ({ state: order.state }))
        .map(o => mapStateToEstado(Number(o.state || 0)))
        .filter(estado => estado === 'pendiente')
        .length;
      setPendingFromPedidos(count);
    } catch {
      setPendingFromPedidos(0);
    }
  }, [chinaId]);
  // Obtener información de los clientes
  const { data: clientsInfo } = useClientsInfo();
  // Nombres de los clientes de los 3 pedidos más recientes
  const pedidosRecientes = (chinaOrders ?? []).slice(-3).reverse();
  const nombresClientesRecientes = pedidosRecientes.map((order: any) =>
    clientsInfo?.find((client: any) => client.user_id === order.client_id)?.name ?? order.client_id
  );



  // Notificaciones para China (per-user read)
  const { uiItems: notificationsList, unreadCount, markAllAsRead, markOneAsRead } = useNotifications({ role: 'china', userId: chinaId, limit: 10, enabled: true });

  // Función para actualizar pedidos en realtime
  const handleOrdersUpdate = useCallback(() => {

    refetchChinaOrders();
  }, [refetchChinaOrders]);

  // Usar realtime para China
  useRealtimeChina(handleOrdersUpdate, chinaId);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  // Fallback: refresco periódico ligero para robustez (10s)
  useEffect(() => {
    if (!chinaId) return;
    const id = setInterval(() => {
      refetchChinaOrders();
      fetchAssignedPedidosPending();
    }, 10000);
    return () => clearInterval(id);
  }, [chinaId, refetchChinaOrders, fetchAssignedPedidosPending]);

  // Cargar al montar
  useEffect(() => {
    fetchAssignedPedidosPending();
  }, [fetchAssignedPedidosPending]);

  // Badges estandarizados para pedidos según estado numérico
  function getOrderBadge(stateNum?: number) {
    const s = Number(stateNum ?? 0);
    const isDark = mounted && theme === 'dark';
    const base = 'border';
    if (s <= 0 || isNaN(s)) return { label: t('admin.orders.china.badges.unknown'), className: `${base} ${isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200'}` };
    if (s === 1) return { label: t('admin.orders.china.filters.pending'), className: `${base} ${isDark ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}` };
    if (s === 2) return { label: t('admin.orders.china.filters.pending'), className: `${base} ${isDark ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}` };
    if (s === 3) return { label: t('admin.orders.china.badges.quoted'), className: `${base} ${isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'}` };
    if (s === 4) return { label: t('admin.orders.china.badges.processing'), className: `${base} ${isDark ? 'bg-purple-900/30 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-800 border-purple-200'}` };
    if (s === 5) return { label: t('admin.orders.china.badges.readyToPack'), className: `${base} ${isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700' : 'bg-amber-100 text-amber-800 border-amber-200'}` };
    if (s === 6) return { label: t('admin.orders.china.badges.inBox'), className: `${base} ${isDark ? 'bg-indigo-900/30 text-indigo-300 border-indigo-700' : 'bg-indigo-100 text-indigo-800 border-indigo-200'}` };
    if (s === 7 || s === 8) return { label: t('admin.orders.china.badges.inContainer'), className: `${base} ${isDark ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700' : 'bg-cyan-100 text-cyan-800 border-cyan-200'}` };
    if (s >= 9) return { label: t('admin.orders.china.badges.shippedVzla'), className: `${base} ${isDark ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200'}` };
    return { label: t('admin.orders.china.badges.state', { num: s }), className: `${base} ${isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200'}` };
  }

  // Variables de pedidos
  const totalPedidos = chinaOrders?.length ?? 0;
  // Ajuste: para el panel China ignoramos state === 1 (creación) y comenzamos a contar desde 2
  // Pendientes: estado 2 (revisado Venezuela, listo para acción China)
  // Usar el mismo conteo que /china/pedidos (incluye fallback a 'pendiente' como allí)
  const pedidosPendientes = pendingFromPedidos;
  // En proceso: estados 3 y 4 (cotizaciones y proceso / pago)
  const pedidosEnProceso = chinaOrders?.filter((order: any) => order.state === 3 || order.state === 4).length ?? 0;
  // Enviados: estados 5 a 8 solamente (no incluimos >8 para mantener rango solicitado)
  const pedidosEnviados = chinaOrders?.filter((order: any) => order.state >= 5 && order.state <= 8).length ?? 0;
  const reputaciones = chinaOrders?.map((order: any) => order.reputation).filter((r: number | undefined) => typeof r === 'number') ?? [];
  const promedioReputacion = reputaciones.length > 0 ? (reputaciones.reduce((acc: number, r: number) => acc + r, 0) / reputaciones.length) : 0;
  const sumaPresupuestos = chinaOrders?.reduce((acc: number, order: any) => acc + (order.estimatedBudget || 0), 0) ?? 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Datos mock específicos para China
  const PENDING_ORDERS: PendingOrder[] = [
    {
      id: 'ORD-2024-001',
      clientName: 'María González',
      clientId: 'CL-001',
      product: 'iPhone 15 Pro Max',
      description: 'iPhone 15 Pro Max 256GB Titanio Natural',
      quantity: 1,
      specifications: 'Color: Titanio Natural, Almacenamiento: 256GB',
      supplier: 'Apple Store',
      receivedDate: '2024-01-15 10:30',
      status: 'pending',
      priority: 'high'
    },
    {
      id: 'ORD-2024-002',
      clientName: 'Carlos Pérez',
      clientId: 'CL-002',
      product: 'MacBook Air M2',
      description: 'MacBook Air M2 13" 8GB RAM 256GB SSD',
      quantity: 1,
      specifications: 'Procesador: M2, RAM: 8GB, SSD: 256GB',
      supplier: 'Apple Store',
      receivedDate: '2024-01-15 14:20',
      status: 'processing',
      priority: 'medium'
    },
    {
      id: 'ORD-2024-003',
      clientName: 'Ana Rodríguez',
      clientId: 'CL-003',
      product: 'AirPods Pro',
      description: 'AirPods Pro 2da Generación',
      quantity: 2,
      specifications: 'Con cancelación de ruido activa',
      supplier: 'Apple Store',
      receivedDate: '2024-01-15 16:45',
      status: 'shipped',
      priority: 'low',
      estimatedDelivery: '2024-02-15',
      finalPrice: 450,
      currency: 'USD'
    }
  ];

  const PROCESSING_ORDERS: ProcessingOrder[] = [
    {
      id: 'PROC-001',
      clientName: 'Luis Martínez',
      clientId: 'CL-004',
      product: 'Samsung Galaxy S24',
      quantity: 1,
      supplier: 'Samsung Store',
      processingTime: '2.3 días',
      status: 'quality_check',
      priority: 'high',
      estimatedCompletion: '2024-01-18'
    },
    {
      id: 'PROC-002',
      clientName: 'Patricia López',
      clientId: 'CL-005',
      product: 'iPad Air',
      quantity: 2,
      supplier: 'Apple Store',
      processingTime: '1.8 días',
      status: 'packaging',
      priority: 'medium',
      estimatedCompletion: '2024-01-17'
    }
  ];

  const WAREHOUSE_ITEMS: WarehouseItem[] = [
    {
      id: 'WH-001',
      product: 'iPhone 15 Pro',
      quantity: 25,
      supplier: 'Apple Store',
      location: 'Sección A-1',
      lastUpdated: '2024-01-15 09:30',
      status: 'available'
    },
    {
      id: 'WH-002',
      product: 'MacBook Air M2',
      quantity: 8,
      supplier: 'Apple Store',
      location: 'Sección B-3',
      lastUpdated: '2024-01-15 14:20',
      status: 'low_stock'
    },
    {
      id: 'WH-003',
      product: 'AirPods Pro',
      quantity: 0,
      supplier: 'Apple Store',
      location: 'Sección C-2',
      lastUpdated: '2024-01-15 16:45',
      status: 'out_of_stock'
    }
  ];

  // Estadísticas
  const stats = {
    pendingOrders: PENDING_ORDERS.filter(o => o.status === 'pending').length,
    processingOrders: PENDING_ORDERS.filter(o => o.status === 'processing').length + PROCESSING_ORDERS.length,
    shippedOrders: PENDING_ORDERS.filter(o => o.status === 'shipped').length,
    totalProducts: WAREHOUSE_ITEMS.reduce((sum, item) => sum + item.quantity, 0),
    averageProcessingTime: "2.3 días",
    warehouseCapacity: "85%",
    dailyEfficiency: "94%",
    monthlyRevenue: 125000,
    activeSuppliers: 28,
    qualityScore: "98.5%",
    onTimeDelivery: "96%",
    returnRate: "1.2%"
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'quality_check': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'packaging': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'ready_to_ship': return 'bg-green-100 text-green-800 border-green-200';
      case 'shipped': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'available': return 'bg-green-100 text-green-800 border-green-200';
      case 'reserved': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low_stock': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'out_of_stock': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'processing': return 'Procesando';
      case 'quality_check': return 'Control Calidad';
      case 'packaging': return 'Empaquetando';
      case 'ready_to_ship': return 'Listo Enviar';
      case 'shipped': return 'Enviado';
      case 'completed': return 'Completado';
      case 'available': return 'Disponible';
      case 'reserved': return 'Reservado';
      case 'low_stock': return 'Stock Bajo';
      case 'out_of_stock': return 'Sin Stock';
      default: return 'Desconocido';
    }
  };

  if (!mounted) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${mounted && theme === 'dark' ? 'border-blue-400' : 'border-blue-600'} mx-auto`}></div>
          <p className={`mt-4 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex overflow-x-hidden ${mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
      <Sidebar
        isExpanded={sidebarExpanded}
        setIsExpanded={setSidebarExpanded}
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
        userRole="china"
      />

      <main className={`flex-1 transition-all duration-300 ${sidebarExpanded ? 'lg:ml-72 lg:w-[calc(100%-18rem)]' : 'lg:ml-24 lg:w-[calc(100%-6rem)]'
        }`}>
        <Header
          notifications={unreadCount || 0}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          title={t('chinese.title')}
          subtitle={t('chinese.subtitle')}
          notificationsItems={notificationsList.filter(n => n.unread)}
          onMarkAllAsRead={async () => { await markAllAsRead(); }}
          onOpenNotifications={() => { router.push('/china/pedidos'); }}
          onItemClick={(id) => { markOneAsRead(id); }}
          notificationsRole="china"
          notificationsUserId={chinaId}
        />

        <div className="p-4 md:p-5 lg:p-6 space-y-6 md:space-y-8">
          {/* Header del Dashboard con Bienvenida */}
          <div className={`rounded-xl p-4 md:p-6 lg:p-8 text-white relative overflow-hidden ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-blue-900 via-blue-800 to-orange-900' : 'bg-gradient-to-r from-blue-500 via-blue-600 to-orange-500'}`}>
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2">{t('chinese.welcome')}</h2>
                  <p className={`text-sm md:text-base lg:text-lg ${mounted && theme === 'dark' ? 'text-blue-200' : 'text-blue-100'}`}>{t('chinese.panel')}</p>
                  <p className={`mt-2 text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-200'}`}>{t('chinese.manage')}</p>
                </div>
                <div className="flex md:hidden lg:flex items-center space-x-4 md:space-x-6">
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl lg:text-4xl font-bold">{totalPedidos}</div>
                    <p className={`text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-blue-200' : 'text-blue-100'}`}>{t('chinese.activeShipments')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Principal */}
          <div className="space-y-8">
            {/* Estadísticas Principales */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
              <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={`text-xs md:text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-blue-800'}`}>{t('chinese.pending')}</CardTitle>
                  <div className={`p-1 md:p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'}`}>
                    <Package className="h-3 w-3 md:h-4 md:w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>{pedidosPendientes}</div>
                  <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-blue-700'}`}>{t('chinese.status')}</p>
                  <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-200'}`}>
                    <div className={`h-2 rounded-full ${mounted && theme === 'dark' ? 'bg-blue-500' : 'bg-blue-500'}`} style={{ width: `${(pedidosPendientes / Math.max(1, totalPedidos)) * 100}%` }}></div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-orange-50 border-orange-200'}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={`text-xs md:text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-orange-800'}`}>{t('chinese.processing')}</CardTitle>
                  <div className={`p-1 md:p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-orange-600' : 'bg-orange-500'}`}>
                    <Clock className="h-3 w-3 md:h-4 md:w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-orange-300' : 'text-orange-900'}`}>{pedidosEnProceso}</div>
                  <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-orange-700'}`}>{t('chinese.status')}</p>
                  <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-200'}`}>
                    <div className={`h-2 rounded-full ${mounted && theme === 'dark' ? 'bg-orange-500' : 'bg-orange-500'}`} style={{ width: `${(pedidosEnProceso / totalPedidos) * 100}%` }}></div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={`text-xs md:text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-blue-800'}`}>{t('chinese.shipped')}</CardTitle>
                  <div className={`p-1 md:p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'}`}>
                    <Truck className="h-3 w-3 md:h-4 md:w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}`}>{pedidosEnviados}</div>
                  <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-blue-700'}`}>{t('chinese.inTransit')}</p>
                  <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-200'}`}>
                    <div className={`h-2 rounded-full ${mounted && theme === 'dark' ? 'bg-blue-500' : 'bg-blue-500'}`} style={{ width: `${(pedidosEnviados / totalPedidos) * 100}%` }}></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Acciones Rápidas */}
            <Card className={`backdrop-blur-sm hover:shadow-lg transition-shadow ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
              <CardHeader>
                <CardTitle className={`text-lg md:text-xl font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('chinese.quickActions')}</CardTitle>
                <p className={`text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('chinese.quickActionsSubtitle')}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <Link href="/china/pedidos">
                    <Button variant="outline" className={`h-20 md:h-24 flex flex-col gap-2 md:gap-3 transition-all duration-300 group w-full ${mounted && theme === 'dark' ? 'hover:bg-slate-700 hover:border-slate-600 border-slate-700' : 'hover:bg-blue-50 hover:border-blue-300'}`}>
                      <div className={`p-2 md:p-3 rounded-lg transition-colors ${mounted && theme === 'dark' ? 'bg-blue-900/30 group-hover:bg-blue-900/50' : 'bg-blue-100 group-hover:bg-blue-200'}`}>
                        <Package className={`h-6 w-6 md:h-8 md:w-8 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                      </div>
                      <span className={`text-xs md:text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('chinese.newOrder')}</span>
                    </Button>
                  </Link>
                  <Link href="/china/pedidos">
                    <Button variant="outline" className={`h-20 md:h-24 flex flex-col gap-2 md:gap-3 transition-all duration-300 group w-full ${mounted && theme === 'dark' ? 'hover:bg-slate-700 hover:border-slate-600 border-slate-700' : 'hover:bg-orange-50 hover:border-orange-300'}`}>
                      <div className={`p-2 md:p-3 rounded-lg transition-colors ${mounted && theme === 'dark' ? 'bg-orange-900/30 group-hover:bg-orange-900/50' : 'bg-orange-100 group-hover:bg-orange-200'}`}>
                        <Clock className={`h-6 w-6 md:h-8 md:w-8 ${mounted && theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`} />
                      </div>
                      <span className={`text-xs md:text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('chinese.processOrder')}</span>
                    </Button>
                  </Link>
                  <Link href="/china/pedidos">
                    <Button variant="outline" className={`h-20 md:h-24 flex flex-col gap-2 md:gap-3 transition-all duration-300 group w-full ${mounted && theme === 'dark' ? 'hover:bg-slate-700 hover:border-slate-600 border-slate-700' : 'hover:bg-blue-50 hover:border-blue-300'}`}>
                      <div className={`p-2 md:p-3 rounded-lg transition-colors ${mounted && theme === 'dark' ? 'bg-blue-900/30 group-hover:bg-blue-900/50' : 'bg-blue-100 group-hover:bg-blue-200'}`}>
                        <Truck className={`h-6 w-6 md:h-8 md:w-8 ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`} />
                      </div>
                      <span className={`text-xs md:text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('chinese.prepareShipment')}</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Pedidos Recientes y Información del Almacén */}
            <div className="grid grid-cols-1 gap-4 md:gap-6">
              <Card className={`backdrop-blur-sm hover:shadow-lg transition-shadow ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
                <CardHeader>
                  <CardTitle className={`text-lg md:text-xl font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('chinese.recentOrders')}</CardTitle>
                  <p className={`text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('chinese.recentOrdersSubtitle')}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 md:space-y-4">
                    {pedidosRecientes.length === 0 ? (
                      <div className={`text-center text-sm md:text-base ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('chinese.noOrders')}</div>
                    ) : (
                      pedidosRecientes.map((order: any, idx: number) => (
                        <div key={order.id} className={`flex flex-col md:flex-row md:items-center justify-between p-3 rounded-xl border gap-3 ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-slate-700 to-slate-600 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${mounted && theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                              <Package className={`h-4 w-4 ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`} />
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{order.id}</p>
                              <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{order.productName}</p>
                              <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('chinese.client')}: {nombresClientesRecientes[idx]}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getOrderBadge(order.state).className}>
                              {getOrderBadge(order.state).label}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
