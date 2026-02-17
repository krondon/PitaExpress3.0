/**
 * Templates de email para notificaciones al cliente.
 * Cada función retorna { subject, html } listo para enviar.
 */

const BRAND_COLOR = '#7f1f2b';
const BRAND_NAME = 'Pita Express';
const LOGO_URL = 'https://pitacompra.com/images/logos/pita_logo.png';

function baseLayout(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;text-align:center;">
              <img src="${LOGO_URL}" alt="${BRAND_NAME}" width="40" height="40" style="display:inline-block;vertical-align:middle;margin-right:12px;" />
              <span style="color:#ffffff;font-size:22px;font-weight:700;vertical-align:middle;">${BRAND_NAME}</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#71717a;">
                Este es un correo automático de ${BRAND_NAME}. No responder a este mensaje.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">
                © ${new Date().getFullYear()} ${BRAND_NAME}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function statusBadge(text: string, color: string): string {
  return `<span style="display:inline-block;padding:6px 16px;background-color:${color};color:#ffffff;border-radius:20px;font-size:14px;font-weight:600;">${text}</span>`;
}

// ─── TEMPLATE 1: Pedido Cotizado (state 3) ─────────────────────────────

export function orderQuotedEmail(orderId: string, productName: string, clientName?: string) {
  const greeting = clientName ? `Hola ${clientName},` : 'Hola,';
  const content = `
    <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">Tu cotización está lista 📋</h2>
    <p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">
      ${greeting}
    </p>
    <p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">
      Tu pedido <strong>#${orderId}</strong>${productName ? ` (${productName})` : ''} ha sido cotizado exitosamente. 
      Por favor, revisa la cotización y realiza el pago para que podamos continuar con el procesamiento.
    </p>
    <div style="text-align:center;margin:24px 0;">
      ${statusBadge('Cotizado', '#f59e0b')}
    </div>
    <div style="background-color:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;">
      <p style="margin:0;color:#92400e;font-size:14px;">
        <strong>⏳ Acción requerida:</strong> Revisa tu cotización y realiza el pago desde tu panel de cliente.
      </p>
    </div>
  `;
  return {
    subject: `📋 Cotización lista — Pedido #${orderId} | ${BRAND_NAME}`,
    html: baseLayout('Cotización lista', content),
  };
}

// ─── TEMPLATE 2: Pago Confirmado (state 5) ──────────────────────────────

export function paymentConfirmedEmail(orderId: string, productName: string, clientName?: string) {
  const greeting = clientName ? `Hola ${clientName},` : 'Hola,';
  const content = `
    <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">¡Pago confirmado! ✅</h2>
    <p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">
      ${greeting}
    </p>
    <p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">
      El pago de tu pedido <strong>#${orderId}</strong>${productName ? ` (${productName})` : ''} ha sido validado y confirmado. 
      Tu pedido está ahora listo para ser empaquetado y procesado.
    </p>
    <div style="text-align:center;margin:24px 0;">
      ${statusBadge('Pago Confirmado', '#22c55e')}
    </div>
    <div style="background-color:#dcfce7;border-left:4px solid #22c55e;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;">
      <p style="margin:0;color:#166534;font-size:14px;">
        <strong>✅ Todo en orden:</strong> Tu pedido pronto comenzará a ser procesado. Te notificaremos cuando sea enviado.
      </p>
    </div>
  `;
  return {
    subject: `✅ Pago confirmado — Pedido #${orderId} | ${BRAND_NAME}`,
    html: baseLayout('Pago confirmado', content),
  };
}

// ─── TEMPLATE 3: Pedido Enviado (state 9) ───────────────────────────────

export function orderShippedEmail(orderId: string, productName: string, clientName?: string) {
  const greeting = clientName ? `Hola ${clientName},` : 'Hola,';
  const content = `
    <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">¡Tu pedido va en camino! 🚢</h2>
    <p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">
      ${greeting}
    </p>
    <p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">
      Tu pedido <strong>#${orderId}</strong>${productName ? ` (${productName})` : ''} ha sido enviado desde China 
      y está en camino hacia Venezuela. Te notificaremos cuando llegue.
    </p>
    <div style="text-align:center;margin:24px 0;">
      ${statusBadge('En Tránsito', '#3b82f6')}
    </div>
    <div style="background-color:#dbeafe;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;">
      <p style="margin:0;color:#1e40af;font-size:14px;">
        <strong>📦 En camino:</strong> Tu pedido está viajando de China a Venezuela. Puedes seguir el estado desde tu panel.
      </p>
    </div>
  `;
  return {
    subject: `🚢 Pedido enviado — Pedido #${orderId} | ${BRAND_NAME}`,
    html: baseLayout('Pedido enviado', content),
  };
}

// ─── TEMPLATE 4: Pedido Llegó a Venezuela (state 11) ────────────────────

export function orderArrivedVenezuelaEmail(orderId: string, productName: string, clientName?: string) {
  const greeting = clientName ? `Hola ${clientName},` : 'Hola,';
  const content = `
    <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">¡Tu pedido llegó a Venezuela! 🇻🇪</h2>
    <p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">
      ${greeting}
    </p>
    <p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">
      Tu pedido <strong>#${orderId}</strong>${productName ? ` (${productName})` : ''} ha sido recibido en nuestras 
      oficinas en Venezuela. Pronto estará listo para que lo retires o te lo hagamos llegar.
    </p>
    <div style="text-align:center;margin:24px 0;">
      ${statusBadge('Recibido en Venezuela', '#8b5cf6')}
    </div>
    <div style="background-color:#ede9fe;border-left:4px solid #8b5cf6;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;">
      <p style="margin:0;color:#5b21b6;font-size:14px;">
        <strong>🎉 ¡Casi listo!</strong> Te avisaremos cuando tu pedido esté disponible para retiro o entrega.
      </p>
    </div>
  `;
  return {
    subject: `🇻🇪 Pedido recibido en Venezuela — Pedido #${orderId} | ${BRAND_NAME}`,
    html: baseLayout('Pedido en Venezuela', content),
  };
}
