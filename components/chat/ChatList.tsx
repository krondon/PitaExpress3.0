"use client";

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Search, Loader2, MessageCircle, MoreVertical, Trash2, ChevronLeft, ChevronRight, Users, Plus, UserPlus, Info } from 'lucide-react';
import type { ChatConversation, ChatConversationLegacy, SearchUserResult } from '@/lib/types/chat';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/hooks/useTranslation';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupInfoSheet } from './GroupInfoSheet';

interface ChatListProps {
    onSelectConversation: (conversationId: string, name: string, avatarUrl?: string) => void;
    selectedUserId: string | null;
    currentUserId: string | null;
}

const ITEMS_PER_PAGE = 10;

// Tipo interno para manejar ambos formatos
interface DisplayConversation {
    id: string; // 'user_UUID' o 'group_UUID'
    isGroup: boolean;
    name: string;
    avatar?: string;
    lastMessage: string | null;
    lastMessageTime: string | null;
    unreadCount: number;
    email?: string;
}

export function ChatList({ onSelectConversation, selectedUserId, currentUserId }: ChatListProps) {
    const [conversations, setConversations] = useState<DisplayConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Estado para búsqueda de nuevos usuarios
    const [showNewChat, setShowNewChat] = useState(false);
    const [searchUsersQuery, setSearchUsersQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    // Estado para modal de crear grupo
    const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
    // Estado para sheet de info de grupo
    const [groupInfoOpen, setGroupInfoOpen] = useState(false);
    const [selectedGroupForInfo, setSelectedGroupForInfo] = useState<{ id: string, name: string } | null>(null);

    const supabase = getSupabaseBrowserClient();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const loadConversations = useCallback(async () => {
        if (!currentUserId) {
            setConversations([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Intentar usar la nueva RPC unificada (con grupos)
            const { data: unifiedData, error: unifiedError } = await supabase
                .rpc('get_chat_conversations', { for_user_id: currentUserId });

            if (!unifiedError && unifiedData && unifiedData.length > 0) {
                // Mapear al formato de display
                const mapped: DisplayConversation[] = (unifiedData as ChatConversation[]).map(conv => ({
                    id: conv.conversation_id,
                    isGroup: conv.is_group,
                    name: conv.name || 'Sin nombre',
                    avatar: conv.avatar_url || undefined,
                    lastMessage: conv.last_message,
                    lastMessageTime: conv.last_message_time,
                    unreadCount: conv.unread_count,
                }));
                setConversations(mapped);
                setLoading(false);
                return;
            }

            // Fallback: Intentar RPC v3 antigua
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('get_chat_conversations_v3', { p_user_id: currentUserId });

            if (!rpcError && rpcData) {
                const mapped: DisplayConversation[] = (rpcData as ChatConversationLegacy[]).map(conv => ({
                    id: `user_${conv.user_id}`,
                    isGroup: false,
                    name: conv.user_name || 'Sin nombre',
                    email: conv.user_email,
                    lastMessage: conv.last_file_url ? '📎 Archivo adjunto' : conv.last_message,
                    lastMessageTime: conv.last_message_time,
                    unreadCount: conv.unread_count,
                }));
                setConversations(mapped);
                setLoading(false);
                return;
            }

            // Fallback manual si las RPC no existen
            console.log('[ChatList] RPCs no disponibles, usando fallback manual');

            // 1. Obtener conversaciones ocultas
            const { data: hiddenConversations } = await supabase
                .from('chat_hidden_conversations')
                .select('hidden_user_id, created_at')
                .eq('user_id', currentUserId);

            const hiddenMap = new Map(
                hiddenConversations?.map(h => [h.hidden_user_id, new Date(h.created_at)]) || []
            );

            // 2. Obtener mensajes individuales
            const { data: messages, error: messagesError } = await supabase
                .from('chat_messages')
                .select('*')
                .is('group_id', null)
                .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
                .order('created_at', { ascending: false });

            if (messagesError) throw messagesError;

            // 3. Agrupar por usuario
            const conversationsMap = new Map<string, DisplayConversation>();

            for (const msg of messages || []) {
                const otherUserId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
                if (!otherUserId) continue;

                // Verificar si está oculta
                const hiddenDate = hiddenMap.get(otherUserId);
                if (hiddenDate && new Date(msg.created_at) <= hiddenDate) {
                    continue;
                }

                const convId = `user_${otherUserId}`;
                if (!conversationsMap.has(convId)) {
                    const unreadCount = (messages || []).filter(m =>
                        m.sender_id === otherUserId &&
                        m.receiver_id === currentUserId &&
                        !m.read &&
                        (!hiddenDate || new Date(m.created_at) > hiddenDate)
                    ).length;

                    conversationsMap.set(convId, {
                        id: convId,
                        isGroup: false,
                        name: 'Cargando...',
                        lastMessage: msg.file_url ? '📎 Archivo adjunto' : msg.message,
                        lastMessageTime: msg.created_at,
                        unreadCount,
                    });
                }
            }

            // 4. Obtener grupos del usuario
            const { data: groupsData } = await supabase
                .from('chat_groups')
                .select(`
                    *,
                    chat_group_members!inner (user_id)
                `)
                .eq('chat_group_members.user_id', currentUserId);

            if (groupsData) {
                for (const group of groupsData) {
                    const convId = `group_${group.id}`;

                    // Obtener último mensaje del grupo
                    const { data: lastGroupMsg } = await supabase
                        .from('chat_messages')
                        .select('message, file_url, created_at')
                        .eq('group_id', group.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    // Contar no leídos en el grupo
                    const { count: unreadCount } = await supabase
                        .from('chat_messages')
                        .select('id', { count: 'exact', head: true })
                        .eq('group_id', group.id)
                        .neq('sender_id', currentUserId)
                        .eq('read', false);

                    conversationsMap.set(convId, {
                        id: convId,
                        isGroup: true,
                        name: group.name,
                        avatar: group.avatar_url,
                        lastMessage: lastGroupMsg?.file_url ? '📎 Archivo adjunto' : lastGroupMsg?.message || null,
                        lastMessageTime: lastGroupMsg?.created_at || group.created_at,
                        unreadCount: unreadCount || 0,
                    });
                }
            }

            const conversationsList = Array.from(conversationsMap.values());

            // 5. Enriquecer nombres de usuarios
            for (const conv of conversationsList) {
                if (conv.isGroup || conv.name !== 'Cargando...') continue;

                const userId = conv.id.replace('user_', '');
                let realName = '';

                // Buscar en employees
                const { data: empData } = await supabase
                    .from('employees')
                    .select('name')
                    .eq('user_id', userId)
                    .single();
                if (empData) realName = empData.name;

                // Buscar en clients
                if (!realName) {
                    const { data: cliData } = await supabase
                        .from('clients')
                        .select('name')
                        .eq('user_id', userId)
                        .single();
                    if (cliData) realName = cliData.name;
                }

                // Buscar en administrators
                if (!realName) {
                    const { data: admData } = await supabase
                        .from('administrators')
                        .select('name')
                        .eq('user_id', userId)
                        .single();
                    if (admData) realName = admData.name;
                }

                if (realName) {
                    conv.name = realName;
                } else {
                    const { data: userData } = await supabase
                        .from('userlevel')
                        .select('user_level')
                        .eq('id', userId)
                        .single();
                    if (userData) {
                        conv.name = `Usuario ${userData.user_level}`;
                    }
                }
            }

            // Ordenar por último mensaje
            conversationsList.sort((a, b) => {
                const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                return timeB - timeA;
            });

            setConversations(conversationsList);

        } catch (error) {
            console.error('❌ Error loading conversations:', error);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, supabase]);

    // Buscar usuarios para nuevo chat
    const searchUsers = useCallback(async (query: string) => {
        if (!currentUserId || query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearchingUsers(true);
        try {
            // Intentar RPC
            const { data, error } = await supabase.rpc('search_chat_users', {
                search_query: query,
                current_user_id: currentUserId,
                result_limit: 10,
            });

            if (!error && data) {
                setSearchResults(data as SearchUserResult[]);
            } else {
                // Fallback manual
                const { data: manualData } = await supabase
                    .from('userlevel')
                    .select('id, user_level')
                    .neq('id', currentUserId)
                    .in('user_level', ['Admin', 'China', 'Venezuela'])
                    .limit(10);

                if (manualData) {
                    // Enriquecer con nombres
                    const results: SearchUserResult[] = [];
                    for (const u of manualData) {
                        let name = u.user_level;

                        const { data: empData } = await supabase
                            .from('employees')
                            .select('name')
                            .eq('user_id', u.id)
                            .single();
                        if (empData) name = empData.name;

                        if (name === u.user_level) {
                            const { data: admData } = await supabase
                                .from('administrators')
                                .select('name')
                                .eq('user_id', u.id)
                                .single();
                            if (admData) name = admData.name;
                        }

                        if (name.toLowerCase().includes(query.toLowerCase())) {
                            results.push({
                                user_id: u.id,
                                email: '',
                                name,
                                role: u.user_level,
                                avatar_url: null,
                            });
                        }
                    }
                    setSearchResults(results);
                }
            }
        } catch (err) {
            console.error('Error searching users:', err);
        } finally {
            setSearchingUsers(false);
        }
    }, [currentUserId, supabase]);

    // Debounce para búsqueda de usuarios
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchUsersQuery.length >= 2) {
                searchUsers(searchUsersQuery);
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchUsersQuery, searchUsers]);

    useEffect(() => {
        loadConversations();

        // Suscribirse a cambios
        const channel = supabase
            .channel('chat_list_updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_messages',
            }, () => {
                loadConversations();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_groups',
            }, () => {
                loadConversations();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_group_members',
            }, () => {
                loadConversations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadConversations, currentUserId, supabase]);

    // Función para ocultar conversación
    const handleDeleteConversation = async () => {
        if (!conversationToDelete || !currentUserId) return;

        try {
            setDeleting(true);

            // Solo para conversaciones individuales
            if (conversationToDelete.startsWith('user_')) {
                const userId = conversationToDelete.replace('user_', '');

                const { error } = await supabase
                    .from('chat_hidden_conversations')
                    .upsert({
                        user_id: currentUserId,
                        hidden_user_id: userId,
                        created_at: new Date().toISOString()
                    }, { onConflict: 'user_id, hidden_user_id' });

                if (error) throw error;
            } else if (conversationToDelete.startsWith('group_')) {
                // Para grupos: salir del grupo
                const groupId = conversationToDelete.replace('group_', '');

                const { error } = await supabase
                    .from('chat_group_members')
                    .delete()
                    .eq('group_id', groupId)
                    .eq('user_id', currentUserId);

                if (error) throw error;
            }

            // Actualizar lista local
            setConversations(prev => prev.filter(conv => conv.id !== conversationToDelete));

            // Resetear página
            const newTotalPages = Math.ceil((conversations.length - 1) / ITEMS_PER_PAGE);
            if (currentPage > newTotalPages && newTotalPages > 0) {
                setCurrentPage(newTotalPages);
            }

        } catch (error) {
            console.error('Error hiding/leaving conversation:', error);
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
            setConversationToDelete(null);
        }
    };

    // Iniciar chat con usuario buscado
    const handleStartChat = (user: SearchUserResult) => {
        setShowNewChat(false);
        setSearchUsersQuery('');
        setSearchResults([]);
        onSelectConversation(`user_${user.user_id}`, user.name);
    };

    const filteredConversations = conversations.filter((conv) =>
        conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (conv.email && conv.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Calcular paginación
    const totalPages = Math.ceil(filteredConversations.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedConversations = filteredConversations.slice(startIndex, endIndex);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header con buscador y botón nuevo chat */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                    <Input
                        type="text"
                        placeholder={t('chat.list.searchPlaceholder') || "Buscar conversación..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`pl-10 ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : 'bg-slate-50 border-slate-200'} focus:border-blue-300 focus:ring-blue-200 transition-all`}
                    />
                </div>
                <Button
                    onClick={() => setShowNewChat(!showNewChat)}
                    variant={showNewChat ? "secondary" : "outline"}
                    size="icon"
                    className="shrink-0"
                    title={t('chat.list.newChat') || "Nuevo chat"}
                >
                    <UserPlus className="h-4 w-4" />
                </Button>
                <Button
                    onClick={() => setCreateGroupModalOpen(true)}
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title={t('chat.groups.create.title') || "Crear grupo"}
                >
                    <Users className="h-4 w-4" />
                </Button>
            </div>

            {/* Panel de nuevo chat */}
            {showNewChat && (
                <div className={`p-4 rounded-lg border ${mounted && theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <h4 className={`text-sm font-medium mb-3 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                        {t('chat.list.startNewChat') || "Iniciar nueva conversación"}
                    </h4>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder={t('chat.list.searchUsers') || "Buscar usuarios..."}
                            value={searchUsersQuery}
                            onChange={(e) => setSearchUsersQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {searchingUsers && (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        </div>
                    )}

                    {searchResults.length > 0 && (
                        <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                            {searchResults.map((user) => (
                                <button
                                    key={user.user_id}
                                    onClick={() => handleStartChat(user)}
                                    className={`w-full p-2 rounded-lg flex items-center gap-3 transition-colors ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
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
                                </button>
                            ))}
                        </div>
                    )}

                    {searchUsersQuery.length >= 2 && !searchingUsers && searchResults.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-3">
                            {t('chat.list.noUsersFound') || "No se encontraron usuarios"}
                        </p>
                    )}
                </div>
            )}

            {/* Lista */}
            <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
                {paginatedConversations.length === 0 ? (
                    <div className="text-center py-12 animate-in fade-in duration-300">
                        <MessageCircle className={`w-12 h-12 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-300'} mx-auto mb-3`} />
                        <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {searchQuery ? t('chat.list.noResults') || 'No se encontraron conversaciones' : t('chat.list.noConversations') || 'No hay conversaciones aún'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {paginatedConversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={`relative rounded-xl transition-all duration-300 group ${selectedUserId === conv.id
                                    ? (mounted && theme === 'dark' ? 'bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-2 border-blue-600 shadow-md' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-md')
                                    : (mounted && theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-slate-600 hover:shadow-sm' : 'bg-white hover:bg-slate-50 border-2 border-slate-100 hover:border-slate-200 hover:shadow-sm')
                                    }`}
                            >
                                <button
                                    onClick={() => onSelectConversation(conv.id, conv.name, conv.avatar)}
                                    className="w-full p-4 text-left"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="relative">
                                            <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                                                <AvatarImage src={conv.avatar || ''} />
                                                <AvatarFallback className={`text-white font-semibold ${conv.isGroup ? 'bg-gradient-to-br from-purple-500 to-pink-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                                                    {conv.isGroup ? (
                                                        <Users className="w-5 h-5" />
                                                    ) : (
                                                        conv.name.charAt(0).toUpperCase()
                                                    )}
                                                </AvatarFallback>
                                            </Avatar>
                                            {conv.unreadCount > 0 && (
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                                    <span className="text-[10px] text-white font-bold">{conv.unreadCount}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className={`font-semibold truncate transition-colors ${mounted && theme === 'dark' ? 'text-white group-hover:text-blue-300' : 'text-slate-800 group-hover:text-blue-600'}`}>
                                                        {conv.name}
                                                    </h3>
                                                    {conv.isGroup && (
                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                            {t('chat.list.group') || 'Grupo'}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            {conv.email && (
                                                <p className={`text-xs truncate mb-2 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    {conv.email}
                                                </p>
                                            )}

                                            {/* Mensaje con hora inline */}
                                            {conv.lastMessage && (
                                                <div className={`text-sm grid grid-cols-[1fr_auto] gap-2 items-center ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                                    <span className="truncate">
                                                        {conv.lastMessage}
                                                    </span>
                                                    {conv.lastMessageTime && (
                                                        <span className={`text-xs whitespace-nowrap ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                                            {format(new Date(conv.lastMessageTime), 'HH:mm', { locale: es })}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>

                                {/* Menú de 3 puntos */}
                                <div className="absolute top-4 right-4">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-slate-200'} opacity-0 group-hover:opacity-100 transition-opacity`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MoreVertical className={`h-4 w-4 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            {/* Mostrar opción de info solo para grupos */}
                                            {/* Opción de info eliminada por solicitud */}
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConversationToDelete(conv.id);
                                                    setDeleteDialogOpen(true);
                                                }}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                {conv.isGroup
                                                    ? (t('chat.list.leaveGroup') || 'Salir del grupo')
                                                    : (t('chat.list.deleteChat') || 'Eliminar chat')
                                                }
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Paginación */}
            {totalPages > 1 && (
                <div className={`flex items-center justify-between pt-4 border-t ${mounted && theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                    <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                        {t('chat.list.pagination.page', { current: currentPage, total: totalPages }) || `Página ${currentPage} de ${totalPages}`}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="h-8"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            {t('chat.list.pagination.previous') || 'Anterior'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="h-8"
                        >
                            {t('chat.list.pagination.next') || 'Siguiente'}
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Modal de confirmación para eliminar/salir */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {conversationToDelete?.startsWith('group_')
                                ? (t('chat.list.leaveGroupDialog.title') || '¿Salir del grupo?')
                                : (t('chat.list.deleteDialog.title') || '¿Eliminar conversación?')
                            }
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {conversationToDelete?.startsWith('group_')
                                ? (t('chat.list.leaveGroupDialog.description') || 'Dejarás de ver los mensajes de este grupo.')
                                : (t('chat.list.deleteDialog.description') || 'Esta conversación será ocultada de tu lista.')
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                            {t('chat.list.deleteDialog.cancel') || 'Cancelar'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConversation}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('chat.list.deleteDialog.deleting') || 'Procesando...'}
                                </>
                            ) : (
                                conversationToDelete?.startsWith('group_')
                                    ? (t('chat.list.leaveGroupDialog.confirm') || 'Salir')
                                    : (t('chat.list.deleteDialog.delete') || 'Eliminar')
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal para crear grupo */}
            {currentUserId && (
                <CreateGroupModal
                    open={createGroupModalOpen}
                    onOpenChange={setCreateGroupModalOpen}
                    currentUserId={currentUserId}
                    onGroupCreated={(groupId, groupName) => {
                        // Recargar conversaciones y seleccionar el nuevo grupo
                        loadConversations();
                        onSelectConversation(`group_${groupId}`, groupName);
                    }}
                />
            )}

            {/* Sheet para info de grupo */}
            {selectedGroupForInfo && currentUserId && (
                <GroupInfoSheet
                    open={groupInfoOpen}
                    onOpenChange={setGroupInfoOpen}
                    groupId={selectedGroupForInfo.id}
                    groupName={selectedGroupForInfo.name}
                    currentUserId={currentUserId}
                    onLeaveGroup={() => {
                        loadConversations();
                    }}
                    onDeleteGroup={() => {
                        loadConversations();
                    }}
                />
            )}
        </div>
    );
}
