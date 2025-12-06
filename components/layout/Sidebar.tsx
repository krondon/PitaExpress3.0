"use client";

import { useState, useEffect, useMemo, useCallback, useDeferredValue, memo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  Package,
  MessageCircle,
  Settings,
  LogOut,
  Users,
  BarChart3,
  CreditCard,
  Shield,
  BadgeDollarSign,
  Boxes,
  MessageSquare
} from 'lucide-react';
import VenezuelaFlag from '@/components/ui/common/VenezuelaFlag';
import PitaLogo from '@/components/ui/common/PitaLogo';
import { Badge } from '@/components/ui/badge';
import { useClientContext } from '@/lib/ClientContext';
import { useVzlaContext } from '@/lib/VzlaContext';
import { useChinaContext } from '@/lib/ChinaContext';
import { useAdminContext } from '@/lib/AdminContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRealtimePagosPending } from '@/hooks/use-realtime-pagos-pending';

// Importar hooks de realtime
import { useRealtimeAdmin } from '@/hooks/use-realtime-admin';
import { useRealtimeChina } from '@/hooks/use-realtime-china';
import { useRealtimeVzla } from '@/hooks/use-realtime-vzla';
import { useRealtimeVzlaPayments } from '@/hooks/use-realtime-vzla-payments';
import { useRealtimeVzlaBoxesContainers } from '@/hooks/use-realtime-vzla-boxes-containers';

// Safe context hooks that don't throw errors

const useSafeClientContext = () => {
  try {
    return useClientContext();
  } catch {
    return null;
  }
};

const useSafeChinaContext = () => {
  try {
    return useChinaContext();
  } catch {
    return null;
  }
};

const useSafeAdminContext = () => {
  try {
    return useAdminContext();
  } catch {
    return null;
  }
};

// Hook seguro para Venezuela: llama siempre useVzlaContext, retorna null si no hay provider
const useSafeVzlaContext = () => {
  try {
    return useVzlaContext();
  } catch {
    return null;
  }
};

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  isMobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
  userRole?: 'client' | 'venezuela' | 'china' | 'pagos' | 'admin';
}

// Menús específicos para cada rol
const CLIENT_MENU_ITEMS = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    badge: null,
    color: 'text-orange-500',
    path: '/cliente'
  },
  {
    id: 'orders',
    icon: Package,
    badge: null,
    color: 'text-orange-500',
    path: '/cliente/mis-pedidos'
  }
];

const VENEZUELA_MENU_ITEMS = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    badge: null,
    color: 'text-orange-500',
    path: '/venezuela'
  },
  {
    id: 'orders',
    icon: Package,
    badge: null,
    color: 'text-orange-500',
    path: '/venezuela/pedidos'
  }
];

const CHINA_MENU_ITEMS = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    badge: null,
    color: 'text-orange-500',
    path: '/china'
  },
  {
    id: 'orders',
    icon: Package,
    badge: null,
    color: 'text-orange-500',
    path: '/china/pedidos'
  },
  {
    id: 'chat',
    icon: MessageSquare,
    badge: null,
    color: 'text-orange-500',
    path: '/china/chat'
  }
];


// El badge de pagos se maneja en tiempo real, pero ahora es una función pura
const getPagosMenuItems = (pending: number | null) => [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    badge: null,
    color: 'text-orange-500',
    path: '/pagos'
  },
  {
    id: 'payments-validation',
    icon: Package,
    badge: typeof pending === 'number' && pending > 0 ? pending : null,
    color: 'text-orange-500',
    path: '/pagos/validacion-pagos'
  }
];

const getAdminMenuItems = (t: (key: string) => string) => [
  {
    id: 'dashboard',
    label: t && typeof t === 'function' ? t('sidebar.dashboard') : 'Dashboard',
    icon: LayoutDashboard,
    badge: null,
    color: 'text-orange-500',
    path: '/admin'
  },
  {
    id: 'usuarios',
    label: t && typeof t === 'function' ? t('sidebar.users') : 'Usuarios',
    icon: Users,
    badge: null,
    color: 'text-orange-500',
    path: '/admin/usuarios'
  },
  {
    id: 'pedidos',
    label: t && typeof t === 'function' ? t('sidebar.orders') : 'Pedidos',
    icon: Package,
    badge: null,
    color: 'text-orange-500',
    path: '/admin/pedidos'
  },
  {
    id: 'payments-validation',
    label: t && typeof t === 'function' ? t('sidebar.payments-validation') : 'Validación de pagos',
    icon: BadgeDollarSign,
    badge: null,
    color: 'text-orange-500',
    path: '/admin/validacion-pagos'
  },
  {
    id: 'chat',
    label: t && typeof t === 'function' ? t('sidebar.chat') : 'Chat',
    icon: MessageSquare,
    badge: null,
    color: 'text-orange-500',
    path: '/admin/chat'
  },
  {
    id: 'gestion',
    label: t && typeof t === 'function' ? t('sidebar.management') : 'Gestión',
    icon: Settings,
    badge: null,
    color: 'text-orange-500',
    path: '/admin/gestion'
  }
];

