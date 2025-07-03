import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: function() {
      return this.processingStatus === 'completed';
    }
  },
  chunks: [{
    text: String,
    embedding: [Number],
    metadata: {
      pageNumber: Number,
      chunkIndex: Number,
      strategy: String,
      topic: String,
      wordCount: Number,
      charCount: Number,
      language: String,
      vectorDatabase: {
        type: String,
        default: 'qdrant'
      }
    }
  }],
  processingStatus: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed'],
    default: 'uploading'
  },
  processingProgress: {
    type: Number,
    default: 0
  },
  metadata: {
    pages: Number,
    wordCount: Number,
    language: String,
    chunkingStrategy: String,
    extractionMethod: String,
    vectorDatabase: {
      type: String,
      default: 'qdrant'
    }
  },
  // Changed from pineconeNamespace to qdrantCollection
  qdrantCollection: {
    type: String,
    default: function() {
      return process.env.QDRANT_COLLECTION_NAME || 'pdf_documents';
    }
  }
}, {
  timestamps: true
});

// Index for efficient querying
documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ processingStatus: 1 });
documentSchema.index({ qdrantCollection: 1 });

export default mongoose.model('Document', documentSchema);