import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import path from 'path';
import fs from 'fs';

export const revalidate = 0;

// POST /api/orders/[id]/invoice — Generar factura PDF al validar pago
// Soporta pedidos individuales y múltiples (misma factura para pedidos del mismo cliente pagados juntos)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'ID de pedido inválido' }, { status: 400 });
    }

    const supabase = getSupabaseServiceRoleClient();

    // Obtener el pedido principal
    const { data: mainOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, state, productName, description, quantity, totalQuote, estimatedBudget, shippingType, deliveryType, client_id, created_at, unitQuote, shippingPrice, batch_id')
      .eq('id', orderId)
      .single();

    if (orderError || !mainOrder) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (mainOrder.state < 5) {
      return NextResponse.json({ error: 'El pago aún no ha sido validado' }, { status: 400 });
    }

    // Si tiene batch_id, buscar todos los pedidos del mismo batch que estén validados
    let orders = [mainOrder];
    if (mainOrder.batch_id) {
      const { data: batchOrders } = await supabase
        .from('orders')
        .select('id, state, productName, description, quantity, totalQuote, estimatedBudget, shippingType, deliveryType, client_id, created_at, unitQuote, shippingPrice, batch_id')
        .eq('batch_id', mainOrder.batch_id)
        .eq('client_id', mainOrder.client_id)
        .gte('state', 5)
        .order('id', { ascending: true });
      if (batchOrders && batchOrders.length > 1) {
        orders = batchOrders;
      }
    }

    // Obtener datos del cliente
    let clientName = 'Cliente';
    let clientEmail = '';
    if (mainOrder.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('name')
        .eq('user_id', mainOrder.client_id)
        .single();
      if (clientData?.name) clientName = clientData.name;

      try {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(mainOrder.client_id);
        if (authUser?.email) clientEmail = authUser.email;
      } catch { /* skip if can't get email */ }
    }

    // Cargar logo
    let logoBase64: string | null = null;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'images', 'logos', 'pita_logo.png');
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = 'data:image/png;base64,' + logoBuffer.toString('base64');
    } catch (e) {
      console.warn('No se pudo cargar el logo:', e);
    }

    // Generar PDF
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = (doc.internal.pageSize as any).height;
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;

    // Paleta formal
    const c = {
      navy: [23, 37, 63] as [number, number, number],
      darkGray: [55, 65, 81] as [number, number, number],
      medGray: [107, 114, 128] as [number, number, number],
      lightGray: [243, 244, 246] as [number, number, number],
      border: [209, 213, 219] as [number, number, number],
      text: [31, 41, 55] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
    };

    const invoiceNum = `INV-${String(orderId).padStart(5, '0')}`;
    const invoiceDate = new Date();
    const formatDate = (d: Date) => d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const orderDate = mainOrder.created_at ? new Date(mainOrder.created_at) : new Date();

    const shippingMap: Record<string, string> = {
      air: 'Aéreo', maritime: 'Marítimo', doorToDoor: 'Puerta a puerta'
    };
    const deliveryMap: Record<string, string> = {
      office: 'Oficina', warehouse: 'Almacén', express: 'Express', pickup: 'Retiro en tienda', delivery: 'Entrega a domicilio'
    };

    // ═══════════════════════════════════════
    // HEADER
    // ═══════════════════════════════════════
    doc.setFillColor(c.navy[0], c.navy[1], c.navy[2]);
    doc.rect(0, 0, pageWidth, 32, 'F');

    // Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin, 4, 24, 24);
      } catch { /* skip logo if fails */ }
    }

    const textStartX = logoBase64 ? margin + 27 : margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('PITA EXPRESS', textStartX, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Importaciones & Logística', textStartX, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('FACTURA', pageWidth - margin, 15, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(invoiceNum, pageWidth - margin, 23, { align: 'right' });

    let y = 42;

    // ═══════════════════════════════════════
    // DATOS DE FACTURA
    // ═══════════════════════════════════════
    const colLeft = margin;
    const colRight = pageWidth / 2 + 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(c.medGray[0], c.medGray[1], c.medGray[2]);
    doc.text('FACTURAR A:', colLeft, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(c.text[0], c.text[1], c.text[2]);
    doc.text(clientName, colLeft, y);
    y += 5;

    if (clientEmail) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(c.darkGray[0], c.darkGray[1], c.darkGray[2]);
      doc.text(clientEmail, colLeft, y);
      y += 5;
    }

    let yRight = 42;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(c.medGray[0], c.medGray[1], c.medGray[2]);
    doc.text('DETALLES:', colRight, yRight);
    yRight += 6;

    const detailRows = [
      ['N° Factura:', invoiceNum],
      ['Fecha emisión:', formatDate(invoiceDate)],
      ['Fecha pedido:', formatDate(orderDate)],
      ['N° Pedido:', orders.length > 1 ? orders.map(o => `#${o.id}`).join(', ') : `#${orderId}`],
    ];

    doc.setFontSize(9);
    for (const [label, value] of detailRows) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(c.darkGray[0], c.darkGray[1], c.darkGray[2]);
      doc.text(label, colRight, yRight);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(c.text[0], c.text[1], c.text[2]);
      const maxW = pageWidth - margin - (colRight + 38);
      const lines = doc.splitTextToSize(value, maxW);
      doc.text(lines, colRight + 38, yRight);
      yRight += 5 * lines.length;
    }

    y = Math.max(y, yRight) + 6;

    doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ═══════════════════════════════════════
    // TABLA DE CONCEPTOS
    // ═══════════════════════════════════════
    // Cada pedido es una fila: Concepto fijo, descripción es el nombre del producto, 
    // Cant., Tipo de Envío, P. Unit. = totalQuote, Subtotal = totalQuote

    const tableBody: any[][] = orders.map(order => {
      const total = Number(order.totalQuote ?? order.estimatedBudget ?? 0);
      const shippingLabel = shippingMap[order.shippingType] || order.shippingType || '—';
      return [
        'Servicio de Importación',
        `${order.productName || '—'}${order.description ? ` — ${order.description}` : ''}`,
        String(order.quantity || 1),
        shippingLabel,
        `$${total.toFixed(2)}`,
      ];
    });

    const grandTotal = orders.reduce((sum, o) => sum + Number(o.totalQuote ?? o.estimatedBudget ?? 0), 0);

    autoTable(doc, {
      head: [['Concepto', 'Descripción', 'Cant.', 'Tipo de Envío', 'Monto']],
      body: tableBody,
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'plain',
      headStyles: {
        fillColor: c.navy,
        textColor: c.white,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
        textColor: c.text,
        lineColor: c.border,
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 38, fontStyle: 'bold' },
        1: { cellWidth: contentWidth - 38 - 14 - 28 - 26 },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 28, halign: 'center' },
        4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      },
    });

    y = (doc as any).lastAutoTable?.finalY + 10 || y + 50;

    // ═══════════════════════════════════════
    // TOTALES
    // ═══════════════════════════════════════
    const totalsX = pageWidth - margin - 75;
    const totalsW = 75;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(c.darkGray[0], c.darkGray[1], c.darkGray[2]);
    doc.text('Subtotal:', totalsX, y);
    doc.text(`$${grandTotal.toFixed(2)}`, totalsX + totalsW, y, { align: 'right' });
    y += 6;

    // Línea
    doc.setDrawColor(c.navy[0], c.navy[1], c.navy[2]);
    doc.setLineWidth(0.8);
    doc.line(totalsX, y, totalsX + totalsW, y);
    y += 6;

    // Total
    doc.setFillColor(c.navy[0], c.navy[1], c.navy[2]);
    doc.rect(totalsX - 3, y - 5, totalsW + 6, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL:', totalsX, y + 2);
    doc.text(`$${grandTotal.toFixed(2)}`, totalsX + totalsW, y + 2, { align: 'right' });

    y += 18;

    // ═══════════════════════════════════════
    // INFORMACIÓN ADICIONAL
    // ═══════════════════════════════════════
    doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    const deliveryLabel = deliveryMap[mainOrder.deliveryType] || mainOrder.deliveryType || '—';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(c.medGray[0], c.medGray[1], c.medGray[2]);
    doc.text('INFORMACIÓN ADICIONAL', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(c.darkGray[0], c.darkGray[1], c.darkGray[2]);
    doc.text(`Entrega: ${deliveryLabel}`, margin, y);
    doc.text('Estado: Pago verificado', margin + 80, y);
    if (orders.length > 1) {
      y += 4;
      doc.text(`Pedidos incluidos: ${orders.map(o => `#${o.id}`).join(', ')}`, margin, y);
    }

    y += 10;

    // Condiciones
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(c.medGray[0], c.medGray[1], c.medGray[2]);
    doc.text('CONDICIONES', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const conditions = [
      'Este documento certifica que el pago ha sido recibido y validado exitosamente.',
      'Los precios están expresados en dólares americanos (USD).',
      'Pita Express se reserva el derecho de modificar tiempos de entrega según disponibilidad.',
    ];
    for (const cond of conditions) {
      doc.text(`• ${cond}`, margin, y);
      y += 4;
    }

    // ═══════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════
    const footerY = pageHeight - 14;
    doc.setDrawColor(c.navy[0], c.navy[1], c.navy[2]);
    doc.setLineWidth(0.8);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFontSize(7);
    doc.setTextColor(c.medGray[0], c.medGray[1], c.medGray[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('Pita Express — Importaciones & Logística', margin, footerY);
    doc.text(invoiceNum, pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Emitida: ${formatDate(invoiceDate)}`, pageWidth - margin, footerY, { align: 'right' });

    // === SUBIR A STORAGE ===
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    const fileName = `invoices/factura_${orderId}_${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('orders')
      .upload(fileName, pdfBuffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      });

    if (uploadError) {
      console.error('Error uploading invoice PDF:', uploadError);
      return NextResponse.json({ error: 'Error al subir la factura', details: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage
      .from('orders')
      .getPublicUrl(fileName);

    const invoiceUrl = publicUrlData.publicUrl;

    // Guardar invoiceRoute en TODOS los pedidos incluidos
    const orderIds = orders.map(o => o.id);
    const { error: updateError } = await supabase
      .from('orders')
      .update({ invoiceRoute: invoiceUrl })
      .in('id', orderIds);

    if (updateError) {
      console.error('Error saving invoice URL:', updateError);
      return NextResponse.json({ error: 'Factura generada pero no se pudo guardar la URL', url: invoiceUrl }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invoiceUrl,
      ordersIncluded: orderIds,
      message: 'Factura generada exitosamente',
    });

  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Error interno al generar factura', details: error.message },
      { status: 500 }
    );
  }
}