// Función para obtener los items del bottom según el rol
const getBottomItemsByRole = (role?: string) => {
  const basePath = role === 'admin' ? '/admin' :
    role === 'venezuela' ? '/venezuela' :
      role === 'china' ? '/china' :
        role === 'pagos' ? '/pagos' :
          '/cliente';

  return [
    {
      id: 'settings',
      icon: Settings,
      color: 'text-orange-500',
      path: `${basePath}/configuracion`
    }
  ];
};

// Función para obtener el menú según el rol
const getMenuItemsByRole = (role?: string, t?: (key: string) => string, pagosPending?: number | null) => {
  switch (role) {
    case 'venezuela':
      return VENEZUELA_MENU_ITEMS;
    case 'china':
      return CHINA_MENU_ITEMS;
    case 'pagos':
      return getPagosMenuItems(pagosPending ?? null);
    case 'admin':
      return getAdminMenuItems(t!);
    default:
      return CLIENT_MENU_ITEMS;
  }
};

// Función para obtener información del usuario según el rol
const getUserInfoByRole = (role?: string) => {
  switch (role) {
    case 'venezuela':
      return {
        name: 'Empleado Venezuela',
        email: 'venezuela@morna.com',
        flag: '🇻🇪'
      };
    case 'china':
      return {
        name: 'Empleado China',
        email: 'china@morna.com',
        flag: '🇨🇳'
      };
    case 'pagos':
      return {
        name: 'Validador Pagos',
        email: 'pagos@morna.com',
        flag: '💳'
      };
    case 'admin':
      return {
        name: 'Administrador',
        email: 'admin@morna.com',
        flag: '👑'
      };
    default:
      return {
        name: 'Cliente',
        email: 'cliente@morna.com',
        flag: '🇻🇪'
      };
  }
};

// Hook personalizado para detectar el tamaño de pantalla
const useScreenSize = () => {
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth);
    };

    updateScreenWidth();
    window.addEventListener('resize', updateScreenWidth);
    return () => window.removeEventListener('resize', updateScreenWidth);
  }, []);

  return screenWidth;
};

// Hook personalizado para detectar la página activa
const useActivePage = (menuItems: any[], userRole?: string, pathname?: string) => {
  return useMemo(() => {
    if (!pathname) return 'dashboard';
    const currentItem = menuItems.find(item => item.path === pathname);
    const bottomItems = getBottomItemsByRole(userRole);
    const currentBottomItem = bottomItems.find(item => item.path === pathname);
    return currentItem?.id || currentBottomItem?.id || 'dashboard';
  }, [pathname, menuItems, userRole]);
};

// Item de menú memoizado para reducir rerenders (especialmente en mobile)
const SidebarMenuItem = memo(function SidebarMenuItem({
  item,
  isActive,
  responsiveConfig,
  isMobileMenuOpen,
  isExpanded,
  screenWidth,
  t,
  disablePrefetch
}: any) {
  const Icon = item.icon;
  return (
    <div key={item.id}>
      <Link
        href={item.path}
        prefetch={disablePrefetch ? false : true}
        className={`
            w-full flex items-center ${(responsiveConfig.isMobile || responsiveConfig.isTablet) ? (isMobileMenuOpen ? 'space-x-3 px-4 py-3' : `justify-center ${responsiveConfig.buttonPadding}`) : (isExpanded ? 'space-x-3 px-4 py-3' : `justify-center ${responsiveConfig.buttonPadding}`)} rounded-xl
            transition-all duration-120 ease-out group relative
            active:scale-95 will-change-transform
            ${isActive
            ? 'bg-gradient-to-r from-blue-600/25 to-indigo-600/25 text-white shadow-md border border-blue-500/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
          }
          `}
      >
        {/* Indicador activo */}
        <div className={`
          absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full
          transition-all duration-150 ease-out will-change-transform
          ${isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0'}
        `} />

        <div className={`${responsiveConfig.iconContainerSize} flex items-center justify-center rounded-lg`}>
          <Icon
            className={`${responsiveConfig.iconSize} ${item.color} transition-all duration-150 ease-out ${isActive ? 'scale-105' : 'scale-100'}`}
          />
        </div>
        <div className={`
          transition-all duration-150 ease-out overflow-hidden will-change-auto
          ${responsiveConfig.isMobile ? (isMobileMenuOpen ? 'w-auto opacity-100' : 'w-0 opacity-0') : (isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0')}
        `}>
          <div className="flex items-center justify-between whitespace-nowrap">
            <span suppressHydrationWarning className={`font-medium ${responsiveConfig.textSize}`}>{t('sidebar.' + item.id) ?? item.id}</span>
            {typeof item.badge === 'number' && item.badge > 0 ? (
              <Badge className={`bg-red-500 text-white ${responsiveConfig.badgeSize}`}>
                {item.badge}
              </Badge>
            ) : null}
          </div>
        </div>
        {!responsiveConfig.isMobile && !responsiveConfig.isTablet && !isExpanded && typeof item.badge === 'number' && item.badge > 0 ? (
          <div className={`absolute top-1 right-1 ${screenWidth < 1366 ? 'w-4 h-4' : 'w-5 h-5'} bg-red-500 rounded-full flex items-center justify-center`}>
            <span className={`${responsiveConfig.badgeSize} text-white font-bold`}>{item.badge}</span>
          </div>
        ) : null}
      </Link>
    </div>
  );
});


