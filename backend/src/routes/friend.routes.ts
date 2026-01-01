import { Router, Response } from 'express';
import { AuthRequest, verifySupabaseToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { FriendModel } from '../models/friend.model';
import Joi from 'joi';
import { io } from '../server';
import { SocketEvents } from '../types';

const router = Router();

// Validation schemas
const friendRequestSchema = Joi.object({
  friend_id: Joi.string().uuid().required(),
});

// Get friend list
router.get('/', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friends = await FriendModel.getFriends(userId);
    res.json({ friends });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

// Get pending friend requests
router.get('/requests', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const requests = await FriendModel.getPendingRequests(userId);
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get friend requests' });
  }
});

// Send friend request
router.post('/request', verifySupabaseToken, validate(friendRequestSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { friend_id } = req.body;

    if (userId === friend_id) {
      res.status(400).json({ error: 'Cannot send friend request to yourself' });
      return;
    }

    const request = await FriendModel.sendRequest(userId, friend_id);

    if (!request) {
      res.status(400).json({ error: 'Failed to send friend request' });
      return;
    }

    // Notify via socket
    io.to(`user:${friend_id}`).emit(SocketEvents.FRIEND_REQUEST, {
      from: userId,
      request,
    });

    res.json({ request });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Accept friend request
router.post('/accept/:friendId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendId = req.params.friendId;

    const success = await FriendModel.acceptRequest(userId, friendId);

    if (!success) {
      res.status(400).json({ error: 'Failed to accept friend request' });
      return;
    }

    // Notify via socket
    io.to(`user:${friendId}`).emit(SocketEvents.FRIEND_ACCEPT, {
      from: userId,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// Reject friend request
router.post('/reject/:friendId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendId = req.params.friendId;

    const success = await FriendModel.rejectRequest(userId, friendId);

    if (!success) {
      res.status(400).json({ error: 'Failed to reject friend request' });
      return;
    }

    // Notify via socket
    io.to(`user:${friendId}`).emit(SocketEvents.FRIEND_REJECT, {
      from: userId,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
});

// Block user
router.post('/block/:friendId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendId = req.params.friendId;

    const success = await FriendModel.blockUser(userId, friendId);

    if (!success) {
      res.status(400).json({ error: 'Failed to block user' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock user
router.post('/unblock/:friendId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friendId = req.params.friendId;

    const success = await FriendModel.unblockUser(userId, friendId);

    if (!success) {
      res.status(400).json({ error: 'Failed to unblock user' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

export default router;
