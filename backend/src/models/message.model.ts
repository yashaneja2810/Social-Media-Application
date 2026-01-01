import { supabaseAdmin } from '../config/supabase';
import { Message } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class MessageModel {
  /**
   * Create a new message
   */
  static async createMessage(
    chatId: string,
    senderId: string,
    encryptedContent: string,
    messageType: 'text' | 'image' | 'file' | 'voice',
    metadata?: any,
    encryptionKeyId?: string,
    expiresAt?: Date,
    replyTo?: string
  ): Promise<Message | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert({
          id: uuidv4(),
          chat_id: chatId,
          sender_id: senderId,
          encrypted_content: encryptedContent,
          message_type: messageType,
          metadata,
          status: 'sent',
          encryption_key_id: encryptionKeyId || 'default',
          expires_at: expiresAt?.toISOString(),
          reply_to: replyTo,
        })
        .select()
        .single();

      if (error) throw error;

      // Update chat's last message
      await supabaseAdmin
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);

      return data;
    } catch (error) {
      logger.error('Error creating message:', error);
      return null;
    }
  }

  /**
   * Get messages for a chat
   */
  static async getMessages(chatId: string, limit: number = 50, before?: string): Promise<Message[]> {
    try {
      let query = supabaseAdmin
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).reverse();
    } catch (error) {
      logger.error('Error getting messages:', error);
      return [];
    }
  }

  /**
   * Update message status
   */
  static async updateMessageStatus(
    messageId: string,
    status: 'sent' | 'delivered' | 'read'
  ): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('messages')
        .update({ status })
        .eq('id', messageId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error updating message status:', error);
      return false;
    }
  }

  /**
   * Mark messages as read
   */
  static async markAsRead(chatId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('messages')
        .update({ status: 'read' })
        .eq('chat_id', chatId)
        .neq('sender_id', userId)
        .in('status', ['sent', 'delivered']);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      return false;
    }
  }

  /**
   * Delete message (soft delete by removing content)
   */
  static async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('messages')
        .update({
          encrypted_content: '',
          metadata: { deleted: true },
        })
        .eq('id', messageId)
        .eq('sender_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error deleting message:', error);
      return false;
    }
  }

  /**
   * Delete expired messages (for self-destructing messages)
   */
  static async deleteExpiredMessages(): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('messages')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      logger.error('Error deleting expired messages:', error);
      return 0;
    }
  }

  /**
   * Get unread message count
   */
  static async getUnreadCount(chatId: string, userId: string): Promise<number> {
    try {
      const { count, error } = await supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .neq('sender_id', userId)
        .in('status', ['sent', 'delivered']);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      logger.error('Error getting unread count:', error);
      return 0;
    }
  }
}
