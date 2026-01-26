'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ChatGroup, ChatGroupMember, CreateGroupPayload, SearchUserResult } from '@/lib/types/chat';

interface ChatGroupsContextType {
    groups: ChatGroup[];
    loading: boolean;
    error: string | null;
    refreshGroups: () => Promise<void>;
    createGroup: (payload: CreateGroupPayload) => Promise<string | null>;
    deleteGroup: (groupId: string) => Promise<boolean>;
    updateGroup: (groupId: string, updates: Partial<Pick<ChatGroup, 'name' | 'description' | 'avatar_url'>>) => Promise<boolean>;
    getGroupMembers: (groupId: string) => Promise<ChatGroupMember[]>;
}

const ChatGroupsContext = createContext<ChatGroupsContextType | undefined>(undefined);

export function ChatGroupsProvider({ children, currentUserId }: { children: ReactNode; currentUserId: string | null }) {
    const [groups, setGroups] = useState<ChatGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = getSupabaseBrowserClient();

    const fetchGroups = useCallback(async () => {
        if (!currentUserId) {
            setGroups([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error: fetchError } = await supabase
                .from('chat_groups')
                .select(`
                    id, name, description, avatar_url, created_at, updated_at, created_by,
                    chat_group_members!inner (user_id)
                `)
                .eq('chat_group_members.user_id', currentUserId)
                .order('updated_at', { ascending: false });

            if (fetchError) throw fetchError;
            setGroups(data || []);
        } catch (err: any) {
            console.error('[ChatGroupsProvider] Error fetching groups:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, supabase]);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    // Realtime subscription
    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`global-chat-groups-${currentUserId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'chat_groups' },
                () => fetchGroups()
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_group_members',
                    filter: `user_id=eq.${currentUserId}`
                },
                () => fetchGroups()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId, supabase, fetchGroups]);

    const createGroup = async (payload: CreateGroupPayload) => {
        if (!currentUserId) return null;
        try {
            const { data, error: createError } = await supabase.rpc('create_chat_group', {
                group_name: payload.name,
                group_description: payload.description || null,
                member_ids: payload.member_ids,
            });
            if (createError) throw createError;
            await fetchGroups();
            return data as string;
        } catch (err: any) {
            console.error('Error creating group:', err);
            return null;
        }
    };

    const deleteGroup = async (groupId: string) => {
        try {
            const { error: deleteError } = await supabase.from('chat_groups').delete().eq('id', groupId);
            if (deleteError) throw deleteError;
            await fetchGroups();
            return true;
        } catch (err) {
            console.error('Error deleting group:', err);
            return false;
        }
    };

    const updateGroup = async (groupId: string, updates: any) => {
        try {
            const { error: updateError } = await supabase.from('chat_groups').update(updates).eq('id', groupId);
            if (updateError) throw updateError;
            await fetchGroups();
            return true;
        } catch (err) {
            console.error('Error updating group:', err);
            return false;
        }
    };

    const getGroupMembers = async (groupId: string) => {
        try {
            const { data, error: fetchError } = await supabase
                .from('chat_group_members')
                .select('*')
                .eq('group_id', groupId)
                .order('joined_at', { ascending: true });

            if (fetchError) throw fetchError;
            const memberIds = (data || []).map(m => m.user_id);
            if (memberIds.length === 0) return [];

            const { data: usersData, error: rpcError } = await supabase
                .rpc('get_chat_users_by_ids', { user_ids: memberIds });

            if (rpcError) throw rpcError;
            const userMap = new Map<string, any>((usersData || []).map((u: any) => [u.user_id, u]));

            return (data || []).map(member => ({
                ...member,
                user_name: userMap.get(member.user_id)?.name || 'Usuario',
                user_email: userMap.get(member.user_id)?.email,
                user_avatar: userMap.get(member.user_id)?.avatar_url,
            }));
        } catch (err) {
            console.error('Error fetching members:', err);
            return [];
        }
    };

    return (
        <ChatGroupsContext.Provider value={{
            groups,
            loading,
            error,
            refreshGroups: fetchGroups,
            createGroup,
            deleteGroup,
            updateGroup,
            getGroupMembers
        }}>
            {children}
        </ChatGroupsContext.Provider>
    );
}

export const useChatGroupsContext = () => {
    const context = useContext(ChatGroupsContext);
    if (!context) throw new Error('useChatGroupsContext must be used within ChatGroupsProvider');
    return context;
};
