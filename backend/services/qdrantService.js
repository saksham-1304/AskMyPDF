import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy initialization variables
let qdrantClient = null;
let genAI = null;

// Function to initialize Qdrant client
const initializeQdrant = () => {
  if (!qdrantClient) {
    // Check if environment variables are loaded
    if (!process.env.QDRANT_URL) {
      throw new Error('Qdrant configuration missing: QDRANT_URL is required');
    }
    
    const config = {
      url: process.env.QDRANT_URL,
    };

    // Add API key if provided (for Qdrant Cloud)
    if (process.env.QDRANT_API_KEY) {
      config.apiKey = process.env.QDRANT_API_KEY;
    }
    
    qdrantClient = new QdrantClient(config);
  }
  return qdrantClient;
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

// Initialize collection if it doesn't exist
const initializeCollection = async (collectionName) => {
  try {
    const client = initializeQdrant();
    
    // Check if collection exists
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(
      collection => collection.name === collectionName
    );

    if (!collectionExists) {
      // Create collection with proper configuration
      await client.createCollection(collectionName, {
        vectors: {
          size: 768, // Gemini embedding dimension
          distance: 'Cosine', // Cosine similarity
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });
      console.log(`Created Qdrant collection: ${collectionName}`);
    }
  } catch (error) {
    console.error('Error initializing Qdrant collection:', error);
    throw error;
  }
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

export const storeQdrantVectors = async (chunks, collectionName, documentId) => {
  try {
    const client = initializeQdrant();
    
    // Initialize collection if needed
    await initializeCollection(collectionName);
    
    // Prepare points for Qdrant
    const points = chunks.map((chunk, index) => ({
      id: `${documentId}-${index}`,
      vector: chunk.embedding,
      payload: {
        text: chunk.text,
        documentId: documentId.toString(),
        chunkIndex: index,
        pageNumber: chunk.metadata.pageNumber,
        strategy: chunk.metadata.strategy,
        wordCount: chunk.metadata.wordCount,
        charCount: chunk.metadata.charCount,
        language: chunk.metadata.language,
        topic: chunk.metadata.topic || null,
      }
    }));

    // Upsert points in batches
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await client.upsert(collectionName, {
        wait: true,
        points: batch,
      });
    }

    console.log(`Stored ${points.length} vectors in Qdrant collection ${collectionName}`);
    return collectionName;
  } catch (error) {
    console.error('Error storing vectors in Qdrant:', error);
    throw error;
  }
};

export const searchSimilarChunks = async (query, collectionName, topK = 5, filter = null) => {
  try {
    const client = initializeQdrant();
    const genAI = initializeGenAI();
    
    // Generate embedding for query
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });
    const result = await model.embedContent(query);
    const queryEmbedding = result.embedding.values;

    // Prepare search request
    const searchRequest = {
      vector: queryEmbedding,
      limit: topK,
      with_payload: true,
      with_vector: false,
    };

    // Add filter if provided
    if (filter) {
      searchRequest.filter = filter;
    }

    // Search in Qdrant
    const searchResult = await client.search(collectionName, searchRequest);

    return searchResult.map(match => ({
      text: match.payload.text,
      score: match.score,
      pageNumber: match.payload.pageNumber,
      chunkIndex: match.payload.chunkIndex,
      strategy: match.payload.strategy,
      topic: match.payload.topic,
      wordCount: match.payload.wordCount,
      id: match.id,
    }));
  } catch (error) {
    console.error('Error searching similar chunks in Qdrant:', error);
    throw error;
  }
};

export const searchWithFilter = async (query, collectionName, documentId, topK = 5) => {
  const filter = {
    must: [
      {
        key: 'documentId',
        match: {
          value: documentId.toString()
        }
      }
    ]
  };

  return await searchSimilarChunks(query, collectionName, topK, filter);
};

export const deleteQdrantVectors = async (collectionName, documentId = null) => {
  try {
    const client = initializeQdrant();
    
    if (documentId) {
      // Delete specific document vectors
      await client.delete(collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: 'documentId',
              match: {
                value: documentId.toString()
              }
            }
          ]
        }
      });
      console.log(`Deleted vectors for document ${documentId} from collection ${collectionName}`);
    } else {
      // Delete entire collection
      await client.deleteCollection(collectionName);
      console.log(`Deleted entire collection ${collectionName}`);
    }
  } catch (error) {
    console.error('Error deleting vectors from Qdrant:', error);
    throw error;
  }
};

export const getCollectionInfo = async (collectionName) => {
  try {
    const client = initializeQdrant();
    const info = await client.getCollection(collectionName);
    return info;
  } catch (error) {
    console.error('Error getting collection info:', error);
    throw error;
  }
};

export const countVectors = async (collectionName, documentId = null) => {
  try {
    const client = initializeQdrant();
    
    let filter = null;
    if (documentId) {
      filter = {
        must: [
          {
            key: 'documentId',
            match: {
              value: documentId.toString()
            }
          }
        ]
      };
    }

    const result = await client.count(collectionName, {
      filter: filter,
      exact: true,
    });

    return result.count;
  } catch (error) {
    console.error('Error counting vectors:', error);
    throw error;
  }
};

// Advanced search with multiple filters
export const advancedSearch = async (query, collectionName, options = {}) => {
  try {
    const client = initializeQdrant();
    const genAI = initializeGenAI();
    
    const {
      documentId,
      pageNumbers = [],
      strategies = [],
      languages = [],
      topK = 5,
      scoreThreshold = 0.0
    } = options;

    // Generate embedding for query
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });
    const result = await model.embedContent(query);
    const queryEmbedding = result.embedding.values;

    // Build filter
    const mustConditions = [];
    
    if (documentId) {
      mustConditions.push({
        key: 'documentId',
        match: { value: documentId.toString() }
      });
    }

    if (pageNumbers.length > 0) {
      mustConditions.push({
        key: 'pageNumber',
        match: { any: pageNumbers }
      });
    }

    if (strategies.length > 0) {
      mustConditions.push({
        key: 'strategy',
        match: { any: strategies }
      });
    }

    if (languages.length > 0) {
      mustConditions.push({
        key: 'language',
        match: { any: languages }
      });
    }

    const searchRequest = {
      vector: queryEmbedding,
      limit: topK,
      with_payload: true,
      with_vector: false,
      score_threshold: scoreThreshold,
    };

    if (mustConditions.length > 0) {
      searchRequest.filter = { must: mustConditions };
    }

    const searchResult = await client.search(collectionName, searchRequest);

    return searchResult.map(match => ({
      text: match.payload.text,
      score: match.score,
      pageNumber: match.payload.pageNumber,
      chunkIndex: match.payload.chunkIndex,
      strategy: match.payload.strategy,
      topic: match.payload.topic,
      wordCount: match.payload.wordCount,
      language: match.payload.language,
      id: match.id,
    }));
  } catch (error) {
    console.error('Error in advanced search:', error);
    throw error;
  }
};

// Batch operations for better performance
export const batchUpsert = async (collectionName, points) => {
  try {
    const client = initializeQdrant();
    await initializeCollection(collectionName);
    
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await client.upsert(collectionName, {
        wait: true,
        points: batch,
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error in batch upsert:', error);
    throw error;
  }
};

// Health check for Qdrant
export const healthCheck = async () => {
  try {
    const client = initializeQdrant();
    const health = await client.api('cluster').clusterStatus();
    return health;
  } catch (error) {
    console.error('Qdrant health check failed:', error);
    return false;
  }
};