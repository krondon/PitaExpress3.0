/**
 * Plantillas de email por idioma (es, en, zh) para clientes.
 * Se usa preferred_language de userlevel.
 */

import type { ClientLanguage } from './email-templates';
import {
  orderQuotedEmail,
  paymentConfirmedEmail,
  orderShippedEmail,
  orderArrivedVenezuelaEmail,
  productAlternativeProposedEmail,
} from './email-templates';

export type { ClientLanguage } from './email-templates';

function withLang(lang: ClientLanguage) {
  if (lang === 'en' || lang === 'zh') {
    return lang;
  }
  return 'es';
}

/**
 * Devuelve { subject, html } para el estado del pedido en el idioma del cliente.
 */
export function getOrderStateEmailByLang(
  lang: ClientLanguage,
  state: 3 | 5 | 9 | 11,
  orderId: string,
  productName: string,
  clientName?: string
): { subject: string; html: string } {
  const L = withLang(lang);
  if (L === 'es') {
    switch (state) {
      case 3: return orderQuotedEmail(orderId, productName, clientName);
      case 5: return paymentConfirmedEmail(orderId, productName, clientName);
      case 9: return orderShippedEmail(orderId, productName, clientName);
      case 11: return orderArrivedVenezuelaEmail(orderId, productName, clientName);
    }
  }
  return getOrderStateEmailTranslated(L, state, orderId, productName, clientName);
}

/**
 * Devuelve { subject, html } para alternativa de producto en el idioma del cliente.
 */
export function getProductAlternativeEmailByLang(
  lang: ClientLanguage,
  orderId: string,
  originalProductName: string,
  alternativeProductName: string,
  clientName?: string
): { subject: string; html: string } {
  const L = withLang(lang);
  if (L === 'es') {
    return productAlternativeProposedEmail(orderId, originalProductName, alternativeProductName, clientName);
  }
  return getProductAlternativeEmailTranslated(L, orderId, originalProductName, alternativeProductName, clientName);
}

const BRAND_NAME = 'Pita Express';
/** Header claro para que el logo se distinga; texto oscuro (paleta slate de la app) */
const HEADER_BG = '#e2e8f0';
const HEADER_TEXT = '#1e293b';
const LOGO_URL = 'https://pitacompra.com/images/logos/pita_logo.png';

function baseLayout(title: string, content: string, footerLine1: string, footerLine2: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background-color:${HEADER_BG};padding:24px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="${BRAND_NAME}" width="40" height="40" style="display:inline-block;vertical-align:middle;margin-right:12px;" />
          <span style="color:${HEADER_TEXT};font-size:22px;font-weight:700;">${BRAND_NAME}</span>
        </td></tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr><td style="padding:20px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
          <p style="margin:0;font-size:12px;color:#71717a;">${footerLine1}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">${footerLine2}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function badge(text: string, color: string): string {
  return `<span style="display:inline-block;padding:6px 16px;background-color:${color};color:#fff;border-radius:20px;font-size:14px;font-weight:600;">${text}</span>`;
}

type LangKey = 'en' | 'zh';

