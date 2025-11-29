"use client";

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Search, Loader2, MessageCircle, MoreVertical, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ChatConversation } from '@/lib/types/chat';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';

interface ChatListProps {
    onSelectConversation: (userId: string, userName: string) => void;
    selectedUserId: string | null;
    currentUserId: string | null;
}

const ITEMS_PER_PAGE = 10;

export function ChatList({ onSelectConversation, selectedUserId, currentUserId }: ChatListProps) {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const supabase = getSupabaseBrowserClient();
    const { theme } = useTheme();
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

            // Intentar usar la RPC nueva (v2) que trae nombres reales y filtra ocultos
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('get_chat_conversations_v2', { current_user_id: currentUserId });

            if (!rpcError && rpcData) {
                console.log('✅ Conversaciones cargadas vía RPC v2');
                setConversations(rpcData);
                setLoading(false);
                return;
            }

            // Fallback: Lógica manual si la RPC no existe
            console.log('⚠️ RPC falló o no existe, usando lógica manual:', rpcError?.message);

            // 1. Obtener conversaciones ocultas
            const { data: hiddenConversations } = await supabase
                .from('chat_hidden_conversations')
                .select('hidden_user_id, created_at')
                .eq('user_id', currentUserId);

            const hiddenMap = new Map(
                hiddenConversations?.map(h => [h.hidden_user_id, new Date(h.created_at)]) || []
            );

            // 2. Obtener mensajes
            const { data: messages, error: messagesError } = await supabase
                .from('chat_messages')
                .select('*')
                .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
                .order('created_at', { ascending: false });

            if (messagesError) throw messagesError;

            // 3. Agrupar y filtrar
            const conversationsMap = new Map<string, ChatConversation>();

            for (const msg of messages || []) {
                const otherUserId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;

                // Verificar si está oculta
                const hiddenDate = hiddenMap.get(otherUserId);
                if (hiddenDate) {
                    // Si el mensaje es anterior a la fecha de ocultamiento, lo ignoramos
                    if (new Date(msg.created_at) <= hiddenDate) {
                        continue;
                    }
                    // Si es posterior, se muestra (NO borramos el registro hidden, solo mostramos lo nuevo)
                }

                if (!conversationsMap.has(otherUserId)) {
                    // Contar no leídos (solo de mensajes visibles)
                    const unreadCount = (messages || []).filter(m =>
                        m.sender_id === otherUserId &&
                        m.receiver_id === currentUserId &&
                        !m.read &&
                        (!hiddenDate || new Date(m.created_at) > hiddenDate)
                    ).length;

                    conversationsMap.set(otherUserId, {
                        user_id: otherUserId,
                        user_email: '',
                        user_name: 'Cargando...', // Placeholder
                        last_message: msg.message,
                        last_message_time: msg.created_at,
                        unread_count: unreadCount,
                        last_file_url: msg.file_url,
                    });
                }
            }

            const conversationsList = Array.from(conversationsMap.values());

            // 4. Enriquecer con nombres (Fallback mejorado)
            for (const conv of conversationsList) {
                // Intentar buscar en tablas específicas según prioridad
                let realName = '';

                // 1. Buscar en employees (China/Venezuela/Pagos)
                const { data: empData } = await supabase
                    .from('employees')
                    .select('name')
                    .eq('user_id', conv.user_id)
                    .single();
                if (empData) realName = empData.name;

                // 2. Si no, buscar en clients
                if (!realName) {
                    const { data: cliData } = await supabase
                        .from('clients')
                        .select('name')
                        .eq('user_id', conv.user_id)
                        .single();
                    if (cliData) realName = cliData.name;
                }

                // 3. Si no, buscar en administrators
                if (!realName) {
                    const { data: admData } = await supabase
                        .from('administrators')
                        .select('name')
                        .eq('user_id', conv.user_id)
                        .single();
                    if (admData) realName = admData.name;
                }

                // 4. Si encontramos nombre real, usarlo. Si no, usar fallback de nivel
                if (realName) {
                    conv.user_name = realName;
                } else {
                    const { data: userData } = await supabase
                        .from('userlevel')
                        .select('user_level')
                        .eq('id', conv.user_id)
                        .single();
                    if (userData) {
                        conv.user_name = `Usuario ${userData.user_level}`;
                    }
                }
            }

            setConversations(conversationsList);

        } catch (error) {
            console.error('❌ Error loading conversations:', error);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, supabase]);

    useEffect(() => {
        loadConversations();

        // Suscribirse a cambios en mensajes para recargar la lista
        const channel = supabase
            .channel('chat_list_updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_messages',
                filter: `receiver_id=eq.${currentUserId}`
            }, () => {
                loadConversations();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_messages',
                filter: `sender_id=eq.${currentUserId}`
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

            // Upsert para actualizar la fecha si ya existe, o insertar si no
            // Usamos upsert para "reiniciar" la fecha de ocultamiento a AHORA
            const { error } = await supabase
                .from('chat_hidden_conversations')
                .upsert({
                    user_id: currentUserId,
                    hidden_user_id: conversationToDelete,
                    created_at: new Date().toISOString() // Importante: actualizar fecha
                }, { onConflict: 'user_id, hidden_user_id' });

            if (error) throw error;

            // Actualizar lista local
            setConversations(prev => prev.filter(conv => conv.user_id !== conversationToDelete));

            // Si la conversación seleccionada es la que borramos, deseleccionar
            if (selectedUserId === conversationToDelete) {
                // Opcional: notificar al padre para deseleccionar
            }

            // Resetear página
            const newTotalPages = Math.ceil((conversations.length - 1) / ITEMS_PER_PAGE);
            if (currentPage > newTotalPages && newTotalPages > 0) {
                setCurrentPage(newTotalPages);
            }

        } catch (error) {
            console.error('Error hiding conversation:', error);
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
            setConversationToDelete(null);
        }
    };

    const filteredConversations = conversations.filter((conv) =>
        conv.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.user_email.toLowerCase().includes(searchQuery.toLowerCase())
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
            {/* Buscador */}
            <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
                <Input
                    type="text"
                    placeholder="Buscar conversación..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-10 ${mounted && theme === 'dark' ? 'bg-slate-700 dark:border-slate-600 dark:text-white' : 'bg-slate-50 border-slate-200'} focus:border-blue-300 focus:ring-blue-200 transition-all`}
                />
            </div>

            {/* Lista */}
            <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
                {paginatedConversations.length === 0 ? (
                    <div className="text-center py-12 animate-in fade-in duration-300">
                        <MessageCircle className={`w-12 h-12 ${mounted && theme === 'dark' ? 'text-slate-600' : 'text-slate-300'} mx-auto mb-3`} />
                        <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones aún'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {paginatedConversations.map((conv) => (
                            <div
                                key={conv.user_id}
                                className={`relative rounded-xl transition-all duration-300 group ${selectedUserId === conv.user_id
                                    ? (mounted && theme === 'dark' ? 'bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-2 border-blue-600 shadow-md' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-md')
                                    : (mounted && theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-slate-600 hover:shadow-sm' : 'bg-white hover:bg-slate-50 border-2 border-slate-100 hover:border-slate-200 hover:shadow-sm')
                                    }`}
                            >
                                <button
                                    onClick={() => onSelectConversation(conv.user_id, conv.user_name)}
                                    className="w-full p-4 text-left"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="relative">
                                            <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold">
                                                    {conv.user_name.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            {conv.unread_count > 0 && (
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                                    <span className="text-[10px] text-white font-bold">{conv.unread_count}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className={`font-semibold truncate transition-colors ${mounted && theme === 'dark' ? 'text-white group-hover:text-blue-300' : 'text-slate-800 group-hover:text-blue-600'}`}>
                                                    {conv.user_name}
                                                </h3>
                                            </div>

                                            <p className={`text-xs truncate mb-2 ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {conv.user_email}
                                            </p>

                                            {/* Mensaje con hora inline */}
                                            {conv.last_message && (
                                                <p className={`text-sm truncate flex items-center gap-2 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                                    <span className="flex-1 truncate">
                                                        {conv.last_file_url ? '📎 Archivo adjunto' : conv.last_message}
                                                    </span>
                                                    {conv.last_message_time && (
                                                        <>
                                                            <span className={mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>•</span>
                                                            <span className={`text-xs shrink-0 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                {format(new Date(conv.last_message_time), 'HH:mm', { locale: es })}
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
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
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConversationToDelete(conv.user_id);
                                                    setDeleteDialogOpen(true);
                                                }}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Eliminar chat
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
                        Página {currentPage} de {totalPages}
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
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="h-8"
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Modal de confirmación para eliminar */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar chat?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción ocultará el historial actual de esta conversación.
                            Si vuelves a hablar con este usuario, se iniciará un chat limpio.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConversation}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                'Eliminar'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
