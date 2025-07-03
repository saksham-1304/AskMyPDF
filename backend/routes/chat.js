import express from 'express';
import { body, validationResult } from 'express-validator';
import Chat from '../models/Chat.js';
import Document from '../models/Document.js';
import { generateResponse } from '../services/chatService.js';

const router = express.Router();

// Create new chat or get existing one
router.post('/start', [
  body('documentId').isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { documentId } = req.body;

    // Verify document exists and belongs to user
    const document = await Document.findOne({
      _id: documentId,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.processingStatus !== 'completed') {
      return res.status(400).json({ error: 'Document is still processing' });
    }

    // Find existing chat or create new one
    let chat = await Chat.findOne({
      userId: req.user._id,
      documentId: documentId,
      isActive: true
    });

    if (!chat) {
      chat = new Chat({
        userId: req.user._id,
        documentId: documentId,
        title: `Chat with ${document.originalName}`,
        messages: []
      });
      await chat.save();
    }

    res.json(chat);
  } catch (error) {
    console.error('Start chat error:', error);
    res.status(500).json({ error: 'Failed to start chat' });
  }
});

// Send message
router.post('/:chatId/message', [
  body('message').isLength({ min: 1, max: 1000 }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { chatId } = req.params;
    const { message } = req.body;

    // Find chat
    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id
    }).populate('documentId');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Check user's message limit
    const currentMonth = new Date().getMonth();
    const userUsage = req.user.usage;
    
    if (userUsage.lastResetDate.getMonth() !== currentMonth) {
      req.user.usage.messagesThisMonth = 0;
      req.user.usage.lastResetDate = new Date();
      await req.user.save();
    }

    const maxMessages = req.user.plan === 'premium' ? 1000 : 50;
    if (userUsage.messagesThisMonth >= maxMessages) {
      return res.status(400).json({ 
        error: `Message limit reached. ${req.user.plan === 'free' ? 'Upgrade to premium for more messages.' : ''}` 
      });
    }

    // Add user message
    chat.messages.push({
      role: 'user',
      content: message
    });

    try {
      // Generate AI response
      const response = await generateResponse(message, chat.documentId, chat.messages);
      
      // Add AI response
      chat.messages.push({
        role: 'assistant',
        content: response.content,
        metadata: response.metadata
      });

      await chat.save();

      // Update user usage
      req.user.usage.messagesThisMonth += 1;
      await req.user.save();

      res.json({
        message: response.content,
        metadata: response.metadata
      });
    } catch (aiError) {
      console.error('AI response error:', aiError);
      res.status(500).json({ error: 'Failed to generate response' });
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get chat history
router.get('/:chatId', async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      userId: req.user._id
    }).populate('documentId', 'originalName');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Get user's chats
router.get('/user/chats', async (req, res) => {
  try {
    const chats = await Chat.find({
      userId: req.user._id,
      isActive: true
    })
    .populate('documentId', 'originalName')
    .sort({ updatedAt: -1 })
    .limit(20);

    res.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Delete chat
router.delete('/:chatId', async (req, res) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.chatId, userId: req.user._id },
      { isActive: false },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;