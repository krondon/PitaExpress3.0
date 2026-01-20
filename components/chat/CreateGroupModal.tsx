"use client";

import { useState, useEffect, useCallback } from 'react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, X, Loader2, Plus, Check } from 'lucide-react';
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

export function CreateGroupModal({
    open,
    onOpenChange,
    currentUserId,
    onGroupCreated,
}: CreateGroupModalProps) {
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<SearchUserResult[]>([]);
    const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [creating, setCreating] = useState(false);

    const { searchUsers, createGroup } = useChatGroups({ currentUserId });
    const { theme } = useTheme();
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Reset state when modal closes
    useEffect(() => {
        if (!open) {
            setGroupName('');
            setGroupDescription('');
            setSearchQuery('');
            setSelectedMembers([]);
            setSearchResults([]);
        }
    }, [open]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setSearching(true);
                const results = await searchUsers(searchQuery);
                // Filter out already selected members and current user
                const filtered = results.filter(
                    (u) =>
                        u.user_id !== currentUserId &&
                        !selectedMembers.some((m) => m.user_id === u.user_id)
                );
                setSearchResults(filtered);
                setSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, currentUserId, selectedMembers, searchUsers]);

    const handleAddMember = useCallback((user: SearchUserResult) => {
        setSelectedMembers((prev) => [...prev, user]);
        setSearchQuery('');
        setSearchResults([]);
    }, []);

    const handleRemoveMember = useCallback((userId: string) => {
        setSelectedMembers((prev) => prev.filter((m) => m.user_id !== userId));
    }, []);

    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedMembers.length === 0) return;

        setCreating(true);
        try {
            const groupId = await createGroup({
                name: groupName.trim(),
                description: groupDescription.trim() || undefined,
                member_ids: selectedMembers.map((m) => m.user_id),
            });

            if (groupId) {
                onOpenChange(false);
                onGroupCreated?.(groupId, groupName.trim());
            }
        } catch (error) {
            console.error('Error creating group:', error);
        } finally {
            setCreating(false);
        }
    };

    const isValid = groupName.trim().length > 0 && selectedMembers.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`sm:max-w-md ${mounted && theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}`}>
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
                    {/* Group Name */}
                    <div className="space-y-2">
                        <Label htmlFor="groupName" className={mounted && theme === 'dark' ? 'text-slate-200' : ''}>
                            {t('chat.groups.create.name') || 'Nombre del grupo'} *
                        </Label>
                        <Input
                            id="groupName"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder={t('chat.groups.create.namePlaceholder') || 'Ej: Equipo de ventas'}
                            className={mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}
                            maxLength={50}
                        />
                    </div>

                    {/* Group Description */}
                    <div className="space-y-2">
                        <Label htmlFor="groupDescription" className={mounted && theme === 'dark' ? 'text-slate-200' : ''}>
                            {t('chat.groups.create.descriptionLabel') || 'Descripción (opcional)'}
                        </Label>
                        <Textarea
                            id="groupDescription"
                            value={groupDescription}
                            onChange={(e) => setGroupDescription(e.target.value)}
                            placeholder={t('chat.groups.create.descriptionPlaceholder') || 'Describe el propósito del grupo...'}
                            className={`resize-none ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}`}
                            rows={2}
                            maxLength={200}
                        />
                    </div>

                    {/* Member Search */}
                    <div className="space-y-2">
                        <Label className={mounted && theme === 'dark' ? 'text-slate-200' : ''}>
                            {t('chat.groups.create.members') || 'Miembros'} * ({selectedMembers.length} {t('chat.groups.create.selected') || 'seleccionados'})
                        </Label>

                        {/* Selected Members */}
                        {selectedMembers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedMembers.map((member) => (
                                    <Badge
                                        key={member.user_id}
                                        variant="secondary"
                                        className="flex items-center gap-1 py-1 px-2"
                                    >
                                        <span className="max-w-[100px] truncate">{member.name}</span>
                                        <button
                                            onClick={() => handleRemoveMember(member.user_id)}
                                            className="ml-1 hover:text-red-500 transition-colors"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('chat.groups.create.searchMembers') || 'Buscar usuarios para añadir...'}
                                className={`pl-10 ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}`}
                            />
                        </div>

                        {/* Search Results */}
                        {(searching || searchResults.length > 0) && (
                            <ScrollArea className={`h-32 rounded-md border p-2 ${mounted && theme === 'dark' ? 'border-slate-600 bg-slate-700/50' : 'bg-slate-50'}`}>
                                {searching ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {searchResults.map((user) => (
                                            <button
                                                key={user.user_id}
                                                onClick={() => handleAddMember(user)}
                                                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${mounted && theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-slate-100'}`}
                                            >
                                                <Avatar className="w-8 h-8">
                                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs">
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="text-left flex-1">
                                                    <p className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                                        {user.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{user.role}</p>
                                                </div>
                                                <Plus className="h-4 w-4 text-blue-500" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        )}

                        {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-2">
                                {t('chat.groups.create.noUsersFound') || 'No se encontraron usuarios'}
                            </p>
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