const T = {
  en: {
    footer: ['This is an automated email from ' + BRAND_NAME + '. Do not reply.', '© ' + new Date().getFullYear() + ' ' + BRAND_NAME + '. All rights reserved.'],
    quoted: { title: 'Your quote is ready', greeting: 'Hello', greetingName: (n: string) => `Hello ${n},`, body: (id: string, p: string) => `Your order <strong>#${id}</strong>${p ? ` (${p})` : ''} has been successfully quoted. Please review the quote and make the payment so we can continue processing.`, badge: 'Quoted', action: 'Action required: Review your quote and make the payment from your client panel.' },
    payment: { title: 'Payment confirmed!', body: (id: string, p: string) => `The payment for your order <strong>#${id}</strong>${p ? ` (${p})` : ''} has been validated and confirmed. Your order is now ready to be packed and processed.`, badge: 'Payment Confirmed', note: 'All set: Your order will soon be processed. We will notify you when it is shipped.' },
    shipped: { title: 'Your order is on the way!', body: (id: string, p: string) => `Your order <strong>#${id}</strong>${p ? ` (${p})` : ''} has been shipped from China and is on its way to Venezuela. We will notify you when it arrives.`, badge: 'In Transit', note: 'On the way: Your order is traveling from China to Venezuela. You can track status from your panel.' },
    arrived: { title: 'Your order has arrived in Venezuela!', body: (id: string, p: string) => `Your order <strong>#${id}</strong>${p ? ` (${p})` : ''} has been received at our offices in Venezuela. It will soon be ready for pickup or delivery.`, badge: 'Received in Venezuela', note: 'Almost there! We will let you know when your order is available for pickup or delivery.' },
    alternative: { title: 'New alternative for your order', body: (id: string, orig: string) => `For your order <strong>#${id}</strong>${orig ? ` (${orig})` : ''} the exact product was not found. Our team in China suggests the following alternative:`, action: 'Action required: Go to your client panel, review the proposed alternative and accept or reject it. If you accept, we will continue with that product.' },
    subjects: { quoted: (id: string) => `Quote ready — Order #${id} | ${BRAND_NAME}`, payment: (id: string) => `Payment confirmed — Order #${id} | ${BRAND_NAME}`, shipped: (id: string) => `Order shipped — Order #${id} | ${BRAND_NAME}`, arrived: (id: string) => `Order received in Venezuela — Order #${id} | ${BRAND_NAME}`, alternative: (id: string) => `Product alternative — Order #${id} | ${BRAND_NAME}` },
  },
  zh: {
    footer: ['这是' + BRAND_NAME + '的自动邮件。请勿直接回复。', '© ' + new Date().getFullYear() + ' ' + BRAND_NAME + '。保留所有权利。'],
    quoted: { title: '您的报价已就绪', greeting: '您好', greetingName: (n: string) => `${n}，您好：`, body: (id: string, p: string) => `您的订单 <strong>#${id}</strong>${p ? `（${p}）` : ''} 已成功报价。请查看报价并付款以便我们继续处理。`, badge: '已报价', action: '请操作：在客户面板中查看报价并完成付款。' },
    payment: { title: '付款已确认！', body: (id: string, p: string) => `您的订单 <strong>#${id}</strong>${p ? `（${p}）` : ''} 的付款已核实并确认。您的订单现已准备打包处理。`, badge: '付款已确认', note: '一切就绪：您的订单将很快处理。发货时我们会通知您。' },
    shipped: { title: '您的订单正在路上！', body: (id: string, p: string) => `您的订单 <strong>#${id}</strong>${p ? `（${p}）` : ''} 已从中国发出，正在运往委内瑞拉。到达后我们会通知您。`, badge: '运输中', note: '运输中：您的订单正从中国运往委内瑞拉。您可以在面板中查看状态。' },
    arrived: { title: '您的订单已到达委内瑞拉！', body: (id: string, p: string) => `您的订单 <strong>#${id}</strong>${p ? `（${p}）` : ''} 已在我们委内瑞拉办事处签收。即将可以自提或配送。`, badge: '已到达委内瑞拉', note: '即将完成！订单可自提或配送时我们会通知您。' },
    alternative: { title: '您订单的新替代方案', body: (id: string, orig: string) => `您的订单 <strong>#${id}</strong>${orig ? `（${orig}）` : ''} 未找到完全相同的商品。中国团队建议以下替代品：`, action: '请操作：进入客户面板查看替代方案并接受或拒绝。若接受，我们将按该商品继续处理。' },
    subjects: { quoted: (id: string) => `报价就绪 — 订单 #${id} | ${BRAND_NAME}`, payment: (id: string) => `付款已确认 — 订单 #${id} | ${BRAND_NAME}`, shipped: (id: string) => `订单已发货 — 订单 #${id} | ${BRAND_NAME}`, arrived: (id: string) => `订单已到委内瑞拉 — 订单 #${id} | ${BRAND_NAME}`, alternative: (id: string) => `商品替代方案 — 订单 #${id} | ${BRAND_NAME}` },
  },
};

