"use client";

import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import type { ChatMessage } from '@/lib/types/chat';
import { Loader2, MessageCircle } from 'lucide-react';
import { useTheme } from 'next-themes';

interface ChatMessagesProps {
    messages: ChatMessage[];
    currentUserId: string;
    isOtherUserTyping: boolean;
    otherUserName?: string;
    loading?: boolean;
    onEditMessage?: (id: string, newContent: string) => void;
    onDeleteMessage?: (id: string) => void;
}

export function ChatMessages({
    messages,
    currentUserId,
    isOtherUserTyping,
    otherUserName,
    loading,
    onEditMessage,
    onDeleteMessage,
}: ChatMessagesProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOtherUserTyping]);

    if (loading) {
        return (
            <div className={`flex-1 flex items-center justify-center ${mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 to-white'}`}>
                <div className="text-center">
                    <Loader2 className={`w-10 h-10 animate-spin ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-500'} mx-auto mb-3`} />
                    <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>Cargando mensajes...</p>
                </div>
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className={`flex-1 flex items-center justify-center ${mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 to-white'} p-8`}>
                <div className="text-center max-w-sm">
                    <div className={`p-4 ${mounted && theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'} rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center`}>
                        <MessageCircle className={`w-10 h-10 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <h3 className={`text-lg font-semibold mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                        No hay mensajes aún
                    </h3>
                    <p className={`text-sm ${mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        Envía un mensaje para iniciar la conversación
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ScrollArea className={`flex-1 ${mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 to-white'}`}>
            <div ref={scrollRef} className="p-4 md:p-6 space-y-1">
                {messages.map((msg, index) => (
                    <div
                        key={msg.id}
                        style={{
                            animationDelay: `${index * 50}ms`,
                        }}
                    >
                        <MessageBubble
                            id={msg.id}
                            message={msg.message}
                            fileUrl={msg.file_url}
                            fileName={msg.file_name}
                            fileType={msg.file_type}
                            timestamp={msg.created_at}
                            isSent={msg.sender_id === currentUserId}
                            isRead={msg.read}
                            senderName={msg.sender_id !== currentUserId ? otherUserName : undefined}
                            isEdited={msg.is_edited}
                            onEdit={onEditMessage}
                            onDelete={onDeleteMessage}
                        />
                    </div>
                ))}

                {isOtherUserTyping && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <TypingIndicator userName={otherUserName} />
                    </div>
                )}

                <div ref={bottomRef} />
            </div>
        </ScrollArea>
    );
}
