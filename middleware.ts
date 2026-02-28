import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Definición de rutas base por rol
const ROLE_BASE: Record<string, string> = {
  client: '/cliente',
  venezuela: '/venezuela',
  china: '/china',
  admin: '/admin',
  pagos: '/pagos'
};

// Prefijos permitidos por rol (puede ampliarse si hay subrutas)
const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  client: ['/cliente'],
  venezuela: ['/venezuela'],
  china: ['/china'],
  admin: ['/admin'],
  pagos: ['/pagos']
};

// Rutas públicas que no requieren autenticación / rol
const PUBLIC_PATHS = [
  '/login-register',
  // Ruta explícita para recibir links de restablecimiento/confirmación
  '/login-register/reset',
  // Callback de OAuth (Google, Facebook)
  '/auth/callback',
  '/manifest.json',
  '/api', // permitir APIs (ajustar si se requiere proteger algunas)
  '/videos',
  '/images',
  '/animations'
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(req: NextRequest) {
  // =============================================================
  // BYPASS TEMPORAL DE RESTRICCIONES (PRUEBAS)
  // Establece BYPASS_ALL = false para reactivar la lógica previa.
  // =============================================================
  const BYPASS_ALL = false; // Bypass desactivado: middleware de roles activo
  if (BYPASS_ALL) {
    return NextResponse.next(); // (Modo mantenimiento) - actualmente OFF
  }

  // --- LÓGICA ORIGINAL (INACTIVA MIENTRAS BYPASS_ALL = true) ---
  const { pathname } = req.nextUrl;

  // Permitir archivos estáticos y Next internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.match(/\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|mp4|json)$/)) {
    return NextResponse.next();
  }

  // Excluir cualquier ruta de API, incluso si va anidada (p.ej. /venezuela/.../api/...)
  if (pathname.includes('/api/')) {
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Permitir explícitamente los enlaces de restablecimiento/confirmación que
  // puedan incluir parámetros como access_token o type=recovery en la URL.
  // (El hash/fragment no llega al servidor; estos checks ayudan cuando el
  // proveedor añade query params o algunos clientes reenvían la petición.)
  const searchParams = req.nextUrl.searchParams;
  if (
    pathname === '/login-register/reset' ||
    pathname.startsWith('/login-register/reset') ||
    searchParams.has('access_token') ||
    searchParams.get('type') === 'recovery'
  ) {
    return NextResponse.next();
  }

  const roleCookie = req.cookies.get('role')?.value?.toLowerCase();

  // Si no hay cookie de rol -> redirigir a login
  if (!roleCookie) {
    const loginUrl = new URL('/login-register', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Normalización básica
  let normalized: string = roleCookie;
  if (['cliente', 'client'].includes(normalized)) normalized = 'client';
  else if (['vzla', 'venezuela'].includes(normalized)) normalized = 'venezuela';
  else if (['china'].includes(normalized)) normalized = 'china';
  else if (['admin', 'administrador', 'administrator'].includes(normalized)) normalized = 'admin';
  else if (['pagos', 'payments', 'payment', 'validador', 'validator', 'validador de pagos', 'payments validator'].includes(normalized)) normalized = 'pagos';

  const allowed = ROLE_ALLOWED_PREFIXES[normalized];

  if (!allowed) {
    // Rol desconocido -> limpiar y redirigir
    const loginUrl = new URL('/login-register', req.url);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('role');
    return res;
  }

  // Verificar si la ruta solicitada está bajo alguno de los prefijos permitidos
  const isAllowed = allowed.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
  if (!isAllowed) {
    // Redirigir a la base de su rol
    const base = ROLE_BASE[normalized] || '/login-register';
    const target = new URL(base, req.url);
    return NextResponse.redirect(target);
  }

  // Asegurarnos que la cookie esté normalizada (para consistencia)
  const res = NextResponse.next();
  if (roleCookie !== normalized) {
    res.cookies.set('role', normalized, { path: '/', maxAge: 60 * 60 * 12 }); // 12h
  }
  return res;
}

export const config = {
  matcher: [
    // Excluir top-level API y algunos internos de Next; lo demás pasa por el middleware
    '/((?!api|_next/static|_next/image|favicon.ico).*)'
  ]
};
