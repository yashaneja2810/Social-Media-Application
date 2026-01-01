import { Router, Response } from 'express';
import { AuthRequest, verifySupabaseToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { GroupModel } from '../models/group.model';
import { ChatModel } from '../models/chat.model';
import Joi from 'joi';
import { io } from '../server';
import { SocketEvents } from '../types';

const router = Router();

// Validation schemas
const createGroupSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  avatar_url: Joi.string().uri().optional(),
  member_ids: Joi.array().items(Joi.string().uuid()).optional(),
});

const updateGroupSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional(),
  avatar_url: Joi.string().uri().optional(),
});

const updateSettingsSchema = Joi.object({
  only_admins_can_message: Joi.boolean().optional(),
  only_admins_can_add_members: Joi.boolean().optional(),
  invite_link_enabled: Joi.boolean().optional(),
});

// Get user's groups
router.get('/', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groups = await GroupModel.getUserGroups(userId);
    res.json({ groups });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

// Get group by ID
router.get('/:groupId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groupId = req.params.groupId;

    const group = await GroupModel.getGroupById(groupId);

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    if (!group.member_ids.includes(userId)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    res.json({ group });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get group' });
  }
});

// Create group
router.post('/', verifySupabaseToken, validate(createGroupSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, avatar_url, member_ids = [] } = req.body;

    const group = await GroupModel.createGroup(
      name,
      userId,
      member_ids,
      description,
      avatar_url
    );

    if (!group) {
      res.status(400).json({ error: 'Failed to create group' });
      return;
    }

    // Create associated chat
    await ChatModel.createChat('group', userId, group.member_ids);

    // Notify members
    group.member_ids.forEach(memberId => {
      io.to(`user:${memberId}`).emit(SocketEvents.GROUP_CREATED, { group });
    });

    res.json({ group });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Update group info
router.patch('/:groupId', verifySupabaseToken, validate(updateGroupSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groupId = req.params.groupId;

    const success = await GroupModel.updateGroupInfo(groupId, userId, req.body);

    if (!success) {
      res.status(400).json({ error: 'Failed to update group' });
      return;
    }

    const group = await GroupModel.getGroupById(groupId);

    // Notify members
    group?.member_ids.forEach(memberId => {
      io.to(`user:${memberId}`).emit(SocketEvents.GROUP_UPDATED, { group });
    });

    res.json({ success: true, group });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Add member to group
router.post('/:groupId/members/:userId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const groupId = req.params.groupId;
    const userIdToAdd = req.params.userId;

    const success = await GroupModel.addMember(groupId, userIdToAdd, currentUserId);

    if (!success) {
      res.status(400).json({ error: 'Failed to add member' });
      return;
    }

    // Add to chat as well
    const chats = await ChatModel.getUserChats(currentUserId);
    const groupChat = chats.find(c => c.type === 'group');
    if (groupChat) {
      await ChatModel.addParticipant(groupChat.id, userIdToAdd);
    }

    const group = await GroupModel.getGroupById(groupId);

    // Notify all members
    group?.member_ids.forEach(memberId => {
      io.to(`user:${memberId}`).emit(SocketEvents.GROUP_MEMBER_ADDED, {
        groupId,
        userId: userIdToAdd,
      });
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Remove member from group
router.delete('/:groupId/members/:userId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const groupId = req.params.groupId;
    const userIdToRemove = req.params.userId;

    const success = await GroupModel.removeMember(groupId, userIdToRemove, currentUserId);

    if (!success) {
      res.status(400).json({ error: 'Failed to remove member' });
      return;
    }

    const group = await GroupModel.getGroupById(groupId);

    // Notify all members
    group?.member_ids.forEach(memberId => {
      io.to(`user:${memberId}`).emit(SocketEvents.GROUP_MEMBER_REMOVED, {
        groupId,
        userId: userIdToRemove,
      });
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Promote member to admin
router.post('/:groupId/admins/:userId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const groupId = req.params.groupId;
    const userIdToPromote = req.params.userId;

    const success = await GroupModel.promoteToAdmin(groupId, userIdToPromote, currentUserId);

    if (!success) {
      res.status(400).json({ error: 'Failed to promote member' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to promote member' });
  }
});

// Update group settings
router.patch('/:groupId/settings', verifySupabaseToken, validate(updateSettingsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groupId = req.params.groupId;

    const success = await GroupModel.updateSettings(groupId, req.body, userId);

    if (!success) {
      res.status(400).json({ error: 'Failed to update settings' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Generate invite link
router.post('/:groupId/invite-link', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groupId = req.params.groupId;

    const inviteLink = await GroupModel.generateInviteLink(groupId, userId);

    if (!inviteLink) {
      res.status(400).json({ error: 'Failed to generate invite link' });
      return;
    }

    res.json({ invite_link: inviteLink });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate invite link' });
  }
});

// Join group via invite link
router.post('/join/:inviteLink', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const inviteLink = req.params.inviteLink;

    const success = await GroupModel.joinViaInviteLink(inviteLink, userId);

    if (!success) {
      res.status(400).json({ error: 'Failed to join group' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join group' });
  }
});

export default router;
