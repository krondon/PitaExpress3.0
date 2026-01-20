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
    removeMember: (groupId: string, userId: string) => Promise<boolean>;
    leaveGroup: (groupId: string) => Promise<boolean>;
    getGroupMembers: (groupId: string) => Promise<ChatGroupMember[]>;
    searchUsers: (query: string) => Promise<SearchUserResult[]>;
    refreshGroups: () => Promise<void>;
}

export function useChatGroups({ currentUserId }: UseChatGroupsOptions): UseChatGroupsReturn {
    const [groups, setGroups] = useState<ChatGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = getSupabaseBrowserClient();

    // Cargar grupos del usuario
    const fetchGroups = useCallback(async () => {
        if (!currentUserId) {
            setGroups([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('chat_groups')
                .select(`
          *,
          chat_group_members!inner (user_id)
        `)
                .eq('chat_group_members.user_id', currentUserId)
                .order('updated_at', { ascending: false });

            if (fetchError) {
                console.error('[useChatGroups] fetchError:', fetchError.message, fetchError.code, fetchError.details);
                throw fetchError;
            }

            setGroups(data || []);
        } catch (err: any) {
            console.error('[useChatGroups] Error fetching groups:', err?.message || err, JSON.stringify(err));
            setError(err.message || 'Error al cargar grupos');
        } finally {
            setLoading(false);
        }
    }, [currentUserId, supabase]);

    // Inicial load
    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    // Realtime subscription para grupos
    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`chat-groups-${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_groups',
                },
                () => {
                    fetchGroups();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_group_members',
                    filter: `user_id=eq.${currentUserId}`,
                },
                () => {
                    fetchGroups();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId, supabase, fetchGroups]);

    // Crear grupo usando RPC
    const createGroup = useCallback(async (payload: CreateGroupPayload): Promise<string | null> => {
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
            console.error('[useChatGroups] Error creating group:', err);
            setError(err.message || 'Error al crear grupo');
            return null;
        }
    }, [currentUserId, supabase, fetchGroups]);

    // Eliminar grupo
    const deleteGroup = useCallback(async (groupId: string): Promise<boolean> => {
        if (!currentUserId) return false;

        try {
            const { error: deleteError } = await supabase
                .from('chat_groups')
                .delete()
                .eq('id', groupId);

            if (deleteError) throw deleteError;

            await fetchGroups();
            return true;
        } catch (err: any) {
            console.error('[useChatGroups] Error deleting group:', err);
            setError(err.message || 'Error al eliminar grupo');
            return false;
        }
    }, [currentUserId, supabase, fetchGroups]);

    // Actualizar grupo
    const updateGroup = useCallback(async (
        groupId: string,
        updates: Partial<Pick<ChatGroup, 'name' | 'description' | 'avatar_url'>>
    ): Promise<boolean> => {
        if (!currentUserId) return false;

        try {
            const { error: updateError } = await supabase
                .from('chat_groups')
                .update(updates)
                .eq('id', groupId);

            if (updateError) throw updateError;

            await fetchGroups();
            return true;
        } catch (err: any) {
            console.error('[useChatGroups] Error updating group:', err);
            setError(err.message || 'Error al actualizar grupo');
            return false;
        }
    }, [currentUserId, supabase, fetchGroups]);

    // Añadir miembro
    const addMember = useCallback(async (groupId: string, userId: string): Promise<boolean> => {
        if (!currentUserId) return false;

        try {
            const { error: addError } = await supabase
                .from('chat_group_members')
                .insert({
                    group_id: groupId,
                    user_id: userId,
                    role: 'member',
                });

            if (addError) throw addError;

            return true;
        } catch (err: any) {
            console.error('[useChatGroups] Error adding member:', err);
            setError(err.message || 'Error al añadir miembro');
            return false;
        }
    }, [currentUserId, supabase]);

    // Promover miembro a admin
    const promoteMember = useCallback(async (groupId: string, userId: string): Promise<boolean> => {
        if (!currentUserId) return false;

        try {
            const { error: updateError } = await supabase
                .from('chat_group_members')
                .update({ role: 'admin' })
                .eq('group_id', groupId)
                .eq('user_id', userId);

            if (updateError) throw updateError;

            return true;
        } catch (err: any) {
            console.error('[useChatGroups] Error promoting member:', err);
            setError(err.message || 'Error al promover miembro');
            return false;
        }
    }, [currentUserId, supabase]);

    // Eliminar miembro
    const removeMember = useCallback(async (groupId: string, userId: string): Promise<boolean> => {
        if (!currentUserId) return false;

        try {
            const { error: removeError } = await supabase
                .from('chat_group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', userId);

            if (removeError) throw removeError;

            return true;
        } catch (err: any) {
            console.error('[useChatGroups] Error removing member:', err);
            setError(err.message || 'Error al eliminar miembro');
            return false;
        }
    }, [currentUserId, supabase]);

    // Salir del grupo
    const leaveGroup = useCallback(async (groupId: string): Promise<boolean> => {
        if (!currentUserId) return false;

        try {
            const { error: leaveError } = await supabase
                .from('chat_group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('user_id', currentUserId);

            if (leaveError) throw leaveError;

            await fetchGroups();
            return true;
        } catch (err: any) {
            console.error('[useChatGroups] Error leaving group:', err);
            setError(err.message || 'Error al salir del grupo');
            return false;
        }
    }, [currentUserId, supabase, fetchGroups]);

    // Obtener miembros del grupo
    const getGroupMembers = useCallback(async (groupId: string): Promise<ChatGroupMember[]> => {
        try {
            const { data, error: fetchError } = await supabase
                .from('chat_group_members')
                .select('*')
                .eq('group_id', groupId)
                .order('joined_at', { ascending: true });

            if (fetchError) throw fetchError;

            // Obtener info de usuarios
            const memberIds = (data || []).map(m => m.user_id);
            if (memberIds.length === 0) return [];

            // Fetch user info using RPC to get real names
            const { data: usersData, error: rpcError } = await supabase
                .rpc('get_chat_users_by_ids', { user_ids: memberIds });

            if (rpcError) throw rpcError;

            // Map user details
            const userMap = new Map<string, any>((usersData || []).map((u: any) => [u.user_id, u]));

            return (data || []).map(member => ({
                ...member,
                user_name: userMap.get(member.user_id)?.name || 'Usuario',
                user_email: userMap.get(member.user_id)?.email,
                user_avatar: userMap.get(member.user_id)?.avatar_url,
            }));
        } catch (err: any) {
            console.error('[useChatGroups] Error fetching members:', err);
            return [];
        }
    }, [supabase]);

    // Buscar usuarios para añadir al chat (query vacío = todos los usuarios)
    const searchUsers = useCallback(async (query: string): Promise<SearchUserResult[]> => {
        if (!currentUserId) return [];
        // Si query tiene menos de 2 caracteres y no está vacío, no buscar
        if (query.length > 0 && query.length < 2) return [];

        try {
            const { data, error: searchError } = await supabase.rpc('search_chat_users', {
                search_query: query || '', // query vacío = todos
                current_user_id: currentUserId,
                result_limit: query ? 20 : 50, // más resultados si es carga inicial
            });

            if (searchError) {
                console.error('[useChatGroups] searchError:', searchError.message, searchError.code, searchError.details);
                throw searchError;
            }

            return (data || []) as SearchUserResult[];
        } catch (err: any) {
            console.error('[useChatGroups] Error searching users:', err?.message || err, JSON.stringify(err));
            return [];
        }
    }, [currentUserId, supabase]);

    return {
        groups,
        loading,
        error,
        createGroup,
        deleteGroup,
        updateGroup,
        addMember,
        promoteMember,
        removeMember,
        leaveGroup,
        getGroupMembers,
        searchUsers,
        refreshGroups: fetchGroups,
    };
}