function getOrderStateEmailTranslated(
  L: LangKey,
  state: 3 | 5 | 9 | 11,
  orderId: string,
  productName: string,
  clientName?: string
): { subject: string; html: string } {
  const t = T[L];
  const greeting = clientName ? t.quoted.greetingName(clientName) : t.quoted.greeting + ',';
  const [footer1, footer2] = t.footer;

  if (state === 3) {
    const content = `<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">${t.quoted.title} 📋</h2><p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">${greeting}</p><p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">${t.quoted.body(orderId, productName)}</p><div style="text-align:center;margin:24px 0;">${badge(t.quoted.badge, '#f59e0b')}</div><div style="background-color:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;"><p style="margin:0;color:#92400e;font-size:14px;"><strong>⏳</strong> ${t.quoted.action}</p></div>`;
    return { subject: t.subjects.quoted(orderId), html: baseLayout(t.quoted.title, content, footer1, footer2) };
  }
  if (state === 5) {
    const content = `<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">${t.payment.title} ✅</h2><p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">${greeting}</p><p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">${t.payment.body(orderId, productName)}</p><div style="text-align:center;margin:24px 0;">${badge(t.payment.badge, '#22c55e')}</div><div style="background-color:#dcfce7;border-left:4px solid #22c55e;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;"><p style="margin:0;color:#166534;font-size:14px;"><strong>✅</strong> ${t.payment.note}</p></div>`;
    return { subject: t.subjects.payment(orderId), html: baseLayout(t.payment.title, content, footer1, footer2) };
  }
  if (state === 9) {
    const content = `<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">${t.shipped.title} 🚢</h2><p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">${greeting}</p><p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">${t.shipped.body(orderId, productName)}</p><div style="text-align:center;margin:24px 0;">${badge(t.shipped.badge, '#3b82f6')}</div><div style="background-color:#dbeafe;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;"><p style="margin:0;color:#1e40af;font-size:14px;"><strong>📦</strong> ${t.shipped.note}</p></div>`;
    return { subject: t.subjects.shipped(orderId), html: baseLayout(t.shipped.title, content, footer1, footer2) };
  }
  const content = `<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">${t.arrived.title} 🇻🇪</h2><p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">${greeting}</p><p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">${t.arrived.body(orderId, productName)}</p><div style="text-align:center;margin:24px 0;">${badge(t.arrived.badge, '#8b5cf6')}</div><div style="background-color:#ede9fe;border-left:4px solid #8b5cf6;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;"><p style="margin:0;color:#5b21b6;font-size:14px;"><strong>🎉</strong> ${t.arrived.note}</p></div>`;
  return { subject: t.subjects.arrived(orderId), html: baseLayout(t.arrived.title, content, footer1, footer2) };
}

function getProductAlternativeEmailTranslated(
  L: LangKey,
  orderId: string,
  originalProductName: string,
  alternativeProductName: string,
  clientName?: string
): { subject: string; html: string } {
  const t = T[L];
  const greeting = clientName ? t.quoted.greetingName(clientName) : t.quoted.greeting + ',';
  const [footer1, footer2] = t.footer;
  const content = `<h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">${t.alternative.title} 🔄</h2><p style="margin:0 0 12px;color:#3f3f46;font-size:15px;line-height:1.6;">${greeting}</p><p style="margin:0 0 20px;color:#3f3f46;font-size:15px;line-height:1.6;">${t.alternative.body(orderId, originalProductName)}</p><div style="text-align:center;margin:24px 0;">${badge(alternativeProductName, '#8b5cf6')}</div><div style="background-color:#ede9fe;border-left:4px solid #8b5cf6;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;"><p style="margin:0;color:#5b21b6;font-size:14px;"><strong>⏳</strong> ${t.alternative.action}</p></div>`;
  return { subject: t.subjects.alternative(orderId), html: baseLayout(t.alternative.title, content, footer1, footer2) };
}
