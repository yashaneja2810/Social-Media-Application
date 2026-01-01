import { supabaseAdmin } from '../config/supabase';
import { Group, GroupSettings } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { EncryptionUtils } from '../utils/encryption';

export class GroupModel {
  /**
   * Create a new group
   */
  static async createGroup(
    name: string,
    createdBy: string,
    memberIds: string[],
    description?: string,
    avatarUrl?: string
  ): Promise<Group | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('groups')
        .insert({
          id: uuidv4(),
          name,
          description,
          avatar_url: avatarUrl,
          admin_ids: [createdBy],
          member_ids: [...new Set([createdBy, ...memberIds])],
          created_by: createdBy,
          settings: {
            only_admins_can_message: false,
            only_admins_can_add_members: false,
            invite_link_enabled: false,
          },
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating group:', error);
      return null;
    }
  }

  /**
   * Get group by ID
   */
  static async getGroupById(groupId: string): Promise<Group | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error getting group:', error);
      return null;
    }
  }

  /**
   * Get user's groups
   */
  static async getUserGroups(userId: string): Promise<Group[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('groups')
        .select('*')
        .contains('member_ids', [userId])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting user groups:', error);
      return [];
    }
  }

  /**
   * Add member to group
   */
  static async addMember(groupId: string, userId: string, addedBy: string): Promise<boolean> {
    try {
      const group = await this.getGroupById(groupId);
      if (!group) return false;

      // Check permissions
      if (group.settings?.only_admins_can_add_members && !group.admin_ids.includes(addedBy)) {
        throw new Error('Only admins can add members');
      }

      if (group.member_ids.includes(userId)) {
        return true; // Already a member
      }

      const { error } = await supabaseAdmin
        .from('groups')
        .update({
          member_ids: [...group.member_ids, userId],
          updated_at: new Date().toISOString(),
        })
        .eq('id', groupId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error adding member to group:', error);
      return false;
    }
  }

  /**
   * Remove member from group
   */
  static async removeMember(groupId: string, userId: string, removedBy: string): Promise<boolean> {
    try {
      const group = await this.getGroupById(groupId);
      if (!group) return false;

      // Check if user is admin or removing themselves
      if (!group.admin_ids.includes(removedBy) && removedBy !== userId) {
        throw new Error('Only admins can remove members');
      }

      const { error } = await supabaseAdmin
        .from('groups')
        .update({
          member_ids: group.member_ids.filter(id => id !== userId),
          admin_ids: group.admin_ids.filter(id => id !== userId),
          updated_at: new Date().toISOString(),
        })
        .eq('id', groupId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error removing member from group:', error);
      return false;
    }
  }

  /**
   * Promote member to admin
   */
  static async promoteToAdmin(groupId: string, userId: string, promotedBy: string): Promise<boolean> {
    try {
      const group = await this.getGroupById(groupId);
      if (!group) return false;

      if (!group.admin_ids.includes(promotedBy)) {
        throw new Error('Only admins can promote members');
      }

      if (group.admin_ids.includes(userId)) {
        return true; // Already admin
      }

      const { error } = await supabaseAdmin
        .from('groups')
        .update({
          admin_ids: [...group.admin_ids, userId],
          updated_at: new Date().toISOString(),
        })
        .eq('id', groupId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error promoting to admin:', error);
      return false;
    }
  }

  /**
   * Update group settings
   */
  static async updateSettings(groupId: string, settings: Partial<GroupSettings>, userId: string): Promise<boolean> {
    try {
      const group = await this.getGroupById(groupId);
      if (!group) return false;

      if (!group.admin_ids.includes(userId)) {
        throw new Error('Only admins can update settings');
      }

      const { error } = await supabaseAdmin
        .from('groups')
        .update({
          settings: { ...group.settings, ...settings },
          updated_at: new Date().toISOString(),
        })
        .eq('id', groupId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error updating group settings:', error);
      return false;
    }
  }

  /**
   * Generate invite link
   */
  static async generateInviteLink(groupId: string, userId: string): Promise<string | null> {
    try {
      const group = await this.getGroupById(groupId);
      if (!group) return null;

      if (!group.admin_ids.includes(userId)) {
        throw new Error('Only admins can generate invite links');
      }

      const inviteCode = EncryptionUtils.generateToken(16);
      const inviteLink = `${groupId}:${inviteCode}`;

      await this.updateSettings(groupId, {
        invite_link: inviteLink,
        invite_link_enabled: true,
      }, userId);

      return inviteLink;
    } catch (error) {
      logger.error('Error generating invite link:', error);
      return null;
    }
  }

  /**
   * Join group via invite link
   */
  static async joinViaInviteLink(inviteLink: string, userId: string): Promise<boolean> {
    try {
      const [groupId] = inviteLink.split(':');
      const group = await this.getGroupById(groupId);

      if (!group || !group.settings?.invite_link_enabled) {
        throw new Error('Invalid or disabled invite link');
      }

      if (group.settings.invite_link !== inviteLink) {
        throw new Error('Invalid invite link');
      }

      return await this.addMember(groupId, userId, group.created_by);
    } catch (error) {
      logger.error('Error joining via invite link:', error);
      return false;
    }
  }

  /**
   * Update group info
   */
  static async updateGroupInfo(
    groupId: string,
    userId: string,
    updates: { name?: string; description?: string; avatar_url?: string }
  ): Promise<boolean> {
    try {
      const group = await this.getGroupById(groupId);
      if (!group) return false;

      if (!group.admin_ids.includes(userId)) {
        throw new Error('Only admins can update group info');
      }

      const { error } = await supabaseAdmin
        .from('groups')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', groupId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error updating group info:', error);
      return false;
    }
  }
}
