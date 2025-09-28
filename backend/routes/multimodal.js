import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import MultimodalDocument from '../models/MultimodalDocument.js';
import { multimodalProcessor } from '../services/multimodalProcessor.js';
import { multimodalRAGService } from '../services/multimodalRAGService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for multimodal file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/multimodal');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      // Text documents
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
      // Audio
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/ogg',
      'audio/flac'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB limit for multimodal files
  }
});

// Upload multimodal document
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check user's document limit
    const userDocumentCount = await MultimodalDocument.countDocuments({ userId: req.user._id });
    const maxDocuments = req.user.plan === 'premium' ? 100 : 10;
    
    if (userDocumentCount >= maxDocuments) {
      await fs.remove(req.file.path);
      return res.status(400).json({ 
        error: `Document limit reached. ${req.user.plan === 'free' ? 'Upgrade to premium for more documents.' : ''}` 
      });
    }

    // Determine file type
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const fileType = getFileType(fileExtension);

    // Create document record
    const document = new MultimodalDocument({
      userId: req.user._id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      fileType: fileType,
      processingStatus: 'uploading',
      metadata: {
        fileType: fileType,
        extractionMethod: 'multimodal',
        modalities: []
      }
    });

    await document.save();

    // Process document asynchronously
    multimodalProcessor.processMultimodalDocument(document._id, req.file.path, req.file.originalname)
      .then(() => {
        console.log(`Multimodal document processing completed for ${document._id}`);
      })
      .catch(error => {
        console.error(`Multimodal document processing failed for ${document._id}:`, error);
      });

    res.json({
      id: document._id,
      filename: document.originalName,
      size: document.size,
      fileType: document.fileType,
      status: document.processingStatus,
      supportedModalities: getSupportedModalities(fileType)
    });
  } catch (error) {
    if (req.file) {
      await fs.remove(req.file.path);
    }
    console.error('Multimodal upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get user's multimodal documents
router.get('/documents', async (req, res) => {
  try {
    const { fileType, modality, search } = req.query;
    
    let query = { userId: req.user._id };
    
    // Filter by file type
    if (fileType && ['text', 'image', 'audio'].includes(fileType)) {
      query.fileType = fileType;
    }
    
    // Filter by modality
    if (modality && ['text', 'image', 'audio'].includes(modality)) {
      query['metadata.modalities'] = modality;
    }
    
    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    const documents = await MultimodalDocument.find(query)
      .select('-chunks -content -description -transcript')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(documents);
  } catch (error) {
    console.error('Get multimodal documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get document details
router.get('/documents/:id', async (req, res) => {
  try {
    const document = await MultimodalDocument.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).select('-chunks');

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Get multimodal document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Get document processing status
router.get('/documents/:id/status', async (req, res) => {
  try {
    const document = await MultimodalDocument.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).select('processingStatus processingProgress metadata fileType');

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      status: document.processingStatus,
      progress: document.processingProgress,
      fileType: document.fileType,
      modalities: document.metadata?.modalities || [],
      extractionMethod: document.metadata?.extractionMethod
    });
  } catch (error) {
    console.error('Get multimodal status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Cross-modal search endpoint
router.post('/search', async (req, res) => {
  try {
    const { query, documentId, modalities, limit = 10, threshold = 0.1 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    let searchResults;

    if (documentId) {
      // Search within specific document
      const document = await MultimodalDocument.findOne({
        _id: documentId,
        userId: req.user._id
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      searchResults = await multimodalRAGService.searchAcrossModalities(
        query,
        documentId,
        { limit, threshold, modalities }
      );
    } else {
      // Search across all user documents
      const userDocuments = await MultimodalDocument.find({
        userId: req.user._id,
        processingStatus: 'completed'
      }).select('_id');

      const allResults = [];
      for (const doc of userDocuments.slice(0, 10)) { // Limit to 10 docs for performance
        const docResults = await multimodalRAGService.searchAcrossModalities(
          query,
          doc._id,
          { limit: Math.ceil(limit / 2), threshold, modalities }
        );
        allResults.push(...docResults.map(result => ({ ...result, documentId: doc._id })));
      }

      searchResults = allResults
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    res.json({
      query,
      results: searchResults,
      totalResults: searchResults.length,
      modalities: modalities || ['text', 'image', 'audio']
    });
  } catch (error) {
    console.error('Cross-modal search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get document analytics
router.get('/documents/:id/analytics', async (req, res) => {
  try {
    const document = await MultimodalDocument.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const analytics = {
      // Basic info
      fileType: document.fileType,
      modalities: document.metadata?.modalities || [],
      totalChunks: document.chunks?.length || 0,
      
      // Content analysis
      wordCount: document.metadata?.wordCount || 0,
      duration: document.metadata?.duration || null,
      pages: document.metadata?.pages || null,
      
      // Quality metrics
      ocrConfidence: document.metadata?.ocrConfidence || null,
      transcriptionConfidence: document.metadata?.transcriptionConfidence || null,
      imageQuality: document.metadata?.imageQuality || null,
      audioQuality: document.metadata?.audioQuality || null,
      
      // Cross-modal connections
      crossModalConnections: document.metadata?.crossModalConnections || 0,
      hasOCR: document.metadata?.hasOCR || false,
      hasTranscript: document.metadata?.hasTranscript || false,
      
      // Processing info
      processingTime: document.metadata?.processingTime || null,
      extractionMethod: document.metadata?.extractionMethod,
      vectorDatabase: 'qdrant',
      
      // Chunk distribution by modality
      chunksByModality: getChunkDistribution(document.chunks || [])
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get multimodal analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Delete multimodal document
router.delete('/documents/:id', async (req, res) => {
  try {
    const document = await MultimodalDocument.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from Qdrant if it exists
    if (document.qdrantCollection) {
      try {
        const { deleteQdrantVectors } = await import('../services/qdrantService.js');
        await deleteQdrantVectors(document.qdrantCollection, document._id);
      } catch (error) {
        console.error('Failed to delete from Qdrant:', error);
      }
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete multimodal document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Get cross-modal links for a document
router.get('/documents/:id/links', async (req, res) => {
  try {
    const document = await MultimodalDocument.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const crossModalLinks = document.getCrossModalLinks();
    
    res.json({
      documentId: document._id,
      totalLinks: crossModalLinks.length,
      links: crossModalLinks,
      linkTypes: [...new Set(crossModalLinks.map(link => link.type))],
      modalityPairs: [...new Set(crossModalLinks.map(link => `${link.sourceModality}-${link.targetModality}`))]
    });
  } catch (error) {
    console.error('Get cross-modal links error:', error);
    res.status(500).json({ error: 'Failed to fetch cross-modal links' });
  }
});

// Utility functions
function getFileType(extension) {
  const textExtensions = ['.pdf', '.docx', '.doc', '.txt'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac'];
  
  if (textExtensions.includes(extension)) return 'text';
  if (imageExtensions.includes(extension)) return 'image';
  if (audioExtensions.includes(extension)) return 'audio';
  return 'unknown';
}

function getSupportedModalities(fileType) {
  switch (fileType) {
    case 'text': return ['text'];
    case 'image': return ['image', 'text']; // OCR
    case 'audio': return ['audio', 'text']; // Transcript
    default: return [];
  }
}

function getChunkDistribution(chunks) {
  const distribution = { text: 0, image: 0, audio: 0 };
  chunks.forEach(chunk => {
    if (distribution.hasOwnProperty(chunk.modality)) {
      distribution[chunk.modality]++;
    }
  });
  return distribution;
}

export default router;