"use client";

// Forzar renderizado dinámico para evitar SSR issues con XLSX
export const dynamic = 'force-dynamic';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Toaster } from '@/components/ui/toaster';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
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
  RotateCcw,
  Send
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRealtimeAdmin } from '@/hooks/use-realtime-admin';
import { useTranslation } from '@/hooks/useTranslation';
import { formatCompactMoney } from '@/lib/utils';

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
  sendChina?: boolean;
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
  sendChina?: boolean | null;
}

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
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-700 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-700 dark:text-blue-300 text-xs md:text-sm font-medium mb-1">{t('venezuela.pagos.stats.totalSpent')}</p>
              <p className="text-xl md:text-2xl lg:text-3xl font-bold text-blue-800 dark:text-blue-200" suppressHydrationWarning>
                {formatCompactMoney(stats.totalGastado)}
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-800/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 dark:from-yellow-900/20 dark:to-orange-900/20 dark:border-yellow-700 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-700 dark:text-yellow-300 text-xs md:text-sm font-medium mb-1">{t('venezuela.pagos.stats.totalPayments')}</p>
              <p className="text-xl md:text-2xl lg:text-3xl font-bold text-yellow-800 dark:text-yellow-200">{stats.pagosTotales}</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 dark:bg-yellow-800/30 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-700 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 dark:text-green-300 text-xs md:text-sm font-medium mb-1">{t('venezuela.pagos.stats.completed')}</p>
              <p className="text-xl md:text-2xl lg:text-3xl font-bold text-green-800 dark:text-green-200">{stats.completados}</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 dark:from-purple-900/20 dark:to-violet-900/20 dark:border-purple-700 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-700 dark:text-purple-300 text-xs md:text-sm font-medium mb-1">{t('venezuela.pagos.stats.pending')}</p>
              <p className="text-xl md:text-2xl lg:text-3xl font-bold text-purple-800 dark:text-purple-200">{stats.pendientes}</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 dark:bg-purple-800/30 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 md:w-6 md:h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ================================
