'use client';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
// import { Player } from '@lottiefiles/react-lottie-player';
import { default as dynamicImport } from 'next/dynamic';

// Importar Player dinámicamente sin SSR
const Player = dynamicImport(
  () => import('@lottiefiles/react-lottie-player').then((mod) => mod.Player),
  { ssr: false }
);
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PriceDisplay } from '@/components/shared/PriceDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClientContext } from '@/lib/ClientContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotifications } from '@/hooks/use-notifications';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Package,
  Link,
  Upload,
  Check,
  FileText,
  Hash,
  Settings,
  Image as ImageIcon,
  Target,
  X,
  Filter,
  Download,
  QrCode,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Truck,
  MapPin,
  DollarSign,
  Search,
  Eye,
  Plus,
  Star
} from 'lucide-react';

// Rutas de animaciones Lottie (desde /public)
const airPlaneLottie = '/animations/FTQoLAnxbj.json';
const cargoShipLottie = '/animations/wired-flat-1337-cargo-ship-hover-pinch.json';
const truckLottie = '/animations/wired-flat-18-delivery-truck.json';
const cameraLottie = '/animations/wired-flat-61-camera-hover-flash.json';
const folderLottie = '/animations/wired-flat-120-folder-hover-adding-files.json';
const linkLottie = '/animations/wired-flat-11-link-unlink-hover-bounce.json';
const confettiLottie = '/animations/wired-flat-1103-confetti-hover-pinch.json';

// Tipos
interface Order {
  id: string;
  product: string;
  description: string;
  amount: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'quoted';
  progress: number;
  tracking: string;
  estimatedDelivery: string;
  createdAt: string;
  category: string;
  estimatedBudget?: number | null;
  totalQuote?: number | null;
  unitQuote?: number | null;
  shippingPrice?: number | null;
  stateNum?: number; // estado numérico 1..13 desde BD para badges detallados
  documents?: Array<{
    type: 'image' | 'link';
    url: string;
    label: string;
  }>;
  pdfRoutes?: string | null; // URL del PDF del pedido
  // Campos de tracking del contenedor relacionado (si aplica)
  tracking_number?: string | null;
  tracking_company?: string | null;
  arrive_date?: string | null;
  tracking_link?: string | null; // NUEVO: link de tracking del contenedor
}

interface NewOrderData {
  productName: string;
  description: string;
  quantity: number;
  specifications: string;
  productUrl: string;
  productImage?: File;
  deliveryType: '' | 'air' | 'maritime';
  deliveryVenezuela: string;
  estimatedBudget: string;
  client_id: string;
  client_name?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  currency: 'USD' | 'BS';
  validation: 'automatic' | 'manual';
  description: string;
  details?: {
    accountNumber?: string;
    bankName?: string;
    reference?: string;
    phoneNumber?: string;
    email?: string;
    qrCode?: string;
  };
}

// Tipos para modal de tracking (copiados del tracking)
interface TrackingOrder {
  id: string;
  product: string;
  trackingNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'in-transit' | 'delivered' | 'cancelled';
  progress: number;
  estimatedDelivery: string;
  currentLocation: string;
  lastUpdate: string;
  carrier: string;
  timeline: Array<{
    id: string;
    status: string;
    description: string;
    location: string;
    timestamp: string;
    completed: boolean;
  }>;
}

// Datos mock
const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-2024-001',
    product: 'Smartphone Samsung Galaxy S24',
    description: 'Teléfono inteligente de última generación con cámara de 200MP',
    amount: '$1,250.00',
    status: 'shipped',
    progress: 75,
    tracking: 'TRK-789456123',
    estimatedDelivery: '15 días',
    createdAt: '2024-01-15',
    category: 'Electrónicos',
    documents: [
      { type: 'image', url: '/images/products/samsung-s24.jpg', label: 'Foto del producto' },
      { type: 'link', url: 'https://tracking.example.com/TRK-789456123', label: 'Seguimiento en línea' }
    ]
  },
  {
    id: 'ORD-2024-002',
    product: 'Laptop Dell Inspiron 15',
    description: 'Computadora portátil para trabajo y gaming',
    amount: '$2,450.00',
    status: 'processing',
    progress: 45,
    tracking: 'TRK-456789321',
    estimatedDelivery: '25 días',
    createdAt: '2024-01-20',
    category: 'Computadoras',
    documents: [
      { type: 'image', url: '/images/products/dell-inspiron.jpg', label: 'Foto del producto' }
    ]
  },
  {
    id: 'ORD-2024-003',
    product: 'Auriculares Sony WH-1000XM5',
    description: 'Auriculares inalámbricos con cancelación de ruido',
    amount: '$350.00',
    status: 'delivered',
    progress: 100,
    tracking: 'TRK-123456789',
    estimatedDelivery: 'Completado',
    createdAt: '2024-01-10',
    category: 'Audio'
  },
  {
    id: 'ORD-2024-004',
    product: 'Smartwatch Apple Watch Series 9',
    description: 'Reloj inteligente con monitor cardíaco',
    amount: '$899.00',
    status: 'quoted',
    progress: 25,
    tracking: 'Cotizado',
    estimatedDelivery: '30 días',
    createdAt: '2024-01-25',
    category: 'Wearables'
  }
];

