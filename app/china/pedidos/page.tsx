"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from '@/hooks/useTranslation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useChinaLayoutContext } from '@/lib/ChinaLayoutContext';
import '../../animations/animations.css';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
import { PriceDisplayWithCNY } from '@/components/shared/PriceDisplayWithCNY';
import { useCNYConversion } from '@/hooks/use-cny-conversion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import ProposeAlternativeModal from '@/components/china/ProposeAlternativeModal';
import { ArchiveHistoryButton } from '@/components/shared/ArchiveHistoryButton';
// PDF
import jsPDF from 'jspdf';

import {
  Calculator,
  Eye,
  Pencil,
  BarChart3,
  Package,
  ShoppingCart,
  Truck,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  MapPin,
  FileText,
  Flag,
  Search,
  Filter,
  Plus,
  RefreshCw,
  MoreHorizontal,
  User,
  Calendar,
  Tag,
  Trash2,
  List,
  Send,
  XCircle
} from 'lucide-react';
import { Boxes } from 'lucide-react';

// NUEVO: importar contexto y hook realtime
import { useChinaContext } from '@/lib/ChinaContext';
import { useRealtimeChina } from '@/hooks/use-realtime-china';
import { getSupabaseBrowserClient as _getClient } from '@/lib/supabase/client';
import { useNotifications } from '@/hooks/use-notifications';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

// Tipos
interface Pedido {
  id: number;
  clientId?: string;
  cliente: string;
  clientProfileName?: string; // Nombre del perfil del usuario
  producto: string;
  cantidad: number;
  estado: 'pendiente' | 'cotizado' | 'procesando' | 'enviado' | 'cancelado';
  cotizado: boolean;
  precio: number | null; // Monto total = unitQuote + shippingPrice
  fecha: string;
  prioridad?: 'baja' | 'media' | 'alta';
  proveedor?: string;
  especificaciones?: string;
  // Ruta del PDF asociada al pedido
  pdfRoutes?: string;
  deliveryType?: string;
  shippingType?: string;
  totalQuote?: number | null;
  numericState?: number;
  // Nuevos campos para cotización completa
  unitQuote?: number | null;
  shippingPrice?: number | null;
  height?: number | null;
  width?: number | null;
  long?: number | null;
  weight?: number | null;
  hasAlternative?: boolean;
  alternativeStatus?: 'pending' | 'accepted' | 'rejected' | null;
  alternativeRejectionReason?: string | null;
  batch_id?: string | null;
}

interface BoxItem {
  boxes_id?: number | string;
  id?: number | string;
  box_id?: number | string;
  container_id?: number | string;
  state?: number;
  creation_date?: string;
  created_at?: string;
  [key: string]: any;
}

interface ContainerItem {
  containers_id?: number | string;
  id?: number | string;
  container_id?: number | string;
  state?: number;
  creation_date?: string;
  created_at?: string;
  [key: string]: any;
}

interface OrderGroup {
  groupId: string;
  clientName: string;
  date: string;
  orders: Pedido[];
  minId: number;
  maxId: number;
}

// Utilidad para convertir un SVG público a PNG DataURL para incrustar en PDF
async function svgToPngDataUrl(path: string, size = 120): Promise<string> {
  const resp = await fetch(path);
  const svgText = await resp.text();
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = blobUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas no soportado');
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(blobUrl); }
}

// Elimina los datos de ejemplo

// Función para agrupar pedidos
function groupOrders(orders: Pedido[]): OrderGroup[] {
  if (!orders || orders.length === 0) return [];

  // 1. Ordenar por ID descendente (mayor ID primero)
  const sorted = [...orders].sort((a, b) =>
    Number(b.id) - Number(a.id)
  );

  const groups: OrderGroup[] = [];
  const TIME_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutos (Exactamente igual que en Cliente)

  sorted.forEach((order) => {
    let added = false;

    // 1. Try to group by strict batch_id first
    if (order.batch_id) {
      const existingBatchGroup = groups.find(g =>
        g.orders.some(o => o.batch_id === order.batch_id)
      );

      if (existingBatchGroup) {
        if (existingBatchGroup.clientName === order.cliente) { // Safety check
          existingBatchGroup.orders.push(order);
          existingBatchGroup.minId = Math.min(existingBatchGroup.minId, order.id);
          existingBatchGroup.maxId = Math.max(existingBatchGroup.maxId, order.id);
          added = true;
        }
      }
    }

    // 2. Logic removed: Time-based grouping is disabled. Only strict batch_id grouping.

    if (!added) {
      groups.push({
        groupId: order.batch_id ? `batch-${order.batch_id}` : `${order.cliente}-${order.fecha}`,
        clientName: order.cliente,
        date: order.fecha,
        orders: [order],
        minId: order.id,
        maxId: order.id
      });
    }
  });

  return groups;
}

