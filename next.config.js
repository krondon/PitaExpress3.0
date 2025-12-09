const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix for "inferred your workspace root" warning
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // NOTA: Para exportación estática, descomentar la siguiente línea
  // y comentar los redirects y otras funciones dinámicas
  // output: 'export',


  // Optimizaciones de imágenes
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // Permitir imágenes de Supabase Storage
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bgzsodcydkjqehjafbkv.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Optimizaciones de compilación
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Optimizaciones de webpack
  webpack: (config, { dev, isServer }) => {
    // Optimizaciones para producción
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            enforce: true,
          },
        },
      };
    }

    // Optimizar imports de iconos
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

  // Optimizaciones de headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },

  // Optimizaciones de redirección
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login-register',
        permanent: false,
      },
      // Temporal: si algún navegador tiene cacheado el 308 antiguo de '/' -> '/dashboard',
      // lo redirigimos aquí a '/login-register'. Quitar cuando todos los clientes hayan actualizado.
      {
        source: '/dashboard',
        destination: '/login-register',
        permanent: false,
      },
    ];
  },

  // Configuración de PWA (opcional)
  // pwa: {
  //   dest: 'public',
  //   register: true,
  //   skipWaiting: true,
  // },
};

module.exports = nextConfig;
