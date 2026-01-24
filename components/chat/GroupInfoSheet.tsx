"use client";

import { useState, useEffect, useCallback } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Users, UserPlus, UserMinus, Crown, Loader2, LogOut, Trash2, FileText, Image as ImageIcon, MoreVertical } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useChatGroups } from '@/hooks/use-chat-groups';
import type { ChatGroupMember, SearchUserResult } from '@/lib/types/chat';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/hooks/useTranslation';

interface GroupInfoSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groupId: string;
    groupName: string;
    currentUserId: string;
    onLeaveGroup?: () => void;
    onDeleteGroup?: () => void;
    isOwner?: boolean;
}

export function GroupInfoSheet({
    open,
    onOpenChange,
    groupId,
    groupName,
    currentUserId,
    onLeaveGroup,
    onDeleteGroup,
    isOwner = false,
}: GroupInfoSheetProps) {
    const [members, setMembers] = useState<ChatGroupMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const [adding, setAdding] = useState<string | null>(null);

    // Media State
    const [media, setMedia] = useState<any[]>([]);
    const [loadingMedia, setLoadingMedia] = useState(false);

    useEffect(() => {
        if (open && groupId) {
            const loadMedia = async () => {
                setLoadingMedia(true);
                const supabase = getSupabaseBrowserClient();
                const { data } = await supabase
                    .from('chat_messages')
                    .select('*')
                    .eq('group_id', groupId)
                    .not('file_url', 'is', null)
                    .order('created_at', { ascending: false });
                if (data) setMedia(data);
                setLoadingMedia(false);
            };
            loadMedia();
        }
    }, [open, groupId]);

    const { getGroupMembers, addMember, removeMember, promoteMember, demoteMember, leaveGroup, deleteGroup, searchUsers, groups } = useChatGroups({ currentUserId });
    const { theme } = useTheme();
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Load members when sheet opens
    useEffect(() => {
        const loadMembers = async () => {
            if (open && groupId) {
                setLoading(true);
                const groupMembers = await getGroupMembers(groupId);
                setMembers(groupMembers);
                setLoading(false);
            }
        };
        loadMembers();
    }, [open, groupId, getGroupMembers]);

    // Search users
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length >= 2 && showAddMembers) {
                setSearching(true);
                const results = await searchUsers(searchQuery);
                // Filter out existing members and current user
                const filtered = results.filter(
                    (u) => !members.some((m) => m.user_id === u.user_id)
                );
                setSearchResults(filtered);
                setSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, showAddMembers, members, searchUsers]);

    const currentUserMember = members.find((m) => m.user_id === currentUserId);
    const isAdmin = currentUserMember?.role === 'admin' || isOwner;

    const handleAddMember = async (userId: string) => {
        setAdding(userId);
        const success = await addMember(groupId, userId);
        if (success) {
            // Refresh members list
            const updatedMembers = await getGroupMembers(groupId);
            setMembers(updatedMembers);
            setSearchQuery('');
            setSearchResults([]);
        }
        setAdding(null);
    };

    const handlePromoteMember = async (userId: string) => {
        const success = await promoteMember(groupId, userId);
        if (success) {
            const updatedMembers = await getGroupMembers(groupId);
            setMembers(updatedMembers);
        }
    };

    const handleDemoteMember = async (userId: string) => {
        const success = await demoteMember(groupId, userId);
        if (success) {
            const updatedMembers = await getGroupMembers(groupId);
            setMembers(updatedMembers);
        }
    };

    const confirmRemoveMember = async () => {
        if (!memberToRemove) return;
        setRemoving(memberToRemove);
        const success = await removeMember(groupId, memberToRemove);
        if (success) {
            setMembers((prev) => prev.filter((m) => m.user_id !== memberToRemove));
        }
        setRemoving(null);
        setRemoveMemberDialogOpen(false);
        setMemberToRemove(null);
    };

    const handleLeaveGroup = async () => {
        const success = await leaveGroup(groupId);
        if (success) {
            setLeaveDialogOpen(false);
            onOpenChange(false);
            onLeaveGroup?.();
        }
    };

    const handleDeleteGroup = async () => {
        const success = await deleteGroup(groupId);
        if (success) {
            setDeleteDialogOpen(false);
            onOpenChange(false);
            onDeleteGroup?.();
        }
    };

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className={`w-80 sm:w-96 ${mounted && theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}`}>
                    <SheetHeader>
                        <SheetTitle className={`flex items-center gap-2 ${mounted && theme === 'dark' ? 'text-white' : ''}`}>
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={groups.find(g => g.id === groupId)?.avatar_url || ''} />
                                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 text-white flex items-center justify-center">
                                    <Users className="h-5 w-5" />
                                </AvatarFallback>
                            </Avatar>
                            {groupName}
                        </SheetTitle>
                        <SheetDescription>
                            {t('chat.groups.info.description') || 'Información del grupo y miembros'}
                        </SheetDescription>
                    </SheetHeader>

                    <Tabs defaultValue="info" className="flex flex-col h-full mt-6">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="info">{t('chat.groups.info.tabs.info') || 'Info'}</TabsTrigger>
                            <TabsTrigger value="media">{t('chat.groups.info.tabs.media') || 'Multimedia'}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="info" className="flex-1 overflow-visible">
                            <ScrollArea className="h-[calc(100vh-10rem)] pr-4">
                                <div className="space-y-4">
                                    {/* Members Section */}
                                    <div className="flex items-center justify-between">
                                        <h3 className={`text-sm font-medium ${mounted && theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                            {t('chat.groups.info.members') || 'Miembros'} ({members.length})
                                        </h3>
                                        {isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowAddMembers(!showAddMembers)}
                                                className="h-8"
                                            >
                                                <UserPlus className="h-4 w-4 mr-1" />
                                                {t('chat.groups.info.addMember') || 'Añadir'}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Add Members Search */}
                                    {showAddMembers && (
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <Input
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder={t('chat.groups.info.searchUsers') || 'Buscar usuarios...'}
                                                    className={`pl-10 ${mounted && theme === 'dark' ? 'bg-slate-700 border-slate-600' : ''}`}
                                                />
                                            </div>

                                            {(searching || searchResults.length > 0) && (
                                                <div className={`rounded-md border p-2 max-h-32 overflow-y-auto ${mounted && theme === 'dark' ? 'border-slate-600 bg-slate-700/50' : 'bg-slate-50'}`}>
                                                    {searching ? (
                                                        <div className="flex items-center justify-center py-2">
                                                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            {searchResults.map((user) => (
                                                                <button
                                                                    key={user.user_id}
                                                                    onClick={() => handleAddMember(user.user_id)}
                                                                    disabled={adding === user.user_id}
                                                                    className={`w-full flex items-center gap-2 p-2 rounded transition-colors ${mounted && theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-slate-100'}`}
                                                                >
                                                                    <Avatar className="w-6 h-6">
                                                                        <AvatarImage src={user.avatar_url || ''} />
                                                                        <AvatarFallback className="bg-blue-500 text-white text-xs">
                                                                            {user.name.charAt(0)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <span className={`text-sm flex-1 text-left ${mounted && theme === 'dark' ? 'text-white' : ''}`}>
                                                                        {user.name}
                                                                    </span>
                                                                    {adding === user.user_id ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <UserPlus className="h-4 w-4 text-green-500" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <Separator />

                                    {/* Members List */}
                                    <ScrollArea className="h-[300px] pr-2">
                                        {loading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {members.map((member) => (
                                                    <div
                                                        key={member.user_id}
                                                        className={`flex items-center gap-3 p-2 rounded-lg ${mounted && theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-50'}`}
                                                    >
                                                        <Avatar className="w-10 h-10">
                                                            <AvatarImage src={member.user_avatar || ''} />
                                                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                                                                {(member.user_name || 'U').charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-medium truncate ${mounted && theme === 'dark' ? 'text-white' : ''}`}>
                                                                    {member.user_name || 'Usuario'}
                                                                    {member.user_id === currentUserId && (
                                                                        <span className="text-slate-500"> (tú)</span>
                                                                    )}
                                                                </span>
                                                                {member.role === 'admin' && (
                                                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                                                        <Crown className="h-2.5 w-2.5 mr-0.5" />
                                                                        Admin
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Actions menu (only for admins, can't act on yourself or the owner) */}
                                                        {isAdmin &&
                                                            member.user_id !== currentUserId &&
                                                            member.user_id !== groups.find(g => g.id === groupId)?.created_by && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                                            <MoreVertical className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        {member.role !== 'admin' ? (
                                                                            <DropdownMenuItem onClick={() => handlePromoteMember(member.user_id)}>
                                                                                <Crown className="mr-2 h-4 w-4" />
                                                                                {t('chat.groups.members.promote') || 'Hacer administrador'}
                                                                            </DropdownMenuItem>
                                                                        ) : (
                                                                            // Only show demote if the target is NOT the group owner
                                                                            groups.find(g => g.id === groupId)?.created_by !== member.user_id && (
                                                                                <DropdownMenuItem onClick={() => handleDemoteMember(member.user_id)}>
                                                                                    <UserMinus className="mr-2 h-4 w-4" />
                                                                                    {t('chat.groups.members.demote') || 'Quitar administrador'}
                                                                                </DropdownMenuItem>
                                                                            )
                                                                        )}
                                                                        {/* Solo permitir eliminar si NO es el dueño del grupo */}
                                                                        {groups.find(g => g.id === groupId)?.created_by !== member.user_id && (
                                                                            <DropdownMenuItem
                                                                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                                                onClick={() => {
                                                                                    setMemberToRemove(member.user_id);
                                                                                    setRemoveMemberDialogOpen(true);
                                                                                }}
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                {t('common.delete') || 'Eliminar'}
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>

                                    <Separator />

                                    {/* Actions */}
                                    <div className="space-y-2">
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => setLeaveDialogOpen(true)}
                                        >
                                            <LogOut className="h-4 w-4 mr-2" />
                                            {t('chat.groups.info.leaveGroup') || 'Salir del grupo'}
                                        </Button>

                                        {isOwner && (
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => setDeleteDialogOpen(true)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                {t('chat.groups.info.deleteGroup') || 'Eliminar grupo'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="media" className="flex-1 h-full overflow-hidden">
                            <ScrollArea className="h-[calc(100vh-10rem)] pr-4">
                                {loadingMedia ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                    </div>
                                ) : media.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p>{t('chat.groups.info.media.empty') || 'No hay archivos'}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6 pb-6">
                                        {/* Photos Grid */}
                                        {media.filter(m => m.file_type?.startsWith('image')).length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                    <ImageIcon className="w-4 h-4" />
                                                    {t('chat.groups.info.media.photos') || 'Fotos'}
                                                </h4>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {media.filter(m => m.file_type?.startsWith('image')).map((m) => (
                                                        <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer" className="aspect-square relative rounded overflow-hidden border bg-slate-100 hover:opacity-90 transition-opacity group">
                                                            <img src={m.file_url} alt="Shared" className="w-full h-full object-cover" />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Documents List */}
                                        {media.filter(m => !m.file_type?.startsWith('image')).length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                    <FileText className="w-4 h-4" />
                                                    {t('chat.groups.info.media.documents') || 'Documentos'}
                                                </h4>
                                                <div className="space-y-2">
                                                    {media.filter(m => !m.file_type?.startsWith('image')).map((m) => (
                                                        <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50 hover:bg-slate-100 transition-colors">
                                                            <div className="p-2 bg-white rounded border">
                                                                <FileText className="w-5 h-5 text-blue-500" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium truncate">{m.file_name || 'Documento'}</p>
                                                                <p className="text-xs text-slate-500">{new Date(m.created_at).toLocaleDateString()}</p>
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </SheetContent>
            </Sheet>

            {/* Leave Group Dialog */}
            <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('chat.groups.leave.title') || '¿Salir del grupo?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('chat.groups.leave.description') || 'Ya no podrás ver los mensajes de este grupo.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel') || 'Cancelar'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleLeaveGroup}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {t('chat.groups.leave.confirm') || 'Salir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Group Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('chat.groups.delete.title') || '¿Eliminar grupo?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('chat.groups.delete.description') || 'Esta acción no se puede deshacer. Se eliminarán todos los mensajes del grupo.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel') || 'Cancelar'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteGroup}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {t('chat.groups.delete.confirm') || 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Remove Member Dialog */}
            <AlertDialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('chat.groups.members.remove.title') || '¿Eliminar miembro?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('chat.groups.members.remove.description') || 'Este usuario será eliminado del grupo.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel') || 'Cancelar'}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRemoveMember}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {t('common.confirm') || 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