// COMPONENTE: STATUS BADGE
// ================================
const StatusBadge: React.FC<{ status: string; sendChina?: boolean }> = ({ status, sendChina }) => {
  const { t } = useTranslation();
  const getStatusConfig = (estado: string, sent?: boolean) => {
    // Si está completado y marcado para China, mostrar estado especial
    if (estado === 'completado' && sent) {
      return {
        className: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        text: t('venezuela.pagos.status.sentChina') || 'Enviado a China',
        icon: <AnimatedIcon animation={["pulse", "float"]}><Send size={12} /></AnimatedIcon>
      };
    }
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

  const config = getStatusConfig(status, sendChina);

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
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-all duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'
        }`}
      onClick={handleBackdropClick}
    >
      <div className={`bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl transition-all duration-300 transform ${isClosing ? 'scale-95 opacity-0' : (isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0')
        }`}>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{t('venezuela.pagos.modal.details.title')}</h3>
            <p className="text-sm text-gray-500">{payment.id}</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">{t('venezuela.pagos.modal.details.clientInfo')}</h4>
            <p><span className="font-medium">{t('venezuela.pagos.modal.details.fields.user')}</span> {payment.usuario}</p>
            <p><span className="font-medium">{t('venezuela.pagos.modal.details.fields.productId')}</span> {payment.idProducto}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">{t('venezuela.pagos.modal.details.paymentInfo')}</h4>
            <div className="flex items-center gap-2">
              <span className="font-medium">{t('venezuela.pagos.modal.details.fields.amount')}</span>
              <PriceDisplay
                amount={payment.monto}
                currency="USD"
                variant="inline"
                size="md"
                emphasizeBolivars={true}
              />
            </div>
            <p><span className="font-medium">{t('venezuela.pagos.modal.details.fields.date')}</span> {new Date(payment.fecha).toLocaleDateString('es-ES')}</p>
            <p><span className="font-medium">{t('venezuela.pagos.modal.details.fields.reference')}</span> {payment.referencia}</p>
            <p><span className="font-medium">{t('venezuela.pagos.modal.details.fields.method')}</span> {payment.metodo}</p>
          </div>
          <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">{t('venezuela.pagos.modal.details.additionalDetails')}</h4>
            <p><span className="font-medium">{t('venezuela.pagos.modal.details.fields.destination')}</span> {payment.destino}</p>
            <p><span className="font-medium">{t('venezuela.pagos.modal.details.fields.description')}</span> {payment.descripcion}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ================================
// COMPONENTE: CARD DE PAGO PARA MOBILE
// ================================
const PaymentCard: React.FC<{ payment: Payment; onApprove: (id: string) => void; onReject: (id: string) => void; onViewDetails: (payment: Payment) => void; onSend: (id: string) => void; isSending?: boolean }> = ({
  payment,
  onApprove,
  onReject,
  onViewDetails,
  onSend,
  isSending
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className={`rounded-xl p-4 space-y-3 backdrop-blur-sm transition-shadow shadow-lg hover:shadow-xl border ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center text-xs font-semibold">
            {payment.id.split('-')[1] || String(payment.id)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{payment.usuario}</h3>
            <p className="text-xs text-gray-500">{payment.idProducto}</p>
          </div>
        </div>
        <StatusBadge status={payment.estado} sendChina={payment.sendChina} />
      </div>

      {/* Detalles */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">{t('venezuela.pagos.mobile.date')}</span>
          <span className="font-medium">{formatDate(payment.fecha)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">{t('venezuela.pagos.mobile.amount')}</span>
          <PriceDisplay
            amount={payment.monto}
            currency="USD"
            variant="inline"
            size="sm"
            emphasizeBolivars={true}
            className="font-semibold text-green-600"
          />
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
        {payment.estado === 'completado' && (
          <button
            onClick={() => onSend(payment.id)}
            disabled={payment.sendChina || isSending}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${payment.sendChina || isSending ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            title={payment.sendChina ? (t('venezuela.pagos.status.sentChina') || 'Enviado a China') : (t('venezuela.pagos.actions.send') || 'Enviar')}
          >
            <Send className="w-4 h-4 inline mr-1" />
            {payment.sendChina ? (t('venezuela.pagos.status.sentChina') || 'Enviado a China') : (isSending ? (t('venezuela.pagos.actions.sending') || 'Enviando...') : (t('venezuela.pagos.actions.send') || 'Enviar'))}
          </button>
        )}
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
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  // Eliminadas pestañas: siempre se muestra la lista completa con filtros por estado
  const [rejectionConfirmation, setRejectionConfirmation] = useState<{ isOpen: boolean; paymentId: string | null }>({ isOpen: false, paymentId: null });
  const [detailsModal, setDetailsModal] = useState<{ isOpen: boolean; payment: Payment | null }>({ isOpen: false, payment: null });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const lastRealtimeRef = useRef<number>(0);
  const THROTTLE_MS = 2500; // limitar frecuencia de refresco
  const fetchInFlight = useRef<boolean>(false);
  const [lastAction, setLastAction] = useState<{
    type: 'approve' | 'reject';
    paymentId: string;
    previousStatus: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<number | null>(null);
  const [sendingChina, setSendingChina] = useState<Record<string, boolean>>({});
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  useEffect(() => { setMounted(true); }, []);

  // Realtime: recargar cuando cambian pedidos (admin ve todos)
  const scheduleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRealtimeRef.current < THROTTLE_MS) return; // throttle
    lastRealtimeRef.current = now;
    setRefreshIndex(i => i + 1);
    setLastRealtimeUpdate(now);
  }, []);

  useRealtimeAdmin(
    () => { scheduleRefresh(); },
    () => { },
    () => { }
  );

  // Realtime para clientes: refresh cuando cambian nombres/datos
  useEffect(() => {
    const channel = supabase
      .channel(`admin-payments-clients-all`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        scheduleRefresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, scheduleRefresh]);

  // Polling fallback: refetch periódicamente
  useEffect(() => {
    const intervalMs = 15000; // polling menos agresivo
    const id = setInterval(() => {
      scheduleRefresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [scheduleRefresh]);

  useEffect(() => {
    const load = async () => {
      if (fetchInFlight.current) return; // evitar solapamiento
      fetchInFlight.current = true;
      setLoading(true);
      setError(null);
      const timeoutMs = 15000; // 15s
      let timeoutHandle: any;
      const startTimeout = () => {
        timeoutHandle = setTimeout(() => {
          setError('La consulta está tardando demasiado (timeout). Verifica conexión y políticas RLS.');
          setLoading(false);
          fetchInFlight.current = false;
        }, timeoutMs);
      };
      const clearTimeoutSafe = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      };
      startTimeout();
      try {
        const selectCols = 'id, client_id, productName, description, totalQuote, estimatedBudget, created_at, state, sendChina';
        // Incluir estados 4 (pendiente), 5 (completado) y -1 (rechazado)
        const { data, error } = await supabase
          .from('orders')
          .select(selectCols)
          .or('state.eq.4,state.eq.5,state.eq.-1')
          .order('created_at', { ascending: false });
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
        const mapped: Payment[] = (data as DbOrder[] | null)?.map((o) => {
          let estado: Payment['estado'];
          if (o.state === 4) estado = 'pendiente';
          else if (o.state === -1) estado = 'rechazado';
          else estado = 'completado';
          return {
            id: String(o.id),
            usuario: clientMap.get(o.client_id) || 'Cliente',
            fecha: o.created_at || new Date().toISOString(),
            idProducto: o.productName ? `#${o.productName}` : `#ORD-${o.id}`,
            monto: Number(o.totalQuote ?? o.estimatedBudget ?? 0),
            referencia: `ORD-${o.id}`,
            estado,
            metodo: 'Transferencia',
            destino: 'Venezuela',
            descripcion: o.description || 'Pedido en proceso de pago',
            sendChina: Boolean((o as any).sendChina)
          };
        }) || [];
        setPayments(mapped);
      } catch (e: any) {
        setError(e?.message || t('venezuela.pagos.error.loadErrorTitle'));
      } finally {
        clearTimeoutSafe();
        setLoading(false);
        fetchInFlight.current = false;
      }
    };
    load();
  }, [refreshIndex, supabase, t]);

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

    if (searchTerm) {
      filtered = filtered.filter(payment =>
        payment.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.referencia.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.idProducto.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'todos') {
      if (filterStatus === 'enviadoChina') {
        filtered = filtered.filter(p => p.estado === 'completado' && !!p.sendChina);
      } else if (filterStatus === 'completado') {
        filtered = filtered.filter(p => p.estado === 'completado' && !p.sendChina);
      } else {
        filtered = filtered.filter(p => p.estado === filterStatus);
      }
    }

    return filtered;
  }, [payments, searchTerm, filterStatus]);

  // Deshacer con parámetros explícitos (recomendado para toasts)
  const handleUndoFor = async (
    paymentId: string,
    previousStatus: 'completado' | 'pendiente' | 'rechazado',
    type: 'approve' | 'reject'
  ) => {
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

  const handleUndo = async () => {
    if (!lastAction) return;
    const { paymentId, previousStatus, type } = lastAction;
    // Optimistic revert
    setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, estado: previousStatus as any } : p));
    try {
      const idFilter: any = isNaN(Number(paymentId)) ? paymentId : Number(paymentId);
      if (type === 'approve' || type === 'reject') {
        // Ambos vuelven a pendiente (state 4)
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
      setLastAction(null);
    } catch (e: any) {
      toast({
        title: t('venezuela.pagos.toasts.undoErrorTitle'),
        description: e?.message || t('venezuela.pagos.toasts.undoErrorDesc'),
        variant: 'destructive',
        duration: 4000,
      });
      // Reaplicar estado que intentábamos revertir
      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, estado: (type === 'approve' ? 'completado' : 'rechazado') as any } : p));
    }
  };

  // Aprobar
  const handleApprove = async (id: string) => {
    const payment = payments.find(p => p.id === id);
    if (!payment) return;
    setLastAction({
      type: 'approve',
      paymentId: id,
      previousStatus: payment.estado,
    });
    setPayments(prev => prev.map(p =>
      p.id === id ? { ...p, estado: 'completado' as const } : p
    ));
    try {
      const resp = await fetch(`/api/orders/${id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 5 }),
      });
      if (!resp.ok) {
        const msg = await resp.json().catch(() => ({ error: 'Error al actualizar estado' }));
        throw new Error(msg?.error || 'Error al actualizar el estado del pedido');
      }
    } catch (e: any) {
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

  // Rechazar: persistimos en DB (state = -1)
  const handleReject = async (id: string) => {
    const payment = payments.find(p => p.id === id);
    if (!payment) return;
    setLastAction({
      type: 'reject',
      paymentId: id,
      previousStatus: payment.estado
    });
    // Optimistic UI
    setPayments(prev => prev.map(p => p.id === id ? { ...p, estado: 'rechazado' as const } : p));
    setRejectionConfirmation({ isOpen: false, paymentId: null });
    try {
      const idFilter: any = isNaN(Number(id)) ? id : Number(id);
      const { error } = await supabase
        .from('orders')
        .update({ state: -1 })
        .eq('id', idFilter);
      if (error) throw error;
    } catch (e: any) {
      // Revertir si falla
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
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleUndo();
          }}
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

  // Acción de enviar (solo UI por ahora)
  const handleSend = async (id: string) => {
    // Evitar doble click
    if (sendingChina[id]) return;
    setSendingChina(prev => ({ ...prev, [id]: true }));
    try {
      const idFilter: any = isNaN(Number(id)) ? id : Number(id);
      const { error } = await supabase
        .from('orders')
        .update({ sendChina: true })
        .eq('id', idFilter);
      if (error) throw error;

      // Actualizar estado local
      setPayments(prev => prev.map(p => p.id === id ? { ...p, sendChina: true } : p));

      toast({
        title: t('venezuela.pagos.toasts.sentTitle') || 'Envío registrado',
        description: t('venezuela.pagos.toasts.sentDesc', { id }) || `Pedido ${id} marcado como enviado a China`,
        variant: 'default',
        duration: 3000,
      });
    } catch (e: any) {
      toast({
        title: t('venezuela.pagos.toasts.sendErrorTitle') || 'Error al enviar',
        description: e?.message || (t('venezuela.pagos.toasts.sendErrorDesc') || 'No se pudo completar la acción de envío.'),
        variant: 'destructive',
        duration: 4000,
      });
    } finally {
      setSendingChina(prev => ({ ...prev, [id]: false }));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const exportarGeneral = async () => {
    const data = filteredPayments.map(payment => ({
      [t('venezuela.pagos.export.columns.orderId')]: payment.id,
      [t('venezuela.pagos.export.columns.client')]: payment.usuario,
      [t('venezuela.pagos.export.columns.status')]: (payment.estado === 'completado' && payment.sendChina) ? (t('venezuela.pagos.status.sentChina') || 'Enviado a China') : payment.estado,
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
      <div
        className={
          `min-h-screen flex overflow-x-hidden ` +
          (mounted && theme === 'dark'
            ? 'bg-slate-900'
            : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50')
        }
      >
        <Sidebar
          isExpanded={sidebarExpanded}
          setIsExpanded={setSidebarExpanded}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuClose={() => setIsMobileMenuOpen(false)}
          userRole="admin"
        />
        <main className={`flex-1 transition-all duration-300 ${sidebarExpanded ? 'lg:ml-72 lg:w-[calc(100%-18rem)]' : 'lg:ml-24 lg:w-[calc(100%-6rem)]'
          } w-full`}>
          <Header
            notifications={3}
            onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            title={t('venezuela.pagos.title')}
            subtitle={t('venezuela.pagos.subtitle')}
          />
          <div className="p-4 md:p-5 lg:p-6">
            {/* Error visible */}
            {error && (
              <div className={`mb-4 md:mb-6 flex items-start justify-between gap-3 rounded-lg border ${mounted && theme === 'dark' ? 'border-red-800 bg-red-900/30' : 'border-red-300 bg-red-50'} p-3 ${mounted && theme === 'dark' ? 'text-red-200' : 'text-red-800'}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5" size={18} />
                  <div>
                    <p className="font-semibold">{t('venezuela.pagos.error.loadErrorTitle')}</p>
                    <p className="text-sm break-all">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ================================ */}
            {/* TARJETAS DE ESTADÍSTICAS */}
            {/* ================================ */}
            <StatsCards stats={stats} />

            {/* Pestañas removidas: vista simplificada */}

            {/* ================================ */}
            {/* BARRA COMPACTA DERECHA */}
            {/* ================================ */}
            <Card className={mounted && theme === 'dark' ? 'mb-4 md:mb-6 bg-slate-800/70 border border-slate-700 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow' : 'mb-4 md:mb-6 bg-white/80 border border-slate-200 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow'}>
              <CardHeader className="py-3">
                <div className="flex flex-col gap-3 sm:gap-4">
                  <CardTitle className="text-lg font-semibold tracking-tight">{t('venezuela.pagos.listCardTitle')}</CardTitle>
                  {/* Controles Responsivos */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    {/* Buscador */}
                    <div className="w-full sm:flex-1 min-w-[12rem]">
                      <Input
                        placeholder={t('venezuela.pagos.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 w-full px-3"
                      />
                    </div>
                    {/* Fila Filtro + Botón en mobile */}
                    <div className="flex flex-col xs:flex-row w-full sm:w-auto gap-2 sm:gap-3">
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-10 w-full xs:min-w-[9rem] sm:w-44 md:w-48 px-3 whitespace-nowrap truncate">
                          <SelectValue placeholder={t('venezuela.pagos.filters.allStatuses')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">{t('venezuela.pagos.filters.allStatuses')}</SelectItem>
                          <SelectItem value="completado">{t('venezuela.pagos.filters.completed')}</SelectItem>
                          <SelectItem value="enviadoChina">{t('venezuela.pagos.status.sendChina')}</SelectItem>
                          <SelectItem value="pendiente">{t('venezuela.pagos.filters.pending')}</SelectItem>
                          <SelectItem value="rechazado">{t('venezuela.pagos.filters.rejected')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        className="h-10 w-full xs:w-auto bg-[#202841] text-white hover:bg-opacity-90 flex items-center justify-center"
                        onClick={exportarGeneral}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">{t('venezuela.pagos.actions.export')}</span>
                        <span className="sm:hidden">{t('venezuela.pagos.actions.exportShort')}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* ================================ */}
            {/* TABLA DE PAGOS */}
            {/* ================================ */}
            <div className={mounted && theme === 'dark' ? 'rounded-xl shadow-lg overflow-hidden border border-slate-700 bg-slate-800/70 backdrop-blur-sm transition-shadow hover:shadow-xl' : 'rounded-xl shadow-lg overflow-hidden border border-slate-200 bg-white/80 backdrop-blur-sm transition-shadow hover:shadow-xl'}>
              <div className={mounted && theme === 'dark' ? 'px-4 md:px-6 py-3 md:py-4 border-b border-slate-700/60' : 'px-4 md:px-6 py-3 md:py-4 border-b border-slate-200/70'}>
                <h2 className={`text-lg md:text-xl font-semibold flex items-center gap-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  <AnimatedIcon animation="float">
                    <Package className="md:w-6 md:h-6 text-blue-500" />
                  </AnimatedIcon>
                  {t('venezuela.pagos.table.ordersListTitle')}
                </h2>
                <p className={mounted && theme === 'dark' ? 'text-slate-300 text-xs md:text-sm mt-1' : 'text-gray-600 text-xs md:text-sm mt-1'}>
                  {t('venezuela.pagos.table.resultsFound', { count: filteredPayments.length })}
                </p>
              </div>

              {/* Vista Mobile - Cards */}
              <div className="block lg:hidden p-4 space-y-4">
                {!loading && filteredPayments.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    onApprove={handleApprove}
                    onReject={openRejectionConfirmation}
                    onViewDetails={openDetailsModal}
                    onSend={handleSend}
                    isSending={!!sendingChina[payment.id]}
                  />
                ))}
              </div>

              {/* Vista Desktop - Tabla */}
              <div className="hidden lg:block overflow-x-auto">
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
                  <tbody className="divide-y divide-gray-200">
                    {filteredPayments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200 group"
                      >
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-blue-500 text-white rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0">
                              {payment.id.split('-')[1] || String(payment.id)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm font-medium truncate ${mounted && theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{payment.id}</div>
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
                          <StatusBadge status={payment.estado} sendChina={payment.sendChina} />
                        </td>
                        <td className={`px-2 py-3 text-sm ${mounted && theme === 'dark' ? 'text-slate-200' : 'text-gray-900'}`}>
                          <span className="truncate block">{formatDate(payment.fecha)}</span>
                        </td>
                        <td className="px-2 py-3">
                          <div className={`text-sm font-bold truncate transition-colors duration-200 ${mounted && theme === 'dark' ? 'text-green-300 group-hover:text-green-400' : 'text-gray-900 group-hover:text-green-600'}`}>
                            <span suppressHydrationWarning>{formatCompactMoney(payment.monto)}</span>
                          </div>
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
                            onSend={handleSend}
                            isSending={!!sendingChina[payment.id]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

            {/* Footer */}
            <div className={`mt-4 md:mt-6 text-center text-xs md:text-sm text-gray-500`}>
              {t('venezuela.pagos.footer.showing', { shown: filteredPayments.length, total: payments.length })}
            </div>
          </div>
        </main>
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
  onSend: (id: string) => void;
  isSending?: boolean;
}> = ({
  payment,
  onApprove,
  onReject,
  onViewDetails,
  onSend,
  isSending
}) => {
    const { t } = useTranslation();
    return (
      <div className="flex items-center gap-2">
        {payment.estado === 'pendiente' && (
          <>
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
          </>
        )}

        {payment.estado === 'completado' && (
          <button
            onClick={() => onSend(payment.id)}
            disabled={payment.sendChina || isSending}
            className={`flex items-center p-2 rounded-lg transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md ${payment.sendChina || isSending ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            title={payment.sendChina ? (t('venezuela.pagos.status.sentChina') || 'Enviado a China') : (t('venezuela.pagos.actions.send') || 'Enviar')}
          >
            <Send size={14} />
          </button>
        )}

        <button
          onClick={() => onViewDetails(payment)}
          className="flex items-center p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 transform hover:scale-110 shadow-sm hover:shadow-md"
          title={t('venezuela.pagos.actions.view')}
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