export default function Sidebar({ isExpanded, setIsExpanded, isMobileMenuOpen = false, onMobileMenuClose, userRole = 'client' }: SidebarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const screenWidth = useScreenSize();

  // Llamar todos los hooks de contexto y realtime al inicio (sin try/catch)
  const clientCtx = useSafeClientContext();
  const vzlaCtx = useSafeVzlaContext();
  const chinaCtx = useSafeChinaContext();
  const adminCtx = useSafeAdminContext();
  const pagosPending = useRealtimePagosPending();

  // Eliminado manejo de localStorage para currentUserId. Esto debe hacerse al iniciar sesión, no aquí.

  // Ahora obtenemos el menú pasando el pending de pagos si aplica
  const menuItems = getMenuItemsByRole(userRole, t, pagosPending);

  // === Dynamic badge states (declare early to be used by realtime effects) ===
  const [clientActiveOrders, setClientActiveOrders] = useState<number | null>(null);
  const [clientPendingPayments, setClientPendingPayments] = useState<number | null>(null);
  const [vzlaActiveOrders, setVzlaActiveOrders] = useState<number | null>(null);
  const [vzlaActiveSupports, setVzlaActiveSupports] = useState<number | null>(null);
  const [vzlaPendingPayments, setVzlaPendingPayments] = useState<number | null>(null);
  const [chinaActiveOrders, setChinaActiveOrders] = useState<number | null>(null);
  const [imageError, setImageError] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  // Helper: refetch China active orders
  const refetchChinaActiveOrders = useCallback(async () => {
    if (userRole !== 'china' || !chinaCtx?.chinaId) return;
    const supabase = getSupabaseBrowserClient();
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('asignedEChina', chinaCtx.chinaId)
      .lt('state', 13);
    if (!error && typeof count === 'number') {
      setChinaActiveOrders(count);
    }
  }, [userRole, chinaCtx?.chinaId]);

  // Helpers: refetch Venezuela counters robustly across possible assignment columns
  const refetchVzlaActiveOrders = useCallback(async () => {
    if (userRole !== 'venezuela' || !vzlaCtx?.vzlaId) return;
    const supabase = getSupabaseBrowserClient();
    const assignmentColumns = ['asignedEVzla', 'asignnedEVzla', 'asigned'];
    for (const col of assignmentColumns) {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq(col, vzlaCtx.vzlaId)
        .lt('state', 13);
      if (!error && typeof count === 'number') {
        setVzlaActiveOrders(count);
        return;
      }
    }
    // If all variants fail, default to 0
    setVzlaActiveOrders(0);
  }, [userRole, vzlaCtx?.vzlaId]);

  const refetchVzlaPendingPayments = useCallback(async () => {
    if (userRole !== 'venezuela' || !vzlaCtx?.vzlaId) return;
    const supabase = getSupabaseBrowserClient();
    const assignmentColumns = ['asignedEVzla', 'asignnedEVzla', 'asigned'];
    for (const col of assignmentColumns) {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq(col, vzlaCtx.vzlaId)
        .eq('state', 4);
      if (!error && typeof count === 'number') {
        setVzlaPendingPayments(count);
        return;
      }
    }
    setVzlaPendingPayments(0);
  }, [userRole, vzlaCtx?.vzlaId]);

  // Get dynamic user info from context if available
  let userInfo: { name: string; email: string; flag?: string; userImage?: string } = getUserInfoByRole(userRole);

  if (userRole === 'client' && clientCtx) {
    if (clientCtx.clientName || clientCtx.clientEmail) {
      userInfo = {
        name: clientCtx.clientName || userInfo.name,
        email: clientCtx.clientEmail || userInfo.email,
        flag: userInfo.flag,
        userImage: clientCtx.userImage
      };
    }
  } else if (userRole === 'venezuela' && vzlaCtx) {
    if (vzlaCtx.vzlaName || vzlaCtx.vzlaEmail) {
      userInfo = {
        name: vzlaCtx.vzlaName || userInfo.name,
        email: vzlaCtx.vzlaEmail || userInfo.email,
        flag: userInfo.flag,
        userImage: vzlaCtx.userImage
      };
    }
  } else if (userRole === 'china' && chinaCtx) {
    if (chinaCtx.chinaName || chinaCtx.chinaEmail) {
      userInfo = {
        name: chinaCtx.chinaName || userInfo.name,
        email: chinaCtx.chinaEmail || userInfo.email,
        flag: userInfo.flag,
        userImage: chinaCtx.userImage
      };
    }
  } else if (userRole === 'admin' && adminCtx) {
    if (adminCtx.adminName || adminCtx.adminEmail) {
      userInfo = {
        name: adminCtx.adminName || userInfo.name,
        email: adminCtx.adminEmail || userInfo.email,
        flag: userInfo.flag,
        userImage: adminCtx.userImage
      };
    }
  }

  // Reset image error when user info changes
  useEffect(() => {
    setImageError(false);
    // Forzar recarga limpiando cache de imagen
    if (userInfo.userImage) {
      const preloadImg = new window.Image();
      preloadImg.src = `${userInfo.userImage}?t=${Date.now()}`;
    }
  }, [userInfo.userImage]);

  // === Realtime hooks for dynamic updates ===

  // Admin realtime
  useRealtimeAdmin(
    () => {
      // Orders update callback
      if (userRole === 'admin') {
        // Refetch admin orders count
        const fetchAdminOrders = async () => {
          const supabase = getSupabaseBrowserClient();
          const { count, error } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .lt('state', 13);
          if (!error && typeof count === 'number') {
            // Update admin orders badge logic here
          }
        };
        fetchAdminOrders();
      }
    },
    () => {
      // Users update callback - for profile updates including images
      if (userRole === 'admin' && adminCtx?.adminId) {
        const fetchAdminProfile = async () => {
          const supabase = getSupabaseBrowserClient();
          const { data, error } = await supabase
            .from('users')
            .select('name, email, image_url')
            .eq('id', adminCtx.adminId)
            .single();
          if (!error && data) {
            // Update context with new profile data
            adminCtx.setAdmin({
              adminName: data.name,
              adminEmail: data.email,
              userImage: data.image_url
            });
          }
        };
        fetchAdminProfile();
      }
    },
    () => {
      // Alerts update callback
      if (userRole === 'admin') {
        // Refetch admin alerts count
      }
    }
  );

  // China realtime
  useRealtimeChina(
    () => {
      // Orders update callback for China
      refetchChinaActiveOrders();
    },
    chinaCtx?.chinaId
  );

  // Polling fallback for China active orders
  useEffect(() => {
    if (userRole !== 'china' || !chinaCtx?.chinaId) return;
    const id = window.setInterval(() => {
      refetchChinaActiveOrders();
    }, 10000); // 10s
    return () => window.clearInterval(id);
  }, [userRole, chinaCtx?.chinaId, refetchChinaActiveOrders]);

  // China profile realtime
  useEffect(() => {
    if (userRole !== 'china' || !chinaCtx?.chinaId) return;

    const supabase = getSupabaseBrowserClient();
    const profileChannel = supabase
      .channel(`china-profile-${chinaCtx.chinaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${chinaCtx.chinaId}`,
        },
        () => {
          // Refetch china profile
          const fetchChinaProfile = async () => {
            const { data, error } = await supabase
              .from('users')
              .select('name, email, image_url')
              .eq('id', chinaCtx.chinaId)
              .single();
            if (!error && data) {
              chinaCtx.setChina({
                chinaName: data.name,
                chinaEmail: data.email,
                userImage: data.image_url
              });
            }
          };
          fetchChinaProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [userRole, chinaCtx?.chinaId]);

  // Venezuela realtime
  useRealtimeVzla(
    () => {
      refetchVzlaActiveOrders();
    },
    vzlaCtx?.vzlaId
  );

  // Venezuela payments realtime
  useRealtimeVzlaPayments(
    () => {
      refetchVzlaPendingPayments();
    },
    vzlaCtx?.vzlaId
  );

  // Polling fallback for Venezuela counters
  useEffect(() => {
    if (userRole !== 'venezuela' || !vzlaCtx?.vzlaId) return;
    const id = window.setInterval(() => {
      refetchVzlaActiveOrders();
      refetchVzlaPendingPayments();
    }, 10000); // 10s
    return () => window.clearInterval(id);
  }, [userRole, vzlaCtx?.vzlaId, refetchVzlaActiveOrders, refetchVzlaPendingPayments]);

  // Venezuela profile realtime
  useEffect(() => {
    if (userRole !== 'venezuela' || !vzlaCtx?.vzlaId) return;

    const supabase = getSupabaseBrowserClient();
    const profileChannel = supabase
      .channel(`vzla-profile-${vzlaCtx.vzlaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${vzlaCtx.vzlaId}`,
        },
        () => {
          // Refetch vzla profile
          const fetchVzlaProfile = async () => {
            const { data, error } = await supabase
              .from('users')
              .select('name, email, image_url')
              .eq('id', vzlaCtx.vzlaId)
              .single();
            if (!error && data) {
              vzlaCtx.setVzla({
                vzlaName: data.name,
                vzlaEmail: data.email,
                userImage: data.image_url
              });
            }
          };
          fetchVzlaProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [userRole, vzlaCtx?.vzlaId]);

  // Venezuela boxes/containers realtime for support
  useRealtimeVzlaBoxesContainers(
    () => {
      // Boxes update - could affect support tickets
      if (userRole === 'venezuela' && vzlaCtx?.vzlaId) {
        const fetchVzlaActiveSupports = async () => {
          try {
            const supabase = getSupabaseBrowserClient();
            const { count, error } = await supabase
              .from('support_tickets')
              .select('id', { count: 'exact', head: true })
              .eq('asignedEVzla', vzlaCtx.vzlaId)
              .eq('status', 'active');
            if (!error && typeof count === 'number') {
              setVzlaActiveSupports(count);
            } else {
              console.warn('⚠️ Sidebar: support_tickets table not available or error:', error);
              setVzlaActiveSupports(0); // Default to 0 if table doesn't exist
            }
          } catch (err) {
            console.warn('⚠️ Sidebar: Error fetching support tickets:', err);
            setVzlaActiveSupports(0);
          }
        };
        fetchVzlaActiveSupports();
      }
    },
    () => {
      // Containers update - could affect support tickets
      if (userRole === 'venezuela' && vzlaCtx?.vzlaId) {
        const fetchVzlaActiveSupports = async () => {
          try {
            const supabase = getSupabaseBrowserClient();
            const { count, error } = await supabase
              .from('support_tickets')
              .select('id', { count: 'exact', head: true })
              .eq('asignedEVzla', vzlaCtx.vzlaId)
              .eq('status', 'active');
            if (!error && typeof count === 'number') {
              setVzlaActiveSupports(count);
            } else {
              console.warn('⚠️ Sidebar: support_tickets table not available or error:', error);
              setVzlaActiveSupports(0); // Default to 0 if table doesn't exist
            }
          } catch (err) {
            console.warn('⚠️ Sidebar: Error fetching support tickets:', err);
            setVzlaActiveSupports(0);
          }
        };
        fetchVzlaActiveSupports();
      }
    },
    userRole === 'venezuela' && !!vzlaCtx?.vzlaId
  );

  // === Client realtime (using existing pattern) ===
  useEffect(() => {
    if (userRole !== 'client' || !clientCtx?.clientId) {
      setClientActiveOrders(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const ordersChannel = supabase
      .channel(`client-orders-${clientCtx.clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          const refetch = async () => {
            const { count, error } = await supabase
              .from('orders')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', clientCtx.clientId)
              .lt('state', 13);
            if (!error && typeof count === 'number') setClientActiveOrders(count);
          };
          refetch();
        }
      )
      .subscribe();

    // Profile updates for client
    const profileChannel = supabase
      .channel(`client-profile-${clientCtx.clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${clientCtx.clientId}`,
        },
        () => {
          // Refetch client profile
          const fetchClientProfile = async () => {
            const { data, error } = await supabase
              .from('users')
              .select('name, email, image_url')
              .eq('id', clientCtx.clientId)
              .single();
            if (!error && data) {
              clientCtx.setClient({
                clientName: data.name,
                clientEmail: data.email,
                userImage: data.image_url
              });
            }
          };
          fetchClientProfile();
        }
      )
      .subscribe();

    // Initial fetch
    const fetchInitial = async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientCtx.clientId)
        .lt('state', 13);
      if (!error && typeof count === 'number') {
        setClientActiveOrders(count);
      }
    };
    fetchInitial();

    // Polling de respaldo por si algún evento no llega
    const intervalId = window.setInterval(async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientCtx.clientId)
        .lt('state', 13);
      if (!error && typeof count === 'number') setClientActiveOrders(count);
    }, 8000);

    return () => {
      supabase.removeChannel(ordersChannel);
      window.clearInterval(intervalId);
      supabase.removeChannel(profileChannel);
    };
  }, [userRole, clientCtx?.clientId]);

  // === Client pending payments realtime ===
  useEffect(() => {
    if (userRole !== 'client' || !clientCtx?.clientId) {
      setClientPendingPayments(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const paymentsChannel = supabase
      .channel(`client-payments-${clientCtx.clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `client_id=eq.${clientCtx.clientId}`,
        },
        () => {
          // Refetch client pending payments
          const fetchClientPayments = async () => {
            const { count, error } = await supabase
              .from('orders')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', clientCtx.clientId)
              .eq('state', 4);
            if (!error && typeof count === 'number') {
              setClientPendingPayments(count);
            }
          };
          fetchClientPayments();
        }
      )
      .subscribe();

    // Initial fetch
    const fetchInitial = async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientCtx.clientId)
        .eq('state', 4);
      if (!error && typeof count === 'number') {
        setClientPendingPayments(count);
      }
    };
    fetchInitial();

    return () => {
      supabase.removeChannel(paymentsChannel);
    };
  }, [userRole, clientCtx?.clientId]);



  const pathname = usePathname();
  const activeItem = useActivePage(menuItems, userRole, pathname);

  // === Initial data loading ===
  useEffect(() => {
    const loadInitialData = async () => {
      const supabase = getSupabaseBrowserClient();

      // Load client data
      if (userRole === 'client' && clientCtx?.clientId) {
        try {
          // Active orders
          const { count: ordersCount, error: ordersError } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', clientCtx.clientId)
            .lt('state', 13);
          if (!ordersError && typeof ordersCount === 'number') {
            setClientActiveOrders(ordersCount);
          }

          // Pending payments
          const { count: paymentsCount, error: paymentsError } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', clientCtx.clientId)
            .eq('state', 4);
          if (!paymentsError && typeof paymentsCount === 'number') {
            setClientPendingPayments(paymentsCount);
          }
        } catch (error) {
          console.error('Error loading initial client data:', error);
        }
      }

      // Load Venezuela data
      if (userRole === 'venezuela' && vzlaCtx?.vzlaId) {
        try {
          await refetchVzlaActiveOrders();
          await refetchVzlaPendingPayments();

          // Active supports - manejar tabla inexistente
          try {
            const { count: supportsCount, error: supportsError } = await supabase
              .from('support_tickets')
              .select('id', { count: 'exact', head: true })
              .eq('asignedEVzla', vzlaCtx.vzlaId)
              .eq('status', 'active');
            if (!supportsError && typeof supportsCount === 'number') {
              setVzlaActiveSupports(supportsCount);
            } else {
              console.warn('⚠️ Sidebar: support_tickets table not available:', supportsError);
              setVzlaActiveSupports(0);
            }
          } catch (err) {
            console.warn('⚠️ Sidebar: Error fetching supports count:', err);
            setVzlaActiveSupports(0);
          }
        } catch (error) {
          console.error('Error loading initial Venezuela data:', error);
        }
      }

      // Load China data
      if (userRole === 'china' && chinaCtx?.chinaId) {
        try {
          await refetchChinaActiveOrders();
        } catch (error) {
          console.error('Error loading initial China data:', error);
        }
      }

      // Load Admin data
      if (userRole === 'admin') {
        try {
          // Could add admin-specific initial data loading here
          // For now, admin badges are handled differently
        } catch (error) {
          console.error('Error loading initial admin data:', error);
        }
      }
    };

    loadInitialData();
  }, [userRole, clientCtx?.clientId, vzlaCtx?.vzlaId, chinaCtx?.chinaId]);

  // Merge dynamic badges into client menu
  // Merge dynamic badges into client menu
  const menuItemsWithCounts = useMemo(() => {
    if (userRole === 'client') {
      return menuItems.map((item) => {
        if (item.id === 'orders') {
          const badgeVal = typeof clientActiveOrders === 'number' && clientActiveOrders > 0 ? clientActiveOrders : null;
          return { ...item, badge: badgeVal };
        }
        if (item.id === 'payments') {
          const badgeVal = typeof clientPendingPayments === 'number' && clientPendingPayments > 0 ? clientPendingPayments : null;
          return { ...item, badge: badgeVal };
        }
        return item;
      });
    }
    if (userRole === 'venezuela') {
      return menuItems.map((item) => {
        if (item.id === 'orders') {
          const badgeVal = typeof vzlaActiveOrders === 'number' && vzlaActiveOrders > 0 ? vzlaActiveOrders : null;
          return { ...item, badge: badgeVal };
        }
        if (item.id === 'support') {
          const badgeVal = typeof vzlaActiveSupports === 'number' && vzlaActiveSupports > 0 ? vzlaActiveSupports : null;
          return { ...item, badge: badgeVal };
        }
        if (item.id === 'payments-validation') {
          const badgeVal = typeof vzlaPendingPayments === 'number' && vzlaPendingPayments > 0 ? vzlaPendingPayments : null;
          return { ...item, badge: badgeVal };
        }
        return item;
      });
    }
    if (userRole === 'china') {
      return menuItems.map((item) => {
        if (item.id === 'orders') {
          const badgeVal = typeof chinaActiveOrders === 'number' && chinaActiveOrders > 0 ? chinaActiveOrders : null;
          return { ...item, badge: badgeVal };
        }
        return item;
      });
    }
    return menuItems;
  }, [menuItems, userRole, clientActiveOrders, clientPendingPayments, vzlaActiveOrders, vzlaActiveSupports, vzlaPendingPayments, chinaActiveOrders]);

  // Memoizar los cálculos responsivos con optimización (debe ir antes de usar responsiveConfig)
  const responsiveConfig = useMemo(() => {
    // Breakpoints específicos para evitar gaps
    const isMobile = screenWidth < 768;           // Mobile: < 768px
    const isTablet = screenWidth >= 768 && screenWidth < 1024;  // Tablet: 768px - 1023px
    const isDesktop = screenWidth >= 1024;        // Desktop: ≥ 1024px
    const isSmallScreen = screenWidth < 1366;
    const isMediumScreen = screenWidth < 1600;

    // Cálculos específicos por breakpoint
    const sidebarWidth = isMobile
      ? (isMobileMenuOpen ? 'w-[min(18rem,calc(100vw-16px))]' : 'w-16')
      : isTablet
        ? (isExpanded ? 'w-64' : 'w-20')
        : isExpanded
          ? (screenWidth < 1440 ? 'w-64' : 'w-72')
          : 'w-20';

    const iconSize = 'w-4 h-4';
    // Aumentar ligeramente el tamaño del logo en pantallas <1440px cuando está expandido
    const logoSize: 'sm' | 'md' | 'lg' | 'xl' = isExpanded ? (screenWidth < 1440 ? 'md' : 'md') : 'md';
    const padding = isExpanded ? 'p-4' : 'p-2';
    const buttonPadding = isExpanded ? 'px-4 py-3' : 'p-2';

    return {
      sidebarWidth,
      iconSize,
      logoSize,
      padding,
      buttonPadding,
      textSize: isSmallScreen ? 'text-sm' : 'text-base',
      titleSize: isSmallScreen ? 'text-lg' : 'text-xl',
      subtitleSize: 'text-xs',
      badgeSize: 'text-xs',
      iconContainerSize: isExpanded ? 'w-8 h-8' : 'w-full h-full',
      userContainerSize: isSmallScreen ? 'w-8 h-8' : 'w-10 h-10',
      userTextSize: isSmallScreen ? 'text-xs' : 'text-sm',
      userSubtextSize: 'text-xs',
      userPadding: isSmallScreen ? 'p-2' : 'p-3',
      isMobile,
      isTablet,
      isDesktop
    };
  }, [screenWidth, isExpanded, isMobileMenuOpen]);

  // Defer para evitar picos de renders en mobile (ahora después de responsiveConfig)
  const deferredMenuItems = useDeferredValue(menuItemsWithCounts);
  const deferredActiveItem = useDeferredValue(activeItem);
  const isMobileOrTablet = responsiveConfig.isMobile || responsiveConfig.isTablet;
  const disablePrefetch = isMobileOrTablet; // Evita carga extra de rutas en mobile/tablet

  // Actualizar isExpanded automáticamente cuando cambie la resolución
  useEffect(() => {
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;

    if (isMobile) {
      // En mobile, isExpanded debe seguir a isMobileMenuOpen
      setIsExpanded(isMobileMenuOpen || false);
    } else if (isTablet) {
      // En tablet, mantener expandido por defecto para mejor usabilidad
      setIsExpanded(true);
    }
    // En desktop, mantener el comportamiento actual (controlado por hover)
  }, [screenWidth, isMobileMenuOpen, setIsExpanded]);

  // Optimizar el manejo del hover (solo en desktop)
  const handleMouseEnter = useCallback(() => {
    if (responsiveConfig.isMobile || responsiveConfig.isTablet) return;
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsExpanded(true);
  }, [hoverTimeout, setIsExpanded, responsiveConfig.isMobile, responsiveConfig.isTablet]);

  const handleMouseLeave = useCallback(() => {
    if (responsiveConfig.isMobile || responsiveConfig.isTablet) return;
    const timeout = setTimeout(() => {
      setIsExpanded(false);
    }, 300);
    setHoverTimeout(timeout);
  }, [setIsExpanded, responsiveConfig.isMobile, responsiveConfig.isTablet]);

  // --- Scroll lock centralizado en mobile/tablet ---
  useEffect(() => {
    const isSmall = (responsiveConfig.isMobile || responsiveConfig.isTablet);
    if (isSmall && isMobileMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = originalOverflow; };
    } else if (isSmall && !isMobileMenuOpen) {
      document.body.style.overflow = '';
    }
  }, [isMobileMenuOpen, responsiveConfig.isMobile, responsiveConfig.isTablet]);



  // Memoizar el renderizado de los elementos del menú
  const renderMenuItem = useCallback((item: typeof menuItems[0]) => {
    return (
      <SidebarMenuItem
        key={item.id}
        item={item}
        isActive={deferredActiveItem === item.id}
        responsiveConfig={responsiveConfig}
        isMobileMenuOpen={isMobileMenuOpen}
        isExpanded={isExpanded}
        screenWidth={screenWidth}
        t={t}
        disablePrefetch={disablePrefetch}
      />
    );
  }, [deferredActiveItem, responsiveConfig, isMobileMenuOpen, isExpanded, screenWidth, t, disablePrefetch]);

  return (
    <>

      {/* Overlay para móviles: sólo cubre el espacio visible a la derecha para dejar un borde clicable */}
      {responsiveConfig.isMobile && isMobileMenuOpen && (
        <div
          className="fixed top-0 right-0 h-full z-[45]"
          style={{
            // El sidebar en móvil ocupa min(288px, 100vw-16px). El overlay ocupa el resto.
            width: 'max(0px, calc(100vw - min(18rem, 100vw - 16px)))',
            backgroundColor: 'rgba(0,0,0,0.5)'
          }}
          onClick={onMobileMenuClose}
        />
      )}
      {responsiveConfig.isTablet && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[45] pointer-events-auto"
          onClick={onMobileMenuClose}
        />
      )}

      <div
        className={`
          fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 
          border-r border-slate-700/50 shadow-2xl backdrop-blur-sm z-50
          transition-all duration-200 ease-out flex flex-col
          ${responsiveConfig.isMobile
            ? 'w-[min(18rem,calc(100vw-16px))]'
            : (responsiveConfig.isTablet ? 'w-80' : responsiveConfig.sidebarWidth)
          }
        `}
        style={{
          transform: (responsiveConfig.isMobile || responsiveConfig.isTablet) && !isMobileMenuOpen ? 'translateX(-100%)' : 'translateX(0)',
          visibility: (responsiveConfig.isMobile || responsiveConfig.isTablet) && !isMobileMenuOpen ? 'hidden' : 'visible'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className={`${responsiveConfig.padding} border-b border-slate-700/50 flex-shrink-0`}>
          <div className={`flex items-center ${(responsiveConfig.isMobile || responsiveConfig.isTablet) ? (isMobileMenuOpen ? 'space-x-3' : 'justify-center') : (isExpanded ? 'space-x-3' : 'justify-center')}`}>
            <PitaLogo size={responsiveConfig.logoSize} animated={true} />
            <div className={`
                transition-all duration-150 ease-out overflow-hidden
                ${responsiveConfig.isMobile ? (isMobileMenuOpen ? 'w-auto opacity-100' : 'w-0 opacity-0') : (isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0')}
              `}>
              <div className="whitespace-nowrap">
                <h1 className={`font-bold text-white ${responsiveConfig.titleSize}`}>Pita Express</h1>
                <p className={`text-slate-400 ${responsiveConfig.subtitleSize}`}>{userInfo.name}</p>
                <p className={`text-slate-400 ${responsiveConfig.subtitleSize}`}>{userInfo.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content (nav + bottom) */}
        <div className={`flex-1 overflow-y-auto sidebar-scrollbar momentum-scroll touch-pan-y overscroll-contain`}>
          {/* Navigation (no render en mobile/tablet si cerrado para reducir trabajo) */}
          {(!isMobileOrTablet || isMobileMenuOpen) && (
            <nav className={`${responsiveConfig.padding} space-y-2`}>
              {deferredMenuItems.map(renderMenuItem)}
            </nav>
          )}

          {/* Bottom Section */}
          <div className={`mt-2 ${responsiveConfig.padding} border-t border-slate-700/50 space-y-4`}>
            {/* User Profile */}
            <div className={`flex items-center ${(responsiveConfig.isMobile || responsiveConfig.isTablet) ? (isMobileMenuOpen ? 'space-x-3' : 'justify-center') : 'space-x-3'} ${responsiveConfig.userPadding} rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-all duration-150 ease-out`}>
              <div className={`${responsiveConfig.userContainerSize} bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center overflow-hidden`}>
                {userInfo.userImage && !imageError ? (
                  <Image
                    src={userInfo.userImage} // URL estable para permitir cache entre navegaciones
                    alt="Foto de perfil"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover rounded-full"
                    onError={() => setImageError(true)}
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                  />
                ) : userRole === 'client' ? (
                  <VenezuelaFlag size={"sm"} animated={true} />
                ) : (
                  <span className="text-lg">{userInfo.flag}</span>
                )}
              </div>
              <div className={`
              transition-all duration-150 ease-out overflow-hidden
              ${responsiveConfig.isMobile ? (isMobileMenuOpen ? 'w-auto opacity-100' : 'w-0 opacity-0') : (isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0')}
            `}>
                <div className="whitespace-nowrap">
                  <p className={`font-medium text-white ${responsiveConfig.userTextSize}`}>
                    {userInfo.name}
                  </p>
                  <p className={`text-slate-400 ${responsiveConfig.userSubtextSize}`}>
                    {userInfo.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Settings */}
            {(() => {
              const bottomItems = getBottomItemsByRole(userRole);

              return bottomItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.path === pathname;

                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    prefetch={true}
                    className={`
                    w-full flex items-center ${(responsiveConfig.isMobile || responsiveConfig.isTablet) ? (isMobileMenuOpen ? 'space-x-3 px-4 py-3' : 'justify-center p-2') : 'space-x-3 px-4 py-3'} rounded-xl transition-all duration-150 ease-out group
                    ${isActive
                        ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-white shadow-lg border border-blue-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }
                  `}
                  >
                    <div className={`${screenWidth < 1366 ? 'w-6 h-6' : 'w-8 h-8'} flex items-center justify-center rounded-lg group-hover:bg-slate-600/50`}>
                      <Icon className={`${responsiveConfig.iconSize} ${item.color} transition-all duration-150 ease-out ${isActive ? 'scale-105' : 'scale-100'}`} />
                    </div>
                    <div className={`
                    transition-all duration-150 ease-out overflow-hidden
                    ${responsiveConfig.isMobile ? (isMobileMenuOpen ? 'w-auto opacity-100' : 'w-0 opacity-0') : (isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0')}
                  `}>
                      <span suppressHydrationWarning className="font-medium whitespace-nowrap">{t('sidebar.' + item.id) ?? item.id}</span>
                    </div>
                  </Link>
                );
              });
            })()}

            {/* Logout */}
            <button
              className={`w-full flex items-center ${(responsiveConfig.isMobile || responsiveConfig.isTablet) ? (isMobileMenuOpen ? 'space-x-3 px-4 py-3' : 'justify-center p-2') : 'space-x-3 px-4 py-3'} rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-150 ease-out group border border-red-500/20`}
              onClick={() => {
                // Elimina el token del almacenamiento local
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
                // Limpia cookie de rol y redirige al login
                document.cookie = 'role=; Path=/; Max-Age=0; SameSite=Lax';
                window.location.href = '/login-register';
              }}
            >
              <div className={`${screenWidth < 1366 ? 'w-6 h-6' : 'w-8 h-8'} flex items-center justify-center rounded-lg group-hover:bg-red-500/20`}>
                <LogOut className={responsiveConfig.iconSize} />
              </div>
              <div className={`
              transition-all duration-150 ease-out overflow-hidden
              ${responsiveConfig.isMobile ? (isMobileMenuOpen ? 'w-auto opacity-100' : 'w-0 opacity-0') : (isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0')}
            `}>
                <span className="font-medium whitespace-nowrap">{t('sidebar.logout')}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