export default function PedidosChina() {
  const { t } = useTranslation();
  const { formatCNYPrice, loading: cnyLoading, cnyRate } = useCNYConversion();
  // NUEVO: obtener chinaId del contexto
  const { chinaId } = useChinaContext();
  const router = useRouter();
  // Notificaciones desde DB para China
  const { uiItems: notificationsList, unreadCount, markAllAsRead, markOneAsRead } = useNotifications({ role: 'china', userId: chinaId, limit: 10, enabled: true });
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  // Margen de ganancia desde configuración
  const [profitMargin, setProfitMargin] = useState<number>(25); // Valor por defecto 25%
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const ITEMS_PER_PAGE = 1000; // Mostrar todos (sin paginación real) a petición del usuario
  // Mapear state numérico a texto usado en China
  function mapStateToEstado(state: number): Pedido['estado'] {
    // Estados cancelados/rechazados
    if (state === -2 || state === -1 || state === 0) return 'cancelado';
    // Rango solicitado para la vista China:
    // 1-2: pendiente (pedidos nuevos y recibidos)
    // 3: cotizado
    // 4: procesando
    // 5-8: enviado
    if (state >= 5 && state <= 8) return 'enviado';
    if (state === 4) return 'procesando';
    if (state === 3) return 'cotizado';
    if (state === 1 || state === 2) return 'pendiente';
    // Fallback
    return 'pendiente';
  }

  // Badges estandarizados para pedidos según estado numérico
  function getOrderBadge(stateNum?: number) {
    const s = Number(stateNum ?? 0);
    const isDark = mounted && theme === 'dark';
    // Colores utilitarios tailwind para Badges
    const base = 'border';
    // Estados cancelados: -2, -1, 0
    if (s === -2 || s === -1 || s === 0) return { label: t('chinese.ordersPage.badges.cancelled', { defaultValue: 'Cancelado' }), className: `${base} ${isDark ? 'bg-red-900/30 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-200'}` };
    if (s === 1 || s === 2) return { label: t('chinese.ordersPage.badges.pending'), className: `${base} ${isDark ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}` }; // Estados 1 y 2 son pendientes
    if (s === 3) return { label: t('chinese.ordersPage.badges.quoted'), className: `${base} ${isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'}` };
    if (s === 4) return { label: t('chinese.ordersPage.badges.processing'), className: `${base} ${isDark ? 'bg-purple-900/30 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-800 border-purple-200'}` };
    if (s === 5) return { label: t('chinese.ordersPage.badges.readyToPack'), className: `${base} ${isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700' : 'bg-amber-100 text-amber-800 border-amber-200'}` };
    if (s === 6) return { label: t('chinese.ordersPage.badges.inBox'), className: `${base} ${isDark ? 'bg-indigo-900/30 text-indigo-300 border-indigo-700' : 'bg-indigo-100 text-indigo-800 border-indigo-200'}` };
    if (s === 7 || s === 8) return { label: t('chinese.ordersPage.badges.inContainer'), className: `${base} ${isDark ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700' : 'bg-cyan-100 text-cyan-800 border-cyan-200'}` };
    if (s === 9) return { label: t('chinese.ordersPage.badges.shippedVzla'), className: `${base} ${isDark ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200'}` };
    if (s === 10) return { label: t('chinese.ordersPage.badges.inVenezuela'), className: `${base} ${isDark ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}` };
    if (s === 11) return { label: t('chinese.ordersPage.badges.inBoxVzla'), className: `${base} ${isDark ? 'bg-orange-900/30 text-orange-300 border-orange-700' : 'bg-orange-100 text-orange-800 border-orange-200'}` };
    if (s === 12) return { label: t('chinese.ordersPage.badges.readyVzla'), className: `${base} ${isDark ? 'bg-lime-900/30 text-lime-300 border-lime-700' : 'bg-lime-100 text-lime-800 border-lime-200'}` };
    if (s === 13) return { label: t('chinese.ordersPage.badges.delivered'), className: `${base} ${isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}` };
    if (s > 13) return { label: t('chinese.ordersPage.badges.shippedVzla'), className: `${base} ${isDark ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200'}` };
    return { label: t('chinese.ordersPage.badges.state', { num: s }), className: `${base} ${isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200'}` };
  }

  // Badges estandarizados para cajas
  function getBoxBadge(stateNum?: number) {
    const s = Number(stateNum ?? 0);
    const isDark = mounted && theme === 'dark';
    const base = 'border';
    if (s <= 1) return { label: t('chinese.ordersPage.boxBadges.new'), className: `${base} ${isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'}` };
    if (s === 2) return { label: t('chinese.ordersPage.boxBadges.packed'), className: `${base} ${isDark ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200'}` };
    if (s === 3) return { label: t('chinese.ordersPage.boxBadges.inContainer'), className: `${base} ${isDark ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700' : 'bg-cyan-100 text-cyan-800 border-cyan-200'}` };
    if (s >= 4) return { label: t('chinese.ordersPage.boxBadges.shipped'), className: `${base} ${isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200'}` };
    return { label: t('chinese.ordersPage.boxBadges.state', { num: s }), className: `${base} ${isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200'}` };
  }

  // Badges estandarizados para contenedores
  function getContainerBadge(stateNum?: number) {
    const s = Number(stateNum ?? 0);
    const isDark = mounted && theme === 'dark';
    const base = 'border';
    if (s <= 1) return { label: t('chinese.ordersPage.containerBadges.new'), className: `${base} ${isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'}` };
    if (s === 2) return { label: t('chinese.ordersPage.containerBadges.loading'), className: `${base} ${isDark ? 'bg-amber-900/30 text-amber-300 border-amber-700' : 'bg-amber-100 text-amber-800 border-amber-200'}` };
    if (s >= 3) return { label: t('chinese.ordersPage.containerBadges.shipped'), className: `${base} ${isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200'}` };
    return { label: t('chinese.ordersPage.containerBadges.state', { num: s }), className: `${base} ${isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200'}` };
  }

  // Fetch pedidos reales filtrando por asignedEChina
  async function fetchPedidos(page: number = 1) {
    setLoading(true);
    setCurrentPage(page);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const empleadoId = user?.id;
      if (!empleadoId) {
        setPedidos([]);
        setLoading(false);
        return;
      }
      const res = await fetch(`/china/pedidos/api/orders?asignedEChina=${empleadoId}&page=${page}&limit=${ITEMS_PER_PAGE}`, { cache: 'no-store' });
      const responseData = await res.json();
      const data = responseData.data || [];
      const total = responseData.total || 0;

      setTotalOrders(total);
      setTotalPages(Math.ceil(total / ITEMS_PER_PAGE));
      if (!Array.isArray(data)) {
        setPedidos([]);
        setLoading(false);
        return;
      }
      // DEBUG: Log alternative statuses

      data.forEach((p: any) => {
        if (p.alternativeStatus) {

        }
      });

      setPedidos(
        data
          .map((order: any) => {
            const unit = Number(order?.unitQuote ?? 0);
            const ship = Number(order?.shippingPrice ?? 0);
            const total = unit + ship;
            return {
              id: order.id,
              clientId: order.client_id,
              cliente: order.clientName || '',
              producto: order.productName || '',
              cantidad: order.quantity || 0,
              estado: mapStateToEstado(order.state),
              cotizado: order.state === 3 || (!!order.totalQuote && Number(order.totalQuote) > 0) || (unit + ship) > 0,
              // precio ahora es unitQuote + shippingPrice
              precio: (unit + ship) > 0 ? total : null,
              unitQuote: unit,
              shippingPrice: ship,
              fecha: order.created_at || '',
              especificaciones: order.specifications || '',
              pdfRoutes: order.pdfRoutes || '',
              deliveryType: order.deliveryType || '',
              shippingType: order.shippingType || '',
              totalQuote: order.totalQuote ?? null,
              numericState: typeof order.state === 'number' ? order.state : undefined,
              hasAlternative: order.hasAlternative,
              alternativeStatus: order.alternativeStatus,
              alternativeRejectionReason: order.alternativeRejectionReason,
              batch_id: order.batch_id,
            } as Pedido;
          })
      );
    } finally {
      setLoading(false);
    }
  }

  // Cancelar pedido
  const handleCancelOrder = async (orderId: number) => {
    if (!confirm(t('chinese.ordersPage.modals.cancelOrder.confirm', { defaultValue: '¿Estás seguro de que quieres cancelar este pedido?' }))) return;

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from('orders')
        .update({ state: 0 })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: t('chinese.ordersPage.toasts.orderCancelled', { defaultValue: 'Pedido cancelado' }),
        description: t('chinese.ordersPage.toasts.orderCancelledDesc', { defaultValue: 'El pedido ha sido marcado como cancelado.' }),
      });
      fetchPedidos(currentPage);
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      toast({
        title: t('chinese.ordersPage.toasts.errorTitle'),
        description: error.message || t('chinese.ordersPage.toasts.errorDesc'),
      });
    }
  };
  // Modal proponer alternativa
  const [modalPropAlternativa, setModalPropAlternativa] = useState<{ open: boolean; pedido?: Pedido }>({ open: false });

  const [modalCotizar, setModalCotizar] = useState<{
    open: boolean,
    pedido?: Pedido,
    precioUnitario?: number,
    precioEnvio?: number,
    altura?: number,
    anchura?: number,
    largo?: number,
    peso?: number,
    // inputs como texto para permitir coma o punto temporalmente
    precioUnitarioInput?: string,
    precioEnvioInput?: string,
    alturaInput?: string,
    anchuraInput?: string,
    largoInput?: string,
    pesoInput?: string,
  }>({
    open: false,
    precioUnitario: 0,
    precioEnvio: 0,
    altura: 0,
    anchura: 0,
    largo: 0,
    peso: 0,
    precioUnitarioInput: '',
    precioEnvioInput: '',
    alturaInput: '',
    anchuraInput: '',
    largoInput: '',
    pesoInput: '',
  });
  const [modalDetalle, setModalDetalle] = useState<{ open: boolean, pedido?: Pedido }>({ open: false });
  const { toggleMobileMenu } = useChinaLayoutContext();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'pedidos' | 'cajas' | 'contenedores'>('pedidos');
  const { theme } = useTheme();
  const [creatingBox, setCreatingBox] = useState(false);
  const [boxes, setBoxes] = useState<BoxItem[]>([]);
  const [boxesLoading, setBoxesLoading] = useState(false);
  const [orderCountsByBoxMain, setOrderCountsByBoxMain] = useState<Record<string | number, number>>({});
  const [airOnlyBoxes, setAirOnlyBoxes] = useState<Set<string | number>>(new Set()); // Cajas que solo tienen pedidos aéreos
  const [boxShippingTypes, setBoxShippingTypes] = useState<Record<string | number, string>>({});
  const [deletingBox, setDeletingBox] = useState(false);
  const [ordersByBox, setOrdersByBox] = useState<Pedido[]>([]);
  const [ordersByBoxLoading, setOrdersByBoxLoading] = useState(false);
  // Paginación Cajas
  const [currentBoxPage, setCurrentBoxPage] = useState(1);
  const [totalBoxPages, setTotalBoxPages] = useState(1);
  const [totalBoxes, setTotalBoxes] = useState(0);

  // Contenedores
  const [creatingContainer, setCreatingContainer] = useState(false);
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [containersLoading, setContainersLoading] = useState(false);
  // Paginación Contenedores
  const [currentContainerPage, setCurrentContainerPage] = useState(1);
  const [totalContainerPages, setTotalContainerPages] = useState(1);
  const [totalContainers, setTotalContainers] = useState(0);
  const [deletingContainer, setDeletingContainer] = useState(false);
  const [boxesByContainer, setBoxesByContainer] = useState<BoxItem[]>([]);
  const [boxesByContainerLoading, setBoxesByContainerLoading] = useState(false);
  const [orderCountsByBox, setOrderCountsByBox] = useState<Record<string | number, number>>({});

  // Estados para animaciones de salida
  const [isModalCotizarClosing, setIsModalCotizarClosing] = useState(false);
  const [isModalDetalleClosing, setIsModalDetalleClosing] = useState(false);
  const [isModalCrearCajaClosing, setIsModalCrearCajaClosing] = useState(false);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroCaja, setFiltroCaja] = useState('');
  const [filtroContenedor, setFiltroContenedor] = useState('');

  // (Scroll lock centralizado en Sidebar)

  // Refs para cerrar modales
  const modalCotizarRef = useRef<HTMLDivElement>(null);
  const modalDetalleRef = useRef<HTMLDivElement>(null);
  const modalCrearCajaRef = useRef<HTMLDivElement>(null);
  const [modalCrearCaja, setModalCrearCaja] = useState<{ open: boolean }>({ open: false });
  const modalEliminarCajaRef = useRef<HTMLDivElement>(null);
  const [modalEliminarCaja, setModalEliminarCaja] = useState<{ open: boolean; box?: BoxItem }>({ open: false });
  const [isModalEliminarCajaClosing, setIsModalEliminarCajaClosing] = useState(false);
  const modalVerPedidosRef = useRef<HTMLDivElement>(null);
  const [modalVerPedidos, setModalVerPedidos] = useState<{ open: boolean; boxId?: number | string }>({ open: false });
  const [isModalVerPedidosClosing, setIsModalVerPedidosClosing] = useState(false);
  // Campo temporal para el nombre de la caja (solo UI por ahora)
  const [newBoxName, setNewBoxName] = useState('');
  // Campo para el nombre del contenedor (requerido)
  const [newContainerName, setNewContainerName] = useState('');
  // Modal Empaquetar
  const modalEmpaquetarRef = useRef<HTMLDivElement>(null);
  interface ModalEmpaquetarState { open: boolean; pedidoId?: number }
  const [modalEmpaquetar, setModalEmpaquetar] = useState<ModalEmpaquetarState>({ open: false });
  const [isModalEmpaquetarClosing, setIsModalEmpaquetarClosing] = useState(false);
  // Modal Etiqueta antes de confirmar asignación a caja
  const modalEtiquetaRef = useRef<HTMLDivElement>(null);
  const [modalEtiqueta, setModalEtiqueta] = useState<{ open: boolean; pedidoId?: number; box?: BoxItem }>({ open: false });
  const [isModalEtiquetaClosing, setIsModalEtiquetaClosing] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [labelDownloaded, setLabelDownloaded] = useState(false); // Rastrear si la etiqueta fue descargada

  // Modal Empaquetar Caja (asignar contenedor)
  const modalEmpaquetarCajaRef = useRef<HTMLDivElement>(null);
  const [modalEmpaquetarCaja, setModalEmpaquetarCaja] = useState<{ open: boolean; boxId?: number | string }>({ open: false });
  const [isModalEmpaquetarCajaClosing, setIsModalEmpaquetarCajaClosing] = useState(false);

  // Modales Contenedores
  const modalCrearContenedorRef = useRef<HTMLDivElement>(null);
  const [modalCrearContenedor, setModalCrearContenedor] = useState<{ open: boolean }>({ open: false });
  const [isModalCrearContenedorClosing, setIsModalCrearContenedorClosing] = useState(false);
  const modalEliminarContenedorRef = useRef<HTMLDivElement>(null);
  const [modalEliminarContenedor, setModalEliminarContenedor] = useState<{ open: boolean; container?: ContainerItem }>({ open: false });
  const [isModalEliminarContenedorClosing, setIsModalEliminarContenedorClosing] = useState(false);
  const modalVerPedidosContRef = useRef<HTMLDivElement>(null);
  const [modalVerPedidosCont, setModalVerPedidosCont] = useState<{ open: boolean; containerId?: number | string }>({ open: false });
  const [isModalVerPedidosContClosing, setIsModalVerPedidosContClosing] = useState(false);
  // Modal Enviar Contenedor (capturar tracking y enviar)
  const modalEnviarContenedorRef = useRef<HTMLDivElement>(null);
  const [modalEnviarContenedor, setModalEnviarContenedor] = useState<{ open: boolean; container?: ContainerItem }>({ open: false });
  const [isModalEnviarContenedorClosing, setIsModalEnviarContenedorClosing] = useState(false);
  const [sendTrackingLink, setSendTrackingLink] = useState('');
  const [sendTrackingNumber, setSendTrackingNumber] = useState('');
  const [sendCourierCompany, setSendCourierCompany] = useState('');
  const [sendEtaDate, setSendEtaDate] = useState('');
  const [sendingContainer, setSendingContainer] = useState(false);
  const [containerSendInfo, setContainerSendInfo] = useState<Record<string | number, { trackingNumber: string; courierCompany: string; etaDate: string }>>({});
  // Refs para condiciones en handlers realtime sin rehacer canales
  const activeTabRef = useRef(activeTab);
  const modalEmpaquetarRefState = useRef(modalEmpaquetar?.open);
  const modalEmpaquetarCajaRefState = useRef(modalEmpaquetarCaja.open);
  const modalVerPedidosRefState = useRef(modalVerPedidos.open);
  const modalVerPedidosContRefState = useRef(modalVerPedidosCont.open);
  // Refs para IDs actuales usados por modales abiertos (para refrescar en realtime)
  const modalVerPedidosBoxIdRef = useRef<number | string | undefined>(undefined);
  const modalVerPedidosContIdRef = useRef<number | string | undefined>(undefined);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { modalEmpaquetarRefState.current = modalEmpaquetar?.open; }, [modalEmpaquetar?.open]);
  useEffect(() => { modalEmpaquetarCajaRefState.current = modalEmpaquetarCaja.open; }, [modalEmpaquetarCaja.open]);
  useEffect(() => { modalVerPedidosRefState.current = modalVerPedidos.open; }, [modalVerPedidos.open]);
  useEffect(() => { modalVerPedidosContRefState.current = modalVerPedidosCont.open; }, [modalVerPedidosCont.open]);
  useEffect(() => { modalVerPedidosBoxIdRef.current = modalVerPedidos.boxId; }, [modalVerPedidos.boxId]);
  useEffect(() => { modalVerPedidosContIdRef.current = modalVerPedidosCont.containerId; }, [modalVerPedidosCont.containerId]);

  // Función para obtener el margen de ganancia desde la configuración
  const fetchProfitMargin = useCallback(async (): Promise<number> => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.config?.profit_margin !== undefined && data.config.profit_margin !== null) {
          return Number(data.config.profit_margin);
        }
      }
    } catch (error) {
      console.error('Error obteniendo margen de ganancia:', error);
    }
    // Fallback al valor por defecto si hay error
    return 25;
  }, []);

  // Función para obtener la tarifa de envío aéreo desde la configuración
  const fetchAirShippingRate = useCallback(async (): Promise<number> => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.config?.air_shipping_rate !== undefined && data.config.air_shipping_rate !== null) {
          return Number(data.config.air_shipping_rate);
        }
      }
    } catch (error) {
      console.error('Error obteniendo tarifa de envío aéreo:', error);
    }
    // Fallback al valor por defecto si hay error
    return 10; // $10 por kg por defecto
  }, []);

  // Función para obtener la tarifa de envío marítimo desde la configuración
  const fetchSeaShippingRate = useCallback(async (): Promise<number> => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.config?.sea_shipping_rate !== undefined && data.config.sea_shipping_rate !== null) {
          return Number(data.config.sea_shipping_rate);
        }
      }
    } catch (error) {
      console.error('Error obteniendo tarifa de envío marítimo:', error);
    }
    // Fallback al valor por defecto si hay error
    return 180; // $180 por m³ por defecto
  }, []);

  // Cargar margen de ganancia al inicio
  useEffect(() => {
    fetchProfitMargin().then(margin => {
      setProfitMargin(margin);
    });
  }, [fetchProfitMargin]);

  useEffect(() => {
    setMounted(true);
    fetchPedidos();
  }, []);

  // NUEVO: suscripción realtime (refetch cuando evento relevante)
  useRealtimeChina(() => {
    // Evitar refetch si todavía no hay chinaId
    if (!chinaId) return;
    fetchPedidos();
  }, chinaId);

  // Ensure boxes are fetched when opening the packing modal to get up-to-date shipping types
  useEffect(() => {
    if (modalEmpaquetar.open) {
      console.log('[DEBUG] Modal empaquetar abierto. Refetching boxes...');
      fetchBoxes();
    }
  }, [modalEmpaquetar.open]);

  // Realtime para boxes y containers (suscripción única con debounce)
  useEffect(() => {
    const supabase = _getClient();

    let boxesTimer: any = null;
    let containersTimer: any = null;
    const debounce = (which: 'boxes' | 'containers', fn: () => void) => {
      if (which === 'boxes') {
        if (boxesTimer) clearTimeout(boxesTimer);
        boxesTimer = setTimeout(fn, 120);
      } else {
        if (containersTimer) clearTimeout(containersTimer);
        containersTimer = setTimeout(fn, 150);
      }
    };

    const boxesChannel = supabase
      .channel('china-boxes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boxes' }, () => {
        const tab = activeTabRef.current;
        const needsBoxes = tab === 'cajas' || modalEmpaquetarRefState.current || modalEmpaquetarCajaRefState.current || modalVerPedidosRefState.current;
        const needsContainers = tab === 'contenedores' || modalVerPedidosContRefState.current;
        if (needsBoxes) debounce('boxes', fetchBoxes);
        if (needsContainers) debounce('containers', fetchContainers);
        // Si hay modales dependientes abiertos, refrescarlos también
        if (modalVerPedidosRefState.current && modalVerPedidosBoxIdRef.current !== undefined) {
          debounce('boxes', () => fetchOrdersByBoxId(modalVerPedidosBoxIdRef.current as any));
        }
        if (modalVerPedidosContRefState.current && modalVerPedidosContIdRef.current !== undefined) {
          debounce('containers', () => fetchBoxesByContainerId(modalVerPedidosContIdRef.current as any));
        }
      })
      .subscribe();

    const containersChannel = supabase
      .channel('china-containers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, () => {
        const tab = activeTabRef.current;
        const needsContainers = tab === 'contenedores' || modalEmpaquetarCajaRefState.current || modalVerPedidosContRefState.current;
        const needsBoxes = tab === 'cajas' || modalVerPedidosRefState.current || modalEmpaquetarRefState.current;
        if (needsContainers) debounce('containers', fetchContainers);
        if (needsBoxes) debounce('boxes', fetchBoxes);
        // Actualizar vistas de detalle si están abiertas
        if (modalVerPedidosRefState.current && modalVerPedidosBoxIdRef.current !== undefined) {
          debounce('boxes', () => fetchOrdersByBoxId(modalVerPedidosBoxIdRef.current as any));
        }
        if (modalVerPedidosContRefState.current && modalVerPedidosContIdRef.current !== undefined) {
          debounce('containers', () => fetchBoxesByContainerId(modalVerPedidosContIdRef.current as any));
        }
      })
      .subscribe();

    // Orders (para actualizar conteos de pedidos en cajas y refrescar lista principal si procede)
    const ordersChannel = supabase
      .channel('china-orders-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const tab = activeTabRef.current;
        // Siempre refrescar pedidos para que las estadísticas y listados estén al día en tiempo real
        debounce('boxes', fetchPedidos);
        // Actualizar conteos por caja si tenemos cajas cargadas
        // Se hace un fetchBoxes ligero sólo si estamos viendo cajas o modales que dependen
        const needsBoxCounts = tab === 'cajas' || modalVerPedidosRefState.current || modalEmpaquetarRefState.current || modalEmpaquetarCajaRefState.current;
        if (needsBoxCounts) {
          debounce('boxes', fetchBoxes); // fetchBoxes recalcula conteos
        }
        // Si estamos viendo un contenedor y los pedidos cambian (p.ej asignaciones que mueven box state), podemos querer refrescar boxes por contenedor
        if (modalVerPedidosContRefState.current) {
          debounce('containers', fetchContainers);
        }
        // Refrescar contenido de modales abiertos
        if (modalVerPedidosRefState.current && modalVerPedidosBoxIdRef.current !== undefined) {
          debounce('boxes', () => fetchOrdersByBoxId(modalVerPedidosBoxIdRef.current as any));
        }
        if (modalVerPedidosContRefState.current && modalVerPedidosContIdRef.current !== undefined) {
          debounce('containers', () => fetchBoxesByContainerId(modalVerPedidosContIdRef.current as any));
        }
      })
      .subscribe();

    return () => {
      if (boxesTimer) clearTimeout(boxesTimer);
      if (containersTimer) clearTimeout(containersTimer);
      supabase.removeChannel(boxesChannel);
      supabase.removeChannel(containersChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  // Realtime para nombres/atributos de clientes: refetch cuando cambien
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let timer: any = null;
    const debounce = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetchPedidos();
      }, 120);
    };
    const channel = supabase
      .channel('china-clients-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        // Si hay pedidos visibles, un cambio en clientes puede afectar nombres mostrados
        debounce();
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  // Scroll lock cuando cualquier modal está abierto
  const anyModalOpen = [
    modalCotizar.open,
    modalDetalle.open,
    modalCrearCaja.open,
    modalEliminarCaja.open,
    modalVerPedidos.open,
    modalEmpaquetar?.open,
    modalEmpaquetarCaja.open,
    modalCrearContenedor.open,
    modalEliminarContenedor.open,
    modalVerPedidosCont.open,
    modalEnviarContenedor.open,
  ].some(Boolean);

  useEffect(() => {
    if (anyModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [anyModalOpen]);

  // Cargar cajas cuando se entra a la pestaña Cajas
  useEffect(() => {
    if (activeTab === 'cajas') {
      fetchBoxes();
    }
    if (activeTab === 'contenedores') {
      fetchContainers();
    }
  }, [activeTab]);

  // Cerrar modales al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalCotizar.open && modalCotizarRef.current && !modalCotizarRef.current.contains(event.target as Node)) {
        closeModalCotizar();
      }
      if (modalDetalle.open && modalDetalleRef.current && !modalDetalleRef.current.contains(event.target as Node)) {
        closeModalDetalle();
      }
      if (modalCrearCaja.open && modalCrearCajaRef.current && !modalCrearCajaRef.current.contains(event.target as Node)) {
        closeModalCrearCaja();
      }
      if (modalVerPedidos.open && modalVerPedidosRef.current && !modalVerPedidosRef.current.contains(event.target as Node)) {
        setIsModalVerPedidosClosing(true);
        setTimeout(() => {
          setModalVerPedidos({ open: false });
          setIsModalVerPedidosClosing(false);
          setOrdersByBox([]);
        }, 300);
      }
      if (modalVerPedidosCont.open && modalVerPedidosContRef.current && !modalVerPedidosContRef.current.contains(event.target as Node)) {
        setIsModalVerPedidosContClosing(true);
        setTimeout(() => {
          setModalVerPedidosCont({ open: false });
          setIsModalVerPedidosContClosing(false);
          setBoxesByContainer([]);
          setOrderCountsByBox({});
        }, 300);
      }
      if (modalEmpaquetar?.open && modalEmpaquetarRef.current && !modalEmpaquetarRef.current.contains(event.target as Node)) {
        setIsModalEmpaquetarClosing(true);
        setTimeout(() => {
          setModalEmpaquetar({ open: false });
          setIsModalEmpaquetarClosing(false);
        }, 300);
      }
      if (modalEmpaquetarCaja.open && modalEmpaquetarCajaRef.current && !modalEmpaquetarCajaRef.current.contains(event.target as Node)) {
        setIsModalEmpaquetarCajaClosing(true);
        setTimeout(() => {
          setModalEmpaquetarCaja({ open: false });
          setIsModalEmpaquetarCajaClosing(false);
        }, 300);
      }
      if (modalCrearContenedor.open && modalCrearContenedorRef.current && !modalCrearContenedorRef.current.contains(event.target as Node)) {
        closeModalCrearContenedor();
      }
      if (modalEliminarContenedor.open && modalEliminarContenedorRef.current && !modalEliminarContenedorRef.current.contains(event.target as Node)) {
        closeModalEliminarContenedor();
      }
      if (modalEnviarContenedor.open && modalEnviarContenedorRef.current && !modalEnviarContenedorRef.current.contains(event.target as Node)) {
        closeModalEnviarContenedor();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [
    modalCotizar.open,
    modalDetalle.open,
    modalCrearCaja.open,
    modalEliminarCaja.open,
    modalVerPedidos.open,
    modalEmpaquetar?.open,
    modalCrearContenedor.open,
    modalEliminarContenedor.open,
    modalVerPedidosCont.open,
  ]);

  // Funciones para cerrar modales con animación
  const closeModalCotizar = () => {
    setIsModalCotizarClosing(true);
    setTimeout(() => {
      setModalCotizar({ open: false });
      setIsModalCotizarClosing(false);
    }, 300);
  };

  const closeModalDetalle = () => {
    setIsModalDetalleClosing(true);
    setTimeout(() => {
      setModalDetalle({ open: false });
      setIsModalDetalleClosing(false);
    }, 300);
  };
  const closeModalCrearCaja = () => {
    setIsModalCrearCajaClosing(true);
    setTimeout(() => {
      setModalCrearCaja({ open: false });
      setIsModalCrearCajaClosing(false);
    }, 300);
  };
  const closeModalEliminarCaja = () => {
    setIsModalEliminarCajaClosing(true);
    setTimeout(() => {
      setModalEliminarCaja({ open: false });
      setIsModalEliminarCajaClosing(false);
    }, 300);
  };
  const closeModalVerPedidos = () => {
    setIsModalVerPedidosClosing(true);
    setTimeout(() => {
      setModalVerPedidos({ open: false });
      setIsModalVerPedidosClosing(false);
      setOrdersByBox([]);
    }, 300);
  };

  const closeModalVerPedidosCont = () => {
    setIsModalVerPedidosContClosing(true);
    setTimeout(() => {
      setModalVerPedidosCont({ open: false });
      setIsModalVerPedidosContClosing(false);
      setBoxesByContainer([]);
      setOrderCountsByBox({});
    }, 300);
  };

  const closeModalEmpaquetar = () => {
    setIsModalEmpaquetarClosing(true);
    setTimeout(() => {
      setModalEmpaquetar({ open: false });
      setIsModalEmpaquetarClosing(false);
    }, 300);
  };
  const closeModalEtiqueta = () => {
    setIsModalEtiquetaClosing(true);
    setTimeout(() => {
      setModalEtiqueta({ open: false });
      setIsModalEtiquetaClosing(false);
      setLabelDownloaded(false); // Resetear el estado cuando se cierra el modal
    }, 300);
  };

  const closeModalEmpaquetarCaja = () => {
    setIsModalEmpaquetarCajaClosing(true);
    setTimeout(() => {
      setModalEmpaquetarCaja({ open: false });
      setIsModalEmpaquetarCajaClosing(false);
    }, 300);
  };

  const closeModalCrearContenedor = () => {
    setIsModalCrearContenedorClosing(true);
    setTimeout(() => {
      setModalCrearContenedor({ open: false });
      setIsModalCrearContenedorClosing(false);
    }, 300);
  };

  const closeModalEliminarContenedor = () => {
    setIsModalEliminarContenedorClosing(true);
    setTimeout(() => {
      setModalEliminarContenedor({ open: false });
      setIsModalEliminarContenedorClosing(false);
    }, 300);
  };
  const closeModalEnviarContenedor = () => {
    setIsModalEnviarContenedorClosing(true);
    setTimeout(() => {
      setModalEnviarContenedor({ open: false });
      setIsModalEnviarContenedorClosing(false);
      setSendTrackingLink('');
      setSendTrackingNumber('');
      setSendCourierCompany('');
      setSendEtaDate('');
    }, 300);
  };

  // Crear registro en Supabase: tabla boxes
  const handleConfirmCrearCaja = async () => {
    try {
      // Requerir nombre de la caja
      if (!newBoxName.trim()) {
        toast({
          title: t('chinese.ordersPage.toasts.notAllowedTitle', { defaultValue: 'No permitido' }),
          description: t('chinese.ordersPage.modals.createBox.boxNameRequired', { defaultValue: 'El nombre de la caja es obligatorio.' }),
        });
        return;
      }
      setCreatingBox(true);
      const supabase = getSupabaseBrowserClient();
      const creation_date = new Date().toISOString();
      const { data, error } = await supabase
        .from('boxes')
        // Guardar también el nombre de la caja (obligatorio)
        .insert([{ state: 1, creation_date, name: newBoxName.trim() }])
        .select();
      if (error) {
        console.error('Error al crear caja:', error);
        toast({
          title: t('chinese.ordersPage.toasts.createBoxErrorTitle'),
          description: t('chinese.ordersPage.toasts.tryAgainSeconds'),
        });
        return;
      }
      // Éxito: cerrar modal (podemos mostrar toast si existe más adelante)
      closeModalCrearCaja();
      toast({
        title: t('chinese.ordersPage.toasts.boxCreatedTitle'),
        description: t('chinese.ordersPage.toasts.boxCreatedDesc'),
      });
      // Refrescar listado de cajas
      fetchBoxes();
    } finally {
      setCreatingBox(false);
    }
  };

  // Cargar lista de cajas
  async function fetchBoxes(page: number = 1) {
    setBoxesLoading(true);
    setCurrentBoxPage(page);
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      const supabase = getSupabaseBrowserClient();
      const { data, count, error } = await supabase
        .from('boxes')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('creation_date', { ascending: false });

      if (error) {
        console.error('Error al obtener cajas:', error);
        toast({ title: t('chinese.ordersPage.toasts.loadBoxesErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainLater') });
        return;
      }

      setTotalBoxes(count || 0);
      setTotalBoxPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));

      const list = (data || []) as BoxItem[];
      setBoxes(list);

      // Get orders counts for these boxes AND shipping types
      const ids = list.map(b => b.box_id ?? b.boxes_id ?? (b as any).id).filter(v => v != null);
      if (ids.length > 0) {
        const { data: ordersData } = await supabase.from('orders').select('id, box_id, shippingType').in('box_id', ids as any);

        const counts: Record<string | number, number> = {};
        const boxTypes: Record<string | number, string> = {}; // 'Aereo', 'Maritimo', or 'Mixto'

        (ordersData || []).forEach(r => {
          const bid = r.box_id as any;
          counts[bid] = (counts[bid] || 0) + 1;

          if (r.shippingType) {
            // Check exact values from DB image: 'air', 'maritime'
            const typeNorm = r.shippingType === 'air' ? 'Aereo' : r.shippingType === 'maritime' ? 'Maritimo' : '';
            // If the DB has 'Aereo'/'Maritimo' directly, handle that too just in case
            const finalType = typeNorm || (r.shippingType === 'Aereo' ? 'Aereo' : r.shippingType === 'Maritimo' ? 'Maritimo' : '');

            if (finalType) {
              if (!boxTypes[bid]) {
                boxTypes[bid] = finalType;
              } else if (boxTypes[bid] !== finalType) {
                boxTypes[bid] = 'Mixto';
              }
            }
          }
        });

        console.log('[DEBUG fetchBoxes] derived boxTypes:', boxTypes);

        setOrderCountsByBoxMain(counts);

        // Populate "airOnly" set (legacy check) AND new detailed types
        const airOnlySet = new Set<string | number>();
        Object.keys(boxTypes).forEach(bid => {
          if (boxTypes[bid] === 'Aereo') {
            airOnlySet.add(bid);
          }
        });
        setAirOnlyBoxes(airOnlySet);
        setBoxShippingTypes(boxTypes);
      } else {
        setOrderCountsByBoxMain({});
        setAirOnlyBoxes(new Set());
        setBoxShippingTypes({});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBoxesLoading(false);
    }
  }

  // Crear registro en Supabase: tabla containers
  const handleConfirmCrearContenedor = async () => {
    try {
      setCreatingContainer(true);
      const supabase = getSupabaseBrowserClient();
      const creation_date = new Date().toISOString();
      // Validación: requerir nombre
      if (!newContainerName.trim()) {
        toast({
          title: t('chinese.ordersPage.toasts.notAllowedTitle', { defaultValue: 'No permitido' }),
          description: t('chinese.ordersPage.modals.createContainer.containerNameRequired', { defaultValue: 'El nombre del contenedor es obligatorio.' }),
        });
        return;
      }
      const { error } = await supabase
        .from('containers')
        .insert([{ state: 1, creation_date, name: newContainerName.trim() }]);
      if (error) {
        console.error('Error al crear contenedor:', error);
        toast({ title: t('chinese.ordersPage.toasts.createContainerErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainSeconds') });
        return;
      }
      closeModalCrearContenedor();
      toast({ title: t('chinese.ordersPage.toasts.containerCreatedTitle'), description: t('chinese.ordersPage.toasts.containerCreatedDesc') });
      fetchContainers();
    } finally {
      setCreatingContainer(false);
    }
  };

  // Cargar lista de contenedores
  async function fetchContainers(page: number = 1) {
    setContainersLoading(true);
    setCurrentContainerPage(page);
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      const supabase = getSupabaseBrowserClient();
      const { data, count, error } = await supabase
        .from('containers')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('creation_date', { ascending: false });

      if (error) {
        console.error('Error al obtener contenedores:', error);
        toast({ title: t('chinese.ordersPage.toasts.loadContainersErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainLater') });
        return;
      }

      setTotalContainers(count || 0);
      setTotalContainerPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));

      const list = (data || []) as ContainerItem[];
      setContainers(list);
    } finally {
      setContainersLoading(false);
    }
  }

  // Cargar cajas por container_id
  async function fetchBoxesByContainerId(containerId: number | string) {
    setBoxesByContainerLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('boxes')
        .select('*')
        .eq('container_id', containerId);
      if (error) {
        console.error('Error al obtener cajas del contenedor:', error);
        toast({ title: t('chinese.ordersPage.toasts.loadBoxesErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
        return;
      }
      const list = (data || []) as BoxItem[];
      list.sort((a, b) => {
        const da = new Date((a.creation_date ?? a.created_at ?? '') as string).getTime() || 0;
        const db = new Date((b.creation_date ?? b.created_at ?? '') as string).getTime() || 0;
        return db - da;
      });
      setBoxesByContainer(list);

      // Obtener conteo de pedidos por caja para las cajas listadas
      const ids = list
        .map((b) => b.box_id ?? b.boxes_id ?? (b as any).id)
        .filter((v): v is number | string => v !== undefined && v !== null);
      if (ids.length > 0) {
        const { data: ordersData, error: ordersErr } = await supabase
          .from('orders')
          .select('id, box_id')
          .in('box_id', ids);
        if (ordersErr) {
          console.error('Error al obtener conteo de pedidos por caja:', ordersErr);
        } else {
          const counts: Record<string | number, number> = {};
          (ordersData || []).forEach((row: any) => {
            const key = row.box_id as string | number;
            counts[key] = (counts[key] || 0) + 1;
          });
          setOrderCountsByBox(counts);
        }
      } else {
        setOrderCountsByBox({});
      }
    } finally {
      setBoxesByContainerLoading(false);
    }
  }

  // Cargar pedidos por box_id
  async function fetchOrdersByBoxId(boxId: number | string) {
    setOrdersByBoxLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('box_id', boxId);
      if (error) {
        console.error('Error al obtener pedidos de la caja:', error);
        toast({ title: t('chinese.ordersPage.toasts.loadOrdersErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
        return;
      }

      // Obtener client_ids únicos
      const clientIds = Array.from(new Set((data || []).map((o: any) => o.client_id).filter(Boolean)));

      // Obtener información de clientes y usuarios
      const clientProfileMap = new Map<string, string>();

      if (clientIds.length > 0) {
        // Obtener clientes
        const { data: clientsData } = await supabase
          .from('clients')
          .select('user_id, name')
          .in('user_id', clientIds);

        if (clientsData) {
          // Para cada cliente, intentar obtener el nombre del perfil desde la API
          for (const client of clientsData) {
            let profileName = client.name || '—';

            // Intentar obtener el nombre del perfil desde user_metadata usando la API
            try {
              const response = await fetch(`/api/admin-name?uid=${client.user_id}`);
              if (response.ok) {
                const result = await response.json();
                if (result.success && result.name) {
                  profileName = result.name;
                }
              }
            } catch (e) {
              // Si falla, usar el nombre de la tabla clients como fallback
              console.log('No se pudo obtener nombre del perfil, usando nombre de clients:', e);
            }

            clientProfileMap.set(client.user_id, profileName);
          }
        }
      }

      const mapped: Pedido[] = (data || []).map((order: any) => {
        const clientProfileName = order.client_id ? (clientProfileMap.get(order.client_id) || order.clientName || order.client || '—') : '—';

        return {
          id: order.id,
          clientId: order.client_id,
          cliente: order.clientName || order.client || '—',
          clientProfileName: clientProfileName,
          producto: order.productName || order.product || '—',
          cantidad: Number(order.quantity || 0),
          // Si viene null/undefined asumimos 2, y ocultamos state 1
          estado: mapStateToEstado(Number(order.state || 2)),
          cotizado: Number(order.state) === 3 || (!!order.totalQuote && Number(order.totalQuote) > 0),
          precio: order.totalQuote ? Number(order.totalQuote) / Math.max(1, Number(order.quantity || 1)) : null,
          fecha: order.created_at || order.creation_date || new Date().toISOString(),
          especificaciones: order.specifications || '',
          pdfRoutes: order.pdfRoutes || '',
          deliveryType: order.deliveryType || '',
          shippingType: order.shippingType || '',
          totalQuote: order.totalQuote ?? null,
          numericState: typeof order.state === 'number' ? order.state : Number(order.state || 0),
        };
      });
      setOrdersByBox(mapped);
    } finally {
      setOrdersByBoxLoading(false);
    }
  }

  // Verificar si todos los pedidos en una caja son de tipo "air"
  const checkIfBoxHasOnlyAirOrders = async (boxId: number | string): Promise<boolean> => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: orders, error } = await supabase
        .from('orders')
        .select('shippingType')
        .eq('box_id', boxId);

      if (error) {
        console.error('Error obteniendo pedidos de la caja:', error);
        return false;
      }

      if (!orders || orders.length === 0) {
        return false; // Caja vacía
      }

      // Verificar que todos los pedidos tengan shippingType = "air"
      return orders.every(order => order.shippingType === 'air');
    } catch (e) {
      console.error('Error verificando tipo de envío de pedidos:', e);
      return false;
    }
  };

  // Enviar caja directamente (para pedidos aéreos)
  const handleSendBoxDirectly = async (boxId: number | string) => {
    try {
      const supabase = getSupabaseBrowserClient();

      // Verificar que la caja tenga pedidos
      const { data: orders, error: countErr } = await supabase
        .from('orders')
        .select('id')
        .eq('box_id', boxId)
        .limit(1);

      if (countErr) {
        console.error('Error verificando pedidos de la caja:', countErr);
        toast({ title: t('chinese.ordersPage.toasts.unexpectedErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainLater') });
        return;
      }

      if (!orders || orders.length === 0) {
        toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.toasts.packEmptyBoxNotAllowed') });
        return;
      }

      // Obtener el estado actual de la caja para poder revertirlo en caso de error
      const { data: currentBox, error: boxFetchError } = await supabase
        .from('boxes')
        .select('state')
        .eq('box_id', boxId)
        .single();

      if (boxFetchError) {
        console.error('Error obteniendo estado de la caja:', boxFetchError);
        toast({ title: t('chinese.ordersPage.toasts.unexpectedErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainLater') });
        return;
      }

      const previousBoxState = currentBox?.state ?? 3; // Estado por defecto si no se encuentra

      // Cambiar estado de la caja a enviado (state = 4)
      const { error: boxUpdateError } = await supabase
        .from('boxes')
        .update({ state: 4 })
        .eq('box_id', boxId);

      if (boxUpdateError) {
        console.error('Error enviando caja:', {
          message: boxUpdateError.message,
          details: boxUpdateError.details,
          hint: boxUpdateError.hint,
          code: boxUpdateError.code,
          error: boxUpdateError
        });
        toast({ title: t('chinese.ordersPage.toasts.sendBoxErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
        return;
      }

      // Cambiar estado de todos los pedidos a enviado (state = 9)
      const { error: ordersUpdateError, data: updatedOrders } = await supabase
        .from('orders')
        .update({ state: 9 })
        .eq('box_id', boxId)
        .select('id');

      if (ordersUpdateError) {
        console.error('Error actualizando pedidos:', {
          message: ordersUpdateError.message,
          details: ordersUpdateError.details,
          hint: ordersUpdateError.hint,
          code: ordersUpdateError.code,
          error: ordersUpdateError
        });
        
        // Revertir el estado de la caja si falló la actualización de pedidos
        await supabase
          .from('boxes')
          .update({ state: previousBoxState })
          .eq('box_id', boxId);
        
        toast({ 
          title: t('chinese.ordersPage.toasts.sendBoxErrorTitle'), 
          description: t('chinese.ordersPage.toasts.tryAgain') || 'No se pudieron actualizar los pedidos. Por favor intenta nuevamente.' 
        });
        return;
      }

      toast({ title: t('chinese.ordersPage.toasts.boxSentTitle'), description: t('chinese.ordersPage.toasts.boxSentDesc', { boxId }) });

      // Actualizar UI
      setBoxes(prev => prev.map(b => {
        const currentId = b.box_id ?? b.boxes_id ?? b.id;
        if (currentId === boxId) {
          return { ...b, state: 4 };
        }
        return b;
      }));

      // Refrescar datos
      fetchBoxes();

    } catch (e) {
      console.error('Error enviando caja:', e);
      toast({ title: t('chinese.ordersPage.toasts.unexpectedErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainLater') });
    }
  };

  // Asignar caja a contenedor
  const handleSelectContenedorForCaja = async (boxId: number | string, container: ContainerItem) => {
    const containerId = container.container_id ?? container.containers_id ?? container.id;
    if (!containerId) {
      toast({ title: t('chinese.ordersPage.toasts.invalidContainerTitle'), description: t('chinese.ordersPage.toasts.invalidContainerDesc') });
      return;
    }
    try {
      const supabase = getSupabaseBrowserClient();
      // No permitir asignar a contenedor enviado
      const contStateNum = (container.state ?? 1) as number;
      if (contStateNum >= 3) {
        toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.toasts.assignToShippedContainerDesc') });
        return;
      }
      // Regla: No permitir empaquetar una caja vacía
      try {
        const { data: anyOrder, error: countErr } = await supabase
          .from('orders')
          .select('id')
          .eq('box_id', boxId)
          .limit(1);
        if (countErr) {
          console.error('Error verificando pedidos de la caja:', countErr);
        }
        if (!anyOrder || anyOrder.length === 0) {
          toast({
            title: t('chinese.ordersPage.toasts.notAllowedTitle', { defaultValue: 'No permitido' }),
            description: t('chinese.ordersPage.toasts.packEmptyBoxNotAllowed', { defaultValue: 'No puedes empaquetar una caja vacía. Agrega pedidos primero.' }),
          });
          return;
        }
      } catch (e) {
        console.error('Fallo verificando si la caja está vacía:', e);
        toast({ title: t('chinese.ordersPage.toasts.unexpectedErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainLater') });
        return;
      }
      // 1) Actualizar la caja: asignar contenedor y cambiar state=2 (empaquetada)
      const { error: boxUpdateError } = await supabase
        .from('boxes')
        .update({ container_id: containerId, state: 2 })
        .eq('box_id', boxId);
      if (boxUpdateError) {
        console.error('Error asignando contenedor:', boxUpdateError);
        toast({ title: t('chinese.ordersPage.toasts.assignContainerErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
        return;
      }
      // 2) Mover todos los pedidos de esa caja a state=7
      const { error: ordersUpdateError } = await supabase
        .from('orders')
        .update({ state: 7 })
        .eq('box_id', boxId);
      if (ordersUpdateError) {
        console.error('Error actualizando pedidos a estado 7:', ordersUpdateError);
      }
      // 3) Asegurar que el contenedor pase a estado 2 al cargarse una caja
      const { error: contStateErr } = await supabase
        .from('containers')
        .update({ state: 2 })
        .eq('container_id', containerId);
      if (contStateErr) {
        console.error('Error actualizando contenedor a estado 2:', contStateErr);
      }
      toast({ title: t('chinese.ordersPage.toasts.boxAssignedTitle'), description: t('chinese.ordersPage.toasts.boxAssignedDesc', { boxId: boxId, containerId: containerId }) });
      // Actualizar UI local
      setBoxes(prev => prev.map(b => {
        const id = b.box_id ?? b.boxes_id ?? b.id;
        if (String(id) === String(boxId)) return { ...b, container_id: containerId, state: 2 };
        return b;
      }));
      setContainers(prev => prev.map(c => {
        const cid = c.container_id ?? c.containers_id ?? c.id;
        if (String(cid) === String(containerId)) return { ...c, state: 2 };
        return c;
      }));
      closeModalEmpaquetarCaja();
    } catch (e) {
      console.error(e);
      toast({ title: t('chinese.ordersPage.toasts.unexpectedErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainLater') });
    }
  };

  // Desempaquetar caja: quitar de contenedor, resetear estado y liberar pedidos
  const handleUnpackBox = async (boxId: number | string, options?: { containerId?: number | string }) => {
    try {
      const supabase = getSupabaseBrowserClient();
      // Si la caja pertenece a un contenedor enviado, bloquear
      const contId = options?.containerId;
      if (contId !== undefined) {
        const { data: contRow, error: contErr } = await supabase
          .from('containers')
          .select('state')
          .eq('container_id', contId)
          .maybeSingle();
        if (contErr) {
          console.error('Error verificando contenedor:', contErr);
        }
        const contState = (contRow?.state ?? 1) as number;
        if (contState >= 3) {
          toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.toasts.unpackBoxFromShippedContainerDesc') });
          return;
        }
      }
      // 1) Actualizar pedidos: remover box_id y regresar a estado 5 (enviado)
      const { error: ordersErr } = await supabase
        .from('orders')
        .update({ box_id: null, state: 5 })
        .eq('box_id', boxId);
      if (ordersErr) {
        console.error('Error al desasignar pedidos de la caja:', ordersErr);
      }
      // 2) Actualizar caja: quitar container y regresar a estado 1 (nueva)
      const { error: boxErr } = await supabase
        .from('boxes')
        .update({ container_id: null, state: 1 })
        .eq('box_id', boxId);
      if (boxErr) {
        console.error('Error al actualizar caja a estado 1:', boxErr);
        toast({ title: t('chinese.ordersPage.toasts.unassignErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
        return;
      }
      toast({ title: t('chinese.ordersPage.toasts.boxUnpackedTitle'), description: t('chinese.ordersPage.toasts.boxUnpackedDesc', { boxId }) });
      // Actualizar estado local de cajas
      setBoxes(prev => prev.map(b => {
        const id = b.box_id ?? b.boxes_id ?? b.id;
        if (String(id) === String(boxId)) return { ...b, container_id: undefined, state: 1 };
        return b;
      }));
      // Resetear conteos en listas
      setOrderCountsByBoxMain(prev => ({ ...prev, [boxId as any]: 0 }));
      setOrderCountsByBox(prev => ({ ...prev, [boxId as any]: 0 }));
      // Si estamos en el modal de contenedor, refrescar la lista o remover la caja de la vista
      if (options?.containerId) {
        await fetchBoxesByContainerId(options.containerId);
      }
      // Refrescar pedidos para reflejar estado 5
      fetchPedidos();
    } catch (e) {
      console.error(e);
      toast({ title: t('chinese.ordersPage.toasts.unexpectedErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainLater') });
    }
  };

  // Enviar contenedor: guardar tracking y cambiar estado a 3 (con cascadas)
  const handleSendContainer = async (container: ContainerItem, details?: { trackingNumber: string; courierCompany: string; etaDate: string; trackingLink?: string }): Promise<boolean> => {
    const stateNum = (container.state ?? 1) as number;
    if (stateNum !== 2) return false;
    const containerId = container.container_id ?? container.containers_id ?? container.id;
    if (!containerId) return false;
    try {
      const supabase = getSupabaseBrowserClient();
      const baseDetails: any = details
        ? { tracking_number: details.trackingNumber, tracking_company: details.courierCompany, ...(details.trackingLink ? { tracking_link: details.trackingLink } : {}) }
        : {};
      // Intento 1: usar 'arrive-data'
      let updateErr: any = null;
      if (details) {
        const payload1: any = { ...baseDetails, ['arrive-data']: details.etaDate, state: 3 };
        const res1 = await supabase.from('containers').update(payload1).eq('container_id', containerId);
        updateErr = res1.error;
        // Intento 2: fallback a arrive_date si columna con guion no existe
        if (updateErr && (updateErr.code === '42703' || /arrive-data/.test(updateErr.message || '') || /column .* does not exist/i.test(updateErr.message || ''))) {
          const payload2: any = { ...baseDetails, arrive_date: details.etaDate, state: 3 };
          const res2 = await supabase.from('containers').update(payload2).eq('container_id', containerId);
          updateErr = res2.error;
        }
        // Si el problema era tracking_link inexistente, reintentar sin él
        if (updateErr && /tracking_link/.test(updateErr.message || '')) {
          const baseWithoutLink = { ...baseDetails };
          delete (baseWithoutLink as any).tracking_link;
          const payloadRetry: any = { ...baseWithoutLink, arrive_date: details.etaDate, state: 3 };
          const resRetry = await supabase.from('containers').update(payloadRetry).eq('container_id', containerId);
          updateErr = resRetry.error;
        }
        // Si aún falla (p.ej. RLS en columnas de tracking), al menos cambiar el estado
        if (updateErr) {
          const resState = await supabase.from('containers').update({ state: 3 }).eq('container_id', containerId);
          if (resState.error) throw resState.error;
          toast({ title: t('chinese.ordersPage.toasts.containerSentTitle'), description: t('chinese.ordersPage.toasts.partialTrackingSave', { defaultValue: 'Estado cambiado, pero no se guardaron datos de tracking. Revisa políticas/columnas.' }) });
          updateErr = null;
        }
      } else {
        const { error } = await supabase.from('containers').update({ state: 3 }).eq('container_id', containerId);
        updateErr = error;
      }
      if (updateErr) throw updateErr;

      // Cascadas: cajas->4, pedidos->9
      const { data: boxRows } = await supabase.from('boxes').select('box_id').eq('container_id', containerId);
      const boxIds = (boxRows || []).map((r: any) => r.box_id).filter((v: any) => v != null);
      if (boxIds.length > 0) {
        await supabase.from('boxes').update({ state: 4 }).in('box_id', boxIds as any);
        await supabase.from('orders').update({ state: 9 }).in('box_id', boxIds as any);
      }

      toast({ title: t('chinese.ordersPage.toasts.containerSentTitle') });

      // Actualizar UI local
      setContainers(prev => prev.map(c => {
        const cid = c.container_id ?? c.containers_id ?? c.id;
        if (String(cid) === String(containerId)) return { ...c, state: 3 } as any;
        return c;
      }));
      setBoxes(prev => prev.map(b => {
        if (String((b as any).container_id) === String(containerId)) return { ...b, state: 4 } as any;
        return b;
      }));
      setBoxesByContainer(prev => prev.map(b => {
        if (String((b as any).container_id) === String(containerId)) return { ...b, state: 4 } as any;
        return b;
      }));
      return true;
    } catch (e: any) {
      console.error(e);
      toast({ title: t('chinese.ordersPage.toasts.sendErrorTitle'), description: e?.message || t('chinese.ordersPage.toasts.tryAgainLater') });
      return false;
    }
  };

  // Stats
  const stats = {
    pendientes: pedidos.filter(p => p.estado === 'pendiente').length,
    cotizados: pedidos.filter(p => p.estado === 'cotizado').length,
    procesando: pedidos.filter(p => p.estado === 'procesando').length,
    enviados: pedidos.filter(p => p.estado === 'enviado').length,
    totalCotizado: pedidos.filter(p => p.precio && (!p.numericState || p.numericState < 9)).reduce((acc, p) => acc + (p.precio || 0), 0),
    esteMes: pedidos.length
  };

  // Generar etiqueta PDF 50x35 mm
  async function handleGenerateOrderLabelPdf(pedidoId?: number) {
    if (!pedidoId) {
      toast({ title: t('chinese.ordersPage.modals.labelWarning.toastTitleError', { defaultValue: 'Error generando' }), description: t('chinese.ordersPage.modals.labelWarning.noId', { defaultValue: 'ID de pedido no disponible' }) });
      return;
    }
    try {
      const labelW = 50; // mm
      const labelH = 35; // mm
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [labelH, labelW] });
      const padding = 3;
      doc.setFillColor(255, 255, 255); doc.rect(0, 0, labelW, labelH, 'F');
      doc.setDrawColor(40, 40, 45); doc.setLineWidth(0.4); doc.roundedRect(0.7, 0.7, labelW - 1.4, labelH - 1.4, 2, 2);
      let logoData: string | undefined;
      try { logoData = await svgToPngDataUrl('/pita_icon.svg', 120); } catch { /* ignore logo errors */ }
      doc.setFillColor(15, 76, 129); doc.rect(0, 0, labelW, 9, 'F');
      if (logoData) {
        try { doc.addImage(logoData, 'PNG', 2, 1.2, 7, 7); } catch {/* ignore */ }
      } else {
        // fallback simple
        doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFontSize(6); doc.text('PITA', 4.5, 5, { align: 'center' });
      }
      doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.text('PITA EXPRESS', labelW / 2, 5.2, { align: 'center' });
      const code = `#PED-${String(pedidoId).padStart(3, '0')}`;
      doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 25); doc.setFontSize(16); doc.text(code, labelW / 2, 20, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2); doc.setTextColor(60, 60, 65);
      const desc = t('chinese.ordersPage.modals.labelWarning.description', { defaultValue: 'Asegúrate de poner la etiqueta al producto antes de empaquetar.' });
      doc.text(doc.splitTextToSize(desc, labelW - 8), labelW / 2, 26.5, { align: 'center' });
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setLabelDownloaded(true); // Marcar como descargada
      toast({ title: t('chinese.ordersPage.modals.labelWarning.toastTitleSuccess', { defaultValue: 'Etiqueta lista' }), description: t('chinese.ordersPage.modals.labelWarning.downloaded', { defaultValue: 'Etiqueta generada' }) });
    } catch (e) {
      console.error(e);
      toast({ title: t('chinese.ordersPage.modals.labelWarning.toastTitleError', { defaultValue: 'Error generando' }), description: t('chinese.ordersPage.modals.labelWarning.downloadError', { defaultValue: 'No se pudo generar la etiqueta' }) });
    }
  }



  // Filtrar pedidos localmente
  const pedidosFiltrados = pedidos.filter(p => {
    if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
    if (filtroCliente && !p.cliente.toLowerCase().includes(filtroCliente.toLowerCase())) return false;
    return true;
  });

  // Agrupar pedidos filtrados para visualización
  const visibleGroups = groupOrders(pedidosFiltrados);

  // Componente de Grupo (Batch Header)
  function OrderBatchGroup({ group }: { group: OrderGroup }) {
    const [expanded, setExpanded] = useState(true);
    const { t } = useTranslation();

    // Formatear fecha relativa (ej: "Hace 5 min")
    const getTimeAgo = (dateStr: string) => {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Hace un momento';
      if (mins < 60) return `Hace ${mins} min`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `Hace ${hours} h`;
      return new Date(dateStr).toLocaleDateString();
    };

    return (
      <div className={`mb-6 border rounded-lg shadow-sm overflow-hidden ${mounted && theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Header del Lote */}
        <div
          className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-colors ${mounted && theme === 'dark' ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start gap-4">
            {/* Icono / Avatar Cliente */}
            <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold shrink-0 ${mounted && theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
              {group.clientName.charAt(0).toUpperCase()}
            </div>

            <div>
              {/* Título Principal: Rango de IDs */}
              <h3 className={`text-lg font-bold flex items-center gap-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                <span className={`font-mono ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                  {group.orders.length > 1
                    ? `#ORD-${group.minId} - ${group.maxId}`
                    : `#ORD-${group.minId}`
                  }
                </span>
                {group.orders.length > 1 && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {group.orders.length} pedidos
                  </Badge>
                )}
              </h3>

              {/* Subtítulo: Cliente y Fecha */}
              <div className={`text-sm flex items-center gap-2 mt-1 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                <User className="h-3 w-3" />
                <span className="font-medium">{group.clientName}</span>
                <span>•</span>
                <Calendar className="h-3 w-3" />
                <span>{getTimeAgo(group.date)}</span>
              </div>
            </div>
          </div>

          {/* Acciones Derecha */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-600' : ''}`}>
              <div className={`transform transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  <path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
              </div>
            </Button>
          </div>
        </div>

        {/* Lista de Pedidos (Acordeón) */}
        {/* Lista de Pedidos (Acordeón) con Animación */}
        <div className={`grid transition-all duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className={`p-4 pl-8 space-y-3 border-t ${mounted && theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/50 border-slate-200'}`}>
              {group.orders.map((pedido) => (
                <div key={pedido.id} className={`border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 ${mounted && theme === 'dark' ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700' : 'bg-white border-slate-200'}`}>
                  {renderPedidoRow(pedido)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper para renderizar la fila de pedido
  const renderPedidoRow = (p: Pedido) => {
    // Badges de alternativa
    const renderAlternativeBadge = () => {
      if (p.alternativeStatus === 'pending') {
        return (
          <Badge className="hidden sm:inline-block bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700">
            {t('chinese.ordersPage.badges.alternativeSent', { defaultValue: 'Alternativa enviada' })}
          </Badge>
        );
      }
      if (p.alternativeStatus === 'accepted') {
        return (
          <Badge className="hidden sm:inline-block bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
            {t('chinese.ordersPage.badges.alternativeAccepted', { defaultValue: 'Alternativa aceptada' })}
          </Badge>
        );
      }
      if (p.alternativeStatus === 'rejected') {
        return (
          <Badge className="hidden sm:inline-block bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
            {t('chinese.ordersPage.badges.alternativeRejected', { defaultValue: 'Alternativa rechazada' })}
          </Badge>
        );
      }
      return null;
    };

    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 justify-between rounded-xl transition-all duration-300">
        {/* Columna izquierda */}
        <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
          <div className={`p-3 rounded-lg shrink-0 ${mounted && theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
            <Package className={`h-5 w-5 ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`} />
          </div>
          <div className="space-y-1 w-full min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`font-semibold text-sm sm:text-base ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#ORD-{p.id}</h3>
              {renderAlternativeBadge()}
              {/* Badge estado principal */}
              {p.numericState === 2 ? (
                <Badge className={`hidden sm:inline-block border ${mounted && theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`}>
                  {t('chinese.ordersPage.filters.status.pending', { defaultValue: 'Pendiente' })}
                </Badge>
              ) : (
                <Badge className={`hidden sm:inline-block ${getOrderBadge(p.numericState).className}`}>
                  {getOrderBadge(p.numericState).label}
                </Badge>
              )}
            </div>
            <p className={`text-xs sm:text-sm truncate max-w-full ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{p.producto}</p>
            <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="flex items-center gap-1 min-w-[110px]">
                <User className="h-3 w-3" /> {p.cliente}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" /> {t('chinese.ordersPage.orders.qtyShort', { defaultValue: 'Cant' })}: {p.cantidad}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {new Date(p.fecha).toLocaleDateString('es-ES')}
              </span>
            </div>
          </div>
        </div>

        {/* Columna derecha / acciones */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          {p.precio && (
            <div className="hidden sm:block text-right space-y-1">
              <PriceDisplayWithCNY
                amount={p.precio}
                currency="USD"
                variant="inline"
                className="text-sm font-semibold text-green-600"
              />
            </div>
          )}
          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 justify-end sm:justify-end">
            {p.estado === 'enviado' && (p.numericState ?? 0) < 6 && (
              <Button
                size="sm"
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => {
                  setModalEmpaquetar({ open: true, pedidoId: p.id });
                  if (boxes.length === 0) fetchBoxes();
                }}
              >
                <Boxes className="h-4 w-4" />
                <span className="hidden sm:inline">{t('chinese.ordersPage.orders.pack', { defaultValue: 'Empaquetar' })}</span>
              </Button>
            )}
            {p.estado === 'enviado' && (p.numericState ?? 0) >= 6 && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1 text-amber-700 border-amber-300 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={(p.numericState ?? 0) >= 9}
                onClick={() => {
                  if ((p.numericState ?? 0) >= 9) return;
                  handleUnpackOrder(p.id);
                }}
              >
                <span className="hidden sm:inline">{t('chinese.ordersPage.orders.unpack', { defaultValue: 'Desempaquetar' })}</span>
                <Boxes className="h-4 w-4 sm:hidden" aria-label="Desempaquetar" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (p.pdfRoutes) {
                  const bust = p.pdfRoutes.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
                  window.open(p.pdfRoutes + bust, '_blank', 'noopener,noreferrer');
                } else {
                  toast({ title: t('chinese.ordersPage.orders.pdfMissingToastTitle', { defaultValue: 'PDF no disponible' }) });
                }
              }}
              className="flex items-center gap-1"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">{t('chinese.ordersPage.orders.view', { defaultValue: 'Ver' })}</span>
            </Button>

            {p.estado === 'pendiente' && (() => {
              // Ocultar botones si hay una alternativa pendiente
              if (p.alternativeStatus === 'pending') return null;

              return (!p.numericState || p.numericState < 9) ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 ${mounted && theme === 'dark' ? 'border-red-600 text-red-300 hover:bg-red-900/30 hover:border-red-500' : 'border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300'}`}
                    onClick={() => handleCancelOrder(p.id)}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    {t('chinese.ordersPage.modals.selectBoxForOrder.cancel', { defaultValue: 'Cancelar' })}
                  </Button>

                  <Button
                    onClick={() => setModalCotizar({
                      open: true,
                      pedido: p,
                      precioUnitario: p.unitQuote || undefined, // Changed from null to undefined
                      precioEnvio: p.shippingPrice || undefined, // Changed from null to undefined
                      altura: p.height || 0,
                      anchura: p.width || 0,
                      largo: p.long || 0,
                      peso: p.weight || 0,
                      precioUnitarioInput: p.unitQuote && p.unitQuote > 0 ? p.unitQuote.toString() : '',
                      precioEnvioInput: p.shippingPrice && p.shippingPrice > 0 ? p.shippingPrice.toString() : '',
                      alturaInput: p.height ? p.height.toString() : '',
                      anchuraInput: p.width ? p.width.toString() : '',
                      largoInput: p.long ? p.long.toString() : '',
                      pesoInput: p.weight ? p.weight.toString() : '',
                    })}
                    size="sm"
                    className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700"
                  >
                    <Calculator className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('chinese.ordersPage.orders.quote', { defaultValue: 'Cotizar' })}</span>
                  </Button>
                  {p.alternativeStatus !== 'accepted' && (
                    <Button
                      onClick={() => setModalPropAlternativa({ open: true, pedido: p })}
                      size="sm"
                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700"
                      title={t('chinese.ordersPage.tooltips.proposeAlternative', { defaultValue: 'Proponer alternativa' })}
                    >
                      <Send className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('chinese.ordersPage.orders.proposeAlternative', { defaultValue: 'Alternativa' })}</span>
                    </Button>
                  )}
                </>
              ) : null;
            })()}
            {/* Botón de editar eliminado a petición del usuario */}
          </div>
        </div>
      </div>
    );
  };

  // Filtrado de cajas por ID mostrado
  const cajasFiltradas = boxes.filter((box, idx) => {
    if (!filtroCaja) return true;
    const id = box.boxes_id ?? box.id ?? box.box_id ?? idx;
    return String(id).toLowerCase().includes(filtroCaja.toLowerCase());
  });

  // Cotizar pedido
  const cotizarPedido = async (pedido: Pedido, precioUnitario: number, precioEnvio: number, altura: number, anchura: number, largo: number, peso: number) => {
    // Validar que el pedido no esté ya enviado (state >= 9)
    if (pedido.numericState && pedido.numericState >= 9) {
      toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.toasts.orderAlreadyShipped') });
      setModalCotizar({ open: false });
      setIsModalCotizarClosing(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    // Obtener información completa del pedido para verificar el tipo de envío
    const { data: orderData, error: orderFetchError } = await supabase
      .from('orders')
      .select('deliveryType, shippingType')
      .eq('id', pedido.id)
      .single();

    if (orderFetchError) {
      console.error('Error obteniendo información del pedido:', orderFetchError);
    }

    // Entradas ahora en CNY (¥): convertir a USD para guardar en totalQuote
    const totalProductosCNY = Number(precioUnitario) * Number(pedido.cantidad || 0);
    const totalCNY = totalProductosCNY + Number(precioEnvio);
    const rate = cnyRate && cnyRate > 0 ? cnyRate : 7.25;
    const totalUSDBase = totalCNY / rate;

    // Obtener el margen de ganancia actual desde la configuración
    const currentProfitMargin = await fetchProfitMargin();
    setProfitMargin(currentProfitMargin); // Actualizar estado para referencia futura

    // Aplicar margen de ganancia: precioConMargen = precioBase × (1 + margen/100)
    // Ejemplo: $1000 × (1 + 25/100) = $1000 × 1.25 = $1250
    let totalUSDConMargen = totalUSDBase * (1 + currentProfitMargin / 100);

    // Si el pedido es aéreo, calcular y sumar el costo de envío aéreo
    const isAirShipping = orderData?.deliveryType === 'air' || orderData?.shippingType === 'air' || pedido.deliveryType === 'air' || pedido.shippingType === 'air';

    if (isAirShipping && peso > 0) {
      // Obtener la tarifa de envío aéreo desde la configuración
      const airShippingRate = await fetchAirShippingRate();

      // Calcular costo de envío aéreo: peso × tarifa por kg
      const costoEnvioAereo = Number(peso) * airShippingRate;

      // Sumar el costo de envío al precio con margen
      totalUSDConMargen = totalUSDConMargen + costoEnvioAereo;

      console.log(`Pedido aéreo: peso=${peso}kg, tarifa=$${airShippingRate}/kg, costo envío=$${costoEnvioAereo}, precio final=$${totalUSDConMargen}`);
    }

    // Si el pedido es marítimo, calcular y sumar el costo de envío marítimo
    const isSeaShipping = orderData?.deliveryType === 'maritime' || orderData?.shippingType === 'maritime' || orderData?.shippingType === 'sea' || pedido.deliveryType === 'maritime' || pedido.shippingType === 'maritime' || pedido.shippingType === 'sea';

    if (isSeaShipping && altura > 0 && anchura > 0 && largo > 0) {
      // Obtener la tarifa de envío marítimo desde la configuración
      const seaShippingRate = await fetchSeaShippingRate();

      // Convertir dimensiones de cm a metros
      const alturaMetros = Number(altura) / 100;
      const anchuraMetros = Number(anchura) / 100;
      const largoMetros = Number(largo) / 100;

      // Calcular volumen en metros cúbicos
      const volumen = alturaMetros * anchuraMetros * largoMetros;

      // Calcular costo de envío marítimo: volumen × tarifa por m³
      const costoEnvioMaritimo = volumen * seaShippingRate;

      // Sumar el costo de envío al precio con margen
      totalUSDConMargen = totalUSDConMargen + costoEnvioMaritimo;

      console.log(`Pedido marítimo: dimensiones=${altura}×${anchura}×${largo}cm (${volumen.toFixed(3)}m³), tarifa=$${seaShippingRate}/m³, costo envío=$${costoEnvioMaritimo.toFixed(2)}, precio final=$${totalUSDConMargen.toFixed(2)}`);
    }

    // 1) Actualizar totalQuote en la tabla orders con el precio que incluye el margen y envío aéreo/marítimo (si aplica)
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        totalQuote: totalUSDConMargen, // Guardar precio final: precioBase + margen + envío aéreo/marítimo (si aplica)
        unitQuote: precioUnitario,
        shippingPrice: precioEnvio,
        height: altura,
        width: anchura,
        long: largo,
        weight: peso
      })
      .eq('id', pedido.id);
    if (updateError) {
      alert('Error al actualizar la cotización en la base de datos.');
      console.error('Error update totalQuote:', updateError);
      return;
    }
    // 2) Cambiar estado a 3 vía API para disparar notificaciones del lado servidor
    try {
      await fetch(`/api/orders/${pedido.id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 3, changed_by: 'china', notes: 'Pedido cotizado' }),
      });
    } catch (e) {
      console.error('No se pudo notificar cambio de estado a 3', e);
    }

    // Actualizar estado local y cerrar modal (sin PDF)
    setPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, cotizado: true, estado: 'cotizado', precio: precioUnitario, totalQuote: totalUSDConMargen, numericState: 3 } : p));
    setModalCotizar({ open: false });
    setIsModalCotizarClosing(false);
  };  // getStatusColor/Text ya no se usan; sustituido por getOrderBadge basado en estado numérico

  // Asignar pedido a caja (empaquetar)
  const handleSelectCajaForPedido = async (pedidoId: number, box: BoxItem) => {
    // Esta versión ahora se invoca luego de aceptar la etiqueta
    const boxId = box.box_id ?? box.boxes_id ?? box.id;
    if (!boxId) {
      toast({ title: t('chinese.ordersPage.toasts.invalidBoxTitle'), description: t('chinese.ordersPage.toasts.invalidBoxDesc') });
      return;
    }
    try {
      const supabase = getSupabaseBrowserClient();

      // Encontrar el pedido actual para obtener su shippingType
      const pedidoActual = pedidos.find(p => p.id === pedidoId);
      if (!pedidoActual) {
        toast({ title: t('chinese.ordersPage.toasts.orderNotFoundTitle'), description: t('chinese.ordersPage.toasts.orderNotFoundDesc') });
        return;
      }

      // Verificar shippingType de pedidos existentes en la caja
      const { data: existingOrders, error: fetchError } = await supabase
        .from('orders')
        .select('shippingType')
        .eq('box_id', boxId);

      if (fetchError) {
        console.error('Error obteniendo pedidos existentes:', fetchError);
        toast({ title: t('chinese.ordersPage.toasts.fetchErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
        return;
      }

      // Obtener tipos de envío únicos de pedidos existentes
      const existingShippingTypes = existingOrders?.map(o => o.shippingType).filter(st => st && st.trim() !== '') || [];
      const uniqueShippingTypes = Array.from(new Set(existingShippingTypes));

      // Verificar reglas de shippingType
      if (uniqueShippingTypes.length > 1) {
        // Hay diferentes shippingTypes en la caja
        toast({ title: t('chinese.ordersPage.toasts.shippingTypeMismatchTitle'), description: t('chinese.ordersPage.toasts.shippingTypeMultipleDesc') });
        return;
      }

      if (uniqueShippingTypes.length === 1 && uniqueShippingTypes[0] !== pedidoActual.shippingType) {
        // El shippingType del pedido no coincide con el de la caja
        toast({ title: t('chinese.ordersPage.toasts.shippingTypeMismatchTitle'), description: t('chinese.ordersPage.toasts.shippingTypeMismatchDesc') });
        return;
      }

      // No permitir empaquetar en cajas enviadas o contenedores enviados
      const boxStateNumCheck = (box.state ?? 1) as number;
      if (boxStateNumCheck >= 3) {
        toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.toasts.packInShippedBoxDesc') });
        return;
      }
      if ((box as any)?.container_id) {
        const { data: contRow, error: contErr } = await supabase
          .from('containers')
          .select('state')
          .eq('container_id', (box as any).container_id)
          .maybeSingle();
        if (contErr) {
          console.error('Error verificando contenedor:', contErr);
        }
        const contState = (contRow?.state ?? 1) as number;
        if (contState >= 3) {
          toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.toasts.packInBoxOfShippedContainerDesc') });
          return;
        }
      }
      // Si la caja ya está empaquetada (state=2), el pedido debe pasar a state=7 (en contenedor)
      const boxStateNum = (box.state ?? 1) as number;
      const nextOrderState = boxStateNum === 2 ? 7 : 6;
      const { error } = await supabase
        .from('orders')
        .update({ box_id: boxId, state: nextOrderState })
        .eq('id', pedidoId);
      if (error) {
        console.error('Error asignando caja:', error);
        toast({ title: t('chinese.ordersPage.toasts.assignBoxErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
        return;
      }
      toast({ title: t('chinese.ordersPage.toasts.orderAssignedTitle'), description: t('chinese.ordersPage.toasts.orderAssignedDesc', { orderId: pedidoId, boxId: boxId }) });
      // Reflejar inmediatamente en UI que el pedido pasó a estado 6
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, numericState: nextOrderState } : p));

      // Incrementar conteo local de pedidos por caja en la lista principal
      setOrderCountsByBoxMain(prev => ({
        ...prev,
        [boxId as any]: (prev[boxId as any] || 0) + 1,
      }));

      // Si el modal de cajas por contenedor está abierto y la caja pertenece a ese contenedor, actualizar también ese contador
      const containerIdOfBox = (box as any)?.container_id;
      setOrderCountsByBox(prev => {
        // Solo tocar si el modal está abierto y corresponde al contenedor de la caja
        if (modalVerPedidosCont.open && modalVerPedidosCont.containerId && containerIdOfBox && String(modalVerPedidosCont.containerId) === String(containerIdOfBox)) {
          return {
            ...prev,
            [boxId as any]: (prev[boxId as any] || 0) + 1,
          };
        }
        return prev;
      });
      closeModalEmpaquetar();
    } catch (e) {
      console.error(e);
      toast({ title: t('chinese.ordersPage.toasts.unexpectedErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainLater') });
    }
  };

  // Desempaquetar pedido individual: remover de caja y regresar a estado 5
  const handleUnpackOrder = async (pedidoId: number) => {
    try {
      const supabase = getSupabaseBrowserClient();
      // Obtener box_id actual del pedido para ajustar conteos
      const { data: orderRow, error: fetchErr } = await supabase
        .from('orders')
        .select('id, box_id')
        .eq('id', pedidoId)
        .single();
      if (fetchErr) {
        console.error('No se pudo obtener el pedido para desempaquetar:', fetchErr);
        toast({ title: t('chinese.ordersPage.toasts.unassignErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
        return;
      }
      const boxId = (orderRow as any)?.box_id as number | string | null;
      if (!boxId) {
        toast({ title: t('chinese.ordersPage.toasts.orderWithoutBoxTitle'), description: t('chinese.ordersPage.toasts.orderWithoutBoxDesc') });
        return;
      }
      // Si la caja está dentro de un contenedor enviado o la caja fue enviada, bloquear
      const { data: boxRow, error: boxErr } = await supabase
        .from('boxes')
        .select('state, container_id')
        .eq('box_id', boxId)
        .maybeSingle();
      if (boxErr) {
        console.error('Error verificando caja:', boxErr);
      }
      const bState = (boxRow?.state ?? 1) as number;
      if (bState >= 3) {
        toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.toasts.unpackOrdersFromShippedBoxDesc') });
        return;
      }
      if (boxRow?.container_id) {
        const { data: cRow, error: cErr } = await supabase
          .from('containers')
          .select('state')
          .eq('container_id', boxRow.container_id)
          .maybeSingle();
        if (cErr) {
          console.error('Error verificando contenedor:', cErr);
        }
        const cState = (cRow?.state ?? 1) as number;
        if (cState >= 3) {
          toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.toasts.unpackOrdersFromShippedContainerDesc') });
          return;
        }
      }
      // Limpiar relación y bajar a estado 5
      const { error: updErr } = await supabase
        .from('orders')
        .update({ box_id: null, state: 5 })
        .eq('id', pedidoId);
      if (updErr) {
        console.error('Error al desempaquetar pedido:', updErr);
        toast({ title: t('chinese.ordersPage.toasts.unassignErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
        return;
      }
      toast({ title: t('chinese.ordersPage.toasts.orderUnassignedTitle'), description: t('chinese.ordersPage.toasts.orderUnassignedDesc', { orderId: pedidoId }) });
      // Actualizar UI: estado del pedido
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, numericState: 5 } : p));
      // Ajustar conteo local de la caja en vistas principales
      setOrderCountsByBoxMain(prev => {
        if (boxId === null || boxId === undefined) return prev;
        const current = prev[boxId as any] || 0;
        return { ...prev, [boxId as any]: Math.max(0, current - 1) };
      });
      setOrderCountsByBox(prev => {
        if (boxId === null || boxId === undefined) return prev;
        const current = prev[boxId as any] || 0;
        return { ...prev, [boxId as any]: Math.max(0, current - 1) };
      });
      // Si el modal de pedidos por caja está abierto para esa caja, refrescar
      if (modalVerPedidos.open && modalVerPedidos.boxId && String(modalVerPedidos.boxId) === String(boxId)) {
        await fetchOrdersByBoxId(modalVerPedidos.boxId);
      }
    } catch (e) {
      console.error(e);
      toast({ title: t('chinese.ordersPage.toasts.unexpectedErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgainLater') });
    }
  };



  if (!mounted) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${mounted && theme === 'dark' ? 'border-blue-400' : 'border-blue-600'} mx-auto`}></div>
          <p className={`mt-4 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>{t('chinese.ordersPage.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 transition-all duration-300 px-2 sm:px-4 lg:px-6">
        <Header
          notifications={unreadCount || 0}
          onMenuToggle={toggleMobileMenu}
          title={t('chinese.ordersPage.title')}
          subtitle={t('chinese.ordersPage.subtitle')}
          showTitleOnMobile
          notificationsItems={notificationsList.filter(n => n.unread)}
          onMarkAllAsRead={async () => { await markAllAsRead(); }}
          onOpenNotifications={() => { router.push('/china/pedidos'); }}
          onItemClick={(id) => { markOneAsRead(id); }}
          notificationsRole="china"
          notificationsUserId={chinaId}
        />

        <div className="p-4 md:p-5 lg:p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Estadísticas en tarjetas (como Venezuela) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 dark:from-yellow-900/20 dark:to-orange-900/20 dark:border-yellow-700">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm md:text-base font-medium text-yellow-700 dark:text-yellow-300">{t('chinese.ordersPage.stats.pending')}</p>
                    <p className="text-2xl md:text-3xl font-bold text-yellow-800 dark:text-yellow-200">{stats.pendientes}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 dark:bg-yellow-800/30 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 md:w-6 md:h-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 dark:from-purple-900/20 dark:to-violet-900/20 dark:border-purple-700">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm md:text-base font-medium text-purple-700 dark:text-purple-300">{t('chinese.ordersPage.stats.quoted')}</p>
                    <p className="text-2xl md:text-3xl font-bold text-purple-800 dark:text-purple-200">{stats.cotizados}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 dark:bg-purple-800/30 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 md:w-6 md:h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-700">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm md:text-base font-medium text-blue-700 dark:text-blue-300">{t('chinese.ordersPage.stats.processing')}</p>
                    <p className="text-2xl md:text-3xl font-bold text-blue-800 dark:text-blue-200">{stats.procesando}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-800/30 rounded-lg flex items-center justify-center">
                    <Truck className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-700">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm md:text-base font-medium text-green-700 dark:text-green-300">{t('chinese.ordersPage.stats.shipped')}</p>
                    <p className="text-2xl md:text-3xl font-bold text-green-800 dark:text-green-200">{stats.enviados}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>





          {/* Tabs: Lista de pedidos | Cajas | Contenedores (con indicador deslizante) */}
          <div className="flex justify-start">
            <div className="w-full">
              <div className="relative flex w-full gap-1 rounded-lg border border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-800/60 backdrop-blur px-1 py-1 shadow-sm overflow-hidden">
                {/* Indicador deslizante */}
                <span
                  className="absolute top-1 bottom-1 rounded-md bg-slate-900/95 dark:bg-slate-200 transition-all duration-300 ease-out shadow-sm"
                  style={{
                    left: `${(['pedidos', 'cajas', 'contenedores'] as const).indexOf(activeTab) * (100 / 3)}%`,
                    width: 'calc((100% - 0.25rem * 2) / 3)' // gap-1 => 0.25rem
                  }}
                />
                {(['pedidos', 'cajas', 'contenedores'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={'relative z-10 flex-1 min-w-0 px-2 py-2 rounded-md text-[11px] xs:text-xs sm:text-sm font-medium truncate transition-colors duration-200 ' +
                      (activeTab === tab
                        ? 'text-white dark:text-slate-900'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white')}
                  >
                    {tab === 'pedidos' && t('chinese.ordersPage.tabs.ordersList')}
                    {tab === 'cajas' && t('chinese.ordersPage.tabs.boxes')}
                    {tab === 'contenedores' && t('chinese.ordersPage.tabs.containers')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Header unificado + contenido dinámico */}
          <Card className={`${mounted && theme === 'dark' ? 'bg-slate-800/70 dark:border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-sm`}>
            <CardHeader className="py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  {activeTab === 'pedidos' && <Package className="h-5 w-5" />}
                  {activeTab === 'cajas' && <Boxes className="h-5 w-5" />}
                  {activeTab === 'contenedores' && <Boxes className="h-5 w-5" />}
                  <span>{activeTab === 'pedidos' ? t('chinese.ordersPage.tabs.ordersList') : activeTab === 'cajas' ? t('chinese.ordersPage.tabs.boxes') : t('chinese.ordersPage.tabs.containers')}</span>
                </CardTitle>
                <div className="w-full sm:w-auto grid grid-cols-1 sm:flex sm:items-center sm:justify-end gap-2 md:gap-3">
                  {activeTab === 'pedidos' && (
                    <>
                      <Input
                        placeholder={t('chinese.ordersPage.filters.searchClientPlaceholder')}
                        value={filtroCliente}
                        onChange={(e) => setFiltroCliente(e.target.value)}
                        className={`h-10 w-full sm:w-64 px-3 ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : ''}`}
                      />
                      <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                        <SelectTrigger className={`h-10 w-full sm:w-56 px-3 whitespace-nowrap truncate ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : ''}`}>
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">{t('chinese.ordersPage.filters.status.all')}</SelectItem>
                          <SelectItem value="pendiente">{t('chinese.ordersPage.filters.status.pending')}</SelectItem>
                          <SelectItem value="cotizado">{t('chinese.ordersPage.filters.status.quoted')}</SelectItem>
                          <SelectItem value="procesando">{t('chinese.ordersPage.filters.status.processing')}</SelectItem>
                          <SelectItem value="enviado">{t('chinese.ordersPage.filters.status.shipped')}</SelectItem>
                          <SelectItem value="cancelado">{t('chinese.ordersPage.filters.status.cancelled', { defaultValue: 'Cancelado' })}</SelectItem>
                        </SelectContent>
                      </Select>
                      <ArchiveHistoryButton
                        role="china"
                        userId={chinaId || ''}
                        onSuccess={() => fetchPedidos()}
                      />
                    </>
                  )}
                  {activeTab === 'cajas' && (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={t('chinese.ordersPage.filters.searchBoxPlaceholder')}
                        value={filtroCaja}
                        onChange={(e) => setFiltroCaja(e.target.value)}
                        className={`h-10 w-full sm:w-64 px-3 ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : ''}`}
                      />
                      <Button
                        size="sm"
                        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
                        onClick={() => setModalCrearCaja({ open: true })}
                      >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('chinese.ordersPage.boxes.create')}</span>
                      </Button>
                    </div>
                  )}
                  {activeTab === 'contenedores' && (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={t('chinese.ordersPage.filters.searchContainerPlaceholder')}
                        value={filtroContenedor}
                        onChange={(e) => setFiltroContenedor(e.target.value)}
                        className={`h-10 w-full sm:w-64 px-3 ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : ''}`}
                      />
                      <Button
                        size="sm"
                        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
                        onClick={() => setModalCrearContenedor({ open: true })}
                      >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('chinese.ordersPage.containers.create')}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === 'pedidos' && (
                <>
                  <div className="space-y-4">
                    {visibleGroups.map((group) => (
                      <OrderBatchGroup key={group.groupId} group={group} />
                    ))}
                    {pedidosFiltrados.length === 0 && (
                      <div className="text-center py-12">
                        <Package className={`h-12 w-12 mx-auto mb-4 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                        <h3 className={`text-lg font-medium mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.orders.notFoundTitle')}</h3>
                        <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{t('chinese.ordersPage.orders.notFoundSubtitle')}</p>
                      </div>
                    )}
                  </div>

                  {/* Paginación */}
                  {totalOrders > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('chinese.ordersPage.pagination.showing', {
                          start: ((currentPage - 1) * ITEMS_PER_PAGE) + 1,
                          end: Math.min(currentPage * ITEMS_PER_PAGE, totalOrders),
                          total: totalOrders,
                          defaultValue: `Mostrando ${((currentPage - 1) * ITEMS_PER_PAGE) + 1} a ${Math.min(currentPage * ITEMS_PER_PAGE, totalOrders)} de ${totalOrders} pedidos`
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchPedidos(currentPage - 1)}
                          disabled={currentPage === 1 || loading}
                          className="h-9"
                        >
                          {t('chinese.ordersPage.pagination.previous', { defaultValue: 'Anterior' })}
                        </Button>
                        <div className="flex items-center gap-1 px-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t('chinese.ordersPage.pagination.pageInfo', {
                              current: currentPage,
                              total: totalPages,
                              defaultValue: `Página ${currentPage} de ${totalPages}`
                            })}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchPedidos(currentPage + 1)}
                          disabled={currentPage === totalPages || loading}
                          className="h-9"
                        >
                          {t('chinese.ordersPage.pagination.next', { defaultValue: 'Siguiente' })}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'cajas' && (
                <>
                  {boxes.length === 0 ? (
                    <div className="text-center py-12">
                      <Boxes className={`h-12 w-12 mx-auto mb-4 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                      <h3 className={`text-lg font-medium mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.boxes.noneTitle')}</h3>
                      <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{t('chinese.ordersPage.boxes.noneSubtitle')}</p>
                    </div>
                  ) : cajasFiltradas.length === 0 ? (
                    <div className="text-center py-12">
                      <Boxes className={`h-12 w-12 mx-auto mb-4 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                      <h3 className={`text-lg font-medium mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.boxes.notFoundTitle')}</h3>
                      <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{t('chinese.ordersPage.boxes.notFoundSubtitle')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cajasFiltradas.map((box, idx) => {
                        const id = box.boxes_id ?? box.id ?? box.box_id ?? idx;
                        const boxKey = box.box_id ?? box.boxes_id ?? box.id ?? id;
                        const created = box.creation_date ?? box.created_at ?? '';
                        const stateNum = (box.state ?? 1) as number;
                        return (
                          <div key={`${id}`} className={`flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 justify-between p-4 rounded-xl ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'} border hover:shadow-md transition-all duration-300`}>
                            <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                              <div className={`p-3 rounded-lg shrink-0 ${mounted && theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'}`}>
                                <Boxes className={`h-5 w-5 ${mounted && theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`} />
                              </div>
                              <div className="space-y-1 w-full min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className={`font-semibold text-sm sm:text-base ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#BOX-{id}</h3>
                                  {box?.name && (
                                    <span className={`text-xs sm:text-sm truncate max-w-full ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{String((box as any).name)}</span>
                                  )}
                                  <Badge className={`hidden sm:inline-block ${getBoxBadge(stateNum).className}`}>{getBoxBadge(stateNum).label}</Badge>
                                </div>
                                <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> {created ? new Date(created).toLocaleString('es-ES') : '—'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <List className="h-3 w-3" /> {t('chinese.ordersPage.boxes.ordersCount')} {orderCountsByBoxMain[boxKey as any] ?? 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 sm:gap-3 justify-end sm:justify-end">
                              <div className="sm:hidden">
                                <Badge className={`${getBoxBadge(stateNum).className}`}>{getBoxBadge(stateNum).label}</Badge>
                              </div>
                              {stateNum === 1 && (
                                boxShippingTypes[boxKey as any] === 'Aereo' ? (
                                  // Botón "Enviar" para cajas Aéreas (directo)
                                  <Button
                                    size="sm"
                                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={(orderCountsByBoxMain[boxKey as any] ?? 0) <= 0}
                                    onClick={() => {
                                      const currentBoxId = box.box_id ?? box.boxes_id ?? box.id;
                                      if (currentBoxId !== undefined) {
                                        handleSendBoxDirectly(currentBoxId);
                                      }
                                    }}
                                  >
                                    <Truck className="h-4 w-4" />
                                    <span className="hidden sm:inline">{t('chinese.ordersPage.boxes.send')}</span>
                                  </Button>
                                ) : (
                                  // Botón "Empaquetar" para cajas Marítimas (al contenedor)
                                  <Button
                                    size="sm"
                                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={(orderCountsByBoxMain[boxKey as any] ?? 0) <= 0}
                                    onClick={() => {
                                      const currentBoxId = box.box_id ?? box.boxes_id ?? box.id;
                                      setModalEmpaquetarCaja({ open: true, boxId: currentBoxId });
                                      if (containers.length === 0) fetchContainers();
                                    }}
                                  >
                                    <Boxes className="h-4 w-4" />
                                    <span className="hidden sm:inline">{t('chinese.ordersPage.boxes.pack')}</span>
                                  </Button>
                                )
                              )}
                              {stateNum === 2 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                                  onClick={() => {
                                    const currentBoxId = box.box_id ?? box.boxes_id ?? box.id;
                                    if (currentBoxId !== undefined) {
                                      handleUnpackBox(currentBoxId as any);
                                    }
                                  }}
                                >
                                  <span className="hidden sm:inline">{t('chinese.ordersPage.boxes.unpack')}</span>
                                  <Boxes className="h-4 w-4 sm:hidden" aria-label="Desempaquetar" />
                                </Button>
                              )}
                              {stateNum >= 3 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-1 text-amber-700 border-amber-300 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled
                                >
                                  <span className="hidden sm:inline">{t('chinese.ordersPage.boxes.unpack')}</span>
                                  <Boxes className="h-4 w-4 sm:hidden" aria-label="Desempaquetar" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1"
                                onClick={() => {
                                  const boxId = box.box_id ?? box.boxes_id ?? box.id;
                                  setModalVerPedidos({ open: true, boxId });
                                  if (boxId !== undefined) fetchOrdersByBoxId(boxId);
                                }}
                              >
                                <List className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('chinese.ordersPage.boxes.viewOrders')}</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1 text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={(box.state ?? 1) >= 3}
                                onClick={() => {
                                  const st = (box.state ?? 1) as number;
                                  if (st >= 3) {
                                    toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.toasts.deleteShippedBoxDesc') });
                                    return;
                                  }
                                  setModalEliminarCaja({ open: true, box });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('chinese.ordersPage.boxes.delete')}</span>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Paginación Cajas */}
                  {boxes.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                      <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t('chinese.ordersPage.pagination.showing', {
                          start: (currentBoxPage - 1) * ITEMS_PER_PAGE + 1,
                          end: Math.min(currentBoxPage * ITEMS_PER_PAGE, totalBoxes),
                          total: totalBoxes,
                          defaultValue: `Mostrando ${(currentBoxPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentBoxPage * ITEMS_PER_PAGE, totalBoxes)} de ${totalBoxes} cajas`
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchBoxes(currentBoxPage - 1)}
                          disabled={currentBoxPage === 1 || boxesLoading}
                          className={mounted && theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : ''}
                        >
                          {t('chinese.ordersPage.pagination.previous', { defaultValue: 'Anterior' })}
                        </Button>
                        <span className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          {t('chinese.ordersPage.pagination.pageInfo', {
                            current: currentBoxPage,
                            total: totalBoxPages,
                            defaultValue: `Página ${currentBoxPage} de ${totalBoxPages}`
                          })}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchBoxes(currentBoxPage + 1)}
                          disabled={currentBoxPage >= totalBoxPages || boxesLoading}
                          className={mounted && theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : ''}
                        >
                          {t('chinese.ordersPage.pagination.next', { defaultValue: 'Siguiente' })}
                        </Button>
                      </div>
                    </div>
                  )}
                  {boxesLoading && (
                    <p className={`text-center text-sm mt-4 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('chinese.ordersPage.boxes.loading')}</p>
                  )}
                </>
              )}
              {activeTab === 'contenedores' && (
                <>
                  {containers.length === 0 ? (
                    <div className="text-center py-12">
                      <Boxes className={`h-12 w-12 mx-auto mb-4 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                      <h3 className={`text-lg font-medium mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.containers.noneTitle')}</h3>
                      <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{t('chinese.ordersPage.containers.noneSubtitle')}</p>
                    </div>
                  ) : containers.filter((c, idx) => {
                    if (!filtroContenedor) return true;
                    const id = c.container_id ?? c.containers_id ?? c.id ?? idx;
                    return String(id).toLowerCase().includes(filtroContenedor.toLowerCase());
                  }).length === 0 ? (
                    <div className="text-center py-12">
                      <Boxes className={`h-12 w-12 mx-auto mb-4 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                      <h3 className={`text-lg font-medium mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.containers.notFoundTitle')}</h3>
                      <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{t('chinese.ordersPage.containers.notFoundSubtitle')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {containers.filter((c, idx) => {
                        if (!filtroContenedor) return true;
                        const id = c.container_id ?? c.containers_id ?? c.id ?? idx;
                        return String(id).toLowerCase().includes(filtroContenedor.toLowerCase());
                      }).map((container, idx) => {
                        const id = container.container_id ?? container.containers_id ?? container.id ?? idx;
                        const created = container.creation_date ?? container.created_at ?? '';
                        const stateNum = (container.state ?? 1) as number;
                        return (
                          <div key={`${id}`} className={`flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 justify-between p-4 rounded-xl ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'} border hover:shadow-md transition-all duration-300`}>
                            <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                              <div className={`p-3 rounded-lg shrink-0 ${mounted && theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'}`}>
                                <Boxes className={`h-5 w-5 ${mounted && theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`} />
                              </div>
                              <div className="space-y-1 w-full min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className={`font-semibold text-sm sm:text-base ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#CONT-{id}</h3>
                                  {container?.name && (
                                    <span className={`text-xs sm:text-sm truncate max-w-full ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{String((container as any).name)}</span>
                                  )}
                                  <Badge className={`hidden sm:inline-block ${getContainerBadge(stateNum).className}`}>{getContainerBadge(stateNum).label}</Badge>
                                </div>
                                <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> {created ? new Date(created).toLocaleString('es-ES') : '—'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 sm:gap-3 justify-end sm:justify-end">
                              <div className="sm:hidden">
                                <Badge className={`${getContainerBadge(stateNum).className}`}>{getContainerBadge(stateNum).label}</Badge>
                              </div>
                              <Button
                                size="sm"
                                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={stateNum !== 2}
                                onClick={() => {
                                  const id = container.container_id ?? container.containers_id ?? container.id;
                                  if (id !== undefined && (containerSendInfo as any)[id]) {
                                    const saved = (containerSendInfo as any)[id];
                                    setSendTrackingNumber(saved.trackingNumber);
                                    setSendCourierCompany(saved.courierCompany);
                                    setSendEtaDate(saved.etaDate);
                                  } else {
                                    setSendTrackingNumber('');
                                    setSendCourierCompany('');
                                    setSendEtaDate('');
                                  }
                                  setModalEnviarContenedor({ open: true, container });
                                }}
                              >
                                <Truck className="h-4 w-4" /> <span className="hidden sm:inline">{t('chinese.ordersPage.containers.send')}</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1"
                                onClick={() => {
                                  const containerId = container.container_id ?? container.containers_id ?? container.id;
                                  setModalVerPedidosCont({ open: true, containerId });
                                  if (containerId !== undefined) fetchBoxesByContainerId(containerId as any);
                                }}
                              >
                                <List className="h-4 w-4" /> <span className="hidden sm:inline">{t('chinese.ordersPage.containers.viewBoxes')}</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1 text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={(container.state ?? 1) >= 3}
                                onClick={() => {
                                  const st = (container.state ?? 1) as number;
                                  if (st >= 3) {
                                    toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.toasts.deleteShippedContainerDesc') });
                                    return;
                                  }
                                  setModalEliminarContenedor({ open: true, container });
                                }}
                              >
                                <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">{t('chinese.ordersPage.containers.delete')}</span>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Paginación Contenedores */}
                  {containers.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                      <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t('chinese.ordersPage.pagination.showing', {
                          start: (currentContainerPage - 1) * ITEMS_PER_PAGE + 1,
                          end: Math.min(currentContainerPage * ITEMS_PER_PAGE, totalContainers),
                          total: totalContainers,
                          defaultValue: `Mostrando ${(currentContainerPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentContainerPage * ITEMS_PER_PAGE, totalContainers)} de ${totalContainers} contenedores`
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchContainers(currentContainerPage - 1)}
                          disabled={currentContainerPage === 1 || containersLoading}
                          className={mounted && theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : ''}
                        >
                          {t('chinese.ordersPage.pagination.previous', { defaultValue: 'Anterior' })}
                        </Button>
                        <span className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          {t('chinese.ordersPage.pagination.pageInfo', {
                            current: currentContainerPage,
                            total: totalContainerPages,
                            defaultValue: `Página ${currentContainerPage} de ${totalContainerPages}`
                          })}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchContainers(currentContainerPage + 1)}
                          disabled={currentContainerPage >= totalContainerPages || containersLoading}
                          className={mounted && theme === 'dark' ? 'border-slate-700 hover:bg-slate-800' : ''}
                        >
                          {t('chinese.ordersPage.pagination.next', { defaultValue: 'Siguiente' })}
                        </Button>
                      </div>
                    </div>
                  )}
                  {containersLoading && (
                    <p className="text-center text-sm text-slate-500 mt-4">{t('chinese.ordersPage.containers.loading')}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modal Enviar Contenedor: tracking + confirm */}
        {modalEnviarContenedor.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalEnviarContenedorRef}
              className={`${mounted && theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 max-w-md mx-4 w-full transition-all duration-300 ${isModalEnviarContenedorClosing
                ? 'translate-y-full scale-95 opacity-0'
                : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.sendContainer.title')}</h3>
                <Button variant="ghost" size="sm" onClick={closeModalEnviarContenedor} className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : ''}`}>
                  <span className={`text-2xl ${mounted && theme === 'dark' ? 'text-white' : ''}`}>×</span>
                </Button>
              </div>
              <p className={`mb-4 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('chinese.ordersPage.modals.sendContainer.subtitle')}</p>
              {/* Helper local para validar URL */}
              {/** Nota: validación simple usando URL constructor */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const urlOk = (() => { try { new URL(sendTrackingLink); return true; } catch { return false; } })();
                  if (!modalEnviarContenedor.container) return;
                  if (!sendTrackingLink.trim() || !urlOk || !sendTrackingNumber.trim() || !sendCourierCompany.trim() || !sendEtaDate.trim()) {
                    if (!urlOk) {
                      toast({ title: t('chinese.ordersPage.toasts.notAllowedTitle'), description: t('chinese.ordersPage.modals.sendContainer.invalidTrackingLink', { defaultValue: 'El enlace de tracking no es válido.' }) });
                    }
                    return;
                  }
                  setSendingContainer(true);
                  const ok = await handleSendContainer(modalEnviarContenedor.container, {
                    trackingLink: sendTrackingLink.trim(),
                    trackingNumber: sendTrackingNumber.trim(),
                    courierCompany: sendCourierCompany.trim(),
                    etaDate: sendEtaDate,
                  });
                  setSendingContainer(false);
                  if (ok) {
                    const id = modalEnviarContenedor.container.container_id ?? modalEnviarContenedor.container.containers_id ?? modalEnviarContenedor.container.id;
                    if (id !== undefined) {
                      setContainerSendInfo(prev => ({
                        ...prev,
                        [id as any]: {
                          trackingNumber: sendTrackingNumber.trim(),
                          courierCompany: sendCourierCompany.trim(),
                          etaDate: sendEtaDate,
                        },
                      }));
                    }
                    closeModalEnviarContenedor();
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.sendContainer.trackingLink')}</label>
                  <Input
                    value={sendTrackingLink}
                    onChange={(e) => setSendTrackingLink(e.target.value)}
                    placeholder={t('chinese.ordersPage.modals.sendContainer.trackingLinkPlaceholder')}
                    type="url"
                    required
                    className={mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.sendContainer.trackingNumber')}</label>
                  <Input
                    value={sendTrackingNumber}
                    onChange={(e) => setSendTrackingNumber(e.target.value.slice(0, 50))}
                    placeholder={t('chinese.ordersPage.modals.sendContainer.trackingNumberPlaceholder')}
                    maxLength={50}
                    required
                    className={mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.sendContainer.courierCompany')}</label>
                  <Input
                    value={sendCourierCompany}
                    onChange={(e) => setSendCourierCompany(e.target.value.slice(0, 50))}
                    placeholder={t('chinese.ordersPage.modals.sendContainer.courierCompanyPlaceholder')}
                    maxLength={50}
                    required
                    className={mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.sendContainer.etaDate')}</label>
                  <Input
                    type="date"
                    value={sendEtaDate}
                    onChange={(e) => setSendEtaDate(e.target.value)}
                    required
                    className={mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : ''}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={closeModalEnviarContenedor} disabled={sendingContainer}>
                    {t('chinese.ordersPage.modals.sendContainer.cancel')}
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={
                    sendingContainer ||
                    !sendTrackingLink.trim() ||
                    (() => { try { new URL(sendTrackingLink); return false; } catch { return true; } })() ||
                    !sendTrackingNumber.trim() ||
                    !sendCourierCompany.trim() ||
                    !sendEtaDate.trim()
                  }>
                    {sendingContainer ? t('chinese.ordersPage.modals.sendContainer.sending') : t('chinese.ordersPage.modals.sendContainer.confirm')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Cotizar */}
        {modalCotizar.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalCotizarRef}
              className={`${mounted && theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 max-w-2xl mx-4 w-full max-h-[90vh] overflow-y-auto transition-all duration-300 ${isModalCotizarClosing
                ? 'translate-y-full scale-95 opacity-0'
                : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.quote.title')}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeModalCotizar}
                  className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : ''}`}
                >
                  <span className={`text-2xl ${mounted && theme === 'dark' ? 'text-white' : ''}`}>×</span>
                </Button>
              </div>
              <form onSubmit={e => {
                e.preventDefault();
                const precio = Number((e.target as any).precio.value);
                const precioEnvio = Number((e.target as any).precioEnvio.value);
                const altura = Number((e.target as any).altura.value);
                const anchura = Number((e.target as any).anchura.value);
                const largo = Number((e.target as any).largo.value);
                const peso = Number((e.target as any).peso.value);
                if (precio > 0 && modalCotizar.pedido) {
                  cotizarPedido(modalCotizar.pedido, precio, precioEnvio, altura, anchura, largo, peso);
                }
              }} className="space-y-6">
                <div className={`p-4 rounded-lg border ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-700' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'}`}>
                  <h4 className={`font-semibold mb-3 flex items-center gap-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    <Package className="h-4 w-4" />
                    {t('chinese.ordersPage.modals.quote.summaryTitle')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.client')}</p>
                      <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{modalCotizar.pedido?.cliente}</p>
                    </div>
                    <div>
                      <p className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.product')}</p>
                      <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{modalCotizar.pedido?.producto}</p>
                    </div>
                    <div>
                      <p className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.quantity')}</p>
                      <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{modalCotizar.pedido?.cantidad}</p>
                    </div>
                    <div>
                      <p className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.specifications')}</p>
                      <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{modalCotizar.pedido?.especificaciones || t('chinese.ordersPage.modals.quote.specificationsNA')}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.unitPriceLabel')}</label>
                  <div className="relative">
                    <span className={`absolute left-3 top-3 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>¥</span>
                    <input
                      type="text"
                      name="precio"
                      inputMode="decimal"
                      required
                      value={modalCotizar.precioUnitarioInput ?? ''}
                      className={`w-full pl-8 pr-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''} ${!modalCotizar.precioUnitarioInput || (modalCotizar.precioUnitario && modalCotizar.precioUnitario > 0) ? (mounted && theme === 'dark' ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600' : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500') : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                      placeholder={t('chinese.ordersPage.modals.quote.unitPricePlaceholder')}
                      onChange={e => {
                        // Aceptar coma o punto como separador decimal y permitir punto final temporal
                        let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                        const parts = raw.split('.');
                        let intPart = (parts[0] || '').slice(0, 7);
                        let decPart = (parts[1] || '').slice(0, 2);
                        // Reconstruir permitiendo punto aunque no haya decimales aún
                        const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                        const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                        setModalCotizar(prev => ({ ...prev, precioUnitario: numero, precioUnitarioInput: cleaned }));
                      }}
                    />
                    <p className={`mt-1 text-xs ${!modalCotizar.precioUnitarioInput || (modalCotizar.precioUnitario && modalCotizar.precioUnitario > 0) ? (mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500') : 'text-red-500'}`}>{!modalCotizar.precioUnitarioInput || (modalCotizar.precioUnitario && modalCotizar.precioUnitario > 0) ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' }) : t('chinese.ordersPage.modals.quote.validation.enterPrice', { defaultValue: 'Ingresa un precio mayor a 0' })}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.shippingPriceLabel')}</label>
                  <div className="relative">
                    <span className={`absolute left-3 top-3 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>¥</span>
                    <input
                      type="text"
                      name="precioEnvio"
                      inputMode="decimal"
                      required
                      value={modalCotizar.precioEnvioInput ?? ''}
                      className={`w-full pl-8 pr-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''} ${!modalCotizar.precioEnvioInput || (modalCotizar.precioEnvio !== undefined && modalCotizar.precioEnvio >= 0) ? (mounted && theme === 'dark' ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600' : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500') : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                      placeholder={t('chinese.ordersPage.modals.quote.shippingPricePlaceholder')}
                      onChange={e => {
                        // Aceptar coma o punto como separador decimal y permitir punto final temporal
                        let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                        const parts = raw.split('.');
                        let intPart = (parts[0] || '').slice(0, 7);
                        let decPart = (parts[1] || '').slice(0, 2);
                        const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                        const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                        setModalCotizar(prev => ({ ...prev, precioEnvio: numero, precioEnvioInput: cleaned }));
                      }}
                    />
                    <p className={`mt-1 text-xs ${!modalCotizar.precioEnvioInput || (modalCotizar.precioEnvio !== undefined && modalCotizar.precioEnvio >= 0) ? (mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500') : 'text-red-500'}`}>{!modalCotizar.precioEnvioInput || (modalCotizar.precioEnvio !== undefined && modalCotizar.precioEnvio >= 0) ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' }) : t('chinese.ordersPage.modals.quote.validation.enterValidPrice', { defaultValue: 'Ingresa un precio válido' })}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.heightLabel')}</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="altura"
                        inputMode="decimal"
                        required
                        value={modalCotizar.alturaInput ?? ''}
                        className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''} ${!modalCotizar.alturaInput || (modalCotizar.altura && modalCotizar.altura > 0) ? (mounted && theme === 'dark' ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600' : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500') : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                        placeholder={t('chinese.ordersPage.modals.quote.heightPlaceholder')}
                        onChange={e => {
                          // Aceptar coma o punto como separador decimal y permitir punto final temporal
                          let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                          const parts = raw.split('.');
                          let intPart = (parts[0] || '').slice(0, 7);
                          let decPart = (parts[1] || '').slice(0, 1);
                          const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                          const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                          setModalCotizar(prev => ({ ...prev, altura: numero, alturaInput: cleaned }));
                        }}
                      />
                      <span className={`absolute right-3 top-3 text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>cm</span>
                      <p className={`mt-1 text-xs ${!modalCotizar.alturaInput || (modalCotizar.altura && modalCotizar.altura > 0) ? (mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500') : 'text-red-500'}`}>{!modalCotizar.alturaInput || (modalCotizar.altura && modalCotizar.altura > 0) ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' }) : t('chinese.ordersPage.modals.quote.validation.enterHeight', { defaultValue: 'Ingresa una altura mayor a 0' })}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.widthLabel')}</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="anchura"
                        inputMode="decimal"
                        required
                        value={modalCotizar.anchuraInput ?? ''}
                        className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''} ${!modalCotizar.anchuraInput || (modalCotizar.anchura && modalCotizar.anchura > 0) ? (mounted && theme === 'dark' ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600' : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500') : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                        placeholder={t('chinese.ordersPage.modals.quote.widthPlaceholder')}
                        onChange={e => {
                          // Aceptar coma o punto como separador decimal y permitir punto final temporal
                          let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                          const parts = raw.split('.');
                          let intPart = (parts[0] || '').slice(0, 7);
                          let decPart = (parts[1] || '').slice(0, 1);
                          const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                          const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                          setModalCotizar(prev => ({ ...prev, anchura: numero, anchuraInput: cleaned }));
                        }}
                      />
                      <span className={`absolute right-3 top-3 text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>cm</span>
                      <p className={`mt-1 text-xs ${!modalCotizar.anchuraInput || (modalCotizar.anchura && modalCotizar.anchura > 0) ? (mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500') : 'text-red-500'}`}>{!modalCotizar.anchuraInput || (modalCotizar.anchura && modalCotizar.anchura > 0) ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' }) : t('chinese.ordersPage.modals.quote.validation.enterWidth', { defaultValue: 'Ingresa una anchura mayor a 0' })}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.lengthLabel')}</label>
                    <div className="relative">
                      <input
                        type="text"
                        name="largo"
                        inputMode="decimal"
                        required
                        value={modalCotizar.largoInput ?? ''}
                        className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''} ${!modalCotizar.largoInput || (modalCotizar.largo && modalCotizar.largo > 0) ? (mounted && theme === 'dark' ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600' : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500') : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                        placeholder={t('chinese.ordersPage.modals.quote.lengthPlaceholder')}
                        onChange={e => {
                          // Aceptar coma o punto como separador decimal y permitir punto final temporal
                          let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                          const parts = raw.split('.');
                          let intPart = (parts[0] || '').slice(0, 7);
                          let decPart = (parts[1] || '').slice(0, 1);
                          const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                          const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                          setModalCotizar(prev => ({ ...prev, largo: numero, largoInput: cleaned }));
                        }}
                      />
                      <span className={`absolute right-3 top-3 text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>cm</span>
                      <p className={`mt-1 text-xs ${!modalCotizar.largoInput || (modalCotizar.largo && modalCotizar.largo > 0) ? (mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500') : 'text-red-500'}`}>{!modalCotizar.largoInput || (modalCotizar.largo && modalCotizar.largo > 0) ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' }) : t('chinese.ordersPage.modals.quote.validation.enterLength', { defaultValue: 'Ingresa un largo mayor a 0' })}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.weightLabel')}</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="peso"
                      inputMode="decimal"
                      required
                      value={modalCotizar.pesoInput ?? ''}
                      className={`w-full pr-12 pl-4 py-3 rounded-lg focus:outline-none transition-colors border ${mounted && theme === 'dark' ? 'bg-slate-700 text-white border-slate-600' : ''} ${!modalCotizar.pesoInput || (modalCotizar.peso && modalCotizar.peso > 0) ? (mounted && theme === 'dark' ? 'focus:ring-2 focus:ring-blue-600 focus:border-blue-600' : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500') : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                      placeholder={t('chinese.ordersPage.modals.quote.weightPlaceholder')}
                      onChange={e => {
                        // Aceptar coma o punto como separador decimal y permitir punto final temporal
                        let raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                        const parts = raw.split('.');
                        let intPart = (parts[0] || '').slice(0, 7);
                        let decPart = (parts[1] || '').slice(0, 1);
                        const cleaned = parts.length > 1 ? `${intPart}.${decPart}` : intPart;
                        const numero = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
                        setModalCotizar(prev => ({ ...prev, peso: numero, pesoInput: cleaned }));
                      }}
                    />
                    <span className={`absolute right-3 top-3 text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>kg</span>
                    <p className={`mt-1 text-xs ${!modalCotizar.pesoInput || (modalCotizar.peso && modalCotizar.peso > 0) ? (mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500') : 'text-red-500'}`}>{!modalCotizar.pesoInput || (modalCotizar.peso && modalCotizar.peso > 0) ? t('chinese.ordersPage.modals.quote.validation.maxDigits', { defaultValue: 'Máx 7 dígitos enteros' }) : t('chinese.ordersPage.modals.quote.validation.enterWeight', { defaultValue: 'Ingresa un peso mayor a 0' })}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={`block text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('chinese.ordersPage.modals.quote.totalToPay')}</label>
                  <div className={`px-4 py-3 border rounded-lg ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-700' : 'bg-gradient-to-r from-green-50 to-emerald-50 border-slate-200'}`}>
                    {(() => {
                      const qty = Number(modalCotizar.pedido?.cantidad || 0);
                      const unitPrice = Number(modalCotizar.precioUnitario || 0);
                      const shipping = Number(modalCotizar.precioEnvio || 0);
                      const totalCNY = (unitPrice * qty) + shipping;
                      const totalUSD = cnyRate && cnyRate > 0 ? totalCNY / cnyRate : 0;
                      return (
                        <div className="space-y-1">
                          <div className={`font-bold ${mounted && theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                            {`¥${totalCNY.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </div>
                          <div className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                            {cnyLoading ? '...' : `≈ $${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModalCotizar}
                  >
                    {t('chinese.ordersPage.modals.quote.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={!(modalCotizar.precioUnitario && modalCotizar.precioUnitario > 0 && String(Math.trunc(modalCotizar.precioUnitario)).length <= 7 &&
                      modalCotizar.precioEnvio !== undefined && modalCotizar.precioEnvio >= 0 &&
                      modalCotizar.altura && modalCotizar.altura > 0 &&
                      modalCotizar.anchura && modalCotizar.anchura > 0 &&
                      modalCotizar.largo && modalCotizar.largo > 0 &&
                      modalCotizar.peso && modalCotizar.peso > 0)}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('chinese.ordersPage.modals.quote.sendQuote')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Empaquetar Caja: seleccionar contenedor */}
        {modalEmpaquetarCaja.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalEmpaquetarCajaRef}
              className={`${mounted && theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 max-w-2xl mx-4 w-full max-h-[85vh] overflow-y-auto transition-all duration-300 ${isModalEmpaquetarCajaClosing ? 'translate-y-full scale-95 opacity-0' : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.selectContainerForBox.title', { id: String(modalEmpaquetarCaja.boxId ?? '') })}</h3>
                <Button variant="ghost" size="sm" onClick={closeModalEmpaquetarCaja} className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : ''}`}>
                  <span className={`text-2xl ${mounted && theme === 'dark' ? 'text-white' : ''}`}>×</span>
                </Button>
              </div>
              {containersLoading ? (
                <p className={`text-center text-sm py-6 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('chinese.ordersPage.modals.selectContainerForBox.loading')}</p>
              ) : containers.length === 0 ? (
                <div className="text-center py-12">
                  <Boxes className={`h-12 w-12 mx-auto mb-4 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                  <h4 className={`text-base font-medium mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.selectContainerForBox.noneTitle')}</h4>
                  <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{t('chinese.ordersPage.modals.selectContainerForBox.noneSubtitle')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {containers.map((container, idx) => {
                    const id = container.container_id ?? container.containers_id ?? container.id ?? idx;
                    const created = container.creation_date ?? container.created_at ?? '';
                    const stateNum = (container.state ?? 1) as number;
                    return (
                      <div key={`${id}`} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-slate-700 to-slate-600 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'} border`}>
                        <div className="flex items-start sm:items-center gap-4 w-full sm:w-auto">
                          <div className={`p-3 rounded-lg ${mounted && theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'}`}>
                            <Boxes className={`h-5 w-5 ${mounted && theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#CONT-{id}</h3>
                              {container?.name && (
                                <span className={`text-xs truncate max-w-full ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{String((container as any).name)}</span>
                              )}
                            </div>
                            <div className={`flex items-center gap-4 text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {created ? new Date(created).toLocaleString('es-ES') : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={`${getContainerBadge(stateNum).className}`}>
                            {getContainerBadge(stateNum).label}
                          </Badge>
                          <Button
                            size="sm"
                            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={stateNum >= 3}
                            onClick={() => modalEmpaquetarCaja.boxId && handleSelectContenedorForCaja(modalEmpaquetarCaja.boxId, container)}
                          >
                            {t('chinese.ordersPage.modals.selectContainerForBox.select')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Modal Crear Contenedor */}
        {modalCrearContenedor.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalCrearContenedorRef}
              className={`bg-white rounded-2xl p-6 max-w-md mx-4 w-full transition-all duration-300 ${isModalCrearContenedorClosing
                ? 'translate-y-full scale-95 opacity-0'
                : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">{t('chinese.ordersPage.modals.createContainer.title')}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeModalCrearContenedor}
                  className="h-8 w-8 p-0"
                >
                  <span className="text-2xl">×</span>
                </Button>
              </div>
              <p className="text-slate-600 mb-4">{t('chinese.ordersPage.modals.createContainer.question')}</p>
              {/* Nombre del contenedor (requerido) */}
              <div className="mb-6">
                <label htmlFor="newContainerName" className="block text-sm font-medium text-slate-700 mb-1">
                  {t('chinese.ordersPage.modals.createContainer.containerNameLabel', { defaultValue: 'Nombre del contenedor' })}
                </label>
                <Input
                  id="newContainerName"
                  placeholder={t('chinese.ordersPage.modals.createContainer.containerNamePlaceholder', { defaultValue: 'Ej. CONT-Agosto-01' })}
                  value={newContainerName}
                  maxLength={50}
                  onChange={(e) => setNewContainerName(e.target.value.slice(0, 50))}
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeModalCrearContenedor} disabled={creatingContainer}>{t('chinese.ordersPage.modals.createContainer.cancel')}</Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleConfirmCrearContenedor} disabled={creatingContainer || !newContainerName.trim()}>
                  {creatingContainer ? t('chinese.ordersPage.modals.createContainer.creating') : t('chinese.ordersPage.modals.createContainer.accept')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Ver Cajas del Contenedor */}
        {modalVerPedidosCont.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalVerPedidosContRef}
              className={`${mounted && theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 max-w-3xl mx-4 w-full max-h-[90vh] overflow-y-auto transition-all duration-300 ${isModalVerPedidosContClosing ? 'translate-y-full scale-95 opacity-0' : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.containerBoxes.title', { id: String(modalVerPedidosCont.containerId ?? '') })}</h3>
                <Button variant="ghost" size="sm" onClick={closeModalVerPedidosCont} className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : ''}`}>
                  <span className={`text-2xl ${mounted && theme === 'dark' ? 'text-white' : ''}`}>×</span>
                </Button>
              </div>
              {boxesByContainerLoading ? (
                <p className={`text-center text-sm py-6 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('chinese.ordersPage.modals.containerBoxes.loading')}</p>
              ) : boxesByContainer.length === 0 ? (
                <div className="text-center py-12">
                  <Boxes className={`h-12 w-12 mx-auto mb-4 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                  <h4 className={`text-base font-medium mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.containerBoxes.noneTitle')}</h4>
                  <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{t('chinese.ordersPage.modals.containerBoxes.noneSubtitle')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {boxesByContainer.map((box, idx) => {
                    const id = box.box_id ?? box.boxes_id ?? box.id ?? idx;
                    const created = box.creation_date ?? box.created_at ?? '';
                    const stateNum = (box.state ?? 1) as number;
                    return (
                      <div key={`${id}`} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-slate-700 to-slate-600 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'} border`}>
                        <div className="flex items-start sm:items-center gap-4 w-full sm:w-auto">
                          <div className={`p-3 rounded-lg ${mounted && theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'}`}>
                            <Boxes className={`h-5 w-5 ${mounted && theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#BOX-{id}</h3>
                              {box?.name && (
                                <span className={`text-xs truncate max-w-full ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{String((box as any).name)}</span>
                              )}
                              {box?.name && (
                                <span className={`text-xs truncate max-w-full ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{String((box as any).name)}</span>
                              )}
                            </div>
                            <div className={`flex items-center gap-4 text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {created ? new Date(created).toLocaleString('es-ES') : '—'}
                              </span>
                              <span className="flex items-center gap-1">
                                <List className="h-3 w-3" />
                                {t('chinese.ordersPage.boxes.ordersCount')} {orderCountsByBox[id as any] ?? 0}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge className={`${getBoxBadge(stateNum).className}`}>
                            {getBoxBadge(stateNum).label}
                          </Badge>
                          {stateNum === 2 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                              onClick={() => {
                                const boxId = box.box_id ?? box.boxes_id ?? box.id;
                                const containerId = modalVerPedidosCont.containerId;
                                handleUnpackBox(boxId as any, { containerId });
                              }}
                            >
                              <Boxes className="h-4 w-4 sm:hidden" aria-label="Desempaquetar" />
                              <span className="hidden sm:inline">{t('chinese.ordersPage.boxes.unpack')}</span>
                            </Button>
                          )}
                          {stateNum >= 3 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1 text-amber-700 border-amber-300 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled
                            >
                              <Boxes className="h-4 w-4 sm:hidden" />
                              <span className="hidden sm:inline">{t('chinese.ordersPage.boxes.unpack')}</span>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                            onClick={() => {
                              const boxId = box.box_id ?? box.boxes_id ?? box.id;
                              setModalVerPedidos({ open: true, boxId });
                              if (boxId !== undefined) fetchOrdersByBoxId(boxId);
                            }}
                          >
                            <List className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('chinese.ordersPage.boxes.viewOrders')}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Eliminar Contenedor */}
        {modalEliminarContenedor.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalEliminarContenedorRef}
              className={`bg-white rounded-2xl p-6 max-w-md mx-4 w-full transition-all duration-300 ${isModalEliminarContenedorClosing
                ? 'translate-y-full scale-95 opacity-0'
                : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">{t('chinese.ordersPage.modals.deleteContainer.title')}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeModalEliminarContenedor}
                  className="h-8 w-8 p-0"
                >
                  <span className="text-2xl">×</span>
                </Button>
              </div>
              <p className="text-slate-600 mb-6">{t('chinese.ordersPage.modals.deleteContainer.question', { id: String(modalEliminarContenedor.container?.containers_id ?? modalEliminarContenedor.container?.id ?? modalEliminarContenedor.container?.container_id ?? '') })}</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeModalEliminarContenedor} disabled={deletingContainer}>{t('chinese.ordersPage.modals.deleteContainer.cancel')}</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deletingContainer}
                  onClick={async () => {
                    try {
                      setDeletingContainer(true);
                      const supabase = getSupabaseBrowserClient();
                      const id = modalEliminarContenedor.container?.container_id ?? modalEliminarContenedor.container?.containers_id ?? modalEliminarContenedor.container?.id;
                      if (!id) {
                        toast({ title: t('chinese.ordersPage.toasts.deleteErrorTitle'), description: t('chinese.ordersPage.toasts.invalidContainerIdDesc') });
                        return;
                      }
                      const { error } = await supabase
                        .from('containers')
                        .delete()
                        .eq('container_id', id);
                      if (error) {
                        console.error('Error al eliminar contenedor:', error);
                        toast({ title: t('chinese.ordersPage.toasts.deleteContainerErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
                        return;
                      }
                      toast({ title: t('chinese.ordersPage.toasts.containerDeletedTitle'), description: t('chinese.ordersPage.toasts.containerDeletedDesc') });
                      closeModalEliminarContenedor();
                      fetchContainers();
                    } finally {
                      setDeletingContainer(false);
                    }
                  }}
                >
                  {deletingContainer ? t('chinese.ordersPage.modals.deleteContainer.deleting') : t('chinese.ordersPage.modals.deleteContainer.delete')}
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Modal Detalle desactivado: ahora el botón "Ver" abre el PDF en una nueva pestaña */}
        {false && modalDetalle.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            {/* Modal Detalle comentado intencionalmente para reuso futuro */}
          </div>
        )}

        {/* Modal Crear Caja */}
        {modalCrearCaja.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalCrearCajaRef}
              className={`bg-white rounded-2xl p-6 max-w-md mx-4 w-full transition-all duration-300 ${isModalCrearCajaClosing
                ? 'translate-y-full scale-95 opacity-0'
                : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">{t('chinese.ordersPage.modals.createBox.title')}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeModalCrearCaja}
                  className="h-8 w-8 p-0"
                >
                  <span className="text-2xl">×</span>
                </Button>
              </div>
              <p className="text-slate-600 mb-4">{t('chinese.ordersPage.modals.createBox.question')}</p>
              {/* Nombre de la caja (requerido) */}
              <div className="mb-6">
                <label htmlFor="newBoxName" className="block text-sm font-medium text-slate-700 mb-1">
                  {t('chinese.ordersPage.modals.createBox.boxNameLabel', { defaultValue: 'Nombre de la caja' })}
                </label>
                <Input
                  id="newBoxName"
                  placeholder={t('chinese.ordersPage.modals.createBox.boxNamePlaceholder', { defaultValue: 'Ej. Electrónica lote A' })}
                  value={newBoxName}
                  maxLength={50}
                  onChange={(e) => setNewBoxName(e.target.value.slice(0, 50))}
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeModalCrearCaja} disabled={creatingBox}>{t('chinese.ordersPage.modals.createBox.cancel')}</Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleConfirmCrearCaja} disabled={creatingBox || !newBoxName.trim()}>
                  {creatingBox ? t('chinese.ordersPage.modals.createBox.creating') : t('chinese.ordersPage.modals.createBox.accept')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Ver Pedidos de Caja */}
        {modalVerPedidos.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalVerPedidosRef}
              className={`${mounted && theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 max-w-3xl mx-4 w-full max-h-[90vh] overflow-y-auto transition-all duration-300 ${isModalVerPedidosClosing ? 'translate-y-full scale-95 opacity-0' : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.boxOrders.title', { id: String(modalVerPedidos.boxId ?? '') })}</h3>
                <Button variant="ghost" size="sm" onClick={closeModalVerPedidos} className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : ''}`}>
                  <span className={`text-2xl ${mounted && theme === 'dark' ? 'text-white' : ''}`}>×</span>
                </Button>
              </div>
              {ordersByBoxLoading ? (
                <p className={`text-center text-sm py-6 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('chinese.ordersPage.modals.boxOrders.loading')}</p>
              ) : ordersByBox.length === 0 ? (
                <div className="text-center py-12">
                  <Package className={`h-12 w-12 mx-auto mb-4 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                  <h4 className={`text-base font-medium mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.boxOrders.noneTitle')}</h4>
                  <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{t('chinese.ordersPage.modals.boxOrders.noneSubtitle')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ordersByBox.map((pedido) => (
                    <div key={pedido.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-slate-700 to-slate-600 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'} border`}>
                      <div className="flex items-start sm:items-center gap-4 w-full sm:w-auto">
                        <div className={`p-3 rounded-lg ${mounted && theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                          <Package className={`h-5 w-5 ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-semibold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#ORD-{pedido.id}</h3>
                          </div>
                          <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{pedido.producto}</p>
                          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {pedido.clientProfileName || pedido.cliente}
                            </span>
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              Cantidad: {pedido.cantidad}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(pedido.fecha).toLocaleDateString('es-ES')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className={`${getOrderBadge(pedido.numericState).className}`}>
                          {getOrderBadge(pedido.numericState).label}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (pedido.pdfRoutes) {
                              const bust = pedido.pdfRoutes.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
                              window.open(pedido.pdfRoutes + bust, '_blank', 'noopener,noreferrer');
                            } else {
                              toast({ title: 'Sin PDF', description: 'No hay PDF disponible para este pedido.' });
                            }
                          }}
                          className={`flex items-center gap-1 ${mounted && theme === 'dark' ? 'dark:border-slate-700 dark:hover:bg-slate-700' : ''}`}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('chinese.ordersPage.orders.view')}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Empaquetar: seleccionar caja */}
        {modalEmpaquetar?.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalEmpaquetarRef}
              className={`${mounted && theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 max-w-2xl mx-4 w-full max-h-[85vh] overflow-y-auto transition-all duration-300 ${isModalEmpaquetarClosing ? 'translate-y-full scale-95 opacity-0' : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.selectBoxForOrder.title', { id: modalEmpaquetar?.pedidoId })}</h3>
                <Button variant="ghost" size="sm" onClick={closeModalEmpaquetar} className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : ''}`}>
                  <span className={`text-2xl ${mounted && theme === 'dark' ? 'text-white' : ''}`}>×</span>
                </Button>
              </div>
              {boxesLoading ? (
                <p className={`text-center text-sm py-6 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('chinese.ordersPage.modals.selectBoxForOrder.loading')}</p>
              ) : boxes.length === 0 ? (
                <div className="text-center py-12">
                  <Boxes className={`h-12 w-12 mx-auto mb-4 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                  <h4 className={`text-base font-medium mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.selectBoxForOrder.noneTitle')}</h4>
                  <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{t('chinese.ordersPage.modals.selectBoxForOrder.noneSubtitle')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {boxes.map((box, idx) => {
                    const id = box.box_id ?? box.boxes_id ?? box.id ?? idx;
                    const created = box.creation_date ?? box.created_at ?? '';
                    const stateNum = (box.state ?? 1) as number;

                    // Shipping Type Validation
                    const currentOrder = pedidos.find(p => String(p.id) === String(modalEmpaquetar.pedidoId));
                    // User confirmed shippingType is the correct column
                    const sType = currentOrder?.shippingType || '';
                    const orderType = sType === 'air' ? 'Aereo' : sType === 'maritime' ? 'Maritimo' : (sType === 'Aereo' ? 'Aereo' : sType === 'Maritimo' ? 'Maritimo' : '');
                    const boxType = boxShippingTypes[id as any]; // 'Aereo' | 'Maritimo' | undefined

                    let isCompatible = true;
                    let incompatibleReason = '';

                    // DEBUG LOGS (Newly added to page.tsx)
                    console.log(`[DEBUG PAGE BOX ${id}]`, {
                      boxId: id,
                      orderId: modalEmpaquetar.pedidoId,
                      orderShippingType: sType,
                      normalizedOrderType: orderType,
                      boxStoredType: boxType,
                      isCompatible: orderType && boxType && orderType !== boxType && boxType !== 'Mixto' ? false : true
                    });

                    if (orderType && boxType && orderType !== boxType && boxType !== 'Mixto') {
                      isCompatible = false;
                      incompatibleReason = `Solo ${boxType}`;
                    }

                    return (
                      <div key={`${id}`} className={`flex items-center justify-between p-4 rounded-xl ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-slate-700 to-slate-600 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'} border ${!isCompatible ? 'opacity-75' : ''}`}>
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${mounted && theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'}`}>
                            <Boxes className={`h-5 w-5 ${mounted && theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#BOX-{id}</h3>
                              {boxType && (
                                <Badge variant="outline" className={`ml-2 text-xs ${boxType === 'Aereo' ? 'text-sky-500 border-sky-500' : 'text-blue-600 border-blue-600'}`}>
                                  {boxType}
                                </Badge>
                              )}
                            </div>
                            <div className={`flex items-center gap-4 text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {created ? new Date(created).toLocaleString('es-ES') : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={`${getBoxBadge(stateNum).className}`}>{getBoxBadge(stateNum).label}</Badge>
                          <Button
                            size="sm"
                            className={`flex items-center gap-1 ${!isCompatible ? (mounted && theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-100 text-slate-400 border-slate-200') : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-75 disabled:cursor-not-allowed min-w-[100px] justify-center`}
                            disabled={stateNum >= 3 || !isCompatible}
                            // Reemplazado flujo: abrir modal etiqueta en lugar de asignar directamente
                            onClick={() => {
                              if (modalEmpaquetar?.pedidoId) {
                                // Guardar combo y abrir modal etiqueta
                                setModalEtiqueta({ open: true, pedidoId: modalEmpaquetar.pedidoId, box });
                                // Cerramos modal de selección de caja
                                closeModalEmpaquetar();
                              }
                            }}
                          >
                            {!isCompatible ? incompatibleReason : t('chinese.ordersPage.modals.selectBoxForOrder.select')}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Etiqueta: confirmar generación etiqueta antes de asignar caja */}
        {modalEtiqueta.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalEtiquetaRef}
              className={`${mounted && theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-2xl p-6 max-w-md mx-4 w-full transition-all duration-300 ${isModalEtiquetaClosing ? 'translate-y-full scale-95 opacity-0' : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('chinese.ordersPage.modals.labelWarning.title', { defaultValue: 'Antes de empaquetar' })}</h3>
                <Button variant="ghost" size="sm" onClick={() => { closeModalEtiqueta(); setTimeout(() => { setModalEmpaquetar(prev => ({ ...prev, open: true })); }, 350); }} className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : ''}`}>
                  <span className={`text-2xl ${mounted && theme === 'dark' ? 'text-white' : ''}`}>×</span>
                </Button>
              </div>

              {/* Mensaje destacado y muy visible */}
              <div className={`mb-6 p-5 rounded-xl border-2 ${mounted && theme === 'dark'
                ? 'bg-gradient-to-r from-red-900/40 to-orange-900/40 border-red-500/50 shadow-lg shadow-red-500/20'
                : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-400 shadow-lg shadow-red-200'
                } animate-pulse`}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 p-2 rounded-full ${mounted && theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'}`}>
                    <AlertTriangle className={`h-6 w-6 ${mounted && theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-base font-bold mb-2 ${mounted && theme === 'dark' ? 'text-red-300' : 'text-red-800'}`}>
                      ⚠️ IMPORTANTE
                    </p>
                    <p className={`text-sm font-semibold leading-relaxed ${mounted && theme === 'dark' ? 'text-red-200' : 'text-red-700'}`}>
                      {t('chinese.ordersPage.modals.labelWarning.description', { defaultValue: 'Asegúrate de poner la etiqueta al producto antes de empaquetar.' })}
                    </p>
                    {!labelDownloaded && (
                      <p className={`text-xs mt-2 font-medium ${mounted && theme === 'dark' ? 'text-red-300/80' : 'text-red-600/80'}`}>
                        Debes descargar la etiqueta antes de continuar
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Indicador de descarga exitosa */}
              {labelDownloaded && (
                <div className={`mb-4 p-3 rounded-lg border ${mounted && theme === 'dark'
                  ? 'bg-green-900/30 border-green-500/50'
                  : 'bg-green-50 border-green-300'
                  }`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`h-5 w-5 ${mounted && theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                    <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                      ✓ Etiqueta descargada correctamente
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                {/* Botón de descargar etiqueta - Destacado y prominente */}
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!modalEtiqueta.pedidoId) return;
                    setGeneratingLabel(true);
                    try {
                      await handleGenerateOrderLabelPdf(modalEtiqueta.pedidoId);
                    } finally {
                      setGeneratingLabel(false);
                    }
                  }}
                  disabled={generatingLabel || labelDownloaded}
                  className={`${labelDownloaded
                    ? (mounted && theme === 'dark' ? 'bg-green-900/30 border-green-500 text-green-300' : 'bg-green-50 border-green-300 text-green-700')
                    : (mounted && theme === 'dark' ? 'border-blue-500 text-blue-300 hover:bg-blue-900/30' : 'border-blue-500 text-blue-600 hover:bg-blue-50')
                    } font-semibold ${!labelDownloaded ? 'shadow-md' : ''}`}
                >
                  {labelDownloaded ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t('chinese.ordersPage.modals.labelWarning.downloaded', { defaultValue: 'Etiqueta descargada' })}
                    </>
                  ) : generatingLabel ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {t('chinese.ordersPage.modals.labelWarning.generating', { defaultValue: 'Generando...' })}
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      {t('chinese.ordersPage.modals.labelWarning.download', { defaultValue: 'Descargar etiqueta' })}
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => { closeModalEtiqueta(); setTimeout(() => { setModalEmpaquetar(prev => ({ ...prev, open: true })); }, 350); }}
                  disabled={generatingLabel}
                  className={mounted && theme === 'dark' ? 'border-slate-600 hover:bg-slate-700' : ''}
                >
                  {t('chinese.ordersPage.modals.selectBoxForOrder.cancel', { defaultValue: 'Cancelar' })}
                </Button>

                {/* Botón Aceptar - Deshabilitado hasta que se descargue la etiqueta */}
                <Button
                  className={`${labelDownloaded
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-slate-400 hover:bg-slate-500 cursor-not-allowed'
                    } text-white font-semibold shadow-lg transition-all`}
                  disabled={generatingLabel || !labelDownloaded}
                  onClick={async () => {
                    if (!modalEtiqueta.pedidoId || !modalEtiqueta.box) return;
                    setGeneratingLabel(true);
                    try {
                      await handleSelectCajaForPedido(modalEtiqueta.pedidoId, modalEtiqueta.box);
                      closeModalEtiqueta();
                    } finally {
                      setGeneratingLabel(false);
                    }
                  }}
                >
                  {labelDownloaded ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t('chinese.ordersPage.modals.labelWarning.accept', { defaultValue: 'Aceptar' })}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Descarga la etiqueta primero
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Eliminar Caja */}
        {modalEliminarCaja.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div
              ref={modalEliminarCajaRef}
              className={`bg-white rounded-2xl p-6 max-w-md mx-4 w-full transition-all duration-300 ${isModalEliminarCajaClosing
                ? 'translate-y-full scale-95 opacity-0'
                : 'animate-in slide-in-from-bottom-4 duration-300'
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">{t('chinese.ordersPage.modals.deleteBox.title')}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeModalEliminarCaja}
                  className="h-8 w-8 p-0"
                >
                  <span className="text-2xl">×</span>
                </Button>
              </div>
              <p className="text-slate-600 mb-6">{t('chinese.ordersPage.modals.deleteBox.question', { id: String(modalEliminarCaja.box?.boxes_id ?? modalEliminarCaja.box?.id ?? modalEliminarCaja.box?.box_id ?? '') })}</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeModalEliminarCaja} disabled={deletingBox}>{t('chinese.ordersPage.modals.deleteBox.cancel')}</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deletingBox}
                  onClick={async () => {
                    // Ejecutar borrado en Supabase
                    try {
                      setDeletingBox(true);
                      const supabase = getSupabaseBrowserClient();
                      const id = modalEliminarCaja.box?.box_id ?? modalEliminarCaja.box?.boxes_id ?? modalEliminarCaja.box?.id;
                      if (!id) {
                        toast({ title: t('chinese.ordersPage.toasts.deleteErrorTitle'), description: t('chinese.ordersPage.toasts.invalidBoxIdDesc') });
                        return;
                      }
                      const { error } = await supabase
                        .from('boxes')
                        .delete()
                        .eq('box_id', id);
                      if (error) {
                        console.error('Error al eliminar caja:', error);
                        toast({ title: t('chinese.ordersPage.toasts.deleteBoxErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
                        return;
                      }
                      toast({ title: t('chinese.ordersPage.toasts.boxDeletedTitle'), description: t('chinese.ordersPage.toasts.boxDeletedDesc') });
                      closeModalEliminarCaja();
                      fetchBoxes();
                    } finally {
                      setDeletingBox(false);
                    }
                  }}
                >
                  {deletingBox ? t('chinese.ordersPage.modals.deleteBox.deleting') : t('chinese.ordersPage.modals.deleteBox.delete')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Proponer Alternativa */}
      <ProposeAlternativeModal
        isOpen={modalPropAlternativa.open}
        onClose={() => setModalPropAlternativa({ open: false })}
        pedido={modalPropAlternativa.pedido ? {
          id: modalPropAlternativa.pedido.id,
          producto: modalPropAlternativa.pedido.producto,
          cliente: modalPropAlternativa.pedido.cliente,
          alternativeRejectionReason: modalPropAlternativa.pedido.alternativeRejectionReason,
        } : null}
        onSuccess={() => {
          setModalPropAlternativa({ open: false });
          fetchPedidos(); // Refrescar lista de pedidos
          toast({
            title: 'Alternativa propuesta',
            description: 'La alternativa ha sido enviada al cliente exitosamente.',
          });
        }}
      />
      <Toaster />
    </>
  );
}
