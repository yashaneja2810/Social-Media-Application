import { supabaseAdmin } from '../config/supabase';
import { Friend } from '../types';
import { logger } from '../utils/logger';

export class FriendModel {
  /**
   * Send friend request
   */
  static async sendRequest(userId: string, friendId: string): Promise<Friend | null> {
    try {
      // Check if relationship already exists
      const existing = await this.getRelationship(userId, friendId);
      if (existing) {
        throw new Error('Friend relationship already exists');
      }

      const { data, error } = await supabaseAdmin
        .from('friends')
        .insert({
          user_id: userId,
          friend_id: friendId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error sending friend request:', error);
      return null;
    }
  }

  /**
   * Accept friend request
   */
  static async acceptRequest(userId: string, friendId: string): Promise<boolean> {
    try {
      // Update the incoming request
      const { error } = await supabaseAdmin
        .from('friends')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (error) throw error;

      // Create reciprocal relationship
      await supabaseAdmin
        .from('friends')
        .insert({
          user_id: userId,
          friend_id: friendId,
          status: 'accepted',
        });

      return true;
    } catch (error) {
      logger.error('Error accepting friend request:', error);
      return false;
    }
  }

  /**
   * Reject friend request
   */
  static async rejectRequest(userId: string, friendId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('friends')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error rejecting friend request:', error);
      return false;
    }
  }

  /**
   * Block user
   */
  static async blockUser(userId: string, friendId: string): Promise<boolean> {
    try {
      // Delete any existing relationships
      await supabaseAdmin
        .from('friends')
        .delete()
        .or(`user_id.eq.${userId},user_id.eq.${friendId}`)
        .or(`friend_id.eq.${userId},friend_id.eq.${friendId}`);

      // Create block relationship
      const { error } = await supabaseAdmin
        .from('friends')
        .insert({
          user_id: userId,
          friend_id: friendId,
          status: 'blocked',
        });

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error blocking user:', error);
      return false;
    }
  }

  /**
   * Unblock user
   */
  static async unblockUser(userId: string, friendId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('friends')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId)
        .eq('status', 'blocked');

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error unblocking user:', error);
      return false;
    }
  }

  /**
   * Get friend list
   */
  static async getFriends(userId: string): Promise<Friend[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('friends')
        .select(`
          *,
          friend:user_profiles!friend_id(id, email, username, display_name, avatar_url, status, last_seen)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting friends:', error);
      return [];
    }
  }

  /**
   * Get pending friend requests
   */
  static async getPendingRequests(userId: string): Promise<Friend[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('friends')
        .select(`
          *,
          requester:user_profiles!user_id(id, email, username, display_name, avatar_url)
        `)
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting pending requests:', error);
      return [];
    }
  }

  /**
   * Check if users are friends
   */
  static async areFriends(userId: string, friendId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('friends')
        .select('id')
        .eq('user_id', userId)
        .eq('friend_id', friendId)
        .eq('status', 'accepted')
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get relationship between two users
   */
  static async getRelationship(userId: string, friendId: string): Promise<Friend | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      return null;
    }
  }
}
