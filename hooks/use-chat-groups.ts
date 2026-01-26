'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
    ChatGroup,
    ChatGroupMember,
    CreateGroupPayload,
    SearchUserResult
} from '@/lib/types/chat';

interface UseChatGroupsOptions {
    currentUserId: string | null;
}

interface UseChatGroupsReturn {
    groups: ChatGroup[];
    loading: boolean;
    error: string | null;
    createGroup: (payload: CreateGroupPayload) => Promise<string | null>;
    deleteGroup: (groupId: string) => Promise<boolean>;
    updateGroup: (groupId: string, updates: Partial<Pick<ChatGroup, 'name' | 'description' | 'avatar_url'>>) => Promise<boolean>;
    addMember: (groupId: string, userId: string) => Promise<boolean>;
    promoteMember: (groupId: string, userId: string) => Promise<boolean>;
    demoteMember: (groupId: string, userId: string) => Promise<boolean>;
    removeMember: (groupId: string, userId: string) => Promise<boolean>;
    leaveGroup: (groupId: string) => Promise<boolean>;
    getGroupMembers: (groupId: string) => Promise<ChatGroupMember[]>;
    searchUsers: (query: string) => Promise<SearchUserResult[]>;
    refreshGroups: () => Promise<void>;
}

import { useChatGroupsContext } from '@/lib/contexts/ChatGroupsContext';

export function useChatGroups({ currentUserId }: UseChatGroupsOptions): UseChatGroupsReturn {
    const context = useChatGroupsContext();
    const supabase = getSupabaseBrowserClient();

    // Mantener searchUsers fuera del contexto si es muy específico, pero 
    // por ahora lo implementamos aquí para mantener la interfaz.
    const searchUsers = useCallback(async (query: string): Promise<SearchUserResult[]> => {
        if (!currentUserId) return [];
        if (query.length > 0 && query.length < 2) return [];

        try {
            const { data, error: searchError } = await supabase.rpc('search_chat_users', {
                search_query: query || '',
                current_user_id: currentUserId,
                result_limit: query ? 20 : 50,
            });

            if (searchError) throw searchError;
            return (data || []) as SearchUserResult[];
        } catch (err: any) {
            console.error('[useChatGroups] Error searching users:', err);
            return [];
        }
    }, [currentUserId, supabase]);

    // OJO: demoteMember, promoteMember, etc. se mantienen como funciones locales que usan supabase directamente 
    // pero llaman a refreshGroups del contexto para sincronizar.

    const addMember = useCallback(async (groupId: string, userId: string) => {
        const { error } = await supabase.from('chat_group_members').insert({ group_id: groupId, user_id: userId, role: 'member' });
        if (!error) await context.refreshGroups();
        return !error;
    }, [supabase, context]);

    const removeMember = useCallback(async (groupId: string, userId: string) => {
        const { error } = await supabase.from('chat_group_members').delete().eq('group_id', groupId).eq('user_id', userId);
        if (!error) await context.refreshGroups();
        return !error;
    }, [supabase, context]);

    const promoteMember = useCallback(async (groupId: string, userId: string) => {
        const { error } = await supabase.from('chat_group_members').update({ role: 'admin' }).eq('group_id', groupId).eq('user_id', userId);
        if (!error) await context.refreshGroups();
        return !error;
    }, [supabase, context]);

    const demoteMember = useCallback(async (groupId: string, userId: string) => {
        const { error } = await supabase.from('chat_group_members').update({ role: 'member' }).eq('group_id', groupId).eq('user_id', userId);
        if (!error) await context.refreshGroups();
        return !error;
    }, [supabase, context]);

    const leaveGroup = useCallback(async (groupId: string) => {
        const { error } = await supabase.from('chat_group_members').delete().eq('group_id', groupId).eq('user_id', currentUserId || '');
        if (!error) await context.refreshGroups();
        return !error;
    }, [supabase, context, currentUserId]);

    return {
        ...context,
        addMember,
        removeMember,
        promoteMember,
        demoteMember,
        leaveGroup,
        searchUsers,
    };
}

