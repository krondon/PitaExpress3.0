'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useTheme } from 'next-themes';
import { useVzlaLayoutContext } from '@/lib/VzlaLayoutContext';
import '../../animations/animations.css';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Boxes, Calendar, CheckCircle, Clock, Eye, Filter, List, Package, Search, Send, Pencil } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useRealtimeVzla } from '@/hooks/use-realtime-vzla';
import { useRealtimeVzlaBoxesContainers } from '@/hooks/use-realtime-vzla-boxes-containers';
import { ArchiveHistoryButton } from '@/components/shared/ArchiveHistoryButton';
export default function VenezuelaPedidosPage() {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { toggleMobileMenu } = useVzlaLayoutContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  type Order = {
    id: string | number;
    quantity: number;
    productName: string;
    deliveryType?: string;
    shippingType?: string;
    state: number;
    clientName: string;
    client_id?: string;
    asignedEVzla?: string;
    description?: string;
    pdfRoutes?: string;
  };
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Modal genérico de aviso (para "Sin PDF")
  const [modalAviso, setModalAviso] = useState<{ open: boolean; title?: string; description?: string }>({ open: false });
  const [isClosingModalAviso, setIsClosingModalAviso] = useState(false);
  const closeModalAviso = () => {
    setIsClosingModalAviso(true);
    setTimeout(() => {
      setModalAviso({ open: false });
      setIsClosingModalAviso(false);
    }, 200);
  };

  // Paginación (8 por página)
  const ITEMS_PER_PAGE = 8;
  const [ordersPage, setOrdersPage] = useState(1);
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

  // Reset pages on filters/data change
  useEffect(() => { setOrdersPage(1); }, [searchQuery, statusFilter, orders.length]);

  // Tabs: pedidos | cajas | contenedores
  const [activeTab, setActiveTab] = useState<'pedidos' | 'cajas' | 'contenedores'>('pedidos');

  // Cajas state
  type BoxItem = { boxes_id?: number | string; id?: number | string; box_id?: number | string; container_id?: number | string; state?: number; creation_date?: string; created_at?: string };
  const [boxes, setBoxes] = useState<BoxItem[]>([]);
  const [boxesLoading, setBoxesLoading] = useState(false);
  const [filtroCaja, setFiltroCaja] = useState('');
  const [orderCountsByBoxMain, setOrderCountsByBoxMain] = useState<Record<string | number, number>>({});
  const [boxesWithAirShipping, setBoxesWithAirShipping] = useState<Record<string | number, boolean>>({});
  const [ordersByBox, setOrdersByBox] = useState<Order[]>([]);
  const [ordersByBoxLoading, setOrdersByBoxLoading] = useState(false);
  // Modal para ver pedidos de una caja
  const [modalVerPedidos, setModalVerPedidos] = useState<{ open: boolean; boxId?: number | string }>({ open: false });

  // Contenedores state
  type ContainerItem = { containers_id?: number | string; id?: number | string; container_id?: number | string; state?: number; creation_date?: string; created_at?: string };
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [containersLoading, setContainersLoading] = useState(false);
  const [filtroContenedor, setFiltroContenedor] = useState('');
  const [boxesByContainer, setBoxesByContainer] = useState<BoxItem[]>([]);
  const [boxesByContainerLoading, setBoxesByContainerLoading] = useState(false);
  const [orderCountsByBox, setOrderCountsByBox] = useState<Record<string | number, number>>({});
  const [modalVerCajas, setModalVerCajas] = useState<{ open: boolean; containerId?: number | string }>({ open: false });

  // Modal de edición de pedido
  const [modalEditOrder, setModalEditOrder] = useState<{ open: boolean; order?: Order | null }>({ open: false, order: null });
  const [editTitle, setEditTitle] = useState('');
  const [editQuantity, setEditQuantity] = useState<number | ''>('');
  const [editDescription, setEditDescription] = useState('');
  const [editSpecifications, setEditSpecifications] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditModal = (order: Order) => {
    setEditError(null);
    setModalEditOrder({ open: true, order });
    setEditTitle((order as any).title || order.productName || '');
    setEditQuantity(Number(order.quantity) || 1);
    setEditDescription((order as any).description || '');
    setEditSpecifications((order as any).specifications || '');
    setEditUrl((order as any).url || (order as any).pdfRoutes || '');
  };

  const closeEditModal = () => {
    if (editSaving) return; // evita cerrar mientras "guarda"
    setModalEditOrder({ open: false, order: null });
  };

  const handleSaveEdit = async () => {
    setEditError(null);
    // Validaciones mínimas
    if (!editTitle?.trim()) {
      setEditError(t('venezuela.pedidos.validation.titleRequired', { defaultValue: 'El título es obligatorio.' }));
      return;
    }
    const qty = Number(editQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setEditError(t('venezuela.pedidos.validation.quantityPositive', { defaultValue: 'La cantidad debe ser un número positivo.' }));
      return;
    }
    if (!modalEditOrder.order?.id) {
      setEditError(t('venezuela.pedidos.errors.invalidOrder', { defaultValue: 'Pedido inválido. Intenta de nuevo.' }));
      return;
    }
    setEditSaving(true);
    try {
      const payload = {
        id: Number.isFinite(Number(modalEditOrder.order?.id)) ? Number(modalEditOrder.order?.id) : modalEditOrder.order?.id,
        title: editTitle.trim(),
        quantity: qty,
        description: editDescription.trim(),
        specifications: editSpecifications.trim(),
        url: editUrl.trim(),
      };
      const res = await fetch('/venezuela/pedidos/api/update-order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('venezuela.pedidos.errors.updateOrder', { defaultValue: 'No se pudo actualizar el pedido' }));
      }
      // Tras actualizar, regenerar PDF con los datos editados y reemplazar la ruta previa si existe
      try {
        const supabase = getSupabaseBrowserClient();
        const orderIdCreated = payload.id as string | number;

        // Construir fecha legible segura para nombre de archivo
        const now = new Date();
        const fechaPedidoLegible = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

        // 2) Generar PDF con el ID real del pedido (misma lógica que en cliente)
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF();

        // Helper para sanitizar valores usados en el nombre del archivo / carpeta
        const sanitizeForFile = (val: string | undefined | null) => {
          return (val || 'x')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9-_]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase()
            .slice(0, 60);
        };

        // Layout y colores
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = (doc.internal.pageSize as any).height;
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

        // Datos para la tabla (reutilizando estructura del cliente)
        const orderForPdf = modalEditOrder.order as Order;
        const pedidoTable: any[] = [
          ['Order ID', `${orderIdCreated}`],
          ['Client ID', `${orderForPdf?.client_id ?? ''}`],
          ['Username', `${orderForPdf?.clientName || '-'}`],
          ['Date', `${fechaPedidoLegible}`],
          ['Shipping Type', `${orderForPdf?.deliveryType ?? ''}`],
          ['Delivery in Venezuela', `${'venezuela'}`],
          ['Product', `${payload.title}`],
          ['Quantity', `${payload.quantity}`],
          ['Description', payload.description || '-'],
          ['Specifications', payload.specifications || '-'],
        ];
        if (payload.url) {
          pedidoTable.push(['URL', payload.url]);
        }

        // === ENCABEZADO PROFESIONAL ===
        doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.rect(0, 0, pageWidth, 35, 'F');
        doc.setFontSize(12);
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.setFont('helvetica', 'bold');
        try {
          const logoDataUrl = await loadSvgAsPngDataUrl('/pita_icon.svg', 320);
          const boxSize = 20; // mm
          const logoW = 14;   // mm
          const logoH = 14;   // mm
          const logoX = margin + (boxSize - logoW) / 2;
          const logoY = 8 + (boxSize - logoH) / 2;
          // @ts-ignore
          doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH, undefined, 'FAST');
        } catch {
          doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          doc.text('PITA', margin + 10, 20, { align: 'center' });
        }
        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text('ORDER SUMMARY', pageWidth / 2, 22, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        // @ts-ignore
        doc.text(`Order: #${orderIdCreated}`, pageWidth - margin, 15, { align: 'right' });
        doc.text(`Date: ${fechaPedidoLegible}`, pageWidth - margin, 21, { align: 'right' });

        let currentY = 50;

        // Para edición, tratamos el pedido como tipo 'link' si hay URL
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
        if (payload.url) {
          const finalY = (doc as any).lastAutoTable?.finalY + 12;
          doc.setFontSize(10);
          doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
          doc.text('Product URL:', margin, finalY + 6);
          doc.setFontSize(10);
          doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          const urlText = (doc as any).splitTextToSize(payload.url, pageWidth - (margin * 2));
          doc.text(urlText, margin, finalY + 14);
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

        // Subir PDF a Supabase Storage con nombre sanitizado (misma lógica que en clientes)
        const pdfBlob = doc.output('blob');
        const safeProduct = sanitizeForFile(payload.title);
        const safeClient = sanitizeForFile(orderForPdf?.client_id);
        const safeDeliveryVzla = sanitizeForFile('venezuela');
        const safeDeliveryType = sanitizeForFile(orderForPdf?.deliveryType);
        const nombrePDFCorr = `${safeProduct}_${fechaPedidoLegible}_${orderIdCreated}_${safeClient}_${safeDeliveryVzla}.pdf`;
        const folder = safeDeliveryType || 'otros';
        let uploadKey = `${folder}/${nombrePDFCorr}`;

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
          const ultraKey = (uploadKey || '')
            .replace(/[^a-zA-Z0-9/_\-.]/g, '')
            .replace(/--+/g, '-');
          uploadResult = await doUpload(ultraKey);
          if (!uploadResult.error) {

            uploadKey = ultraKey;
          }
        }

        if (uploadResult.error) {
          console.error('Supabase Storage upload error:', uploadResult.error);
          setModalAviso({ open: true, title: 'Error subiendo PDF', description: uploadResult.error.message || 'No se pudo subir el archivo.' });
        } else {
          const finalKey = uploadResult.data?.path || uploadKey!;
          const pdfUrl = `https://bgzsodcydkjqehjafbkv.supabase.co/storage/v1/object/public/orders/${finalKey}`;

          // Actualizar el pedido con la nueva URL del PDF
          const patchRes = await fetch(`/api/admin/orders/${orderIdCreated}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfRoutes: pdfUrl,
              // @ts-ignore
              imgs: pdfUrl ? [pdfUrl] : [],
              // @ts-ignore
              links: payload.url ? [payload.url] : []
            })
          });
          if (!patchRes.ok) {
            let errMsg = `Status ${patchRes.status}`;
            try {
              const j = await patchRes.json();
              if ((j as any)?.error) errMsg += ` - ${(j as any).error}`;
              if ((j as any)?.details) errMsg += ` | ${Array.isArray((j as any).details) ? (j as any).details.join(', ') : (j as any).details}`;
            } catch {/* ignore */ }
            console.error('Error actualizando pedido con PDF URL:', errMsg, { orderIdCreated, pdfUrl });

            // Fallback: actualizar directamente via Supabase
            let fallbackSucceeded = false;
            let descriptionMsg = `Pedido actualizado pero no se pudo asociar el nuevo PDF. URL generado: ${pdfUrl}`;
            try {
              const { error: directUpdateError } = await supabase
                .from('orders')
                .update({ pdfRoutes: pdfUrl })
                .eq('id', orderIdCreated as any);
              if (!directUpdateError) {
                // Si el fallback directo funcionó, no mostramos modal de error
                fallbackSucceeded = true;
              } else {
                descriptionMsg += `\nIntento directo también falló: ${directUpdateError.message}`;
              }
            } catch (directErr: any) {
              descriptionMsg += `\nIntento directo también falló con excepción: ${directErr?.message || String(directErr)}`;
            }

            if (!fallbackSucceeded) {
              setModalAviso({ open: true, title: 'Advertencia', description: descriptionMsg });
            }
          }
        }
      } catch (pdfErr) {
        console.error('Error al regenerar/subir PDF tras edición:', pdfErr);
        setModalAviso({ open: true, title: 'Error generando PDF', description: (pdfErr as any)?.message || 'No se pudo generar o subir el PDF editado.' });
      }

      // Actualizar listado y cerrar modal
      await fetchOrders();
      setModalEditOrder({ open: false, order: null });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[EDIT ORDER ERROR]', e);
      const message = (e as Error)?.message || t('venezuela.pedidos.errors.editUnknown', { defaultValue: 'Ocurrió un error al guardar.' });
      setEditError(message);
    } finally {
      setEditSaving(false);
    }
  };

  // (Scroll lock centralizado en Sidebar)

  // Reset boxes/containers pagination when filters or data length change
  useEffect(() => { setBoxesPage(1); }, [filtroCaja, boxes.length]);
  useEffect(() => { setContainersPage(1); }, [filtroContenedor, containers.length]);

  // Función para obtener pedidos (puede ser llamada desde useEffect y desde el botón)
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const empleadoId = user?.id;
      if (!empleadoId) throw new Error(t('venezuela.pedidos.errors.getUser'));
      const res = await fetch(`/venezuela/pedidos/api/orders?asignedEVzla=${encodeURIComponent(String(empleadoId))}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(t('venezuela.pedidos.errors.fetchOrders'));
      const data = await res.json();
      // Defensa extra: si por alguna razón el endpoint no filtró correctamente,
      // aplicamos filtro en cliente para mostrar solo pedidos asignados al empleado.
      const onlyAssigned = Array.isArray(data)
        ? data.filter((o: any) => String(o?.asignedEVzla ?? '') === String(empleadoId))
        : [];
      setOrders(onlyAssigned);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Obtener usuario y montar + primera carga
  useEffect(() => {
    setMounted(true);
    fetchOrders();
  }, []);

  /* Realtime Orders (solo pestaña pedidos) */
  const handleRealtimeOrdersUpdate = useCallback(() => {
    // Refresca pedidos siempre
    fetchOrders();
    // Si el usuario está mirando cajas o contenedores, refrescamos conteos indirectamente
    if (activeTab === 'cajas') {
      fetchBoxes();
    } else if (activeTab === 'contenedores') {
      fetchContainers();
    }
    // Si hay un modal de caja abierto, refrescar contenido específico
    if (modalVerPedidos.open && modalVerPedidos.boxId) {
      fetchOrdersByBoxId(modalVerPedidos.boxId);
    }
    if (modalVerCajas.open && modalVerCajas.containerId) {
      fetchBoxesByContainerId(modalVerCajas.containerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, modalVerPedidos.open, modalVerPedidos.boxId, modalVerCajas.open, modalVerCajas.containerId]);

  // Obtener id del empleado para hook realtime
  const [empleadoId, setEmpleadoId] = useState<string | undefined>();
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) setEmpleadoId(user.id);
      } catch (e) {
        console.warn('[Realtime Vzla] No se pudo obtener usuario para realtime');
      }
    })();
  }, []);

  useRealtimeVzla(handleRealtimeOrdersUpdate, empleadoId);

  // Realtime for client profile changes (to reflect clientName updates in list)
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`vzla-orders-clients-${empleadoId || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoId]);

  // Realtime para cajas y contenedores: activo siempre que exista empleadoId
  const handleRealtimeBoxesUpdate = useCallback(() => {
    if (activeTab === 'cajas') fetchBoxes();
    if (modalVerPedidos.open && modalVerPedidos.boxId) fetchOrdersByBoxId(modalVerPedidos.boxId);
    // Si se está mostrando contenedor con cajas
    if (modalVerCajas.open && modalVerCajas.containerId) fetchBoxesByContainerId(modalVerCajas.containerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, modalVerPedidos.open, modalVerPedidos.boxId, modalVerCajas.open, modalVerCajas.containerId]);

  const handleRealtimeContainersUpdate = useCallback(() => {
    if (activeTab === 'contenedores') fetchContainers();
    // Si modal abierto de contenedor: refrescar cajas y pedidos de cajas
    if (modalVerCajas.open && modalVerCajas.containerId) fetchBoxesByContainerId(modalVerCajas.containerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, modalVerCajas.open, modalVerCajas.containerId]);

  useRealtimeVzlaBoxesContainers(handleRealtimeBoxesUpdate, handleRealtimeContainersUpdate, !!empleadoId);

  // Carga cajas/contenedores al cambiar de pestaña
  useEffect(() => {
    if (activeTab === 'cajas') fetchBoxes();
    if (activeTab === 'contenedores') fetchContainers();
  }, [activeTab]);

  // Fetch boxes
  const fetchBoxes = async () => {
    setBoxesLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from('boxes').select('*');
      if (error) throw error;
      const list = (data || []) as BoxItem[];
      list.sort((a, b) => {
        const da = new Date((a.creation_date ?? a.created_at ?? '') as string).getTime() || 0;
        const db = new Date((b.creation_date ?? b.created_at ?? '') as string).getTime() || 0;
        return db - da;
      });
      setBoxes(list);
      // counts
      const ids = list.map(b => b.box_id ?? b.boxes_id ?? (b as any).id).filter(v => v !== undefined && v !== null);
      if (ids.length > 0) {
        const { data: ordersData, error: err2 } = await supabase.from('orders').select('id, box_id').in('box_id', ids as any);
        if (!err2) {
          const counts: Record<string | number, number> = {};
          (ordersData || []).forEach((row: any) => {
            const key = row.box_id as string | number;
            counts[key] = (counts[key] || 0) + 1;
          });
          setOrderCountsByBoxMain(counts);
          // Check for air shipping
          const { data: airData, error: airError } = await supabase.from('orders').select('box_id').eq('shippingType', 'air').in('box_id', ids as any);
          if (!airError) {
            const airBoxes: Record<string | number, boolean> = {};
            (airData || []).forEach((row: any) => {
              airBoxes[row.box_id] = true;
            });
            setBoxesWithAirShipping(airBoxes);
          } else {
            setBoxesWithAirShipping({});
          }
        } else {
          setOrderCountsByBoxMain({});
          setBoxesWithAirShipping({});
        }
      } else {
        setOrderCountsByBoxMain({});
        setBoxesWithAirShipping({});
      }
    } catch (e) {
      console.error('Error fetchBoxes:', e);
    } finally {
      setBoxesLoading(false);
    }
  };

  // Fetch containers
  const fetchContainers = async () => {
    setContainersLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from('containers').select('*');
      if (error) throw error;
      const list = (data || []) as ContainerItem[];
      list.sort((a, b) => {
        const da = new Date((a.creation_date ?? a.created_at ?? '') as string).getTime() || 0;
        const db = new Date((b.creation_date ?? b.created_at ?? '') as string).getTime() || 0;
        return db - da;
      });
      setContainers(list);
    } catch (e) {
      console.error('Error fetchContainers:', e);
    } finally {
      setContainersLoading(false);
    }
  };

  // Fetch orders by box
  const fetchOrdersByBoxId = async (boxId: number | string) => {
    setOrdersByBoxLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from('orders').select('*').eq('box_id', boxId);
      if (error) throw error;
      const mapped: Order[] = (data || []).map((o: any) => ({
        id: String(o.id),
        quantity: Number(o.quantity || 0),
        productName: o.productName || o.product || '—',
        deliveryType: o.deliveryType || '',
        shippingType: o.shippingType || '',
        state: Number(o.state || 0),
        clientName: o.clientName || o.client || '—',
        client_id: o.client_id || '',
        description: o.specifications || '',
        pdfRoutes: o.pdfRoutes || ''
      }));
      setOrdersByBox(mapped);
    } catch (e) {
      console.error('Error fetchOrdersByBoxId:', e);
    } finally {
      setOrdersByBoxLoading(false);
    }
  };

  // Fetch boxes by container
  const fetchBoxesByContainerId = async (containerId: number | string) => {
    setBoxesByContainerLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from('boxes').select('*').eq('container_id', containerId);
      if (error) throw error;
      const list = (data || []) as BoxItem[];
      list.sort((a, b) => {
        const da = new Date((a.creation_date ?? a.created_at ?? '') as string).getTime() || 0;
        const db = new Date((b.creation_date ?? b.created_at ?? '') as string).getTime() || 0;
        return db - da;
      });
      setBoxesByContainer(list);
      const ids = list.map(b => b.box_id ?? b.boxes_id ?? (b as any).id).filter(v => v !== undefined && v !== null);
      if (ids.length > 0) {
        const { data: ordersData, error: err2 } = await supabase.from('orders').select('id, box_id').in('box_id', ids as any);
        if (!err2) {
          const counts: Record<string | number, number> = {};
          (ordersData || []).forEach((row: any) => {
            const key = row.box_id as string | number;
            counts[key] = (counts[key] || 0) + 1;
          });
          setOrderCountsByBox(counts);
          // Check for air shipping
          const { data: airData, error: airError } = await supabase.from('orders').select('box_id').eq('shippingType', 'air').in('box_id', ids as any);
          if (!airError) {
            const airBoxes: Record<string | number, boolean> = {};
            (airData || []).forEach((row: any) => {
              airBoxes[row.box_id] = true;
            });
            // Merge with existing
            setBoxesWithAirShipping(prev => ({ ...prev, ...airBoxes }));
          }
        } else {
          setOrderCountsByBox({});
          setBoxesWithAirShipping(prev => {
            const newState = { ...prev };
            ids.forEach(id => delete newState[id]);
            return newState;
          });
        }
      } else {
        setOrderCountsByBox({});
        setBoxesWithAirShipping(prev => {
          const newState = { ...prev };
          // No ids to clean, but perhaps clean all if needed, but for now leave
          return newState;
        });
      }
    } catch (e) {
      console.error('Error fetchBoxesByContainerId:', e);
    } finally {
      setBoxesByContainerLoading(false);
    }
  };

  // Filtros: búsqueda y estado
  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.id !== undefined && order.id !== null && order.id.toString().toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && order.state === 1) ||
      (statusFilter === 'reviewing' && order.state === 2) ||
      (statusFilter === 'quoted' && order.state === 3) ||
      (statusFilter === 'processing' && order.state === 4);
    return matchesSearch && matchesStatus;
  });

  // Ordenar: siempre los de mayor ID primero (LIFO)
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    return Number(b.id) - Number(a.id);
  });

  if (!mounted) return null;

  return (
    <>
      <div className="flex-1 pr-4">
        <Header
          notifications={0}
          notificationsRole="venezuela"
          onMenuToggle={toggleMobileMenu}
          title={t('venezuela.pedidos.title')}
          subtitle={t('venezuela.pedidos.subtitle')}
          showTitleOnMobile
        />

        <div className="p-4 md:p-5 lg:p-6 space-y-6">
          {/* Header de la página (título duplicado removido; lo muestra el Header de arriba) */}
          <div className="space-y-4">

            {/* Tarjetas de estadísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm md:text-base font-medium text-blue-700 dark:text-blue-300">{t('venezuela.pedidos.stats.inProcess') || 'En Proceso'}</p>
                      <p className="text-2xl md:text-3xl font-bold text-blue-800 dark:text-blue-200">
                        {orders.filter(o => o.state >= 5 && o.state <= 7).length}
                      </p>
                    </div>
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-800/30 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm md:text-base font-medium text-orange-700 dark:text-orange-300">{t('venezuela.pedidos.stats.inTransit') || 'En Tránsito'}</p>
                      <p className="text-2xl md:text-3xl font-bold text-orange-800 dark:text-orange-200">
                        {orders.filter(o => o.state >= 8 && o.state <= 10).length}
                      </p>
                    </div>
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100 dark:bg-orange-800/30 rounded-lg flex items-center justify-center">
                      <Send className="w-5 h-5 md:w-6 md:h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm md:text-base font-medium text-blue-700 dark:text-blue-300">{t('venezuela.pedidos.stats.received') || 'Recibidos'}</p>
                      <p className="text-2xl md:text-3xl font-bold text-blue-800 dark:text-blue-200">
                        {orders.filter(o => o.state >= 11 && o.state <= 12).length}
                      </p>
                    </div>
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 dark:bg-blue-800/30 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm md:text-base font-medium text-orange-700 dark:text-orange-300">{t('venezuela.pedidos.stats.delivered') || 'Entregados'}</p>
                      <p className="text-2xl md:text-3xl font-bold text-orange-800 dark:text-orange-200">
                        {orders.filter(o => o.state === 13).length}
                      </p>
                    </div>
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100 dark:bg-orange-800/30 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Modal Aviso (reutilizable) */}
            {modalAviso.open && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={closeModalAviso}>
                <div
                  className={`bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 w-full transition-all ${isClosingModalAviso ? 'scale-95 opacity-0' : 'scale-100 opacity-100'} duration-200`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-800/40 rounded-md mt-0.5"><AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-300" /></div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{modalAviso.title || 'Aviso'}</h3>
                      {modalAviso.description && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{modalAviso.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <Button variant="default" size="sm" onClick={closeModalAviso}>
                      OK
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs: Pedidos | Cajas | Contenedores (con indicador deslizante) */}
            <div className="pt-2">
              <div className="relative flex w-full gap-2 rounded-lg border border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-800/60 backdrop-blur px-1 py-1 shadow-sm overflow-hidden">
                {/* Indicador deslizante */}
                <span
                  className="absolute top-1 bottom-1 rounded-md bg-slate-900/95 dark:bg-slate-200 transition-all duration-300 ease-out shadow-sm"
                  style={{
                    left: `${(['pedidos', 'cajas', 'contenedores'] as const).indexOf(activeTab) * (100 / 3)}%`,
                    width: 'calc((100% - 0.5rem * 2) / 3)' // gap-2 => 0.5rem; reutilizamos fórmula del componente interno
                  }}
                />
                {(['pedidos', 'cajas', 'contenedores'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={'relative z-10 flex-1 min-w-0 px-2 py-2 text-xs md:text-sm font-medium truncate rounded-md transition-colors duration-200 ' +
                      (activeTab === tab
                        ? 'text-white dark:text-slate-900'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white')}
                  >
                    {tab === 'pedidos' && t('venezuela.pedidos.tabs.ordersList')}
                    {tab === 'cajas' && t('venezuela.pedidos.tabs.boxes')}
                    {tab === 'contenedores' && t('venezuela.pedidos.tabs.containers')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Contenido por pestaña */}
          {activeTab === 'pedidos' && (
            <Card className={`backdrop-blur-sm ${theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className={`text-xl font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                    <Package className={`h-5 w-5 ${theme === 'dark' ? 'text-blue-400' : 'text-black'}`} />
                    {t('venezuela.pedidos.tabs.ordersList', { defaultValue: 'Lista de pedidos' })}
                  </CardTitle>
                  <div className="w-full sm:w-auto flex items-center justify-end gap-2 md:gap-3 flex-wrap">
                    <Input
                      placeholder={t('venezuela.pedidos.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`h-10 w-full sm:w-64 px-3 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : ''}`}
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter as any}>
                      <SelectTrigger className={`h-10 w-full sm:w-56 px-3 whitespace-nowrap truncate ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : ''}`}>
                        <SelectValue placeholder={t('venezuela.pedidos.filters.status')} />
                      </SelectTrigger>
                      <SelectContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
                        <SelectItem value="all">{t('venezuela.pedidos.filters.all')}</SelectItem>
                        <SelectItem value="pending">{t('venezuela.pedidos.filters.pending')}</SelectItem>
                        <SelectItem value="reviewing">{t('venezuela.pedidos.filters.reviewing')}</SelectItem>
                        <SelectItem value="quoted">{t('venezuela.pedidos.filters.quoted')}</SelectItem>
                        <SelectItem value="processing">{t('venezuela.pedidos.filters.processing')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <ArchiveHistoryButton
                      role="vzla"
                      userId={empleadoId || ''}
                      onSuccess={() => fetchOrders()}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className={`p-10 text-center text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('venezuela.pedidos.loadingOrders')}</div>
                ) : error ? (
                  <div className={`p-10 text-center text-sm ${theme === 'dark' ? 'text-red-300' : 'text-red-600'}`}>{error}</div>
                ) : filteredOrders.length === 0 ? (
                  <div className="p-10 text-center">
                    <Package className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('venezuela.pedidos.emptyOrdersTitle')}</h3>
                    <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>{t('venezuela.pedidos.emptyOrdersDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const total = sortedOrders.length; const { start, end } = getPageSlice(total, ordersPage); return sortedOrders.slice(start, end).map((order) => {
                        const stateNum = Number(order.state);
                        return (
                          <div
                            key={order.id}
                            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border hover:shadow-md transition-all duration-300 ${theme === 'dark' ? 'bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'}`}
                          >
                            <div className="min-w-0 flex items-center gap-4">
                              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}><Package className={`h-5 w-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} /></div>
                              <div className="min-w-0 space-y-1">
                                <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#ORD-{String(order.id)} • {order.clientName}</h3>
                                <div className={`flex flex-wrap gap-4 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                  <span className="truncate">{t('venezuela.pedidos.labels.quantity')}: {order.quantity}</span>
                                  <span className="truncate">{t('venezuela.pedidos.labels.deliveryType')}: {order.deliveryType}</span>
                                  <span className="truncate">{t('venezuela.pedidos.labels.shippingType')}: {order.shippingType}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                              {stateNum === 13 && (<Badge className={theme === 'dark' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:ring-1 hover:ring-emerald-200'}>{t('venezuela.pedidos.badges.delivered')}</Badge>)}
                              {stateNum === 12 && (<Badge className={theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:ring-1 hover:ring-blue-200'}>{t('venezuela.pedidos.badges.readyToDeliver')}</Badge>)}
                              {stateNum === 11 && (<Badge className={theme === 'dark' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:ring-1 hover:ring-emerald-200'}>{t('venezuela.pedidos.badges.received')}</Badge>)}
                              {stateNum === 10 && (<Badge className={theme === 'dark' ? 'bg-indigo-900/30 text-indigo-300 border-indigo-700' : 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 hover:ring-1 hover:ring-indigo-200'}>{t('venezuela.pedidos.badges.customs')}</Badge>)}
                              {stateNum === 9 && (<Badge className={theme === 'dark' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:ring-1 hover:ring-emerald-200'}>{t('venezuela.pedidos.badges.arrivedVzla')}</Badge>)}
                              {stateNum === 8 && (<Badge className={theme === 'dark' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:ring-1 hover:ring-emerald-200'}>{t('venezuela.pedidos.badges.onWayVzla')}</Badge>)}
                              {stateNum === 1 && (<Badge className={theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300 hover:ring-1 hover:ring-yellow-200'}>{t('venezuela.pedidos.badges.pending')}</Badge>)}
                              {stateNum === 2 && (<Badge className={theme === 'dark' ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-50 hover:border-green-300 hover:ring-1 hover:ring-green-200'}>{t('venezuela.pedidos.badges.reviewing')}</Badge>)}
                              {stateNum === 3 && (<Badge className={theme === 'dark' ? 'bg-purple-900/30 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-50 hover:border-purple-300 hover:ring-1 hover:ring-purple-200'}>{t('venezuela.pedidos.badges.quoted')}</Badge>)}
                              {stateNum === 4 && (<Badge className={theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:ring-1 hover:ring-blue-200'}>{t('venezuela.pedidos.badges.processing')}</Badge>)}
                              {(stateNum >= 5 && stateNum <= 7) && (<Badge className={theme === 'dark' ? 'bg-gray-800/50 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:ring-1 hover:ring-gray-200'}>{t('venezuela.pedidos.badges.inProcess')}</Badge>)}

                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1 uppercase"
                                onClick={() => {
                                  if (order.pdfRoutes) {
                                    const win = window.open(order.pdfRoutes, '_blank');
                                    if (!win) {
                                      setModalAviso({ open: true, title: t('venezuela.pedidos.pdf.openError') || 'No se pudo abrir el PDF', description: t('venezuela.pedidos.pdf.notAvailableOrder') || 'Intenta nuevamente o verifica más tarde.' });
                                    }
                                  } else {
                                    setModalAviso({ open: true, title: 'Sin PDF', description: 'No hay PDF disponible para este pedido.' });
                                  }
                                }}
                              >
                                <Eye className="w-4 h-4" /> {t('admin.orders.actions.view')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-1 uppercase"
                                disabled={stateNum !== 1}
                                onClick={() => openEditModal(order)}
                                title={stateNum !== 1 ? t('venezuela.pedidos.edit.disabledTooltip', { defaultValue: 'Solo disponible para pedidos en estado Pendiente (1)' }) : t('venezuela.pedidos.edit.cta', { defaultValue: 'Editar pedido' })}
                              >
                                <Pencil className="w-4 h-4" /> {t('admin.orders.actions.edit', { defaultValue: 'Editar' })}
                              </Button>
                              <Button
                                size="icon"
                                disabled={loading || ![1, 8, 11, 12].includes(stateNum)}
                                onClick={async () => {
                                  if (stateNum === 1) {
                                    try {
                                      const res = await fetch('/venezuela/pedidos/api/send-to-china', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ orderId: order.id })
                                      });
                                      if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.error || t('venezuela.pedidos.errors.updateOrder'));
                                      }
                                      await fetchOrders();
                                    } catch (err) {
                                      console.error(err);
                                      alert((err as Error).message || t('venezuela.pedidos.errors.sendToChina'));
                                    }
                                    return;
                                  }
                                  if (stateNum === 8) {
                                    try {
                                      const res = await fetch('/venezuela/pedidos/api/advance-state', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ orderId: order.id, nextState: 9 })
                                      });
                                      if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.error || t('venezuela.pedidos.errors.updateOrder'));
                                      }
                                      await fetchOrders();
                                    } catch (err) {
                                      console.error(err);
                                      alert((err as Error).message || t('venezuela.pedidos.errors.updateStatus'));
                                    }
                                    return;
                                  }
                                  if (stateNum === 9) {
                                    try {
                                      const res = await fetch('/venezuela/pedidos/api/advance-state', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ orderId: order.id, nextState: 10 })
                                      });
                                      if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.error || t('venezuela.pedidos.errors.updateOrder'));
                                      }
                                      await fetchOrders();
                                    } catch (err) {
                                      console.error(err);
                                      alert((err as Error).message || t('venezuela.pedidos.errors.updateStatus'));
                                    }
                                    return;
                                  }
                                  if (stateNum === 11) {
                                    try {
                                      const res = await fetch('/venezuela/pedidos/api/advance-state', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ orderId: order.id, nextState: 12 })
                                      });
                                      if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.error || t('venezuela.pedidos.errors.updateOrder'));
                                      }
                                      await fetchOrders();
                                    } catch (err) {
                                      console.error(err);
                                      alert((err as Error).message || t('venezuela.pedidos.errors.updateStatus'));
                                    }
                                    return;
                                  }
                                  if (stateNum === 12) {
                                    try {
                                      const res = await fetch('/venezuela/pedidos/api/advance-state', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ orderId: order.id, nextState: 13 })
                                      });
                                      if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.error || t('venezuela.pedidos.errors.updateOrder'));
                                      }
                                      await fetchOrders();
                                    } catch (err) {
                                      console.error(err);
                                      alert((err as Error).message || t('venezuela.pedidos.errors.updateStatus'));
                                    }
                                    return;
                                  }
                                }}
                              >
                                {stateNum >= 13 ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : stateNum === 12 ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : stateNum === 11 ? (
                                  <Package className="w-4 h-4" />
                                ) : stateNum === 9 ? (
                                  <Package className="w-4 h-4" />
                                ) : stateNum === 8 ? (
                                  <Package className="w-4 h-4" />
                                ) : stateNum === 10 ? (
                                  <Clock className="w-4 h-4" />
                                ) : (stateNum >= 2 && stateNum <= 7) ? (
                                  <Clock className="w-4 h-4" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
                {(() => {
                  const total = sortedOrders.length; if (total === 0) return null; const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)); const { start, end } = getPageSlice(total, ordersPage); const pages = getVisiblePages(totalPages, ordersPage); return (
                    <div className={`mt-4 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                      <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('admin.orders.pagination.showing', { defaultValue: 'Mostrando' })} {Math.min(total, start + 1)} {t('admin.orders.pagination.to', { defaultValue: 'a' })} {end} {t('admin.orders.pagination.of', { defaultValue: 'de' })} {total} {t('admin.orders.pagination.results', { defaultValue: 'resultados' })}</p>
                      <div className="flex items-center gap-1 justify-end flex-wrap">
                        <Button variant="outline" size="sm" disabled={ordersPage <= 1} onClick={() => setOrdersPage(p => Math.max(1, p - 1))}>{t('admin.orders.pagination.prev', { defaultValue: 'Anterior' })}</Button>
                        {pages[0] > 1 && (<><Button variant="outline" size="sm" onClick={() => setOrdersPage(1)}>1</Button><span className="px-1 text-slate-400">…</span></>)}
                        {pages.map(p => (<Button key={p} variant={p === ordersPage ? 'default' : 'outline'} size="sm" onClick={() => setOrdersPage(p)}>{p}</Button>))}
                        {pages[pages.length - 1] < totalPages && (<><span className="px-1 text-slate-400">…</span><Button variant="outline" size="sm" onClick={() => setOrdersPage(totalPages)}>{totalPages}</Button></>)}
                        <Button variant="outline" size="sm" disabled={ordersPage >= totalPages} onClick={() => setOrdersPage(p => Math.min(totalPages, p + 1))}>{t('admin.orders.pagination.next', { defaultValue: 'Siguiente' })}</Button>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {activeTab === 'cajas' && (
            <Card className={`backdrop-blur-sm hover:shadow-lg transition-shadow ${theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className={`text-xl font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                    <Boxes className={`h-5 w-5 ${theme === 'dark' ? 'text-indigo-400' : ''}`} />
                    {t('venezuela.pedidos.tabs.boxes')}
                  </CardTitle>
                  <div className="w-full sm:w-auto flex items-center justify-end gap-2 md:gap-3 flex-wrap">
                    <Input
                      placeholder={t('venezuela.pedidos.filters.searchBoxPlaceholder')}
                      value={filtroCaja}
                      onChange={(e) => setFiltroCaja(e.target.value)}
                      className={`h-10 w-full sm:w-64 px-3 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : ''}`}
                    />
                    {/* Botón de refrescar eliminado: realtime activo */}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {boxes.length === 0 ? (
                  <div className="text-center py-12">
                    <Boxes className={`h-12 w-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('venezuela.pedidos.emptyBoxesTitle')}</h3>
                    <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}>{t('venezuela.pedidos.emptyBoxesDesc')}</p>
                  </div>
                ) : boxes.filter((b, idx) => {
                  if (!filtroCaja) return true;
                  const id = b.box_id ?? b.boxes_id ?? b.id ?? idx;
                  return String(id).toLowerCase().includes(filtroCaja.toLowerCase());
                }).length === 0 ? (
                  <div className="text-center py-12">
                    <Boxes className={`h-12 w-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('venezuela.pedidos.emptyBoxesSearchTitle')}</h3>
                    <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}>{t('venezuela.pedidos.emptyBoxesSearchDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const filtered = boxes.filter((b, idx) => {
                        if (!filtroCaja) return true;
                        const id = b.box_id ?? b.boxes_id ?? b.id ?? idx;
                        return String(id).toLowerCase().includes(filtroCaja.toLowerCase());
                      });
                      const total = filtered.length;
                      const { start, end } = getPageSlice(total, boxesPage);
                      return filtered.slice(start, end).map((box, idx) => {
                        const id = box.box_id ?? box.boxes_id ?? box.id ?? idx;
                        const created = box.creation_date ?? box.created_at ?? '';
                        const stateNum = (box.state ?? 1) as number;
                        const countKey = box.box_id ?? box.boxes_id ?? box.id ?? id;
                        return (
                          <div key={`${id}`} className={`flex items-center justify-between p-4 rounded-xl border hover:shadow-md transition-all duration-300 min-w-0 overflow-hidden flex-wrap gap-3 md:flex-nowrap ${theme === 'dark' ? 'bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'}`}>
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'}`}>
                                <Boxes className={`h-5 w-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#BOX-{id}</h3>
                                </div>
                                <div className={`flex items-center gap-4 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                  <span className="flex items-center gap-1"><List className="h-3 w-3" />{t('venezuela.pedidos.labels.orders')} {orderCountsByBoxMain[countKey as any] ?? 0}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
                              <Badge className={`border ${stateNum === 1
                                ? theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:ring-1 hover:ring-blue-200 transition-colors'
                                : stateNum === 2
                                  ? theme === 'dark' ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-blue-800 border-green-200 hover:bg-green-50 hover:border-green-300 hover:ring-1 hover:ring-green-200 transition-colors'
                                  : stateNum === 3
                                    ? theme === 'dark' ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-blue-800 border-green-200 hover:bg-green-50 hover:border-green-300 hover:ring-1 hover:ring-green-200 transition-colors'
                                    : stateNum === 4
                                      ? theme === 'dark' ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-50 hover:border-green-300 hover:ring-1 hover:ring-green-200 transition-colors'
                                      : stateNum === 5 || stateNum === 6
                                        ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:ring-1 hover:ring-emerald-200 transition-colors'
                                        : theme === 'dark' ? 'bg-gray-800/50 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:ring-1 hover:ring-gray-200 transition-colors'
                                }`}>
                                {stateNum === 1 ? t('venezuela.pedidos.boxesBadges.new') : stateNum === 2 ? t('venezuela.pedidos.boxesBadges.ready') : stateNum === 3 ? t('venezuela.pedidos.boxesBadges.inContainer') : stateNum === 4 ? t('venezuela.pedidos.boxesBadges.traveling') : stateNum === 5 ? t('venezuela.pedidos.boxesBadges.received') : stateNum === 6 ? t('venezuela.pedidos.boxesBadges.completed') : t('venezuela.pedidos.boxesBadges.state', { num: stateNum })}
                              </Badge>
                              {/* Botón Recibido: visible cuando boxes.state === 5 o (state === 4 y tiene pedidos air) */}
                              {(stateNum === 5 || (stateNum === 4 && boxesWithAirShipping[countKey])) && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={async () => {
                                    const nextState = 6;
                                    try {
                                      const res = await fetch('/venezuela/pedidos/api/advance-box', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ boxId: box.box_id ?? box.boxes_id ?? box.id ?? id, nextState })
                                      });
                                      if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.error || t('venezuela.pedidos.errors.updateBox'));
                                      }
                                      // Actualizar pedidos asociados a estado 11
                                      const supabase = getSupabaseBrowserClient();
                                      const { data: ordersData } = await supabase.from('orders').select('id').eq('box_id', box.box_id ?? box.boxes_id ?? box.id ?? id);
                                      if (ordersData) {
                                        for (const order of ordersData) {
                                          await fetch(`/api/admin/orders/${order.id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ state: 11 })
                                          });
                                        }
                                      }
                                      await Promise.all([fetchBoxes(), fetchOrders()]);
                                    } catch (e) {
                                      alert((e as Error).message || t('venezuela.pedidos.errors.boxUpdate'));
                                    }
                                  }}
                                  title={stateNum === 4 ? t('venezuela.pedidos.tooltips.markBoxReceivedAir') : t('venezuela.pedidos.tooltips.markBoxReceived')}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="icon"
                                className=""
                                onClick={() => {
                                  const boxId = box.box_id ?? box.boxes_id ?? box.id;
                                  setModalVerPedidos({ open: true, boxId });
                                  if (boxId !== undefined) fetchOrdersByBoxId(boxId as any);
                                }}
                              >
                                <List className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
                {(() => {
                  const filtered = boxes.filter((b, idx) => {
                    if (!filtroCaja) return true;
                    const id = b.box_id ?? b.boxes_id ?? b.id ?? idx;
                    return String(id).toLowerCase().includes(filtroCaja.toLowerCase());
                  });
                  const total = filtered.length;
                  if (total === 0) return null;
                  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
                  const { start, end } = getPageSlice(total, boxesPage);
                  const pages = getVisiblePages(totalPages, boxesPage);
                  return (
                    <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="text-xs sm:text-sm text-slate-600">{t('admin.orders.pagination.showing', { defaultValue: 'Mostrando' })} {Math.min(total, start + 1)} {t('admin.orders.pagination.to', { defaultValue: 'a' })} {end} {t('admin.orders.pagination.of', { defaultValue: 'de' })} {total} {t('admin.orders.pagination.results', { defaultValue: 'resultados' })}</p>
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
                {boxesLoading && (
                  <p className={`text-center text-sm mt-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>{t('venezuela.pedidos.loadingBoxes')}</p>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'contenedores' && (
            <Card className={`backdrop-blur-sm hover:shadow-lg transition-shadow ${theme === 'dark' ? 'bg-slate-800/70 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className={`text-xl font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : ''}`}>
                    <Boxes className={`h-5 w-5 ${theme === 'dark' ? 'text-indigo-400' : ''}`} />
                    {t('venezuela.pedidos.tabs.containers')}
                  </CardTitle>
                  <div className="w-full sm:w-auto flex items-center justify-end gap-2 md:gap-3 flex-wrap">
                    <Input
                      placeholder={t('venezuela.pedidos.filters.searchContainerPlaceholder')}
                      value={filtroContenedor}
                      onChange={(e) => setFiltroContenedor(e.target.value)}
                      className={`h-10 w-full sm:w-64 px-3 ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : ''}`}
                    />
                    {/* Botón de refrescar eliminado: realtime activo */}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {containers.length === 0 ? (
                  <div className="text-center py-12">
                    <Boxes className={`h-12 w-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('venezuela.pedidos.emptyContainersTitle')}</h3>
                    <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}>{t('venezuela.pedidos.emptyContainersDesc')}</p>
                  </div>
                ) : containers.filter((c, idx) => {
                  if (!filtroContenedor) return true;
                  const id = c.container_id ?? c.containers_id ?? c.id ?? idx;
                  return String(id).toLowerCase().includes(filtroContenedor.toLowerCase());
                }).length === 0 ? (
                  <div className="text-center py-12">
                    <Boxes className={`h-12 w-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('venezuela.pedidos.emptyContainersSearchTitle')}</h3>
                    <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}>{t('venezuela.pedidos.emptyContainersSearchDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const filtered = containers.filter((c, idx) => {
                        if (!filtroContenedor) return true;
                        const id = c.container_id ?? c.containers_id ?? c.id ?? idx;
                        return String(id).toLowerCase().includes(filtroContenedor.toLowerCase());
                      });
                      const total = filtered.length;
                      const { start, end } = getPageSlice(total, containersPage);
                      return filtered.slice(start, end).map((container, idx) => {
                        const id = container.container_id ?? container.containers_id ?? container.id ?? idx;
                        const created = container.creation_date ?? container.created_at ?? '';
                        const stateNum = (container.state ?? 1) as number;
                        return (
                          <div key={`${id}`} className={`flex items-center justify-between p-4 rounded-xl border hover:shadow-md transition-all duration-300 min-w-0 ${theme === 'dark' ? 'bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'}`}>
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'}`}>
                                <Boxes className={`h-5 w-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#CONT-{id}</h3>
                                </div>
                                <div className={`flex items-center gap-4 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                              <Badge className={`border ${stateNum === 1
                                ? theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:ring-1 hover:ring-blue-200 transition-colors'
                                : stateNum === 2
                                  ? theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300 hover:ring-1 hover:ring-yellow-200 transition-colors'
                                  : stateNum === 4
                                    ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:ring-1 hover:ring-emerald-200 transition-colors'
                                    : theme === 'dark' ? 'bg-gray-800/50 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:ring-1 hover:ring-gray-200 transition-colors'
                                }`}>
                                {stateNum === 1
                                  ? t('venezuela.pedidos.containersBadges.new')
                                  : stateNum === 2
                                    ? t('venezuela.pedidos.containersBadges.inTransit')
                                    : stateNum === 3
                                      ? t('venezuela.pedidos.containersBadges.traveling')
                                      : stateNum === 4
                                        ? t('venezuela.pedidos.containersBadges.received')
                                        : t('venezuela.pedidos.containersBadges.state', { num: stateNum })}
                              </Badge>
                              {/* Botón Recibido: visible solo cuando containers.state === 3 */}
                              {stateNum === 3 && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={async () => {
                                    try {
                                      const res = await fetch('/venezuela/pedidos/api/advance-container', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ containerId: container.container_id ?? container.containers_id ?? container.id ?? id, nextState: 4 })
                                      });
                                      if (!res.ok) {
                                        const err = await res.json().catch(() => ({}));
                                        throw new Error(err.error || t('venezuela.pedidos.errors.updateContainer'));
                                      }
                                      await Promise.all([fetchContainers(), fetchBoxes(), fetchOrders()]);
                                    } catch (e) {
                                      alert((e as Error).message || t('venezuela.pedidos.errors.containerUpdate'));
                                    }
                                  }}
                                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                  title={t('venezuela.pedidos.tooltips.markContainerReceived')}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="icon"
                                className=""
                                onClick={() => {
                                  const containerId = container.container_id ?? container.containers_id ?? container.id;
                                  setModalVerCajas({ open: true, containerId });
                                  if (containerId !== undefined) fetchBoxesByContainerId(containerId as any);
                                }}
                              >
                                <List className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
                {(() => {
                  const filtered = containers.filter((c, idx) => {
                    if (!filtroContenedor) return true;
                    const id = c.container_id ?? c.containers_id ?? c.id ?? idx;
                    return String(id).toLowerCase().includes(filtroContenedor.toLowerCase());
                  });
                  const total = filtered.length;
                  if (total === 0) return null;
                  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
                  const { start, end } = getPageSlice(total, containersPage);
                  const pages = getVisiblePages(totalPages, containersPage);
                  return (
                    <div className={`mt-4 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                      <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('admin.orders.pagination.showing', { defaultValue: 'Mostrando' })} {Math.min(total, start + 1)} {t('admin.orders.pagination.to', { defaultValue: 'a' })} {end} {t('admin.orders.pagination.of', { defaultValue: 'de' })} {total} {t('admin.orders.pagination.results', { defaultValue: 'resultados' })}</p>
                      <div className="flex items-center gap-1 justify-end flex-wrap">
                        <Button variant="outline" size="sm" disabled={containersPage <= 1} onClick={() => setContainersPage(p => Math.max(1, p - 1))}>{t('admin.orders.pagination.prev', { defaultValue: 'Anterior' })}</Button>
                        {pages[0] > 1 && (<><Button variant="outline" size="sm" onClick={() => setContainersPage(1)}>1</Button><span className={`px-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>…</span></>)}
                        {pages.map(p => (<Button key={p} variant={p === containersPage ? 'default' : 'outline'} size="sm" onClick={() => setContainersPage(p)}>{p}</Button>))}
                        {pages[pages.length - 1] < totalPages && (<><span className={`px-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>…</span><Button variant="outline" size="sm" onClick={() => setContainersPage(totalPages)}>{totalPages}</Button></>)}
                        <Button variant="outline" size="sm" disabled={containersPage >= totalPages} onClick={() => setContainersPage(p => Math.min(totalPages, p + 1))}>{t('admin.orders.pagination.next', { defaultValue: 'Siguiente' })}</Button>
                      </div>
                    </div>
                  );
                })()}
                {containersLoading && (
                  <p className={`text-center text-sm mt-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>{t('venezuela.pedidos.loadingContainers')}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Modales */}
          {/* Modal Editar Pedido */}
          {modalEditOrder.open && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={closeEditModal}
            >
              <div
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-xl mx-4 w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {t('venezuela.pedidos.edit.title', { defaultValue: 'Editar pedido' })} {modalEditOrder.order ? `#ORD-${modalEditOrder.order.id}` : ''}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={closeEditModal} className="h-8 w-8 p-0">✕</Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="edit-title">{t('venezuela.pedidos.edit.fields.title', { defaultValue: 'Título del pedido' })}</Label>
                    <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t('venezuela.pedidos.edit.placeholders.title', { defaultValue: 'Ej. Funda de almohada' }) || ''} />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="edit-quantity">{t('venezuela.pedidos.edit.fields.quantity', { defaultValue: 'Cantidad' })}</Label>
                    <Input id="edit-quantity" type="number" min={1} value={editQuantity} onChange={(e) => setEditQuantity(e.target.value === '' ? '' : Number(e.target.value))} placeholder="1" />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="edit-description">{t('venezuela.pedidos.edit.fields.description', { defaultValue: 'Descripción' })}</Label>
                    <Textarea id="edit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} placeholder={t('venezuela.pedidos.edit.placeholders.description', { defaultValue: 'Descripción general del pedido' }) || ''} />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="edit-specs">{t('venezuela.pedidos.edit.fields.specifications', { defaultValue: 'Especificaciones' })}</Label>
                    <Textarea id="edit-specs" value={editSpecifications} onChange={(e) => setEditSpecifications(e.target.value)} rows={3} placeholder={t('venezuela.pedidos.edit.placeholders.specifications', { defaultValue: 'Detalles técnicos, colores, tallas, etc.' }) || ''} />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="edit-url">{t('venezuela.pedidos.edit.fields.url', { defaultValue: 'URL del pedido' })}</Label>
                    <Input id="edit-url" type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://..." />
                  </div>

                  {editError && (
                    <p className="text-sm text-red-600">{editError}</p>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={closeEditModal} disabled={editSaving}>
                      {t('common.cancel', { defaultValue: 'Cancelar' })}
                    </Button>
                    <Button onClick={handleSaveEdit} disabled={editSaving}>
                      {editSaving ? t('common.saving', { defaultValue: 'Guardando…' }) : t('common.save', { defaultValue: 'Guardar' })}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {modalVerPedidos.open && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={() => setModalVerPedidos({ open: false })}>
              <div
                className={`rounded-2xl p-6 max-w-3xl mx-4 w-full max-h-[90vh] overflow-y-auto border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {t('venezuela.pedidos.modalOrdersTitle', { boxId: String(modalVerPedidos.boxId ?? '') })}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setModalVerPedidos({ open: false })}
                    className={`h-8 w-8 p-0 ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : ''}`}
                  >
                    ✕
                  </Button>
                </div>
                {ordersByBoxLoading ? (
                  <p className={`text-center text-sm py-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>{t('venezuela.pedidos.loadingOrders')}</p>
                ) : ordersByBox.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className={`h-12 w-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <h4 className={`text-base font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('venezuela.pedidos.modalOrdersEmptyTitle')}</h4>
                    <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}>{t('venezuela.pedidos.modalOrdersEmptyDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ordersByBox.map((o) => (
                      <div
                        key={o.id}
                        className={`flex items-center justify-between p-4 rounded-xl border ${theme === 'dark' ? 'bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                            <Package className={`h-5 w-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#ORD-{o.id}</h3>
                            </div>
                            <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{o.productName}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className={theme === 'dark' ? 'border-slate-600 text-white hover:bg-slate-700' : ''}
                          onClick={() => {
                            if (o.pdfRoutes) {
                              const win = window.open(o.pdfRoutes, '_blank');
                              if (!win) alert(t('venezuela.pedidos.pdf.openError'));
                            } else {
                              alert(t('venezuela.pedidos.pdf.notAvailable'));
                            }
                          }}
                        >
                          <Eye className={`h-4 w-4 ${theme === 'dark' ? 'text-blue-300' : ''}`} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {modalVerCajas.open && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setModalVerCajas({ open: false })}>
              <div
                className={`rounded-2xl p-6 max-w-3xl mx-4 w-full max-h-[90vh] overflow-y-auto border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {t('venezuela.pedidos.modalBoxesTitle', { containerId: String(modalVerCajas.containerId ?? '') })}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setModalVerCajas({ open: false })}
                    className={`h-8 w-8 p-0 ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : ''}`}
                  >
                    ✕
                  </Button>
                </div>
                {boxesByContainerLoading ? (
                  <p className={`text-center text-sm py-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>{t('venezuela.pedidos.loadingBoxes')}</p>
                ) : boxesByContainer.length === 0 ? (
                  <div className="text-center py-12">
                    <Boxes className={`h-12 w-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <h4 className={`text-base font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('venezuela.pedidos.modalBoxesEmptyTitle')}</h4>
                    <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}>{t('venezuela.pedidos.modalBoxesEmptyDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {boxesByContainer.map((box, idx) => {
                      const id = box.box_id ?? box.boxes_id ?? box.id ?? idx;
                      const created = box.creation_date ?? box.created_at ?? '';
                      const stateNum = (box.state ?? 1) as number;
                      return (
                        <div
                          key={`${id}`}
                          className={`flex items-center justify-between p-4 rounded-xl border min-w-0 overflow-hidden flex-wrap gap-3 md:flex-nowrap ${theme === 'dark' ? 'bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'
                            }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'}`}>
                              <Boxes className={`h-5 w-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className={`font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>#BOX-{id}</h3>
                              </div>
                              <div className={`flex items-center gap-4 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                <span className="flex items-center gap-1">
                                  <List className="h-3 w-3" />
                                  {t('venezuela.pedidos.labels.orders')} {orderCountsByBox[id as any] ?? 0}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
                            <Badge
                              className={`border ${stateNum === 1
                                ? theme === 'dark' ? 'bg-blue-900/30 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:ring-1 hover:ring-blue-200'
                                : stateNum === 2
                                  ? theme === 'dark' ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-50 hover:border-green-300 hover:ring-1 hover:ring-green-200'
                                  : stateNum === 5 || stateNum === 6
                                    ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:ring-1 hover:ring-emerald-200'
                                    : theme === 'dark' ? 'bg-gray-800/50 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:ring-1 hover:ring-gray-200'
                                }`}
                            >
                              {stateNum === 1 ? t('venezuela.pedidos.boxesBadges.new') : stateNum === 2 ? t('venezuela.pedidos.boxesBadges.ready') : stateNum === 5 ? t('venezuela.pedidos.boxesBadges.received') : stateNum === 6 ? t('venezuela.pedidos.boxesBadges.completed') : t('venezuela.pedidos.boxesBadges.state', { num: stateNum })}
                            </Badge>
                            {/* Botón Recibido en modal: visible cuando boxes.state === 5 o (state === 4 y tiene pedidos air) */}
                            {(stateNum === 5 || (stateNum === 4 && boxesWithAirShipping[id as any])) && (
                              <Button
                                variant="outline"
                                size="icon"
                                className={theme === 'dark' ? 'border-emerald-600 text-emerald-300 hover:bg-emerald-900/20' : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'}
                                onClick={async () => {
                                  const nextState = 6;
                                  try {
                                    const res = await fetch('/venezuela/pedidos/api/advance-box', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ boxId: box.box_id ?? box.boxes_id ?? box.id ?? id, nextState })
                                    });
                                    if (!res.ok) {
                                      const err = await res.json().catch(() => ({}));
                                      throw new Error(err.error || t('venezuela.pedidos.errors.updateBox'));
                                    }
                                    // Actualizar pedidos asociados a estado 11
                                    const supabase = getSupabaseBrowserClient();
                                    const { data: ordersData } = await supabase.from('orders').select('id').eq('box_id', box.box_id ?? box.boxes_id ?? box.id ?? id);
                                    if (ordersData) {
                                      for (const order of ordersData) {
                                        await fetch(`/api/admin/orders/${order.id}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ state: 11 })
                                        });
                                      }
                                    }
                                    await Promise.all([
                                      modalVerCajas.containerId ? fetchBoxesByContainerId(modalVerCajas.containerId) : Promise.resolve(),
                                      fetchOrders()
                                    ]);
                                  } catch (e) {
                                    alert((e as Error).message || t('venezuela.pedidos.errors.boxUpdate'));
                                  }
                                }}
                                title={stateNum === 4 ? t('venezuela.pedidos.tooltips.markBoxReceivedAir') : t('venezuela.pedidos.tooltips.markBoxReceived')}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              className={theme === 'dark' ? 'border-slate-600 text-white hover:bg-slate-700' : ''}
                              onClick={() => {
                                const boxId = box.box_id ?? box.boxes_id ?? box.id;
                                setModalVerPedidos({ open: true, boxId });
                                if (boxId !== undefined) fetchOrdersByBoxId(boxId as any);
                              }}
                            >
                              <List className={`h-4 w-4 ${theme === 'dark' ? 'text-blue-300' : ''}`} />
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
        </div>
      </div>
    </>
  );
}