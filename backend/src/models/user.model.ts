import { supabaseAdmin } from '../config/supabase';
import { UserProfile, PrivacySettings } from '../types';
import { logger } from '../utils/logger';

export class UserModel {
  /**
   * Create or update user profile
   */
  static async upsertProfile(userId: string, email: string, data?: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const { data: profile, error } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: userId,
          email,
          status: 'online',
          last_seen: new Date().toISOString(),
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return profile;
    } catch (error) {
      logger.error('Error upserting user profile:', error);
      return null;
    }
  }

  /**
   * Get user profile by ID
   */
  static async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Update user status
   */
  static async updateStatus(userId: string, status: 'online' | 'offline' | 'away'): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({
          status,
          last_seen: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error updating user status:', error);
      return false;
    }
  }

  /**
   * Update privacy settings
   */
  static async updatePrivacySettings(userId: string, settings: PrivacySettings): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ privacy_settings: settings })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error updating privacy settings:', error);
      return false;
    }
  }

  /**
   * Search users by email or username
   */
  static async searchUsers(query: string, limit: number = 10): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, username, display_name, avatar_url, status, last_seen, created_at')
        .or(`email.ilike.%${query}%,username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error searching users:', error);
      return [];
    }
  }
}
