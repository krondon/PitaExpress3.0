"use client";

import { useState, useCallback, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatRealtime } from '@/hooks/use-chat-realtime';
import { useChatTyping } from '@/hooks/use-chat-typing';
import { useChinaContext } from '@/lib/ChinaContext';
import { useNotifications } from '@/hooks/use-notifications';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { MessageSquare, Loader2, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ChatMessage } from '@/lib/types/chat';
import { useTheme } from 'next-themes';

export default function ChinaChatPage() {
    const [sidebarExpanded, setSidebarExpanded] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { chinaId } = useChinaContext();
    const router = useRouter();
    const [adminId, setAdminId] = useState<string | null>(null);
    const [adminName, setAdminName] = useState<string>('Administrador');
    const [loadingAdmin, setLoadingAdmin] = useState(true);
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Notificaciones
    const { uiItems: notificationsList, unreadCount, markAllAsRead } = useNotifications({
        role: 'china',
        userId: chinaId,
        limit: 10,
        enabled: true
    });

    // Obtener ID del admin
    useEffect(() => {
        const fetchAdminId = async () => {
            try {
                const supabase = getSupabaseBrowserClient();

                // Buscar usuario con user_level = 'Admin'
                const { data: adminData, error } = await supabase
                    .from('userlevel')
                    .select('id, user_level')
                    .eq('user_level', 'Admin')
                    .limit(1)
                    .single();

                if (!error && adminData) {
                    console.log('✅ Admin encontrado:', adminData);
                    setAdminId(adminData.id);
                    setAdminName('Administrador');
                } else {
                    console.log('⚠️ No se encontró admin con user_level="Admin"');
                    console.log('Error:', error);
                }
            } catch (error) {
                console.error('❌ Error fetching admin:', error);
            } finally {
                setLoadingAdmin(false);
            }
        };

        fetchAdminId();
    }, []);

    const {
        messages,
        loading,
        sending,
        sendMessage,
        addMessage,
        editMessage,
        deleteMessage,
    } = useChatMessages({
        conversationUserId: adminId,
        currentUserId: chinaId ?? null,
        currentUserRole: 'china',
    });

    const { isOtherUserTyping, notifyTyping, stopTyping } = useChatTyping({
        currentUserId: chinaId ?? null,
        conversationUserId: adminId,
    });

    // Callback estable para nuevos mensajes
    const handleNewMessage = useCallback((message: ChatMessage) => {
        console.log('📨 Mensaje recibido en china, sender:', message.sender_id, 'admin:', adminId);
        if (message.sender_id === adminId) {
            console.log('✅ Agregando mensaje al estado');
            addMessage(message);
        }
    }, [adminId, addMessage]);

    // Realtime: escuchar nuevos mensajes
    useChatRealtime({
        currentUserId: chinaId ?? null,
        onNewMessage: handleNewMessage,
    });

    const handleSendMessage = useCallback(
        async (text: string, fileData?: { url: string; name: string; type: string; size: number }) => {
            if (!adminId) return;

            const success = await sendMessage({
                receiver_id: adminId,
                message: text || undefined,
                file_url: fileData?.url,
                file_name: fileData?.name,
                file_type: fileData?.type,
                file_size: fileData?.size,
            });

            if (success) {
                stopTyping();
            }
        },
        [adminId, sendMessage, stopTyping]
    );

    if (loadingAdmin) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
                <div className="text-center">
                    <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${mounted && theme === 'dark' ? 'border-blue-400' : 'border-blue-600'} mx-auto`}></div>
                    <p className={`mt-4 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`}>Cargando chat...</p>
                </div>
            </div>
        );
    }

    if (!adminId) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
                <Card className={`max-w-md ${mounted && theme === 'dark' ? 'bg-slate-800/70 dark:border-slate-700' : ''}`}>
                    <CardContent className="p-8 text-center">
                        <MessageSquare className={`w-16 h-16 ${mounted && theme === 'dark' ? 'text-slate-500' : 'text-slate-400'} mx-auto mb-4`} />
                        <h3 className={`text-xl font-semibold mb-2 ${mounted && theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                            No se encontró el administrador
                        </h3>
                        <p className={mounted && theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                            No se pudo conectar con el administrador
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className={`min-h-screen flex overflow-x-hidden ${mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
            <Sidebar
                isExpanded={sidebarExpanded}
                setIsExpanded={setSidebarExpanded}
                isMobileMenuOpen={isMobileMenuOpen}
                onMobileMenuClose={() => setIsMobileMenuOpen(false)}
                userRole="china"
            />

            <main className={`flex-1 transition-all duration-300 ${sidebarExpanded ? 'lg:ml-72 lg:w-[calc(100%-18rem)]' : 'lg:ml-24 lg:w-[calc(100%-6rem)]'
                }`}>
                <Header
                    notifications={unreadCount}
                    onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    title={`💬 Chat con ${adminName}`}
                    subtitle="Comunícate directamente con el administrador"
                    notificationsItems={notificationsList}
                    onMarkAllAsRead={async () => {
                        await markAllAsRead();
                    }}
                    onOpenNotifications={() => {
                        router.push('/china/pedidos');
                    }}
                />

                <div className="p-4 md:p-5 lg:p-6">
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Card className={`${mounted && theme === 'dark' ? 'bg-slate-800/70 dark:border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-sm shadow-lg`}>
                            <CardHeader className={`px-5.2 py-2 border-b ${mounted && theme === 'dark' ? 'border-slate-700 bg-gradient-to-r from-slate-800 to-slate-700' : 'border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500 rounded-full">
                                        <Shield className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className={`text-base font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{adminName}</CardTitle>
                                        <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Administrador del Sistema</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="flex flex-col h-[calc(100vh-12rem)]">
                                    <ChatMessages
                                        messages={messages}
                                        currentUserId={chinaId || ''}
                                        isOtherUserTyping={isOtherUserTyping}
                                        otherUserName={adminName}
                                        loading={loading}
                                        onEditMessage={editMessage}
                                        onDeleteMessage={deleteMessage}
                                    />
                                    <ChatInput
                                        onSendMessage={handleSendMessage}
                                        onTyping={notifyTyping}
                                        onStopTyping={stopTyping}
                                        disabled={sending}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
