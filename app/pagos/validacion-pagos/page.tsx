"use client";

// Force dynamic rendering to avoid SSR issues with XLSX
export const dynamic = 'force-dynamic';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';
import { usePagosLayoutContext } from '@/lib/PagosLayoutContext';
import Header from '@/components/layout/Header';
import { Toaster } from '@/components/ui/toaster';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// XLSX se importará dinámicamente para evitar errores de SSR
import {
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  MoreHorizontal,
  DollarSign,
  CreditCard,
  CheckCircle,
  Clock,
  Package,
  User,
  Calendar,
  Hash,
  Check,
  X,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Bell,
  Menu,
  RotateCcw
} from 'lucide-react';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
// Eliminado contexto de Venezuela: rol pagos ve todos los pagos globales
import { useTranslation } from '@/hooks/useTranslation';
import { NotificationsFactory } from '@/lib/notifications';
import { useNotifications } from '@/hooks/use-notifications';
import { ArchiveHistoryButton } from '@/components/shared/ArchiveHistoryButton';
import { formatCompactMoney } from '@/lib/utils';


// =============================================
// SIEMPRE datos reales: lógica unificada con admin
// =============================================
const PAGE_SIZE = 20;

// ================================
// TIPOS DE DATOS TYPESCRIPT
// ================================
interface Payment {
  id: string;
  usuario: string;
  fecha: string;
  idProducto: string;
  monto: number;
  referencia: string;
  estado: 'completado' | 'pendiente' | 'rechazado';
  metodo: string;
  destino?: string;
  descripcion?: string;
  // Necesario para notificar al cliente tras aprobar/rechazar
  clientUserId?: string;
}

interface PaymentStats {
  totalGastado: number;
  pagosTotales: number;
  completados: number;
  pendientes: number;
}

// Tipo parcial de la tabla orders necesario para mapear a Payment
interface DbOrder {
  id: string | number;
  client_id: string;
  productName: string | null;
  description: string | null;
  totalQuote: number | null;
  estimatedBudget: number | null;
  created_at: string | null;
  state: number;
}

// ================================
// DATOS MOCK ELIMINADOS: SIEMPRE DATOS REALES
// ================================

// ================================
// COMPONENTE: ICONO ANIMADO
// ================================
const AnimatedIcon: React.FC<{
  children: React.ReactNode;
  animation?: 'bounce' | 'pulse' | 'float' | 'spin' | 'shake' | Array<'bounce' | 'pulse' | 'float' | 'spin' | 'shake'>;
  className?: string;
}> = ({ children, animation = 'pulse', className = '' }) => {
  const animations = {
    bounce: 'animate-bounce',
    pulse: 'animate-pulse',
    float: 'hover:animate-pulse transition-all duration-300 hover:-translate-y-1',
    spin: 'animate-spin',
    shake: 'hover:animate-bounce transition-all duration-300'
  };
  let animClass = '';
  if (Array.isArray(animation)) {
    animClass = animation.map(a => animations[a]).join(' ');
  } else {
    animClass = animations[animation];
  }
  return (
    <div className={`${animClass} ${className}`}>
      {children}
    </div>
  );
};

