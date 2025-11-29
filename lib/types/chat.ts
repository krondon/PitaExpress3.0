// ============================================
// TIPOS PARA EL SISTEMA DE CHAT
// ============================================

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_role: 'admin' | 'china';
  receiver_id: string;
  receiver_role: 'admin' | 'china';
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
}

export interface ChatConversation {
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
  role: 'admin' | 'china';
  avatar_url?: string;
}

export interface TypingStatus {
  id: string;
  user_id: string;
  typing_to_id: string;
  is_typing: boolean;
  updated_at: string;
}

export interface FileAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

export interface SendMessagePayload {
  receiver_id: string;
  message?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

export interface MarkReadPayload {
  conversation_user_id: string;
}

export interface TypingPayload {
  receiver_id: string;
  is_typing: boolean;
}
