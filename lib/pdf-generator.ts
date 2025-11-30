import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';

interface OrderPDFData {
    orderId: string | number;
    clientId: string;
    clientName: string;
    date: string;
    shippingType: string;
    deliveryVenezuela: string;
    productName: string;
    quantity: number;
    description: string;
    specifications: string;
    productUrl: string;
    productImageUrl?: string | null;
}

export async function generateOrderPDF(data: OrderPDFData): Promise<Uint8Array> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const colors = {
        primary: [22, 120, 187] as [number, number, number],
        secondary: [44, 62, 80] as [number, number, number],
        light: [245, 248, 255] as [number, number, number],
        border: [180, 200, 220] as [number, number, number],
        text: [33, 37, 41] as [number, number, number]
    };

    // --- HEADER ---
    doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // --- LOGO ---
    try {
        const logoPath = path.join(process.cwd(), 'public', 'images', 'logos', 'pita_logo.png');
        if (fs.existsSync(logoPath)) {
            const logoData = fs.readFileSync(logoPath).toString('base64');
            const boxSize = 20;
            const logoW = 14;
            const logoH = 14;
            const logoX = margin + (boxSize - logoW) / 2;
            const logoY = 8 + (boxSize - logoH) / 2;
            doc.addImage(logoData, 'PNG', logoX, logoY, logoW, logoH);
        } else {
            // Fallback text
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.text('PITA', margin + 5, 22);
        }
    } catch (e) {
        console.error('Error loading logo for PDF:', e);
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text('PITA', margin + 5, 22);
    }

    // --- TITLE ---
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDER SUMMARY', pageWidth / 2, 22, { align: 'center' });

    // --- ORDER INFO ---
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.text(`Order: #${data.orderId}`, pageWidth - margin, 15, { align: 'right' });
    doc.text(`Date: ${data.date}`, pageWidth - margin, 21, { align: 'right' });

    let currentY = 50;

    // --- PRODUCT IMAGE ---
    // If product image exists, fetch it and display it
    if (data.productImageUrl) {
        try {
            const response = await fetch(data.productImageUrl);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64Img = buffer.toString('base64');

                // Determine format from extension or content-type, default to JPEG
                let format = 'JPEG';
                if (data.productImageUrl.toLowerCase().endsWith('.png')) format = 'PNG';

                const imgWidth = 80;
                const imgHeight = 80;
                const xPos = pageWidth - margin - imgWidth;

                doc.addImage(base64Img, format, xPos, currentY, imgWidth, imgHeight, undefined, 'FAST');

                // Draw border around image
                doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
                doc.rect(xPos, currentY, imgWidth, imgHeight);
            }
        } catch (e) {
            console.error('Error fetching product image for PDF:', e);
        }
    }

    // --- TABLE ---
    const tableData = [
        ['Order ID', `${data.orderId}`],
        ['Client ID', `${data.clientId}`],
        ['Username', `${data.clientName || '-'}`],
        ['Date', `${data.date}`],
        ['Shipping Type', `${data.shippingType}`],
        ['Delivery in Venezuela', `${data.deliveryVenezuela}`],
        ['Product', `${data.productName}`],
        ['Quantity', `${data.quantity}`],
        ['Description', data.description || '-'],
        ['Specifications', data.specifications || '-'],
        ['URL', data.productUrl || '-'],
    ];

    // Calculate table width: if image exists, table takes left side, else full width
    // But to match client code logic (which seemed to put them side-by-side if image exists)
    // Client code: if image, table width = pageWidth - margin*2 - 80 - 10.

    let tableWidth = pageWidth - (margin * 2);
    if (data.productImageUrl) {
        tableWidth = pageWidth - (margin * 2) - 80 - 10; // 80 img width + 10 gap
    }

    autoTable(doc, {
        startY: currentY,
        head: [['Field', 'Details']],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 3,
            lineColor: colors.border,
            lineWidth: 0.1,
        },
        headStyles: {
            fillColor: colors.secondary,
            textColor: 255,
            fontStyle: 'bold',
        },
        columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold', fillColor: colors.light },
            1: { cellWidth: 'auto' },
        },
        margin: { left: margin, right: margin },
        tableWidth: tableWidth,
    });

    // --- FOOTER ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            'Pita Express - Your trusted shipping partner',
            pageWidth / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    return new Uint8Array(doc.output('arraybuffer'));
}
