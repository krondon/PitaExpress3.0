"use client";

import { useState, useCallback, useEffect } from 'react';

import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatList } from '@/components/chat/ChatList';
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatRealtime } from '@/hooks/use-chat-realtime';
import { useChatTyping } from '@/hooks/use-chat-typing';
import { usePagosLayoutContext } from '@/lib/PagosLayoutContext';
import { useNotifications } from '@/hooks/use-notifications';
import { MessageSquare, ArrowLeft, Users, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ChatMessage } from '@/lib/types/chat';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/hooks/useTranslation';
import { GroupInfoSheet } from '@/components/chat/GroupInfoSheet';
import { useChatGroups } from '@/hooks/use-chat-groups';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChatGroupsProvider } from '@/lib/contexts/ChatGroupsContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function PagosChatPage() {
    const supabase = getSupabaseBrowserClient();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        };
        getUser();
    }, [supabase]);

    return (
        <ChatGroupsProvider currentUserId={userId}>
            <PagosChatContent />
        </ChatGroupsProvider>
    );
}

function PagosChatContent() {
    const { toggleMobileMenu } = usePagosLayoutContext();
    const router = useRouter();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);
    const [pagosId, setPagosId] = useState<string | null>(null);
    const [pagosName, setPagosName] = useState<string | null>(null);

    // Obtener ID del usuario actual (Pagos)
    useEffect(() => {
        setMounted(true);
        const supabase = getSupabaseBrowserClient();
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setPagosId(user.id);
                setPagosName(user.user_metadata?.name || user.email || 'Pagos');
            }
        };
        getUser();
    }, []);

    // Estado de navegación: 'list' o 'chat'
    const [view, setView] = useState<'list' | 'chat'>('list');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState<string>('');
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [selectedConversationAvatar, setSelectedConversationAvatar] = useState<string | undefined>(undefined);

    // Hooks con el ID obtenido
    const { groups } = useChatGroups({ currentUserId: pagosId || '' });

    // Notificaciones
    const { uiItems: notificationsList, unreadCount, markAllAsRead } = useNotifications({
        role: 'pagos',
        userId: pagosId || undefined, // undefined si es null
        limit: 10,
        enabled: !!pagosId
    });

    const {
        messages,
        loading,
        sending,
        sendMessage,
        addMessage,
        editMessage,
        deleteMessage,
        isGroupChat,
    } = useChatMessages({
        conversationUserId: selectedUserId,
        groupId: selectedGroupId,
        currentUserId: pagosId || null,
        currentUserName: pagosName || null,
        currentUserRole: 'pagos',
    });

    const { isOtherUserTyping, typingUserName, notifyTyping, stopTyping } = useChatTyping({
        currentUserId: pagosId || null,
        currentUserName: pagosName || null,
        conversationUserId: selectedUserId,
        groupId: selectedGroupId || null,
    });

    // Callback estable para nuevos mensajes
    const handleNewMessage = useCallback((message: ChatMessage) => {
        // Si estamos en una conversación individual y el mensaje es de ese usuario
        if (selectedUserId && message.sender_id === selectedUserId && !message.group_id) {
            addMessage(message);
        }
        // Si estamos en un grupo y el mensaje es de ese grupo
        if (selectedGroupId && message.group_id === selectedGroupId) {
            addMessage(message);
        }
    }, [selectedUserId, selectedGroupId, addMessage]);

    // Realtime: escuchar nuevos mensajes
    useChatRealtime({
        currentUserId: pagosId || null,
        groupId: selectedGroupId || null,
        onNewMessage: handleNewMessage,
    });

    const handleSelectConversation = useCallback((conversationId: string, name: string, avatarUrl?: string) => {
        // Determinar si es grupo o usuario
        if (conversationId.startsWith('group_')) {
            setSelectedGroupId(conversationId.replace('group_', ''));
            setSelectedUserId(null);
        } else {
            setSelectedUserId(conversationId.replace('user_', ''));
            setSelectedGroupId(null);
        }
        setSelectedUserName(name);
        setSelectedConversationAvatar(avatarUrl);
        setView('chat');
    }, []);

    const handleBackToList = useCallback(() => {
        setView('list');
        setSelectedUserId(null);
        setSelectedGroupId(null);
        setSelectedUserName('');
    }, []);

    const handleSendMessage = useCallback(
        async (text: string, fileData?: { url: string; name: string; type: string; size: number }) => {
            if (!selectedUserId && !selectedGroupId) return;

            const success = await sendMessage({
                receiver_id: selectedUserId || undefined,
                group_id: selectedGroupId || undefined,
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
        [selectedUserId, selectedGroupId, sendMessage, stopTyping]
    );

    return (
        <>

            <GroupInfoSheet
                open={showGroupInfo}
                onOpenChange={setShowGroupInfo}
                groupId={selectedGroupId || ''}
                currentUserId={pagosId || ''}
                groupName={groups.find(g => g.id === selectedGroupId)?.name || ''}
                isOwner={groups.find(g => g.id === selectedGroupId)?.created_by === pagosId}
                onLeaveGroup={() => {
                    setShowGroupInfo(false);
                    handleBackToList();
                }}
                onDeleteGroup={() => {
                    setShowGroupInfo(false);
                    handleBackToList();
                }}
            />

            <Header
                notifications={unreadCount}
                onMenuToggle={toggleMobileMenu}
                title={t('chat.list.title')}
                subtitle={t('chat.list.subtitle')}
                notificationsItems={notificationsList}
                onMarkAllAsRead={async () => {
                    await markAllAsRead();
                }}
                onOpenNotifications={() => {
                    router.push('/pagos/validacion-pagos'); // O donde sea relevante
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
                                    selectedUserId={selectedUserId ? `user_${selectedUserId}` : (selectedGroupId ? `group_${selectedGroupId}` : null)}
                                    currentUserId={pagosId ?? null}
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

                                    {selectedGroupId ? (
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage
                                                src={selectedConversationAvatar || groups.find(g => g.id === selectedGroupId)?.avatar_url || ''}
                                                alt={groups.find(g => g.id === selectedGroupId)?.name}
                                            />
                                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                                                <Users className="h-5 w-5 text-white" />
                                            </AvatarFallback>
                                        </Avatar>
                                    ) : (
                                        <div className="p-2 bg-blue-500 rounded-full">
                                            <MessageSquare className="h-5 w-5 text-white" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <CardTitle className={`text-base font-semibold truncate ${mounted && theme === 'dark' ? 'text-white' : ''}`}>
                                            {selectedGroupId ? (groups.find(g => g.id === selectedGroupId)?.name || selectedUserName) : selectedUserName}
                                        </CardTitle>
                                        <p className={`text-xs truncate ${mounted && theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                            {isGroupChat ? t('chat.group.subtitle') : t('chat.direct.subtitle')}
                                        </p>
                                    </div>

                                    {selectedGroupId && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowGroupInfo(true)}
                                            className={`ml-2 ${mounted && theme === 'dark' ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-blue-100 text-slate-600'}`}
                                        >
                                            <Info className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="flex flex-col h-[calc(100vh-12rem)]">
                                    <ChatMessages
                                        messages={messages}
                                        currentUserId={pagosId || ''}
                                        isOtherUserTyping={isOtherUserTyping}
                                        otherUserName={selectedUserName}
                                        typingUserName={typingUserName}
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
        </>
    );
}
