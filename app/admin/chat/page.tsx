"use client";

import { useState, useCallback, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatList } from '@/components/chat/ChatList';
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatRealtime } from '@/hooks/use-chat-realtime';
import { useChatTyping } from '@/hooks/use-chat-typing';
import { useAdminContext } from '@/lib/AdminContext';
import { useNotifications } from '@/hooks/use-notifications';
import { MessageSquare, ArrowLeft, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ChatMessage } from '@/lib/types/chat';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/hooks/useTranslation';

export default function AdminChatPage() {
    const [sidebarExpanded, setSidebarExpanded] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { adminId } = useAdminContext();
    const router = useRouter();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Estado de navegación: 'list' o 'chat'
    const [view, setView] = useState<'list' | 'chat'>('list');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState<string>('');

    // Notificaciones
    const { uiItems: notificationsList, unreadCount, markAllAsRead } = useNotifications({
        role: 'admin',
        userId: adminId,
        limit: 10,
        enabled: true
    });

    const {
        messages,
        loading,
        sending,
        sendMessage,
        addMessage,
        editMessage,
        deleteMessage,
    } = useChatMessages({
        conversationUserId: selectedUserId,
        currentUserId: adminId ?? null,
        currentUserRole: 'admin',
    });

    const { isOtherUserTyping, notifyTyping, stopTyping } = useChatTyping({
        currentUserId: adminId ?? null,
        conversationUserId: selectedUserId,
    });

    // Callback estable para nuevos mensajes
    const handleNewMessage = useCallback((message: ChatMessage) => {
        console.log('📨 Mensaje recibido en admin, sender:', message.sender_id, 'selected:', selectedUserId);
        if (message.sender_id === selectedUserId) {
            console.log('✅ Agregando mensaje al estado');
            addMessage(message);
        }
    }, [selectedUserId, addMessage]);

    // Realtime: escuchar nuevos mensajes
    useChatRealtime({
        currentUserId: adminId ?? null,
        onNewMessage: handleNewMessage,
    });

    const handleSelectConversation = useCallback((userId: string, userName: string) => {
        setSelectedUserId(userId);
        setSelectedUserName(userName);
        setView('chat');
    }, []);

    const handleBackToList = useCallback(() => {
        setView('list');
        setSelectedUserId(null);
        setSelectedUserName('');
    }, []);

    const handleSendMessage = useCallback(
        async (text: string, fileData?: { url: string; name: string; type: string; size: number }) => {
            if (!selectedUserId) return;

            const success = await sendMessage({
                receiver_id: selectedUserId,
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
        [selectedUserId, sendMessage, stopTyping]
    );

    return (
        <div className={`min-h-screen flex overflow-x-hidden ${mounted && theme === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}`}>
            <Sidebar
                isExpanded={sidebarExpanded}
                setIsExpanded={setSidebarExpanded}
                isMobileMenuOpen={isMobileMenuOpen}
                onMobileMenuClose={() => setIsMobileMenuOpen(false)}
                userRole="admin"
            />

            <main className={`flex-1 transition-all duration-300 ${sidebarExpanded ? 'lg:ml-72 lg:w-[calc(100%-18rem)]' : 'lg:ml-24 lg:w-[calc(100%-6rem)]'
                }`}>
                <Header
                    notifications={unreadCount}
                    onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    title={view === 'list' ? t('chat.list.title') : t('chat.china.title', { name: selectedUserName })}
                    subtitle={view === 'list' ? t('chat.list.subtitle') : t('chat.china.subtitle')}
                    notificationsItems={notificationsList}
                    onMarkAllAsRead={async () => {
                        await markAllAsRead();
                    }}
                    onOpenNotifications={() => {
                        router.push('/admin/gestion');
                    }}
                />

                <div className="p-4 md:p-5 lg:p-6 space-y-6">
                    {/* Vista: Lista de Conversaciones */}
                    {view === 'list' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card className={`${mounted && theme === 'dark' ? 'bg-slate-800/70 dark:border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-sm hover:shadow-lg transition-shadow`}>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className={`text-lg md:text-xl font-semibold flex items-center gap-2 ${mounted && theme === 'dark' ? 'text-white' : ''}`}>
                                                <Users className={`h-5 w-5 ${mounted && theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                                                {t('chat.list.activeConversations')}
                                            </CardTitle>
                                            <p className={`text-xs md:text-sm mt-1 ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                                {t('chat.list.selectConversation')}
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <ChatList
                                        onSelectConversation={handleSelectConversation}
                                        selectedUserId={selectedUserId}
                                        currentUserId={adminId ?? null}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Vista: Chat Abierto */}
                    {view === 'chat' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Card del Chat */}
                            <Card className={`${mounted && theme === 'dark' ? 'bg-slate-800/70 dark:border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-sm shadow-lg`}>
                                <CardHeader className={`px-2.5 py-2 border-b ${mounted && theme === 'dark' ? 'border-slate-700 bg-gradient-to-r from-slate-800 to-slate-700' : 'border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
                                    <div className="flex items-center gap-3">
                                        {/* Botón Volver */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleBackToList}
                                            className={`h-8 w-8 p-0 ${mounted && theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-blue-100'} transition-all`}
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>

                                        <div className="p-2 bg-blue-500 rounded-full">
                                            <MessageSquare className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className={`text-base font-semibold ${mounted && theme === 'dark' ? 'text-white' : ''}`}>{selectedUserName}</CardTitle>
                                            <p className={`text-xs ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t('chat.china.subtitle')}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="flex flex-col h-[calc(100vh-12rem)]">
                                        <ChatMessages
                                            messages={messages}
                                            currentUserId={adminId || ''}
                                            isOtherUserTyping={isOtherUserTyping}
                                            otherUserName={selectedUserName}
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
                    )}
                </div>
            </main>
        </div>
    );
}