// ================================
// COMPONENTE: TARJETAS DE ESTADÍSTICAS
// ================================
const StatsCards: React.FC<{ stats: PaymentStats }> = ({ stats }) => {
  const { t } = useTranslation();
  // Notificaciones para rol Pagos
  const { uiItems: pagosNotifItems, unreadCount: pagosUnread, markAllAsRead: markAllPagosRead, markOneAsRead: markPagosOneRead } = useNotifications({ role: 'pagos', limit: 20, enabled: true });
  const cardsData = [
    {
      title: t('venezuela.pagos.stats.totalSpent'),
      value: formatCompactMoney(stats.totalGastado),
      icon: <TrendingUp size={24} />,
      bgColor: 'bg-blue-500',
      textColor: 'text-white'
    },
    {
      title: t('venezuela.pagos.stats.totalPayments'),
      value: stats.pagosTotales,
      icon: <CreditCard size={24} />,
      bgColor: 'bg-orange-500',
      textColor: 'text-white'
    },
    {
      title: t('venezuela.pagos.stats.completed'),
      value: stats.completados,
      icon: <AnimatedIcon animation={["pulse", "bounce"]}><CheckCircle size={24} /></AnimatedIcon>,
      bgColor: 'bg-blue-500',
      textColor: 'text-white'
    },
    {
      title: t('venezuela.pagos.stats.pending'),
      value: stats.pendientes,
      icon: <AnimatedIcon animation={["pulse", "spin"]}><Clock size={24} /></AnimatedIcon>,
      bgColor: 'bg-orange-500',
      textColor: 'text-white'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
      {cardsData.map((card, index) => (
        <div
          key={index}
          className={`${card.bgColor} text-white p-4 md:p-6 rounded-xl shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-default`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`${card.textColor} text-xs md:text-sm font-medium mb-1`}>
                {card.title}
              </p>
              <p className="text-xl md:text-2xl lg:text-3xl font-bold">
                {card.value}
              </p>
            </div>
            <div className="bg-white bg-opacity-20 p-2 md:p-3 rounded-lg">
              <AnimatedIcon animation="float">
                {card.icon}
              </AnimatedIcon>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ================================
// COMPONENTE: STATUS BADGE
// ================================
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  const getStatusConfig = (estado: string) => {
    const configs = {
      completado: {
        className: 'bg-green-100 text-green-800 border-green-200',
        text: t('venezuela.pagos.status.completado'),
        icon: <AnimatedIcon animation={["pulse", "bounce"]}><CheckCircle size={12} /></AnimatedIcon>
      },
      pendiente: {
        className: 'bg-orange-100 text-orange-800 border-orange-200',
        text: t('venezuela.pagos.status.pendiente'),
        icon: <AnimatedIcon animation={["pulse", "spin"]}><Clock size={12} /></AnimatedIcon>
      },
      rechazado: {
        className: 'bg-red-100 text-red-800 border-red-200',
        text: t('venezuela.pagos.status.rechazado'),
        icon: <AnimatedIcon animation={["pulse", "shake"]}><X size={12} /></AnimatedIcon>
      }
    };
    return configs[estado as keyof typeof configs] || configs.pendiente;
  };

  const config = getStatusConfig(status);

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border gap-1 transition-all duration-300 hover:scale-105 ${config.className}`}>
      <AnimatedIcon animation="pulse">
        {config.icon}
      </AnimatedIcon>
      <span className="truncate">{config.text}</span>
    </span>
  );
};

// ================================
// COMPONENTE: MODAL DE DETALLES DE PAGO
// ================================
const PaymentDetailsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
}> = ({ isOpen, onClose, payment }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      // Pequeño delay para que la animación de entrada sea visible
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen || !payment) return null;

  const isDark = mounted && theme === 'dark';

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-all duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'
        }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`rounded-lg p-6 max-w-2xl w-full shadow-xl border transition-all duration-300 transform ${isDark
          ? 'bg-slate-900 border-slate-700 text-slate-50'
          : 'bg-white border-gray-200 text-gray-900'
          } ${isClosing
            ? 'scale-95 opacity-0'
            : isVisible
              ? 'scale-100 opacity-100'
              : 'scale-95 opacity-0'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-slate-50' : 'text-gray-900'}`}>
              {t('venezuela.pagos.modal.details.title')}
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {payment.id}
            </p>
          </div>
          <button
            onClick={handleClose}
            className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <X size={24} />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div
            className={`p-4 rounded-lg ${isDark
              ? 'bg-slate-800 text-slate-100'
              : 'bg-gray-50 text-gray-800'
              }`}
          >
            <h4 className={`font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
              {t('venezuela.pagos.modal.details.clientInfo')}
            </h4>
            <p className={isDark ? 'text-slate-200' : 'text-gray-700'}>
              <span className="font-medium">
                {t('venezuela.pagos.modal.details.fields.user')}
              </span>{' '}
              {payment.usuario}
            </p>
            <p className={isDark ? 'text-slate-200' : 'text-gray-700'}>
              <span className="font-medium">
                {t('venezuela.pagos.modal.details.fields.productId')}
              </span>{' '}
              {payment.idProducto}
            </p>
          </div>
          <div
            className={`p-4 rounded-lg ${isDark
              ? 'bg-slate-800 text-slate-100'
              : 'bg-gray-50 text-gray-800'
              }`}
          >
            <h4 className={`font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
              {t('venezuela.pagos.modal.details.paymentInfo')}
            </h4>
            <div className={`flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
              <span className="font-medium">
                {t('venezuela.pagos.modal.details.fields.amount')}
              </span>
              <PriceDisplay
                amount={payment.monto}
                currency="USD"
                variant="inline"
                size="md"
                emphasizeBolivars={true}
              />
            </div>
            <p className={isDark ? 'text-slate-200' : 'text-gray-700'}>
              <span className="font-medium">
                {t('venezuela.pagos.modal.details.fields.date')}
              </span>{' '}
              {new Date(payment.fecha).toLocaleDateString('es-ES')}
            </p>
            <p className={isDark ? 'text-slate-200' : 'text-gray-700'}>
              <span className="font-medium">
                {t('venezuela.pagos.modal.details.fields.reference')}
              </span>{' '}
              {payment.referencia}
            </p>
            <p className={isDark ? 'text-slate-200' : 'text-gray-700'}>
              <span className="font-medium">
                {t('venezuela.pagos.modal.details.fields.method')}
              </span>{' '}
              {payment.metodo}
            </p>
          </div>
          <div
            className={`md:col-span-2 p-4 rounded-lg ${isDark
              ? 'bg-slate-800 text-slate-100'
              : 'bg-gray-50 text-gray-800'
              }`}
          >
            <h4 className={`font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
              {t('venezuela.pagos.modal.details.additionalDetails')}
            </h4>
            <p className={isDark ? 'text-slate-200' : 'text-gray-700'}>
              <span className="font-medium">
                {t('venezuela.pagos.modal.details.fields.destination')}
              </span>{' '}
              {payment.destino}
            </p>
            <p className={isDark ? 'text-slate-200' : 'text-gray-700'}>
              <span className="font-medium">
                {t('venezuela.pagos.modal.details.fields.description')}
              </span>{' '}
              {payment.descripcion}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ================================
// COMPONENTE: CARD DE PAGO PARA MOBILE
// ================================
const PaymentCard: React.FC<{ payment: Payment; onApprove: (id: string) => void; onReject: (id: string) => void; onViewDetails: (payment: Payment) => void }> = ({
  payment,
  onApprove,
  onReject,
  onViewDetails
}) => {
  const { t } = useTranslation();


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Icono de pedido en lugar del bloque azul con número */}
          <div className="w-8 h-8 bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{payment.usuario}</h3>
            <p className="text-xs text-gray-500">{payment.idProducto}</p>
          </div>
        </div>
        <StatusBadge status={payment.estado} />
      </div>

      {/* Detalles */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">{t('venezuela.pagos.mobile.date')}</span>
          <span className="font-medium">{formatDate(payment.fecha)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">{t('venezuela.pagos.mobile.amount')}</span>
          <span className="font-semibold text-green-600" suppressHydrationWarning>{formatCompactMoney(payment.monto)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">{t('venezuela.pagos.mobile.method')}</span>
          <span className="font-medium">{payment.metodo}</span>
        </div>
        {payment.destino && (
          <div className="flex justify-between">
            <span className="text-gray-600">{t('venezuela.pagos.mobile.destination')}</span>
            <span className="font-medium">{payment.destino}</span>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onViewDetails(payment)}
          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Eye className="w-4 h-4 inline mr-1" />
          {t('venezuela.pagos.actions.view')}
        </button>
        {payment.estado === 'pendiente' && (
          <>
            <button
              onClick={() => onApprove(payment.id)}
              className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              <Check className="w-4 h-4 inline mr-1" />
              {t('venezuela.pagos.actions.approve')}
            </button>
            <button
              onClick={() => onReject(payment.id)}
              className="flex-1 bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              <X className="w-4 h-4 inline mr-1" />
              {t('venezuela.pagos.actions.reject')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ================================
// COMPONENTE: DIÁLOGO DE CONFIRMACIÓN
// ================================
const ConfirmationDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen) return null;

  const isDark = mounted && theme === 'dark';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'} rounded-lg p-6 max-w-sm w-full shadow-xl`}>
        <div className="flex items-center">
          <div className={`${isDark ? 'bg-red-900/30' : 'bg-red-100'} p-2 rounded-full`}>
            <AlertTriangle className={`h-6 w-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
          </div>
          <h3 className={`text-lg font-bold ml-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        </div>
        <p className={`mt-4 text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{message}</p>
        <div className="mt-6 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-md transition-colors ${isDark
              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
          >
            {t('venezuela.pagos.modal.reject.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            {t('venezuela.pagos.modal.reject.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ================================
// COMPONENTE PRINCIPAL
// ================================
const PaymentValidationDashboard: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  // Notificaciones para rol Pagos
  const { uiItems: pagosNotifItems, unreadCount: pagosUnread, markAllAsRead: markAllPagosRead, markOneAsRead: markPagosOneRead } = useNotifications({ role: 'pagos', limit: 20, enabled: true });
  const { toggleMobileMenu } = usePagosLayoutContext();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileListRef = useRef<HTMLDivElement | null>(null);
  const [selectedTab, setSelectedTab] = useState<'todos' | 'pendientes'>('todos');
  const [rejectionConfirmation, setRejectionConfirmation] = useState<{ isOpen: boolean; paymentId: string | null }>({ isOpen: false, paymentId: null });
  const [detailsModal, setDetailsModal] = useState<{ isOpen: boolean; payment: Payment | null }>({ isOpen: false, payment: null });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [lastAction, setLastAction] = useState<{
    type: 'approve' | 'reject';
    paymentId: string;
    previousStatus: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<number | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [pagosUserId, setPagosUserId] = useState<string>('');
  useEffect(() => { setMounted(true); }, []);

  // Get current user ID for archive functionality
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) setPagosUserId(user.id);
    })();
  }, [supabase]);

  // Realtime global: cualquier cambio en orders o clients provoca refresh si afecta estados >=4
  useEffect(() => {
    const ordersChannel = supabase
      .channel('pagos-validacion-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const newState = (payload.new as any)?.state;
        const oldState = (payload.old as any)?.state;
        if ((newState && newState >= 4) || (oldState && oldState >= 4)) {
          setRefreshIndex(i => i + 1);
          setLastRealtimeUpdate(Date.now());
        }
      })
      .subscribe();
    const clientsChannel = supabase
      .channel('pagos-validacion-clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        setRefreshIndex(i => i + 1);
        setLastRealtimeUpdate(Date.now());
      })
      .subscribe();
    const pollId = setInterval(() => {
      setRefreshIndex(i => i + 1);
      setLastRealtimeUpdate(Date.now());
    }, 15000);
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(clientsChannel);
      clearInterval(pollId);
    };
  }, [supabase]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      // Guard de timeout para evitar 'Cargando...' infinito
      const timeoutMs = 15000; // 15s
      let timeoutHandle: any;
      const startTimeout = () => {
        timeoutHandle = setTimeout(() => {
          setError('La consulta está tardando demasiado (timeout). Verifica conexión y políticas RLS.');
          setLoading(false);
        }, timeoutMs);
      };
      const clearTimeoutSafe = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      };
      startTimeout();
      try {
        const selectCols = 'id, client_id, productName, description, totalQuote, estimatedBudget, created_at, state, max_state_reached, archived_by_pagos';
        // Rango de paginación
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        // Pagos ve: estado 4 (pendiente validación), estado 5 (validado), estado -1 (rechazado) 
        // Rechazados: solo si max_state_reached >= 4 (llegaron hasta pagos)
        let query = supabase
          .from('orders')
          .select(selectCols, { count: 'exact' })
          .or('state.eq.4,state.eq.5,and(state.eq.-1,max_state_reached.gte.4)')
          .eq('archived_by_pagos', false);
        const { data, error, count } = await query
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;

        const clientIds = (data || []).map((o: any) => o.client_id);
        let clientMap = new Map<string, string>();
        if (clientIds.length) {
          const { data: clients, error: cErr } = await supabase
            .from('clients')
            .select('user_id, name')
            .in('user_id', clientIds);
          if (cErr) throw cErr;
          clientMap = new Map((clients || []).map((c: any) => [c.user_id, c.name || 'Cliente']));
        }

        let mapped: Payment[] = (data as DbOrder[] | null)?.map((o) => {
          let estado: Payment['estado'];
          if (o.state === 4) estado = 'pendiente';
          else if (o.state === -1) estado = 'rechazado';
          else estado = 'completado';
          // El monto debe venir SOLO de la cotización de China (totalQuote en USD)
          // Si no hay cotización, usamos 0 y se mostrará como pendiente de cotización
          const monto = o.totalQuote !== null && o.totalQuote !== undefined ? Number(o.totalQuote) : 0;
          return {
            id: String(o.id),
            usuario: clientMap.get(o.client_id) || 'Cliente',
            fecha: o.created_at || new Date().toISOString(),
            idProducto: o.productName ? `#${o.productName}` : `#ORD-${o.id}`,
            monto: monto,
            referencia: `ORD-${o.id}`,
            estado,
            metodo: 'Transferencia',
            destino: 'Venezuela',
            descripcion: o.description || 'Pedido en proceso de pago',
            clientUserId: o.client_id
          };
        }) || [];

        // Fallback: asegurar orden descendente por fecha
        mapped = mapped.sort((a, b) => {
          return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });

        setPayments(mapped);
        if (typeof count === 'number') setTotalCount(count);
      } catch (e: any) {
        setError(e?.message || t('venezuela.pagos.error.loadErrorTitle'));
      } finally {
        clearTimeoutSafe();
        setLoading(false);
      }
    };
    load();
  }, [refreshIndex, supabase, page, filterStatus]);

  // Calcular estadísticas
  const stats = useMemo((): PaymentStats => {
    const completados = payments.filter(p => p.estado === 'completado');
    const pendientes = payments.filter(p => p.estado === 'pendiente');

    return {
      totalGastado: completados.reduce((sum, p) => sum + p.monto, 0),
      pagosTotales: payments.length,
      completados: completados.length,
      pendientes: pendientes.length
    };
  }, [payments]);

  // Filtrar pagos
  const filteredPayments = useMemo(() => {
    let filtered = payments;

    // Filtro por pestaña
    if (selectedTab === 'pendientes') {
      filtered = filtered.filter(p => p.estado === 'pendiente');
    }

    // Filtro por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(payment =>
        payment.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.referencia.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.idProducto.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por estado
    if (filterStatus !== 'todos') {
      filtered = filtered.filter(p => p.estado === filterStatus);
    }

    return filtered;
  }, [payments, searchTerm, filterStatus, selectedTab]);

  // Deshacer con parámetros explícitos (recomendado para toasts)
  const handleUndoFor = async (
    paymentId: string,
    previousStatus: 'completado' | 'pendiente' | 'rechazado',
    type: 'approve' | 'reject'
  ) => {
    // UI optimista: revertir estado visual al previo
    setPayments(prev => prev.map(p =>
      p.id === paymentId ? { ...p, estado: previousStatus } : p
    ));

    try {
      if (type === 'approve') {
        const idFilter: any = isNaN(Number(paymentId)) ? paymentId : Number(paymentId);
        const { error } = await supabase
          .from('orders')
          .update({ state: 4 })
          .eq('id', idFilter);
        if (error) throw error;
      }
      toast({
        title: t('venezuela.pagos.toasts.undoTitle'),
        description: t('venezuela.pagos.toasts.undoDesc'),
        variant: 'default',
        duration: 3000,
      });
    } catch (e: any) {
      // Si falla la reversión en BD, informamos y reintentamos devolver UI al estado post-aprobación
      toast({
        title: t('venezuela.pagos.toasts.undoErrorTitle'),
        description: e?.message || t('venezuela.pagos.toasts.undoErrorDesc'),
        variant: 'destructive',
        duration: 4000,
      });
      if (type === 'approve') {
        setPayments(prev => prev.map(p =>
          p.id === paymentId ? { ...p, estado: 'completado' } : p
        ));
      }
    }
  };

  // Función para deshacer la última acción (fallback legado)
  const handleUndo = async () => {
    if (!lastAction) return;

    const { paymentId, previousStatus, type } = lastAction;

    // UI optimista: revertir estado visual
    setPayments(prev => prev.map(p =>
      p.id === paymentId ? { ...p, estado: previousStatus as 'completado' | 'pendiente' | 'rechazado' } : p
    ));

    // Persistencia: si el último fue aprobar, regresamos a state=4
    try {
      if (type === 'approve') {
        const idFilter: any = isNaN(Number(paymentId)) ? paymentId : Number(paymentId);
        const { error } = await supabase
          .from('orders')
          .update({ state: 4 })
          .eq('id', idFilter);
        if (error) throw error;
      }
      // Si en el futuro agregamos persistencia para reject, manejar aquí
      toast({
        title: t('venezuela.pagos.toasts.undoTitle'),
        description: t('venezuela.pagos.toasts.undoDesc'),
        variant: 'default',
        duration: 3000,
      });
      setLastAction(null);
    } catch (e: any) {
      // Si falla la reversión en BD, informamos y reintentamos devolver UI al estado post-aprobación
      toast({
        title: t('venezuela.pagos.toasts.undoErrorTitle'),
        description: e?.message || t('venezuela.pagos.toasts.undoErrorDesc'),
        variant: 'destructive',
        duration: 4000,
      });
      // Recolocar UI al estado que tenía tras la acción previa (approve => completado)
      if (type === 'approve') {
        setPayments(prev => prev.map(p =>
          p.id === paymentId ? { ...p, estado: 'completado' } : p
        ));
      }
    }
  };

  // Manejar aprobación
  const handleApprove = async (id: string) => {
    const payment = payments.find(p => p.id === id);
    if (!payment) return;

    // Guardamos acción previa para permitir deshacer
    setLastAction({
      type: 'approve',
      paymentId: id,
      previousStatus: payment.estado,
    });

    // Si estamos en la pestaña de pendientes, cambiar a 'todos' para que el pago no desaparezca
    if (selectedTab === 'pendientes') {
      setSelectedTab('todos');
    }
    // Si estamos filtrando por estado, resetear a todos para asegurar visibilidad
    if (filterStatus === 'pendiente' || filterStatus === 'rechazado') {
      setFilterStatus('todos');
    }

    // UI optimista
    setPayments(prev => prev.map(p =>
      p.id === id ? { ...p, estado: 'completado' as const } : p
    ));

    // Persistir: state = 5 (verificado)

    try {
      // Usar el endpoint público para que dispare notificaciones de forma centralizada
      const resp = await fetch(`/api/orders/${id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 5 }),
      });
      if (!resp.ok) {
        const msg = await resp.json().catch(() => ({ error: 'Error al actualizar estado' }));
        throw new Error(msg?.error || 'Error al actualizar el estado del pedido');
      }
      // Notificar al cliente: pago aprobado
      if (payment.clientUserId) {
        const notif = NotificationsFactory.client.paymentReviewed({ orderId: id, paymentId: id, status: 'aprobado' });
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audience_type: 'user',
            audience_value: payment.clientUserId,
            title: notif.title,
            description: notif.description,
            href: notif.href,
            severity: notif.severity,
            user_id: payment.clientUserId,
            order_id: id,
            payment_id: id,
          })
        });
      }
    } catch (e: any) {
      // Revertir UI si falla
      setPayments(prev => prev.map(p =>
        p.id === id ? { ...p, estado: payment.estado } : p
      ));
      setLastAction(null);
      toast({
        title: t('venezuela.pagos.toasts.approveErrorTitle'),
        description: e?.message || t('venezuela.pagos.toasts.approveErrorDesc'),
        variant: 'destructive',
        duration: 4000,
      });
      return;
    }

    toast({
      title: t('venezuela.pagos.toasts.approvedTitle'),
      description: t('venezuela.pagos.toasts.approvedDesc', { id }),
      variant: 'default',
      duration: 3000,
      action: (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleUndoFor(id, payment.estado as any, 'approve');
          }}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
        >
          <RotateCcw size={14} />
          {t('venezuela.pagos.actions.undo')}
        </button>
      ),
    });
  };

  // Manejar rechazo (persistente state=-1)
  const handleReject = async (id: string) => {
    const payment = payments.find(p => p.id === id);
    if (!payment) return;
    setLastAction({ type: 'reject', paymentId: id, previousStatus: payment.estado });

    // Si estamos en la pestaña de pendientes, cambiar a 'todos' para que el pago no desaparezca
    if (selectedTab === 'pendientes') {
      setSelectedTab('todos');
    }
    // Si estamos filtrando por estado, resetear a todos para asegurar visibilidad
    if (filterStatus === 'pendiente' || filterStatus === 'rechazado') {
      setFilterStatus('todos');
    }

    setPayments(prev => prev.map(p => p.id === id ? { ...p, estado: 'rechazado' as const } : p));
    setRejectionConfirmation({ isOpen: false, paymentId: null });
    try {
      const idFilter: any = isNaN(Number(id)) ? id : Number(id);
      const { error } = await supabase.from('orders').update({ state: -1 }).eq('id', idFilter);
      if (error) throw error;
      // Notificar al cliente: pago rechazado
      if (payment.clientUserId) {
        const notif = NotificationsFactory.client.paymentReviewed({ orderId: id, paymentId: id, status: 'rechazado' });
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audience_type: 'user',
            audience_value: payment.clientUserId,
            title: notif.title,
            description: notif.description,
            href: notif.href,
            severity: notif.severity,
            user_id: payment.clientUserId,
            order_id: id,
            payment_id: id,
          })
        });
      }
    } catch (e: any) {
      setPayments(prev => prev.map(p => p.id === id ? { ...p, estado: payment.estado } : p));
      setLastAction(null);
      toast({
        title: t('venezuela.pagos.toasts.rejectErrorTitle') || 'Error al rechazar',
        description: e?.message || (t('venezuela.pagos.toasts.rejectErrorDesc') || 'No se pudo completar el rechazo.'),
        variant: 'destructive',
        duration: 4000,
      });
      return;
    }
    toast({
      title: t('venezuela.pagos.toasts.rejectedTitle'),
      description: t('venezuela.pagos.toasts.rejectedDesc', { id }),
      variant: 'default',
      duration: 3000,
      action: (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUndo(); }}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
        >
          <RotateCcw size={14} />
          {t('venezuela.pagos.actions.undo')}
        </button>
      ),
    });
  };

  const openRejectionConfirmation = (id: string) => {
    setRejectionConfirmation({ isOpen: true, paymentId: id });
  };

  const closeRejectionConfirmation = () => {
    setRejectionConfirmation({ isOpen: false, paymentId: null });
  };

  const openDetailsModal = (payment: Payment) => {
    setDetailsModal({ isOpen: true, payment });
  };

  const closeDetailsModal = () => {
    setDetailsModal({ isOpen: false, payment: null });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };



  const exportarGeneral = async () => {
    const data = filteredPayments.map(payment => ({
      [t('venezuela.pagos.export.columns.orderId')]: payment.id,
      [t('venezuela.pagos.export.columns.client')]: payment.usuario,
      [t('venezuela.pagos.export.columns.status')]: payment.estado,
      [t('venezuela.pagos.export.columns.date')]: payment.fecha,
      [t('venezuela.pagos.export.columns.amount')]: payment.monto,
      [t('venezuela.pagos.export.columns.reference')]: payment.referencia,
      [t('venezuela.pagos.export.columns.destination')]: payment.destino,
      [t('venezuela.pagos.export.columns.description')]: payment.descripcion
    }));

    const writeXlsx = (await import('write-excel-file')).default;
    const keys = Object.keys(data[0] || {});
    const headerRow = keys;
    const bodyRows = data.map((obj) => keys.map((k) => {
      const v = (obj as any)[k];
      if (v === null || v === undefined) return '';
      return typeof v === 'object' ? JSON.stringify(v) : v;
    }));
    await (writeXlsx as any)([headerRow, ...bodyRows], {
      fileName: (t('venezuela.pagos.export.fileName') as string) || 'export.xlsx',
      sheet: (t('venezuela.pagos.export.sheetName') as string) || 'Hoja 1'
    });
  };

  return (
    <>
      <PaymentDetailsModal
        isOpen={detailsModal.isOpen}
        onClose={closeDetailsModal}
        payment={detailsModal.payment}
      />
      <ConfirmationDialog
        isOpen={rejectionConfirmation.isOpen}
        onClose={closeRejectionConfirmation}
        onConfirm={() => {
          if (rejectionConfirmation.paymentId) {
            handleReject(rejectionConfirmation.paymentId);
          }
        }}
        title={t('venezuela.pagos.modal.reject.title')}
        message={t('venezuela.pagos.modal.reject.message')}
      />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          notifications={pagosUnread}
          notificationsItems={pagosNotifItems.filter(n => n.unread)}
          onMarkAllAsRead={markAllPagosRead}
          onItemClick={(id) => markPagosOneRead(id)}
          notificationsRole="pagos"
          onMenuToggle={toggleMobileMenu}
          title={t('venezuela.pagos.title')}
          subtitle={t('venezuela.pagos.subtitle')}
          showTitleOnMobile
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6 space-y-4">
          {/* Tarjetas de estadísticas (restauradas) */}
          <StatsCards stats={stats} />
          {/* Error visible */}
          {/* ================================ */}
          {/* BARRA COMPACTA DERECHA (Filtros + Export) */}
          {/* ================================ */}
          <Card className={mounted && theme === 'dark' ? 'bg-slate-800 border-slate-700 mb-4 md:mb-6' : 'bg-white border-gray-200 mb-4 md:mb-6'}>
            <CardHeader className="py-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                {/* Controles (sin título visible) */}
                <div className="w-full flex items-center justify-end gap-2 md:gap-3 flex-wrap">
                  <Input
                    placeholder={t('venezuela.pagos.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 w-full sm:w-56 md:w-64 px-3"
                  />
                  <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                    <SelectTrigger className="h-10 w-full sm:w-40 md:w-48 px-3 whitespace-nowrap truncate">
                      <SelectValue placeholder={t('venezuela.pagos.filters.allStatuses')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">{t('venezuela.pagos.filters.allStatuses')}</SelectItem>
                      <SelectItem value="completado">{t('venezuela.pagos.filters.completed')}</SelectItem>
                      <SelectItem value="pendiente">{t('venezuela.pagos.filters.pending')}</SelectItem>
                      <SelectItem value="rechazado">{t('venezuela.pagos.filters.rejected')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="h-10 w-full sm:w-auto bg-[#202841] text-white hover:bg-opacity-90"
                    onClick={exportarGeneral}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">{t('venezuela.pagos.actions.export')}</span>
                    <span className="sm:hidden">{t('venezuela.pagos.actions.exportShort')}</span>
                  </Button>
                  <ArchiveHistoryButton
                    role="pagos"
                    userId={pagosUserId}
                    onSuccess={() => setRefreshIndex(i => i + 1)}
                  />
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* ================================ */}
          {/* TABLA DE PAGOS */}
          {/* ================================ */}

          {/* Header de la tabla */}
          <div className={mounted && theme === 'dark' ? 'bg-slate-800 rounded-xl shadow-sm overflow-hidden' : 'bg-white rounded-xl shadow-sm overflow-hidden'}>
            <div className={mounted && theme === 'dark' ? 'px-4 md:px-6 py-3 md:py-4 border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800' : 'px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white'}>
              <h2 className={`text-lg md:text-xl font-semibold flex items-center gap-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <AnimatedIcon animation="float">
                  <Package className="md:w-6 md:h-6 text-blue-500" />
                </AnimatedIcon>
                {selectedTab === 'pendientes' ? t('venezuela.pagos.table.pendingApprovalTitle') :
                  t('venezuela.pagos.table.ordersListTitle')}
              </h2>
              <p className={mounted && theme === 'dark' ? 'text-slate-300 text-xs md:text-sm mt-1' : 'text-gray-600 text-xs md:text-sm mt-1'}>
                {t('venezuela.pagos.table.resultsFound', { count: filteredPayments.length })}
              </p>
            </div>

            {/* Vista Mobile - Cards */}
            <div ref={mobileListRef} className="block lg:hidden p-4 space-y-4 relative transition-opacity duration-300" style={{ opacity: loading ? 0.15 : 1 }}>
              {!loading && filteredPayments.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  onApprove={handleApprove}
                  onReject={openRejectionConfirmation}
                  onViewDetails={openDetailsModal}
                />
              ))}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/85 dark:bg-slate-900/80 shadow-md border border-gray-200 dark:border-slate-700 backdrop-blur-sm">
                    <Package className="w-5 h-5 text-blue-600 animate-spin" />
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Cargando...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Vista Desktop - Tabla */}
            <div ref={tableContainerRef} className="hidden lg:block overflow-x-auto relative">
              <table className={`w-full table-fixed ${mounted && theme === 'dark' ? 'bg-slate-800' : ''}`}>
                <thead className={mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}>
                  <tr>
                    {[
                      { label: t('venezuela.pagos.table.headers.id'), icon: <AnimatedIcon animation={["pulse", "bounce"]}><Hash size={14} /></AnimatedIcon>, width: 'w-44' },
                      { label: t('venezuela.pagos.table.headers.client'), icon: <AnimatedIcon animation={["pulse", "bounce"]}><User size={14} /></AnimatedIcon>, width: 'w-36' },
                      { label: t('venezuela.pagos.table.headers.status'), icon: <AnimatedIcon animation={["pulse", "bounce"]}><CheckCircle size={14} /></AnimatedIcon>, width: 'w-32' },
                      { label: t('venezuela.pagos.table.headers.date'), icon: <AnimatedIcon animation={["pulse", "bounce"]}><Calendar size={14} /></AnimatedIcon>, width: 'w-24' },
                      { label: t('venezuela.pagos.table.headers.amount'), icon: <AnimatedIcon animation={["pulse", "bounce"]}><DollarSign size={14} /></AnimatedIcon>, width: 'w-28' },
                      { label: t('venezuela.pagos.table.headers.reference'), icon: <AnimatedIcon animation={["pulse", "bounce"]}><Hash size={14} /></AnimatedIcon>, width: 'w-36' },
                      { label: t('venezuela.pagos.table.headers.destination'), icon: <AnimatedIcon animation={["pulse", "bounce"]}><MapPin size={14} /></AnimatedIcon>, width: 'w-28' },
                      { label: t('venezuela.pagos.table.headers.actions'), icon: <AnimatedIcon animation={["pulse", "shake"]}><MoreHorizontal size={14} /></AnimatedIcon>, width: 'w-28' }
                    ].map((header, index) => (
                      <th key={index} className={`px-2 py-3 text-left ${header.width}`}>
                        <div className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>
                          <AnimatedIcon animation="pulse">
                            {header.icon}
                          </AnimatedIcon>
                          <span className="truncate">{header.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody
                  key={page}
                  className="divide-y divide-gray-200 transition-opacity duration-300"
                  style={{ opacity: loading ? 0.15 : 1 }}
                >
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200 group"
                    >
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          {/* Icono de paquete en lugar del número */}
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200
                              ${mounted && theme === 'dark'
                                ? 'bg-blue-500/10 text-blue-300 group-hover:bg-blue-500/20'
                                : 'bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20'}`}
                          >
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`flex items-center gap-1 text-sm font-semibold tracking-tight truncate ${mounted && theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              <span className="font-mono">{payment.id}</span>
                            </div>
                            <div className={`text-xs truncate ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{payment.descripcion}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <div className={mounted && theme === 'dark' ? 'w-7 h-7 bg-slate-700 text-blue-200 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0' : 'w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0'}>
                            {payment.usuario.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-medium truncate ${mounted && theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{payment.usuario}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <StatusBadge status={payment.estado} />
                      </td>
                      <td className={`px-2 py-3 text-sm ${mounted && theme === 'dark' ? 'text-slate-200' : 'text-gray-900'}`}>
                        <span className="truncate block">{formatDate(payment.fecha)}</span>
                      </td>
                      <td className="px-2 py-3">
                        <span className={`text-sm font-bold truncate block transition-colors duration-200 ${mounted && theme === 'dark' ? 'text-green-300 group-hover:text-green-400' : 'text-gray-900 group-hover:text-green-600'}`}>
                          {formatCompactMoney(payment.monto)}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <span className={`text-xs font-mono px-2 py-1 rounded truncate block ${mounted && theme === 'dark' ? 'text-slate-300 bg-slate-900' : 'text-gray-600 bg-gray-50'}`}>
                          {payment.referencia}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-1">
                          {payment.destino === 'China' && (
                            <AnimatedIcon animation="pulse">
                              <AlertTriangle size={10} className="text-orange-500 flex-shrink-0" />
                            </AnimatedIcon>
                          )}
                          <span className={`text-xs px-2 py-1 rounded-full truncate ${payment.destino === 'China'
                            ? mounted && theme === 'dark' ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'
                            : mounted && theme === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                            }`}>
                            {payment.destino}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <PaymentActions
                          payment={payment}
                          onApprove={handleApprove}
                          onReject={openRejectionConfirmation}
                          onViewDetails={openDetailsModal}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/80 dark:bg-slate-900/80 shadow-md border border-gray-200 dark:border-slate-700 backdrop-blur-sm transition-opacity">
                    <Package className="w-5 h-5 text-blue-600 animate-spin" />
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('paymentsValidation.loadingPage')}</span>
                  </div>
                </div>
              )}
            </div>

            {filteredPayments.length === 0 && (
              <div className="text-center py-8 md:py-16">
                <AnimatedIcon animation="bounce">
                  <Package className="md:w-12 md:h-12 mx-auto text-gray-400 mb-4" />
                </AnimatedIcon>
                <p className="text-gray-500 text-base md:text-lg font-medium">{t('venezuela.pagos.empty.title')}</p>
                <p className="text-gray-400 text-sm mt-2">{t('venezuela.pagos.empty.subtitle')}</p>
              </div>
            )}
          </div>

          {/* Paginación */}
          <div className="mt-4 md:mt-6 flex flex-col gap-2">
            <div className="text-center text-xs md:text-sm text-gray-500">
              {totalCount > 0
                ? t('paymentsValidation.pagination.showing', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, totalCount), total: totalCount })
                : t('paymentsValidation.noResults')}
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  if (page === 1 || loading) return;
                  (tableContainerRef.current || mobileListRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  if (!tableContainerRef.current && !mobileListRef.current) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                  setPage(p => Math.max(1, p - 1));
                }}
                disabled={page === 1 || loading}
                className={`px-3 py-1.5 rounded-md text-xs md:text-sm border transition-colors ${(page === 1 || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50'} ${mounted && theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700/40' : 'border-gray-300 text-gray-700'}`}
              >{t('paymentsValidation.pagination.previous')}</button>
              <span className="text-xs md:text-sm font-medium">
                {t('paymentsValidation.pagination.page', { current: totalCount === 0 ? 0 : page, total: totalCount === 0 ? 0 : Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) })}
              </span>
              <button
                onClick={() => {
                  if (loading || page >= Math.ceil(totalCount / PAGE_SIZE)) return;
                  (tableContainerRef.current || mobileListRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  if (!tableContainerRef.current && !mobileListRef.current) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                  setPage(p => p + 1);
                }}
                disabled={loading || page >= Math.ceil(totalCount / PAGE_SIZE)}
                className={`px-3 py-1.5 rounded-md text-xs md:text-sm border transition-colors ${(loading || page >= Math.ceil(totalCount / PAGE_SIZE)) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50'} ${mounted && theme === 'dark' ? 'border-slate-600 text-slate-300 hover:bg-slate-700/40' : 'border-gray-300 text-gray-700'}`}
              >{t('paymentsValidation.pagination.next')}</button>
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </>
  );
};

// ================================
// COMPONENTE: ACCIONES DE PAGO PENDIENTE
// ================================
const PaymentActions: React.FC<{
  payment: Payment;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onViewDetails: (payment: Payment) => void;
}> = ({
  payment,
  onApprove,
  onReject,
  onViewDetails
}) => {
    const { t } = useTranslation();
    if (payment.estado !== 'pendiente') {
      return (
        <button
          onClick={() => onViewDetails(payment)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          <AnimatedIcon animation="float">
            <Eye size={10} />
          </AnimatedIcon>
          <span className="truncate">{t('venezuela.pagos.actions.view')}</span>
        </button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onApprove(payment.id)}
          className="flex items-center p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md"
        >
          <Check size={14} />
        </button>
        <button
          onClick={() => onReject(payment.id)}
          className="flex items-center p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md"
        >
          <X size={14} />
        </button>
        <button
          onClick={() => onViewDetails(payment)}
          className="flex items-center p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md"
        >
          <Eye size={14} />
        </button>
      </div>
    );
  };

// ================================
// COMPONENTE: AVATAR DE USUARIO
// ================================
const UserAvatar: React.FC<{ name: string; id: string }> = ({ name, id }) => {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  return (
    <div className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
      {initials}
    </div>
  );
};

export default PaymentValidationDashboard;