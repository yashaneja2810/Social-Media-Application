import { Router, Response } from 'express';
import { AuthRequest, verifySupabaseToken } from '../middleware/auth';
import { UserModel } from '../models/user.model';
import { KeysModel } from '../models/keys.model';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Supabase handles authentication
 * These routes handle post-auth user profile management
 */

// Get current user profile
router.get('/me', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let profile = await UserModel.getProfile(userId);

    // Create profile if it doesn't exist
    if (!profile) {
      profile = await UserModel.upsertProfile(userId, req.user!.email);
    }

    res.json({ profile });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Verify session (useful for checking if JWT is still valid)
router.get('/verify', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  res.json({
    valid: true,
    user: {
      id: req.user!.id,
      email: req.user!.email,
    },
  });
});

/**
 * Sync endpoint - called on login to clean up stale chat keys
 */
router.post('/sync', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { has_keys } = req.body;

    logger.info(`Auth sync for user ${userId}, has_keys: ${has_keys}`);

    // If user doesn't have keys locally, they regenerated them
    // Delete all old chat keys (they're useless now)
    if (!has_keys) {
      logger.info(`User ${userId} has no local keys, deleting old chat keys...`);
      const deleted = await KeysModel.deleteUserChatKeys(userId);
      logger.info(`Chat keys deletion result for user ${userId}: ${deleted}`);
      
      res.json({ 
        success: true, 
        keys_cleared: true,
        message: 'Old chat keys cleared. You can create new chats.' 
      });
    } else {
      res.json({ 
        success: true, 
        keys_cleared: false,
        message: 'Keys are synced.' 
      });
    }
  } catch (error) {
    logger.error('Error in auth sync:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

export default router;
