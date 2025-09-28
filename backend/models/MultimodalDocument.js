import mongoose from 'mongoose';

const crossModalLinkSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['temporal', 'spatial', 'semantic', 'reference'],
    required: true
  },
  sourceModality: {
    type: String,
    enum: ['text', 'image', 'audio'],
    required: true
  },
  targetModality: {
    type: String,
    enum: ['text', 'image', 'audio'],
    required: true
  },
  startTime: Number, // For audio links
  endTime: Number,   // For audio links
  coordinates: {     // For image links
    x: Number,
    y: Number,
    width: Number,
    height: Number
  },
  description: String,
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 1
  }
});

const multimodalChunkSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  embedding: [Number],
  modality: {
    type: String,
    enum: ['text', 'image', 'audio'],
    required: true
  },
  metadata: {
    chunkIndex: Number,
    type: {
      type: String,
      enum: ['content', 'visual_description', 'ocr_text', 'full_transcript', 'transcript_segment']
    },
    
    // Text-specific metadata
    pageNumber: Number,
    wordCount: Number,
    charCount: Number,
    language: String,
    
    // Image-specific metadata
    width: Number,
    height: Number,
    format: String,
    colorSpace: String,
    hasAlpha: Boolean,
    
    // Audio-specific metadata
    startTime: Number,
    endTime: Number,
    duration: Number,
    segmentId: String,
    speaker: String,
    
    // Cross-modal links
    crossModalLinks: [crossModalLinkSchema],
    
    // Processing metadata
    vectorDatabase: {
      type: String,
      default: 'qdrant'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    }
  }
}, {
  timestamps: true
});

const multimodalDocumentSchema = new mongoose.Schema({
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
  fileType: {
    type: String,
    enum: ['text', 'image', 'audio'],
    required: true
  },
  
  // Content storage
  content: String, // Primary text content
  description: String, // For images
  transcript: String, // For audio
  
  // Multimodal chunks
  chunks: [multimodalChunkSchema],
  
  // Processing status
  processingStatus: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'failed'],
    default: 'uploading'
  },
  processingProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Enhanced metadata
  metadata: {
    // File metadata
    pages: Number,
    wordCount: Number,
    duration: Number, // For audio files
    
    // Processing metadata
    fileType: String,
    modalities: [String], // List of modalities present
    extractionMethod: String,
    chunkingStrategy: String,
    totalChunks: Number,
    
    // Image metadata
    width: Number,
    height: Number,
    format: String,
    colorSpace: String,
    channels: Number,
    
    // Audio metadata
    bitrate: Number,
    sampleRate: Number,
    audioChannels: Number,
    segmentCount: Number,
    
    // Language and content analysis
    language: String,
    detectedLanguages: [String],
    contentTypes: [String], // e.g., ['report', 'screenshot', 'meeting']
    
    // Cross-modal analysis
    hasOCR: Boolean,
    hasTranscript: Boolean,
    crossModalConnections: Number,
    
    // Quality metrics
    ocrConfidence: Number,
    transcriptionConfidence: Number,
    imageQuality: String, // 'high', 'medium', 'low'
    audioQuality: String
  },
  
  // Vector database information
  qdrantCollection: {
    type: String,
    default: function() {
      return process.env.QDRANT_COLLECTION_NAME || 'multimodal_documents';
    }
  },
  
  // Search and retrieval optimization
  searchKeywords: [String],
  semanticTags: [String],
  contentSummary: String
}, {
  timestamps: true
});

// Indexes for efficient querying
multimodalDocumentSchema.index({ userId: 1, createdAt: -1 });
multimodalDocumentSchema.index({ processingStatus: 1 });
multimodalDocumentSchema.index({ fileType: 1 });
multimodalDocumentSchema.index({ 'metadata.modalities': 1 });
multimodalDocumentSchema.index({ searchKeywords: 1 });
multimodalDocumentSchema.index({ semanticTags: 1 });
multimodalDocumentSchema.index({ qdrantCollection: 1 });

// Text search index
multimodalDocumentSchema.index({
  originalName: 'text',
  content: 'text',
  description: 'text',
  transcript: 'text',
  contentSummary: 'text'
});

// Virtual for getting modality-specific content
multimodalDocumentSchema.virtual('textContent').get(function() {
  return this.content || '';
});

multimodalDocumentSchema.virtual('imageContent').get(function() {
  return this.description || '';
});

multimodalDocumentSchema.virtual('audioContent').get(function() {
  return this.transcript || '';
});

// Method to get chunks by modality
multimodalDocumentSchema.methods.getChunksByModality = function(modality) {
  return this.chunks.filter(chunk => chunk.modality === modality);
};

// Method to get cross-modal links
multimodalDocumentSchema.methods.getCrossModalLinks = function() {
  const links = [];
  this.chunks.forEach(chunk => {
    if (chunk.metadata.crossModalLinks) {
      links.push(...chunk.metadata.crossModalLinks);
    }
  });
  return links;
};

// Method to generate content summary
multimodalDocumentSchema.methods.generateSummary = function() {
  const summaryParts = [];
  
  if (this.content) {
    summaryParts.push(`Text: ${this.content.slice(0, 200)}...`);
  }
  
  if (this.description) {
    summaryParts.push(`Image: ${this.description.slice(0, 200)}...`);
  }
  
  if (this.transcript) {
    summaryParts.push(`Audio: ${this.transcript.slice(0, 200)}...`);
  }
  
  return summaryParts.join(' | ');
};

// Pre-save middleware to update search optimization fields
multimodalDocumentSchema.pre('save', function(next) {
  // Generate search keywords
  const keywords = new Set();
  
  // Add filename words
  this.originalName.split(/\W+/).forEach(word => {
    if (word.length > 2) keywords.add(word.toLowerCase());
  });
  
  // Add content words
  [this.content, this.description, this.transcript].forEach(text => {
    if (text) {
      text.split(/\W+/).forEach(word => {
        if (word.length > 3) keywords.add(word.toLowerCase());
      });
    }
  });
  
  this.searchKeywords = Array.from(keywords).slice(0, 50);
  
  // Generate content summary if not exists
  if (!this.contentSummary) {
    this.contentSummary = this.generateSummary();
  }
  
  next();
});

export default mongoose.model('MultimodalDocument', multimodalDocumentSchema);