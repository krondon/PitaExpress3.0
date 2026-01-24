"use client";

import { useMemo, useState, useEffect, useRef } from 'react';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/useTranslation';

// Estilos para animaciones
const animationStyles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
`;

// Inyectar estilos en el head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = animationStyles;
  document.head.appendChild(style);
}
import { useTheme } from 'next-themes';
import { useAdminLayoutContext } from '@/lib/AdminLayoutContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MoreVertical,
  Plus,
  Search,
  UserCog,
  Shield,
  CheckCircle,
  XCircle,
  Trash2,
  Filter,
  Users,
  UserCheck,
  UserX,
  Calendar,
  Mail,
  Phone,
  Settings,
  Eye,
  Edit3,
  Archive,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Header from '@/components/layout/Header';

type UserStatus = 'activo' | 'inactivo';
type UserRole = 'Cliente' | 'Empleado China' | 'Empleado Vzla' | 'Pagos' | 'Admin';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string; // ISO
}

const ROLE_COLORS_LIGHT: Record<UserRole, string> = {
  'Cliente': 'bg-slate-100 text-slate-800 border-slate-200',
  'Empleado China': 'bg-red-100 text-red-800 border-red-200',
  'Empleado Vzla': 'bg-blue-100 text-blue-800 border-blue-200',
  'Pagos': 'bg-amber-100 text-amber-800 border-amber-200',
  'Admin': 'bg-purple-100 text-purple-800 border-purple-200',
};

const ROLE_COLORS_DARK: Record<UserRole, string> = {
  'Cliente': 'bg-slate-700 text-slate-200 border-slate-600',
  'Empleado China': 'bg-red-900/30 text-red-300 border-red-700',
  'Empleado Vzla': 'bg-blue-900/30 text-blue-300 border-blue-700',
  'Pagos': 'bg-amber-900/30 text-amber-300 border-amber-700',
  'Admin': 'bg-purple-900/30 text-purple-300 border-purple-700',
};

function getRoleColors(role: UserRole, isDark: boolean): string {
  return isDark ? ROLE_COLORS_DARK[role] : ROLE_COLORS_LIGHT[role];
}

export default function UsuariosPage() {
  const { t } = useTranslation();
  const { toggleMobileMenu } = useAdminLayoutContext();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { data: fetchedUsers, loading: usersLoading } = useAdminUsers();
  const [users, setUsers] = useState<User[]>([]);

  // Mapear datos reales del hook a la estructura de la tabla
  useEffect(() => {
    if (Array.isArray(fetchedUsers)) {
      const mapped: User[] = fetchedUsers.map(u => {
        // Preferir user_level para distinguir China/Vzla/Client/Admin
        const lvl = (u as any).user_level?.toLowerCase?.() ?? '';
        let uiRole: UserRole;
        if (lvl === 'admin') uiRole = 'Admin';
        else if (lvl === 'client') uiRole = 'Cliente';
        else if (lvl === 'china') uiRole = 'Empleado China';
        else if (lvl === 'vzla' || lvl === 'venezuela') uiRole = 'Empleado Vzla';
        else if (lvl === 'pagos') uiRole = 'Pagos';
        else {
          // fallback to old mapping
          uiRole = u.role === 'administrator' ? 'Admin' : u.role === 'employee' ? 'Empleado Vzla' : 'Cliente';
        }
        return {
          id: u.id,
          fullName: u.name || t('admin.users.defaults.noName'),
          email: u.email || t('admin.users.defaults.noEmail'),
          role: uiRole,
          status: (u as any).status === 'inactivo' ? 'inactivo' : 'activo',
          createdAt: u.created_at || '',
        };
      });
      setUsers(mapped);
    }
  }, [fetchedUsers]);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [animationKey, setAnimationKey] = useState(0);
  // Controlar que las animaciones de aparición solo ocurran la PRIMERA vez que se cargan los usuarios
  const [didInitialAnimate, setDidInitialAnimate] = useState(false);

  // Paginación (fija a 10 por página)
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Handlers para actualizar filtros con animación
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setAnimationKey(prev => prev + 1);
  };

  const handleRoleFilterChange = (value: 'all' | UserRole) => {
    setRoleFilter(value);
    setAnimationKey(prev => prev + 1);
  };

  const handleStatusFilterChange = (value: 'all' | UserStatus) => {
    setStatusFilter(value);
    setAnimationKey(prev => prev + 1);
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { toast } = useToast();
  const lastDeletedRef = useRef<User | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [flashUserId, setFlashUserId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const term = (searchTerm || '').toString().trim().toLowerCase();

    // If there's an exact ID match, prefer showing only that user
    if (term) {
      const exact = users.find((u) => (u.id || '').toString().toLowerCase() === term);
      if (exact) return [exact];
    }

    const filtered = users.filter((u) => {
      const name = (u.fullName || '').toString().toLowerCase();
      const email = (u.email || '').toString().toLowerCase();
      const id = (u.id || '').toString().toLowerCase();

      const matchesText = term.length === 0
        ? true
        : name.includes(term) || email.includes(term) || id.includes(term);

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesText && matchesRole && matchesStatus;
    });

    // Deduplicate by id to avoid repeated entries
    const seen = new Set<string>();
    const deduped = filtered.filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });

    return deduped;
  }, [users, searchTerm, roleFilter, statusFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE)), [filteredUsers.length]);
  const pagedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);
  // Texto de paginación internacionalizado
  const paginationText = t('admin.users.pagination.showing', {
    from: (filteredUsers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1),
    to: Math.min(page * PAGE_SIZE, filteredUsers.length),
    total: filteredUsers.length
  });

  // Resetear a la primera página al cambiar filtros o dataset
  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter, statusFilter, users.length]);

  // Marcar que ya se animó la primera vez (cuando termina el primer loading exitoso)
  useEffect(() => {
    if (!usersLoading && users.length > 0 && !didInitialAnimate) {
      // Pequeño timeout para asegurar que el layout esté pintado antes de bloquear animaciones futuras
      const id = setTimeout(() => setDidInitialAnimate(true), 50);
      return () => clearTimeout(id);
    }
  }, [usersLoading, users.length, didInitialAnimate]);

  const isNewUser = !!(editingUser && !/^[0-9a-fA-F-]{36}$/.test(editingUser.id));
  const fullNameTooLong = !!(editingUser && editingUser.fullName.length > 50);
  const emailValue = editingUser?.email || '';
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  const emailTooLong = emailValue.length > 50;
  const passwordTooLong = newUserPassword.length > 50;
  const editPasswordTooLong = editUserPassword.length > 50;
  const hasEmptyRequired = !!(editingUser && (!editingUser.fullName || !editingUser.email));
  const saveDisabled = hasEmptyRequired || fullNameTooLong || emailTooLong || (!emailValid && (editingUser?.email || '').length > 0) || (isNewUser && passwordTooLong) || (!isNewUser && editPasswordTooLong);

  function handleOpenCreate() {
    setEditingUser({
      id: `USR-${Math.floor(100 + Math.random() * 900)}`,
      fullName: '',
      email: '',
      role: 'Empleado Vzla',
      status: 'activo',
      createdAt: new Date().toISOString(),
    });
    setNewUserPassword('');
    setIsDialogOpen(true);
  }

  function handleOpenEdit(user: User) {
    setEditingUser({ ...user });
    setNewUserPassword('');
    setEditUserPassword('');
    setIsDialogOpen(true);
  }

  function handleToggleStatus(user: User) {
    const next = user.status === 'activo' ? 'inactivo' : 'activo';
    // Optimistic update
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: next } : u)));
    fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, status: next }),
    }).then(async (res) => {
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error' }));
        // Rollback
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: user.status } : u)));
        toast({ title: t('admin.users.messages.errorUpdating'), description: error || t('admin.users.messages.couldNotChangeStatus') });
        return;
      }
      toast({ title: t('admin.users.messages.statusUpdated'), description: t('admin.users.messages.statusUpdatedDesc', { name: user.fullName, status: next }) });
    }).catch(() => {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: user.status } : u)));
      toast({ title: t('admin.users.messages.errorUpdating'), description: t('admin.users.messages.couldNotChangeStatus') });
    });
  }

  function performDelete(user: User) {
    const prevUsers = users;
    // Optimistic remove
    setUsers((p) => p.filter((u) => u.id !== user.id));
    lastDeletedRef.current = user;
    // Clear previous undo timeout if any
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, hard: true }),
    }).then(async (res) => {
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error' }));
        setUsers(prevUsers);
        toast({ title: t('admin.users.messages.errorDeleting'), description: error || t('admin.users.messages.couldNotDelete') });
        lastDeletedRef.current = null;
        return;
      }
      // Show undo toast
      const undoId = `undo-${user.id}`;
      toast({
        title: t('admin.users.messages.userDeleted') || 'Usuario eliminado',
        description: t('admin.users.messages.userDeletedDesc', { name: user.fullName }) || `Se eliminó ${user.fullName}`,
        action: (
          <ToastAction altText={t('admin.users.messages.undo')} onClick={() => {
            if (!lastDeletedRef.current) return;
            const restored = lastDeletedRef.current;
            setUsers((p) => [restored, ...p]);
            setFlashUserId(restored.id);
            setTimeout(() => setFlashUserId(null), 2000);
            // Patch status back to activo
            fetch('/api/admin/users', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: restored.id, status: 'activo' }),
            }).catch(() => {/* silent */ });
            lastDeletedRef.current = null;
          }}>
            {t('admin.users.messages.undo') || 'Deshacer'}
          </ToastAction>
        ),
        duration: 5000,
      });
      // Auto-clear after toast window
      undoTimeoutRef.current = setTimeout(() => { lastDeletedRef.current = null; }, 5000);
    }).catch(() => {
      setUsers(prevUsers);
      toast({ title: t('admin.users.messages.errorDeleting') || 'Error al eliminar', description: t('admin.users.messages.couldNotDelete') || 'No se pudo eliminar' });
      lastDeletedRef.current = null;
    });
  }

  function handleRequestDelete(user: User) {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  }

  function handleConfirmDelete() {
    if (userToDelete) {
      performDelete(userToDelete);
    }
    setIsDeleteDialogOpen(false);
    setUserToDelete(null);
  }

  function handleCancelDelete() {
    setIsDeleteDialogOpen(false);
    setUserToDelete(null);
  }

  function handleSave() {
    if (!editingUser) return;
    // Validaciones simples
    if (!editingUser.fullName || !editingUser.email) {
      toast({ title: t('admin.users.messages.incompleteData'), description: t('admin.users.messages.nameAndEmailRequired') });
      return;
    }
    const isNew = !/^[0-9a-fA-F-]{36}$/.test(editingUser.id); // id temporal no UUID
    const dbRole: 'administrator' | 'client' | 'employee' =
      editingUser.role === 'Admin'
        ? 'administrator'
        : editingUser.role === 'Cliente'
          ? 'client'
          : 'employee'; // Empleado China, Empleado Vzla, Pagos => employee

    const userLevel = editingUser.role === 'Admin'
      ? 'Admin'
      : editingUser.role === 'Cliente'
        ? 'Client'
        : editingUser.role === 'Empleado China'
          ? 'China'
          : editingUser.role === 'Empleado Vzla'
            ? 'Vzla'
            : 'Pagos';
    const prevUsers = users;

    if (isNew) {
      // Crear usuario nuevo
      fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: editingUser.fullName, email: editingUser.email, role: dbRole, userLevel, password: newUserPassword || undefined }),
      }).then(async (res) => {
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: 'Error' }));
          toast({ title: t('admin.users.messages.errorCreating'), description: error || t('admin.users.messages.couldNotCreate') });
          return;
        }
        const created = await res.json();
        // Insertar en lista con datos reales
        const mapped: User = {
          id: created.id,
          fullName: created.name || editingUser.fullName,
          email: created.email || editingUser.email,
          role: (created.user_level?.toLowerCase?.() === 'china') ? 'Empleado China'
            : (created.user_level?.toLowerCase?.() === 'vzla' || created.user_level?.toLowerCase?.() === 'venezuela') ? 'Empleado Vzla'
              : (created.user_level?.toLowerCase?.() === 'pagos') ? 'Pagos'
                : (dbRole === 'administrator' ? 'Admin' : dbRole === 'client' ? 'Cliente' : 'Empleado Vzla'),
          status: 'activo',
          createdAt: created.created_at || new Date().toISOString(),
        };
        setUsers((prev) => [mapped, ...prev]);
        setIsDialogOpen(false);
        setEditingUser(null);
        toast({ title: t('admin.users.messages.userCreated'), description: t('admin.users.messages.userCreatedDesc') });
      }).catch(() => {
        toast({ title: t('admin.users.messages.errorCreating'), description: t('admin.users.messages.couldNotCreate') });
      });
      return;
    }

    // Actualizar usuario existente
    const payload: any = {
      id: editingUser.id,
      fullName: editingUser.fullName,
      email: editingUser.email,
      role: dbRole,
      userLevel,
    };
    if (!isNew && editUserPassword.trim().length > 0) {
      payload.newPassword = editUserPassword.trim();
    }
    // Optimistic apply
    setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? editingUser : u)));
    fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error' }));
        setUsers(prevUsers);
        toast({ title: t('admin.users.messages.errorSaving'), description: error || t('admin.users.messages.couldNotSave') });
        return;
      }
      setIsDialogOpen(false);
      setEditingUser(null);
      toast({ title: t('admin.users.messages.changesSaved'), description: t('admin.users.messages.changesSavedDesc') });
    }).catch(() => {
      setUsers(prevUsers);
      toast({ title: t('admin.users.messages.errorSaving'), description: t('admin.users.messages.couldNotSave') });
    });
  }

  return (
    <>
      <Header
        notifications={3}
        onMenuToggle={toggleMobileMenu}
        title={t('admin.users.subtitle')}
        subtitle={t('admin.users.description')}
      />

      <div className="p-4 md:p-5 lg:p-6 space-y-4 md:space-y-5 lg:space-y-6">
        <Card className={`shadow-lg border-0 ${mounted && theme === 'dark' ? 'bg-slate-800/70 dark:border-slate-700' : 'bg-white/70'} backdrop-blur-sm hover:shadow-xl transition-shadow duration-300`}>
          <CardHeader className="pb-3">
            {/* Layout ajustado: en móvil apilar título y controles; en >=sm distribución horizontal */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className={`text-lg md:text-xl flex items-center ${mounted && theme === 'dark' ? 'text-white' : 'text-black'} w-full sm:w-auto`}>
                <Users className={`w-4 h-4 md:w-5 md:h-5 mr-2 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                {t('admin.users.listTitle')}
              </CardTitle>
              {/* Toolbar: en móvil columna a ancho completo */}
              <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-2 sm:gap-3">
                {/* Search */}
                <div className="relative w-full sm:w-auto">
                  <Input
                    placeholder={t('admin.users.search')}
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className={`px-3 h-10 w-full sm:w-56 md:w-64 ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : 'bg-white/80 border-slate-300'} backdrop-blur-sm focus:border-blue-500 focus:ring-blue-500 text-sm`}
                  />
                </div>
                {/* Filtro Rol */}
                <div className="w-full sm:w-auto">
                  <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
                    <SelectTrigger className={`h-10 w-full sm:w-48 md:w-56 px-3 whitespace-nowrap ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : 'bg-white/80 border-slate-300'} backdrop-blur-sm focus:border-blue-500 text-sm`}>
                      <div className="flex items-center gap-2 truncate">
                        <Filter className={`w-4 h-4 mr-2 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`} />
                        <SelectValue placeholder={t('admin.users.filters.role')} />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('admin.users.filters.allRoles')}</SelectItem>
                      {(['Cliente', 'Empleado China', 'Empleado Vzla', 'Pagos', 'Admin'] as UserRole[]).map((r) => (
                        <SelectItem key={r} value={r}>{t(`admin.users.roles.${r}` as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Nuevo usuario */}
                <div className="w-full sm:w-auto">
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={handleOpenCreate} className="h-10 w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg text-sm">
                        <Plus className="w-3 h-3 mr-2" /> {t('admin.users.form.newUser')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingUser && users.some(u => u.id === editingUser.id) ? t('admin.users.form.editUser') : t('admin.users.form.createUser')}</DialogTitle>
                        <DialogDescription>{t('admin.users.form.description')}</DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="fullName">{t('admin.users.form.fullName')}</Label>
                          <Input
                            id="fullName"
                            value={editingUser?.fullName ?? ''}
                            onChange={(e) => setEditingUser((prev) => prev ? { ...prev, fullName: e.target.value } : prev)}
                            maxLength={50}
                          />
                          {fullNameTooLong && (
                            <p className="text-xs text-red-500">{t('admin.users.form.max50Chars')}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">{t('admin.users.form.email')}</Label>
                          <Input
                            id="email"
                            type="email"
                            value={editingUser?.email ?? ''}
                            onChange={(e) => setEditingUser((prev) => prev ? { ...prev, email: e.target.value } : prev)}
                            maxLength={50}
                          />
                          {editingUser?.email && !emailValid && (
                            <p className="text-xs text-red-500">{t('admin.users.form.invalidEmail')}</p>
                          )}
                          {emailTooLong && (
                            <p className="text-xs text-red-500">{t('admin.users.form.emailMax50')}</p>
                          )}
                        </div>
                        {isNewUser ? (
                          <div className="space-y-2">
                            <Label htmlFor="password">{t('admin.users.form.password')}</Label>
                            <Input
                              id="password"
                              type="password"
                              value={newUserPassword}
                              onChange={(e) => setNewUserPassword(e.target.value)}
                              placeholder={t('admin.users.form.passwordPlaceholder')}
                              maxLength={50}
                            />
                            {passwordTooLong && (
                              <p className="text-xs text-red-500">{t('admin.users.form.passwordMax50')}</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor="editPassword">{t('admin.users.form.changePassword')}</Label>
                            <Input
                              id="editPassword"
                              type="password"
                              value={editUserPassword}
                              onChange={(e) => setEditUserPassword(e.target.value)}
                              placeholder={t('admin.users.form.changePasswordPlaceholder')}
                              maxLength={50}
                            />
                            {editPasswordTooLong && (
                              <p className="text-xs text-red-500">{t('admin.users.form.passwordMax50')}</p>
                            )}
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Rol</Label>
                          <Select
                            value={editingUser?.role ?? 'Empleado Vzla'}
                            onValueChange={(val: UserRole) => setEditingUser((prev) => prev ? { ...prev, role: val } : prev)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('admin.users.form.selectRole')} />
                            </SelectTrigger>
                            <SelectContent>
                              {(['Cliente', 'Empleado China', 'Empleado Vzla', 'Pagos', 'Admin'] as UserRole[]).map((r) => (
                                <SelectItem key={r} value={r}>{t(`admin.users.roles.${r}` as any)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('admin.users.form.cancel')}</Button>
                        <Button onClick={handleSave} className="bg-blue-600 text-white" disabled={saveDisabled}>{t('admin.users.form.save')}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-hidden">
            {usersLoading && (
              <div className={`hidden lg:block rounded-xl border ${mounted && theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white/50'} backdrop-blur-sm overflow-hidden mb-4`}>
                <div className={`divide-y ${mounted && theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 py-4 px-6 animate-fade-in">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                        <Skeleton className="h-2 w-1/5" />
                      </div>
                      <Skeleton className="h-6 w-28 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {usersLoading && (
              <div className="lg:hidden space-y-3 mb-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`${mounted && theme === 'dark' ? 'bg-slate-800/80 dark:border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-sm rounded-xl border p-4`}>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-2 w-1/3" />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-4">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!usersLoading && (
              <>
                {/* Vista Desktop - Tabla */}
                <div className={`hidden lg:block rounded-xl border ${mounted && theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white/50'} backdrop-blur-sm overflow-x-auto`}>
                  <div className="min-h-[400px] transition-all duration-700 ease-in-out">
                    <table className="w-full table-fixed min-w-full">
                      <thead className={`bg-gradient-to-r ${mounted && theme === 'dark' ? 'from-slate-800 to-slate-700 border-slate-600' : 'from-slate-50 to-blue-50 border-slate-200'} border-b`}>
                        <tr>
                          <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '40%' }}>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              {t('admin.users.table.user')}
                            </div>
                          </th>
                          <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '15%' }}>
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              {t('admin.users.table.role')}
                            </div>
                          </th>
                          <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '15%' }}>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {t('admin.users.table.createdAt')}
                            </div>
                          </th>
                          <th className={`text-left py-4 px-6 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'} font-semibold`} style={{ width: '15%' }}>
                            <div className="flex items-center gap-2">
                              <Settings className="w-4 h-4" />
                              {t('admin.users.table.actions')}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${mounted && theme === 'dark' ? 'divide-slate-700' : 'divide-slate-100'}`}>
                        {pagedUsers.map((user, index) => (
                          <tr
                            key={user.id}
                            className={`${mounted && theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-slate-50/50'} transition-all duration-300 ease-out group ${flashUserId === user.id ? (mounted && theme === 'dark' ? 'animate-[pulse_1.2s_ease-in-out_2] bg-green-900/30' : 'animate-[pulse_1.2s_ease-in-out_2] bg-green-50/70') : ''}`}
                            style={didInitialAnimate ? undefined : {
                              animationDelay: `${index * 30}ms`,
                              animationName: 'fadeInUp',
                              animationDuration: '0.45s',
                              animationTimingFunction: 'ease-out',
                              animationFillMode: 'forwards'
                            }}
                          >
                            <td className="py-4 px-6" style={{ width: '40%' }}>
                              <div className="flex items-center gap-4">
                                <Avatar className={`h-12 w-12 ring-2 ${mounted && theme === 'dark' ? 'ring-slate-700 group-hover:ring-blue-600' : 'ring-slate-100 group-hover:ring-blue-200'} transition-all duration-200 flex-shrink-0`}>
                                  <AvatarFallback className={`bg-gradient-to-br ${mounted && theme === 'dark' ? 'from-blue-900/50 to-blue-800/50 text-blue-300' : 'from-blue-100 to-blue-200 text-blue-800'} font-semibold`}>
                                    {user.fullName
                                      .split(' ')
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className={`font-semibold ${mounted && theme === 'dark' ? 'text-white group-hover:text-blue-300' : 'text-slate-900 group-hover:text-blue-900'} transition-colors truncate`}>{user.fullName}</div>
                                  <div className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'} flex items-center gap-1 truncate`}>
                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{user.email}</span>
                                  </div>
                                  <div className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} font-mono truncate`}>{user.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6" style={{ width: '15%' }}>
                              <Badge className={`${getRoleColors(user.role, mounted && theme === 'dark')} border font-medium px-3 py-1`}>
                                {t(`admin.users.roles.${user.role}` as any)}
                              </Badge>
                            </td>
                            <td className="py-4 px-6" style={{ width: '15%' }}>
                              <div className="flex items-center gap-2">
                                <Calendar className={`w-4 h-4 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} flex-shrink-0`} />
                                <span className={`truncate ${mounted && theme === 'dark' ? 'text-slate-300' : ''}`}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-VE') : '—'}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6" style={{ width: '15%' }}>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEdit(user)}
                                  className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-blue-900/30 hover:text-blue-300' : 'hover:bg-blue-100 hover:text-blue-700'} transition-all duration-200`}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                                {/* <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleToggleStatus(user)}
                                              className={`h-8 w-8 p-0 transition-all duration-200 ${
                                                user.status === 'activo' 
                                                  ? 'hover:bg-red-100 hover:text-red-700' 
                                                  : 'hover:bg-green-100 hover:text-green-700'
                                              }`}
                                            >
                                              {user.status === 'activo' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                            </Button> */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRequestDelete(user)}
                                  className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-red-900/30 hover:text-red-300' : 'hover:bg-red-100 hover:text-red-700'} transition-all duration-200`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Vista Mobile/Tablet - Cards */}
                <div className="lg:hidden space-y-3 md:space-y-4">
                  {pagedUsers.map((user, index) => (
                    <div
                      key={user.id}
                      onClick={() => handleOpenEdit(user)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenEdit(user); } }}
                      role="button"
                      tabIndex={0}
                      className={`${mounted && theme === 'dark' ? 'bg-slate-800/80 dark:border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-sm rounded-xl border p-4 md:p-5 hover:shadow-lg transition-all duration-300 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${flashUserId === user.id ? (mounted && theme === 'dark' ? 'animate-[pulse_1.2s_ease-in-out_2] ring-2 ring-green-600/60' : 'animate-[pulse_1.2s_ease-in-out_2] ring-2 ring-green-300/60') : ''}`}
                      style={didInitialAnimate ? undefined : {
                        animationDelay: `${index * 25}ms`,
                        animationName: 'fadeInUp',
                        animationDuration: '0.45s',
                        animationTimingFunction: 'ease-out',
                        animationFillMode: 'forwards'
                      }}
                    >
                      <div className="flex flex-col gap-3 md:gap-4 w-full">
                        <div className="flex items-center gap-3 md:gap-4 w-full">
                          <Avatar className={`h-12 w-12 md:h-14 md:w-14 ring-2 ${mounted && theme === 'dark' ? 'ring-slate-700 group-hover:ring-blue-600' : 'ring-slate-100 group-hover:ring-blue-200'} transition-all duration-200 flex-shrink-0`}>
                            <AvatarFallback className={`bg-gradient-to-br ${mounted && theme === 'dark' ? 'from-blue-900/50 to-blue-800/50 text-blue-300' : 'from-blue-100 to-blue-200 text-blue-800'} font-semibold text-sm md:text-base`}>
                              {user.fullName
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className={`font-semibold ${mounted && theme === 'dark' ? 'text-white group-hover:text-blue-300' : 'text-slate-900 group-hover:text-blue-900'} transition-colors text-sm md:text-base`}>{user.fullName}</div>
                            <div className={`text-xs md:text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'} flex items-center gap-1 mt-1`}>
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{user.email}</span>
                            </div>
                            <div className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} font-mono mt-1`}>{user.id}</div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                            <Badge className={`${getRoleColors(user.role, mounted && theme === 'dark')} border font-medium px-2 py-1 text-xs pointer-events-none select-none`}>
                              {t(`admin.users.roles.${user.role}` as any)}
                            </Badge>
                            {user.status === 'activo' ? (
                              <Badge className={`${mounted && theme === 'dark' ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200'} font-medium px-2 py-1 text-xs pointer-events-none select-none`}>
                                <CheckCircle className="w-3 h-3 mr-1" /> {t('admin.users.status.active')}
                              </Badge>
                            ) : (
                              <Badge className={`${mounted && theme === 'dark' ? 'bg-red-900/30 text-red-300 border-red-700' : 'bg-red-100 text-red-800 border-red-200'} font-medium px-2 py-1 text-xs pointer-events-none select-none`}>
                                <XCircle className="w-3 h-3 mr-1" /> {t('admin.users.status.inactive')}
                              </Badge>
                            )}
                          </div>
                          <div className={`flex items-center gap-1 text-xs ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(user.createdAt).toLocaleDateString('es-VE')}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`flex items-center justify-end gap-1 md:gap-2 mt-3 md:mt-4 pt-3 md:pt-4 border-t ${mounted && theme === 'dark' ? 'border-slate-700' : 'border-slate-100'} w-full`} onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(user); }}
                          className={`h-7 w-7 md:h-8 md:w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-blue-900/30 hover:text-blue-300' : 'hover:bg-blue-100 hover:text-blue-700'} transition-all duration-200`}
                        >
                          <Edit3 className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleRequestDelete(user); }}
                          className={`h-7 w-7 md:h-8 md:w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-red-900/30 hover:text-red-300' : 'hover:bg-red-100 hover:text-red-700'} transition-all duration-200`}
                        >
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Estado vacío */}
                {filteredUsers.length === 0 && (
                  <div className="text-center py-12 md:py-16">
                    <div
                      className={`flex flex-col items-center gap-3 md:gap-4 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}
                      style={didInitialAnimate ? undefined : {
                        animationName: 'fadeInUp',
                        animationDuration: '0.45s',
                        animationTimingFunction: 'ease-out',
                        animationFillMode: 'forwards'
                      }}
                    >
                      <Users className={`w-10 h-10 md:w-12 md:h-12 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
                      <p className="text-base md:text-lg font-medium">{t('admin.users.empty.noUsersFound')}</p>
                      <p className="text-xs md:text-sm">{t('admin.users.empty.tryAdjustFilters')}</p>
                    </div>
                  </div>
                )}
                {/* Controles de paginación */}
                {filteredUsers.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-4">
                    {/* Texto de paginación eliminado a solicitud; se mantiene solo el control de páginas */}
                    <div className="flex items-center gap-3">
                      {/* Selector de tamaño de página removido: siempre 10 */}
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'} w-14 text-center`}>{page}/{totalPages}</span>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.delete.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('admin.users.delete.confirmDescription', { name: userToDelete?.fullName || '' })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('admin.users.delete.irreversible')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>{t('admin.users.delete.cancel')}</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>{t('admin.users.delete.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}