import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { Whisper } from 'whisper-node';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import Document from '../models/Document.js';
import { generateEmbeddings, storeQdrantVectors } from './qdrantService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Multimodal Document Processor
 * Handles PDF, DOCX, Images, and Audio files with unified semantic indexing
 */
class MultimodalProcessor {
  constructor() {
    this.supportedFormats = {
      text: ['.pdf', '.docx', '.doc', '.txt'],
      image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
      audio: ['.mp3', '.wav', '.m4a', '.ogg', '.flac']
    };
    
    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.whisper = new Whisper();
    this.collectionName = process.env.QDRANT_COLLECTION_NAME || 'multimodal_documents';
  }

  /**
   * Main processing pipeline for multimodal documents
   */
  async processMultimodalDocument(documentId, filePath, originalName) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      const fileExtension = path.extname(originalName).toLowerCase();
      const fileType = this.getFileType(fileExtension);

      document.processingStatus = 'processing';
      document.processingProgress = 10;
      document.metadata = {
        ...document.metadata,
        fileType,
        extractionMethod: 'multimodal',
        modalities: []
      };
      await document.save();

      let extractedData = {};
      let chunks = [];

      switch (fileType) {
        case 'text':
          extractedData = await this.processTextDocument(filePath, fileExtension);
          chunks = await this.createTextChunks(extractedData.text, extractedData.metadata);
          document.metadata.modalities.push('text');
          break;
          
        case 'image':
          extractedData = await this.processImageDocument(filePath, originalName);
          chunks = await this.createImageChunks(extractedData);
          document.metadata.modalities.push('image', 'text'); // OCR text
          break;
          
        case 'audio':
          extractedData = await this.processAudioDocument(filePath, originalName);
          chunks = await this.createAudioChunks(extractedData);
          document.metadata.modalities.push('audio', 'text'); // Transcript
          break;
          
        default:
          throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      document.processingProgress = 50;
      await document.save();

      // Generate embeddings for all chunks
      const embeddings = await this.generateMultimodalEmbeddings(chunks);
      document.processingProgress = 70;
      await document.save();

      // Enrich chunks with metadata and embeddings
      const enrichedChunks = this.enrichMultimodalChunks(chunks, embeddings, extractedData);
      
      document.chunks = enrichedChunks;
      document.content = extractedData.text || extractedData.description || '';
      document.metadata = {
        ...document.metadata,
        ...extractedData.metadata,
        totalChunks: enrichedChunks.length
      };
      document.processingProgress = 85;
      await document.save();

      // Store in Qdrant vector database
      const collectionName = await storeQdrantVectors(enrichedChunks, this.collectionName, document._id);
      
      document.qdrantCollection = collectionName;
      document.processingStatus = 'completed';
      document.processingProgress = 100;
      await document.save();

      // Cleanup temporary files
      await fs.remove(filePath);

      console.log(`Multimodal document processing completed for ${documentId}`);
      return document;
    } catch (error) {
      console.error(`Multimodal document processing failed for ${documentId}:`, error);
      await this.handleProcessingError(documentId, filePath, error);
      throw error;
    }
  }

  /**
   * Process text documents (PDF, DOCX, TXT)
   */
  async processTextDocument(filePath, extension) {
    switch (extension) {
      case '.pdf':
        return await this.processPDF(filePath);
      case '.docx':
      case '.doc':
        return await this.processDOCX(filePath);
      case '.txt':
        return await this.processTXT(filePath);
      default:
        throw new Error(`Unsupported text format: ${extension}`);
    }
  }

  /**
   * Process DOCX documents
   */
  async processDOCX(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      const messages = result.messages;

      return {
        text: this.cleanExtractedText(text),
        metadata: {
          wordCount: text.split(/\s+/).length,
          extractionWarnings: messages.length,
          language: this.detectLanguage(text)
        }
      };
    } catch (error) {
      console.error('DOCX processing error:', error);
      throw new Error('Failed to extract text from DOCX');
    }
  }

  /**
   * Process TXT files
   */
  async processTXT(filePath) {
    try {
      const text = await fs.readFile(filePath, 'utf-8');
      return {
        text: this.cleanExtractedText(text),
        metadata: {
          wordCount: text.split(/\s+/).length,
          language: this.detectLanguage(text)
        }
      };
    } catch (error) {
      console.error('TXT processing error:', error);
      throw new Error('Failed to read TXT file');
    }
  }

  /**
   * Process image documents with OCR and visual analysis
   */
  async processImageDocument(filePath, originalName) {
    try {
      // Get image metadata
      const imageMetadata = await sharp(filePath).metadata();
      
      // Resize image for processing if too large
      const processedImagePath = path.join(path.dirname(filePath), `processed_${originalName}`);
      await sharp(filePath)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toFile(processedImagePath);

      // Generate image description using Gemini Vision
      const imageDescription = await this.generateImageDescription(processedImagePath);
      
      // Extract text from image using OCR (Gemini Vision can also do OCR)
      const ocrText = await this.extractTextFromImage(processedImagePath);

      // Clean up processed image
      await fs.remove(processedImagePath);

      return {
        description: imageDescription,
        text: ocrText,
        metadata: {
          width: imageMetadata.width,
          height: imageMetadata.height,
          format: imageMetadata.format,
          hasAlpha: imageMetadata.hasAlpha,
          density: imageMetadata.density,
          colorSpace: imageMetadata.space,
          channels: imageMetadata.channels,
          ocrWordCount: ocrText ? ocrText.split(/\s+/).length : 0
        }
      };
    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Process audio documents with speech-to-text
   */
  async processAudioDocument(filePath, originalName) {
    try {
      // Convert audio to WAV format for Whisper if needed
      const wavPath = path.join(path.dirname(filePath), `${uuidv4()}.wav`);
      
      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .toFormat('wav')
          .audioFrequency(16000)
          .audioChannels(1)
          .on('end', resolve)
          .on('error', reject)
          .save(wavPath);
      });

      // Get audio metadata
      const audioMetadata = await this.getAudioMetadata(filePath);

      // Transcribe audio using Whisper
      const transcription = await this.transcribeAudio(wavPath);

      // Clean up temporary WAV file
      await fs.remove(wavPath);

      return {
        text: transcription.text,
        segments: transcription.segments,
        metadata: {
          duration: audioMetadata.duration,
          format: audioMetadata.format,
          bitrate: audioMetadata.bitrate,
          sampleRate: audioMetadata.sampleRate,
          channels: audioMetadata.channels,
          wordCount: transcription.text ? transcription.text.split(/\s+/).length : 0,
          segmentCount: transcription.segments ? transcription.segments.length : 0
        }
      };
    } catch (error) {
      console.error('Audio processing error:', error);
      throw new Error('Failed to process audio');
    }
  }

  /**
   * Generate image description using Gemini Vision
   */
  async generateImageDescription(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          parts: [
            {
              text: `Analyze this image and provide a detailed description including:
              1. Main objects, people, or subjects
              2. Setting, location, or environment
              3. Colors, lighting, and visual style
              4. Any text visible in the image
              5. Context or purpose of the image
              6. Notable details or features
              
              Provide a comprehensive description that would help someone understand the image content for search and retrieval purposes.`
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }]
      });

      return result.text || 'Unable to generate image description';
    } catch (error) {
      console.error('Image description generation error:', error);
      return 'Image description unavailable';
    }
  }

  /**
   * Extract text from image using OCR
   */
  async extractTextFromImage(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{
          parts: [
            {
              text: `Extract all visible text from this image. Return only the text content, maintaining the original structure and formatting as much as possible. If no text is visible, return an empty string.`
            },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }]
      });

      return result.text?.trim() || '';
    } catch (error) {
      console.error('OCR extraction error:', error);
      return '';
    }
  }

  /**
   * Transcribe audio using Whisper
   */
  async transcribeAudio(audioPath) {
    try {
      // Note: This is a placeholder for Whisper integration
      // You'll need to implement actual Whisper integration based on your setup
      // This could be OpenAI's Whisper API, local Whisper model, or another STT service
      
      const transcription = await this.whisper.transcribe(audioPath, {
        language: 'en',
        task: 'transcribe',
        response_format: 'verbose_json'
      });

      return {
        text: transcription.text,
        segments: transcription.segments || []
      };
    } catch (error) {
      console.error('Audio transcription error:', error);
      // Fallback: return empty transcription
      return {
        text: '',
        segments: []
      };
    }
  }

  /**
   * Get audio metadata using ffprobe
   */
  async getAudioMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        
        resolve({
          duration: metadata.format.duration,
          format: metadata.format.format_name,
          bitrate: metadata.format.bit_rate,
          sampleRate: audioStream?.sample_rate,
          channels: audioStream?.channels
        });
      });
    });
  }

  /**
   * Create text chunks with multimodal context
   */
  async createTextChunks(text, metadata) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;
    const maxChunkSize = 1000;

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim() + '.';
      
      if (currentChunk.length + trimmedSentence.length < maxChunkSize) {
        currentChunk += trimmedSentence + ' ';
      } else {
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim(),
            chunkIndex: chunkIndex++,
            modality: 'text',
            metadata: {
              wordCount: currentChunk.split(/\s+/).length,
              ...metadata
            }
          });
        }
        currentChunk = trimmedSentence + ' ';
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        modality: 'text',
        metadata: {
          wordCount: currentChunk.split(/\s+/).length,
          ...metadata
        }
      });
    }

    return chunks;
  }

  /**
   * Create image chunks with visual and textual content
   */
  async createImageChunks(extractedData) {
    const chunks = [];

    // Main image description chunk
    chunks.push({
      text: extractedData.description,
      chunkIndex: 0,
      modality: 'image',
      metadata: {
        type: 'visual_description',
        ...extractedData.metadata
      }
    });

    // OCR text chunk if available
    if (extractedData.text && extractedData.text.trim()) {
      chunks.push({
        text: extractedData.text,
        chunkIndex: 1,
        modality: 'text',
        metadata: {
          type: 'ocr_text',
          source: 'image_ocr',
          ...extractedData.metadata
        }
      });
    }

    return chunks;
  }

  /**
   * Create audio chunks with transcript segments
   */
  async createAudioChunks(extractedData) {
    const chunks = [];

    // Full transcript chunk
    if (extractedData.text) {
      chunks.push({
        text: extractedData.text,
        chunkIndex: 0,
        modality: 'audio',
        metadata: {
          type: 'full_transcript',
          ...extractedData.metadata
        }
      });
    }

    // Individual segment chunks
    if (extractedData.segments && extractedData.segments.length > 0) {
      extractedData.segments.forEach((segment, index) => {
        chunks.push({
          text: segment.text,
          chunkIndex: index + 1,
          modality: 'audio',
          metadata: {
            type: 'transcript_segment',
            startTime: segment.start,
            endTime: segment.end,
            duration: segment.end - segment.start,
            segmentId: segment.id,
            ...extractedData.metadata
          }
        });
      });
    }

    return chunks;
  }

  /**
   * Generate embeddings for multimodal chunks
   */
  async generateMultimodalEmbeddings(chunks) {
    const texts = chunks.map(chunk => {
      // Create rich text representation for embedding
      let embeddingText = chunk.text;
      
      // Add modality context
      embeddingText = `[${chunk.modality.toUpperCase()}] ${embeddingText}`;
      
      // Add metadata context for better semantic understanding
      if (chunk.metadata?.type) {
        embeddingText = `[${chunk.metadata.type.toUpperCase()}] ${embeddingText}`;
      }
      
      return embeddingText;
    });

    return await generateEmbeddings(texts);
  }

  /**
   * Enrich chunks with embeddings and cross-modal metadata
   */
  enrichMultimodalChunks(chunks, embeddings, extractedData) {
    return chunks.map((chunk, index) => ({
      text: chunk.text,
      embedding: embeddings[index],
      metadata: {
        chunkIndex: chunk.chunkIndex,
        modality: chunk.modality,
        type: chunk.metadata?.type || 'content',
        wordCount: chunk.text.split(/\s+/).length,
        charCount: chunk.text.length,
        vectorDatabase: 'qdrant',
        crossModalLinks: this.generateCrossModalLinks(chunk, extractedData),
        ...chunk.metadata
      }
    }));
  }

  /**
   * Generate cross-modal links between different content types
   */
  generateCrossModalLinks(chunk, extractedData) {
    const links = [];

    // Link audio segments to transcript
    if (chunk.modality === 'audio' && chunk.metadata?.type === 'transcript_segment') {
      links.push({
        type: 'temporal',
        startTime: chunk.metadata.startTime,
        endTime: chunk.metadata.endTime,
        description: 'Audio segment timing'
      });
    }

    // Link OCR text to image
    if (chunk.modality === 'text' && chunk.metadata?.source === 'image_ocr') {
      links.push({
        type: 'spatial',
        source: 'image',
        description: 'Text extracted from image'
      });
    }

    return links;
  }

  /**
   * Utility methods
   */
  getFileType(extension) {
    for (const [type, extensions] of Object.entries(this.supportedFormats)) {
      if (extensions.includes(extension)) {
        return type;
      }
    }
    return 'unknown';
  }

  cleanExtractedText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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

export const multimodalProcessor = new MultimodalProcessor();
export default multimodalProcessor;