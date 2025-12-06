"use client";
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  Search, Filter, Boxes, Package, List, CheckCircle, Calendar, Eye, Calculator, Pencil, Tag, User, Plus, Truck, Trash2, AlertTriangle, DollarSign, Download, Image as ImageIcon, Send
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { Toaster } from '@/components/ui/toaster';
import { useRealtimeChina } from '@/hooks/use-realtime-china';
import { useProductAlternatives } from '@/hooks/use-product-alternatives';
import ProposeAlternativeModal from './ProposeAlternativeModal';
import jsPDF from 'jspdf';

// Utilidad para convertir un SVG público a PNG DataURL para incrustar en PDF (cliente)
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

// Componente embebido (sin Sidebar/Header) replicando funcionalidades clave de la página China.

interface Pedido {
  id: number;
  cliente: string;
  producto: string;
  cantidad: number;
  estado: 'pendiente' | 'cotizado' | 'procesando' | 'enviado';
  cotizado: boolean;
  precio: number | null;
  fecha: string;
  pdfRoutes?: string;
  deliveryType?: string;
  shippingType?: string;
  totalQuote?: number | null;
  numericState?: number;
  hasAlternative?: boolean;
  alternativeStatus?: 'pending' | 'accepted' | 'rejected' | null;
  alternativeRejectionReason?: string | null;
}
interface BoxItem { boxes_id?: number | string; id?: number | string; box_id?: number | string; container_id?: number | string | null; state?: number; creation_date?: string; created_at?: string; name?: string }
interface ContainerItem { containers_id?: number | string; id?: number | string; container_id?: number | string; state?: number; creation_date?: string; created_at?: string; name?: string }

function mapStateToEstado(state: number): Pedido['estado'] {
  if (state >= 5 && state <= 8) return 'enviado';
  if (state === 3 || state === 4) return state === 3 ? 'cotizado' : 'procesando';
  if (state === 1 || state === 2) return 'pendiente'; // Estados 1 y 2 son pendientes
  // Cualquier otro (>8) se tratará como enviado extendido según futuras reglas, aquí fallback a pendiente
  return 'pendiente';
}
function getOrderBadge(t: any, stateNum?: number) {
  const s = Number(stateNum ?? 0); const base = 'border';
  if (s <= 0 || isNaN(s)) return { label: t('chinese.ordersPage.badges.unknown'), className: `${base} bg-gray-100 text-gray-800 border-gray-200` };
  if (s === 1 || s === 2) return { label: t('chinese.ordersPage.badges.pending'), className: `${base} bg-yellow-100 text-yellow-800 border-yellow-200` }; // Estados 1 y 2 son pendientes
  if (s === 3) return { label: t('chinese.ordersPage.badges.quoted'), className: `${base} bg-blue-100 text-blue-800 border-blue-200` };
  if (s === 4) return { label: t('chinese.ordersPage.badges.processing'), className: `${base} bg-purple-100 text-purple-800 border-purple-200` };
  if (s === 5) return { label: t('chinese.ordersPage.badges.readyToPack'), className: `${base} bg-amber-100 text-amber-800 border-amber-200` };
  if (s === 6) return { label: t('chinese.ordersPage.badges.inBox'), className: `${base} bg-indigo-100 text-indigo-800 border-indigo-200` };
  if (s === 7) return { label: t('chinese.ordersPage.badges.inContainer'), className: `${base} bg-cyan-100 text-cyan-800 border-cyan-200` };
  if (s >= 9) return { label: t('chinese.ordersPage.badges.shippedVzla'), className: `${base} bg-green-100 text-green-800 border-green-200` };
  return { label: t('chinese.ordersPage.badges.state', { num: s }), className: `${base} bg-gray-100 text-gray-800 border-gray-200` };
}
function getBoxBadge(t: any, stateNum?: number) {
  const s = Number(stateNum ?? 0); const base = 'border';
  if (s <= 1) return { label: t('chinese.ordersPage.boxBadges.new'), className: `${base} bg-blue-100 text-blue-800 border-blue-200` };
  if (s === 2) return { label: t('chinese.ordersPage.boxBadges.packed'), className: `${base} bg-green-100 text-green-800 border-green-200` };
  if (s === 3) return { label: t('chinese.ordersPage.boxBadges.inContainer'), className: `${base} bg-cyan-100 text-cyan-800 border-cyan-200` };
  if (s >= 4) return { label: t('chinese.ordersPage.boxBadges.shipped'), className: `${base} bg-gray-100 text-gray-800 border-gray-200` };
  return { label: t('chinese.ordersPage.boxBadges.state', { num: s }), className: `${base} bg-gray-100 text-gray-800 border-gray-200` };
}
function getContainerBadge(t: any, stateNum?: number) {
  const s = Number(stateNum ?? 0); const base = 'border';
  if (s <= 1) return { label: t('chinese.ordersPage.containerBadges.new'), className: `${base} bg-blue-100 text-blue-800 border-blue-200` };
  if (s === 2) return { label: t('chinese.ordersPage.containerBadges.loading'), className: `${base} bg-amber-100 text-amber-800 border-amber-200` };
  if (s >= 3) return { label: t('chinese.ordersPage.containerBadges.shipped'), className: `${base} bg-gray-100 text-gray-800 border-gray-200` };
  return { label: t('chinese.ordersPage.containerBadges.state', { num: s }), className: `${base} bg-gray-100 text-gray-800 border-gray-200` };
}

