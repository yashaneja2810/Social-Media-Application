import { supabaseAdmin } from '../config/supabase';
import { Backup } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class BackupModel {
  /**
   * Create backup record
   */
  static async createBackup(
    userId: string,
    googleEmail: string,
    backupSize: number,
    encryptedHash: string
  ): Promise<Backup | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('backups')
        .insert({
          id: uuidv4(),
          user_id: userId,
          google_email: googleEmail,
          backup_size: backupSize,
          encrypted_hash: encryptedHash,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating backup:', error);
      return null;
    }
  }

  /**
   * Update backup with Drive file ID
   */
  static async updateBackup(
    backupId: string,
    driveFileId: string,
    status: 'completed' | 'failed'
  ): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('backups')
        .update({
          drive_file_id: driveFileId,
          status,
        })
        .eq('id', backupId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error updating backup:', error);
      return false;
    }
  }

  /**
   * Get user backups
   */
  static async getUserBackups(userId: string): Promise<Backup[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('backups')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting user backups:', error);
      return [];
    }
  }

  /**
   * Get latest successful backup
   */
  static async getLatestBackup(userId: string): Promise<Backup | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('backups')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete backup record
   */
  static async deleteBackup(backupId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('backups')
        .delete()
        .eq('id', backupId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error deleting backup:', error);
      return false;
    }
  }
}
