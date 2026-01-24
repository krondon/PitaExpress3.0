// ============================================
// TIPOS PARA EL SISTEMA DE CHAT
// ============================================

// Roles válidos para el chat
export type ChatRole = 'admin' | 'china' | 'venezuela' | 'pagos' | 'client';

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_role: ChatRole;
  receiver_id: string | null; // null cuando es mensaje de grupo
  receiver_role: ChatRole | null; // null cuando es mensaje de grupo
  group_id: string | null; // ID del grupo si es mensaje grupal
  message: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  read: boolean;
  created_at: string;
  updated_at: string;
  is_edited?: boolean;
  deleted_by_sender?: boolean;
  deleted_by_receiver?: boolean;
  is_deleted?: boolean;
  // Para mensajes de grupo, incluir info del sender
  sender_name?: string;
  sender_avatar?: string;
}

// Conversación unificada (individual o grupo)
export interface ChatConversation {
  conversation_id: string; // 'user_UUID' o 'group_UUID'
  is_group: boolean;
  name: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
  last_sender_id: string | null;
  participant_ids: string[];
}

// Conversación individual (legacy, para compatibilidad)
export interface ChatConversationLegacy {
  user_id: string;
  user_email: string;
  user_name: string;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
  last_file_url: string | null;
}

export interface ChatUser {
  id: string;
  email: string;
  name: string;
  role: ChatRole;
  avatar_url?: string;
}

// ============================================
// TIPOS PARA GRUPOS
// ============================================

export interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  // Info del usuario (join con auth.users)
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  member_ids: string[];
}

// ============================================
// TIPOS PARA TYPING Y ARCHIVOS
// ============================================

export interface TypingStatus {
  id: string;
  user_id: string;
  typing_to_id: string; // puede ser user_id o group_id
  is_typing: boolean;
  updated_at: string;
}

export interface FileAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

// ============================================
// PAYLOADS PARA OPERACIONES
// ============================================

export interface SendMessagePayload {
  receiver_id?: string; // Para mensajes directos
  group_id?: string; // Para mensajes de grupo
  message?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

export interface MarkReadPayload {
  conversation_user_id?: string;
  group_id?: string;
}

export interface TypingPayload {
  receiver_id?: string;
  group_id?: string;
  is_typing: boolean;
}

// ============================================
// RESULTADO DE BÚSQUEDA
// ============================================

export interface SearchUserResult {
  user_id: string;
  email: string;
  name: string;
  role: string;
  avatar_url: string | null;
}
