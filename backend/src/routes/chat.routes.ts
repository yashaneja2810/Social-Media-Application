import { Router, Response } from 'express';
import { AuthRequest, verifySupabaseToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { ChatModel } from '../models/chat.model';
import { KeysModel } from '../models/keys.model';
import { UserModel } from '../models/user.model';
import { MessageModel } from '../models/message.model';
import Joi from 'joi';

const router = Router();

// Validation schemas
const createChatSchema = Joi.object({
  type: Joi.string().valid('direct', 'group').required(),
  participant_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

const shareChatKeySchema = Joi.object({
  recipient_id: Joi.string().uuid().required(),
  encrypted_chat_key: Joi.string().required(),
});

// Get all user chats
router.get('/', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const chats = await ChatModel.getUserChats(userId);
    res.json({ chats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

// Get specific chat
router.get('/:chatId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const chatId = req.params.chatId;

    const chat = await ChatModel.getChatById(chatId);

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    // Verify user is in chat
    if (!chat.participants.includes(userId)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    res.json({ chat });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

// Create new chat
router.post('/', verifySupabaseToken, validate(createChatSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, participant_ids } = req.body;

    // Add creator to participants if not already included
    const participants = [...new Set([userId, ...participant_ids])];

    const chat = await ChatModel.createChat(type, userId, participants);

    if (!chat) {
      res.status(400).json({ error: 'Failed to create chat' });
      return;
    }

    res.json({ chat });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Get or create direct chat with a user
router.post('/direct/:userId', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    const otherUserId = req.params.userId;

    if (currentUserId === otherUserId) {
      res.status(400).json({ error: 'Cannot create chat with yourself' });
      return;
    }

    // Ensure both users have profiles
    let currentUserProfile = await UserModel.getProfile(currentUserId);
    if (!currentUserProfile) {
      // Create profile if it doesn't exist
      currentUserProfile = await UserModel.upsertProfile(currentUserId, req.user!.email);
      if (!currentUserProfile) {
        res.status(500).json({ error: 'Failed to create your user profile' });
        return;
      }
    }

    const otherUserProfile = await UserModel.getProfile(otherUserId);
    if (!otherUserProfile) {
      res.status(404).json({ error: 'Recipient user not found' });
      return;
    }

    // Try to get existing direct chat
    let chat = await ChatModel.getDirectChat(currentUserId, otherUserId);

    // Create if doesn't exist
    if (!chat) {
      chat = await ChatModel.createChat('direct', currentUserId, [currentUserId, otherUserId]);
    }

    if (!chat) {
      res.status(400).json({ error: 'Failed to create chat' });
      return;
    }

    res.json({ chat });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get or create chat' });
  }
});

// Share encrypted chat key with a participant
router.post('/:chatId/share-key', verifySupabaseToken, validate(shareChatKeySchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { chatId } = req.params;
    const { recipient_id, encrypted_chat_key } = req.body;

    // Verify chat exists and user is in it
    const chat = await ChatModel.getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    if (!chat.participants.includes(userId)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    // Verify recipient is in the chat
    if (!chat.participants.includes(recipient_id)) {
      res.status(400).json({ error: 'Recipient is not in this chat' });
      return;
    }

    // Store encrypted chat key
    const result = await KeysModel.shareChatKey(chatId, userId, recipient_id, encrypted_chat_key);

    if (!result) {
      res.status(500).json({ error: 'Failed to share chat key' });
      return;
    }

    res.json({ success: true, message: 'Chat key shared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to share chat key' });
  }
});

// Get encrypted chat key for current user
router.get('/:chatId/my-key', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { chatId } = req.params;

    // Verify user is in chat
    const chat = await ChatModel.getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    if (!chat.participants.includes(userId)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    // Get encrypted chat key
    const encryptedKey = await KeysModel.getChatKey(chatId, userId);

    if (!encryptedKey) {
      res.status(404).json({ error: 'Chat key not found' });
      return;
    }

    res.json({ encrypted_chat_key: encryptedKey });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat key' });
  }
});

// Get all chat keys for a chat (for history decryption)
router.get('/:chatId/keys', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { chatId } = req.params;

    // Verify user is in chat
    const chat = await ChatModel.getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    if (!chat.participants.includes(userId)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    // Get all chat keys for this chat
    const chatKeys = await KeysModel.getAllChatKeys(chatId);

    res.json({ chat_keys: chatKeys });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat keys' });
  }
});

// Get chat messages (history)
router.get('/:chatId/messages', verifySupabaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string;

    // Verify user is in chat
    const chat = await ChatModel.getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    if (!chat.participants.includes(userId)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    // Get messages
    const messages = await MessageModel.getMessages(chatId, limit, before);

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;
