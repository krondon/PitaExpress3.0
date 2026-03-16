/**
 * Script para crear pedidos de prueba en estado de pago pendiente (state=4)
 * para probar la validación de pagos (aprobación, rechazo, deshacer).
 *
 * Uso:    node scripts/seed-test-payments.js [cantidad]
 * Ejemplo: node scripts/seed-test-payments.js 5
 *
 * Por defecto crea 3 pedidos.
 * Requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno desde .env.local (sin depender de dotenv)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan variables de entorno. Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Productos de ejemplo
const PRODUCTS = [
  { name: 'Auriculares Bluetooth TWS', desc: 'Auriculares inalámbricos con cancelación de ruido, estuche de carga', budget: 25.00, quote: 18.50 },
  { name: 'Funda Silicona iPhone 15', desc: 'Funda protectora transparente antishock para iPhone 15 Pro Max', budget: 8.00, quote: 4.20 },
  { name: 'Cargador USB-C 65W GaN', desc: 'Cargador rápido GaN con 3 puertos, compatible con laptop y teléfono', budget: 35.00, quote: 22.00 },
  { name: 'Lámpara LED Escritorio', desc: 'Lámpara plegable con control táctil, 3 niveles de brillo, puerto USB', budget: 15.00, quote: 9.80 },
  { name: 'Reloj Inteligente Sport', desc: 'Smartwatch con monitor cardíaco, resistente al agua IP68', budget: 45.00, quote: 32.50 },
  { name: 'Cable HDMI 2.1 4K 2m', desc: 'Cable HDMI de alta velocidad, 48Gbps, compatible con 8K', budget: 12.00, quote: 6.30 },
  { name: 'Mouse Ergonómico Vertical', desc: 'Mouse vertical inalámbrico 2.4G, recargable, 6 botones', budget: 20.00, quote: 11.00 },
  { name: 'Hub USB-C 7 en 1', desc: 'Adaptador multifunción con HDMI, SD, USB 3.0, PD 100W', budget: 30.00, quote: 19.50 },
];

async function getClientUserId() {
  // Buscar un usuario con rol Client en la BD
  const { data: userlevels, error } = await supabase
    .from('userlevel')
    .select('id, user_level')
    .eq('user_level', 'Client')
    .limit(5);

  if (error) {
    console.error('❌ Error buscando clientes:', error.message);
    return null;
  }

  if (!userlevels || userlevels.length === 0) {
    console.error('❌ No se encontró ningún usuario con rol Client.');
    console.error('   Ejecuta primero el seed de usuarios: node scripts/seed-remote.js');
    return null;
  }

  // Devolver todos los user IDs encontrados para distribuir los pedidos
  return userlevels.map(u => u.id);
}

async function seedTestPayments(count) {
  console.log('🧪 Seed de pedidos de prueba para validación de pagos\n');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log(`📦 Pedidos a crear: ${count}\n`);

  const clientIds = await getClientUserId();
  if (!clientIds) process.exit(1);

  console.log(`👥 Clientes encontrados: ${clientIds.length}`);

  const orders = [];
  for (let i = 0; i < count; i++) {
    const product = PRODUCTS[i % PRODUCTS.length];
    const clientId = clientIds[i % clientIds.length];

    orders.push({
      client_id: clientId,
      productName: product.name,
      description: product.desc,
      estimatedBudget: product.budget,
      totalQuote: product.quote,
      quantity: Math.floor(Math.random() * 5) + 1,
      state: 4, // Pendiente de pago — aparece en validación de pagos
      shippingType: 'air',
      deliveryType: 'office',
      sendChina: false,
      archived_by_client: false,
      archived_by_admin: false,
      pdfRoutes: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    });
  }

  console.log('\n📥 Insertando pedidos...\n');

  const { data, error } = await supabase
    .from('orders')
    .insert(orders)
    .select('id, productName, state, totalQuote');

  if (error) {
    console.error('❌ Error al insertar:', error.message);
    process.exit(1);
  }

  console.log('✅ Pedidos creados exitosamente:\n');
  console.log('┌──────┬────────────────────────────────────┬────────┬──────────┐');
  console.log('│  ID  │ Producto                           │ Estado │ Cotiz.   │');
  console.log('├──────┼────────────────────────────────────┼────────┼──────────┤');
  for (const order of data) {
    const id = String(order.id).padEnd(4);
    const name = (order.productName || '').slice(0, 34).padEnd(34);
    const state = String(order.state).padEnd(6);
    const quote = `$${Number(order.totalQuote).toFixed(2)}`.padEnd(8);
    console.log(`│ ${id} │ ${name} │ ${state} │ ${quote} │`);
  }
  console.log('└──────┴────────────────────────────────────┴────────┴──────────┘');

  console.log(`\n🎯 Ahora ve a /pagos/validacion-pagos o /admin/validacion-pagos para probar:`);
  console.log('   • Aprobar un pago → verificar botón "Deshacer" funciona (8s)');
  console.log('   • Rechazar un pago → verificar botón "Deshacer" funciona (8s)');

  console.log('\n💡 Para limpiar estos pedidos después:');
  const ids = data.map(o => o.id).join(', ');
  console.log(`   Ejecuta en SQL: DELETE FROM orders WHERE id IN (${ids});`);
}

// ─── Main ───
const count = parseInt(process.argv[2]) || 3;
seedTestPayments(count);
