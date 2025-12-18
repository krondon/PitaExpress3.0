#!/bin/bash

echo "🧹 Limpiando caché de Next.js..."
rm -rf .next

echo "🧹 Limpiando caché de node_modules..."
rm -rf node_modules/.cache

echo "📦 Reinstalando dependencias..."
npm install

echo "🏗️  Construyendo aplicación..."
npm run build

echo "✅ Build completado! Listo para deploy."
echo ""
echo "📝 Próximos pasos:"
echo "1. Hacer commit de los cambios"
echo "2. Push a tu repositorio"
echo "3. Vercel/Netlify detectará los cambios automáticamente"
echo ""
echo "💡 Si el problema persiste en producción:"
echo "   - Limpia el caché de Vercel/Netlify desde su dashboard"
echo "   - Haz un hard refresh en el navegador (Ctrl+Shift+R)"
