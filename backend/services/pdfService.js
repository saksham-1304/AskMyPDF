import pdfParse from 'pdf-parse';
import fs from 'fs-extra';
import Document from '../models/Document.js';
import { generateEmbeddings, storePineconeVectors } from './pineconeService.js';
import { v4 as uuidv4 } from 'uuid';

export const processPDF = async (documentId, filePath) => {
  try {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Update status
    document.processingStatus = 'processing';
    document.processingProgress = 10;
    await document.save();

    // Parse PDF
    const pdfBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(pdfBuffer);

    // Update document with content
    document.content = pdfData.text;
    document.metadata = {
      pages: pdfData.numpages,
      wordCount: pdfData.text.split(/\s+/).length,
      language: detectLanguage(pdfData.text)
    };
    document.processingProgress = 30;
    await document.save();

    // Split into chunks
    const chunks = splitIntoChunks(pdfData.text, 1000, 200);
    document.processingProgress = 50;
    await document.save();

    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks);
    document.processingProgress = 70;
    await document.save();

    // Prepare chunks with embeddings
    const chunksWithEmbeddings = chunks.map((chunk, index) => ({
      text: chunk,
      embedding: embeddings[index],
      metadata: {
        pageNumber: Math.floor(index / 5) + 1, // Rough page estimation
        chunkIndex: index
      }
    }));

    document.chunks = chunksWithEmbeddings;
    document.processingProgress = 85;
    await document.save();

    // Store in Pinecone
    const namespace = uuidv4();
    await storePineconeVectors(chunksWithEmbeddings, namespace, document._id);
    
    document.pineconeNamespace = namespace;
    document.processingStatus = 'completed';
    document.processingProgress = 100;
    await document.save();

    // Clean up file
    await fs.remove(filePath);

    console.log(`PDF processing completed for document ${documentId}`);
  } catch (error) {
    console.error(`PDF processing failed for document ${documentId}:`, error);
    
    // Update document status
    try {
      await Document.findByIdAndUpdate(documentId, {
        processingStatus: 'failed',
        processingProgress: 0
      });
    } catch (updateError) {
      console.error('Failed to update document status:', updateError);
    }

    // Clean up file
    try {
      await fs.remove(filePath);
    } catch (cleanupError) {
      console.error('Failed to clean up file:', cleanupError);
    }

    throw error;
  }
};

const splitIntoChunks = (text, maxChunkSize, overlap) => {
  const chunks = [];
  const sentences = text.split(/[.!?]+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length < maxChunkSize) {
      currentChunk += sentence + '. ';
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence + '. ';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

const detectLanguage = (text) => {
  // Simple language detection - can be improved with a proper library
  const sample = text.slice(0, 1000).toLowerCase();
  
  if (/[àâäéèêëïîôöùûüÿñç]/.test(sample)) return 'fr';
  if (/[äöüß]/.test(sample)) return 'de';
  if (/[ñáéíóúü]/.test(sample)) return 'es';
  if (/[àèìòù]/.test(sample)) return 'it';
  
  return 'en';
};