"use client";

import { useState, useCallback, useEffect } from 'react';
import { useAdminLayoutContext } from '@/lib/AdminLayoutContext';
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
import { MessageSquare, ArrowLeft, Users, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ChatMessage, ChatGroupMember } from '@/lib/types/chat';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/hooks/useTranslation';
import { GroupInfoSheet } from '@/components/chat/GroupInfoSheet';
import { useChatGroups } from '@/hooks/use-chat-groups';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import React from 'react';

export default function AdminChatPage() {
    // 1. Estados de Navegación
    const [view, setView] = useState<'list' | 'chat'>('list');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedUserName, setSelectedUserName] = useState<string>('');
    const { toggleMobileMenu } = useAdminLayoutContext();
    const { adminId } = useAdminContext();
    const router = useRouter();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Group Info State
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [groupMembers, setGroupMembers] = useState<ChatGroupMember[]>([]);

    const { groups, getGroupMembers } = useChatGroups({ currentUserId: adminId || '' });

    // Cargar miembros del grupo cuando se selecciona
    useEffect(() => {
        if (selectedGroupId && view === 'chat') {
            getGroupMembers(selectedGroupId).then(members => {
                setGroupMembers(members);
            });
        } else {
            setGroupMembers([]);
        }
    }, [selectedGroupId, view, getGroupMembers]);

    // Calcular subtítulo del chat
    const chatSubtitle = React.useMemo(() => {
        if (selectedGroupId && groupMembers.length > 0) {
            const names = groupMembers
                .filter(m => m.user_id !== adminId)
                // Usar user_name si existe, sino email
                .map(m => m.user_name || (m.user_email?.split('@')[0] || 'Usuario'))
                .slice(0, 5);

            if (names.length === 0) return 'Solo tú';
            // Si hay más de 5 mostrados, indicar cuántos faltan
            const remaining = groupMembers.filter(m => m.user_id !== adminId).length - names.length;
            const suffix = remaining > 0 ? ` y ${remaining} más...` : '';
            return names.join(', ') + suffix;
        } else if (selectedGroupId) {
            return 'Cargando miembros...';
        }
        return t('chat.china.subtitle');
    }, [selectedGroupId, groupMembers, adminId, t]);



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
        isGroupChat,
    } = useChatMessages({
        conversationUserId: selectedUserId,
        groupId: selectedGroupId,
        currentUserId: adminId ?? null,
        currentUserRole: 'admin',
    });

    const { isOtherUserTyping, notifyTyping, stopTyping } = useChatTyping({
        currentUserId: adminId ?? null,
        conversationUserId: selectedUserId,
    });

    // Callback estable para nuevos mensajes
    const handleNewMessage = useCallback((message: ChatMessage) => {
        // Mensajes individuales
        if (selectedUserId && message.sender_id === selectedUserId && !message.group_id) {
            addMessage(message);
        }
        // Mensajes de grupo
        if (selectedGroupId && message.group_id === selectedGroupId) {
            addMessage(message);
        }
    }, [selectedUserId, selectedGroupId, addMessage]);

    // Realtime: escuchar nuevos mensajes
    useChatRealtime({
        currentUserId: adminId ?? null,
        onNewMessage: handleNewMessage,
    });

    const handleSelectConversation = useCallback((conversationId: string, name: string) => {
        // Parsear el formato: 'user_UUID' o 'group_UUID'
        if (conversationId.startsWith('group_')) {
            setSelectedGroupId(conversationId.replace('group_', ''));
            setSelectedUserId(null);
        } else {
            setSelectedUserId(conversationId.replace('user_', ''));
            setSelectedGroupId(null);
        }
        setSelectedUserName(name);
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
            {/* ... Header y Contenido ... */}

            {/* Componente Group Info Sheet (fuera del flujo visual principal pero dentro del componente) */}
            <GroupInfoSheet
                open={showGroupInfo}
                onOpenChange={setShowGroupInfo}
                groupId={selectedGroupId || ''}
                currentUserId={adminId || ''}
                groupName={groups.find(g => g.id === selectedGroupId)?.name || ''}
                isOwner={groups.find(g => g.id === selectedGroupId)?.created_by === adminId}
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
                                    selectedUserId={selectedUserId ? `user_${selectedUserId}` : (selectedGroupId ? `group_${selectedGroupId}` : null)}
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

                                    {selectedGroupId ? (
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage
                                                src={groups.find(g => g.id === selectedGroupId)?.avatar_url || ''}
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
                                            {chatSubtitle}
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
        </>
    );
}
