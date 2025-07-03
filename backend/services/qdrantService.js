import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

// Lazy initialization variables
let qdrantClient = null;
let genAI = null;

// Document namespace UUID for consistent point ID generation
const DOCUMENT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Helper function to generate consistent point IDs
const generatePointId = (documentId, chunkIndex) => {
  const pointId = uuidv5(`${documentId}-${chunkIndex}`, DOCUMENT_NAMESPACE);
  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pointId)) {
    throw new Error(`Generated invalid UUID: ${pointId}`);
  }
  return pointId;
};

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
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
      
      // Create index for documentId field after collection is created
      await client.createPayloadIndex(collectionName, {
        field_name: 'documentId',
        field_schema: 'keyword'
      });
      console.log(`Created index for documentId field in collection: ${collectionName}`);
      
      // Create additional useful indexes
      await client.createPayloadIndex(collectionName, {
        field_name: 'pageNumber',
        field_schema: 'integer'
      });
      console.log(`Created index for pageNumber field in collection: ${collectionName}`);
      
      await client.createPayloadIndex(collectionName, {
        field_name: 'strategy',
        field_schema: 'keyword'
      });
      console.log(`Created index for strategy field in collection: ${collectionName}`);
    } else {
      // If collection exists, ensure required indexes are present
      try {
        await client.createPayloadIndex(collectionName, {
          field_name: 'documentId',
          field_schema: 'keyword'
        });
        console.log(`Ensured documentId index exists in collection: ${collectionName}`);
      } catch (error) {
        // Index might already exist, which is fine
        if (!error.message.includes('already exists')) {
          console.warn(`Warning creating documentId index: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Error initializing Qdrant collection:', error);
    throw error;
  }
};

export const generateEmbeddings = async (texts) => {
  try {
    const ai = initializeGenAI();
    const embeddings = [];
    
    // Process in batches to avoid API limits
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(async (text) => {
        const result = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: text,
        });
        return result.embeddings[0].values;
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
      id: generatePointId(documentId, index),
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
    const ai = initializeGenAI();
    
    // Ensure collection exists
    await initializeCollection(collectionName);
    
    // Generate embedding for query
    const result = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: query,
    });
    const queryEmbedding = result.embeddings[0].values;

    // Prepare search request
    const searchRequest = {
      vector: queryEmbedding,
      limit: topK,
      with_payload: true,
      with_vector: false,
      score_threshold: 0.05, // Very low threshold to ensure we get results
    };

    // Add filter if provided
    if (filter) {
      searchRequest.filter = filter;
    }

    // Search in Qdrant
    const searchResult = await client.search(collectionName, searchRequest);

    const results = searchResult.map(match => ({
      text: match.payload.text,
      score: match.score,
      pageNumber: match.payload.pageNumber,
      chunkIndex: match.payload.chunkIndex,
      strategy: match.payload.strategy,
      topic: match.payload.topic,
      wordCount: match.payload.wordCount,
      id: match.id,
    }));

    console.log(`Qdrant search completed: ${results.length} results found with scores: ${results.map(r => r.score.toFixed(3)).join(', ')}`);
    return results;
  } catch (error) {
    console.error('Error searching similar chunks in Qdrant:', error);
    
    // Check if it's a collection not found error
    if (error.message.includes('Collection') && error.message.includes('not found')) {
      console.log('Collection not found, this might be expected for new documents');
    }
    
    // Return empty array instead of throwing to allow fallback mechanisms
    return [];
  }
};

export const searchWithFilter = async (query, collectionName, documentId, topK = 5) => {
  try {
    console.log(`Searching with filter: documentId=${documentId}, topK=${topK}`);
    
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

    const results = await searchSimilarChunks(query, collectionName, topK, filter);
    console.log(`Qdrant search with filter returned ${results.length} results for document ${documentId}`);
    
    // If no results, try without filter as fallback
    if (results.length === 0) {
      console.log('No results with filter, trying without filter');
      const fallbackResults = await searchSimilarChunks(query, collectionName, topK);
      console.log(`Fallback search returned ${fallbackResults.length} results`);
      return fallbackResults;
    }
    
    return results;
  } catch (error) {
    console.error('Error in searchWithFilter:', error);
    
    // Try fallback search without filter
    try {
      console.log('Attempting fallback search without filter');
      const fallbackResults = await searchSimilarChunks(query, collectionName, topK);
      console.log(`Fallback search returned ${fallbackResults.length} results`);
      return fallbackResults;
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError);
      return [];
    }
  }
};

export const deleteQdrantVectors = async (collectionName, documentId = null) => {
  try {
    const client = initializeQdrant();
    
    if (documentId) {
      // Delete specific document vectors using filter
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
    const ai = initializeGenAI();
    
    // Ensure collection exists
    await initializeCollection(collectionName);
    
    const {
      documentId,
      pageNumbers = [],
      strategies = [],
      languages = [],
      topK = 5,
      scoreThreshold = 0.05 // Even lower threshold
    } = options;

    console.log(`Advanced search: documentId=${documentId}, topK=${topK}, scoreThreshold=${scoreThreshold}`);

    // Generate embedding for query
    const result = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: query,
    });
    const queryEmbedding = result.embeddings[0].values;

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

    const results = searchResult.map(match => ({
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

    console.log(`Advanced search completed: ${results.length} results found`);
    return results;
  } catch (error) {
    console.error('Error in advanced search:', error);
    
    // Try fallback search with just documentId filter
    if (options.documentId) {
      try {
        console.log('Attempting fallback advanced search with just documentId');
        const fallbackResults = await searchWithFilter(query, collectionName, options.documentId, options.topK);
        console.log(`Fallback advanced search returned ${fallbackResults.length} results`);
        return fallbackResults;
      } catch (fallbackError) {
        console.error('Fallback advanced search also failed:', fallbackError);
      }
    }
    
    return [];
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

// Utility function to create required indexes for existing collections
export const createRequiredIndexes = async (collectionName) => {
  try {
    const client = initializeQdrant();
    
    // Create documentId index
    await client.createPayloadIndex(collectionName, {
      field_name: 'documentId',
      field_schema: 'keyword'
    });
    console.log(`Created documentId index for collection: ${collectionName}`);
    
    // Create pageNumber index
    await client.createPayloadIndex(collectionName, {
      field_name: 'pageNumber',
      field_schema: 'integer'
    });
    console.log(`Created pageNumber index for collection: ${collectionName}`);
    
    // Create strategy index
    await client.createPayloadIndex(collectionName, {
      field_name: 'strategy',
      field_schema: 'keyword'
    });
    console.log(`Created strategy index for collection: ${collectionName}`);
    
    return true;
  } catch (error) {
    console.error('Error creating indexes:', error);
    // Don't throw error if indexes already exist
    if (error.message.includes('already exists')) {
      console.log('Some indexes already exist, which is fine');
      return true;
    }
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