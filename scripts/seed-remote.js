/**
 * Script para ejecutar seed.sql en la base de datos remota de Supabase
 * Uso: node scripts/seed-remote.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runSeed() {
    console.log('🌱 Iniciando seed en base de datos remota...\n');

    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('❌ Error: Faltan variables de entorno');
        console.error('   Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
        process.exit(1);
    }

    console.log('✅ Variables de entorno encontradas');
    console.log(`📍 URL: ${supabaseUrl}\n`);

    // Crear cliente con service role
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // Leer archivo seed.sql
    const seedPath = path.join(__dirname, '../supabase/seed.sql');

    if (!fs.existsSync(seedPath)) {
        console.error('❌ Error: No se encontró el archivo seed.sql');
        console.error(`   Buscado en: ${seedPath}`);
        process.exit(1);
    }

    const seedSQL = fs.readFileSync(seedPath, 'utf-8');
    console.log('📄 Archivo seed.sql cargado');

    // Advertencia
    console.log('\n⚠️  ADVERTENCIA:');
    console.log('   Este script ejecutará TRUNCATE en auth.users');
    console.log('   Esto BORRARÁ TODOS LOS USUARIOS existentes.\n');

    console.log('   Continuando en 5 segundos...');
    console.log('   Presiona Ctrl+C para cancelar\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        console.log('🚀 Ejecutando seed SQL...');

        // Ejecutar el SQL
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: seedSQL
        });

        if (error) {
            console.error('❌ Error al ejecutar seed:', error);
            process.exit(1);
        }

        console.log('\n✅ Seed ejecutado exitosamente!\n');
        console.log('👥 Usuarios creados:');
        console.log('   • admin@gmail.com (Admin) - Contraseña: 12345678');
        console.log('   • china@gmail.com (China) - Contraseña: 12345678');
        console.log('   • venezuela@gmail.com (Vzla) - Contraseña: 12345678');
        console.log('   • validador@gmail.com (Pagos) - Contraseña: 12345678');
        console.log('   • cliente@gmail.com (Client) - Contraseña: 12345678\n');

    } catch (err) {
        console.error('❌ Error inesperado:', err);
        process.exit(1);
    }
}

runSeed();
