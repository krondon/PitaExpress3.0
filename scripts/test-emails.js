/**
 * Script de prueba para enviar los 4 tipos de email de notificación.
 *
 * Uso:
 *   node scripts/test-emails.js <email_destino>
 *
 * Ejemplo:
 *   node scripts/test-emails.js tucorreo@gmail.com
 *
 * Requisitos:
 *   - Variables de entorno RESEND_API_KEY y EMAIL_FROM configuradas
 *     (las lee desde .env.local automáticamente)
 */

const { Resend } = require('resend');
const path = require('path');
const fs = require('fs');

// ── Cargar .env.local manualmente ───────────────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) process.env[key] = value;
    }
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'info@pitacompra.com';

if (!RESEND_API_KEY) {
    console.error('❌ Falta RESEND_API_KEY en las variables de entorno o .env.local');
    process.exit(1);
}

const targetEmail = process.argv[2];
if (!targetEmail) {
    console.error('❌ Uso: node scripts/test-emails.js <email_destino>');
    console.error('   Ejemplo: node scripts/test-emails.js tucorreo@gmail.com');
    process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

// ── Templates (duplicados simplificados para el script standalone) ──────

const BRAND_COLOR = '#7f1f2b';
const BRAND_NAME = 'Pita Express';
const LOGO_URL = 'https://pitacompra.com/images/logos/pita_logo.png';

function baseLayout(title, content) {
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
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;text-align:center;">
              <img src="${LOGO_URL}" alt="${BRAND_NAME}" width="40" height="40" style="display:inline-block;vertical-align:middle;margin-right:12px;" />
              <span style="color:#ffffff;font-size:22px;font-weight:700;vertical-align:middle;">${BRAND_NAME}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#71717a;">
                Este es un correo automático de ${BRAND_NAME}. No responder a este mensaje.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">
                ⚠️ ESTE ES UN EMAIL DE PRUEBA — ${new Date().toISOString()}
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

function badge(text, color) {
    return `<span style="display:inline-block;padding:6px 16px;background-color:${color};color:#fff;border-radius:20px;font-size:14px;font-weight:600;">${text}</span>`;
}

const testEmails = [
    {
        name: 'Pedido Cotizado (state 3)',
        subject: '📋 [TEST] Cotización lista — Pedido #9999',
        html: baseLayout('Cotización lista', `
      <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">Tu cotización está lista 📋</h2>
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;">Hola Usuario de Prueba,</p>
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;">
        Tu pedido <strong>#9999</strong> (Producto de Prueba) ha sido cotizado exitosamente.
        Por favor, revisa la cotización y realiza el pago para continuar.
      </p>
      <div style="text-align:center;margin:24px 0;">${badge('Cotizado', '#f59e0b')}</div>
      <div style="background-color:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;">
        <p style="margin:0;color:#92400e;font-size:14px;">
          <strong>⏳ Acción requerida:</strong> Revisa tu cotización y realiza el pago desde tu panel.
        </p>
      </div>
    `),
    },
    {
        name: 'Pago Confirmado (state 5)',
        subject: '✅ [TEST] Pago confirmado — Pedido #9999',
        html: baseLayout('Pago confirmado', `
      <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">¡Pago confirmado! ✅</h2>
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;">Hola Usuario de Prueba,</p>
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;">
        El pago de tu pedido <strong>#9999</strong> (Producto de Prueba) ha sido validado y confirmado.
        Tu pedido está ahora listo para ser empaquetado.
      </p>
      <div style="text-align:center;margin:24px 0;">${badge('Pago Confirmado', '#22c55e')}</div>
      <div style="background-color:#dcfce7;border-left:4px solid #22c55e;padding:12px 16px;border-radius:0 8px 8px 0;">
        <p style="margin:0;color:#166534;font-size:14px;">
          <strong>✅ Todo en orden:</strong> Tu pedido pronto comenzará a ser procesado.
        </p>
      </div>
    `),
    },
    {
        name: 'Pedido Enviado (state 9)',
        subject: '🚢 [TEST] Pedido enviado — Pedido #9999',
        html: baseLayout('Pedido enviado', `
      <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">¡Tu pedido va en camino! 🚢</h2>
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;">Hola Usuario de Prueba,</p>
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;">
        Tu pedido <strong>#9999</strong> (Producto de Prueba) ha sido enviado desde China
        y está en camino hacia Venezuela.
      </p>
      <div style="text-align:center;margin:24px 0;">${badge('En Tránsito', '#3b82f6')}</div>
      <div style="background-color:#dbeafe;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;">
        <p style="margin:0;color:#1e40af;font-size:14px;">
          <strong>📦 En camino:</strong> Tu pedido está viajando de China a Venezuela.
        </p>
      </div>
    `),
    },
    {
        name: 'Llegó a Venezuela (state 11)',
        subject: '🇻🇪 [TEST] Pedido recibido en Venezuela — Pedido #9999',
        html: baseLayout('Pedido en Venezuela', `
      <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">¡Tu pedido llegó a Venezuela! 🇻🇪</h2>
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;">Hola Usuario de Prueba,</p>
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;">
        Tu pedido <strong>#9999</strong> (Producto de Prueba) ha sido recibido en nuestras
        oficinas en Venezuela. Pronto estará listo para retiro o entrega.
      </p>
      <div style="text-align:center;margin:24px 0;">${badge('Recibido en Venezuela', '#8b5cf6')}</div>
      <div style="background-color:#ede9fe;border-left:4px solid #8b5cf6;padding:12px 16px;border-radius:0 8px 8px 0;">
        <p style="margin:0;color:#5b21b6;font-size:14px;">
          <strong>🎉 ¡Casi listo!</strong> Te avisaremos cuando esté disponible para retiro o entrega.
        </p>
      </div>
    `),
    },
];

// ── Ejecución ───────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🧪 Test de Emails — PitaExpress`);
    console.log(`   Destino: ${targetEmail}`);
    console.log(`   From: ${EMAIL_FROM}`);
    console.log(`   Emails a enviar: ${testEmails.length}\n`);

    let success = 0;
    let failed = 0;

    for (const test of testEmails) {
        process.stdout.write(`   📧 ${test.name}... `);
        try {
            const { data, error } = await resend.emails.send({
                from: EMAIL_FROM,
                to: targetEmail,
                subject: test.subject,
                html: test.html,
            });

            if (error) {
                console.log(`❌ ${error.message}`);
                failed++;
            } else {
                console.log(`✅ (id: ${data?.id || 'ok'})`);
                success++;
            }
        } catch (err) {
            console.log(`❌ ${err.message}`);
            failed++;
        }

        // Pequeña pausa entre emails
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n📊 Resultado: ${success}/${testEmails.length} exitosos${failed ? `, ${failed} fallidos` : ''}\n`);

    if (failed > 0) {
        console.log('💡 Si ves errores de dominio, asegúrate de que pitacompra.com');
        console.log('   esté verificado en Resend (https://resend.com/domains)\n');
    }
}

main().catch(console.error);
