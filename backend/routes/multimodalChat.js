import express from 'express';
import { body, validationResult } from 'express-validator';
import Chat from '../models/Chat.js';
import MultimodalDocument from '../models/MultimodalDocument.js';
import { multimodalRAGService } from '../services/multimodalRAGService.js';

const router = express.Router();

// Create new multimodal chat or get existing one
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
    const document = await MultimodalDocument.findOne({
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
        title: `Multimodal Chat: ${document.originalName}`,
        messages: []
      });
      await chat.save();
    }

    res.json({
      ...chat.toObject(),
      documentInfo: {
        name: document.originalName,
        fileType: document.fileType,
        modalities: document.metadata?.modalities || [],
        hasOCR: document.metadata?.hasOCR || false,
        hasTranscript: document.metadata?.hasTranscript || false
      }
    });
  } catch (error) {
    console.error('Start multimodal chat error:', error);
    res.status(500).json({ error: 'Failed to start chat' });
  }
});

// Send message with multimodal RAG
router.post('/:chatId/message', [
  body('message').isLength({ min: 1, max: 2000 }).trim(),
  body('options').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { chatId } = req.params;
    const { message, options = {} } = req.body;

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

    const maxMessages = req.user.plan === 'premium' ? 2000 : 100;
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
      // Generate multimodal AI response
      const response = await multimodalRAGService.generateMultimodalResponse(
        message, 
        chat.documentId, 
        chat.messages, 
        options
      );
      
      // Add AI response with enhanced metadata
      chat.messages.push({
        role: 'assistant',
        content: response.content,
        metadata: {
          ...response.metadata,
          vectorDatabase: 'qdrant',
          multimodal: true
        }
      });

      await chat.save();

      // Update user usage
      req.user.usage.messagesThisMonth += 1;
      await req.user.save();

      res.json({
        message: response.content,
        metadata: {
          ...response.metadata,
          vectorDatabase: 'qdrant',
          multimodal: true,
          supportedModalities: chat.documentId.metadata?.modalities || []
        }
      });
    } catch (aiError) {
      console.error('Multimodal AI response error:', aiError);
      res.status(500).json({ error: 'Failed to generate response' });
    }
  } catch (error) {
    console.error('Send multimodal message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Advanced multimodal search within chat context
router.post('/:chatId/search', [
  body('query').isLength({ min: 1 }).trim(),
  body('modalities').optional().isArray(),
  body('options').optional().isObject()
], async (req, res) => {
  try {
    const { chatId } = req.params;
    const { query, modalities = ['text', 'image', 'audio'], options = {} } = req.body;

    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id
    }).populate('documentId');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const searchResults = await multimodalRAGService.searchAcrossModalities(
      query,
      chat.documentId._id,
      {
        limit: options.limit || 15,
        threshold: options.threshold || 0.1,
        modalities
      }
    );

    res.json({
      query,
      results: searchResults,
      modalities,
      documentInfo: {
        name: chat.documentId.originalName,
        fileType: chat.documentId.fileType,
        availableModalities: chat.documentId.metadata?.modalities || []
      },
      vectorDatabase: 'qdrant'
    });
  } catch (error) {
    console.error('Multimodal search error:', error);
    res.status(500).json({ error: 'Failed to search document' });
  }
});

// Get chat with multimodal context
router.get('/:chatId', async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      userId: req.user._id
    }).populate({
      path: 'documentId',
      select: 'originalName fileType metadata processingStatus'
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({
      ...chat.toObject(),
      multimodalInfo: {
        fileType: chat.documentId.fileType,
        modalities: chat.documentId.metadata?.modalities || [],
        hasOCR: chat.documentId.metadata?.hasOCR || false,
        hasTranscript: chat.documentId.metadata?.hasTranscript || false,
        crossModalConnections: chat.documentId.metadata?.crossModalConnections || 0
      }
    });
  } catch (error) {
    console.error('Get multimodal chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Generate follow-up questions with multimodal context
router.post('/:chatId/follow-up', [
  body('lastMessage').isLength({ min: 1 }).trim(),
  body('modalities').optional().isArray()
], async (req, res) => {
  try {
    const { chatId } = req.params;
    const { lastMessage, modalities = ['text', 'image', 'audio'] } = req.body;

    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id
    }).populate('documentId');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Generate multimodal follow-up questions
    const followUpQuestions = await generateMultimodalFollowUp(
      lastMessage,
      chat.messages[chat.messages.length - 1]?.content || '',
      chat.documentId,
      modalities
    );

    res.json({ 
      followUpQuestions,
      modalities,
      documentType: chat.documentId.fileType,
      vectorDatabase: 'qdrant'
    });
  } catch (error) {
    console.error('Multimodal follow-up questions error:', error);
    res.status(500).json({ error: 'Failed to generate follow-up questions' });
  }
});

// Get document citations and sources
router.get('/:chatId/citations', async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      userId: req.user._id
    }).populate('documentId');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Extract citations from all assistant messages
    const citations = [];
    let citationId = 1;

    chat.messages.forEach((message, messageIndex) => {
      if (message.role === 'assistant' && message.metadata?.citations) {
        message.metadata.citations.forEach(citation => {
          citations.push({
            id: citationId++,
            messageIndex,
            ...citation,
            documentName: chat.documentId.originalName,
            documentType: chat.documentId.fileType
          });
        });
      }
    });

    res.json({
      chatId: chat._id,
      documentName: chat.documentId.originalName,
      totalCitations: citations.length,
      citations,
      modalityCounts: getCitationModalityCounts(citations)
    });
  } catch (error) {
    console.error('Get citations error:', error);
    res.status(500).json({ error: 'Failed to fetch citations' });
  }
});

// Utility function to generate multimodal follow-up questions
async function generateMultimodalFollowUp(query, response, document, modalities) {
  try {
    const prompt = `
Based on this multimodal conversation about "${document.originalName}" (${document.fileType}), generate 3 relevant follow-up questions:

Available modalities: ${modalities.join(', ')}
Document has: ${document.metadata?.modalities?.join(', ') || 'text'}

User Question: ${query}
AI Response: ${response}

Generate follow-up questions that:
1. Explore different modalities (text, image, audio content)
2. Ask for specific details or clarification
3. Connect information across different content types
4. Reference specific timestamps (for audio) or visual elements (for images)

Format as a JSON array of strings.`;

    const result = await multimodalRAGService.ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    try {
      const questions = JSON.parse(result.text);
      return Array.isArray(questions) ? questions.slice(0, 3) : [];
    } catch (parseError) {
      // Fallback: extract questions from text
      const lines = result.text.split('\n');
      const questions = lines
        .filter(line => line.includes('?'))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 3);
      return questions;
    }
  } catch (error) {
    console.error('Multimodal follow-up generation error:', error);
    return [
      "Can you show me more details about the visual content?",
      "What does the audio transcript reveal about this topic?",
      "How do the different content types relate to each other?"
    ];
  }
}

// Utility function to count citations by modality
function getCitationModalityCounts(citations) {
  const counts = { text: 0, image: 0, audio: 0 };
  citations.forEach(citation => {
    if (counts.hasOwnProperty(citation.modality)) {
      counts[citation.modality]++;
    }
  });
  return counts;
}

export default router;