"use client";

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ChatMessage, SendMessagePayload, ChatRole } from '@/lib/types/chat';

interface UseChatMessagesOptions {
    conversationUserId?: string | null; // Para chats individuales
    groupId?: string | null; // Para chats de grupo
    currentUserId: string | null;
    currentUserRole: ChatRole;
}

export function useChatMessages({
    conversationUserId,
    groupId,
    currentUserId,
    currentUserRole
}: UseChatMessagesOptions) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = getSupabaseBrowserClient();

    // Determinar si es chat de grupo
    const isGroupChat = !!groupId && !conversationUserId;

    // Cargar mensajes de la conversación
    const loadMessages = useCallback(async () => {
        if (!currentUserId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        // Necesitamos conversationUserId O groupId
        if (!conversationUserId && !groupId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        try {
            // Solo mostrar loading si NO hay mensajes aún (primera carga)
            if (messages.length === 0) {
                setLoading(true);
            }
            setError(null);

            let query;

            if (isGroupChat && groupId) {
                // Mensajes de grupo
                query = supabase
                    .from('chat_messages')
                    .select('*')
                    .eq('group_id', groupId)
                    .order('created_at', { ascending: true });
            } else if (conversationUserId) {
                // Mensajes individuales
                // 1. Obtener fecha de ocultamiento (si existe)
                const { data: hiddenData } = await supabase
                    .from('chat_hidden_conversations')
                    .select('created_at')
                    .eq('user_id', currentUserId)
                    .eq('hidden_user_id', conversationUserId)
                    .maybeSingle();

                const hiddenSince = hiddenData?.created_at ? new Date(hiddenData.created_at) : null;

                // 2. Obtener mensajes
                const { data, error: fetchError } = await supabase
                    .from('chat_messages')
                    .select('*')
                    .is('group_id', null)
                    .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${conversationUserId}),and(sender_id.eq.${conversationUserId},receiver_id.eq.${currentUserId})`)
                    .order('created_at', { ascending: true });

                if (fetchError) {
                    throw fetchError;
                }

                // 3. Filtrar mensajes
                const filteredMessages = (data || []).filter(msg => {
                    // Filtrar si fue eliminado por el usuario actual
                    if (msg.sender_id === currentUserId && msg.deleted_by_sender) return false;
                    if (msg.receiver_id === currentUserId && msg.deleted_by_receiver) return false;

                    // Filtrar si es anterior a la fecha de ocultamiento
                    if (hiddenSince && new Date(msg.created_at) <= hiddenSince) return false;

                    return true;
                });

                setMessages(filteredMessages);
                setLoading(false);
                return;
            } else {
                setMessages([]);
                setLoading(false);
                return;
            }

            const { data, error: fetchError } = await query;

            if (fetchError) {
                throw fetchError;
            }

            // Para grupos, filtrar mensajes eliminados
            const filteredMessages = (data || []).filter(msg => {
                if (msg.is_deleted) return false;
                if (msg.sender_id === currentUserId && msg.deleted_by_sender) return false;
                return true;
            });

            setMessages(filteredMessages);
        } catch (err) {
            console.error('Error loading messages:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [conversationUserId, groupId, currentUserId, supabase, messages.length, isGroupChat]);

    // Enviar mensaje
    const sendMessage = useCallback(async (payload: SendMessagePayload) => {
        if (!currentUserId) {
            setError('No hay usuario autenticado');
            return false;
        }

        try {
            setSending(true);
            setError(null);

            // Determinar si es mensaje de grupo o individual
            const isGroupMessage = !!payload.group_id;

            // Para mensajes individuales, determinar rol del receptor
            let receiverRole: ChatRole | null = null;
            if (!isGroupMessage && payload.receiver_id) {
                // Intentar determinar el rol del receptor
                const { data: receiverData } = await supabase
                    .from('userlevel')
                    .select('user_level')
                    .eq('id', payload.receiver_id)
                    .single();

                const level = receiverData?.user_level?.toLowerCase();
                if (level === 'admin' || level === 'administrador') {
                    receiverRole = 'admin';
                } else if (level === 'china') {
                    receiverRole = 'china';
                } else if (level === 'venezuela' || level === 'vzla') {
                    receiverRole = 'venezuela';
                } else {
                    receiverRole = 'admin'; // fallback
                }
            }

            // Crear mensaje optimista (se muestra instantáneamente)
            const optimisticMessage: ChatMessage = {
                id: `temp-${Date.now()}`, // ID temporal
                sender_id: currentUserId,
                sender_role: currentUserRole,
                receiver_id: isGroupMessage ? null : (payload.receiver_id || null),
                receiver_role: isGroupMessage ? null : receiverRole,
                group_id: isGroupMessage ? (payload.group_id || null) : null,
                message: payload.message || null,
                file_url: payload.file_url || null,
                file_name: payload.file_name || null,
                file_type: payload.file_type || null,
                file_size: payload.file_size || null,
                read: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_edited: false,
            };

            // Agregar mensaje optimísticamente
            setMessages(prev => [...prev, optimisticMessage]);

            // Preparar datos para insertar
            const insertData: Record<string, any> = {
                sender_id: currentUserId,
                sender_role: currentUserRole,
                message: payload.message || null,
                file_url: payload.file_url || null,
                file_name: payload.file_name || null,
                file_type: payload.file_type || null,
                file_size: payload.file_size || null,
                read: false,
            };

            if (isGroupMessage) {
                insertData.group_id = payload.group_id;
                insertData.receiver_id = null;
                insertData.receiver_role = null;
            } else {
                insertData.receiver_id = payload.receiver_id;
                insertData.receiver_role = receiverRole;
                insertData.group_id = null;
            }

            // Guardar en BD
            const { data: newMessage, error: insertError } = await supabase
                .from('chat_messages')
                .insert(insertData)
                .select()
                .single();

            if (insertError) {
                setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
                throw insertError;
            }

            // Reemplazar mensaje temporal
            setMessages(prev =>
                prev.map(msg => msg.id === optimisticMessage.id ? newMessage : msg)
            );

            return true;
        } catch (err) {
            console.error('Error sending message:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
            return false;
        } finally {
            setSending(false);
        }
    }, [currentUserId, currentUserRole, supabase]);

    // Editar mensaje
    const editMessage = useCallback(async (messageId: string, newContent: string) => {
        try {
            // Optimista
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, message: newContent, is_edited: true } : msg
            ));

            const { error } = await supabase
                .from('chat_messages')
                .update({ message: newContent, is_edited: true })
                .eq('id', messageId);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Error editing message:', err);
            loadMessages(); // Recargar para asegurar consistencia
            return false;
        }
    }, [supabase, loadMessages]);

    // Eliminar mensaje
    const deleteMessage = useCallback(async (messageId: string) => {
        if (!currentUserId) return false;

        try {
            const msg = messages.find(m => m.id === messageId);
            if (!msg) return false;

            // Si soy el remitente, soft delete (para todos)
            // Si soy el receptor (solo en chat individual), delete for me (ocultar)
            if (msg.sender_id === currentUserId) {
                // Optimista: marcar como eliminado
                setMessages(prev => prev.map(m =>
                    m.id === messageId ? { ...m, is_deleted: true } : m
                ));

                const { error } = await supabase
                    .from('chat_messages')
                    .update({ is_deleted: true })
                    .eq('id', messageId);

                if (error) throw error;
            } else if (!isGroupChat) {
                // Solo en chats individuales: ocultar para receptor
                setMessages(prev => prev.filter(msg => msg.id !== messageId));

                const { error } = await supabase
                    .from('chat_messages')
                    .update({ deleted_by_receiver: true })
                    .eq('id', messageId);

                if (error) throw error;
            }

            return true;
        } catch (err) {
            console.error('Error deleting message:', err);
            loadMessages();
            return false;
        }
    }, [currentUserId, messages, supabase, loadMessages, isGroupChat]);

    // Marcar mensajes como leídos
    const markAsRead = useCallback(async (targetId?: string) => {
        if (!currentUserId) return;

        const conversationId = targetId || conversationUserId;

        try {
            if (isGroupChat && groupId) {
                // Marcar mensajes de grupo como leídos
                const { error } = await supabase
                    .from('chat_messages')
                    .update({ read: true })
                    .eq('group_id', groupId)
                    .neq('sender_id', currentUserId)
                    .eq('read', false);

                if (error) {
                    console.error('Error marking group messages as read:', error);
                    return;
                }
            } else if (conversationId) {
                // Marcar mensajes individuales como leídos
                const { error } = await supabase
                    .from('chat_messages')
                    .update({ read: true })
                    .eq('sender_id', conversationId)
                    .eq('receiver_id', currentUserId)
                    .eq('read', false);

                if (error) {
                    console.error('Error marking messages as read:', error);
                    return;
                }
            }

            setMessages(prev =>
                prev.map(msg =>
                    msg.sender_id !== currentUserId && !msg.read
                        ? { ...msg, read: true }
                        : msg
                )
            );
        } catch (err) {
            console.error('Error marking messages as read:', err);
        }
    }, [currentUserId, conversationUserId, groupId, isGroupChat, supabase]);

    // Agregar mensaje recibido por Realtime
    const addMessage = useCallback((message: ChatMessage) => {
        setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
        });
    }, []);

    // Cargar mensajes al montar o cuando cambie la conversación
    useEffect(() => {
        loadMessages();
    }, [loadMessages]);

    // Marcar como leídos cuando se abra la conversación
    useEffect(() => {
        if ((conversationUserId || groupId) && messages.length > 0) {
            markAsRead();
        }
    }, [conversationUserId, groupId, messages.length, markAsRead]);

    return {
        messages,
        loading,
        sending,
        error,
        sendMessage,
        editMessage,
        deleteMessage,
        markAsRead,
        addMessage,
        refetch: loadMessages,
        isGroupChat,
    };
}

