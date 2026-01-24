"use client";

import { useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ChatMessage } from '@/lib/types/chat';

interface UseChatRealtimeOptions {
    currentUserId: string | null;
    groupId?: string | null; // Nuevo: Soporte para grupos
    onNewMessage?: (message: ChatMessage) => void;
    onMessageRead?: (messageId: string) => void;
}

export function useChatRealtime({
    currentUserId,
    groupId,
    onNewMessage,
    onMessageRead,
}: UseChatRealtimeOptions) {
    const supabase = getSupabaseBrowserClient();

    // Suscribirse a nuevos mensajes
    useEffect(() => {
        if (!currentUserId && !groupId) return;

        // Si estamos en un grupo, escuchamos por groupId. Si no, por receiver_id (DM)
        // NOTA: Para recibir notificaciones globales de DM, siempre deberíamos escuchar DM.
        // Pero Supabase Realtime por ahora permite un filtro por canal.
        // Estrategia: 
        // 1. Canal DM: siempre activo si currentUserId existe.
        // 2. Canal Grupo: activo si groupId existe.

        const channels: any[] = [];

        // Canal DM (Mensajes directos)
        if (currentUserId) {
            const dmChannel = supabase
                .channel(`chat-dm-${currentUserId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'chat_messages',
                        filter: `receiver_id=eq.${currentUserId}`,
                    },
                    (payload) => {
                        const newMessage = payload.new as ChatMessage;
                        if (onNewMessage) onNewMessage(newMessage);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'chat_messages',
                        filter: `sender_id=eq.${currentUserId}`,
                    },
                    (payload) => {
                        const updatedMessage = payload.new as ChatMessage;
                        if (updatedMessage.read && onMessageRead) {
                            onMessageRead(updatedMessage.id);
                        }
                    }
                )
                .subscribe();

            channels.push(dmChannel);
        }

        // Canal Grupo (SI hay un grupo seleccionado)
        if (groupId) {
            const groupChannel = supabase
                .channel(`chat-group-${groupId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'chat_messages',
                        filter: `group_id=eq.${groupId}`,
                    },
                    (payload) => {
                        const newMessage = payload.new as ChatMessage;
                        // Evitar duplicados si el sender soy yo (ya se muestra optimista)
                        // Pero el hook no sabe si ya se mostró. El componente padre filtra.
                        if (onNewMessage) onNewMessage(newMessage);
                    }
                )
                // Escuchar updates de grupo (ej: leídos) - Opcional por ahora
                .subscribe();

            channels.push(groupChannel);
        }

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, [currentUserId, groupId, onNewMessage, onMessageRead, supabase]);

    return null;
}
