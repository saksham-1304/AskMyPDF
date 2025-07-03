import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import Document from '../models/Document.js';
import { processPDF } from '../services/pdfService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
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
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { 
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

// Upload PDF with chunking strategy option
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get chunking strategy from request (default: hybrid)
    const chunkingStrategy = req.body.chunkingStrategy || 'hybrid';
    const validStrategies = ['sentence', 'paragraph', 'semantic', 'hybrid'];
    
    if (!validStrategies.includes(chunkingStrategy)) {
      await fs.remove(req.file.path);
      return res.status(400).json({ 
        error: 'Invalid chunking strategy. Valid options: ' + validStrategies.join(', ')
      });
    }

    // Check user's document limit
    const userDocumentCount = await Document.countDocuments({ userId: req.user._id });
    const maxDocuments = req.user.plan === 'premium' ? 50 : 5;
    
    if (userDocumentCount >= maxDocuments) {
      await fs.remove(req.file.path);
      return res.status(400).json({ 
        error: `Document limit reached. ${req.user.plan === 'free' ? 'Upgrade to premium for more documents.' : ''}` 
      });
    }

    // Create document record
    const document = new Document({
      userId: req.user._id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      content: '', // Will be populated by PDF processing
      processingStatus: 'uploading',
      metadata: {
        chunkingStrategy: chunkingStrategy
      }
    });

    await document.save();

    // Process PDF asynchronously with specified strategy
    processPDF(document._id, req.file.path, chunkingStrategy)
      .then(() => {
        console.log(`PDF processing completed for document ${document._id} using ${chunkingStrategy} strategy`);
      })
      .catch(error => {
        console.error(`PDF processing failed for document ${document._id}:`, error);
      });

    res.json({
      id: document._id,
      filename: document.originalName,
      size: document.size,
      status: document.processingStatus,
      chunkingStrategy: chunkingStrategy
    });
  } catch (error) {
    if (req.file) {
      await fs.remove(req.file.path);
    }
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get user's documents
router.get('/documents', async (req, res) => {
  try {
    const documents = await Document.find({ userId: req.user._id })
      .select('-content -chunks')
      .sort({ createdAt: -1 });

    res.json(documents);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get document details
router.get('/documents/:id', async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).select('-chunks');

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Get document processing status
router.get('/documents/:id/status', async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).select('processingStatus processingProgress metadata');

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      status: document.processingStatus,
      progress: document.processingProgress,
      chunkingStrategy: document.metadata?.chunkingStrategy || 'hybrid'
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Get document analytics
router.get('/documents/:id/analytics', async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const analytics = {
      totalChunks: document.chunks?.length || 0,
      averageChunkSize: document.chunks?.length > 0 
        ? Math.round(document.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / document.chunks.length)
        : 0,
      chunkingStrategy: document.metadata?.chunkingStrategy || 'unknown',
      processingTime: document.metadata?.processingTime || 'N/A',
      language: document.metadata?.language || 'unknown',
      wordCount: document.metadata?.wordCount || 0,
      pages: document.metadata?.pages || 0
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Delete document
router.delete('/documents/:id', async (req, res) => {
  try {
    const document = await Document.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from Pinecone if it exists
    if (document.pineconeNamespace) {
      try {
        const { deletePineconeVectors } = await import('../services/pineconeService.js');
        await deletePineconeVectors(document.pineconeNamespace);
      } catch (error) {
        console.error('Failed to delete from Pinecone:', error);
      }
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;