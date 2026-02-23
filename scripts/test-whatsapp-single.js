/**
 * Test aislado para el message de state 3 solamente.
 * Uso: node scripts/test-whatsapp-single.js 584123759190
 */

const path = require('path');
const fs = require('fs');

// Cargar .env.local
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
const phone = process.argv[2] || '584123759190';
const chatId = `${phone}@c.us`;

const message = `📋 *Cotización lista*\n\nTu pedido #9999 (Producto de Prueba) ha sido cotizado.\nPor favor, revisa la cotización y realiza el pago para continuar.\n\n⚠️ _ESTE ES UN MENSAJE DE PRUEBA_\n— Pita Express`;

async function main() {
    console.log('Token:', SUPERAPI_TOKEN ? `${SUPERAPI_TOKEN.slice(0, 20)}...` : 'NO SET');
    console.log('ChatId:', chatId);
    console.log('URL:', 'https://v4.iasuperapi.com/api/v1/send-message');
    console.log('Body:', JSON.stringify({ chatId, message }, null, 2));
    console.log('\nEnviando...\n');

    try {
        const response = await fetch('https://v4.iasuperapi.com/api/v1/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPERAPI_TOKEN}`,
            },
            body: JSON.stringify({ chatId, message }),
        });

        console.log('HTTP Status:', response.status);
        console.log('HTTP StatusText:', response.statusText);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));

        const text = await response.text();
        console.log('\nResponse body:', text);

        try {
            const json = JSON.parse(text);
            console.log('\nParsed JSON:', JSON.stringify(json, null, 2));
        } catch {
            console.log('(No es JSON válido)');
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error('Cause:', err.cause);
        console.error('Stack:', err.stack);
    }
}

main();
