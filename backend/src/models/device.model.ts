import { supabaseAdmin } from '../config/supabase';
import { DeviceVerification } from '../types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { EncryptionUtils } from '../utils/encryption';

export class DeviceModel {
  /**
   * Create device verification request
   */
  static async createVerification(
    userId: string,
    deviceId: string,
    deviceName: string
  ): Promise<DeviceVerification | null> {
    try {
      const verificationCode = EncryptionUtils.generateVerificationCode();

      const { data, error } = await supabaseAdmin
        .from('device_verifications')
        .insert({
          id: uuidv4(),
          user_id: userId,
          device_id: deviceId,
          device_name: deviceName,
          verification_code: verificationCode,
          verified: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating device verification:', error);
      return null;
    }
  }

  /**
   * Verify device with code
   */
  static async verifyDevice(userId: string, deviceId: string, code: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('device_verifications')
        .select('*')
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .eq('verification_code', code)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) return false;

      // Update as verified
      await supabaseAdmin
        .from('device_verifications')
        .update({ verified: true })
        .eq('id', data.id);

      return true;
    } catch (error) {
      logger.error('Error verifying device:', error);
      return false;
    }
  }

  /**
   * Check if device is verified
   */
  static async isDeviceVerified(userId: string, deviceId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('device_verifications')
        .select('verified')
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .eq('verified', true)
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's verified devices
   */
  static async getVerifiedDevices(userId: string): Promise<DeviceVerification[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('device_verifications')
        .select('*')
        .eq('user_id', userId)
        .eq('verified', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting verified devices:', error);
      return [];
    }
  }

  /**
   * Remove device
   */
  static async removeDevice(userId: string, deviceId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('device_verifications')
        .delete()
        .eq('user_id', userId)
        .eq('device_id', deviceId);

      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Error removing device:', error);
      return false;
    }
  }

  /**
   * Generate QR code data for device verification
   */
  static async generateQRData(userId: string, deviceId: string): Promise<string | null> {
    try {
      const verification = await this.createVerification(userId, deviceId, 'QR Scan Device');
      if (!verification) return null;

      // QR code contains userId:deviceId:code
      return `${userId}:${deviceId}:${verification.verification_code}`;
    } catch (error) {
      logger.error('Error generating QR data:', error);
      return null;
    }
  }

  /**
   * Verify device via QR scan
   */
  static async verifyViaQR(qrData: string): Promise<boolean> {
    try {
      const [userId, deviceId, code] = qrData.split(':');
      return await this.verifyDevice(userId, deviceId, code);
    } catch (error) {
      logger.error('Error verifying via QR:', error);
      return false;
    }
  }
}
