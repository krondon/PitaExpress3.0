"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Users, Loader2, Check, Camera } from 'lucide-react';
import { useChatUpload } from '@/hooks/use-chat-upload';
import { useChatGroups } from '@/hooks/use-chat-groups';
import type { SearchUserResult } from '@/lib/types/chat';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/hooks/useTranslation';

interface CreateGroupModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentUserId: string;
    onGroupCreated?: (groupId: string, groupName: string) => void;
}

// Colores por rol para diferenciar visualmente
const roleColors: Record<string, string> = {
    'Admin': 'bg-purple-500',
    'China': 'bg-red-500',
    'Vzla': 'bg-yellow-500',
    'Venezuela': 'bg-yellow-500',
    'Pagos': 'bg-green-500',
    'Client': 'bg-blue-500',
};

const getRoleBadgeColor = (role: string) => {
    return roleColors[role] || 'bg-slate-500';
};

export function CreateGroupModal({
    open,
    onOpenChange,
    currentUserId,
    onGroupCreated,
}: CreateGroupModalProps) {
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const [allUsers, setAllUsers] = useState<SearchUserResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { searchUsers, createGroup, updateGroup } = useChatGroups({ currentUserId });
    const { uploadFile } = useChatUpload();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Cargar todos los usuarios al abrir el modal
    useEffect(() => {
        const loadUsers = async () => {
            if (open && currentUserId) {
                setLoading(true);
                // Buscar con query vacío para obtener todos los usuarios
                const results = await searchUsers('');
                // Filtrar el usuario actual
                const filtered = results.filter(u => u.user_id !== currentUserId);
                setAllUsers(filtered);
                setLoading(false);
            }
        };
        loadUsers();
    }, [open, currentUserId, searchUsers]);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setGroupName('');
            setGroupDescription('');
            setSearchQuery('');
            setSelectedMemberIds(new Set());
            setAvatarFile(null);
            setAvatarPreview(null);
        }
    }, [open]);

    // Filtrar usuarios por búsqueda
    const filteredUsers = allUsers.filter(user => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            user.name.toLowerCase().includes(query) ||
            user.role.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
        );
    });

    const handleToggleMember = useCallback((userId: string) => {
        setSelectedMemberIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    }, []);

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const objectUrl = URL.createObjectURL(file);
            setAvatarPreview(objectUrl);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedMemberIds.size === 0) return;

        setCreating(true);
        try {
            // 1. Crear el grupo
            const groupId = await createGroup({
                name: groupName.trim(),
                description: groupDescription.trim() || undefined,
                member_ids: Array.from(selectedMemberIds),
            });

            if (groupId) {
                // 2. Si hay avatar, subirlo y actualizar
                if (avatarFile) {
                    const fileData = await uploadFile(avatarFile);
                    if (fileData) {
                        await updateGroup(groupId, { avatar_url: fileData.url });
                    }
                }

                onOpenChange(false);
                onGroupCreated?.(groupId, groupName.trim());
            }
        } catch (error) {
            console.error('Error creating group:', error);
        } finally {
            setCreating(false);
        }
    };

    const isValid = groupName.trim().length > 0 && selectedMemberIds.size > 0;
    const selectedUsers = allUsers.filter(u => selectedMemberIds.has(u.user_id));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`sm:max-w-lg ${mounted && theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}`}>
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${mounted && theme === 'dark' ? 'text-white' : ''}`}>
                        <Users className="h-5 w-5 text-purple-500" />
                        {t('chat.groups.create.title') || 'Crear grupo'}
                    </DialogTitle>
                    <DialogDescription>
                        {t('chat.groups.create.description') || 'Crea un nuevo grupo de chat con los miembros que selecciones.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Avatar Selection */}
                    <div className="flex justify-center mb-2">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <Avatar className="w-20 h-20 border-2 border-dashed border-slate-300 hover:border-purple-500 transition-colors">
                                {avatarPreview ? (
                                    <AvatarImage src={avatarPreview} className="object-cover" />
                                ) : (
                                    <AvatarFallback className={mounted && theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'}>
                                        <Camera className="w-8 h-8 text-slate-400" />
                                    </AvatarFallback>
                                )}
                            </Avatar>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-white text-[10px] font-medium">Cambiar</p>
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleAvatarSelect}
                        />
                    </div>
                    {/* Group Name */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label htmlFor="groupName" className={mounted && theme === 'dark' ? 'text-slate-200' : ''}>
                                {t('chat.groups.create.name') || 'Nombre del grupo'} *
                            </Label>
                            <span className="text-xs text-slate-500">{groupName.length}/30</span>
                        </div>
                        <Input
                            id="groupName"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder={t('chat.groups.create.namePlaceholder') || 'Ej: Equipo de ventas'}
                            className={mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}
                            maxLength={30}
                        />
                    </div>

                    {/* Group Description */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label htmlFor="groupDescription" className={mounted && theme === 'dark' ? 'text-slate-200' : ''}>
                                {t('chat.groups.create.descriptionLabel') || 'Descripción (opcional)'}
                            </Label>
                            <span className="text-xs text-slate-500">{groupDescription.length}/100</span>
                        </div>
                        <Textarea
                            id="groupDescription"
                            value={groupDescription}
                            onChange={(e) => setGroupDescription(e.target.value)}
                            placeholder={t('chat.groups.create.descriptionPlaceholder') || 'Describe el propósito del grupo...'}
                            className={`resize-none ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}`}
                            rows={2}
                            maxLength={100}
                        />
                    </div>

                    {/* Members Selection */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className={mounted && theme === 'dark' ? 'text-slate-200' : ''}>
                                {t('chat.groups.create.members') || 'Seleccionar miembros'} *
                            </Label>
                            <Badge variant="secondary" className="text-xs">
                                {selectedMemberIds.size} {t('chat.groups.create.selected') || 'seleccionados'}
                            </Badge>
                        </div>

                        {/* Search/Filter Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('chat.groups.create.filterUsers') || 'Filtrar usuarios...'}
                                className={`pl-10 ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}`}
                            />
                        </div>

                        {/* Users List with Checkboxes */}
                        <ScrollArea className={`h-48 rounded-md border p-2 ${mounted && theme === 'dark' ? 'border-slate-600 bg-slate-700/50' : 'bg-slate-50'}`}>
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                    <Users className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="text-sm">
                                        {searchQuery
                                            ? (t('chat.groups.create.noUsersFound') || 'No se encontraron usuarios')
                                            : (t('chat.groups.create.noUsersAvailable') || 'No hay usuarios disponibles')
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredUsers.map((user) => {
                                        const isSelected = selectedMemberIds.has(user.user_id);
                                        return (
                                            <label
                                                key={user.user_id}
                                                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all
                                                    ${isSelected
                                                        ? (mounted && theme === 'dark'
                                                            ? 'bg-purple-900/40 border border-purple-500/50'
                                                            : 'bg-purple-50 border border-purple-200')
                                                        : (mounted && theme === 'dark'
                                                            ? 'hover:bg-slate-600'
                                                            : 'hover:bg-slate-100')
                                                    }
                                                `}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => handleToggleMember(user.user_id)}
                                                    className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                                />
                                                <Avatar className="w-9 h-9">
                                                    <AvatarImage src={user.avatar_url || ''} />
                                                    <AvatarFallback className={`${getRoleBadgeColor(user.role)} text-white text-sm`}>
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                                        {user.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] shrink-0 ${mounted && theme === 'dark' ? 'border-slate-600 text-slate-300' : ''}`}
                                                >
                                                    {user.role}
                                                </Badge>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Selected members summary */}
                        {selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {selectedUsers.slice(0, 5).map((user) => (
                                    <Badge
                                        key={user.user_id}
                                        variant="secondary"
                                        className="text-xs py-0.5"
                                    >
                                        {user.name.split(' ')[0]}
                                    </Badge>
                                ))}
                                {selectedUsers.length > 5 && (
                                    <Badge variant="secondary" className="text-xs py-0.5">
                                        +{selectedUsers.length - 5} más
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={creating}
                    >
                        {t('common.cancel') || 'Cancelar'}
                    </Button>
                    <Button
                        onClick={handleCreateGroup}
                        disabled={!isValid || creating}
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        {creating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('chat.groups.create.creating') || 'Creando...'}
                            </>
                        ) : (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                {t('chat.groups.create.create') || 'Crear grupo'}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
