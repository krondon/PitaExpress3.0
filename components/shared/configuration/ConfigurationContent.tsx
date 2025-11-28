"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Sidebar from '@/components/layout/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Globe,
  Palette,
  Camera,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Sun,
  Moon,
  Save,
  Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { useClientContext } from '@/lib/ClientContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useTranslation } from '@/hooks/useTranslation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export type ConfigurationRole = 'admin' | 'china' | 'venezuela' | 'client' | 'pagos';

interface ConfigurationContentProps {
  role: ConfigurationRole;
  onUserImageUpdate?: (url?: string) => void;
}

export default function ConfigurationContent({ role, onUserImageUpdate }: ConfigurationContentProps) {
  const MAX_FIELD_LENGTH = 50; // Límite requerido para nombre, email y contraseñas
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { language, committedLanguage, previewLanguage, commitLanguage, revertLanguage } = useLanguage();
  // Crear un hook personalizado que maneje el error
  const useClientContextSafe = () => {
    try {
      return useClientContext();
    } catch {
      return { clientName: undefined, clientEmail: undefined, clientPhone: undefined, setClient: () => {} };
    }
  };
  
  const clientContext = useClientContextSafe();
  
  // Solo usar los valores si el rol es 'client'
  const { clientName, clientEmail, clientPhone, setClient } = role === 'client' ? clientContext : { 
    clientName: undefined, 
    clientEmail: undefined, 
    clientPhone: undefined, 
    setClient: () => {} 
  };
  // Flag para saber si se guardó y evitar revert posterior accidental
  const didSaveRef = React.useRef(false);
  const { t } = useTranslation();

  // Datos base (simulados) — se pueden adaptar por rol si hace falta más adelante
  const roleData = (() => {
    if (role === 'pagos') {
      return {
        nombre: 'Validador Pagos',
        email: 'pagos@morna.com',
        telefono: '+58 424-000-0000',
        rol: 'pagos',
        color: 'bg-blue-500'
      };
    }
    return {
      nombre: 'Administrador Principal',
      email: 'admin@morna.com',
      telefono: '+58 412-123-4567',
      rol: role === 'admin' ? 'Administrador' : role,
      color: 'bg-purple-500'
    };
  })();

  // Estados del formulario
  const [formData, setFormData] = useState({
    nombre: roleData.nombre,
    email: roleData.email,
    telefono: roleData.telefono,
    idioma: language,
    fotoPerfil: null as File | null,
  fotoPreview: null as string | null,
  fotoVersion: 0 // para controlar cache busting sólo cuando cambie
  });
  // Baseline para detectar cambios en perfil
  const [profileBaseline, setProfileBaseline] = useState(() => ({
    nombre: roleData.nombre,
    email: roleData.email,
    telefono: roleData.telefono,
    idioma: language as string
  }));

  // Estados de contraseña
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    showCurrentPassword: false,
    showNewPassword: false,
    showConfirmPassword: false
  });
  // Nivel de seguridad de la nueva contraseña
  const [passwordStrength, setPasswordStrength] = useState<'none' | 'low' | 'medium' | 'strong' | 'very-strong'>('none');
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Estados de seguridad mínimos (solo para mostrar info de cuenta)
  const [security, setSecurity] = useState({
    ultimoAcceso: new Date().toLocaleString('es-VE'),
    ipUltimoAcceso: `192.168.1.${Math.floor(Math.random() * 255)}`
  });

  // UI state
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Cargar imagen de perfil desde la base de datos
    const loadUserImage = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('userlevel')
          .select('user_image')
          .eq('id', user.id)
          .single();

        if (data && data.user_image && !error) {
          setFormData(prev => ({ ...prev, fotoPreview: data.user_image }));
        } else {
          setFormData(prev => ({ ...prev, fotoPreview: null }));
        }
      }
    };

    loadUserImage();
  }, []);

  // Cargar datos del cliente si es rol cliente
  useEffect(() => {
    if (role === 'client' && clientName && clientEmail) {
      setFormData(prev => ({
        ...prev,
        nombre: clientName,
        email: clientEmail,
        telefono: clientPhone || ''
      }));
      setProfileBaseline(prev => ({
        ...prev,
        nombre: clientName,
        email: clientEmail,
        telefono: clientPhone || ''
      }));
    }
  }, [role, clientName, clientEmail, clientPhone]);

  // Inicializar idioma sólo al montar; no cambiar hasta guardar.
  useEffect(() => {
    setFormData(prev => ({ ...prev, idioma: language }));
    setProfileBaseline(prev => ({ ...prev, idioma: language }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (field: string, value: string) => {
    // Solo limitar longitud para campos solicitados
    const limitedValue = ['nombre', 'email'].includes(field) ? value.slice(0, MAX_FIELD_LENGTH) : value;
    let processed = limitedValue;
    if (field === 'telefono') {
      // Permitir + dígitos, espacios y guiones. Longitud máxima 20 para soportar formatos internacionales.
      processed = processed.replace(/[^+0-9\-\s]/g, '').slice(0, 20);
    }
    setFormData(prev => ({ ...prev, [field]: processed }));

  // Cambio de idioma diferido hasta guardar
  };

  const handlePasswordChange = (field: string, value: string) => {
    const limitedValue = value.slice(0, MAX_FIELD_LENGTH);
    setPasswordData(prev => ({ ...prev, [field]: limitedValue }));
    if (field === 'newPassword') {
      // Calcular fortaleza
      const pwd = limitedValue;
      if (!pwd) {
        setPasswordStrength('none');
      } else {
        let strength = 1; // base
        if (pwd.length >= 6) strength++;
        if (pwd.length >= 8 && /[A-Z]/.test(pwd)) strength++;
        if (pwd.length >= 10 && /[0-9]/.test(pwd)) strength++;
        if (pwd.length >= 12 && /[^A-Za-z0-9]/.test(pwd)) strength++;
        if (strength <= 1) setPasswordStrength('low');
        else if (strength === 2) setPasswordStrength('medium');
        else if (strength === 3) setPasswordStrength('strong');
        else setPasswordStrength('very-strong');
      }
    }
  };

  const handleSavePassword = async () => {
    try {
      // Validaciones de longitud (solo al guardar)
      if (
        passwordData.currentPassword.length > MAX_FIELD_LENGTH ||
        passwordData.newPassword.length > MAX_FIELD_LENGTH ||
        passwordData.confirmPassword.length > MAX_FIELD_LENGTH
      ) {
  toast({ title: t('common.error'), description: `Los campos de contraseña no pueden exceder ${MAX_FIELD_LENGTH} caracteres.`, variant: 'destructive', duration: 5000 });
        return;
      }
      if (!hasPasswordChanges) return; // No hay cambios reales
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
  toast({ title: t('common.error'), description: t('common.fillRequiredFields'), variant: 'destructive', duration: 5000 });
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
  toast({ title: t('admin.configuration.messages.passwordMismatch'), description: '', variant: 'destructive', duration: 5000 });
        return;
      }
      if (passwordData.newPassword.length < 6) {
  toast({ title: t('common.error'), description: 'La nueva contraseña debe tener al menos 6 caracteres.', variant: 'destructive', duration: 5000 });
        return;
      }
      if (passwordData.currentPassword === passwordData.newPassword) {
  toast({ title: t('common.error'), description: 'La nueva contraseña debe ser diferente a la actual.', variant: 'destructive', duration: 5000 });
        return;
      }

      setChangingPassword(true);
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
  toast({ title: t('common.error'), description: 'Usuario no autenticado.', variant: 'destructive', duration: 5000 });
        return;
      }

      // Reautenticar con la contraseña actual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.currentPassword,
      });
      if (signInError) {
  toast({ title: t('common.error'), description: 'La contraseña actual es incorrecta.', variant: 'destructive', duration: 5000 });
        return;
      }

      // Actualizar contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      if (updateError) {
  toast({ title: t('common.error'), description: `No se pudo actualizar la contraseña: ${updateError.message}`, variant: 'destructive', duration: 5000 });
        return;
      }

      // Limpiar campos y notificar
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        showCurrentPassword: false,
        showNewPassword: false,
        showConfirmPassword: false,
      });
  toast({ title: t('admin.configuration.messages.passwordUpdated'), description: t('admin.configuration.messages.passwordUpdatedDesc'), variant: 'default', duration: 5000 });
    } catch (e: any) {
  toast({ title: t('common.error'), description: e?.message || 'Error al actualizar la contraseña.', variant: 'destructive', duration: 5000 });
    } finally {
      setChangingPassword(false);
    }
  };

  // Convertir imagen a JPEG
  const convertToJPEG = (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.8);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
  toast({ title: 'Error', description: 'Usuario no autenticado.', variant: 'destructive', duration: 5000 });
      return;
    }

    const jpegBlob = await convertToJPEG(file);
    if (!jpegBlob) {
  toast({ title: 'Error', description: 'No se pudo convertir la imagen.', variant: 'destructive', duration: 5000 });
      return;
    }

    const fileName = `${user.id}-avatar-${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('avatar')
      .upload(fileName, jpegBlob, { upsert: true });

    if (error) {
  toast({ title: 'Error', description: `No se pudo subir la imagen: ${error.message}` , variant: 'destructive', duration: 5000 });
      return;
    }

    const { data: urlData } = supabase.storage.from('avatar').getPublicUrl(fileName);

    // Guardar URL en tabla userlevel
    const { error: updateError } = await supabase
      .from('userlevel')
      .update({ user_image: urlData.publicUrl })
      .eq('id', user.id);

    if (updateError) {
  toast({ title: 'Error', description: `No se pudo guardar la URL: ${updateError.message}`, variant: 'destructive', duration: 5000 });
      return;
    }

  // Estado local + callback al contenedor
  setFormData(prev => ({ ...prev, fotoPreview: urlData.publicUrl, fotoVersion: prev.fotoVersion + 1 }));
    // Añadimos un query param único sólo para la versión global (Sidebar)
    onUserImageUpdate?.(`${urlData.publicUrl}?v=${Date.now()}`);

  toast({ title: t('admin.configuration.messages.photoUpdated'), description: t('admin.configuration.messages.photoUpdatedDesc'), variant: 'default', duration: 5000 });
  };

  const handleDeletePhoto = async () => {
    if (deletingPhoto) return;
    setDeletingPhoto(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
  toast({ title: 'Error', description: 'Usuario no autenticado.', variant: 'destructive', duration: 5000 });
        return;
      }

      // Listar archivos y eliminar los del usuario
      const { data: files, error: listError } = await supabase.storage.from('avatar').list();
      if (listError) {
        // Continuar incluso si falla el listado
      }
      const userFiles = (files || []).filter(f => f.name.startsWith(`${user.id}-avatar`));
      const fileNames = userFiles.map(f => f.name);
      if (fileNames.length > 0) {
        await supabase.storage.from('avatar').remove(fileNames);
      }

      // Limpiar referencia en la tabla
      await supabase.from('userlevel').update({ user_image: null }).eq('id', user.id);

      // Estado local + callback
  setFormData(prev => ({ ...prev, fotoPreview: null, fotoVersion: prev.fotoVersion + 1 }));
      onUserImageUpdate?.(undefined);

  toast({ title: t('admin.configuration.messages.photoDeleted'), description: t('admin.configuration.messages.photoDeletedDesc'), variant: 'default', duration: 5000 });
    } catch (err) {
  toast({ title: 'Error', description: 'No se pudo eliminar la foto.', variant: 'destructive', duration: 5000 });
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    // Validaciones de longitud solo al guardar (el input ya está limitado, esto es por seguridad extra)
    if (formData.nombre.length > MAX_FIELD_LENGTH || formData.email.length > MAX_FIELD_LENGTH) {
  toast({ title: t('common.error'), description: `Nombre y correo no pueden exceder ${MAX_FIELD_LENGTH} caracteres.`, variant: 'destructive', duration: 5000 });
      return;
    }
    if (!hasProfileChanges) return; // Nada que guardar

    try {
      // Guardar teléfono en user_metadata si es cliente y cambió
      if (role === 'client' && formData.telefono !== profileBaseline.telefono) {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.updateUser({
          data: { phone: formData.telefono }
        });
        if (error) {
          console.error('Error updating phone:', error);
          toast({ title: t('common.error'), description: 'Error al guardar el teléfono', variant: 'destructive', duration: 5000 });
          return;
        }
        // Actualizar contexto
        setClient({ clientPhone: formData.telefono });
      }

      if (formData.idioma && ['es', 'en', 'zh'].includes(formData.idioma) && formData.idioma !== committedLanguage) {
        console.log('[config][saveProfile] committing language USING formData.idioma', {
          formDataIdioma: formData.idioma,
          visibleBefore: language,
          committedBefore: committedLanguage
        });
        commitLanguage(formData.idioma as any);
        console.log('[config][saveProfile] committed language', { committedLanguageAfter: formData.idioma });
      }
      toast({ title: t('admin.configuration.messages.profileUpdated'), description: t('admin.configuration.messages.profileUpdatedDesc'), variant: 'default', duration: 5000 });
      // Actualizar baseline tras guardar
      setProfileBaseline({
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        idioma: language as string
      });
      didSaveRef.current = true;
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: t('common.error'), description: 'Error al guardar el perfil', variant: 'destructive', duration: 5000 });
    }
  };

  // Derivados para habilitar/deshabilitar botones
  const hasProfileChanges =
    formData.nombre !== profileBaseline.nombre ||
    formData.email !== profileBaseline.email ||
    formData.telefono !== profileBaseline.telefono ||
    formData.idioma !== profileBaseline.idioma;

  const hasPasswordChanges =
    passwordData.currentPassword.length > 0 ||
    passwordData.newPassword.length > 0 ||
    passwordData.confirmPassword.length > 0;

  const canSavePassword =
    hasPasswordChanges &&
    passwordData.currentPassword.length > 0 &&
    passwordData.newPassword.length >= 6 &&
    passwordData.newPassword === passwordData.confirmPassword &&
    passwordData.currentPassword !== passwordData.newPassword &&
    passwordData.currentPassword.length <= MAX_FIELD_LENGTH &&
    passwordData.newPassword.length <= MAX_FIELD_LENGTH &&
    passwordData.confirmPassword.length <= MAX_FIELD_LENGTH;

  // Feedback visual de coincidencia de contraseñas
  const passwordMismatch =
    passwordData.newPassword.length > 0 &&
    passwordData.confirmPassword.length > 0 &&
    passwordData.newPassword !== passwordData.confirmPassword;
  const passwordMatch =
    passwordData.newPassword.length > 0 &&
    passwordData.confirmPassword.length > 0 &&
    passwordData.newPassword === passwordData.confirmPassword;

  // Revertir idioma preview SOLO al desmontar si no se guardó (evita revert accidental post-commit)
  const unmountLanguageRef = React.useRef({
    formIdioma: formData.idioma,
    baselineIdioma: profileBaseline.idioma,
    visible: language,
    committed: committedLanguage,
  });

  useEffect(() => {
    unmountLanguageRef.current = {
      formIdioma: formData.idioma,
      baselineIdioma: profileBaseline.idioma,
      visible: language,
      committed: committedLanguage,
    };
  }, [formData.idioma, profileBaseline.idioma, language, committedLanguage]);

  useEffect(() => {
    return () => {
      if (didSaveRef.current) {
        console.log('[config][unmount] skip revert (already saved)');
        return;
      }
      const { formIdioma, baselineIdioma, visible, committed } = unmountLanguageRef.current;
      const hasUnsaved = formIdioma !== baselineIdioma;
      const visibleDiffers = visible !== committed;
      if (hasUnsaved && visibleDiffers) {
        console.log('[config][unmount] reverting unsaved language change', unmountLanguageRef.current);
        revertLanguage();
      } else {
        console.log('[config][unmount] no revert needed', unmountLanguageRef.current);
      }
    };
  }, [revertLanguage]);

  const strengthText = (() => {
    switch (passwordStrength) {
      case 'low': return t('auth.common.passwordLevelLow');
      case 'medium': return t('auth.common.passwordLevelMedium');
      case 'strong': return t('auth.common.passwordLevelStrong');
      case 'very-strong': return t('auth.common.passwordLevelVeryStrong');
      default: return '';
    }
  })();

  if (!mounted) return null;

  return (
    <div className={`min-h-screen flex overflow-x-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
      <Sidebar
        isExpanded={sidebarExpanded}
        setIsExpanded={setSidebarExpanded}
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
        userRole={role}
      />

      <main className={`transition-all duration-300 flex-1 ${sidebarExpanded ? 'lg:ml-72 lg:w-[calc(100%-18rem)]' : 'lg:ml-24 lg:w-[calc(100%-6rem)]'}`}>
        {/* Header */}
        <header className={mounted && theme === 'dark' ? 'bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-40' : 'bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40'}>
          <div className="px-4 md:px-5 lg:px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {t('admin.configuration.title')}
                </h1>
                <p className={`text-sm md:text-base ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('admin.configuration.subtitle')}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Contenido principal */}
        <div className="p-4 md:p-5 lg:p-6 space-y-6 md:space-y-8">
          <Tabs defaultValue="perfil" className="space-y-6">
            <TabsList className={role === 'admin' ? 'grid w-full grid-cols-3 md:grid-cols-3 lg:w-auto lg:grid-cols-3 gap-1' : 'grid w-full grid-cols-2 md:grid-cols-2 lg:w-auto lg:grid-cols-2 gap-1'}>
              <TabsTrigger value="perfil" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <User className="w-3 h-3 md:w-4 md:h-4" />
                <span>{t('admin.configuration.tabs.profile')}</span>
              </TabsTrigger>
              <TabsTrigger value="preferencias" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                <Globe className="w-3 h-3 md:w-4 md:h-4" />
                <span>{t('admin.configuration.tabs.preferences')}</span>
              </TabsTrigger>
              {role === 'admin' && (
                <TabsTrigger value="reviews" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <Star className="w-3 h-3 md:w-4 md:h-4" />
                  <span>{t('admin.configuration.tabs.reviews')}</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Tab Perfil */}
            <TabsContent value="perfil" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Información del perfil */}
                <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200 dark:bg-slate-800/80 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        {t('admin.configuration.profile.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="nombre">{t('admin.configuration.profile.fields.name')}</Label>
                          <Input
                            id="nombre"
                            value={formData.nombre}
                            onChange={(e) => handleInputChange('nombre', e.target.value)}
                            maxLength={MAX_FIELD_LENGTH}
                            placeholder={t('admin.configuration.profile.placeholders.name')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">{t('admin.configuration.profile.fields.email')}</Label>
                          <Input
                            id="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            maxLength={MAX_FIELD_LENGTH}
                            placeholder={t('admin.configuration.profile.placeholders.email')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="telefono">{t('admin.configuration.profile.fields.phone')}</Label>
                          <Input
                            id="telefono"
                            value={formData.telefono}
                            onChange={(e) => handleInputChange('telefono', e.target.value)}
                            maxLength={20}
                            placeholder="+58 412-123-4567"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="idioma">{t('admin.configuration.profile.fields.language')}</Label>
                          <Select value={String(formData.idioma)} onValueChange={(value) => {
                            handleInputChange('idioma', value);
                            if (value === 'es' || value === 'en' || value === 'zh') {
                              // Preview inmediato sin persistir
                              previewLanguage(value as any);
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('admin.configuration.profile.placeholders.selectLanguage')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="es">🇪🇸 {t('common.spanish')}</SelectItem>
                              <SelectItem value="en">🇺🇸 {t('common.english')}</SelectItem>
                              <SelectItem value="zh">🇨🇳 {t('common.chinese')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={handleSaveProfile} disabled={!hasProfileChanges}>
                          <Save className="w-4 h-4 mr-2" />
                          {t('common.save')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cambiar contraseña */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200 dark:bg-slate-800/80 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        {t('admin.configuration.password.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label>{t('admin.configuration.password.fields.current')}</Label>
                          <div className="relative">
                            <Input
                              type={passwordData.showCurrentPassword ? 'text' : 'password'}
                              value={passwordData.currentPassword}
                              onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                              maxLength={MAX_FIELD_LENGTH}
                              placeholder={t('admin.configuration.password.placeholders.current')}
                            />
                            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500" onClick={() => setPasswordData(p => ({ ...p, showCurrentPassword: !p.showCurrentPassword }))}>
                              {passwordData.showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t('admin.configuration.password.fields.new')}</Label>
                          <div className="relative">
                            <Input
                              type={passwordData.showNewPassword ? 'text' : 'password'}
                              value={passwordData.newPassword}
                              onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                              maxLength={MAX_FIELD_LENGTH}
                              className={`${passwordMismatch ? 'border-red-500 focus-visible:ring-red-500' : passwordMatch ? 'border-blue-500 focus-visible:ring-blue-500' : ''}`}
                              placeholder={t('admin.configuration.password.placeholders.new')}
                              onFocus={() => setNewPasswordFocused(true)}
                              onBlur={() => setNewPasswordFocused(false)}
                            />
                            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500" onClick={() => setPasswordData(p => ({ ...p, showNewPassword: !p.showNewPassword }))}>
                              {passwordData.showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {newPasswordFocused && passwordStrength !== 'none' && (
                            <div className="mt-1 space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-medium">
                                <span className={`
                                  ${passwordStrength === 'low' && 'text-red-600'}
                                  ${passwordStrength === 'medium' && 'text-yellow-600'}
                                  ${passwordStrength === 'strong' && 'text-green-600'}
                                  ${passwordStrength === 'very-strong' && 'text-emerald-600'}
                                `}>{strengthText}</span>
                                <span className="text-slate-400">{passwordData.newPassword.length}/{MAX_FIELD_LENGTH}</span>
                              </div>
                              <div className="h-1 w-full rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <div className={`h-full transition-all duration-300
                                  ${passwordStrength === 'low' && 'w-1/5 bg-red-500'}
                                  ${passwordStrength === 'medium' && 'w-2/5 bg-yellow-500'}
                                  ${passwordStrength === 'strong' && 'w-3/5 bg-green-500'}
                                  ${passwordStrength === 'very-strong' && 'w-full bg-emerald-500'}
                                `} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>{t('admin.configuration.password.fields.confirm')}</Label>
                          <div className="relative">
                            <Input
                              type={passwordData.showConfirmPassword ? 'text' : 'password'}
                              value={passwordData.confirmPassword}
                              onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                              maxLength={MAX_FIELD_LENGTH}
                              className={`${passwordMismatch ? 'border-red-500 focus-visible:ring-red-500' : passwordMatch ? 'border-blue-500 focus-visible:ring-blue-500' : ''}`}
                              placeholder={t('admin.configuration.password.placeholders.confirm')}
                            />
                            {passwordMismatch && (
                              <p className="mt-1 text-xs text-red-600">{t('admin.configuration.messages.passwordMismatch')}</p>
                            )}
                            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500" onClick={() => setPasswordData(p => ({ ...p, showConfirmPassword: !p.showConfirmPassword }))}>
                              {passwordData.showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={handleSavePassword} disabled={!canSavePassword || changingPassword}>
                          <Save className="w-4 h-4 mr-2" />
                          {changingPassword ? t('common.loading') : t('common.save')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Foto de perfil + Info de la cuenta (primero en mobile/tablet) */}
                <div className="space-y-6 order-1 lg:order-2">
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200 dark:bg-slate-800/80 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        {t('admin.configuration.profile.profilePicture.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center">
                          {formData.fotoPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`${formData.fotoPreview}${formData.fotoPreview.includes('?') ? '&' : '?'}v=${formData.fotoVersion}`}
                              alt="avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-14 h-14 md:w-16 md:h-16 text-slate-500" />
                          )}
                        </div>
                        <div className="space-y-2 w-full">
                          <label htmlFor="avatar-upload" className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer text-sm w-full justify-center">
                            <Upload className="w-4 h-4" /> {t('admin.configuration.profile.profilePicture.uploadButton')}
                          </label>
                          <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="inline-flex items-center gap-2 w-full justify-center"
                                disabled={!formData.fotoPreview || deletingPhoto}
                              >
                                <Trash2 className="w-4 h-4" /> {t('admin.configuration.profile.profilePicture.deleteButton')}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                {/* Usar la clave sin el prefijo 'admin' según estructura existente (client.configuration...) */}
                                <AlertDialogTitle>{t('client.configuration.profile.profilePicture.confirmDeleteTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('common.actionCannotBeUndone')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDeletePhoto}
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  disabled={deletingPhoto}
                                >
                                  {deletingPhoto ? t('common.loading') : t('common.delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200 dark:bg-slate-800/80 dark:border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        {t('admin.configuration.profile.accountInfo.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{t('admin.configuration.profile.accountInfo.role')}</span>
                        <Badge className="bg-purple-500">{roleData.rol}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{t('admin.configuration.profile.accountInfo.accountStatus')}</span>
                        <Badge className="bg-green-500">{t('admin.configuration.profile.accountInfo.statuses.Activo')}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{t('admin.configuration.profile.accountInfo.memberSince')}</span>
                        <span className="text-sm font-medium">{t('admin.configuration.profile.accountInfo.months.Enero')} 2024</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{t('admin.configuration.profile.accountInfo.lastLogin')}</span>
                        <span className="text-sm font-medium">{security.ultimoAcceso}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Tab Preferencias */}
            <TabsContent value="preferencias" className="space-y-6">
              <div className="flex justify-center">
                <div className="w-full max-w-2xl">
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200 dark:bg-slate-800/80 dark:border-slate-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="w-5 h-5" />
                      {t('admin.configuration.preferences.theme.appearance')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('admin.configuration.preferences.theme.title')}</Label>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant={mounted && theme === 'light' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTheme('light')}
                          className="flex-1 min-w-0 flex items-center gap-2"
                        >
                          <Sun className="w-4 h-4" />
                          {t('admin.configuration.preferences.theme.light')}
                        </Button>
                        <Button
                          variant={mounted && theme === 'dark' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTheme('dark')}
                          className="flex-1 min-w-0 flex items-center gap-2"
                        >
                          <Moon className="w-4 h-4" />
                          {t('admin.configuration.preferences.theme.dark')}
                        </Button>
                      </div>
                      {mounted && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {t('admin.configuration.preferences.theme.currentTheme')}: {theme === 'light' ? t('admin.configuration.preferences.theme.light') : t('admin.configuration.preferences.theme.dark')}
                        </p>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label>{t('admin.configuration.preferences.theme.fontSize')}</Label>
                      <Select defaultValue="medium">
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el tamaño" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">{t('admin.configuration.preferences.theme.fontSizes.small')}</SelectItem>
                          <SelectItem value="medium">{t('admin.configuration.preferences.theme.fontSizes.medium')}</SelectItem>
                          <SelectItem value="large">{t('admin.configuration.preferences.theme.fontSizes.large')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Tab Reseñas (solo para admin) */}
            {role === 'admin' && (
              <TabsContent value="reviews" className="space-y-6">
                <AdminReviewsSection />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  );
}

// Componente para la sección de reseñas del admin
function AdminReviewsSection() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/reviews');
      if (response.ok) {
        const data = await response.json();
        // La API devuelve { success: true, reviews: [...], count: ... }
        setReviews(data.reviews || data || []);
      } else {
        console.error('Error fetching reviews');
        setReviews([]);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : mounted && theme === 'dark'
                ? 'text-slate-600'
                : 'text-slate-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200 dark:bg-slate-800/80 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5" />
          {t('admin.configuration.reviews.title', { fallback: 'Reseñas de clientes' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
              {t('admin.configuration.reviews.loading', { fallback: 'Cargando reseñas...' })}
            </p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8">
            <Star className={`w-12 h-12 mx-auto mb-4 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
              {t('admin.configuration.reviews.noReviews', { fallback: 'No hay reseñas aún' })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className={`p-4 rounded-lg border ${
                  mounted && theme === 'dark'
                    ? 'bg-slate-700/50 border-slate-600'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {t('admin.configuration.reviews.order', { fallback: 'Pedido' })} #{review.orderId}
                      </Badge>
                      <span className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                        {review.orderProductName}
                      </span>
                    </div>
                    <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t('admin.configuration.reviews.client', { fallback: 'Cliente' })}:{' '}
                      <span className="font-medium">{review.clientName}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    {renderStars(review.rating)}
                    <p className={`text-xs mt-1 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {review.reviewText && (
                  <div className={`mt-3 p-3 rounded ${
                    mounted && theme === 'dark' ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-800'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{review.reviewText}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
