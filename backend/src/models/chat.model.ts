import { supabaseAdmin } from '../config/supabase';
import { Chat } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class ChatModel {
  /**
   * Create a new chat
   */
  static async createChat(
    type: 'direct' | 'group',
    createdBy: string,
    participants: string[]
  ): Promise<Chat | null> {
    try {
      // For direct chats, check if one already exists
      if (type === 'direct' && participants.length === 2) {
        const existing = await this.getDirectChat(participants[0], participants[1]);
        if (existing) return existing;
      }

      const { data, error } = await supabaseAdmin
        .from('chats')
        .insert({
          id: uuidv4(),
          type,
          participants,
          created_by: createdBy,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating chat:', error);
      return null;
    }
  }

  /**
   * Get a direct chat between two users
   */
  static async getDirectChat(userId1: string, userId2: string): Promise<Chat | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('chats')
        .select('*')
        .eq('type', 'direct')
        .contains('participants', [userId1, userId2])
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all chats for a user
   */
  static async getUserChats(userId: string): Promise<Chat[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('chats')
        .select(`
          *,
          last_message:messages(*)
        `)
        .contains('participants', [userId])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting user chats:', error);
      return [];
    }
  }

  /**
   * Get chat by ID
   */
  static async getChatById(chatId: string): Promise<Chat | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error getting chat:', error);
      return null;
    }
  }

  /**
   * Check if user is in chat
   */
  static async isUserInChat(chatId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('chats')
        .select('participants')
        .eq('id', chatId)
        .single();

      if (error || !data) return false;
      return data.participants.includes(userId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Add participant to chat
   */
  static async addParticipant(chatId: string, userId: string): Promise<boolean> {
    try {
      const chat = await this.getChatById(chatId);
      if (!chat) return false;

      if (chat.participants.includes(userId)) {
        return true; // Already in chat
      }

      const { error } = await supabaseAdmin
        .from('chats')
        .update({
          participants: [...chat.participants, userId],
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error adding participant:', error);
      return false;
    }
  }

  /**
   * Remove participant from chat
   */
  static async removeParticipant(chatId: string, userId: string): Promise<boolean> {
    try {
      const chat = await this.getChatById(chatId);
      if (!chat) return false;

      const { error } = await supabaseAdmin
        .from('chats')
        .update({
          participants: chat.participants.filter(p => p !== userId),
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error removing participant:', error);
      return false;
    }
  }
}
