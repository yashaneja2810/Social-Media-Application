import crypto from 'crypto';

/**
 * Utility functions for encryption operations
 * Note: Actual encryption happens client-side
 * Backend only handles encrypted blobs
 */

export class EncryptionUtils {
  /**
   * Generate a random encryption key ID for tracking
   */
  static generateKeyId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Verify encrypted data integrity (simplified HMAC check)
   */
  static verifyIntegrity(data: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    const calculatedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    );
  }

  /**
   * Generate a secure random token
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash data for storage (e.g., backup keys)
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a device verification code
   */
  static generateVerificationCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }
}
