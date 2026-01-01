/**
 * Application-wide type definitions
 */

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  status: 'online' | 'offline' | 'away';
  last_seen: Date;
  created_at: Date;
  privacy_settings?: PrivacySettings;
}

export interface PrivacySettings {
  who_can_add_friend: 'everyone' | 'friends_of_friends' | 'nobody';
  who_can_message: 'everyone' | 'friends' | 'nobody';
  read_receipts: boolean;
  typing_indicators: boolean;
  online_status: boolean;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  encrypted_content: string; // Base64 encoded encrypted blob
  message_type: 'text' | 'image' | 'file' | 'voice';
  metadata?: MessageMetadata;
  status: 'sent' | 'delivered' | 'read';
  reply_to?: string;
  created_at: Date;
  expires_at?: Date; // For self-destructing messages
  encryption_key_id: string; // Reference to the encryption key used
}

export interface MessageMetadata {
  file_name?: string;
  file_size?: number;
  file_type?: string;
  duration?: number; // For voice messages
  thumbnail?: string; // For images/videos
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  last_message?: Message;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  admin_ids: string[];
  member_ids: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  settings?: GroupSettings;
}

export interface GroupSettings {
  only_admins_can_message: boolean;
  only_admins_can_add_members: boolean;
  invite_link?: string;
  invite_link_enabled: boolean;
}

export interface Backup {
  id: string;
  user_id: string;
  google_email: string;
  drive_file_id?: string;
  backup_size: number;
  encrypted_hash: string; // Hash of encrypted backup for verification
  created_at: Date;
  status: 'pending' | 'completed' | 'failed';
}

export interface DeviceVerification {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  verification_code: string;
  verified: boolean;
  created_at: Date;
  expires_at: Date;
}

export interface PresenceData {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  socketId?: string;
}

export interface TypingIndicator {
  userId: string;
  chatId: string;
  isTyping: boolean;
}

// Socket event types
export enum SocketEvents {
  // Connection
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  AUTHENTICATE = 'authenticate',

  // Messaging
  MESSAGE_SEND = 'message:send',
  MESSAGE_RECEIVE = 'message:receive',
  MESSAGE_DELIVERED = 'message:delivered',
  MESSAGE_READ = 'message:read',
  MESSAGE_DELETE = 'message:delete',

  // Typing
  TYPING_START = 'typing:start',
  TYPING_STOP = 'typing:stop',
  TYPING_UPDATE = 'typing:update',

  // Presence
  PRESENCE_UPDATE = 'presence:update',
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',

  // Friends
  FRIEND_REQUEST = 'friend:request',
  FRIEND_ACCEPT = 'friend:accept',
  FRIEND_REJECT = 'friend:reject',

  // Groups
  GROUP_CREATED = 'group:created',
  GROUP_UPDATED = 'group:updated',
  GROUP_MEMBER_ADDED = 'group:member:added',
  GROUP_MEMBER_REMOVED = 'group:member:removed',

  // Errors
  ERROR = 'error',
}