export default function ChinaOrdersTabContent() {
  const { t } = useTranslation();
  // Current China user id for realtime filtering
  const [chinaId, setChinaId] = useState<string | undefined>(undefined);
  const [activeSubTab, setActiveSubTab] = useState<'pedidos' | 'cajas' | 'contenedores'>('pedidos');
  const [mounted, setMounted] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCliente, setFiltroCliente] = useState('');

  // Modales pedidosn
  const [modalCotizar, setModalCotizar] = useState<{ open: boolean; pedido?: Pedido; precioUnitario?: number; precioEnvio?: number; altura?: number; anchura?: number; largo?: number; peso?: number }>({ open: false, precioUnitario: 0, precioEnvio: 0, altura: 0, anchura: 0, largo: 0, peso: 0 });
  const [modalEmpaquetarPedido, setModalEmpaquetarPedido] = useState<{ open: boolean; pedidoId?: number }>({ open: false });
  const [isClosingModalCotizar, setIsClosingModalCotizar] = useState(false);
  const [enteredModalCotizar, setEnteredModalCotizar] = useState(false); // animación de entrada
  const [isClosingModalEmpaquetarPedido, setIsClosingModalEmpaquetarPedido] = useState(false);
  const modalCotizarRef = useRef<HTMLDivElement>(null);
  const modalEmpaquetarPedidoRef = useRef<HTMLDivElement>(null);
  // Modal aviso: pedir poner etiqueta al producto antes de empaquetar
  const [modalAvisoEtiqueta, setModalAvisoEtiqueta] = useState<{ open: boolean; pedidoId?: number; box?: BoxItem }>({ open: false });

  // Modal proponer alternativa
  const [modalPropAlternativa, setModalPropAlternativa] = useState<{ open: boolean; pedido?: Pedido }>({ open: false });
  const [isClosingModalPropAlternativa, setIsClosingModalPropAlternativa] = useState(false);
  const modalPropAlternativaRef = useRef<HTMLDivElement>(null);
  const [altProductName, setAltProductName] = useState('');
  const [altDescription, setAltDescription] = useState('');
  const [altPrice, setAltPrice] = useState('');
  const [altImageFile, setAltImageFile] = useState<File | null>(null);
  const [creatingAlternative, setCreatingAlternative] = useState(false);

  // Generar etiqueta PDF 5 x 3.5 cm (convertido a mm -> 50mm x 35mm)
  async function handleGenerateOrderLabelPdf(pedidoId?: number) {
    if (!pedidoId) {
      toast({ title: t('admin.orders.china.modals.labelWarning.toastTitleError', { defaultValue: 'Error generando' }), description: t('admin.orders.china.modals.labelWarning.noId', { defaultValue: 'ID de pedido no disponible' }) });
      return;
    }
    try {
      // Dimensiones (mm) 50 x 35 (horizontal). Creamos base clean.
      const labelW = 50;
      const labelH = 35;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [labelH, labelW] });
      const padding = 3;
      // Fondo suave
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, labelW, labelH, 'F');
      // Borde redondeado
      doc.setDrawColor(40, 40, 45);
      doc.setLineWidth(0.4);
      doc.roundedRect(0.7, 0.7, labelW - 1.4, labelH - 1.4, 2, 2);

      // Cargar logo SVG -> PNG dataURL (mini util inline)

      let logoData: string | undefined;
      try { logoData = await svgToPngDataUrl('/pita_icon.svg', 256); } catch { /* fallback más abajo */ }

      // Encabezado con banda de color
      doc.setFillColor(15, 76, 129); // azul profundo corporativo
      doc.rect(0, 0, labelW, 9, 'F');

      if (logoData) {
        // Insertar logo pequeño a la izquierda
        const logoW = 8; const logoH = 8; const logoX = padding; const logoY = 0.5;
        doc.addImage(logoData, 'PNG', logoX, logoY, logoW, logoH, undefined, 'FAST');
      } else {
        // Fallback: no logo, solo mantenemos la banda de color
      }

      // Título marca centrado (siempre)
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.text('PITA EXPRESS', labelW / 2, 5.2, { align: 'center' });

      // Código del pedido (principal)
      const code = `#PED-${String(pedidoId).padStart(3, '0')}`;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 25);
      doc.setFontSize(16);
      doc.text(code, labelW / 2, 20, { align: 'center' });

      // Subtexto / instrucción
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(60, 60, 65);
      const desc = t('admin.orders.china.modals.labelWarning.description', { defaultValue: 'Asegúrate de poner la etiqueta al producto antes de empaquetar.' });
      doc.text(doc.splitTextToSize(desc, labelW - 8), labelW / 2, 26.5, { align: 'center' });

      // (Footer eliminado a petición del usuario)

      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      toast({ title: t('admin.orders.china.modals.labelWarning.toastTitleSuccess', { defaultValue: 'Etiqueta lista' }), description: t('admin.orders.china.modals.labelWarning.downloaded', { defaultValue: 'Etiqueta generada' }) });
    } catch (e) {
      console.error(e);
      toast({ title: t('admin.orders.china.modals.labelWarning.toastTitleError', { defaultValue: 'Error generando' }), description: t('admin.orders.china.modals.labelWarning.downloadError', { defaultValue: 'No se pudo generar la etiqueta' }) });
    }
  }

  // Cajas
  const [boxes, setBoxes] = useState<BoxItem[]>([]);
  const [boxesLoading, setBoxesLoading] = useState(false);
  const [filtroCaja, setFiltroCaja] = useState('');
  const [orderCountsByBoxMain, setOrderCountsByBoxMain] = useState<Record<string | number, number>>({});
  const [airOnlyBoxes, setAirOnlyBoxes] = useState<Set<string | number>>(new Set());
  const [ordersByBox, setOrdersByBox] = useState<Pedido[]>([]);
  const [ordersByBoxLoading, setOrdersByBoxLoading] = useState(false);
  const [modalVerPedidosCaja, setModalVerPedidosCaja] = useState<{ open: boolean; boxId?: number | string }>({ open: false });
  const [modalCrearCaja, setModalCrearCaja] = useState<{ open: boolean }>({ open: false });
  const [modalEliminarCaja, setModalEliminarCaja] = useState<{ open: boolean; box?: BoxItem }>({ open: false });
  const [modalEmpaquetarCaja, setModalEmpaquetarCaja] = useState<{ open: boolean; boxId?: number | string }>({ open: false });
  const [creatingBox, setCreatingBox] = useState(false);
  const [deletingBox, setDeletingBox] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [isClosingModalCrearCaja, setIsClosingModalCrearCaja] = useState(false);
  const [isClosingModalEliminarCaja, setIsClosingModalEliminarCaja] = useState(false);
  const [isClosingModalEmpaquetarCaja, setIsClosingModalEmpaquetarCaja] = useState(false);
  const modalCrearCajaRef = useRef<HTMLDivElement>(null);
  const modalEliminarCajaRef = useRef<HTMLDivElement>(null);
  const modalEmpaquetarCajaRef = useRef<HTMLDivElement>(null);

  // Contenedores
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [containersLoading, setContainersLoading] = useState(false);
  const [filtroContenedor, setFiltroContenedor] = useState('');
  const [boxesByContainer, setBoxesByContainer] = useState<BoxItem[]>([]);
  const [boxesByContainerLoading, setBoxesByContainerLoading] = useState(false);
  const [orderCountsByBox, setOrderCountsByBox] = useState<Record<string | number, number>>({});
  const [modalVerCajasCont, setModalVerCajasCont] = useState<{ open: boolean; containerId?: number | string }>({ open: false });
  const [modalCrearContenedor, setModalCrearContenedor] = useState<{ open: boolean }>({ open: false });
  const [modalEliminarContenedor, setModalEliminarContenedor] = useState<{ open: boolean; container?: ContainerItem }>({ open: false });
  const [creatingContainer, setCreatingContainer] = useState(false);
  const [deletingContainer, setDeletingContainer] = useState(false);
  const [newContainerName, setNewContainerName] = useState('');
  const [isClosingModalCrearContenedor, setIsClosingModalCrearContenedor] = useState(false);
  const [isClosingModalEliminarContenedor, setIsClosingModalEliminarContenedor] = useState(false);
  const modalCrearContenedorRef = useRef<HTMLDivElement>(null);
  const modalEliminarContenedorRef = useRef<HTMLDivElement>(null);
  const modalVerCajasContRef = useRef<HTMLDivElement>(null);
  // Nuevo: Modal para enviar contenedor con datos (tracking, empresa, fecha estimada)

  // Animación de entrada del modal cotizar
  useEffect(() => {
    if (modalCotizar.open) {
      setEnteredModalCotizar(false);
      const id = requestAnimationFrame(() => setEnteredModalCotizar(true));
      return () => cancelAnimationFrame(id);
    } else {
      setEnteredModalCotizar(false);
    }
  }, [modalCotizar.open]);
  const modalEnviarContenedorRef = useRef<HTMLDivElement>(null);
  const [modalEnviarContenedor, setModalEnviarContenedor] = useState<{ open: boolean; container?: ContainerItem }>({ open: false });
  const [isClosingModalEnviarContenedor, setIsClosingModalEnviarContenedor] = useState(false);
  const [sendTrackingLink, setSendTrackingLink] = useState(''); // nuevo campo URL obligatorio
  const [sendTrackingNumber, setSendTrackingNumber] = useState('');
  const [sendCourierCompany, setSendCourierCompany] = useState('');
  const [sendEtaDate, setSendEtaDate] = useState('');
  const [sendingContainer, setSendingContainer] = useState(false);
  const [containerSendInfo, setContainerSendInfo] = useState<Record<string | number, { trackingLink?: string; trackingNumber: string; courierCompany: string; etaDate: string }>>({});

  // ================== PAGINACIÓN (8 por página) ==================
  const ITEMS_PER_PAGE = 8;
  const [pedidosPage, setPedidosPage] = useState(1);
  const [boxesPage, setBoxesPage] = useState(1);
  const [containersPage, setContainersPage] = useState(1);
  const getPageSlice = (total: number, page: number) => {
    const start = Math.max(0, (page - 1) * ITEMS_PER_PAGE);
    const end = Math.min(total, start + ITEMS_PER_PAGE);
    return { start, end };
  };
  const getVisiblePages = (totalPages: number, current: number) => {
    if (totalPages <= 1) return [1];
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    let start = Math.max(1, current - 2);
    let end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  // Cerrar modales clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modalCotizar.open && modalCotizarRef.current && !modalCotizarRef.current.contains(e.target as Node)) closeModalCotizar();
      if (modalEmpaquetarPedido.open && modalEmpaquetarPedidoRef.current && !modalEmpaquetarPedidoRef.current.contains(e.target as Node)) closeModalEmpaquetarPedido();
      if (modalCrearCaja.open && modalCrearCajaRef.current && !modalCrearCajaRef.current.contains(e.target as Node)) closeModalCrearCaja();
      if (modalEliminarCaja.open && modalEliminarCajaRef.current && !modalEliminarCajaRef.current.contains(e.target as Node)) closeModalEliminarCaja();
      if (modalEmpaquetarCaja.open && modalEmpaquetarCajaRef.current && !modalEmpaquetarCajaRef.current.contains(e.target as Node)) closeModalEmpaquetarCaja();
      if (modalCrearContenedor.open && modalCrearContenedorRef.current && !modalCrearContenedorRef.current.contains(e.target as Node)) closeModalCrearContenedor();
      if (modalEliminarContenedor.open && modalEliminarContenedorRef.current && !modalEliminarContenedorRef.current.contains(e.target as Node)) closeModalEliminarContenedor();
      if (modalVerCajasCont.open && modalVerCajasContRef.current && !modalVerCajasContRef.current.contains(e.target as Node)) setModalVerCajasCont({ open: false });
      if (modalEnviarContenedor.open && modalEnviarContenedorRef.current && !modalEnviarContenedorRef.current.contains(e.target as Node)) closeModalEnviarContenedor();
      if (modalPropAlternativa.open && modalPropAlternativaRef.current && !modalPropAlternativaRef.current.contains(e.target as Node)) closeModalPropAlternativa();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modalCotizar.open, modalEmpaquetarPedido.open, modalCrearCaja.open, modalEliminarCaja.open, modalEmpaquetarCaja.open, modalCrearContenedor.open, modalEliminarContenedor.open, modalVerCajasCont.open, modalEnviarContenedor.open, modalPropAlternativa.open]);

  useEffect(() => { setMounted(true); fetchPedidos(); }, []);
  // Resolve current user id for realtime subscriptions
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        setChinaId(user?.id);
      } catch { /* ignore */ }
    })();
  }, []);

  // Orders realtime (assigned to this China user)
  useRealtimeChina(() => { fetchPedidos(); }, chinaId);

  // Realtime for boxes/containers/orders to keep lists and open modals in sync
  const activeSubTabRef = useRef(activeSubTab);
  const modalVerPedidosCajaRefState = useRef(modalVerPedidosCaja.open);
  const modalVerCajasContRefState = useRef(modalVerCajasCont.open);
  const modalVerPedidosCajaIdRef = useRef<number | string | undefined>(undefined);
  const modalVerCajasContIdRef = useRef<number | string | undefined>(undefined);

  useEffect(() => { activeSubTabRef.current = activeSubTab; }, [activeSubTab]);
  useEffect(() => { modalVerPedidosCajaRefState.current = modalVerPedidosCaja.open; }, [modalVerPedidosCaja.open]);
  useEffect(() => { modalVerCajasContRefState.current = modalVerCajasCont.open; }, [modalVerCajasCont.open]);
  useEffect(() => { modalVerPedidosCajaIdRef.current = modalVerPedidosCaja.boxId; }, [modalVerPedidosCaja.boxId]);
  useEffect(() => { modalVerCajasContIdRef.current = modalVerCajasCont.containerId; }, [modalVerCajasCont.containerId]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
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
      .channel('china-tab-boxes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boxes' }, () => {
        const tab = activeSubTabRef.current;
        const needsBoxes = tab === 'cajas' || modalVerPedidosCajaRefState.current;
        const needsContainers = tab === 'contenedores' || modalVerCajasContRefState.current;
        if (needsBoxes) debounce('boxes', fetchBoxes);
        if (needsContainers) debounce('containers', fetchContainers);
        if (modalVerPedidosCajaRefState.current && modalVerPedidosCajaIdRef.current !== undefined) {
          debounce('boxes', () => fetchOrdersByBoxId(modalVerPedidosCajaIdRef.current as any));
        }
        if (modalVerCajasContRefState.current && modalVerCajasContIdRef.current !== undefined) {
          debounce('containers', () => fetchBoxesByContainerId(modalVerCajasContIdRef.current as any));
        }
      })
      .subscribe();

    const containersChannel = supabase
      .channel('china-tab-containers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, () => {
        const tab = activeSubTabRef.current;
        const needsContainers = tab === 'contenedores' || modalVerCajasContRefState.current;
        const needsBoxes = tab === 'cajas' || modalVerPedidosCajaRefState.current;
        if (needsContainers) debounce('containers', fetchContainers);
        if (needsBoxes) debounce('boxes', fetchBoxes);
        if (modalVerPedidosCajaRefState.current && modalVerPedidosCajaIdRef.current !== undefined) {
          debounce('boxes', () => fetchOrdersByBoxId(modalVerPedidosCajaIdRef.current as any));
        }
        if (modalVerCajasContRefState.current && modalVerCajasContIdRef.current !== undefined) {
          debounce('containers', () => fetchBoxesByContainerId(modalVerCajasContIdRef.current as any));
        }
      })
      .subscribe();

    const ordersChannel = supabase
      .channel('china-tab-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        // Always refresh orders list for stats and main view
        debounce('boxes', fetchPedidos);
        const tab = activeSubTabRef.current;
        const needsBoxCounts = tab === 'cajas' || modalVerPedidosCajaRefState.current || modalVerCajasContRefState.current;
        if (needsBoxCounts) debounce('boxes', fetchBoxes);
        if (modalVerPedidosCajaRefState.current && modalVerPedidosCajaIdRef.current !== undefined) {
          debounce('boxes', () => fetchOrdersByBoxId(modalVerPedidosCajaIdRef.current as any));
        }
        if (modalVerCajasContRefState.current && modalVerCajasContIdRef.current !== undefined) {
          debounce('containers', () => fetchBoxesByContainerId(modalVerCajasContIdRef.current as any));
        }
      })
      .subscribe();

    // Optional: refresh when clients table changes (names might update)
    const clientsChannel = supabase
      .channel('china-tab-clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        debounce('boxes', fetchPedidos);
      })
      .subscribe();

    return () => {
      if (boxesTimer) clearTimeout(boxesTimer);
      if (containersTimer) clearTimeout(containersTimer);
      supabase.removeChannel(boxesChannel);
      supabase.removeChannel(containersChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(clientsChannel);
    };
  }, []);
  useEffect(() => { if (activeSubTab === 'cajas') fetchBoxes(); if (activeSubTab === 'contenedores') fetchContainers(); }, [activeSubTab]);
  // Reset de página al cambiar filtros/datasets
  useEffect(() => { setPedidosPage(1); }, [filtroCliente, filtroEstado, pedidos.length]);
  useEffect(() => { setBoxesPage(1); }, [filtroCaja, boxes.length]);
  useEffect(() => { setContainersPage(1); }, [filtroContenedor, containers.length]);

  async function fetchPedidos() {
    setLoadingPedidos(true);
    try {
      // Traer TODOS los pedidos que estén asignados a algún empleado de China (sin importar el usuario logueado)
      const res = await fetch(`/china/pedidos/api/orders`, { cache: 'no-store' });
      const data = await res.json();
      if (!Array.isArray(data)) { setPedidos([]); return; }
      // Mantener sólo los que tienen asignedEChina definido (el API ya lo hace si no se pasa el parámetro, esto es defensivo)
      const mappedPedidos = data
        .filter((order: any) => !!order.asignedEChina)
        // Ya no excluimos state 1; queremos ver pedidos recién creados si están asignados
        .map((order: any) => ({
          id: order.id,
          cliente: order.clientName || '',
          producto: order.productName || '',
          cantidad: order.quantity || 0,
          estado: mapStateToEstado(order.state),
          cotizado: order.state === 3 || (!!order.totalQuote && Number(order.totalQuote) > 0),
          precio: order.totalQuote ? Number(order.totalQuote) / Math.max(1, Number(order.quantity || 1)) : null,
          fecha: order.created_at || '',
          pdfRoutes: order.pdfRoutes || '',
          deliveryType: order.deliveryType || '',
          shippingType: order.shippingType || '',
          totalQuote: order.totalQuote ?? null,
          numericState: typeof order.state === 'number' ? order.state : undefined,
          hasAlternative: order.hasAlternative,
          alternativeStatus: order.alternativeStatus,
          alternativeRejectionReason: order.alternativeRejectionReason,
        }));
      setPedidos(mappedPedidos);
    } finally { setLoadingPedidos(false); }
  }

  // ================== CAJAS ==================
  async function handleConfirmCrearCaja() {
    try {
      if (!newBoxName.trim()) {
        toast({ title: t('admin.orders.china.modals.createBox.nameRequired', { defaultValue: 'El nombre de la caja es obligatorio' }) });
        return;
      }
      setCreatingBox(true);
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('boxes').insert([{ state: 1, creation_date: new Date().toISOString(), name: newBoxName.trim() }]);
      if (error) throw error;
      toast({ title: t('admin.orders.china.toasts.boxCreatedTitle', { defaultValue: 'Caja creada' }), description: t('admin.orders.china.toasts.boxCreatedDesc', { defaultValue: 'La caja fue creada correctamente.' }) });
      closeModalCrearCaja();
      setNewBoxName('');
      fetchBoxes();
    } catch (e: any) { console.error(e); toast({ title: 'No se pudo crear', description: 'Intenta más tarde.' }); } finally { setCreatingBox(false); }
  }

  async function handleDeleteCaja() {
    if (!modalEliminarCaja.box) return;
    try {
      setDeletingBox(true);
      const supabase = getSupabaseBrowserClient();
      const id = modalEliminarCaja.box.box_id ?? modalEliminarCaja.box.boxes_id ?? modalEliminarCaja.box.id;
      if (!id) { toast({ title: 'ID inválido' }); return; }
      const { error } = await supabase.from('boxes').delete().eq('box_id', id);
      if (error) throw error;
      toast({ title: 'Caja eliminada' });
      closeModalEliminarCaja();
      fetchBoxes();
    } catch (e: any) { console.error(e); toast({ title: 'Error eliminando', description: 'Reintenta' }); } finally { setDeletingBox(false); }
  }

  async function fetchBoxes() {
    setBoxesLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from('boxes').select('*'); if (error) throw error;
      const list = (data || []) as BoxItem[];
      list.sort((a, b) => { const da = new Date((a.creation_date ?? a.created_at ?? '') as string).getTime() || 0; const db = new Date((b.creation_date ?? b.created_at ?? '') as string).getTime() || 0; return db - da; });
      setBoxes(list);
      const ids = list.map(b => b.box_id ?? b.boxes_id ?? (b as any).id).filter(v => v != null);
      if (ids.length > 0) {
        const { data: ordersData } = await supabase.from('orders').select('id, box_id').in('box_id', ids as any);
        const counts: Record<string | number, number> = {}; (ordersData || []).forEach(r => { counts[r.box_id as any] = (counts[r.box_id as any] || 0) + 1; });
        setOrderCountsByBoxMain(counts);

        // Determinar qué cajas tienen solo pedidos aéreos
        const airOnlySet = new Set<string | number>();
        for (const boxId of ids) {
          const isAirOnly = await checkIfBoxHasOnlyAirOrders(boxId);
          if (isAirOnly) {
            airOnlySet.add(boxId);
          }
        }
        setAirOnlyBoxes(airOnlySet);
      } else {
        setOrderCountsByBoxMain({});
        setAirOnlyBoxes(new Set());
      }
    } catch (e) { console.error(e); } finally { setBoxesLoading(false); }
  }

  async function fetchOrdersByBoxId(boxId: number | string) {
    setOrdersByBoxLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from('orders').select('*').eq('box_id', boxId); if (error) throw error;
      const mapped: Pedido[] = (data || []).map((o: any) => ({ id: o.id, cliente: o.clientName || o.client || '—', producto: o.productName || o.product || '—', cantidad: Number(o.quantity || 0), estado: mapStateToEstado(Number(o.state || 2)), cotizado: Number(o.state) === 3 || (!!o.totalQuote && Number(o.totalQuote) > 0), precio: o.totalQuote ? Number(o.totalQuote) / Math.max(1, Number(o.quantity || 1)) : null, fecha: o.created_at || o.creation_date || new Date().toISOString(), pdfRoutes: o.pdfRoutes || '', deliveryType: o.deliveryType || '', shippingType: o.shippingType || '', totalQuote: o.totalQuote ?? null, numericState: typeof o.state === 'number' ? o.state : Number(o.state || 0) }));
      setOrdersByBox(mapped);
    } catch (e) { console.error(e); } finally { setOrdersByBoxLoading(false); }
  }

  // ================== CONTENEDORES ==================
  async function handleConfirmCrearContenedor() {
    try {
      if (!newContainerName.trim()) {
        toast({ title: t('admin.orders.china.modals.createContainer.nameRequired', { defaultValue: 'El nombre del contenedor es obligatorio' }) });
        return;
      }
      setCreatingContainer(true);
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('containers').insert([{ state: 1, creation_date: new Date().toISOString(), name: newContainerName.trim() }]);
      if (error) throw error;
      toast({ title: t('admin.orders.china.toasts.containerCreatedTitle', { defaultValue: 'Contenedor creado' }) });
      closeModalCrearContenedor();
      setNewContainerName('');
      fetchContainers();
    } catch (e: any) { console.error(e); toast({ title: 'No se pudo crear contenedor' }); } finally { setCreatingContainer(false); }
  }

  async function handleDeleteContenedor() {
    if (!modalEliminarContenedor.container) return;
    try { setDeletingContainer(true); const supabase = getSupabaseBrowserClient(); const id = modalEliminarContenedor.container.container_id ?? modalEliminarContenedor.container.containers_id ?? modalEliminarContenedor.container.id; if (!id) { toast({ title: 'ID inválido' }); return; } const { error } = await supabase.from('containers').delete().eq('container_id', id); if (error) throw error; toast({ title: 'Contenedor eliminado' }); closeModalEliminarContenedor(); fetchContainers(); } catch (e: any) { console.error(e); toast({ title: 'Error eliminando' }); } finally { setDeletingContainer(false); }
  }

  async function fetchContainers() {
    setContainersLoading(true);
    try { const supabase = getSupabaseBrowserClient(); const { data, error } = await supabase.from('containers').select('*'); if (error) throw error; const list = (data || []) as ContainerItem[]; list.sort((a, b) => { const da = new Date((a.creation_date ?? a.created_at ?? '') as string).getTime() || 0; const db = new Date((b.creation_date ?? b.created_at ?? '') as string).getTime() || 0; return db - da; }); setContainers(list); } catch (e) { console.error(e); } finally { setContainersLoading(false); }
  }

  async function fetchBoxesByContainerId(containerId: number | string) {
    setBoxesByContainerLoading(true);
    try { const supabase = getSupabaseBrowserClient(); const { data, error } = await supabase.from('boxes').select('*').eq('container_id', containerId); if (error) throw error; const list = (data || []) as BoxItem[]; list.sort((a, b) => { const da = new Date((a.creation_date ?? a.created_at ?? '') as string).getTime() || 0; const db = new Date((b.creation_date ?? b.created_at ?? '') as string).getTime() || 0; return db - da; }); setBoxesByContainer(list); const ids = list.map(b => b.box_id ?? b.boxes_id ?? (b as any).id).filter(v => v != null); if (ids.length > 0) { const { data: ordersData } = await supabase.from('orders').select('id, box_id').in('box_id', ids as any); const counts: Record<string | number, number> = {}; (ordersData || []).forEach(r => { counts[r.box_id as any] = (counts[r.box_id as any] || 0) + 1; }); setOrderCountsByBox(counts); } else setOrderCountsByBox({}); } catch (e) { console.error(e); } finally { setBoxesByContainerLoading(false); }
  }

  // ================== ACCIONES ==================
  async function handleSelectCajaForPedido(pedidoId: number, box: BoxItem) {
    const boxId = box.box_id ?? box.boxes_id ?? box.id; if (!boxId) { toast({ title: 'Caja inválida' }); return; }
    try {
      const supabase = getSupabaseBrowserClient(); const boxStateNum = (box.state ?? 1) as number; if (boxStateNum >= 3) { toast({ title: 'No permitido', description: 'Caja enviada' }); return; } if ((box as any).container_id) { const { data: cRow } = await supabase.from('containers').select('state').eq('container_id', (box as any).container_id).maybeSingle(); const contState = (cRow?.state ?? 1) as number; if (contState >= 3) { toast({ title: 'No permitido', description: 'Contenedor enviado' }); return; } }
      const nextOrderState = boxStateNum === 2 ? 7 : 6;
      const { error } = await supabase.from('orders').update({ box_id: boxId, state: nextOrderState }).eq('id', pedidoId); if (error) throw error;
      toast({ title: 'Pedido asignado', description: `Pedido #ORD-${pedidoId} -> caja ${boxId}` });
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, numericState: nextOrderState, estado: mapStateToEstado(nextOrderState) } : p));
      setOrderCountsByBoxMain(prev => ({ ...prev, [boxId as any]: (prev[boxId as any] || 0) + 1 }));
      closeModalEmpaquetarPedido();
    } catch (e: any) { console.error(e); toast({ title: 'Error asignando' }); }
  }

  async function handleUnpackOrder(pedidoId: number) {
    try {
      const supabase = getSupabaseBrowserClient(); const { data: row } = await supabase.from('orders').select('box_id').eq('id', pedidoId).maybeSingle(); const boxId = (row as any)?.box_id; if (!boxId) { toast({ title: 'Sin caja' }); return; } const { data: boxRow } = await supabase.from('boxes').select('state, container_id').eq('box_id', boxId).maybeSingle(); const bState = (boxRow?.state ?? 1) as number; if (bState >= 3) { toast({ title: 'No permitido', description: 'Caja enviada' }); return; } if (boxRow?.container_id) { const { data: contRow } = await supabase.from('containers').select('state').eq('container_id', boxRow.container_id).maybeSingle(); if ((contRow?.state ?? 1) >= 3) { toast({ title: 'No permitido', description: 'Contenedor enviado' }); return; } }
      const { error } = await supabase.from('orders').update({ box_id: null, state: 5 }).eq('id', pedidoId); if (error) throw error; toast({ title: 'Pedido desempaquetado' }); setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, numericState: 5, estado: mapStateToEstado(5) } : p)); setOrderCountsByBoxMain(prev => { if (boxId == null) return prev; return { ...prev, [boxId]: Math.max(0, (prev[boxId] || 0) - 1) }; }); if (modalVerPedidosCaja.open && String(modalVerPedidosCaja.boxId) === String(boxId)) fetchOrdersByBoxId(boxId);
    }
    catch (e: any) { console.error(e); toast({ title: 'Error desempaquetando' }); }
  }

  async function handleSelectContenedorForCaja(boxId: number | string, container: ContainerItem) {
    const containerId = container.container_id ?? container.containers_id ?? container.id; if (!containerId) { toast({ title: 'Contenedor inválido' }); return; }
    try {
      const supabase = getSupabaseBrowserClient(); if ((container.state ?? 1) >= 3) { toast({ title: 'No permitido', description: 'Contenedor enviado' }); return; }
      // Regla: No permitir empaquetar una caja vacía
      try {
        const { data: anyOrder, error: checkErr } = await supabase.from('orders').select('id').eq('box_id', boxId).limit(1);
        if (checkErr) { console.error('Error verificando pedidos de la caja:', checkErr); }
        if (!anyOrder || anyOrder.length === 0) { toast({ title: 'No permitido', description: 'No puedes empaquetar una caja vacía. Agrega pedidos primero.' }); return; }
      } catch (e) { console.error('Fallo verificando si la caja está vacía:', e); toast({ title: 'Error inesperado', description: 'Intenta más tarde.' }); return; }
      const { error: boxErr } = await supabase.from('boxes').update({ container_id: containerId, state: 2 }).eq('box_id', boxId); if (boxErr) throw boxErr;
      const { error: ordersErr } = await supabase.from('orders').update({ state: 7 }).eq('box_id', boxId); if (ordersErr) console.error(ordersErr);
      const { error: contUpdateErr } = await supabase.from('containers').update({ state: 2 }).eq('container_id', containerId); if (contUpdateErr) console.error(contUpdateErr);
      toast({ title: 'Caja asignada', description: `Caja #BOX-${boxId} -> contenedor #CONT-${containerId}` });
      setBoxes(prev => prev.map(b => { const id = b.box_id ?? b.boxes_id ?? b.id; if (String(id) === String(boxId)) return { ...b, container_id: containerId, state: 2 }; return b; }));
      setContainers(prev => prev.map(c => { const cid = c.container_id ?? c.containers_id ?? c.id; if (String(cid) === String(containerId)) return { ...c, state: 2 }; return c; }));
      closeModalEmpaquetarCaja();
    } catch (e: any) { console.error(e); toast({ title: 'Error asignando contenedor' }); }
  }

  async function handleUnpackBox(boxId: number | string, options?: { containerId?: number | string }) {
    try {
      const supabase = getSupabaseBrowserClient(); if (options?.containerId) { const { data: cont } = await supabase.from('containers').select('state').eq('container_id', options.containerId).maybeSingle(); if ((cont?.state ?? 1) >= 3) { toast({ title: 'No permitido', description: 'Contenedor enviado' }); return; } }
      await supabase.from('orders').update({ box_id: null, state: 5 }).eq('box_id', boxId);
      const { error } = await supabase.from('boxes').update({ container_id: null, state: 1 }).eq('box_id', boxId); if (error) throw error;
      toast({ title: 'Caja desempaquetada' });
      setBoxes(prev => prev.map(b => { const id = b.box_id ?? b.boxes_id ?? b.id; if (String(id) === String(boxId)) return { ...b, container_id: null, state: 1 }; return b; }));
      setOrderCountsByBoxMain(prev => ({ ...prev, [boxId]: 0 }));
      if (options?.containerId) fetchBoxesByContainerId(options.containerId);
      fetchPedidos();
    } catch (e: any) { console.error(e); toast({ title: 'Error desempaquetando caja' }); }
  }

  async function handleSendContainer(container: ContainerItem, details?: { trackingLink?: string; trackingNumber: string; courierCompany: string; etaDate: string }) {
    const stateNum = (container.state ?? 1) as number; if (stateNum !== 2) return; const containerId = container.container_id ?? container.containers_id ?? container.id; if (!containerId) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const baseDetails: any = details ? {
        tracking_number: details.trackingNumber,
        tracking_company: details.courierCompany,
        ...(details.trackingLink ? { tracking_link: details.trackingLink } : {})
      } : {};
      // Try with column name 'arrive-data' first (as specified)
      let contErr: any = null;
      if (details) {
        const payload1: any = { ...baseDetails, ['arrive-data']: details.etaDate, state: 3 };
        const res1 = await supabase.from('containers').update(payload1).eq('container_id', containerId);
        contErr = res1.error;
        // If undefined column error for arrive-data, retry with arrive_date
        if (contErr && (contErr.code === '42703' || /arrive-data/.test(contErr.message || '') || /column .* does not exist/i.test(contErr.message || ''))) {
          const payload2: any = { ...baseDetails, arrive_date: details.etaDate, state: 3 };
          const res2 = await supabase.from('containers').update(payload2).eq('container_id', containerId);
          contErr = res2.error;
        }
        // Si el error es por tracking_link inexistente, reintentar sin ese campo
        if (contErr && /tracking_link/.test(contErr.message || '')) {
          const baseWithoutLink = { ...baseDetails };
          delete (baseWithoutLink as any).tracking_link;
          const retryPayload: any = { ...baseWithoutLink, arrive_date: details.etaDate, state: 3 };
          const resRetry = await supabase.from('containers').update(retryPayload).eq('container_id', containerId);
          contErr = resRetry.error;
        }
        // If still error (likely RLS on tracking fields), try to at least set state=3
        if (contErr) {
          const resState = await supabase.from('containers').update({ state: 3 }).eq('container_id', containerId);
          if (resState.error) throw resState.error;
          // Notify about partial success and continue with cascades
          toast({ title: 'Contenedor enviado', description: 'El estado cambió, pero no se guardaron los datos de tracking. Revisa las políticas/columnas.' });
          contErr = null;
        }
      } else {
        // No details provided: only update state
        const { error } = await supabase.from('containers').update({ state: 3 }).eq('container_id', containerId);
        contErr = error;
      }
      if (contErr) throw contErr;
      const { data: boxRows } = await supabase.from('boxes').select('box_id').eq('container_id', containerId);
      const boxIds = (boxRows || []).map(r => r.box_id).filter((v: any) => v != null);
      if (boxIds.length > 0) { await supabase.from('boxes').update({ state: 4 }).in('box_id', boxIds as any); await supabase.from('orders').update({ state: 9 }).in('box_id', boxIds as any); }
      toast({ title: 'Contenedor enviado' });
      setContainers(prev => prev.map(c => { const cid = c.container_id ?? c.containers_id ?? c.id; if (String(cid) === String(containerId)) return { ...c, state: 3 }; return c; }));
      setBoxes(prev => prev.map(b => { if (String((b as any).container_id) === String(containerId)) return { ...b, state: 4 }; return b; }));
    } catch (e: any) { console.error(e); toast({ title: 'No se pudo enviar contenedor', description: e?.message || 'Error desconocido' }); }
  }

  // ================== COTIZAR ==================
  async function cotizarPedido(pedido: Pedido, precioUnitario: number, precioEnvio: number, altura: number, anchura: number, largo: number, peso: number) {
    try {
      const supabase = getSupabaseBrowserClient();
      const totalProductos = Number(precioUnitario) * Number(pedido.cantidad || 0);
      const total = totalProductos + Number(precioEnvio);
      // 1) Actualizar solo campos de cotización (sin cambiar el estado aquí)
      const { error } = await supabase.from('orders').update({
        totalQuote: total,
        unitQuote: precioUnitario,
        shippingPrice: precioEnvio,
        height: altura,
        width: anchura,
        long: largo,
        weight: peso
      }).eq('id', pedido.id);
      if (error) throw error;

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

      setPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, cotizado: true, precio: precioUnitario, totalQuote: total, numericState: 3, estado: 'cotizado' } : p));
      toast({ title: 'Pedido cotizado' });
      closeModalCotizar();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error al cotizar' });
    }
  }

  // Intentar descargar etiqueta/pdf asociada a la caja: buscar pedidos de la caja y abrir el primer pdfRoutes encontrado
  async function handleDownloadLabelForBox(boxId: number | string | undefined) {
    if (boxId === undefined) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from('orders').select('id, pdfRoutes').eq('box_id', boxId).limit(10);
      if (error) throw error;
      const list = (data || [] as any[]);
      for (const row of list) {
        const pdf = row.pdfRoutes;
        if (pdf && typeof pdf === 'string' && pdf.trim()) { try { window.open(pdf, '_blank'); return; } catch (e) { console.error('open pdf error', e); } }
        if (Array.isArray(pdf) && pdf.length > 0) { try { window.open(pdf[0], '_blank'); return; } catch (e) { console.error(e); } }
      }
      // Si no hay pdf, mostrar aviso
      toast({ title: t('admin.orders.china.modals.selectBoxForOrder.noPdfTitle', { defaultValue: 'Sin PDF' }), description: t('admin.orders.china.modals.selectBoxForOrder.noPdfDesc', { defaultValue: 'No se encontró etiqueta asociada a esta caja.' }) });
    } catch (e) { console.error(e); toast({ title: 'Error', description: 'No se pudo descargar etiqueta.' }); }
  }

  // ================== MODALES CLOSE HELPERS ==================
  function closeModalCotizar() { setIsClosingModalCotizar(true); setTimeout(() => { setModalCotizar({ open: false }); setIsClosingModalCotizar(false); }, 200); }
  function closeModalEmpaquetarPedido() { setIsClosingModalEmpaquetarPedido(true); setTimeout(() => { setModalEmpaquetarPedido({ open: false }); setIsClosingModalEmpaquetarPedido(false); }, 200); }
  function closeModalAvisoEtiqueta() { setModalAvisoEtiqueta({ open: false }); }
  function closeModalCrearCaja() { setIsClosingModalCrearCaja(true); setTimeout(() => { setModalCrearCaja({ open: false }); setIsClosingModalCrearCaja(false); setNewBoxName(''); }, 200); }
  function closeModalEliminarCaja() { setIsClosingModalEliminarCaja(true); setTimeout(() => { setModalEliminarCaja({ open: false }); setIsClosingModalEliminarCaja(false); }, 200); }
  function closeModalEmpaquetarCaja() { setIsClosingModalEmpaquetarCaja(true); setTimeout(() => { setModalEmpaquetarCaja({ open: false }); setIsClosingModalEmpaquetarCaja(false); }, 200); }
  function closeModalCrearContenedor() { setIsClosingModalCrearContenedor(true); setTimeout(() => { setModalCrearContenedor({ open: false }); setIsClosingModalCrearContenedor(false); setNewContainerName(''); }, 200); }
  function closeModalEliminarContenedor() { setIsClosingModalEliminarContenedor(true); setTimeout(() => { setModalEliminarContenedor({ open: false }); setIsClosingModalEliminarContenedor(false); }, 200); }
  function closeModalEnviarContenedor() { setIsClosingModalEnviarContenedor(true); setTimeout(() => { setModalEnviarContenedor({ open: false }); setIsClosingModalEnviarContenedor(false); setSendTrackingLink(''); setSendTrackingNumber(''); setSendCourierCompany(''); setSendEtaDate(''); }, 200); }
  function closeModalPropAlternativa() { setIsClosingModalPropAlternativa(true); setTimeout(() => { setModalPropAlternativa({ open: false }); setIsClosingModalPropAlternativa(false); setAltProductName(''); setAltDescription(''); setAltPrice(''); setAltImageFile(null); }, 200); }

  // Proponer alternativa de producto
  async function handleProposeAlternative() {
    if (!modalPropAlternativa.pedido) return;
    if (!altProductName.trim()) {
      toast({ title: 'Nombre requerido', description: 'Debes ingresar el nombre del producto alternativo' });
      return;
    }

    try {
      setCreatingAlternative(true);
      const supabase = getSupabaseBrowserClient();

      // Subir imagen si existe
      let imageUrl: string | undefined;
      if (altImageFile) {
        const fileExt = altImageFile.name.split('.').pop();
        const fileName = `alternative_${modalPropAlternativa.pedido.id}_${Date.now()}.${fileExt}`;
        const filePath = `product-alternatives/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('orders')
          .upload(filePath, altImageFile);

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('orders')
            .getPublicUrl(filePath);
          imageUrl = publicUrl;
        }
      }

      // Obtener ID del usuario China actual
      const { data: { user } } = await supabase.auth.getUser();

      // Crear alternativa vía API
      const response = await fetch('/api/product-alternatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: modalPropAlternativa.pedido.id,
          alternative_product_name: altProductName.trim(),
          alternative_description: altDescription.trim() || null,
          alternative_image_url: imageUrl || null,
          alternative_price: altPrice ? parseFloat(altPrice) : null,
          proposed_by_china_id: user?.id || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear alternativa');
      }

      toast({
        title: 'Alternativa propuesta',
        description: `Se envió "${altProductName}" como alternativa al cliente`
      });

      closeModalPropAlternativa();
      fetchPedidos();
    } catch (error: any) {
      console.error('Error proposing alternative:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo proponer la alternativa'
      });
    } finally {
      setCreatingAlternative(false);
    }
  }

  // (Antiguas funciones básicas reemplazadas por versiones extendidas arriba)

  // ================== AGRUPACIÓN DE PEDIDOS (BATCH VIEW) ==================
  interface OrderGroup {
    groupId: string;
    clientId: string;
    clientName: string;
    orders: Pedido[];
    minId: number;
    maxId: number;
    date: string; // Fecha del pedido más reciente del grupo
  }

  // Función para agrupar pedidos por cliente y proximidad temporal (simulando "carrito")
  function groupOrders(orders: Pedido[]): OrderGroup[] {
    if (orders.length === 0) return [];

    // 1. Ordenar por fecha descendente (lo más nuevo arriba)
    const sorted = [...orders].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const groups: OrderGroup[] = [];
    let currentGroup: Pedido[] = [];

    // Helper para finalizar un grupo y añadirlo
    const commitGroup = () => {
      if (currentGroup.length > 0) {
        const first = currentGroup[0]; // El más reciente (por el sort)
        const ids = currentGroup.map(o => o.id);
        groups.push({
          groupId: `${first.cliente}-${first.id}`, // ID único para key
          clientId: first.cliente, // Usamos el nombre como ID si no hay ID real expuesto
          clientName: first.cliente,
          orders: currentGroup,
          minId: Math.min(...ids),
          maxId: Math.max(...ids),
          date: first.fecha
        });
        currentGroup = [];
      }
    };

    // 2. Iterar y agrupar
    // Criterio: Mismo cliente Y diferencia de tiempo < 20 minutos entre pedidos consecutivos
    const TIME_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutos

    for (const order of sorted) {
      if (currentGroup.length === 0) {
        currentGroup.push(order);
      } else {
        const lastInGroup = currentGroup[currentGroup.length - 1];
        const timeDiff = Math.abs(new Date(lastInGroup.fecha).getTime() - new Date(order.fecha).getTime());
        const sameClient = lastInGroup.cliente === order.cliente;

        if (sameClient && timeDiff < TIME_THRESHOLD_MS) {
          currentGroup.push(order);
        } else {
          commitGroup();
          currentGroup.push(order);
        }
      }
    }
    commitGroup(); // Commit del último grupo

    return groups;
  }

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
      <div className="mb-6 border rounded-lg shadow-sm bg-white overflow-hidden">
        {/* Header del Lote */}
        <div
          className="p-4 bg-slate-50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-100 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start gap-4">
            {/* Icono / Avatar Cliente */}
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
              {group.clientName.charAt(0).toUpperCase()}
            </div>

            <div>
              {/* Título Principal: Rango de IDs */}
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="font-mono text-blue-600">
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
              <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
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
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <div className={`transform transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500">
                  <path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
              </div>
            </Button>
          </div>
        </div>

        {/* Lista de Pedidos (Acordeón) */}
        {expanded && (
          <div className="divide-y">
            {group.orders.map((pedido) => (
              <div key={pedido.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                {/* Renderizado del pedido individual (reutilizando estructura existente pero simplificada si es necesario) */}
                {renderPedidoRow(pedido)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Helper para renderizar la fila de pedido (extraído del map original para limpieza)
  const renderPedidoRow = (pedido: Pedido) => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm text-slate-500">#ORD-{pedido.id}</span>
          <Badge className={getOrderBadge(t, pedido.numericState).className} variant="outline">
            {getOrderBadge(t, pedido.numericState).label}
          </Badge>
          {pedido.deliveryType === 'air' && <Badge variant="secondary" className="bg-sky-100 text-sky-700 hover:bg-sky-100"><Truck className="w-3 h-3 mr-1" /> Aéreo</Badge>}
          {pedido.deliveryType === 'maritime' && <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Truck className="w-3 h-3 mr-1" /> Marítimo</Badge>}
          {pedido.deliveryType === 'doorToDoor' && <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100"><Truck className="w-3 h-3 mr-1" /> Puerta a Puerta</Badge>}
        </div>
        <h4 className="font-medium text-slate-900 truncate">{pedido.producto}</h4>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
          <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {pedido.cantidad} u.</span>
          {pedido.cotizado && pedido.precio && (
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <DollarSign className="w-3 h-3" /> {pedido.precio.toFixed(2)} c/u
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Botones de acción existentes */}
        {pedido.estado === 'pendiente' && (
          <Button size="sm" onClick={() => setModalCotizar({ open: true, pedido })}>
            <Calculator className="w-4 h-4 mr-2" /> {t('chinese.ordersPage.actions.quote')}
          </Button>
        )}
        {pedido.estado === 'cotizado' && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1">
            <CheckCircle className="w-3 h-3 mr-2" /> Cotizado
          </Badge>
        )}
        {pedido.estado === 'procesando' && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleGenerateOrderLabelPdf(pedido.id)}>
              <Tag className="w-4 h-4 mr-2" /> Etiqueta
            </Button>
            <Button size="sm" onClick={() => setModalEmpaquetarPedido({ open: true, pedidoId: pedido.id })}>
              <Boxes className="w-4 h-4 mr-2" /> Empaquetar
            </Button>
          </div>
        )}

        {/* Menú de alternativas (siempre visible si aplica) */}
        <Button size="icon" variant="ghost" onClick={() => setModalPropAlternativa({ open: true, pedido })}>
          <Pencil className="w-4 h-4 text-slate-400" />
        </Button>
      </div>
    </div>
  );

  const pedidosFiltrados = pedidos.filter(p => {
    const estadoOk = filtroEstado === 'todos' || p.estado === filtroEstado;
    const clienteOk = !filtroCliente || p.cliente.toLowerCase().includes(filtroCliente.toLowerCase());
    return estadoOk && clienteOk;
  });

  // Agrupar pedidos filtrados para visualización

  const visibleGroups = groupOrders(pedidosFiltrados);

  // Local helpers to map badge state to translated text
  const getOrderBadgeLabel = (stateNum?: number) => {
    const s = Number(stateNum ?? 0);
    if (s <= 0 || isNaN(s)) return t('admin.orders.china.badges.unknown');
    if (s === 2) return t('admin.orders.china.badges.pending');
    if (s === 3) return t('admin.orders.china.badges.quoted');
    if (s === 4) return t('admin.orders.china.badges.processing');
    if (s === 5) return t('admin.orders.china.badges.readyToPack');
    if (s === 6) return t('admin.orders.china.badges.inBox');
    if (s === 7) return t('admin.orders.china.badges.inContainer');
    if (s === 8) return t('admin.orders.china.badges.inTransit');
    if (s >= 9) return t('admin.orders.china.badges.shippedVzla');
    if (s >= 10) return t('admin.orders.china.badges.shippedVzla');
    if (s >= 11) return t('admin.orders.china.badges.shippedVzla');
    if (s >= 12) return t('admin.orders.china.badges.shippedVzla');
    if (s >= 13) return t('admin.orders.china.badges.shippedVzla');
    return t('admin.orders.china.badges.state', { num: s });
  };
  const getBoxBadgeLabel = (stateNum?: number) => {
    const s = Number(stateNum ?? 0);
    if (s <= 1) return t('admin.orders.china.boxBadges.new');
    if (s === 2) return t('admin.orders.china.boxBadges.packed');
    if (s === 3) return t('admin.orders.china.boxBadges.inContainer');
    if (s >= 4) return t('admin.orders.china.boxBadges.shipped');
    return t('admin.orders.china.boxBadges.state', { num: s });
  };
  const getContainerBadgeLabel = (stateNum?: number) => {
    const s = Number(stateNum ?? 0);
    if (s <= 1) return t('admin.orders.china.containerBadges.new');
    if (s === 2) return t('admin.orders.china.containerBadges.loading');
    if (s >= 3) return t('admin.orders.china.containerBadges.shipped');
    return t('admin.orders.china.containerBadges.state', { num: s });
  };

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

      // Cambiar estado de la caja a enviado (state = 4)
      const { error: boxUpdateError } = await supabase
        .from('boxes')
        .update({ state: 4 })
        .eq('box_id', boxId);

      if (boxUpdateError) {
        console.error('Error enviando caja:', boxUpdateError);
        toast({ title: t('chinese.ordersPage.toasts.sendBoxErrorTitle'), description: t('chinese.ordersPage.toasts.tryAgain') });
        return;
      }

      // Cambiar estado de todos los pedidos a enviado (state = 9)
      const { error: ordersUpdateError } = await supabase
        .from('orders')
        .update({ state: 9 })
        .eq('box_id', boxId);

      if (ordersUpdateError) {
        console.error('Error actualizando pedidos:', ordersUpdateError);
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

  const stats = {
    pendientes: pedidos.filter(p => p.estado === 'pendiente').length,
    cotizados: pedidos.filter(p => p.estado === 'cotizado').length,
    procesando: pedidos.filter(p => p.estado === 'procesando').length,
    enviados: pedidos.filter(p => p.estado === 'enviado').length,
    totalCotizado: pedidos.filter(p => p.precio).reduce((a, p) => a + (p.precio || 0), 0)
  };

  if (!mounted) return null;

  return (
    <>
      <div className="space-y-6">
        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
          <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 dark:from-yellow-900/20 dark:to-orange-900/20 dark:border-yellow-700 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base font-medium text-yellow-700 dark:text-yellow-300">{t('admin.orders.china.stats.pending')}</p>
                  <p className="text-2xl md:text-3xl font-bold text-yellow-800 dark:text-yellow-200">{stats.pendientes}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 dark:bg-yellow-800/30 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-700 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base font-medium text-blue-700 dark:text-blue-300">{t('admin.orders.china.stats.quoted')}</p>
                  <p className="text-2xl md:text-3xl font-bold text-blue-800 dark:text-blue-200">{stats.cotizados}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-800/30 rounded-lg flex items-center justify-center">
                  <Calculator className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 dark:from-purple-900/20 dark:to-violet-900/20 dark:border-purple-700 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base font-medium text-purple-700 dark:text-purple-300">{t('admin.orders.china.stats.processing')}</p>
                  <p className="text-2xl md:text-3xl font-bold text-purple-800 dark:text-purple-200">{stats.procesando}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 dark:bg-purple-800/30 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 md:w-6 md:h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-700 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base font-medium text-green-700 dark:text-green-300">{t('admin.orders.china.stats.shipped')}</p>
                  <p className="text-2xl md:text-3xl font-bold text-green-800 dark:text-green-200">{stats.enviados}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300 hidden md:block">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base font-medium text-emerald-700 dark:text-emerald-300">{t('admin.orders.china.stats.totalQuoted', { defaultValue: 'TOTAL QUOTED' })}</p>
                  <p className="text-xl md:text-2xl font-bold text-emerald-800 dark:text-emerald-200">${stats.totalCotizado.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100 dark:bg-emerald-800/30 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sub-tabs con indicador animado */}
        <div className="w-full">
          <div className="relative flex w-full gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 backdrop-blur px-1 py-1 shadow-sm overflow-hidden">
            <span
              className="absolute top-1 bottom-1 rounded-md bg-slate-900/95 dark:bg-slate-200 transition-all duration-300 ease-out shadow-sm"
              style={{
                left: `${(['pedidos', 'cajas', 'contenedores'] as const).indexOf(activeSubTab) * (100 / 3)}%`,
                width: 'calc((100% - 0.5rem * 2) / 3)'
              }}
            />
            {(['pedidos', 'cajas', 'contenedores'] as const).map(tab => {
              const label = tab === 'pedidos'
                ? t('admin.orders.china.tabs.ordersList')
                : tab === 'cajas'
                  ? t('admin.orders.china.boxes.title')
                  : t('admin.orders.china.containers.title');
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveSubTab(tab)}
                  className={
                    'relative z-10 flex-1 min-w-0 px-2 py-2 text-xs md:text-sm font-medium truncate rounded-md transition-colors duration-200 ' +
                    (activeSubTab === tab ? 'text-white dark:text-slate-900' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white')
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar unificada pedidos: se mueve al header de la lista */}

        {activeSubTab === 'pedidos' && (
          <Card className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5" />{t('admin.orders.china.orders.listTitle')}</CardTitle>
                <div className="w-full sm:w-auto flex items-center justify-end gap-2 md:gap-3 flex-wrap">
                  <Input value={filtroCliente} onChange={e => { setFiltroCliente(e.target.value); }} placeholder={t('admin.orders.china.filters.searchClientPlaceholder')} className="h-10 w-full sm:w-64 px-3" />
                  <Select value={filtroEstado} onValueChange={setFiltroEstado as any}>
                    <SelectTrigger className="h-10 w-full sm:w-56 px-3 whitespace-nowrap truncate"><SelectValue placeholder={t('admin.orders.china.filters.status')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">{t('admin.orders.china.filters.all')}</SelectItem>
                      <SelectItem value="pendiente">{t('admin.orders.china.filters.pending')}</SelectItem>
                      <SelectItem value="cotizado">{t('admin.orders.china.filters.quoted')}</SelectItem>
                      <SelectItem value="procesando">{t('admin.orders.china.filters.processing')}</SelectItem>
                      <SelectItem value="enviado">{t('admin.orders.china.filters.shipped')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Removed refresh button per request */}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPedidos ? (
                <div className="py-12 text-center text-sm">{t('common.loading')}</div>
              ) : visibleGroups.length === 0 ? (
                <div className="py-12 text-center text-sm">{t('admin.orders.china.orders.notFoundTitle')}</div>
              ) : (
                <div className="space-y-6">
                  {(() => {
                    const total = visibleGroups.length;
                    const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
                    const { start, end } = getPageSlice(total, pedidosPage);
                    const slicedGroups = visibleGroups.slice(start, end);
                    const pages = getVisiblePages(totalPages, pedidosPage);

                    return (
                      <>
                        {slicedGroups.map((group) => (
                          <OrderBatchGroup key={group.groupId} group={group} />
                        ))}

                        {/* Paginación */}
                        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                            {t('admin.orders.pagination.showing', { defaultValue: 'Mostrando' })} {Math.min(total, start + 1)} {t('admin.orders.pagination.to', { defaultValue: 'a' })} {end} {t('admin.orders.pagination.of', { defaultValue: 'de' })} {total} {t('admin.orders.pagination.results', { defaultValue: 'lotes' })}
                          </p>
                          <div className="flex items-center gap-1 justify-end flex-wrap">
                            <Button variant="outline" size="sm" disabled={pedidosPage <= 1} onClick={() => setPedidosPage(p => Math.max(1, p - 1))}>
                              {t('admin.orders.pagination.prev', { defaultValue: 'Anterior' })}
                            </Button>
                            {pages[0] > 1 && (<><Button variant="outline" size="sm" onClick={() => setPedidosPage(1)}>1</Button><span className="px-1 text-slate-400">…</span></>)}
                            {pages.map(p => (
                              <Button key={p} variant={p === pedidosPage ? 'default' : 'outline'} size="sm" onClick={() => setPedidosPage(p)}>
                                {p}
                              </Button>
                            ))}
                            {pages[pages.length - 1] < totalPages && (<><span className="px-1 text-slate-400">…</span><Button variant="outline" size="sm" onClick={() => setPedidosPage(totalPages)}>{totalPages}</Button></>)}
                            <Button variant="outline" size="sm" disabled={pedidosPage >= totalPages} onClick={() => setPedidosPage(p => Math.min(totalPages, p + 1))}>
                              {t('admin.orders.pagination.next', { defaultValue: 'Siguiente' })}
                            </Button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cajas */}
        {activeSubTab === 'cajas' && (
          <Card className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200 dark:border-slate-700">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2"><Boxes className="h-5 w-5" />{t('admin.orders.china.boxes.title')}</CardTitle>
                <div className="w-full sm:w-auto flex items-center justify-end gap-2 md:gap-3 flex-wrap">
                  <Input value={filtroCaja} onChange={e => setFiltroCaja(e.target.value)} placeholder={t('admin.orders.china.filters.searchBoxPlaceholder')} className="h-10 w-full sm:w-64 px-3" />
                  {/* Removed refresh button per request */}
                  <Button size="sm" className="h-10 bg-orange-600 hover:bg-orange-700" onClick={() => setModalCrearCaja({ open: true })}><Plus className="h-4 w-4" />{t('admin.orders.china.boxes.create')}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {boxes.length === 0 ? (<div className="py-10 text-center text-sm">{t('admin.orders.china.boxes.noneTitle')}</div>) : boxes.filter((b, idx) => { if (!filtroCaja) return true; const id = b.box_id ?? b.boxes_id ?? b.id ?? idx; return String(id).toLowerCase().includes(filtroCaja.toLowerCase()); }).length === 0 ? (<div className="py-10 text-center text-sm">{t('admin.orders.china.boxes.notFoundTitle')}</div>) : (
                <div className="space-y-3">
                  {(() => {
                    const filtered = boxes.filter((b, idx) => { if (!filtroCaja) return true; const id = b.box_id ?? b.boxes_id ?? b.id ?? idx; return String(id).toLowerCase().includes(filtroCaja.toLowerCase()); }); const total = filtered.length; const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)); const { start, end } = getPageSlice(total, boxesPage); return filtered.slice(start, end).map((box, idx) => {
                      const id = box.box_id ?? box.boxes_id ?? box.id ?? idx; const created = box.creation_date ?? box.created_at ?? ''; const stateNum = (box.state ?? 1) as number; const countKey = box.box_id ?? box.boxes_id ?? box.id ?? id; const badge = getBoxBadge(t, stateNum); return (
                        <div key={id as any} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
                          <div className="min-w-0 flex items-center gap-4">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-800/40 rounded-lg"><Boxes className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /></div>
                            <div className="space-y-1">
                              <h3 className="font-semibold text-slate-900 dark:text-white truncate">#BOX-{id}</h3>
                              {box.name && (
                                <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{String(box.name)}</p>
                              )}
                              <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{created ? new Date(created).toLocaleString('es-ES') : '—'}</span>
                                <span className="flex items-center gap-1"><List className="h-3 w-3" />Pedidos: {orderCountsByBoxMain[countKey as any] ?? 0}</span>
                              </div>
                            </div>
                          </div>
                          <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
                            <div className="flex flex-wrap gap-2 sm:gap-3 justify-start sm:justify-end">
                              <Badge className={badge.className}>{getBoxBadgeLabel(stateNum)}</Badge>
                            </div>
                            <div className="w-full sm:w-auto grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-none sm:flex">
                              {stateNum === 1 && (
                                airOnlyBoxes.has(countKey) ? (
                                  // Botón "Enviar" para cajas con solo pedidos aéreos
                                  <Button
                                    size="sm"
                                    className="w-full sm:w-auto flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={(orderCountsByBoxMain[countKey as any] ?? 0) <= 0}
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
                                  // Botón "Empaquetar" para cajas normales
                                  <Button
                                    size="sm"
                                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={(orderCountsByBoxMain[countKey as any] ?? 0) <= 0}
                                    onClick={() => {
                                      const currentBoxId = box.box_id ?? box.boxes_id ?? box.id;
                                      setModalEmpaquetarCaja({ open: true, boxId: currentBoxId });
                                      if (containers.length === 0) fetchContainers();
                                    }}
                                  >
                                    {t('admin.orders.china.boxes.pack')}
                                  </Button>
                                )
                              )}
                              {stateNum === 2 && (<Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => { const currentBoxId = box.box_id ?? box.boxes_id ?? box.id; if (currentBoxId !== undefined) handleUnpackBox(currentBoxId as any); }}>{t('admin.orders.china.boxes.unpack')}</Button>)}
                              {stateNum >= 3 && (<Button variant="outline" size="sm" className="w-full sm:w-auto" disabled>{t('admin.orders.china.boxes.unpack')}</Button>)}
                              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => { const boxId = box.box_id ?? box.boxes_id ?? box.id; setModalVerPedidosCaja({ open: true, boxId }); if (boxId !== undefined) fetchOrdersByBoxId(boxId); }}>{t('admin.orders.china.boxes.viewOrders')}</Button>
                              <Button variant="outline" size="sm" className="w-full sm:w-auto text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50" disabled={(box.state ?? 1) >= 3} onClick={() => { if ((box.state ?? 1) >= 3) { toast({ title: t('admin.orders.china.toasts.notAllowedTitle'), description: t('admin.orders.china.toasts.boxUnpackNotAllowedDesc') }); return; } setModalEliminarCaja({ open: true, box }); }}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
              {boxesLoading && <p className="text-center text-sm mt-4">{t('admin.orders.china.boxes.loading')}</p>}
              {(() => {
                const filtered = boxes.filter((b, idx) => { if (!filtroCaja) return true; const id = b.box_id ?? b.boxes_id ?? b.id ?? idx; return String(id).toLowerCase().includes(filtroCaja.toLowerCase()); }); const total = filtered.length; if (total === 0) return null; const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)); const { start, end } = getPageSlice(total, boxesPage); const pages = getVisiblePages(totalPages, boxesPage); return (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{t('admin.orders.pagination.showing', { defaultValue: 'Mostrando' })} {Math.min(total, start + 1)} {t('admin.orders.pagination.to', { defaultValue: 'a' })} {end} {t('admin.orders.pagination.of', { defaultValue: 'de' })} {total} {t('admin.orders.pagination.results', { defaultValue: 'resultados' })}</p>
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      <Button variant="outline" size="sm" disabled={boxesPage <= 1} onClick={() => setBoxesPage(p => Math.max(1, p - 1))}>{t('admin.orders.pagination.prev', { defaultValue: 'Anterior' })}</Button>
                      {pages[0] > 1 && (<><Button variant="outline" size="sm" onClick={() => setBoxesPage(1)}>1</Button><span className="px-1 text-slate-400">…</span></>)}
                      {pages.map(p => (<Button key={p} variant={p === boxesPage ? 'default' : 'outline'} size="sm" onClick={() => setBoxesPage(p)}>{p}</Button>))}
                      {pages[pages.length - 1] < totalPages && (<><span className="px-1 text-slate-400">…</span><Button variant="outline" size="sm" onClick={() => setBoxesPage(totalPages)}>{totalPages}</Button></>)}
                      <Button variant="outline" size="sm" disabled={boxesPage >= totalPages} onClick={() => setBoxesPage(p => Math.min(totalPages, p + 1))}>{t('admin.orders.pagination.next', { defaultValue: 'Siguiente' })}</Button>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Contenedores */}
        {activeSubTab === 'contenedores' && (
          <Card className="bg-white/80 dark:bg-slate-800/70 backdrop-blur-sm border-slate-200 dark:border-slate-700">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2"><Boxes className="h-5 w-5" />{t('admin.orders.china.containers.title')}</CardTitle>
                <div className="w-full sm:w-auto flex items-center justify-end gap-2 md:gap-3 flex-wrap">
                  <Input value={filtroContenedor} onChange={e => setFiltroContenedor(e.target.value)} placeholder={t('admin.orders.china.filters.searchContainerPlaceholder')} className="h-10 w-full sm:w-64 px-3" />
                  {/* Removed refresh button per request */}
                  <Button size="sm" className="h-10 bg-orange-600 hover:bg-orange-700" onClick={() => setModalCrearContenedor({ open: true })}><Plus className="h-4 w-4" />{t('admin.orders.china.containers.create')}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {containers.length === 0 ? (<div className="py-10 text-center text-sm">{t('admin.orders.china.containers.noneTitle')}</div>) : containers.filter((c, idx) => { if (!filtroContenedor) return true; const id = c.container_id ?? c.containers_id ?? c.id ?? idx; return String(id).toLowerCase().includes(filtroContenedor.toLowerCase()); }).length === 0 ? (<div className="py-10 text-center text-sm">{t('admin.orders.china.containers.notFoundTitle')}</div>) : (
                <div className="space-y-3">
                  {(() => {
                    const filtered = containers.filter((c, idx) => { if (!filtroContenedor) return true; const id = c.container_id ?? c.containers_id ?? c.id ?? idx; return String(id).toLowerCase().includes(filtroContenedor.toLowerCase()); }); const total = filtered.length; const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)); const { start, end } = getPageSlice(total, containersPage); return filtered.slice(start, end).map((container, idx) => {
                      const id = container.container_id ?? container.containers_id ?? container.id ?? idx; const created = container.creation_date ?? container.created_at ?? ''; const stateNum = (container.state ?? 1) as number; const badge = getContainerBadge(t, stateNum); return (
                        <div key={id as any} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
                          <div className="min-w-0 flex items-center gap-4">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-800/40 rounded-lg"><Boxes className="h-5 w-5 text-indigo-600 dark:text-indigo-300" /></div>
                            <div className="space-y-1">
                              <h3 className="font-semibold text-slate-900 dark:text-white truncate">#CONT-{id}</h3>
                              {container.name && (
                                <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{String(container.name)}</p>
                              )}
                              <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400"><span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{created ? new Date(created).toLocaleString('es-ES') : '—'}</span></div>
                            </div>
                          </div>
                          <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
                            <div className="flex flex-wrap gap-2 sm:gap-3 justify-start sm:justify-end">
                              <Badge className={badge.className}>{getContainerBadgeLabel(stateNum)}</Badge>
                            </div>
                            <div className="w-full sm:w-auto grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-none sm:flex">
                              <Button
                                size="sm"
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={stateNum !== 2}
                                onClick={() => {
                                  // Abrir modal de envío y precargar info si existe
                                  const id = container.container_id ?? container.containers_id ?? container.id;
                                  if (id !== undefined && (containerSendInfo as any)[id]) {
                                    const saved = (containerSendInfo as any)[id];
                                    setSendTrackingNumber(saved.trackingNumber);
                                    setSendTrackingLink(saved.trackingLink || '');
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
                                <Truck className="h-4 w-4" />{t('admin.orders.china.containers.send')}
                              </Button>
                              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => { const containerId = container.container_id ?? container.containers_id ?? container.id; setModalVerCajasCont({ open: true, containerId }); if (containerId !== undefined) fetchBoxesByContainerId(containerId); }}>{t('admin.orders.china.containers.viewBoxes')}</Button>
                              <Button variant="outline" size="sm" className="w-full sm:w-auto text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50" disabled={(container.state ?? 1) >= 3} onClick={() => { if ((container.state ?? 1) >= 3) { toast({ title: t('admin.orders.china.toasts.notAllowedTitle'), description: t('admin.orders.china.toasts.containerSendNotAllowedDesc') }); return; } setModalEliminarContenedor({ open: true, container }); }}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
              {containersLoading && <p className="text-center text-sm mt-4">{t('admin.orders.china.containers.loading')}</p>}
              {(() => {
                const filtered = containers.filter((c, idx) => { if (!filtroContenedor) return true; const id = c.container_id ?? c.containers_id ?? c.id ?? idx; return String(id).toLowerCase().includes(filtroContenedor.toLowerCase()); }); const total = filtered.length; if (total === 0) return null; const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)); const { start, end } = getPageSlice(total, containersPage); const pages = getVisiblePages(totalPages, containersPage); return (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{t('admin.orders.pagination.showing', { defaultValue: 'Mostrando' })} {Math.min(total, start + 1)} {t('admin.orders.pagination.to', { defaultValue: 'a' })} {end} {t('admin.orders.pagination.of', { defaultValue: 'de' })} {total} {t('admin.orders.pagination.results', { defaultValue: 'resultados' })}</p>
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      <Button variant="outline" size="sm" disabled={containersPage <= 1} onClick={() => setContainersPage(p => Math.max(1, p - 1))}>{t('admin.orders.pagination.prev', { defaultValue: 'Anterior' })}</Button>
                      {pages[0] > 1 && (<><Button variant="outline" size="sm" onClick={() => setContainersPage(1)}>1</Button><span className="px-1 text-slate-400">…</span></>)}
                      {pages.map(p => (<Button key={p} variant={p === containersPage ? 'default' : 'outline'} size="sm" onClick={() => setContainersPage(p)}>{p}</Button>))}
                      {pages[pages.length - 1] < totalPages && (<><span className="px-1 text-slate-400">…</span><Button variant="outline" size="sm" onClick={() => setContainersPage(totalPages)}>{totalPages}</Button></>)}
                      <Button variant="outline" size="sm" disabled={containersPage >= totalPages} onClick={() => setContainersPage(p => Math.min(totalPages, p + 1))}>{t('admin.orders.pagination.next', { defaultValue: 'Siguiente' })}</Button>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Modales - Ver pedidos de una caja */}
        {modalVerPedidosCaja.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-3xl mx-4 w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('admin.orders.china.modals.boxOrders.title', { id: String(modalVerPedidosCaja.boxId ?? '') })}</h3><Button variant="ghost" size="sm" onClick={() => setModalVerPedidosCaja({ open: false })} className="h-8 w-8 p-0">✕</Button></div>
              {ordersByBoxLoading ? <p className="text-center text-sm text-slate-500 py-6">{t('admin.orders.china.modals.boxOrders.loading')}</p> : ordersByBox.length === 0 ? (
                <div className="text-center py-12"><Package className="h-12 w-12 text-slate-400 mx-auto mb-4" /><p className="text-slate-500 dark:text-slate-400">{t('admin.orders.china.modals.boxOrders.noneTitle')}</p></div>
              ) : (
                <div className="space-y-3">
                  {ordersByBox.map(o => {
                    const badge = getOrderBadge(t, o.numericState); return (
                      <div key={o.id} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
                        <div className="space-y-1"><p className="font-semibold text-slate-900 dark:text-white">#{o.id} {o.producto}</p><p className="text-xs text-slate-500 dark:text-slate-400">{o.cliente}</p></div>
                        <Badge className={badge.className}>{getOrderBadgeLabel(o.numericState)}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modales - Ver cajas de contenedor */}
        {modalVerCajasCont.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div ref={modalVerCajasContRef} className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-3xl mx-4 w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('admin.orders.china.modals.containerBoxes.title', { id: String(modalVerCajasCont.containerId ?? '') })}</h3><Button variant="ghost" size="sm" onClick={() => setModalVerCajasCont({ open: false })} className="h-8 w-8 p-0">✕</Button></div>
              {boxesByContainerLoading ? <p className="text-center text-sm text-slate-500 py-6">{t('admin.orders.china.modals.containerBoxes.loading')}</p> : boxesByContainer.length === 0 ? (
                <div className="text-center py-12"><Boxes className="h-12 w-12 text-slate-400 mx-auto mb-4" /><p className="text-slate-500 dark:text-slate-400">{t('admin.orders.china.modals.containerBoxes.noneTitle')}</p></div>
              ) : (
                <div className="space-y-3">
                  {boxesByContainer.map((box, idx) => {
                    const id = box.box_id ?? box.boxes_id ?? box.id ?? idx; const created = box.creation_date ?? box.created_at ?? ''; const stateNum = (box.state ?? 1) as number; const badge = getBoxBadge(t, stateNum); return (
                      <div key={id as any} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
                        <div className="space-y-1"><p className="font-semibold text-slate-900 dark:text-white">#BOX-{id}</p>{box.name && (<p className="text-xs text-slate-500 dark:text-slate-400">{String(box.name)}</p>)}<p className="text-xs text-slate-500 dark:text-slate-400">{created ? new Date(created).toLocaleString('es-ES') : '—'}</p></div>
                        <div className="flex items-center gap-3">
                          <Badge className={badge.className}>{badge.label}</Badge>
                          {stateNum === 2 && (<Button variant="outline" size="sm" onClick={() => { const boxId = box.box_id ?? box.boxes_id ?? box.id; const containerId = modalVerCajasCont.containerId; handleUnpackBox(boxId as any, { containerId }); }}>{t('admin.orders.china.boxes.unpack')}</Button>)}
                          {stateNum >= 3 && (<Button variant="outline" size="sm" disabled>{t('admin.orders.china.boxes.unpack')}</Button>)}
                          <Button variant="outline" size="sm" onClick={() => { const boxId = box.box_id ?? box.boxes_id ?? box.id; setModalVerPedidosCaja({ open: true, boxId }); if (boxId !== undefined) fetchOrdersByBoxId(boxId); }}>{t('admin.orders.china.boxes.viewOrders')}</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Cotizar (portal para evitar clipping y asegurar blur pantalla completa) */}
        {mounted && modalCotizar.open && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center">
            {/* Capa de fondo (más oscura) */}
            <div className="absolute inset-0 bg-black/70 dark:bg-black/75 backdrop-blur-sm transition-opacity" onClick={closeModalCotizar} />
            {/* Contenido */}
            <div ref={modalCotizarRef} className={`relative bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg mx-4 w-full max-h-[90vh] shadow-2xl border border-slate-200 dark:border-slate-700 transition-all duration-200 ease-out ${isClosingModalCotizar ? 'scale-95 opacity-0' : enteredModalCotizar ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('admin.orders.china.modals.quote.title')}</h3>
                <Button variant="ghost" size="sm" onClick={closeModalCotizar} className="h-8 w-8 p-0">✕</Button>
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
                <form onSubmit={e => { e.preventDefault(); const precioUnitario = Number((e.target as any).precioUnitario.value); const precioEnvio = Number((e.target as any).precioEnvio.value); const altura = Number((e.target as any).altura.value); const anchura = Number((e.target as any).anchura.value); const largo = Number((e.target as any).largo.value); const peso = Number((e.target as any).peso.value); if (precioUnitario > 0 && modalCotizar.pedido) cotizarPedido(modalCotizar.pedido, precioUnitario, precioEnvio, altura, anchura, largo, peso); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="font-medium">{t('admin.orders.china.modals.quote.client')}</p><p>{modalCotizar.pedido?.cliente}</p></div>
                    <div><p className="font-medium">{t('admin.orders.china.modals.quote.product')}</p><p>{modalCotizar.pedido?.producto}</p></div>
                    <div><p className="font-medium">{t('admin.orders.china.modals.quote.quantity')}</p><p>{modalCotizar.pedido?.cantidad}</p></div>
                    <div><p className="font-medium">{t('admin.orders.table.status')}</p><p>{modalCotizar.pedido?.estado}</p></div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('admin.orders.china.modals.quote.unitPriceLabel', { defaultValue: 'Precio de producto unitario' })} <span className="text-red-500">*</span></label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 select-none">¥</span>
                      <input
                        name="precioUnitario"
                        type="number"
                        inputMode="decimal"
                        required
                        min="0"
                        step="0.01"
                        defaultValue={modalCotizar.precioUnitario}
                        onChange={e => {
                          const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                          const parts = raw.split('.');
                          let intPart = parts[0] || '';
                          const decPartFull = parts[1] || '';
                          if (intPart.length > 7) intPart = intPart.slice(0, 7);
                          const decPart = decPartFull.slice(0, 2);
                          const cleaned = decPart ? `${intPart}.${decPart}` : intPart;
                          e.target.value = cleaned;
                          setModalCotizar(prev => ({ ...prev, precioUnitario: Number(cleaned || 0) }));
                        }}
                        className={`w-full pl-7 pr-3 py-2 rounded-md bg-white dark:bg-slate-800 border focus:outline-none transition-colors ${modalCotizar.precioUnitario && modalCotizar.precioUnitario > 0 ? 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                        placeholder="0.00"
                      />
                    </div>
                    <p className={`mt-1 text-xs ${modalCotizar.precioUnitario && modalCotizar.precioUnitario > 0 ? 'text-slate-500' : 'text-red-500'}`}>
                      {modalCotizar.precioUnitario && modalCotizar.precioUnitario > 0 ? 'Máx 7 dígitos enteros' : 'Ingresa un precio mayor a 0'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Precio de envío <span className="text-red-500">*</span></label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 select-none">$</span>
                      <input
                        name="precioEnvio"
                        type="number"
                        inputMode="decimal"
                        required
                        min="0"
                        step="0.01"
                        defaultValue={modalCotizar.precioEnvio}
                        onChange={e => {
                          const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
                          const parts = raw.split('.');
                          let intPart = parts[0] || '';
                          const decPartFull = parts[1] || '';
                          if (intPart.length > 7) intPart = intPart.slice(0, 7);
                          const decPart = decPartFull.slice(0, 2);
                          const cleaned = decPart ? `${intPart}.${decPart}` : intPart;
                          e.target.value = cleaned;
                          setModalCotizar(prev => ({ ...prev, precioEnvio: Number(cleaned || 0) }));
                        }}
                        className={`w-full pl-7 pr-3 py-2 rounded-md bg-white dark:bg-slate-800 border focus:outline-none transition-colors ${modalCotizar.precioEnvio !== undefined && modalCotizar.precioEnvio >= 0 ? 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                        placeholder="0.00"
                      />
                    </div>
                    <p className={`mt-1 text-xs ${modalCotizar.precioEnvio !== undefined && modalCotizar.precioEnvio >= 0 ? 'text-slate-500' : 'text-red-500'}`}>
                      {modalCotizar.precioEnvio !== undefined && modalCotizar.precioEnvio >= 0 ? 'Máx 7 dígitos enteros' : 'Ingresa un precio válido'}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium">Altura (cm) <span className="text-red-500">*</span></label>
                      <input
                        name="altura"
                        type="number"
                        inputMode="decimal"
                        required
                        min="0"
                        step="0.1"
                        defaultValue={modalCotizar.altura}
                        onChange={e => { setModalCotizar(prev => ({ ...prev, altura: Number(e.target.value || 0) })); }}
                        className={`w-full px-3 py-2 rounded-md bg-white dark:bg-slate-800 border focus:outline-none transition-colors ${modalCotizar.altura && modalCotizar.altura > 0 ? 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                        placeholder="0.0"
                      />
                      <p className={`mt-1 text-xs ${modalCotizar.altura && modalCotizar.altura > 0 ? 'text-slate-500' : 'text-red-500'}`}>
                        {modalCotizar.altura && modalCotizar.altura > 0 ? 'Valor válido' : 'Ingresa una altura mayor a 0'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Anchura (cm) <span className="text-red-500">*</span></label>
                      <input
                        name="anchura"
                        type="number"
                        inputMode="decimal"
                        required
                        min="0"
                        step="0.1"
                        defaultValue={modalCotizar.anchura}
                        onChange={e => { setModalCotizar(prev => ({ ...prev, anchura: Number(e.target.value || 0) })); }}
                        className={`w-full px-3 py-2 rounded-md bg-white dark:bg-slate-800 border focus:outline-none transition-colors ${modalCotizar.anchura && modalCotizar.anchura > 0 ? 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                        placeholder="0.0"
                      />
                      <p className={`mt-1 text-xs ${modalCotizar.anchura && modalCotizar.anchura > 0 ? 'text-slate-500' : 'text-red-500'}`}>
                        {modalCotizar.anchura && modalCotizar.anchura > 0 ? 'Valor válido' : 'Ingresa una anchura mayor a 0'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Largo (cm) <span className="text-red-500">*</span></label>
                      <input
                        name="largo"
                        type="number"
                        inputMode="decimal"
                        required
                        min="0"
                        step="0.1"
                        defaultValue={modalCotizar.largo}
                        onChange={e => { setModalCotizar(prev => ({ ...prev, largo: Number(e.target.value || 0) })); }}
                        className={`w-full px-3 py-2 rounded-md bg-white dark:bg-slate-800 border focus:outline-none transition-colors ${modalCotizar.largo && modalCotizar.largo > 0 ? 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                        placeholder="0.0"
                      />
                      <p className={`mt-1 text-xs ${modalCotizar.largo && modalCotizar.largo > 0 ? 'text-slate-500' : 'text-red-500'}`}>
                        {modalCotizar.largo && modalCotizar.largo > 0 ? 'Valor válido' : 'Ingresa un largo mayor a 0'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Peso (kg) <span className="text-red-500">*</span></label>
                    <input
                      name="peso"
                      type="number"
                      inputMode="decimal"
                      required
                      min="0"
                      step="0.1"
                      defaultValue={modalCotizar.peso}
                      onChange={e => { setModalCotizar(prev => ({ ...prev, peso: Number(e.target.value || 0) })); }}
                      className={`w-full px-3 py-2 rounded-md bg-white dark:bg-slate-800 border focus:outline-none transition-colors ${modalCotizar.peso && modalCotizar.peso > 0 ? 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' : 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'}`}
                      placeholder="0.0"
                    />
                    <p className={`mt-1 text-xs ${modalCotizar.peso && modalCotizar.peso > 0 ? 'text-slate-500' : 'text-red-500'}`}>
                      {modalCotizar.peso && modalCotizar.peso > 0 ? 'Valor válido' : 'Ingresa un peso mayor a 0'}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">{t('admin.orders.china.modals.quote.totalToPay')}</p>
                    <p className="text-green-600 dark:text-green-400 font-semibold text-lg">${(((modalCotizar.precioUnitario || 0) * (modalCotizar.pedido?.cantidad || 0)) + (modalCotizar.precioEnvio || 0)).toLocaleString()}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={closeModalCotizar}>{t('admin.orders.china.modals.quote.cancel')}</Button>
                    <Button type="submit" disabled={!(modalCotizar.precioUnitario && modalCotizar.precioUnitario > 0 && String(Math.trunc(modalCotizar.precioUnitario)).length <= 7 && modalCotizar.precioEnvio !== undefined && modalCotizar.precioEnvio >= 0 && modalCotizar.altura && modalCotizar.altura > 0 && modalCotizar.anchura && modalCotizar.anchura > 0 && modalCotizar.largo && modalCotizar.largo > 0 && modalCotizar.peso && modalCotizar.peso > 0)} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{t('admin.orders.china.modals.quote.sendQuote')}</Button>
                  </div>
                </form>
              </div>
            </div>
          </div>, document.body
        )}

        {/* Modal seleccionar caja para pedido */}
        {/* Modal aviso: pedir poner etiqueta antes de empaquetar */}
        {modalAvisoEtiqueta.open && (
          // z-[60] para asegurar que este modal quede por encima del modal de seleccionar caja (que usa z-50)
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 w-full transition-all scale-100 opacity-100 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('admin.orders.china.modals.labelWarning.title', { defaultValue: 'Antes de empaquetar' })}</h3>
                <Button variant="ghost" size="sm" onClick={() => setModalAvisoEtiqueta({ open: false })} className="h-8 w-8 p-0">✕</Button>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{t('admin.orders.china.modals.labelWarning.description', { defaultValue: 'Asegúrate de poner la etiqueta al producto antes de empaquetar.' })}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { handleGenerateOrderLabelPdf(modalAvisoEtiqueta.pedidoId); }}>
                  <Download className="h-4 w-4 mr-1" />{t('admin.orders.china.modals.labelWarning.download')}
                </Button>
                <Button variant="outline" onClick={() => setModalAvisoEtiqueta({ open: false })}>{t('common.cancel')}</Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { if (modalAvisoEtiqueta.pedidoId && modalAvisoEtiqueta.box) { handleSelectCajaForPedido(modalAvisoEtiqueta.pedidoId, modalAvisoEtiqueta.box); setModalAvisoEtiqueta({ open: false }); } }}>{t('common.accept')}</Button>
              </div>
            </div>
          </div>
        )}
        {modalEmpaquetarPedido.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div ref={modalEmpaquetarPedidoRef} className={`bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl mx-4 w-full max-h-[85vh] overflow-y-auto transition-all ${isClosingModalEmpaquetarPedido ? 'scale-95 opacity-0' : 'scale-100 opacity-100'} duration-200`}>
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('admin.orders.china.modals.selectBoxForOrder.title', { id: String(modalEmpaquetarPedido.pedidoId ?? '') })}</h3><Button variant="ghost" size="sm" onClick={closeModalEmpaquetarPedido} className="h-8 w-8 p-0">✕</Button></div>
              {boxesLoading ? (<p className="text-center text-sm py-6">{t('admin.orders.china.modals.selectBoxForOrder.loading')}</p>) : boxes.length === 0 ? (<div className="text-center py-12"><Boxes className="h-12 w-12 text-slate-400 mx-auto mb-4" /><p className="text-sm text-slate-500">{t('admin.orders.china.modals.selectBoxForOrder.noneTitle')}</p></div>) : (
                <div className="space-y-3">{boxes.map((box, idx) => {
                  const id = box.box_id ?? box.boxes_id ?? box.id ?? idx; const created = box.creation_date ?? box.created_at ?? ''; const stateNum = (box.state ?? 1) as number; return (
                    <div key={id as any} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
                      <div className="space-y-1"><p className="font-semibold text-slate-900 dark:text-white">#BOX-{id}</p>{box.name && (<p className="text-xs text-slate-500 dark:text-slate-400">{String(box.name)}</p>)}<p className="text-xs text-slate-500 dark:text-slate-400">{created ? new Date(created).toLocaleString('es-ES') : '—'}</p></div>
                      <div className="flex items-center gap-3"><Badge className={`border ${stateNum === 1 ? 'bg-blue-100 text-blue-800 border-blue-200' : stateNum === 2 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>{getBoxBadgeLabel(stateNum)}</Badge>
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={stateNum >= 3} onClick={() => {
                            if (modalEmpaquetarPedido.pedidoId) { setModalAvisoEtiqueta({ open: true, pedidoId: modalEmpaquetarPedido.pedidoId, box }); }
                          }}>{t('admin.orders.china.modals.selectBoxForOrder.select')}</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}</div>
              )}
            </div>
          </div>
        )}

        {/* Modal crear caja */}
        {modalCrearCaja.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div ref={modalCrearCajaRef} className={`bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 w-full transition-all ${isClosingModalCrearCaja ? 'scale-95 opacity-0' : 'scale-100 opacity-100'} duration-200`}>
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{t('admin.orders.china.modals.createBox.title')}</h3><Button variant="ghost" size="sm" onClick={closeModalCrearCaja} className="h-8 w-8 p-0">✕</Button></div>
              <p className="text-sm mb-4">{t('admin.orders.china.modals.createBox.question')}</p>
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium" htmlFor="boxName">{t('admin.orders.china.modals.createBox.nameLabel', { defaultValue: 'Nombre de la caja' })}</label>
                <Input id="boxName" value={newBoxName} maxLength={50} onChange={e => setNewBoxName(e.target.value.slice(0, 50))} placeholder={t('admin.orders.china.modals.createBox.namePlaceholder', { defaultValue: 'Ej: Caja 01' })} required />
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={closeModalCrearCaja} disabled={creatingBox}>{t('admin.orders.china.modals.createBox.cancel')}</Button><Button className="bg-blue-600 hover:bg-blue-700" disabled={creatingBox || !newBoxName.trim()} onClick={handleConfirmCrearCaja}>{creatingBox ? t('admin.orders.china.modals.createBox.creating') : t('admin.orders.china.modals.createBox.accept')}</Button></div>
            </div>
          </div>
        )}

        {/* Modal eliminar caja */}
        {modalEliminarCaja.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div ref={modalEliminarCajaRef} className={`bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 w-full transition-all ${isClosingModalEliminarCaja ? 'scale-95 opacity-0' : 'scale-100 opacity-100'} duration-200`}>
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{t('admin.orders.china.modals.deleteBox.title')}</h3><Button variant="ghost" size="sm" onClick={closeModalEliminarCaja} className="h-8 w-8 p-0">✕</Button></div>
              <p className="text-sm mb-6">{t('admin.orders.china.modals.deleteBox.question', { id: String(modalEliminarCaja.box?.box_id ?? modalEliminarCaja.box?.boxes_id ?? modalEliminarCaja.box?.id ?? '') })}</p>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={closeModalEliminarCaja} disabled={deletingBox}>{t('admin.orders.china.modals.deleteBox.cancel')}</Button><Button className="bg-red-600 hover:bg-red-700" disabled={deletingBox} onClick={handleDeleteCaja}>{deletingBox ? t('admin.orders.china.modals.deleteBox.deleting') : t('admin.orders.china.modals.deleteBox.delete')}</Button></div>
            </div>
          </div>
        )}

        {/* Modal asignar contenedor a caja */}
        {modalEmpaquetarCaja.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div ref={modalEmpaquetarCajaRef} className={`bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl mx-4 w-full max-h-[85vh] overflow-y-auto transition-all ${isClosingModalEmpaquetarCaja ? 'scale-95 opacity-0' : 'scale-100 opacity-100'} duration-200`}>
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{t('admin.orders.china.modals.selectContainerForBox.title', { id: String(modalEmpaquetarCaja.boxId ?? '') })}</h3><Button variant="ghost" size="sm" onClick={closeModalEmpaquetarCaja} className="h-8 w-8 p-0">✕</Button></div>
              {containersLoading ? (<p className="text-center text-sm py-6">{t('admin.orders.china.modals.selectContainerForBox.loading')}</p>) : containers.length === 0 ? (<div className="py-12 text-center"><Boxes className="h-12 w-12 text-slate-400 mx-auto mb-4" /><p className="text-sm">{t('admin.orders.china.modals.selectContainerForBox.noneTitle')}</p></div>) : (
                <div className="space-y-3">{containers.map((container, idx) => {
                  const id = container.container_id ?? container.containers_id ?? container.id ?? idx; const created = container.creation_date ?? container.created_at ?? ''; const stateNum = (container.state ?? 1) as number; return (
                    <div key={id as any} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
                      <div className="space-y-1"><p className="font-semibold">#CONT-{id}</p>{container.name && (<p className="text-xs text-slate-500">{String(container.name)}</p>)}<p className="text-xs text-slate-500">{created ? new Date(created).toLocaleString('es-ES') : '—'}</p></div>
                      <div className="flex items-center gap-3"><Badge className={getContainerBadge(t, stateNum).className}>{getContainerBadge(t, stateNum).label}</Badge><Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={stateNum >= 3} onClick={() => modalEmpaquetarCaja.boxId && handleSelectContenedorForCaja(modalEmpaquetarCaja.boxId, container)}>{t('admin.orders.china.modals.selectContainerForBox.select')}</Button></div>
                    </div>
                  );
                })}</div>
              )}
            </div>
          </div>
        )}

        {/* Modal crear contenedor */}
        {modalCrearContenedor.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div ref={modalCrearContenedorRef} className={`bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 w-full transition-all ${isClosingModalCrearContenedor ? 'scale-95 opacity-0' : 'scale-100 opacity-100'} duration-200`}>
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{t('admin.orders.china.modals.createContainer.title')}</h3><Button variant="ghost" size="sm" onClick={closeModalCrearContenedor} className="h-8 w-8 p-0">✕</Button></div>
              <p className="text-sm mb-4">{t('admin.orders.china.modals.createContainer.question')}</p>
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium" htmlFor="containerName">{t('admin.orders.china.modals.createContainer.nameLabel', { defaultValue: 'Nombre del contenedor' })}</label>
                <Input id="containerName" value={newContainerName} maxLength={50} onChange={e => setNewContainerName(e.target.value.slice(0, 50))} placeholder={t('admin.orders.china.modals.createContainer.namePlaceholder', { defaultValue: 'Ej: Contenedor A' })} required />
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={closeModalCrearContenedor} disabled={creatingContainer}>{t('admin.orders.china.modals.createContainer.cancel')}</Button><Button className="bg-blue-600 hover:bg-blue-700" disabled={creatingContainer || !newContainerName.trim()} onClick={handleConfirmCrearContenedor}>{creatingContainer ? t('admin.orders.china.modals.createContainer.creating') : t('admin.orders.china.modals.createContainer.accept')}</Button></div>
            </div>
          </div>
        )}

        {/* Modal eliminar contenedor */}
        {modalEliminarContenedor.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div ref={modalEliminarContenedorRef} className={`bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 w-full transition-all ${isClosingModalEliminarContenedor ? 'scale-95 opacity-0' : 'scale-100 opacity-100'} duration-200`}>
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">{t('admin.orders.china.modals.deleteContainer.title')}</h3><Button variant="ghost" size="sm" onClick={closeModalEliminarContenedor} className="h-8 w-8 p-0">✕</Button></div>
              <p className="text-sm mb-6">{t('admin.orders.china.modals.deleteContainer.question', { id: String(modalEliminarContenedor.container?.container_id ?? modalEliminarContenedor.container?.containers_id ?? modalEliminarContenedor.container?.id ?? '') })}</p>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={closeModalEliminarContenedor} disabled={deletingContainer}>{t('admin.orders.china.modals.deleteContainer.cancel')}</Button><Button className="bg-red-600 hover:bg-red-700" disabled={deletingContainer} onClick={handleDeleteContenedor}>{deletingContainer ? t('admin.orders.china.modals.deleteContainer.deleting') : t('admin.orders.china.modals.deleteContainer.delete')}</Button></div>
            </div>
          </div>
        )}

        {/* Modal Enviar Contenedor - Capturar datos antes de enviar */}
        {modalEnviarContenedor.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div
              ref={modalEnviarContenedorRef}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg mx-4 w-full transition-all ${isClosingModalEnviarContenedor ? 'scale-95 opacity-0' : 'scale-100 opacity-100'} duration-200`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('admin.orders.china.modals.sendContainer.title', { defaultValue: 'Enviar contenedor' })}
                </h3>
                <Button variant="ghost" size="sm" onClick={closeModalEnviarContenedor} className="h-8 w-8 p-0">✕</Button>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                {t('admin.orders.china.modals.sendContainer.subtitle', { defaultValue: 'Agrega la información de envío. No se enviará a la base de datos todavía.' })}
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (sendingContainer) return;
                  const containerId = modalEnviarContenedor.container?.container_id ?? modalEnviarContenedor.container?.containers_id ?? modalEnviarContenedor.container?.id;
                  const urlOk = (() => { try { new URL(sendTrackingLink); return true; } catch { return false; } })();
                  if (!sendTrackingLink.trim() || !urlOk || !sendTrackingNumber.trim() || !sendCourierCompany.trim() || !sendEtaDate) {
                    try { (window as any).toast?.({ title: 'Datos incompletos', description: !urlOk ? 'El link de tracking no es válido.' : 'Completa todos los campos.' }); } catch { }
                    return;
                  }
                  if (containerId === undefined || !modalEnviarContenedor.container) {
                    closeModalEnviarContenedor();
                    return;
                  }
                  setSendingContainer(true);
                  try {
                    await handleSendContainer(modalEnviarContenedor.container, {
                      trackingLink: sendTrackingLink.trim(),
                      trackingNumber: sendTrackingNumber.trim(),
                      courierCompany: sendCourierCompany.trim(),
                      etaDate: sendEtaDate
                    });
                    setContainerSendInfo(prev => ({
                      ...prev,
                      [containerId as any]: { trackingLink: sendTrackingLink.trim(), trackingNumber: sendTrackingNumber.trim(), courierCompany: sendCourierCompany.trim(), etaDate: sendEtaDate }
                    }));
                    closeModalEnviarContenedor();
                  } finally {
                    setSendingContainer(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="trackingLink">
                    {t('admin.orders.china.modals.sendContainer.trackingLinkLabel', { defaultValue: 'Link de Tracking' })}
                  </label>
                  <Input id="trackingLink" type="url" value={sendTrackingLink} onChange={e => setSendTrackingLink(e.target.value)} placeholder={t('admin.orders.china.modals.sendContainer.trackingLinkPlaceholder', { defaultValue: 'Ej: https://courier.com/track/XYZ' })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="trackingInput">
                    {t('admin.orders.china.modals.sendContainer.trackingLabel', { defaultValue: 'Número de seguimiento' })}
                  </label>
                  <Input id="trackingInput" value={sendTrackingNumber} onChange={e => setSendTrackingNumber(e.target.value)} placeholder={t('admin.orders.china.modals.sendContainer.trackingPlaceholder', { defaultValue: 'Ej: TRK-123456' })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="courierInput">
                    {t('admin.orders.china.modals.sendContainer.courierLabel', { defaultValue: 'Empresa de encomienda' })}
                  </label>
                  <Input id="courierInput" value={sendCourierCompany} onChange={e => setSendCourierCompany(e.target.value)} placeholder={t('admin.orders.china.modals.sendContainer.courierPlaceholder', { defaultValue: 'Ej: DHL / UPS / FedEx' })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="etaInput">
                    {t('admin.orders.china.modals.sendContainer.etaLabel', { defaultValue: 'Fecha de entrega estimada' })}
                  </label>
                  <input id="etaInput" type="date" value={sendEtaDate} onChange={e => setSendEtaDate(e.target.value)} required className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white dark:bg-slate-800" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeModalEnviarContenedor}>{t('admin.orders.china.modals.sendContainer.cancel', { defaultValue: 'Cancelar' })}</Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={sendingContainer || !sendTrackingLink.trim() || (() => { try { new URL(sendTrackingLink); return false; } catch { return true; } })() || !sendTrackingNumber.trim() || !sendCourierCompany.trim() || !sendEtaDate}
                  >
                    {sendingContainer ? t('common.sending', { defaultValue: 'Enviando…' }) : t('admin.orders.china.modals.sendContainer.confirm', { defaultValue: 'Confirmar' })}
                  </Button>
                </div>
              </form>
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
        } : null}
        onSuccess={() => fetchPedidos()}
      />

      <Toaster />
    </>
  );
}
