/**
 * Script de prueba para enviar un mensaje de WhatsApp vía Superapi.
 *
 * Uso:
 *   node scripts/test-whatsapp.js <numero_telefono>
 *
 * Ejemplo:
 *   node scripts/test-whatsapp.js 584121234567
 *
 * El número debe incluir código de país (58 para Venezuela) sin + ni espacios.
 */

const path = require('path');
const fs = require('fs');

// ── Cargar .env.local ───────────────────────────────────────────────────
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

const SUPERAPI_TOKEN = process.env.SUPERAPI_TOKEN;

if (!SUPERAPI_TOKEN) {
    console.error('❌ Falta SUPERAPI_TOKEN en las variables de entorno o .env.local');
    process.exit(1);
}

const phoneNumber = process.argv[2];
if (!phoneNumber) {
    console.error('❌ Uso: node scripts/test-whatsapp.js <numero_telefono>');
    console.error('   Ejemplo: node scripts/test-whatsapp.js 584121234567');
    process.exit(1);
}

// ── Mensajes de prueba ──────────────────────────────────────────────────

const testMessages = [
    {
        name: 'Pedido Cotizado (state 3)',
        message: `📋 *Cotización lista*\n\nTu pedido #9999 (Producto de Prueba) ha sido cotizado.\nPor favor, revisa la cotización y realiza el pago para continuar.\n\n⚠️ _ESTE ES UN MENSAJE DE PRUEBA_\n— Pita Express`,
    },
    {
        name: 'Pago Confirmado (state 5)',
        message: `✅ *¡Pago confirmado!*\n\nEl pago de tu pedido #9999 (Producto de Prueba) ha sido validado.\nTu pedido está listo para ser empaquetado.\n\n⚠️ _ESTE ES UN MENSAJE DE PRUEBA_\n— Pita Express`,
    },
    {
        name: 'Pedido Enviado (state 9)',
        message: `🚢 *Pedido enviado*\n\nTu pedido #9999 (Producto de Prueba) ya va en camino de China a Venezuela.\nTe avisaremos cuando llegue.\n\n⚠️ _ESTE ES UN MENSAJE DE PRUEBA_\n— Pita Express`,
    },
    {
        name: 'Llegó a Venezuela (state 11)',
        message: `🇻🇪 *¡Tu pedido llegó a Venezuela!*\n\nTu pedido #9999 (Producto de Prueba) ha sido recibido en nuestras oficinas.\nPronto estará listo para retiro o entrega.\n\n⚠️ _ESTE ES UN MENSAJE DE PRUEBA_\n— Pita Express`,
    },
];

// ── Ejecución ───────────────────────────────────────────────────────────

async function main() {
    const chatId = `${phoneNumber}@c.us`;

    console.log(`\n🧪 Test de WhatsApp — PitaExpress (Superapi)`);
    console.log(`   Destino: ${phoneNumber}`);
    console.log(`   ChatId: ${chatId}`);
    console.log(`   Mensajes a enviar: ${testMessages.length}\n`);

    let success = 0;
    let failed = 0;

    for (const test of testMessages) {
        process.stdout.write(`   📱 ${test.name}... `);
        try {
            const response = await fetch('https://v4.iasuperapi.com/api/v1/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPERAPI_TOKEN}`,
                },
                body: JSON.stringify({ chatId, message: test.message }),
            });

            const result = await response.json();

            if (result.statusCode === 200 || response.ok) {
                console.log(`✅`);
                success++;
            } else {
                console.log(`❌ ${JSON.stringify(result)}`);
                failed++;
            }
        } catch (err) {
            console.log(`❌ ${err.message}`);
            failed++;
        }

        // Pausa entre mensajes para no saturar
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n📊 Resultado: ${success}/${testMessages.length} exitosos${failed ? `, ${failed} fallidos` : ''}\n`);
}

main().catch(console.error);
