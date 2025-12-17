// Script temporal para verificar variables de entorno
require('dotenv').config({ path: '.env.local' });

console.log('\n🔍 Verificando variables de entorno...\n');

const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
];

let allGood = true;

requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
        console.log(`❌ ${varName}: NO ENCONTRADA`);
        allGood = false;
    } else {
        const preview = value.length > 50 ? value.slice(0, 50) + '...' : value;
        console.log(`✅ ${varName}: ${preview}`);
    }
});

console.log('\n' + (allGood ? '✨ Todas las variables configuradas correctamente!' : '⚠️  Algunas variables faltan. Revisa tu .env.local'));
console.log('\nRecuerda: Debes reiniciar el servidor después de cambiar .env.local\n');
