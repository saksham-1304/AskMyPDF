import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy initialization variables
let pinecone = null;
let genAI = null;
let index = null;

// Function to initialize Pinecone client
const initializePinecone = () => {
  if (!pinecone) {
    // Check if environment variables are loaded
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT) {
      throw new Error('Pinecone configuration missing: PINECONE_API_KEY and PINECONE_ENVIRONMENT are required');
    }
    
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
    });
    
    index = pinecone.index(process.env.PINECONE_INDEX_NAME);
  }
  return { pinecone, index };
};

// Function to initialize Google Generative AI
const initializeGenAI = () => {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Google Generative AI configuration missing: GEMINI_API_KEY is required');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

export const generateEmbeddings = async (texts) => {
  try {
    const genAI = initializeGenAI();
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });
    const embeddings = [];
    
    // Process in batches to avoid API limits
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(async (text) => {
        const result = await model.embedContent(text);
        return result.embedding.values;
      });
      
      const batchEmbeddings = await Promise.all(batchPromises);
      embeddings.push(...batchEmbeddings);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
};

export const storePineconeVectors = async (chunks, namespace, documentId) => {
  try {
    const { index } = initializePinecone();
    
    const vectors = chunks.map((chunk, index) => ({
      id: `${documentId}-${index}`,
      values: chunk.embedding,
      metadata: {
        text: chunk.text,
        documentId: documentId.toString(),
        chunkIndex: index,
        pageNumber: chunk.metadata.pageNumber
      }
    }));

    // Upsert vectors in batches
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.namespace(namespace).upsert(batch);
    }

    console.log(`Stored ${vectors.length} vectors in Pinecone namespace ${namespace}`);
  } catch (error) {
    console.error('Error storing vectors in Pinecone:', error);
    throw error;
  }
};

export const searchSimilarChunks = async (query, namespace, topK = 5) => {
  try {
    const { index } = initializePinecone();
    const genAI = initializeGenAI();
    
    // Generate embedding for query
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });
    const result = await model.embedContent(query);
    const queryEmbedding = result.embedding.values;

    // Search in Pinecone
    const searchResult = await index.namespace(namespace).query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true
    });

    return searchResult.matches.map(match => ({
      text: match.metadata.text,
      score: match.score,
      pageNumber: match.metadata.pageNumber,
      chunkIndex: match.metadata.chunkIndex
    }));
  } catch (error) {
    console.error('Error searching similar chunks:', error);
    throw error;
  }
};

export const deletePineconeVectors = async (namespace) => {
  try {
    const { index } = initializePinecone();
    await index.namespace(namespace).deleteAll();
    console.log(`Deleted all vectors from namespace ${namespace}`);
  } catch (error) {
    console.error('Error deleting vectors from Pinecone:', error);
    throw error;
  }
};