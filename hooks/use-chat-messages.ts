"use client";

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ChatMessage, SendMessagePayload } from '@/lib/types/chat';

interface UseChatMessagesOptions {
    conversationUserId: string | null;
    currentUserId: string | null;
    currentUserRole: 'admin' | 'china';
}

export function useChatMessages({ conversationUserId, currentUserId, currentUserRole }: UseChatMessagesOptions) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = getSupabaseBrowserClient();

    // Cargar mensajes de la conversación
    const loadMessages = useCallback(async () => {
        if (!conversationUserId || !currentUserId) {
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

            // 1. Obtener fecha de ocultamiento (si existe)
            const { data: hiddenData } = await supabase
                .from('chat_hidden_conversations')
                .select('created_at')
                .eq('user_id', currentUserId)
                .eq('hidden_user_id', conversationUserId)
                .single();

            const hiddenSince = hiddenData?.created_at ? new Date(hiddenData.created_at) : null;

            // 2. Obtener mensajes
            const { data, error: fetchError } = await supabase
                .from('chat_messages')
                .select('*')
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
        } catch (err) {
            console.error('Error loading messages:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [conversationUserId, currentUserId, supabase, messages.length]);

    // Enviar mensaje
    const sendMessage = useCallback(async (payload: SendMessagePayload) => {
        if (!currentUserId) {
            setError('No hay usuario autenticado');
            return false;
        }

        try {
            setSending(true);
            setError(null);

            // Determinar rol del receptor
            const receiverRole = currentUserRole === 'admin' ? 'china' : 'admin';

            // Crear mensaje optimista (se muestra instantáneamente)
            const optimisticMessage: ChatMessage = {
                id: `temp-${Date.now()}`, // ID temporal
                sender_id: currentUserId,
                sender_role: currentUserRole,
                receiver_id: payload.receiver_id,
                receiver_role: receiverRole,
                message: payload.message || null,
                file_url: payload.file_url || null,
                file_name: payload.file_name || null,
                file_type: payload.file_type || null,
                file_size: payload.file_size || null,
                read: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_edited: false,
            } as ChatMessage;

            // Agregar mensaje optimísticamente
            setMessages(prev => [...prev, optimisticMessage]);

            // Guardar en BD
            const { data: newMessage, error: insertError } = await supabase
                .from('chat_messages')
                .insert({
                    sender_id: currentUserId,
                    sender_role: currentUserRole,
                    receiver_id: payload.receiver_id,
                    receiver_role: receiverRole,
                    message: payload.message || null,
                    file_url: payload.file_url || null,
                    file_name: payload.file_name || null,
                    file_type: payload.file_type || null,
                    file_size: payload.file_size || null,
                    read: false,
                })
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

    // Eliminar mensaje (para mí)
    const deleteMessage = useCallback(async (messageId: string) => {
        if (!currentUserId) return false;

        try {
            // Optimista: quitar de la lista
            setMessages(prev => prev.filter(msg => msg.id !== messageId));

            const msg = messages.find(m => m.id === messageId);
            if (!msg) return false;

            const updateData: any = {};
            if (msg.sender_id === currentUserId) {
                updateData.deleted_by_sender = true;
            } else {
                updateData.deleted_by_receiver = true;
            }

            const { error } = await supabase
                .from('chat_messages')
                .update(updateData)
                .eq('id', messageId);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Error deleting message:', err);
            loadMessages();
            return false;
        }
    }, [currentUserId, messages, supabase, loadMessages]);

    // Marcar mensajes como leídos
    const markAsRead = useCallback(async (conversationUserId: string) => {
        if (!currentUserId) return;

        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({ read: true })
                .eq('sender_id', conversationUserId)
                .eq('receiver_id', currentUserId)
                .eq('read', false);

            if (error) {
                console.error('Error marking messages as read:', error);
                return;
            }

            setMessages(prev =>
                prev.map(msg =>
                    msg.sender_id === conversationUserId && !msg.read
                        ? { ...msg, read: true }
                        : msg
                )
            );
        } catch (err) {
            console.error('Error marking messages as read:', err);
        }
    }, [currentUserId, supabase]);

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
        if (conversationUserId && messages.length > 0) {
            markAsRead(conversationUserId);
        }
    }, [conversationUserId, messages.length, markAsRead]);

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
    };
}
