import pdfParse from 'pdf-parse';
import fs from 'fs-extra';
import Document from '../models/Document.js';
import { generateEmbeddings, storePineconeVectors } from './pineconeService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Advanced Document Processing Service
 * Handles PDF processing with sophisticated chunking strategies
 */
class DocumentProcessor {
  constructor() {
    this.chunkingStrategies = {
      sentence: this.sentenceBasedChunking.bind(this),
      paragraph: this.paragraphBasedChunking.bind(this),
      semantic: this.semanticChunking.bind(this),
      hybrid: this.hybridChunking.bind(this)
    };
  }

  /**
   * Main document processing pipeline
   */
  async processDocument(documentId, filePath, strategy = 'hybrid') {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Update status
      document.processingStatus = 'processing';
      document.processingProgress = 10;
      await document.save();

      // Step 1: Extract text from PDF
      const extractedData = await this.extractPDFContent(filePath);
      
      // Update document with content
      document.content = extractedData.text;
      document.metadata = {
        pages: extractedData.numpages,
        wordCount: extractedData.text.split(/\s+/).length,
        language: this.detectLanguage(extractedData.text),
        extractionMethod: 'pdf-parse'
      };
      document.processingProgress = 30;
      await document.save();

      // Step 2: Advanced text chunking
      const chunks = await this.chunkingStrategies[strategy](
        extractedData.text,
        extractedData.numpages
      );
      
      document.processingProgress = 50;
      await document.save();

      // Step 3: Generate embeddings
      const embeddings = await this.generateChunkEmbeddings(chunks);
      document.processingProgress = 70;
      await document.save();

      // Step 4: Prepare chunks with metadata
      const enrichedChunks = this.enrichChunks(chunks, embeddings, extractedData);
      
      document.chunks = enrichedChunks;
      document.processingProgress = 85;
      await document.save();

      // Step 5: Store in vector database
      const namespace = uuidv4();
      await storePineconeVectors(enrichedChunks, namespace, document._id);
      
      document.pineconeNamespace = namespace;
      document.processingStatus = 'completed';
      document.processingProgress = 100;
      await document.save();

      // Cleanup
      await fs.remove(filePath);

      console.log(`Document processing completed for ${documentId} using ${strategy} strategy`);
      return document;
    } catch (error) {
      console.error(`Document processing failed for ${documentId}:`, error);
      await this.handleProcessingError(documentId, filePath, error);
      throw error;
    }
  }

  /**
   * Extract content from PDF with enhanced metadata
   */
  async extractPDFContent(filePath) {
    try {
      const pdfBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(pdfBuffer, {
        // Enhanced parsing options
        normalizeWhitespace: true,
        disableCombineTextItems: false
      });

      return {
        text: this.cleanExtractedText(pdfData.text),
        numpages: pdfData.numpages,
        info: pdfData.info,
        metadata: pdfData.metadata
      };
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Clean and normalize extracted text
   */
  cleanExtractedText(text) {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page numbers and headers/footers (basic patterns)
      .replace(/^\d+\s*$/gm, '')
      // Remove excessive line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Trim
      .trim();
  }

  /**
   * Sentence-based chunking strategy
   */
  sentenceBasedChunking(text, numPages, maxChunkSize = 1000, overlap = 200) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    let currentPage = 1;
    const sentencesPerPage = Math.ceil(sentences.length / numPages);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim() + '.';
      
      if (currentChunk.length + sentence.length < maxChunkSize) {
        currentChunk += sentence + ' ';
      } else {
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim(),
            pageNumber: currentPage,
            chunkIndex: chunks.length,
            strategy: 'sentence'
          });
        }
        
        // Handle overlap
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + sentence + ' ';
      }

      // Update page number estimation
      if (i > 0 && i % sentencesPerPage === 0) {
        currentPage++;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        pageNumber: currentPage,
        chunkIndex: chunks.length,
        strategy: 'sentence'
      });
    }

    return chunks;
  }

  /**
   * Paragraph-based chunking strategy
   */
  paragraphBasedChunking(text, numPages, maxChunkSize = 1500, overlap = 300) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    let currentPage = 1;
    const paragraphsPerPage = Math.ceil(paragraphs.length / numPages);

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      
      if (currentChunk.length + paragraph.length < maxChunkSize) {
        currentChunk += paragraph + '\n\n';
      } else {
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim(),
            pageNumber: currentPage,
            chunkIndex: chunks.length,
            strategy: 'paragraph'
          });
        }
        
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + paragraph + '\n\n';
      }

      if (i > 0 && i % paragraphsPerPage === 0) {
        currentPage++;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        pageNumber: currentPage,
        chunkIndex: chunks.length,
        strategy: 'paragraph'
      });
    }

    return chunks;
  }

  /**
   * Semantic chunking strategy (topic-based)
   */
  async semanticChunking(text, numPages, maxChunkSize = 1200) {
    try {
      // Split into initial segments
      const segments = text.split(/\n\s*\n/).filter(s => s.trim().length > 50);
      const chunks = [];
      let currentChunk = '';
      let currentTopic = '';
      let currentPage = 1;
      const segmentsPerPage = Math.ceil(segments.length / numPages);

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i].trim();
        
        // Simple topic detection (can be enhanced with NLP)
        const segmentTopic = this.extractTopic(segment);
        
        if (currentTopic === '' || 
            segmentTopic === currentTopic || 
            currentChunk.length + segment.length < maxChunkSize) {
          currentChunk += segment + '\n\n';
          if (currentTopic === '') currentTopic = segmentTopic;
        } else {
          if (currentChunk.trim()) {
            chunks.push({
              text: currentChunk.trim(),
              pageNumber: currentPage,
              chunkIndex: chunks.length,
              strategy: 'semantic',
              topic: currentTopic
            });
          }
          
          currentChunk = segment + '\n\n';
          currentTopic = segmentTopic;
        }

        if (i > 0 && i % segmentsPerPage === 0) {
          currentPage++;
        }
      }

      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          pageNumber: currentPage,
          chunkIndex: chunks.length,
          strategy: 'semantic',
          topic: currentTopic
        });
      }

      return chunks;
    } catch (error) {
      console.error('Semantic chunking error:', error);
      // Fallback to sentence-based chunking
      return this.sentenceBasedChunking(text, numPages);
    }
  }

  /**
   * Hybrid chunking strategy (combines multiple approaches)
   */
  async hybridChunking(text, numPages) {
    try {
      // Generate chunks using different strategies
      const sentenceChunks = this.sentenceBasedChunking(text, numPages, 800, 150);
      const paragraphChunks = this.paragraphBasedChunking(text, numPages, 1200, 250);
      
      // Combine and optimize
      const hybridChunks = this.optimizeChunkCombination(sentenceChunks, paragraphChunks);
      
      return hybridChunks.map((chunk, index) => ({
        ...chunk,
        chunkIndex: index,
        strategy: 'hybrid'
      }));
    } catch (error) {
      console.error('Hybrid chunking error:', error);
      return this.sentenceBasedChunking(text, numPages);
    }
  }

  /**
   * Optimize combination of different chunking strategies
   */
  optimizeChunkCombination(sentenceChunks, paragraphChunks) {
    const combined = [];
    const used = new Set();

    // Prefer paragraph chunks for better context
    for (const pChunk of paragraphChunks) {
      if (pChunk.text.length > 200 && pChunk.text.length < 1500) {
        combined.push(pChunk);
        used.add(this.getTextHash(pChunk.text));
      }
    }

    // Fill gaps with sentence chunks
    for (const sChunk of sentenceChunks) {
      const hash = this.getTextHash(sChunk.text);
      if (!used.has(hash) && sChunk.text.length > 100) {
        // Check if this chunk overlaps significantly with existing chunks
        const hasSignificantOverlap = combined.some(existing => 
          this.calculateTextOverlap(sChunk.text, existing.text) > 0.7
        );
        
        if (!hasSignificantOverlap) {
          combined.push(sChunk);
          used.add(hash);
        }
      }
    }

    return combined.sort((a, b) => a.pageNumber - b.pageNumber);
  }

  /**
   * Generate embeddings for chunks with batching
   */
  async generateChunkEmbeddings(chunks) {
    const texts = chunks.map(chunk => chunk.text);
    return await generateEmbeddings(texts);
  }

  /**
   * Enrich chunks with additional metadata
   */
  enrichChunks(chunks, embeddings, extractedData) {
    return chunks.map((chunk, index) => ({
      text: chunk.text,
      embedding: embeddings[index],
      metadata: {
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        strategy: chunk.strategy,
        topic: chunk.topic,
        wordCount: chunk.text.split(/\s+/).length,
        charCount: chunk.text.length,
        language: this.detectLanguage(chunk.text)
      }
    }));
  }

  /**
   * Utility functions
   */
  getOverlapText(text, overlapSize) {
    const words = text.split(/\s+/);
    const overlapWords = Math.min(overlapSize / 5, words.length); // Rough word estimation
    return words.slice(-overlapWords).join(' ') + ' ';
  }

  extractTopic(text) {
    // Simple topic extraction - can be enhanced with NLP libraries
    const words = text.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const significantWords = words.filter(word => 
      word.length > 3 && !commonWords.has(word)
    );
    
    return significantWords.slice(0, 3).join('_');
  }

  getTextHash(text) {
    // Simple hash function for text comparison
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  calculateTextOverlap(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  detectLanguage(text) {
    const sample = text.slice(0, 1000).toLowerCase();
    
    if (/[àâäéèêëïîôöùûüÿñç]/.test(sample)) return 'fr';
    if (/[äöüß]/.test(sample)) return 'de';
    if (/[ñáéíóúü]/.test(sample)) return 'es';
    if (/[àèìòù]/.test(sample)) return 'it';
    
    return 'en';
  }

  async handleProcessingError(documentId, filePath, error) {
    try {
      await Document.findByIdAndUpdate(documentId, {
        processingStatus: 'failed',
        processingProgress: 0
      });
      await fs.remove(filePath);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
}

export const documentProcessor = new DocumentProcessor();
export default documentProcessor;