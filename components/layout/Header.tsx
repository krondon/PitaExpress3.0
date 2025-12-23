"use client";

import { useEffect, useMemo, useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePathname, useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/use-notifications';
import { AppRole } from '@/lib/types/notifications';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface HeaderProps {
  notifications: number;
  onMenuToggle?: () => void;
  title?: string;
  subtitle?: string;
  hideTitle?: boolean;
  showTitleOnMobile?: boolean;
  // Opcionales para el dropdown de notificaciones
  notificationsItems?: Array<{
    id: string;
    title: string;
    description?: string;
    href?: string;
    unread?: boolean;
  }>;
  onMarkAllAsRead?: () => void;
  onOpenNotifications?: () => void;
  onItemClick?: (id: string) => void;
  // Nueva modalidad: que el propio Header gestione notificaciones
  notificationsRole?: AppRole; // e.g., 'pagos', 'china', etc.
  notificationsUserId?: string; // opcional, si no se pasa se obtiene de Supabase
}

export default function Header({
  notifications,
  onMenuToggle,
  title = "Dashboard",
  subtitle = "Resumen de la operación",
  hideTitle = false,
  showTitleOnMobile = false,
  notificationsItems = [],
  onMarkAllAsRead,
  onOpenNotifications,
  onItemClick,
  notificationsRole,
  notificationsUserId,
}: HeaderProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);
  const handleMenuToggle = () => {
    onMenuToggle?.();
  };

  // Si se proporciona notificationsRole, el Header manejará notificaciones internamente
  const [internalUserId, setInternalUserId] = useState<string | undefined>(notificationsUserId);
  // Inferir rol por ruta si no viene explícito
  const inferredRole: AppRole | undefined = useMemo(() => {
    if (!pathname) return undefined;
    if (pathname.startsWith('/china')) return 'china';
    if (pathname.startsWith('/pagos')) return 'pagos';
    if (pathname.startsWith('/venezuela')) return 'venezuela';
    if (pathname.startsWith('/admin')) return 'admin';
    if (pathname.startsWith('/cliente') || pathname.startsWith('/client')) return 'client';
    return undefined;
  }, [pathname]);
  const roleToUse = notificationsRole ?? inferredRole;
  useEffect(() => {
    if (!notificationsUserId && roleToUse) {
      // Obtener userId actual desde Supabase en cliente (necesario para client; inocuo para otros roles)
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getUser().then(({ data }) => {
        const uid = data?.user?.id;
        if (uid) setInternalUserId(uid);
      }).catch(() => { });
    }
  }, [notificationsUserId, roleToUse]);

  const notificationsEnabled = !!roleToUse;
  const { uiItems, unreadCount, markAllAsRead, markOneAsRead } = useNotifications({
    role: roleToUse,
    userId: internalUserId,
    limit: 20,
    enabled: notificationsEnabled,
  });

  const baseNotifications = notificationsEnabled ? unreadCount : notifications;
  const baseItems = notificationsEnabled ? uiItems : notificationsItems;
  const effectiveNotifications = baseNotifications;
  // Mostrar solo no leídas. Si no viene 'unread' definido, asumir que está no leída para que se muestre.
  const effectiveItems = (baseItems || []).filter((n) => (n.unread === undefined ? true : !!n.unread));

  return (
    <header className={`${mounted && theme === 'dark' ? 'bg-slate-800/90 dark:border-slate-700' : 'bg-white/90 border-slate-200'} backdrop-blur-sm border-b sticky top-0 z-40 shadow-sm`}>
      <div className="px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMenuToggle}
              className={`lg:hidden min-w-[44px] min-h-[44px] p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors`}
            >
              <Menu className="w-6 h-6" />
            </Button>

            {/* Title Section */}
            {!hideTitle && (
              <div className={showTitleOnMobile ? "block" : "hidden sm:block"}>
                <h1 className={`text-xl sm:text-2xl font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{title}</h1>
                <p className={`text-xs sm:text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{subtitle}</p>
              </div>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Desktop Notifications (Dropdown) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`relative hidden sm:flex hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors`}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  <span className="hidden md:inline">{t('header.notifications')}</span>
                  {effectiveNotifications > 0 && (
                    <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center bg-[#202841] text-white text-xs">
                      {effectiveNotifications}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="p-2">
                  <DropdownMenuLabel className="px-2 py-1.5">{t('header.notifications')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {effectiveItems && effectiveItems.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto">
                      {effectiveItems.map((n) => (
                        <DropdownMenuItem
                          key={n.id}
                          className={`flex flex-col items-start gap-0.5 ${n.unread ? (mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50') : ''} ${n.href ? `cursor-pointer ${mounted && theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-slate-100'}` : ''}`}
                          onSelect={(e) => {
                            if (n.href) {
                              e.preventDefault();
                              if (notificationsEnabled) {
                                markOneAsRead?.(n.id);
                              } else {
                                onItemClick?.(n.id);
                              }
                              router.push(n.href);
                            }
                          }}
                        >
                          <span className={`text-sm ${mounted && theme === 'dark' ? 'text-white' : ''} ${n.unread ? 'font-semibold' : 'font-medium'}`}>{n.title}</span>
                          {n.description && (
                            <span className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{n.description}</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ) : (
                    <div className={`px-3 py-6 text-sm text-center ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('header.noNotifications') || 'Sin notificaciones'}
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator />
                <div className="p-2 flex items-center">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => notificationsEnabled ? markAllAsRead?.() : onMarkAllAsRead?.()}
                  >
                    {t('header.clear') || 'Limpiar'}
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Notifications (Dropdown) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={`relative sm:hidden min-w-[44px] min-h-[44px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors`}
                >
                  <Bell className="w-5 h-5" />
                  {effectiveNotifications > 0 && (
                    <Badge className="absolute -top-1 -right-1 min-w-[20px] h-5 p-0 flex items-center justify-center bg-[#202841] text-white text-xs">
                      {effectiveNotifications}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="p-2">
                  <DropdownMenuLabel className="px-2 py-1.5">{t('header.notifications')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {effectiveItems && effectiveItems.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto">
                      {effectiveItems.map((n) => (
                        <DropdownMenuItem
                          key={n.id}
                          className={`flex flex-col items-start gap-0.5 ${n.unread ? (mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-50') : ''} ${n.href ? `cursor-pointer ${mounted && theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-slate-100'}` : ''}`}
                          onSelect={(e) => {
                            if (n.href) {
                              e.preventDefault();
                              if (notificationsEnabled) {
                                markOneAsRead?.(n.id);
                              } else {
                                onItemClick?.(n.id);
                              }
                              router.push(n.href);
                            }
                          }}
                        >
                          <span className={`text-sm ${mounted && theme === 'dark' ? 'text-white' : ''} ${n.unread ? 'font-semibold' : 'font-medium'}`}>{n.title}</span>
                          {n.description && (
                            <span className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{n.description}</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ) : (
                    <div className={`px-3 py-6 text-sm text-center ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('header.noNotifications') || 'Sin notificaciones'}
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator />
                <div className="p-2 flex items-center">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => notificationsEnabled ? markAllAsRead?.() : onMarkAllAsRead?.()}
                  >
                    {t('header.clear') || 'Limpiar'}
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
} 