export default function MisPedidosPage() {
  const { t } = useTranslation();
  const { clientId, clientName, clientEmail, clientRole } = useClientContext();

  // Supabase client (navegador)
  const supabase = getSupabaseBrowserClient();
  const { toast } = useToast();
  // Estados básicos
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Estados de la página
  const [orders, setOrders] = useState<Order[]>([]);
  // Variables solicitadas: mapas por id de pedido -> dato de contenedor
  const [tracking_number, setTrackingNumberMap] = useState<Record<string, string | null>>({});
  const [tracking_company, setTrackingCompanyMap] = useState<Record<string, string | null>>({});
  const [arrive_date, setArriveDateMap] = useState<Record<string, string | null>>({});
  const [tracking_link, setTrackingLinkMap] = useState<Record<string, string | null>>({}); // NUEVO mapa para link de tracking
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  // Estado del modal de seguimiento
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<TrackingOrder | null>(null);
  const [isTrackingQRModalOpen, setIsTrackingQRModalOpen] = useState(false); // modal separado para QR del tracking link
  
  // Estados para reseñas
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isViewReviewModalOpen, setIsViewReviewModalOpen] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<Order | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [orderReviews, setOrderReviews] = useState<Record<string, { rating: number; reviewText: string | null; createdAt: string }>>({});
  const [loadingReviews, setLoadingReviews] = useState<Record<string, boolean>>({});

  // Estados del modal de nuevo pedido
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  // Estado inicial reutilizable para el wizard de nuevo pedido
  const INITIAL_NEW_ORDER_DATA: NewOrderData = {
    productName: '',
    description: '',
    quantity: 1,
    specifications: '',
    productUrl: '',
    productImage: undefined,
    deliveryType: '',
    deliveryVenezuela: '',
    estimatedBudget: '',
    client_id: '',
    client_name: '',
  };
  const [newOrderData, setNewOrderData] = useState<NewOrderData>(INITIAL_NEW_ORDER_DATA);
  // Marca si el usuario intentó avanzar el Paso 1 con datos inválidos
  const [attemptedStep1, setAttemptedStep1] = useState(false);
  // Estado de carga al crear pedido
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Obtener el user_id del usuario autenticado
  useEffect(() => {
    // Usar los datos globales del contexto cliente
    setNewOrderData((prev) => ({
      ...prev,
      client_id: clientId || '',
      client_name: clientName || '',
    }));
  }, [clientId, clientName]);

  // Estados para animaciones de Lottie
  const [hoveredDeliveryOption, setHoveredDeliveryOption] = useState<string | null>(null);
  const [isFolderHovered, setIsFolderHovered] = useState(false);
  const [isCameraHovered, setIsCameraHovered] = useState(false);

  // Helper para reiniciar completamente el wizard
  const resetNewOrderWizard = () => {
    setNewOrderData({ ...INITIAL_NEW_ORDER_DATA, client_id: clientId || '', client_name: clientName || '' });
    setCurrentStep(1);
    setAttemptedStep1(false);
    setStepDirection('next');
    setIsTransitioning(false);
    setShowSuccessAnimation(false);
    setCreatingOrder(false);
  };
  const [isLinkHovered, setIsLinkHovered] = useState(false);
  
  // Estados para drag and drop
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Estados para transiciones suaves
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [stepDirection, setStepDirection] = useState<'next' | 'prev'>('next');
  
  // Referencia al modal para scroll
  const modalRef = useRef<HTMLDivElement>(null);

  // Estados para el modal de pago
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState(1);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<Order | null>(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  
  // Estado para tasa de cambio
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);

  // Función para obtener tasa de cambio
  const fetchExchangeRate = useCallback(async () => {
    if (exchangeRate) return; // usar caché si existe
    
    setExchangeRateLoading(true);
    try {
      const response = await fetch('/api/exchange-rate');
      const data = await response.json();
      
      if (data.success && data.rate) {
        setExchangeRate(data.rate);
      } else {
        console.error('Error fetching exchange rate:', data.error);
        setExchangeRate(168.42); // fallback rate
      }
    } catch (error) {
      console.error('Network error fetching exchange rate:', error);
      setExchangeRate(168.42); // fallback rate
    } finally {
      setExchangeRateLoading(false);
    }
  }, [exchangeRate]);

  // Función para formatear precio con conversión a Bs
  const formatPriceWithConversion = useCallback((priceStr: string, paymentMethod: PaymentMethod | null) => {
    // Debug: ver valores que llegan
    console.log('🔍 Debug conversion:', {
      priceStr,
      paymentMethod: paymentMethod?.currency,
      exchangeRate
    });
    
    // Extraer número del string del precio manejando diferentes formatos
    // Formato 1: "$7,049.99" (formato US)
    // Formato 2: "$7.049,99" (formato EU)
    let cleanPrice = priceStr.replace(/[$\s]/g, ''); // quitar $ y espacios
    
    // Detectar formato: si tiene punto seguido de 2 dígitos al final, es formato US
    // Si tiene coma seguida de 2 dígitos al final, es formato EU
    let usdAmount;
    
    if (/\.\d{2}$/.test(cleanPrice)) {
      // Formato US: "$7,049.99" -> "7,049.99"
      cleanPrice = cleanPrice.replace(/,/g, ''); // quitar comas de miles
      usdAmount = parseFloat(cleanPrice);
    } else if (/,\d{2}$/.test(cleanPrice)) {
      // Formato EU: "$7.049,99" -> "7.049,99"
      cleanPrice = cleanPrice.replace(/\./g, ''); // quitar puntos de miles
      cleanPrice = cleanPrice.replace(',', '.'); // cambiar coma decimal por punto
      usdAmount = parseFloat(cleanPrice);
    } else {
      // Formato simple sin decimales: "$7049"
      cleanPrice = cleanPrice.replace(/[,.]/g, '');
      usdAmount = parseFloat(cleanPrice);
    }
    
    console.log('💰 Price parsing:', {
      original: priceStr,
      cleaned: cleanPrice,
      usdAmount,
      isNaN: isNaN(usdAmount)
    });
    
    if (isNaN(usdAmount)) return priceStr;
    
    // Si es método en Bs y tenemos tasa de cambio, mostrar conversión
    if (paymentMethod?.currency === 'BS' && exchangeRate) {
      const bsAmount = usdAmount * exchangeRate;
      const formattedBs = bsAmount.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      
      console.log('🔄 Conversion calculation:', {
        usdAmount,
        exchangeRate,
        bsAmount,
        formattedBs
      });
      
      return `${priceStr} [${formattedBs} Bs]`;
    }
    
    return priceStr;
  }, [exchangeRate]);

  // Inicialización
  useEffect(() => {
    setMounted(true);
    fetchExchangeRate(); // obtener tasa de cambio al cargar
  }, [fetchExchangeRate]);

  // Mapeos de estado numérico de la BD a estados de UI y progreso
  const mapStateToStatus = (state?: number | null): Order['status'] => {
    if (state === -1) return 'quoted'; // Rechazado: reutilizamos flujo de pago
    if (!state) return 'pending';
    // Coarse mapping para UI del cliente
    if (state === 3) return 'quoted';
    // Estados 7 y 8 deben ser iguales a 9 (enviado)
    if (state >= 4 && state <= 6) return 'processing';
    if (state === 7 || state === 8 || state === 9) return 'shipped';
    if (state === 10 || state === 11 || state === 12) return 'processing';
    if (state >= 13) return 'delivered';
    if (state === 2) return 'pending';
    return 'pending';
  };

  const mapStateToProgress = (state?: number | null): number => {
    switch (state) {
      case -1: return 30; // Rechazado: mismo progreso que cotizado
      case 1: return 10; // creado
      case 2: return 20; // recibido
      case 3: return 30; // cotizado
      case 4: return 60; // procesando
      case 5: return 70; // en proceso
      case 6: return 75; // en proceso
      // Estados 7 y 8 deben ser iguales a 9
      case 7: return 90; // igual que 9
      case 8: return 90; // igual que 9
      case 9: return 90; // llegando a Vzla
      case 10: return 92; // en aduana
      case 11: return 95; // recibido
      case 12: return 98; // listo para entrega
      case 13: return 100; // entregado
      default: return 0;
    }
  };

  // Cargar pedidos del cliente autenticado
  const fetchOrders = async () => {
    if (!clientId) return;
    try {
  const { data, error } = await supabase
    .from('orders')
  .select('id, productName, description, estimatedBudget, totalQuote, unitQuote, shippingPrice, state, created_at, pdfRoutes, quantity, box_id')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error cargando pedidos:', error);
        return;
      }
      // Obtener mapas de tracking desde API (service role) para evitar problemas de RLS
      let tnMap: Record<string, string | null> = {};
      let tcMap: Record<string, string | null> = {};
      let adMap: Record<string, string | null> = {};
      let tlMap: Record<string, string | null> = {}; // tracking_link
      try {
        const res = await fetch(`/cliente/mis-pedidos/api/tracking?client_id=${encodeURIComponent(clientId)}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          tnMap = json?.tnMap || {};
          tcMap = json?.tcMap || {};
          adMap = json?.adMap || {};
          tlMap = json?.tlMap || {};
        } else {
          console.warn('API tracking no OK:', res.status);
        }
      } catch (e) {
        console.warn('Fallo llamando API tracking:', e);
      }

      // Fallback: si la API no devolvió nada útil, intentar desde el cliente (puede fallar por RLS)
    const needsFallback = Object.keys(tnMap).length === 0 && Object.keys(tcMap).length === 0 && Object.keys(adMap).length === 0 && Object.keys(tlMap).length === 0;
      if (needsFallback && (data || []).length > 0) {
        try {
          const boxIds = (data || [])
            .map((row: any) => row.box_id)
            .filter((v: any) => v !== null && v !== undefined);

          let boxToContainer: Record<string | number, string | number | null> = {};
          if (boxIds.length > 0) {
            const { data: boxesRows } = await supabase
              .from('boxes')
              .select('box_id, container_id')
              .in('box_id', boxIds as any);
            (boxesRows || []).forEach((b: any) => {
              if (b?.box_id !== undefined) boxToContainer[b.box_id] = b?.container_id ?? null;
            });
          }

          const containerIds = Object.values(boxToContainer).filter((v) => v !== null && v !== undefined);
          type ContainerTrack = { tracking_number?: string | null; tracking_company?: string | null; arrive_date?: string | null; ['arrive-data']?: string | null; tracking_link?: string | null };
          const containerInfo: Record<string | number, ContainerTrack> = {};
          if (containerIds.length > 0) {
            const { data: containersRows } = await supabase
              .from('containers')
              .select('container_id, tracking_number, tracking_company, arrive_date, tracking_link')
              .in('container_id', containerIds as any);
            (containersRows || []).forEach((c: any) => {
              const aid = c?.container_id;
              if (aid !== undefined) containerInfo[aid] = c as ContainerTrack;
            });
          }

          (data || []).forEach((row: any) => {
            const containerId = row.box_id != null ? (boxToContainer[row.box_id] ?? null) : null;
            const cInfo = containerId != null ? containerInfo[containerId] : undefined;
            const arrive = cInfo?.arrive_date ?? (cInfo as any)?.['arrive-data'] ?? null;
            const oid = String(row.id);
            tnMap[oid] = cInfo?.tracking_number ?? null;
            tcMap[oid] = cInfo?.tracking_company ?? null;
            adMap[oid] = arrive;
            tlMap[oid] = cInfo?.tracking_link ?? null;
          });
        } catch (fallbackErr) {
          console.warn('Fallback tracking join falló:', fallbackErr);
        }
      }

      const mapped: Order[] = (data || []).map((row: any) => {
        const oid = String(row.id);
        const tn = tnMap[oid] ?? null;
        const tc = tcMap[oid] ?? null;
        const ad = adMap[oid] ?? null;
        const tl = tlMap[oid] ?? null;

        const unit = typeof row.unitQuote === 'number' ? row.unitQuote : (row.unitQuote ? Number(row.unitQuote) : 0);
        const ship = typeof row.shippingPrice === 'number' ? row.shippingPrice : (row.shippingPrice ? Number(row.shippingPrice) : 0);
        const calcAmount = Number(unit || 0) + Number(ship || 0);
        const status = mapStateToStatus(row.state as number | null);

        return {
          id: String(row.id),
          product: row.productName || 'Pedido',
          description: row.description || '',
          amount: `$${Number(calcAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
          status,
          progress: mapStateToProgress(row.state as number | null),
          tracking: '',
          estimatedDelivery: '',
          createdAt: row.created_at || '',
          category: '',
          estimatedBudget: typeof row.estimatedBudget === 'number' ? row.estimatedBudget : (row.estimatedBudget ? Number(row.estimatedBudget) : null),
          totalQuote: typeof row.totalQuote === 'number' ? row.totalQuote : (row.totalQuote ? Number(row.totalQuote) : null),
          unitQuote: unit,
          shippingPrice: ship,
          stateNum: typeof row.state === 'number' ? row.state : (row.state ? Number(row.state) : undefined),
          documents: row.pdfRoutes ? [{ type: 'link' as const, url: row.pdfRoutes, label: 'Resumen PDF' }] : [],
          pdfRoutes: row.pdfRoutes || null,
          tracking_number: tn,
          tracking_company: tc,
          arrive_date: ad,
          tracking_link: tl,
        };
      });
      setOrders(mapped);
      // Exponer variables solicitadas
      setTrackingNumberMap(tnMap);
      setTrackingCompanyMap(tcMap);
      setArriveDateMap(adMap);
    setTrackingLinkMap(tlMap);
    } catch (e) {
      console.error('Excepción cargando pedidos:', e);
    }
  };

  // Disparar carga cuando tengamos clientId
  useEffect(() => {
    if (clientId) fetchOrders();
  }, [clientId]);

  // Agregar realtime para pedidos del cliente
  useEffect(() => {
    if (!clientId) return;

    const ordersChannel = supabase
      .channel(`client-orders-mis-pedidos-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          console.log('Realtime: Mis pedidos changed', payload);
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [clientId, supabase]);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.tracking.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    // Total gastado: considerar pedidos en proceso/enviados/entregados y sumar unitQuote + shippingPrice (Opción A)
    totalSpent: orders
      .filter(o => o.status === 'processing' || o.status === 'shipped' || o.status === 'delivered')
      .reduce((sum, o) => sum + Number(o.unitQuote ?? 0) + Number(o.shippingPrice ?? 0), 0)
  };

  // Helpers específicos para el modal de tracking (colores simples)
  const getTrackingStatusColor = (status: string) => {
    const isDark = mounted && theme === 'dark';
    switch (status) {
      case 'pending': return isDark ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700 transition-colors hover:bg-yellow-900/50 hover:ring-1 hover:ring-yellow-500/20' : 'bg-yellow-100 text-yellow-800 border-yellow-200 transition-colors hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-200';
      case 'processing': return isDark ? 'bg-blue-900/30 text-blue-300 border-blue-700 transition-colors hover:bg-blue-900/50 hover:ring-1 hover:ring-blue-500/20' : 'bg-blue-100 text-blue-800 border-blue-200 transition-colors hover:bg-blue-50 hover:ring-1 hover:ring-blue-200';
      case 'shipped': return isDark ? 'bg-orange-900/30 text-orange-300 border-orange-700 transition-colors hover:bg-orange-900/50 hover:ring-1 hover:ring-orange-500/20' : 'bg-orange-100 text-orange-800 border-orange-200 transition-colors hover:bg-orange-50 hover:ring-1 hover:ring-orange-200';
      case 'in-transit': return isDark ? 'bg-orange-900/30 text-orange-300 border-orange-700 transition-colors hover:bg-orange-900/50 hover:ring-1 hover:ring-orange-500/20' : 'bg-orange-100 text-orange-800 border-orange-200 transition-colors hover:bg-orange-50 hover:ring-1 hover:ring-orange-200';
      case 'delivered': return isDark ? 'bg-green-900/30 text-green-300 border-green-700 transition-colors hover:bg-green-900/50 hover:ring-1 hover:ring-green-500/20' : 'bg-green-100 text-green-800 border-green-200 transition-colors hover:bg-green-50 hover:ring-1 hover:ring-green-200';
      case 'cancelled': return isDark ? 'bg-red-900/30 text-red-300 border-red-700 transition-colors hover:bg-red-900/50 hover:ring-1 hover:ring-red-500/20' : 'bg-red-100 text-red-800 border-red-200 transition-colors hover:bg-red-50 hover:ring-1 hover:ring-red-200';
      default: return isDark ? 'bg-gray-800 text-gray-300 border-gray-700 transition-colors hover:bg-gray-700 hover:ring-1 hover:ring-gray-500/20' : 'bg-gray-100 text-gray-800 border-gray-200 transition-colors hover:bg-gray-50 hover:ring-1 hover:ring-gray-200';
    }
  };

  const getTrackingStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'processing': return 'Procesando';
      case 'shipped': return 'Enviado';
      case 'in-transit': return 'En Tránsito';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return 'Desconocido';
    }
  };

  // Estado para el timeline con datos reales (CACHÉ DESACTIVADO)
  // const [timelineData, setTimelineData] = useState<{ [orderId: string]: TrackingOrder['timeline'] }>({});
  // const [timelineLoading, setTimelineLoading] = useState<{ [orderId: string]: boolean }>({});

  // Función para obtener timeline real desde la API
  const fetchOrderTimeline = async (orderId: string): Promise<TrackingOrder['timeline']> => {
    console.log('🔍 fetchOrderTimeline llamado para order:', orderId);
    
    // DESACTIVAR CACHÉ TEMPORALMENTE PARA DEBUG
    // if (timelineData[orderId]) {
    //   console.log('📱 Usando timeline desde caché para order:', orderId);
    //   return timelineData[orderId]; // usar caché si existe
    // }

    // DESACTIVAR LOADING CHECK TEMPORALMENTE
    // if (timelineLoading[orderId]) {
    //   console.log('⏳ Timeline ya está cargando para order:', orderId);
    //   return generateFallbackTimeline(); // evitar múltiples requests
    // }

    // setTimelineLoading(prev => ({ ...prev, [orderId]: true })); // CACHÉ DESACTIVADO

    try {
      console.log('🌐 Haciendo fetch a /api/orders/' + orderId + '/timeline');
      const response = await fetch(`/api/orders/${orderId}/timeline`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('📦 Respuesta del timeline API:', data);
      console.log('🎯 TIMELINE EN RESPUESTA:', data.timeline);

      if (data.success && data.timeline) {
        const timeline = data.timeline;
        console.log('✅ Timeline obtenido exitosamente:', timeline);
        // setTimelineData(prev => ({ ...prev, [orderId]: timeline })); // CACHÉ DESACTIVADO
        return timeline;
      } else {
        console.error('❌ Error fetching timeline:', data.error);
        console.log('🔄 Usando fallback timeline');
        return generateFallbackTimeline();
      }
    } catch (error) {
      console.error('🚨 Network error fetching timeline:', error);
      console.log('🔄 Usando fallback timeline por error de red');
      return generateFallbackTimeline();
    } finally {
      // setTimelineLoading(prev => ({ ...prev, [orderId]: false })); // CACHÉ DESACTIVADO
    }
  };

  // Función fallback para generar timeline básico
  const generateFallbackTimeline = (): TrackingOrder['timeline'] => {
    const steps = [
      { id: '1', key: 'created', name: 'Pedido creado' },
      { id: '2', key: 'processing', name: 'En procesamiento' },
      { id: '3', key: 'shipped', name: 'Enviado' },
      { id: '4', key: 'in-transit', name: 'En tránsito' },
      { id: '5', key: 'customs', name: 'En aduana' },
      { id: '6', key: 'delivered', name: 'Entregado' },
    ];

    return steps.map((step, index) => ({
      id: step.id,
      status: step.key,
      description: step.name,
      location: '—',
      timestamp: '—',
      completed: index === 0, // solo el primer paso marcado como completado
    }));
  };

  // Construir objeto de tracking a partir de un pedido
  const buildTrackingFromOrder = async (order: Order): Promise<TrackingOrder> => {
    console.log('🏗️ buildTrackingFromOrder llamado para order:', order);
    
    const mapStatus = (s: Order['status']): TrackingOrder['status'] => {
      if (s === 'shipped') return 'in-transit';
      if (s === 'delivered') return 'delivered';
      if (s === 'processing') return 'processing';
      if (s === 'cancelled') return 'cancelled';
      return 'pending';
    };

    const status = mapStatus(order.status);
    console.log('📊 Status mapeado:', order.status, '->', status);
    
    // Obtener timeline real desde la API
    console.log('🕐 Obteniendo timeline para order ID:', order.id);
    const timeline = await fetchOrderTimeline(order.id);
    console.log('📅 Timeline recibido:', timeline);

    const trackingOrder = {
      id: order.id,
      product: order.product,
      trackingNumber: order.tracking || 'N/A',
      status,
      progress: order.progress ?? 0,
      estimatedDelivery: order.estimatedDelivery || '—',
      currentLocation: status === 'in-transit' || status === 'delivered' ? 'En tránsito' : '—',
      lastUpdate: timeline.find(t => t.completed)?.timestamp || '—',
      carrier: '—',
      timeline,
    };
    
    console.log('🎯 TrackingOrder final construido:', trackingOrder);
    return trackingOrder;
  };

  const openTrackingModal = async (order: Order) => {
    // Mostrar modal con datos básicos primero
    const basicTrackingOrder: TrackingOrder = {
      id: order.id,
      product: order.product,
      trackingNumber: order.tracking || 'N/A',
      status: 'pending',
      progress: order.progress ?? 0,
      estimatedDelivery: order.estimatedDelivery || '—',
      currentLocation: '—',
      lastUpdate: '—',
      carrier: '—',
      timeline: generateFallbackTimeline(),
    };
    
    setSelectedTrackingOrder(basicTrackingOrder);
    setIsTrackingModalOpen(true);
    
    // Cargar datos reales en background
    try {
      const realTrackingOrder = await buildTrackingFromOrder(order);
      setSelectedTrackingOrder(realTrackingOrder);
    } catch (error) {
      console.error('Error loading real tracking data:', error);
      // Mantener datos básicos si falla la carga
    }
  };

  const closeTrackingModal = () => {
    setIsTrackingModalOpen(false);
    setTimeout(() => setSelectedTrackingOrder(null), 300);
  setIsTrackingQRModalOpen(false);
  };

  const getStatusText = (status: string) => {
    return t(`client.recentOrders.statuses.${status}`) || status;
  };

  // Funciones para manejar reseñas
  const fetchOrderReview = async (orderId: string) => {
    if (loadingReviews[orderId] || !clientId) return;
    setLoadingReviews(prev => ({ ...prev, [orderId]: true }));
    try {
      const response = await fetch(`/api/orders/${orderId}/review?userId=${encodeURIComponent(clientId)}`);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data.exists && data.review) {
            setOrderReviews(prev => ({
              ...prev,
              [orderId]: {
                rating: data.review.rating,
                reviewText: data.review.reviewText,
                createdAt: data.review.createdAt,
              },
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching review:', error);
    } finally {
      setLoadingReviews(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const openReviewModal = (order: Order) => {
    setSelectedOrderForReview(order);
    setReviewRating(0);
    setReviewText('');
    setIsReviewModalOpen(true);
  };

  const openViewReviewModal = async (order: Order) => {
    setSelectedOrderForReview(order);
    if (!orderReviews[order.id]) {
      await fetchOrderReview(order.id);
    }
    setIsViewReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedOrderForReview || reviewRating === 0) {
      toast({
        title: t('client.reviews.error.title') || 'Error',
        description: t('client.reviews.error.ratingRequired') || 'Por favor selecciona una calificación',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingReview(true);
    try {
      const response = await fetch(`/api/orders/${selectedOrderForReview.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: clientId, // Enviar userId para autenticación
          rating: reviewRating,
          reviewText: reviewText.trim() || null,
        }),
      });

      // Verificar si la respuesta es JSON antes de parsear
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Error: La API devolvió HTML en lugar de JSON:', text.substring(0, 200));
        throw new Error('Error del servidor. Por favor, intenta nuevamente.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar la reseña');
      }

      toast({
        title: t('client.reviews.success.title') || '¡Reseña enviada!',
        description: t('client.reviews.success.description') || 'Gracias por tu calificación',
      });

      // Actualizar el estado local
      setOrderReviews(prev => ({
        ...prev,
        [selectedOrderForReview.id]: {
          rating: reviewRating,
          reviewText: reviewText.trim() || null,
          createdAt: new Date().toISOString(),
        },
      }));

      setIsReviewModalOpen(false);
      setSelectedOrderForReview(null);
      setReviewRating(0);
      setReviewText('');
    } catch (error: any) {
      toast({
        title: t('client.reviews.error.title') || 'Error',
        description: error.message || t('client.reviews.error.submitFailed') || 'No se pudo enviar la reseña',
        variant: 'destructive',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Cargar reseñas para pedidos completados al 100%
  useEffect(() => {
    const completedOrders = orders.filter(o => o.stateNum === 13);
    completedOrders.forEach(order => {
      if (!orderReviews[order.id] && !loadingReviews[order.id]) {
        fetchOrderReview(order.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);


  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-gradient-to-r from-green-500 to-emerald-500';
    if (progress >= 50) return 'bg-gradient-to-r from-blue-500 to-indigo-500';
    if (progress >= 25) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
    return 'bg-gradient-to-r from-slate-400 to-slate-500';
  };

  // Color de badge basado en status (se usa en lista y modal detalles)
  const getStatusColor = (status: string) => {
    const isDark = mounted && theme === 'dark';
    switch (status) {
      case 'pending': return isDark ? 'bg-gradient-to-r from-yellow-900/30 to-yellow-800/30 text-yellow-300 border-yellow-700 shadow-sm' : 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-300 shadow-sm';
      case 'quoted': return isDark ? 'bg-gradient-to-r from-green-900/30 to-green-800/30 text-green-300 border-green-700 shadow-sm' : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-300 shadow-sm';
      case 'processing': return isDark ? 'bg-gradient-to-r from-blue-900/30 to-blue-800/30 text-blue-300 border-blue-700 shadow-sm' : 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-300 shadow-sm';
      case 'shipped': return isDark ? 'bg-gradient-to-r from-orange-900/30 to-orange-800/30 text-orange-300 border-orange-700 shadow-sm' : 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-300 shadow-sm';
      case 'delivered': return isDark ? 'bg-gradient-to-r from-emerald-900/30 to-emerald-800/30 text-emerald-300 border-emerald-700 shadow-sm' : 'bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border-emerald-300 shadow-sm';
      case 'cancelled': return isDark ? 'bg-gradient-to-r from-red-900/30 to-red-800/30 text-red-300 border-red-700 shadow-sm' : 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-red-300 shadow-sm';
      default: return isDark ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-slate-300 border-slate-600 shadow-sm' : 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 border-slate-300 shadow-sm';
    }
  };

  // Métodos de pago disponibles
  const paymentMethods: PaymentMethod[] = [
    {
      id: 'mobile',
      name: 'Pago Móvil',
      icon: '📱',
      currency: 'BS',
      validation: 'automatic',
      description: 'Pago rápido y seguro',
      details: {
        phoneNumber: '0412-123-4567',
        reference: 'PITA-001-2024'
      }
    },
    {
      id: 'transfer',
      name: 'Transferencia',
      icon: '🏦',
      currency: 'BS',
      validation: 'automatic',
      description: 'Transferencia bancaria',
      details: {
        bankName: 'Banco de Venezuela',
        accountNumber: '0102-1234-5678-9012',
        reference: 'PITA-001-2024'
      }
    },
    {
      id: 'binance',
      name: 'Binance USDT',
      icon: '₿',
      currency: 'USD',
      validation: 'manual',
      description: 'Pago con criptomonedas',
      details: {
        email: 'pita.venezuela@binance.com',
        reference: 'PITA-001-2024'
      }
    },
    {
      id: 'zelle',
      name: 'Zelle',
      icon: '💵',
      currency: 'USD',
      validation: 'manual',
      description: 'Transferencia rápida',
      details: {
        email: 'pita.venezuela@zelle.com',
        reference: 'PITA-001-2024'
      }
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: '💳',
      currency: 'USD',
      validation: 'manual',
      description: 'Pago con PayPal',
      details: {
        email: 'pita.venezuela@paypal.com',
        reference: 'PITA-001-2024'
      }
    }
  ];

  // Handlers
  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  };

  // Handlers para el modal de pago
  const handlePaymentClick = (order: Order) => {
    setSelectedOrderForPayment(order);
    setPaymentStep(1);
    setSelectedPaymentMethod(null);
    setIsPaymentModalOpen(true);
    
    // Obtener tasa de cambio actualizada cuando se abre el modal
    fetchExchangeRate();
  };

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setPaymentStep(2);
  };

  const handlePaymentBack = () => {
    if (paymentStep === 2) {
      setPaymentStep(1);
      setSelectedPaymentMethod(null);
    } else {
      setIsPaymentModalOpen(false);
      setSelectedOrderForPayment(null);
    }
  };

  const handlePaymentConfirm = async () => {
    if (!selectedOrderForPayment) return;
    if (!clientId) {
      toast({ title: 'No autenticado', description: 'Debes iniciar sesión para confirmar el pago.', variant: 'destructive', duration: 4000 });
      return;
    }
    setIsConfirmingPayment(true);
    try {
      const rawId = selectedOrderForPayment.id;
      const orderId = isNaN(Number(rawId)) ? rawId : Number(rawId);
      
      // Usar la API del servidor para que se active el trigger y se registre en el historial
      const response = await fetch(`/api/orders/${orderId}/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: 4,
          changed_by: `client:${clientId}`,
          notes: 'Pago confirmado por el cliente'
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        console.error('Error actualizando estado del pedido:', data.error);
        toast({ title: 'Error al confirmar pago', description: data.error || 'Intenta nuevamente.', variant: 'destructive', duration: 5000 });
        return;
      }
      
      // Refrescar pedidos y cerrar modal
      await fetchOrders();
      toast({ title: 'Pago confirmado', description: 'Tu pedido ha sido marcado como pagado y registrado en el historial.', duration: 4000 });
      setIsPaymentModalOpen(false);
      setSelectedOrderForPayment(null);
      setSelectedPaymentMethod(null);
      setPaymentStep(1);
    } catch (e: any) {
      console.error('Excepción confirmando pago:', e);
      toast({ title: 'Error inesperado', description: e?.message || 'Ocurrió un problema al confirmar el pago.', variant: 'destructive', duration: 5000 });
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const handleNextStep = () => {
    if (isTransitioning) return;
    // Validar manualmente Paso 1 antes de avanzar
    if (currentStep === 1) {
      const valid = canProceedToNext();
      if (!valid) {
        if (!attemptedStep1) setAttemptedStep1(true);
        // Scroll al inicio para que vea los campos marcados
        if (modalRef.current) {
          modalRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return; // no avanzar
      }
    }
    if (currentStep < 3) {
      setStepDirection('next');
      setIsTransitioning(true);
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 120);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1 && !isTransitioning) {
      setStepDirection('prev');
      setIsTransitioning(true);
      
      // Scroll suave hacia arriba del modal con delay para mejor UX
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      }, 150);
      
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handleSubmitOrder = () => {
  // ...existing code...
  console.log('handleSubmitOrder called', newOrderData);
  // Generar nombre del PDF con fecha legible dd-mm-yyyy
  const fechaObj = new Date();
  const dd = String(fechaObj.getDate()).padStart(2, '0');
  const mm = String(fechaObj.getMonth() + 1).padStart(2, '0');
  const yyyy = fechaObj.getFullYear();
  const fechaPedidoLegible = `${dd}-${mm}-${yyyy}`;
  // Generaremos el PDF usando el ID real del pedido (tras crear el pedido)
  let orderIdCreated: string | number | null = null;
  // Variable antigua nombrePDF eliminada (se generará una versión sanitizada más adelante)

    setCreatingOrder(true);
    // Flujo: 1) Crear pedido vía API para obtener su ID. 2) Generar PDF usando ese ID. 3) Subir PDF. 4) PATCH pedido con pdfRoutes.
    (async () => {
      try {
        // 1) Crear pedido con datos básicos, por ahora sin pdfRoutes
        const prePayload = {
          client_id: clientId || '',
          productName: newOrderData.productName,
          description: newOrderData.description,
          quantity: newOrderData.quantity,
          estimatedBudget: Number(newOrderData.estimatedBudget),
          deliveryType: newOrderData.deliveryVenezuela,
          shippingType: newOrderData.deliveryType,
          // imgs y links se actualizarán luego con URLs públicas
          imgs: [],
          links: [],
          pdfRoutes: null,
          state: 1,
          order_origin: 'vzla'
        };
        const createRes = await fetch('/api/admin/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prePayload)
        });
        if (!createRes.ok) {
          let errMsg = `Status ${createRes.status}`;
          try {
            const j = await createRes.json();
            if (j?.error) errMsg += ` - ${j.error}`;
            if (j?.details) errMsg += ` | ${Array.isArray(j.details) ? j.details.join(', ') : j.details}`;
          } catch {/* ignore */}
          console.error('Error creando pedido (pre-PDF) vía API:', errMsg, prePayload);
          toast({ title: 'Error creando pedido', description: errMsg, variant: 'destructive', duration: 6000 });
          alert('Error al crear el pedido antes de generar el PDF.\n' + errMsg);
          return;
        }
        const createdJson = await createRes.json().catch(() => null);
        orderIdCreated = createdJson?.data?.id ?? null;
        if (orderIdCreated === null || orderIdCreated === undefined) {
          console.error('No se obtuvo ID del pedido creado');
          toast({ title: 'Error', description: 'No se obtuvo el ID del pedido creado.', variant: 'destructive', duration: 5000 });
          return;
        }

        // 2) Generar PDF con el ID real del pedido
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF();

        // Helper para sanitizar valores usados en el nombre del archivo / carpeta
        const sanitizeForFile = (val: string | undefined | null) => {
          return (val || 'x')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // eliminar acentos
            .replace(/[^a-zA-Z0-9-_]+/g, '-') // caracteres no permitidos -> '-'
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase()
            .slice(0, 60);
        };

        // Layout y colores
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        const colors = {
          primary: [22, 120, 187] as [number, number, number],
          secondary: [44, 62, 80] as [number, number, number],
          light: [245, 248, 255] as [number, number, number],
          border: [180, 200, 220] as [number, number, number],
          text: [33, 37, 41] as [number, number, number]
        };

        // Helper: load an SVG and rasterize to PNG data URL for jsPDF
        const loadSvgAsPngDataUrl = async (url: string, sizePx: number = 300): Promise<string> => {
          const res = await fetch(url);
          const svgText = await res.text();
          const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
          const blobUrl = URL.createObjectURL(svgBlob);
          try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
              const i = new Image();
              i.onload = () => resolve(i);
              i.onerror = () => reject(new Error('Failed to load SVG image.'));
              i.src = blobUrl;
            });
            const canvas = document.createElement('canvas');
            canvas.width = sizePx;
            canvas.height = sizePx;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas 2D context not available');
            ctx.clearRect(0, 0, sizePx, sizePx);
            ctx.drawImage(img, 0, 0, sizePx, sizePx);
            return canvas.toDataURL('image/png');
          } finally {
            URL.revokeObjectURL(blobUrl);
          }
        };

        // Datos para la tabla
        const pedidoTable = [
          ['Order ID', `${orderIdCreated}`],
          ['Client ID', `${newOrderData.client_id}`],
          ['Username', `${newOrderData.client_name || '-'}`],
          ['Date', `${fechaPedidoLegible}`],
          ['Shipping Type', `${newOrderData.deliveryType}`],
          ['Delivery in Venezuela', `${newOrderData.deliveryVenezuela}`],
          ['Product', `${newOrderData.productName}`],
          ['Quantity', `${newOrderData.quantity}`],
          ['Description', newOrderData.description || '-'],
          ['Specifications', newOrderData.specifications || '-'],
          ['URL', newOrderData.productUrl || '-'],
        ];

        // === ENCABEZADO PROFESIONAL ===
        doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.rect(0, 0, pageWidth, 35, 'F');
        doc.setFontSize(12);
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.setFont('helvetica', 'bold');
        // Place platform logo at the same coordinates (previously inside a 20x20 box), without background
        try {
          const logoDataUrl = await loadSvgAsPngDataUrl('/pita_icon.svg', 320);
          const boxSize = 20; // mm
          const logoW = 14;   // mm
          const logoH = 14;   // mm
          const logoX = margin + (boxSize - logoW) / 2; // center inside 20x20 box
          const logoY = 8 + (boxSize - logoH) / 2;
          doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH, undefined, 'FAST');
        } catch {
          // Fallback to text if the image fails to load
          doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          doc.text('PITA', margin + 10, 20, { align: 'center' });
        }
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text('ORDER SUMMARY', pageWidth / 2, 22, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
  doc.text(`Order: #${orderIdCreated}`, pageWidth - margin, 15, { align: 'right' });
        doc.text(`Date: ${fechaPedidoLegible}`, pageWidth - margin, 21, { align: 'right' });

        let currentY = 50;

        // Siempre mostrar imagen y tabla lado a lado si hay imagen, si no solo tabla
        if (newOrderData.productImage) {
          // Imagen y tabla lado a lado
          const imgWidth = 80;
          const imgHeight = 80;
          const imgX = margin;
          doc.setFillColor(240, 240, 240);
          doc.roundedRect(imgX - 2, currentY - 2, imgWidth + 4, imgHeight + 4, 3, 3, 'F');
          doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
            doc.setLineWidth(1);
            doc.roundedRect(imgX, currentY, imgWidth, imgHeight, 2, 2, 'D');
          const imgData = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(newOrderData.productImage as Blob);
          });
          doc.addImage(imgData, 'JPEG', imgX, currentY, imgWidth, imgHeight);
          const tableStartX = imgX + imgWidth + 15;
          const tableWidth = pageWidth - tableStartX - margin;
          autoTable(doc, {
            head: [['Campo', 'Valor']],
            body: pedidoTable,
            startY: currentY,
            margin: { left: tableStartX, right: margin },
            tableWidth: tableWidth,
            theme: 'grid',
            headStyles: {
              fillColor: colors.primary,
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 12,
              halign: 'center',
              cellPadding: 3
            },
            bodyStyles: {
              fontSize: 10,
              cellPadding: 3,
              textColor: colors.text
            },
            alternateRowStyles: {
              fillColor: colors.light
            },
            columnStyles: {
              0: { cellWidth: 50, fontStyle: 'bold', textColor: colors.secondary },
              1: { cellWidth: tableWidth - 50 }
            }
          });
        } else {
          // Tabla ocupando todo el ancho
          doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
          doc.rect(margin, currentY, pageWidth - (margin * 2), 12, 'F');
          doc.setFontSize(14);
          doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          doc.text('ORDER DETAILS', margin + 5, currentY + 8);
          currentY += 20;
          autoTable(doc, {
            head: [['Field', 'Information']],
            body: pedidoTable,
            startY: currentY,
            margin: { left: margin, right: margin },
            theme: 'striped',
            headStyles: {
              fillColor: colors.primary,
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 12,
              halign: 'center',
              cellPadding: 4
            },
            bodyStyles: {
              fontSize: 11,
              cellPadding: 4,
              textColor: colors.text
            },
            alternateRowStyles: {
              fillColor: colors.light
            },
            columnStyles: {
              0: { cellWidth: 60, fontStyle: 'bold', textColor: colors.secondary },
              1: { cellWidth: pageWidth - (margin * 2) - 60 }
            }
          });
          // La URL ya está incluida como fila en la tabla ('URL'), se evita duplicarla como sección aparte.
        }

        // === FOOTER PROFESIONAL ===
        const footerY = pageHeight - 25;
        doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
        doc.setFontSize(9);
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.text('PITA | Logistics and Ordering system', pageWidth / 2, footerY, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.text('info@pita.com   |   +58 424-1234567', pageWidth / 2, footerY + 7, { align: 'center' });
        doc.setFontSize(7);
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.text(`Generated: ${new Date().toLocaleString('es-ES')}`, margin, footerY + 13);

        // Subir PDF a Supabase Storage con nombre sanitizado
        const pdfBlob = doc.output('blob');
        if (!(pdfBlob instanceof Blob) || pdfBlob.size === 0) {
          console.error('PDF Blob inválido o vacío:', pdfBlob);
          toast({ title: 'Error generando PDF', description: 'No se pudo generar el archivo PDF.', variant: 'destructive', duration: 6000 });
          return;
        }
        const safeProduct = sanitizeForFile(newOrderData.productName);
        const safeClient = sanitizeForFile(clientId || newOrderData.client_id);
        const safeDeliveryVzla = sanitizeForFile(newOrderData.deliveryVenezuela);
        const safeDeliveryType = sanitizeForFile(newOrderData.deliveryType);
  const nombrePDFCorr = `${safeProduct}_${fechaPedidoLegible}_${orderIdCreated}_${safeClient}_${safeDeliveryVzla}.pdf`;
        const folder = safeDeliveryType || 'otros';
        const uploadKey = `${folder}/${nombrePDFCorr}`;

        const doUpload = async (key: string) => {
          return await supabase.storage
            .from('orders')
            .upload(key, pdfBlob, {
              cacheControl: '3600',
              upsert: true,
              contentType: 'application/pdf'
            });
        };

        let uploadResult = await doUpload(uploadKey);
        if (uploadResult.error && /Invalid key/i.test(uploadResult.error.message || '')) {
          console.warn('Upload falló por Invalid key, aplicando sanitización extra y reintentando.');
          const ultraKey = uploadKey
            .replace(/[^a-zA-Z0-9/_\-.]/g, '')
            .replace(/--+/g, '-');
          uploadResult = await doUpload(ultraKey);
          if (!uploadResult.error) {
            console.log('Upload exitoso tras retry con key:', ultraKey);
          }
        }

        if (uploadResult.error) {
          console.error('Supabase Storage upload error:', uploadResult.error);
          toast({ title: 'Error subiendo PDF', description: uploadResult.error.message || 'No se pudo subir el archivo.', variant: 'destructive', duration: 5000 });
          alert(`Error al subir el PDF al bucket: ${uploadResult.error.message}`);
          return;
        }

  const finalKey = uploadResult.data?.path || uploadKey;
  // Obtener URL pública a través del API de Supabase (más robusto que concatenar)
  const pdfPublic = supabase.storage.from('orders').getPublicUrl(finalKey);
  const pdfUrl = pdfPublic?.data?.publicUrl || `https://bgzsodcydkjqehjafbkv.supabase.co/storage/v1/object/public/orders/${finalKey}`;
        console.log('pdfUrl:', pdfUrl);

        // Subir imagen del producto (si existe) al bucket y obtener URL pública
        const imageUrls: string[] = [];
        if (newOrderData.productImage) {
          try {
            const imgFile = newOrderData.productImage as File;
            const ext = (() => {
              const type = (imgFile.type || '').toLowerCase();
              if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
              if (type.includes('png')) return 'png';
              if (type.includes('webp')) return 'webp';
              // fallback intenta extraer de nombre
              const name = imgFile.name || '';
              const dot = name.lastIndexOf('.');
              return dot !== -1 ? name.substring(dot + 1).toLowerCase() : 'jpg';
            })();
            const imgSafeProduct = sanitizeForFile(newOrderData.productName);
            const imgSafeClient = sanitizeForFile(clientId || newOrderData.client_id);
            const timestamp = Date.now();
            const imgFolder = (safeDeliveryType || 'otros') + '/imgs';
            const imageKey = `${imgFolder}/${orderIdCreated}_${timestamp}_${imgSafeClient}_${imgSafeProduct}.${ext}`;

            const doUploadImg = async (key: string) => {
              return await supabase.storage
                .from('orders')
                .upload(key, imgFile, {
                  cacheControl: '3600',
                  upsert: true,
                  contentType: imgFile.type || 'image/jpeg'
                });
            };

            let imgUpload = await doUploadImg(imageKey);
            if (imgUpload.error && /Invalid key/i.test(imgUpload.error.message || '')) {
              const ultraImgKey = imageKey
                .replace(/[^a-zA-Z0-9/_\-.]/g, '')
                .replace(/--+/g, '-');
              imgUpload = await doUploadImg(ultraImgKey);
              if (!imgUpload.error) {
                console.log('Upload imagen exitoso tras retry con key:', ultraImgKey);
              }
            }

            if (imgUpload.error) {
              console.warn('No se pudo subir la imagen del producto:', imgUpload.error);
              toast({ title: 'Advertencia', description: 'Pedido creado pero no se pudo subir la imagen del producto.', duration: 5000 });
            } else {
              const imgFinalKey = imgUpload.data?.path || imageKey;
              const imgPublic = supabase.storage.from('orders').getPublicUrl(imgFinalKey);
              const imageUrl = imgPublic?.data?.publicUrl || `https://bgzsodcydkjqehjafbkv.supabase.co/storage/v1/object/public/orders/${imgFinalKey}`;
              imageUrls.push(imageUrl);
            }
          } catch (e) {
            console.warn('Excepción subiendo imagen del producto:', e);
          }
        }

        // 4) Actualizar el pedido con la URL del PDF y opcionalmente imgs/links
        const patchRes = await fetch(`/api/admin/orders/${orderIdCreated}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfRoutes: pdfUrl,
            imgs: imageUrls,
            links: newOrderData.productUrl ? [newOrderData.productUrl] : []
          })
        });
        if (!patchRes.ok) {
          let errMsg = `Status ${patchRes.status}`;
          try {
            const j = await patchRes.json();
            if (j?.error) errMsg += ` - ${j.error}`;
            if (j?.details) errMsg += ` | ${Array.isArray(j.details) ? j.details.join(', ') : j.details}`;
          } catch {/* ignore */}
          console.error('Error asociando PDF/recursos a la orden en la BD:', errMsg, { orderIdCreated, pdfUrl, imgs: imageUrls, links: newOrderData.productUrl });
          toast({ title: 'Advertencia', description: 'Pedido creado y PDF subido, pero no se pudo asociar en la base de datos. Intenta nuevamente.', duration: 6000 });
        }
        setShowSuccessAnimation(true);
        setTimeout(() => {
          setIsNewOrderModalOpen(false);
          resetNewOrderWizard();
        }, 1500);
        fetchOrders();
      } catch (err: any) {
        console.error('Error general generando / subiendo PDF o creando pedido:', err);
        toast({ title: 'Error generando pedido', description: err?.message || 'Fallo inesperado al generar PDF.', variant: 'destructive', duration: 6000 });
        alert('No se pudo generar o subir el PDF. Intenta nuevamente.');
      } finally {
        setCreatingOrder(false);
      }
    })();
  };

  // Validación de imagen
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert(t('admin.orders.alerts.onlyImages'));
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        alert(t('admin.orders.alerts.imageTooLarge', { maxMB: 50 }));
        return;
      }
      setNewOrderData({ ...newOrderData, productImage: file });
    }
  };

  // Funciones para drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      
      if (!validTypes.includes(file.type)) {
        alert(t('admin.orders.alerts.onlyImages'));
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        alert(t('admin.orders.alerts.imageTooLarge', { maxMB: 50 }));
        return;
      }
      
      setNewOrderData({ ...newOrderData, productImage: file });
    }
  };

  // Límites y rangos de validación (paridad con Admin)
  const NAME_MAX = 50;
  const DESCRIPTION_MAX = 200;
  const QTY_MIN = 1;
  const QTY_MAX = 9999;
  const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50 MB
  const BUDGET_MAX = 9_999_999;

  // Validaciones de campos
  const isValidQuantity = (value: any) => {
    return /^[0-9]+$/.test(String(value)) && Number(value) >= QTY_MIN && Number(value) <= QTY_MAX;
  };
  const isValidBudget = (value: any) => {
    const str = String(value);
    if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(str)) return false;
    const [intPart] = str.split('.');
    if (intPart.length > 7) return false;
    const num = Number(str);
    return num > 0 && num <= BUDGET_MAX;
  };
  const isValidUrl = (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };
  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        if (!newOrderData.productName || !newOrderData.description) return false;
        if (newOrderData.productName.length > NAME_MAX) return false;
        if (newOrderData.description.length > DESCRIPTION_MAX) return false;
        if (!isValidQuantity(newOrderData.quantity)) return false;
        if (!newOrderData.productUrl || !isValidUrl(newOrderData.productUrl)) return false;
        if (!newOrderData.productImage) return false;
        return true;
      case 2:
        // Ahora sólo requerimos tipo de envío y modalidad/pickup (deliveryVenezuela). El presupuesto estimado es opcional.
  if (!newOrderData.deliveryType || !newOrderData.deliveryVenezuela) return false;
  return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return t('client.recentOrders.newOrder.stepTitles.productInfo');
      case 2: return t('client.recentOrders.newOrder.stepTitles.shippingDetails');
      case 3: return t('client.recentOrders.newOrder.stepTitles.summaryConfirmation');
      default: return '';
    }
  };

  const getStepDescription = (step: number) => {
    switch (step) {
      case 1: return t('client.recentOrders.newOrder.stepDescriptions.productInfo');
      case 2: return t('client.recentOrders.newOrder.stepDescriptions.shippingDetails');
      case 3: return t('client.recentOrders.newOrder.stepDescriptions.summaryConfirmation');
      default: return '';
    }
  };

  // Notificaciones del cliente (DB-backed)
  const { uiItems: notificationsList, unreadCount, markAllAsRead, markOneAsRead } = useNotifications({ role: 'client', userId: clientId, limit: 10, enabled: !!clientId });

  if (!mounted) return null;

  return (
    <div className={`min-h-screen flex overflow-x-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
      <Sidebar 
        isExpanded={sidebarExpanded} 
        setIsExpanded={setSidebarExpanded}
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
        userRole="client"
      />
      
      <main className={`flex-1 transition-all duration-300 ${
        sidebarExpanded ? 'lg:ml-72 lg:w-[calc(100%-18rem)]' : 'lg:ml-24 lg:w-[calc(100%-6rem)]'
      }`}>
        <Header 
          notifications={unreadCount || 0} 
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          title={t('client.recentOrders.title')}
          subtitle={t('client.recentOrders.subtitle')}
          notificationsItems={notificationsList}
          onMarkAllAsRead={async () => { await markAllAsRead(); }}
          onItemClick={async (id) => { await markOneAsRead(id); }}
          onOpenNotifications={() => { /* ya estamos en mis-pedidos */ }}
        />
        
        <div className="p-4 md:p-5 lg:p-6 space-y-6 md:space-y-6 lg:space-y-8">
          {/* Header de la página */}
          <div className={`rounded-xl p-4 md:p-6 lg:p-8 text-white relative overflow-hidden ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-blue-900 via-blue-800 to-orange-900' : 'bg-gradient-to-r from-blue-500 via-blue-600 to-orange-500'}`}>
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
                <div>
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2">{t('client.recentOrders.title')}</h1>
                  <p className={`text-sm md:text-base lg:text-lg ${mounted && theme === 'dark' ? 'text-green-200' : 'text-green-100'}`}>{t('client.dashboard.panel')}</p>
                  <p className={`mt-2 text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-green-300' : 'text-green-200'}`}>{t('client.recentOrders.subtitle')}</p>
                </div>
                
                <div className="grid grid-cols-2 md:flex md:items-center md:space-x-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl lg:text-4xl font-bold">{stats.total}</div>
                    <p className={`text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-green-200' : 'text-green-100'}`}>{t('client.dashboard.totalOrders')}</p>
                  </div>
                  <div className="hidden md:block w-px h-12 md:h-16 bg-white/20"></div>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl lg:text-4xl font-bold">${stats.totalSpent.toLocaleString()}</div>
                    <p className={`text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-green-200' : 'text-green-100'}`}>{t('client.dashboard.totalSpent')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botón Nuevo Pedido */}
          <div className="flex justify-end">
            <Dialog open={isNewOrderModalOpen} onOpenChange={(open) => { setIsNewOrderModalOpen(open); if (open) resetNewOrderWizard(); }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('client.quickActions.newOrder')}
                </Button>
              </DialogTrigger>
              <DialogContent ref={modalRef} className={`max-w-4xl max-h-[90vh] overflow-y-auto ${mounted && theme === 'dark' ? 'bg-slate-800' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50'}`}>
                <DialogHeader className="text-center pb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-orange-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                    <DialogTitle className="relative text-3xl font-bold bg-gradient-to-r from-blue-500 to-orange-500 bg-clip-text text-transparent animate-fade-in-up">
                      ✨ {t('client.quickActions.newOrder')}
                    </DialogTitle>
                  </div>
                  <DialogDescription className={`text-lg mt-2 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {t('client.recentOrders.newOrder.dialogDescription')}
                  </DialogDescription>
                </DialogHeader>

                {/* Enhanced Progress Bar */}
                <div className={`space-y-4 mb-8 transition-all duration-300 ${
                  isTransitioning ? 'opacity-75' : 'opacity-100'
                }`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('client.recentOrders.newOrder.step', { current: currentStep, total: 3 })}</span>
                    <span className={`font-bold ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('client.recentOrders.newOrder.percentComplete', { percent: Math.round((currentStep / 3) * 100) })}</span>
                  </div>
                  <div className="relative">
                    <div className={`w-full rounded-full h-3 overflow-hidden ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-orange-500 rounded-full transition-all duration-500 ease-out relative"
                        style={{ width: `${(currentStep / 3) * 100}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                      </div>
                    </div>
                    {/* Step Indicators */}
                    <div className="flex justify-between mt-2">
                      {[1, 2, 3].map((step) => (
                        <div key={step} className="flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                            step <= currentStep 
                              ? 'bg-gradient-to-r from-blue-500 to-orange-500 text-white shadow-lg scale-110' 
                              : (mounted && theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-300 text-slate-600')
                          }`}>
                            {step < currentStep ? '✓' : step}
                          </div>
                          <span className={`text-xs mt-1 transition-colors duration-300 ${
                            step <= currentStep ? (mounted && theme === 'dark' ? 'text-blue-400 font-medium' : 'text-blue-600 font-medium') : (mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500')
                          }`}>
                            {step === 1 ? t('client.recentOrders.newOrder.productTab') : step === 2 ? t('client.recentOrders.newOrder.shippingTab') : t('client.recentOrders.newOrder.summaryTab')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                                  {/* Step Content with Smooth Transitions */}
                  <div className={`space-y-6 transition-all duration-300 ${
                    isTransitioning 
                      ? stepDirection === 'next' 
                        ? 'opacity-0 transform translate-x-4' 
                        : 'opacity-0 transform -translate-x-4'
                      : 'opacity-100 transform translate-x-0'
                  }`}>
                  {/* Enhanced Success Animation */}
                  {showSuccessAnimation && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
                      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-12 text-center space-y-6 shadow-2xl border border-slate-200/50 max-w-md mx-4 transform animate-fade-in-up">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="bg-green-500 rounded-full w-20 h-20 flex items-center justify-center shadow-lg">
                            <Check className="w-12 h-12 text-white" />
                          </div>
                          <h3 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            {t('client.recentOrders.newOrder.success.title')}
                          </h3>
                          <p className="text-slate-600 text-lg">{t('client.recentOrders.newOrder.success.message')}</p>
                          <Button
                            onClick={() => setShowSuccessAnimation(false)}
                            className="bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600 text-white transition-all duration-300 transform hover:scale-105 shadow-lg mt-4"
                          >
                            {t('client.recentOrders.newOrder.success.button')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Step Header */}
                  <div className={`text-center space-y-4 mb-8 transition-all duration-300 ${
                    isTransitioning ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
                  }`}>
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-orange-500 rounded-lg blur-lg opacity-10 animate-pulse"></div>
                      <div className={`relative backdrop-blur-sm rounded-lg p-6 border ${mounted && theme === 'dark' ? 'bg-slate-700/80 border-slate-600' : 'bg-white/80 border-slate-200/50'}`}>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-orange-500 bg-clip-text text-transparent mb-2">
                          {getStepTitle(currentStep)}
                        </h3>
                        <p className={mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>{getStepDescription(currentStep)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Step 1: Información del Producto */}
                  {currentStep === 1 && (
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <Label htmlFor="productName" className={`text-sm font-semibold flex items-center ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          <Package className={`w-4 h-4 mr-2 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                          {t('client.recentOrders.newOrder.productName')}<span className="text-red-500 ml-1">*</span>
                        </Label>
                        <div className="relative group">
                          <Input
                            id="productName"
                            value={newOrderData.productName}
                            onChange={(e) => setNewOrderData({ ...newOrderData, productName: e.target.value.slice(0, NAME_MAX) })}
                            placeholder={t('client.recentOrders.newOrder.productNamePlaceholder')}
                            maxLength={NAME_MAX}
                            className={`transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm group-hover:border-blue-300 ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white/80 border-slate-200'} ${attemptedStep1 && !newOrderData.productName.trim() ? 'border-red-500 ring-1 ring-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                          />
                          <p className={`text-xs mt-1 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{newOrderData.productName.length}/{NAME_MAX}</p>
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-orange-500/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="description" className={`text-sm font-semibold flex items-center ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          <FileText className={`w-4 h-4 mr-2 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                          {t('client.recentOrders.newOrder.productDescription')}<span className="text-red-500 ml-1">*</span>
                        </Label>
                        <div className="relative group">
                          <Textarea
                            id="description"
                            value={newOrderData.description}
                            onChange={(e) => setNewOrderData({ ...newOrderData, description: e.target.value.slice(0, DESCRIPTION_MAX) })}
                            placeholder={t('client.recentOrders.newOrder.productDescriptionPlaceholder')}
                            rows={4}
                            maxLength={DESCRIPTION_MAX}
                            className={`transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm group-hover:border-blue-300 ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white/80 border-slate-200'} ${attemptedStep1 && !newOrderData.description.trim() ? 'border-red-500 ring-1 ring-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                          />
                          <p className={`text-xs mt-1 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{newOrderData.description.length}/{DESCRIPTION_MAX}</p>
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-orange-500/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="quantity" className={`text-sm font-semibold flex items-center ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          <Hash className={`w-4 h-4 mr-2 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                          {t('client.recentOrders.newOrder.quantity')}<span className="text-red-500 ml-1">*</span>
                        </Label>
                        <div className="relative group">
                          <Input
                            id="quantity"
                            type="number"
                            min={QTY_MIN}
                            max={QTY_MAX}
                            value={newOrderData.quantity === 0 ? '' : newOrderData.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setNewOrderData({ ...newOrderData, quantity: 0 });
                              } else if (/^[0-9]+$/.test(val)) {
                                const next = Math.min(QTY_MAX, Math.max(QTY_MIN, parseInt(val)));
                                setNewOrderData({ ...newOrderData, quantity: next });
                              }
                            }}
                            className={`transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm group-hover:border-blue-300 ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white/80 border-slate-200'} ${attemptedStep1 && (!isValidQuantity(newOrderData.quantity) || newOrderData.quantity <= 0) ? 'border-red-500 ring-1 ring-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                          />
                          {(!isValidQuantity(newOrderData.quantity) || newOrderData.quantity <= 0) && (
                            <p className="text-xs text-red-500 mt-1">{t('client.recentOrders.newOrder.invalidQuantity')} ({QTY_MIN}–{QTY_MAX})</p>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-orange-500/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="specifications" className={`text-sm font-semibold flex items-center ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          <Settings className={`w-4 h-4 mr-2 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                          {t('client.recentOrders.newOrder.specifications')}
                        </Label>
                        <div className="relative group">
                          <Textarea
                            id="specifications"
                            value={newOrderData.specifications}
                            onChange={(e) => setNewOrderData({ ...newOrderData, specifications: e.target.value })}
                            placeholder={t('client.recentOrders.newOrder.specificationsPlaceholder')}
                            rows={3}
                            className={`transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm group-hover:border-blue-300 ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white/80 border-slate-200'}`}
                          />
                          {/* Validación eliminada porque ya no hay tipo de solicitud */}
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-orange-500/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </div>
                      </div>

                      {/* URL del producto (siempre visible) */}
                      <div className="space-y-2">
                        <Label htmlFor="productUrl" className="flex items-center gap-1">{t('client.recentOrders.newOrder.productUrl')}<span className="text-red-500">*</span></Label>
                        <Input
                          id="productUrl"
                          type="url"
                          value={newOrderData.productUrl || ''}
                          onChange={(e) => setNewOrderData({ ...newOrderData, productUrl: e.target.value })}
                          placeholder={t('client.recentOrders.newOrder.productUrlPlaceholder')}
                          className={`transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white/80 border-slate-200'} ${attemptedStep1 && (!newOrderData.productUrl || !isValidUrl(newOrderData.productUrl)) ? 'border-red-500 ring-1 ring-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {newOrderData.productUrl && !isValidUrl(newOrderData.productUrl) && (
                          <p className="text-xs text-red-500 mt-1">{t('client.recentOrders.newOrder.invalidUrl')}</p>
                        )}
                        {attemptedStep1 && !newOrderData.productUrl && (
                          <p className="text-xs text-red-500 mt-1">{t('client.recentOrders.newOrder.requiredField') || 'Campo requerido'}</p>
                        )}
                      </div>

                      {/* Foto del producto (siempre visible) */}
                      <div className="space-y-3">
                        <Label className={`text-sm font-semibold flex items-center ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          <ImageIcon className={`w-4 h-4 mr-2 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                          {t('client.recentOrders.newOrder.productImage')}<span className="text-red-500 ml-1">*</span>
                        </Label>
                        {newOrderData.productImage ? (
                          <div className="relative">
                            <div className={`border-2 rounded-xl overflow-hidden ${mounted && theme === 'dark' ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-white'}`}>
                              <img
                                src={URL.createObjectURL(newOrderData.productImage)}
                                alt={t('client.recentOrders.newOrder.productImage')}
                                className="w-full h-48 object-cover"
                              />
                              <div className="p-3 flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => document.getElementById('imageUpload')?.click()} className={mounted && theme === 'dark' ? 'dark:border-slate-600 dark:hover:bg-slate-700' : ''}>
                                  <Upload className="w-4 h-4 mr-1" />{t('client.recentOrders.newOrder.change')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setNewOrderData({ ...newOrderData, productImage: undefined })}
                                  className={`text-red-600 ${mounted && theme === 'dark' ? 'dark:border-slate-600 dark:hover:bg-slate-700' : ''}`}
                                >
                                  <X className="w-4 h-4 mr-1" />{t('client.recentOrders.newOrder.delete')}
                                </Button>
                              </div>
                            </div>
                            <input id="imageUpload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                          </div>
                        ) : (
                          <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center ${mounted && theme === 'dark' ? (isDragOver ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 bg-slate-700') : (isDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white')}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                          >
                            <p className={`text-sm mb-4 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{t('client.recentOrders.newOrder.dragDrop')}</p>
                            <Button variant="outline" onClick={() => document.getElementById('imageUpload')?.click()} className={mounted && theme === 'dark' ? 'dark:border-slate-600 dark:hover:bg-slate-700' : ''}>
                              <Upload className="w-4 h-4 mr-2" />{t('client.recentOrders.newOrder.selectImage')}
                            </Button>
                            <input id="imageUpload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Detalles del Envío */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className={mounted && theme === 'dark' ? 'text-slate-300' : ''}>{t('client.recentOrders.newOrder.deliveryType')}</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                              mounted && theme === 'dark' ? (
                                newOrderData.deliveryType === 'air'
                                  ? 'border-blue-500 bg-blue-900/20'
                                  : 'border-slate-600 hover:border-slate-500 bg-slate-700'
                              ) : (
                                newOrderData.deliveryType === 'air'
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              )
                            }`}
                            onClick={() => setNewOrderData({ ...newOrderData, deliveryType: 'air' })}
                            onMouseEnter={() => setHoveredDeliveryOption('air')}
                            onMouseLeave={() => setHoveredDeliveryOption(null)}
                          >
                            <div className="text-center space-y-2">
                              <div className="w-8 h-8 mx-auto">
                                <Player
                                  key={hoveredDeliveryOption === 'air' ? 'airplane-active' : 'airplane-inactive'}
                                  src={airPlaneLottie}
                                  className="w-full h-full"
                                  loop={false}
                                  autoplay={hoveredDeliveryOption === 'air'}
                                />
                              </div>
                              <p className={`font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('client.recentOrders.newOrder.air')}</p>
                              <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{t('client.recentOrders.newOrder.airDesc')}</p>
                            </div>
                          </div>
                          <div
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                              mounted && theme === 'dark' ? (
                                newOrderData.deliveryType === 'maritime'
                                  ? 'border-blue-500 bg-blue-900/20'
                                  : 'border-slate-600 hover:border-slate-500 bg-slate-700'
                              ) : (
                                newOrderData.deliveryType === 'maritime'
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              )
                            }`}
                            onClick={() => setNewOrderData({ ...newOrderData, deliveryType: 'maritime' })}
                            onMouseEnter={() => setHoveredDeliveryOption('maritime')}
                            onMouseLeave={() => setHoveredDeliveryOption(null)}
                          >
                            <div className="text-center space-y-2">
                              <div className="w-8 h-8 mx-auto">
                                <Player
                                  key={hoveredDeliveryOption === 'maritime' ? 'ship-active' : 'ship-inactive'}
                                  src={cargoShipLottie}
                                  className="w-full h-full"
                                  loop={false}
                                  autoplay={hoveredDeliveryOption === 'maritime'}
                                />
                              </div>
                              <p className={`font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('client.recentOrders.newOrder.maritime')}</p>
                              <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{t('client.recentOrders.newOrder.maritimeDesc')}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="deliveryVenezuela" className={mounted && theme === 'dark' ? 'text-slate-300' : ''}>{t('client.recentOrders.newOrder.deliveryVenezuela')}</Label>
                        <Select value={newOrderData.deliveryVenezuela} onValueChange={(value) => setNewOrderData({ ...newOrderData, deliveryVenezuela: value })}>
                          <SelectTrigger className={mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : ''}>
                            <SelectValue placeholder={t('client.recentOrders.newOrder.deliveryVenezuelaPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pickup">{t('client.recentOrders.newOrder.pickup')}</SelectItem>
                            <SelectItem value="delivery">{t('client.recentOrders.newOrder.delivery')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Resumen y Confirmación */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div className={`rounded-lg p-6 space-y-4 ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50'}`}>
                        <h4 className={`font-semibold text-lg ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('client.recentOrders.newOrder.summaryTitle')}</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.newOrder.productName')}</p>
                            <p className={`font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{newOrderData.productName}</p>
                          </div>
                          <div className="space-y-2">
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.newOrder.quantity')}</p>
                            <p className={`font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{newOrderData.quantity}</p>
                          </div>
                          <div className="space-y-2">
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.newOrder.deliveryType')}</p>
                            <p className={`font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>
                              {/* doorToDoor deprecated: removed */}
                              {newOrderData.deliveryType === 'air' && t('client.recentOrders.newOrder.air')}
                              {newOrderData.deliveryType === 'maritime' && t('client.recentOrders.newOrder.maritime')}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.newOrder.productDescription')}</p>
                          <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : ''}`}>{newOrderData.description}</p>
                        </div>

                        {newOrderData.specifications && (
                          <div className="space-y-2">
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.newOrder.specifications')}</p>
                            <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : ''}`}>{newOrderData.specifications}</p>
                          </div>
                        )}
                      </div>

                      <div className={`border rounded-lg p-4 ${mounted && theme === 'dark' ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-start space-x-3">
                          <CheckCircle className={`w-5 h-5 mt-0.5 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                          <div>
                            <p className={`font-medium ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>{t('client.recentOrders.newOrder.almostReady')}</p>
                            <p className={`text-sm ${mounted && theme === 'dark' ? 'text-blue-200' : 'text-blue-700'}`}>
                              {t('client.recentOrders.newOrder.reviewMessage')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced Navigation Buttons */}
                <div className={`flex justify-between pt-8 border-t ${mounted && theme === 'dark' ? 'border-slate-700' : 'border-slate-200/50'}`}>
                  <Button
                    variant="outline"
                    onClick={handlePrevStep}
                    disabled={currentStep === 1 || isTransitioning}
                    className={`transition-all duration-300 hover:shadow-md transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${mounted && theme === 'dark' ? 'hover:bg-slate-700 border-slate-600' : 'hover:bg-slate-50'}`}
                  >
                    {isTransitioning ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                        {t('client.recentOrders.newOrder.transitioning')}
                      </div>
                    ) : (
                      <>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t('client.recentOrders.newOrder.previous')}
                      </>
                    )}
                  </Button>
                  
                  <div className="flex justify-center">
                    {currentStep < 3 ? (
                      <Button
                        onClick={handleNextStep}
                        disabled={!canProceedToNext() || isTransitioning}
                        className="bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTransitioning ? (
                          <div className="flex items-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            {t('client.recentOrders.newOrder.transitioning')}
                          </div>
                        ) : (
                          <>
                            {t('client.recentOrders.newOrder.next')}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmitOrder}
                        disabled={creatingOrder}
                        className="bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {creatingOrder ? (
                          <div className="flex items-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            {t('client.recentOrders.newOrder.creatingOrder')}
                          </div>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            {t('client.recentOrders.newOrder.createOrder')}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-blue-800'}`}>{t('client.dashboard.totalOrders')}</CardTitle>
                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'}`}>
                  <Package className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>{stats.total}</div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-blue-700'}`}>{t('client.recentOrders.table.id')}</p>
                <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-200'}`}>
                  <div className={`h-2 rounded-full ${mounted && theme === 'dark' ? 'bg-blue-500' : 'bg-blue-500'}`} style={{width: '100%'}}></div>
                </div>
              </CardContent>
            </Card>
            
            <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-orange-50 border-orange-200'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-orange-800'}`}>{t('client.recentOrders.statuses.pending')}</CardTitle>
                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-orange-600' : 'bg-orange-500'}`}>
                  <Clock className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-orange-300' : 'text-orange-900'}`}>{stats.pending}</div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-orange-700'}`}>{t('client.recentOrders.statuses.pending')}</p>
                <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-200'}`}>
                  <div className={`h-2 rounded-full ${mounted && theme === 'dark' ? 'bg-orange-500' : 'bg-orange-500'}`} style={{width: `${(stats.pending / stats.total) * 100}%`}}></div>
                </div>
              </CardContent>
            </Card>
            
            <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-blue-800'}`}>{t('client.recentOrders.statuses.processing')}</CardTitle>
                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'}`}>
                  <Truck className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>{stats.processing}</div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-blue-700'}`}>{t('client.recentOrders.statuses.processing')}</p>
                <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-200'}`}>
                  <div className={`h-2 rounded-full ${mounted && theme === 'dark' ? 'bg-blue-500' : 'bg-blue-500'}`} style={{width: `${(stats.processing / stats.total) * 100}%`}}></div>
                </div>
              </CardContent>
            </Card>
            
            <Card className={`hover:shadow-lg transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-orange-50 border-orange-200'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-orange-800'}`}>{t('client.recentOrders.statuses.shipped')}</CardTitle>
                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${mounted && theme === 'dark' ? 'bg-orange-600' : 'bg-orange-500'}`}>
                  <MapPin className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-orange-300' : 'text-orange-900'}`}>{stats.shipped}</div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-orange-700'}`}>{t('client.recentOrders.statuses.shipped')}</p>
                <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-200'}`}>
                  <div className={`h-2 rounded-full ${mounted && theme === 'dark' ? 'bg-orange-500' : 'bg-orange-500'}`} style={{width: `${(stats.shipped / stats.total) * 100}%`}}></div>
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
                <div className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>${stats.totalSpent.toLocaleString()}</div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-blue-700'}`}>{t('client.dashboard.totalInvestment')}</p>
                <div className={`mt-2 w-full rounded-full h-2 ${mounted && theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-200'}`}>
                  <div className={`h-2 rounded-full ${mounted && theme === 'dark' ? 'bg-blue-500' : 'bg-blue-500'}`} style={{width: '100%'}}></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros y búsqueda - barra compacta y alineada a la derecha */}
          <Card className={`backdrop-blur-sm hover:shadow-lg transition-shadow ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className={`text-base md:text-lg font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('client.recentOrders.filter')}</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <Input
                      placeholder={t('client.recentOrders.search')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`h-10 pl-8 w-56 md:w-64 transition-colors ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : ''}`}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className={`h-10 w-40 md:w-48 ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : ''}`}>
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder={t('client.recentOrders.filter')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('client.recentOrders.filter')}</SelectItem>
                      <SelectItem value="pending">{t('client.recentOrders.statuses.pending')}</SelectItem>
                      <SelectItem value="quoted">{t('client.recentOrders.statuses.quoted')}</SelectItem>
                      <SelectItem value="processing">{t('client.recentOrders.statuses.processing')}</SelectItem>
                      <SelectItem value="shipped">{t('client.recentOrders.statuses.shipped')}</SelectItem>
                      <SelectItem value="delivered">{t('client.recentOrders.statuses.delivered')}</SelectItem>
                      <SelectItem value="cancelled">{t('client.recentOrders.statuses.cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Lista de pedidos */}
          <Card className={`backdrop-blur-sm hover:shadow-lg transition-shadow ${mounted && theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
            <CardHeader>
              <CardTitle className={`text-xl font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('client.recentOrders.title')}</CardTitle>
              <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.subtitle')}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div key={order.id} className={`p-4 md:p-6 rounded-xl border hover:shadow-md transition-all duration-300 group ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-slate-700 to-slate-600 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'}`}>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6 mb-4">
                      <div className="flex items-center gap-4 md:gap-6">
                        <div className="flex flex-col">
                          <p className={`font-bold text-sm md:text-base ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{order.id}</p>
                          <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{order.product}</p>
                        </div>
                        {/* Un solo badge basado en stateNum; fallback al badge de status si no hay stateNum */}
                        {typeof order.stateNum === 'number' ? (
                          <Badge className={`text-xs md:text-sm font-semibold px-3 py-1 transition-colors hover:brightness-110 hover:ring-1 ${
                            mounted && theme === 'dark' ? (
                              order.stateNum === -1 ? 'bg-red-900/30 text-red-300 border-red-700 hover:bg-red-900/50 hover:ring-red-500/20' :
                              order.stateNum === 13 ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700 hover:bg-emerald-900/50 hover:ring-emerald-500/20' :
                              order.stateNum === 12 ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:ring-gray-500/20' :
                              order.stateNum === 11 ? 'bg-green-900/30 text-green-300 border-green-700 hover:bg-green-900/50 hover:ring-green-500/20' :
                              order.stateNum === 10 ? 'bg-orange-900/30 text-orange-300 border-orange-700 hover:bg-orange-900/50 hover:ring-orange-500/20' :
                              (order.stateNum === 7 || order.stateNum === 8 || order.stateNum === 9) ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700 hover:bg-cyan-900/50 hover:ring-cyan-500/20' :
                              order.stateNum === 6 ? 'bg-blue-900/30 text-blue-300 border-blue-700 hover:bg-blue-900/50 hover:ring-blue-500/20' :
                              order.stateNum === 5 ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700 hover:bg-yellow-900/50 hover:ring-yellow-500/20' :
                              order.stateNum === 4 ? 'bg-blue-900/30 text-blue-300 border-blue-700 hover:bg-blue-900/50 hover:ring-blue-500/20' :
                              order.stateNum === 3 ? 'bg-green-900/30 text-green-300 border-green-700 hover:bg-green-900/50 hover:ring-green-500/20' :
                              order.stateNum === 2 ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700 hover:bg-yellow-900/50 hover:ring-yellow-500/20' :
                              'bg-yellow-900/30 text-yellow-300 border-yellow-700 hover:bg-yellow-900/50 hover:ring-yellow-500/20'
                            ) : (
                              order.stateNum === -1 ? 'bg-red-100 text-red-800 border-red-200 hover:bg-red-50 hover:ring-red-200' :
                              order.stateNum === 13 ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:ring-emerald-200' :
                              order.stateNum === 12 ? 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-50 hover:ring-gray-200' :
                              order.stateNum === 11 ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-50 hover:ring-green-200' :
                              order.stateNum === 10 ? 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-50 hover:ring-orange-200' :
                              (order.stateNum === 7 || order.stateNum === 8 || order.stateNum === 9) ? 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-50 hover:ring-cyan-200' :
                              order.stateNum === 6 ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:ring-blue-200' :
                              order.stateNum === 5 ? 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:ring-yellow-200' :
                              order.stateNum === 4 ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:ring-blue-200' :
                              order.stateNum === 3 ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-50 hover:ring-green-200' :
                              order.stateNum === 2 ? 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:ring-yellow-200' :
                              'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:ring-yellow-200'
                            )
                          }`}>
                            {order.stateNum === -1 ? t('client.recentOrders.statuses.paymentRejected') :
                             order.stateNum === 5 ? t('client.recentOrders.statuses.paymentValidated') :
                             order.stateNum === 6 ? t('client.recentOrders.statuses.packagingBox') :
                             // 7 y 8 etiquetados como 9
                             (order.stateNum === 7 || order.stateNum === 8 || order.stateNum === 9) ? t('client.recentOrders.statuses.sentFromChina') :
                             order.stateNum === 10 ? t('client.recentOrders.statuses.inCustoms') :
                             order.stateNum === 11 ? t('client.recentOrders.statuses.arriving') :
                             order.stateNum === 12 ? t('client.recentOrders.statuses.inStore') :
                             order.stateNum === 13 ? t('client.recentOrders.statuses.delivered') :
                             order.stateNum === 4 ? t('client.recentOrders.statuses.processing') :
                             order.stateNum === 3 ? t('client.recentOrders.statuses.quoted') :
                             order.stateNum === 2 ? t('client.recentOrders.statuses.pending') :
                             t('client.recentOrders.statuses.pending')}
                          </Badge>
                        ) : (
                          <Badge className={`${getStatusColor(order.status)} text-xs md:text-sm font-semibold px-3 py-1`}>
                            {getStatusText(order.status)}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-[10px] md:text-[11px] uppercase tracking-wide font-medium ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {order.status === 'pending' && t('client.recentOrders.budget')}
                          {order.status === 'quoted' && t('client.recentOrders.statuses.quoted')}
                          {order.status !== 'pending' && order.status !== 'quoted' && t('client.recentOrders.table.amount')}
                        </p>
                        <div className="font-bold text-lg md:text-xl">
                          {order.status === 'pending' && typeof order.estimatedBudget !== 'undefined' && order.estimatedBudget !== null ? (
                            <PriceDisplay 
                              amount={Number(order.estimatedBudget)} 
                              currency="USD"
                              variant="inline"
                              size="lg"
                              emphasizeBolivars={true}
                              className={mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}
                            />
                          ) : order.status === 'quoted' ? (
                            <PriceDisplay 
                              amount={Number((order.unitQuote ?? 0) + (order.shippingPrice ?? 0))} 
                              currency="USD"
                              variant="inline"
                              size="lg"
                              emphasizeBolivars={true}
                              className={mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}
                            />
                          ) : (
                            <span className={mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}>{order.amount}</span>
                          )}
                        </div>
                        <p className={`text-xs font-medium ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Tracking: {order.tracking || '-'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-medium">
                        <span className={mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{t('client.recentOrders.progress')}</span>
                        <span className={mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}>{order.progress}%</span>
                      </div>
                      <div className={`w-full rounded-full h-2 md:h-3 overflow-hidden ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <div 
                          className={`h-2 md:h-3 rounded-full transition-all duration-500 ${getProgressColor(order.progress)}`} 
                          style={{ width: `${order.progress}%` }}
                        ></div>
                      </div>
                      <div className="flex flex-col md:flex-row md:justify-between gap-3 md:gap-0 text-sm">
                        <div className="flex flex-col gap-2">
                          <span className={`font-medium ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{t('client.recentOrders.estimatedDelivery')}: {order.estimatedDelivery}</span>
                          {/* Botón de calificar solo para pedidos completados al 100% */}
                          {order.stateNum === 13 && (
                            orderReviews[order.id] ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 w-fit ${mounted && theme === 'dark' ? 'border-yellow-600 text-yellow-300 hover:bg-yellow-900/30 hover:border-yellow-500' : 'border-yellow-200 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-300'}`}
                                onClick={() => openViewReviewModal(order)}
                              >
                                <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                                Ya calificado
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 w-fit ${mounted && theme === 'dark' ? 'border-purple-600 text-purple-300 hover:bg-purple-900/30 hover:border-purple-500' : 'border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300'}`}
                                onClick={() => openReviewModal(order)}
                              >
                                <Star className="h-3 w-3 mr-1" />
                                Calificar
                              </Button>
                            )
                          )}
                        </div>
                        <div className="flex gap-2 md:gap-3">
                          {(order.status === 'quoted' || order.stateNum === -1) && (
                            <Button 
                              size="sm" 
                              className="h-7 md:h-8 px-3 md:px-4 bg-gradient-to-r from-blue-500 to-orange-500 hover:from-blue-600 hover:to-orange-600 text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                              onClick={() => handlePaymentClick(order)}
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              {order.stateNum === -1 ? t('client.recentOrders.actions.payAgain') : t('client.recentOrders.actions.pay')}
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 ${mounted && theme === 'dark' ? 'border-slate-600 text-blue-300 hover:bg-slate-700 hover:border-slate-500' : 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300'}`}
                            onClick={() => handleViewDetails(order)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {t('client.recentOrders.actions.view')}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={`h-7 md:h-8 px-3 md:px-4 text-xs font-semibold transition-all duration-300 ${mounted && theme === 'dark' ? 'border-slate-600 text-orange-300 hover:bg-slate-700 hover:border-slate-500' : 'border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300'}`}
                            onClick={() => openTrackingModal(order)}
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            {t('client.recentOrders.actions.track')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredOrders.length === 0 && (
                  <div className="text-center py-12 md:py-16">
                    <div className={`w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${mounted && theme === 'dark' ? 'bg-gradient-to-br from-slate-700 to-slate-600' : 'bg-gradient-to-br from-slate-100 to-slate-200'}`}>
                      <Package className={`h-8 w-8 md:h-10 md:w-10 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    </div>
                    <p className={`text-base md:text-lg font-medium ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('client.recentOrders.noOrders')}</p>
                    <p className={`text-sm mt-2 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Intenta ajustar los filtros de búsqueda</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal de detalles del pedido */}
        <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
          {selectedOrder && (
            <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('client.recentOrders.modal.detailsTitle')}: {selectedOrder.id}</DialogTitle>
                <DialogDescription>
                  {t('client.recentOrders.modal.detailsSubtitle')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {/* Información básica */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.modal.product')}</p>
                    <p className={`text-lg ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{selectedOrder.product}</p>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      {selectedOrder.status === 'pending' && t('client.recentOrders.budget')}
                      {selectedOrder.status === 'quoted' && t('client.recentOrders.statuses.quoted')}
                      {selectedOrder.status !== 'pending' && selectedOrder.status !== 'quoted' && t('client.recentOrders.modal.amount')}
                    </p>
                    <div className="text-lg font-bold">
                      {selectedOrder.status === 'pending' && typeof selectedOrder.estimatedBudget !== 'undefined' && selectedOrder.estimatedBudget !== null ? (
                        <PriceDisplay 
                          amount={Number(selectedOrder.estimatedBudget)} 
                          currency="USD"
                          variant="card"
                          size="lg"
                          emphasizeBolivars={true}
                          showRefresh={true}
                          className={mounted && theme === 'dark' ? 'border-green-700' : 'border-green-200'}
                        />
                      ) : selectedOrder.status === 'quoted' ? (
                        <PriceDisplay 
                          amount={Number((selectedOrder.unitQuote ?? 0) + (selectedOrder.shippingPrice ?? 0))} 
                          currency="USD"
                          variant="card"
                          size="lg"
                          emphasizeBolivars={true}
                          showRefresh={true}
                          className={mounted && theme === 'dark' ? 'border-green-700' : 'border-green-200'}
                        />
                      ) : (
                        <span className={mounted && theme === 'dark' ? 'text-green-400' : 'text-green-600'}>{selectedOrder.amount}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.modal.status')}</p>
                    {typeof selectedOrder.stateNum === 'number' ? (
                      <Badge className={`text-xs font-semibold px-3 py-1 transition-colors hover:brightness-110 hover:ring-1 ${
                        mounted && theme === 'dark' ? (
                          selectedOrder.stateNum === 13 ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700 hover:bg-emerald-900/50 hover:ring-emerald-500/20' :
                          selectedOrder.stateNum === 12 ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:ring-gray-500/20' :
                          selectedOrder.stateNum === 11 ? 'bg-green-900/30 text-green-300 border-green-700 hover:bg-green-900/50 hover:ring-green-500/20' :
                          selectedOrder.stateNum === 10 ? 'bg-orange-900/30 text-orange-300 border-orange-700 hover:bg-orange-900/50 hover:ring-orange-500/20' :
                          (selectedOrder.stateNum === 7 || selectedOrder.stateNum === 8 || selectedOrder.stateNum === 9) ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700 hover:bg-cyan-900/50 hover:ring-cyan-500/20' :
                          selectedOrder.stateNum === 6 ? 'bg-blue-900/30 text-blue-300 border-blue-700 hover:bg-blue-900/50 hover:ring-blue-500/20' :
                          selectedOrder.stateNum === 5 ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700 hover:bg-yellow-900/50 hover:ring-yellow-500/20' :
                          selectedOrder.stateNum === 4 ? 'bg-blue-900/30 text-blue-300 border-blue-700 hover:bg-blue-900/50 hover:ring-blue-500/20' :
                          selectedOrder.stateNum === 3 ? 'bg-green-900/30 text-green-300 border-green-700 hover:bg-green-900/50 hover:ring-green-500/20' :
                          selectedOrder.stateNum === 2 ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700 hover:bg-yellow-900/50 hover:ring-yellow-500/20' :
                          'bg-yellow-900/30 text-yellow-300 border-yellow-700 hover:bg-yellow-900/50 hover:ring-yellow-500/20'
                        ) : (
                          selectedOrder.stateNum === 13 ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:ring-emerald-200' :
                          selectedOrder.stateNum === 12 ? 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-50 hover:ring-gray-200' :
                          selectedOrder.stateNum === 11 ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-50 hover:ring-green-200' :
                          selectedOrder.stateNum === 10 ? 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-50 hover:ring-orange-200' :
                          (selectedOrder.stateNum === 7 || selectedOrder.stateNum === 8 || selectedOrder.stateNum === 9) ? 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-50 hover:ring-cyan-200' :
                          selectedOrder.stateNum === 6 ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:ring-blue-200' :
                          selectedOrder.stateNum === 5 ? 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:ring-yellow-200' :
                          selectedOrder.stateNum === 4 ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:ring-blue-200' :
                          selectedOrder.stateNum === 3 ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-50 hover:ring-green-200' :
                          selectedOrder.stateNum === 2 ? 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:ring-yellow-200' :
                          'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:ring-yellow-200'
                        )
                      }`}>
                        {selectedOrder.stateNum === 13 ? t('client.recentOrders.statuses.delivered') :
                         selectedOrder.stateNum === 5 ? t('client.recentOrders.statuses.paymentValidated') :
                         selectedOrder.stateNum === 6 ? t('client.recentOrders.statuses.packagingBox') :
                         // 7 y 8 etiquetados como 9
                         (selectedOrder.stateNum === 7 || selectedOrder.stateNum === 8 || selectedOrder.stateNum === 9) ? t('client.recentOrders.statuses.sentFromChina') :
                         selectedOrder.stateNum === 10 ? t('client.recentOrders.statuses.inCustoms') :
                         selectedOrder.stateNum === 11 ? t('client.recentOrders.statuses.arriving') :
                         selectedOrder.stateNum === 12 ? t('client.recentOrders.statuses.inStore') :
                         selectedOrder.stateNum === 4 ? t('client.recentOrders.statuses.processing') :
                         selectedOrder.stateNum === 3 ? t('client.recentOrders.statuses.quoted') :
                         selectedOrder.stateNum === 2 ? t('client.recentOrders.statuses.pending') :
                         t('client.recentOrders.statuses.pending')}
                      </Badge>
                    ) : (
                      <Badge className={getStatusColor(selectedOrder.status)}>
                        {getStatusText(selectedOrder.status)}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.modal.tracking')}</p>
                    <p className={`text-sm font-mono ${mounted && theme === 'dark' ? 'text-slate-400' : ''}`}>{selectedOrder.tracking}</p>
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <p className={`text-sm font-medium mb-2 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.modal.description')}</p>
                  <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{selectedOrder.description}</p>
                </div>

                {/* Progreso */}
                <div>
                  <p className={`text-sm font-medium mb-2 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.progress')}</p>
                  <div className="space-y-2">
                    <div className={`flex justify-between text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : ''}`}>
                      <span>{t('client.recentOrders.modal.currentProgress')}</span>
                      <span>{selectedOrder.progress}%</span>
                    </div>
                    <div className={`w-full rounded-full h-3 ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      <div 
                        className={`h-3 rounded-full ${getProgressColor(selectedOrder.progress)}`} 
                        style={{ width: `${selectedOrder.progress}%` }}
                      ></div>
                    </div>
                    <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t('client.recentOrders.estimatedDelivery')}: {selectedOrder.estimatedDelivery}
                    </p>
                  </div>
                </div>

                {/* Documentos */}
                {selectedOrder.documents && selectedOrder.documents.length > 0 && (
                  <div>
                    <p className={`text-sm font-medium mb-2 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.modal.detailsSubtitle')}</p>
                    <div className="space-y-2">
                      {selectedOrder.documents.map((doc, index) => (
                        <div key={index} className={`flex items-center gap-2 p-2 rounded ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50'}`}>
                          <div className={`w-4 h-4 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                            {doc.type === 'image' ? '📷' : '🔗'}
                          </div>
                          <span className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : ''}`}>{doc.label}</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 ml-auto"
                            onClick={() => {
                              if (selectedOrder.pdfRoutes) {
                                try {
                                  const url = selectedOrder.pdfRoutes;
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                } catch (e) {
                                  console.error('No se pudo abrir el PDF:', e);
                              }
                      }
                    }}>
                              
                            {t('client.recentOrders.actions.view')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    {selectedOrder.pdfRoutes ? t('client.recentOrders.modal.downloadInvoice') : t('client.recentOrders.modal.downloadInvoice')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* Modal de Seguimiento (copiado del tracking) */}
        {selectedTrackingOrder && (
          <div 
            className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ease-out ${
              isTrackingModalOpen 
                ? 'bg-black/50 backdrop-blur-sm opacity-100' 
                : 'bg-black/0 backdrop-blur-none opacity-0'
            }`}
            onClick={closeTrackingModal}
          >
            <div 
              className={`rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-all duration-300 ease-out transform ${mounted && theme === 'dark' ? 'bg-slate-800' : 'bg-white'} ${
                isTrackingModalOpen 
                  ? 'scale-100 opacity-100 translate-y-0' 
                  : 'scale-95 opacity-0 translate-y-8'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{selectedTrackingOrder.product}</h2>
                    <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{selectedTrackingOrder.id}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={closeTrackingModal}
                    className={mounted && theme === 'dark' ? 'border-slate-600 hover:bg-slate-700' : ''}
                  >
                    ✕
                  </Button>
                </div>

                {/* Información del tracking del contenedor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2">
                    <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.trackingModal.trackingNumber')}</p>
                    <p className={`font-mono font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{tracking_number[String(selectedTrackingOrder.id)] || '—'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.trackingModal.carrier')}</p>
                    <p className={`font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{tracking_company[String(selectedTrackingOrder.id)] || '—'
}</p>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.trackingModal.estimatedDelivery')}</p>
                    <p className={`font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{arrive_date[String(selectedTrackingOrder.id)] || '—'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('client.recentOrders.trackingModal.currentStatus')}</p>
                    <Badge className={getTrackingStatusColor(selectedTrackingOrder.status)}>
                      {t(`client.recentOrders.trackingModal.states.${selectedTrackingOrder.status}`)}
                    </Badge>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-4">
                  <h3 className={`text-lg font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t('client.recentOrders.trackingModal.historyTitle')}</h3>
                  <div className="space-y-4">
                    {selectedTrackingOrder.timeline.map((step, index) => (
                      <div key={step.id} className="flex items-start space-x-4">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          step.completed 
                            ? 'bg-green-500 text-white' 
                            : (mounted && theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600')
                        }`}>
                          {step.completed ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-bold">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{t(`client.recentOrders.trackingModal.states.${step.status}`)}</p>
                          <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{t(`client.recentOrders.trackingModal.states.${step.status}`)}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <MapPin className={`w-3 h-3 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                            <span className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{step.location}</span>
                            <span className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>•</span>
                            <span className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{step.timestamp}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tracking Link (al final del modal) */}
                {(() => {
                  const link = tracking_link[String(selectedTrackingOrder.id)];
                  if (!link) return null;
                  let valid = true;
                  try { new URL(link); } catch { valid = false; }
                  return (
                    <div className={`mt-8 pt-4 ${mounted && theme === 'dark' ? 'border-t border-slate-700' : 'border-t'}`}>
                      <div className="flex items-start gap-4 flex-col sm:flex-row sm:items-center">
                        <div className="flex-1">
                          <h3 className={`text-lg font-semibold mb-1 ${mounted && theme === 'dark' ? 'text-white' : ''}`}>Link de Tracking</h3>
                          {valid ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`break-all text-sm ${mounted && theme === 'dark' ? 'text-blue-400 hover:text-blue-300 hover:underline' : 'text-blue-600 hover:underline'}`}
                            >
                              {link}
                            </a>
                          ) : (
                            <p className={`break-all text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{link}</p>
                          )}
                        </div>
                        {valid && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsTrackingQRModalOpen(true)}
                            className={`flex items-center gap-2 ${mounted && theme === 'dark' ? 'border-slate-600 text-blue-400 hover:bg-slate-700' : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}
                          >
                            <QrCode className="w-4 h-4" />
                            QR
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Pago */}
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center">
                💳 {t('client.recentOrders.paymentModal.title')}
              </DialogTitle>
              <DialogDescription className="text-center">
                {paymentStep === 1 
                  ? t('client.recentOrders.paymentModal.selectMethod') 
                  : t('client.recentOrders.paymentModal.confirmDetails')}
              </DialogDescription>
            </DialogHeader>

            {selectedOrderForPayment && (
              <div className="space-y-6">
                {/* Información del pedido */}
                <div className={`p-4 rounded-xl border ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600' : 'bg-gradient-to-r from-blue-50 to-orange-50 border-blue-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-semibold text-lg ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{selectedOrderForPayment.product}</h3>
                      <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{selectedOrderForPayment.id}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${mounted && theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                        {formatPriceWithConversion(selectedOrderForPayment.amount, selectedPaymentMethod)}
                      </p>
                      <p className={`text-xs mt-1 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('client.recentOrders.paymentModal.quoteValidUntil', { date: '25/01/2024' })}</p>
                      {selectedPaymentMethod?.currency === 'BS' && exchangeRateLoading && (
                        <p className={`text-xs mt-1 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`}>Calculando conversión...</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Paso 1: Selección de método de pago */}
                {paymentStep === 1 && (
                  <div className="space-y-4 payment-step-transition">
                    <div className="grid grid-cols-1 gap-3">
                      {paymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className={`p-4 border-2 rounded-xl cursor-pointer hover:shadow-md payment-method-card group ${mounted && theme === 'dark' ? 'border-slate-600 hover:border-blue-500 bg-slate-800' : 'border-slate-200 hover:border-blue-300'}`}
                          onClick={() => handlePaymentMethodSelect(method)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">{method.icon}</div>
                              <div>
                                <h4 className={`font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{method.name}</h4>
                                <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{method.description}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className={`${
                                mounted && theme === 'dark' ? (
                                  method.validation === 'automatic' 
                                    ? 'bg-green-900/30 text-green-300 border-green-700 hover:bg-green-900/50 hover:ring-1 hover:ring-green-500/20 transition-colors' 
                                    : 'bg-yellow-900/30 text-yellow-300 border-yellow-700 hover:bg-yellow-900/50 hover:ring-1 hover:ring-yellow-500/20 transition-colors'
                                ) : (
                                  method.validation === 'automatic' 
                                    ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-50 hover:ring-1 hover:ring-green-200 transition-colors' 
                                    : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-200 transition-colors'
                                )
                              }`}>
                                {method.validation === 'automatic' ? `⚡ ${t('client.recentOrders.paymentModal.automatic')}` : t('client.recentOrders.paymentModal.manual')}
                              </Badge>
                              <p className={`text-xs mt-1 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{method.currency}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Paso 2: Detalles del método seleccionado */}
                {paymentStep === 2 && selectedPaymentMethod && (
                  <div className="space-y-6 payment-step-transition">
                    {/* Método seleccionado */}
                    <div className={`p-4 rounded-xl border ${mounted && theme === 'dark' ? 'bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-700' : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{selectedPaymentMethod.icon}</div>
                        <div>
                          <h4 className={`font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{selectedPaymentMethod.name}</h4>
                          <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{selectedPaymentMethod.description}</p>
                        </div>
                      </div>
                    </div>

                    {/* Información de pago */}
                    <div className="space-y-4 payment-info-card">
                      <h4 className={`font-semibold text-lg ${mounted && theme === 'dark' ? 'text-white' : ''}`}>📋 {t('client.recentOrders.paymentModal.paymentInfo')}</h4>
                      
                      {selectedPaymentMethod.id === 'mobile' && (
                        <div className="space-y-3">
                          <div className={`p-4 rounded-lg ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50'}`}>
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('client.recentOrders.paymentModal.phoneNumber')}</p>
                            <p className={`text-lg font-mono font-bold ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{selectedPaymentMethod.details?.phoneNumber}</p>
                          </div>
                          <div className={`p-4 rounded-lg ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50'}`}>
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('client.recentOrders.paymentModal.reference')}</p>
                            <p className={`text-lg font-mono font-bold ${mounted && theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>{selectedPaymentMethod.details?.reference}</p>
                          </div>
                        </div>
                      )}

                      {selectedPaymentMethod.id === 'transfer' && (
                        <div className="space-y-3">
                          <div className={`p-4 rounded-lg ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50'}`}>
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('client.recentOrders.paymentModal.bank')}</p>
                            <p className={`text-lg font-bold ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{selectedPaymentMethod.details?.bankName}</p>
                          </div>
                          <div className={`p-4 rounded-lg ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50'}`}>
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('client.recentOrders.paymentModal.accountNumber')}</p>
                            <p className={`text-lg font-mono font-bold ${mounted && theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>{selectedPaymentMethod.details?.accountNumber}</p>
                          </div>
                          <div className={`p-4 rounded-lg ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50'}`}>
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('client.recentOrders.paymentModal.reference')}</p>
                            <p className={`text-lg font-mono font-bold ${mounted && theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`}>{selectedPaymentMethod.details?.reference}</p>
                          </div>
                        </div>
                      )}

                      {(selectedPaymentMethod.id === 'binance' || selectedPaymentMethod.id === 'zelle' || selectedPaymentMethod.id === 'paypal') && (
                        <div className="space-y-3">
                          <div className={`p-4 rounded-lg ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50'}`}>
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('client.recentOrders.paymentModal.email')}</p>
                            <p className={`text-lg font-mono font-bold ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{selectedPaymentMethod.details?.email}</p>
                          </div>
                          <div className={`p-4 rounded-lg ${mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50'}`}>
                            <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t('client.recentOrders.paymentModal.reference')}</p>
                            <p className={`text-lg font-mono font-bold ${mounted && theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>{selectedPaymentMethod.details?.reference}</p>
                          </div>
                        </div>
                      )}

                      {/* Instrucciones */}
                      <div className={`p-4 border rounded-lg ${mounted && theme === 'dark' ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 ${mounted && theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>⚠️</div>
                          <div>
                            <p className={`font-medium ${mounted && theme === 'dark' ? 'text-yellow-300' : 'text-yellow-800'}`}>{t('client.recentOrders.paymentModal.importantInstructions')}</p>
                            <ul className={`text-sm mt-1 space-y-1 ${mounted && theme === 'dark' ? 'text-yellow-200' : 'text-yellow-700'}`}>
                              <li>• {t('client.recentOrders.paymentModal.instructions.exactReference')}</li>
                              <li>• {t('client.recentOrders.paymentModal.instructions.saveReceipt')}</li>
                              <li>• {t('client.recentOrders.paymentModal.instructions.processTime')}</li>
                              {selectedPaymentMethod.validation === 'manual' && (
                                <li>• {t('client.recentOrders.paymentModal.instructions.manualValidation')}</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botones de navegación */}
                <div className={`flex gap-3 pt-4 ${mounted && theme === 'dark' ? 'border-t border-slate-700' : 'border-t'}`}>
                  <Button 
                    variant="outline" 
                    onClick={handlePaymentBack}
                    className={`flex-1 ${mounted && theme === 'dark' ? 'border-slate-600 hover:bg-slate-700' : ''}`}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {paymentStep === 1 ? t('client.recentOrders.paymentModal.cancel') : t('client.recentOrders.paymentModal.back')}
                  </Button>
                  
                  {paymentStep === 2 && (
                    <Button 
                      onClick={handlePaymentConfirm}
                      disabled={isConfirmingPayment}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isConfirmingPayment ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          {t('client.recentOrders.paymentModal.processing')}
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          {t('client.recentOrders.paymentModal.confirmPayment')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
      {/* Modal QR Tracking Link (reinsertado) */}
      {isTrackingQRModalOpen && selectedTrackingOrder && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-up"
          onClick={() => setIsTrackingQRModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl border border-slate-200 w-[90%] max-w-sm relative animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-slate-500 hover:text-slate-700 text-sm"
              onClick={() => setIsTrackingQRModalOpen(false)}
              aria-label="Cerrar"
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" /> Código QR Tracking
            </h3>
            {(() => {
              const link = tracking_link[String(selectedTrackingOrder.id)];
              if (!link) return <p className="text-sm text-slate-500">No disponible.</p>;
              try { new URL(link); } catch { return <p className="text-sm text-slate-500 break-all">{link}</p>; }
              const QR = require('react-qr-code').default;
              return (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-white border rounded-xl shadow-md">
                    <QR value={link} size={260} />
                  </div>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all text-xs text-center"
                  >
                    {link}
                  </a>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(link).catch(()=>{}); }}
                    className="text-xs px-3 py-1 rounded-md border border-slate-300 hover:bg-slate-50 text-slate-600"
                  >
                    Copiar enlace
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .step-transition-enter {
          animation: slideInFromRight 0.3s ease-out;
        }
        
        .step-transition-enter-prev {
          animation: slideInFromLeft 0.3s ease-out;
        }
        
        .step-transition-exit {
          animation: fadeInUp 0.3s ease-out reverse;
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out;
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes slideInFromBottom {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .payment-method-card {
          transition: all 0.2s ease-in-out;
        }
        
        .payment-method-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }
        
        .payment-step-transition {
          animation: scaleIn 0.3s ease-out;
        }
        
        .payment-info-card {
          animation: slideInFromBottom 0.4s ease-out;
        }
      `}</style>

      {/* Modal de Calificación */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className={`max-w-md ${mounted && theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={`${mounted && theme === 'dark' ? 'text-white' : ''}`}>
              Calificar Pedido
            </DialogTitle>
            <DialogDescription className={mounted && theme === 'dark' ? 'text-slate-400' : ''}>
              {selectedOrderForReview && `Pedido #${selectedOrderForReview.id} - ${selectedOrderForReview.product}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Calificación con estrellas */}
            <div>
              <Label className={`text-sm font-semibold ${mounted && theme === 'dark' ? 'text-slate-300' : ''}`}>
                Califique de 1 a 5 estrellas *
              </Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className={`transition-all duration-200 ${
                      star <= reviewRating
                        ? 'text-yellow-400 scale-110'
                        : mounted && theme === 'dark'
                        ? 'text-slate-500 hover:text-yellow-300'
                        : 'text-slate-300 hover:text-yellow-400'
                    }`}
                  >
                    <Star
                      className={`w-8 h-8 ${star <= reviewRating ? 'fill-current' : ''}`}
                    />
                  </button>
                ))}
              </div>
              {reviewRating > 0 && (
                <p className={`text-sm mt-2 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  {reviewRating} {reviewRating === 1 ? 'estrella' : 'estrellas'}
                </p>
              )}
            </div>

            {/* Texto de la reseña */}
            <div>
              <Label htmlFor="review-text" className={`text-sm font-semibold ${mounted && theme === 'dark' ? 'text-slate-300' : ''}`}>
                Escribe tu reseña
              </Label>
              <Textarea
                id="review-text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Deje su reseña aquí"
                className={`mt-2 min-h-[100px] ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : ''}`}
                maxLength={500}
              />
              <p className={`text-xs mt-1 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                {reviewText.length}/500 caracteres
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsReviewModalOpen(false);
                setReviewRating(0);
                setReviewText('');
                setSelectedOrderForReview(null);
              }}
              disabled={submittingReview}
              className={mounted && theme === 'dark' ? 'border-slate-600' : ''}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={submittingReview || reviewRating === 0}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
            >
              {submittingReview ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Star className="w-4 h-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Ver Reseña */}
      <Dialog open={isViewReviewModalOpen} onOpenChange={setIsViewReviewModalOpen}>
        <DialogContent className={`max-w-md ${mounted && theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={`${mounted && theme === 'dark' ? 'text-white' : ''}`}>
              {t('client.reviews.viewModal.title') || 'Tu Reseña'}
            </DialogTitle>
            <DialogDescription className={mounted && theme === 'dark' ? 'text-slate-400' : ''}>
              {selectedOrderForReview && `${t('client.reviews.viewModal.subtitle') || 'Pedido'} #${selectedOrderForReview.id} - ${selectedOrderForReview.product}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrderForReview && orderReviews[selectedOrderForReview.id] ? (
            <div className="space-y-4 py-4">
              {/* Calificación mostrada */}
              <div>
                <Label className={`text-sm font-semibold ${mounted && theme === 'dark' ? 'text-slate-300' : ''}`}>
                  {t('client.reviews.viewModal.rating') || 'Tu Calificación'}
                </Label>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-6 h-6 ${
                        star <= orderReviews[selectedOrderForReview.id].rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : mounted && theme === 'dark'
                          ? 'text-slate-600'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-sm mt-2 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  {orderReviews[selectedOrderForReview.id].rating} {orderReviews[selectedOrderForReview.id].rating === 1 ? t('client.reviews.modal.star') || 'estrella' : t('client.reviews.modal.stars') || 'estrellas'}
                </p>
              </div>

              {/* Texto de la reseña */}
              {orderReviews[selectedOrderForReview.id].reviewText && (
                <div>
                  <Label className={`text-sm font-semibold ${mounted && theme === 'dark' ? 'text-slate-300' : ''}`}>
                    {t('client.reviews.viewModal.reviewText') || 'Tu Reseña'}
                  </Label>
                  <div className={`mt-2 p-3 rounded-lg ${mounted && theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
                    <p className="text-sm whitespace-pre-wrap">{orderReviews[selectedOrderForReview.id].reviewText}</p>
                  </div>
                </div>
              )}

              {/* Fecha */}
              <div>
                <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('client.reviews.viewModal.date') || 'Fecha'}: {new Date(orderReviews[selectedOrderForReview.id].createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <p className={`text-center ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('client.reviews.viewModal.loading') || 'Cargando reseña...'}
              </p>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsViewReviewModalOpen(false);
                setSelectedOrderForReview(null);
              }}
              className={mounted && theme === 'dark' ? 'border-slate-600' : ''}
            >
              {t('client.reviews.viewModal.close') || 'Cerrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
