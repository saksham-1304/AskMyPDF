import ragService from './ragService.js';

/**
 * Chat Service - Interface to RAG pipeline with Qdrant
 * Maintains backward compatibility while using enhanced RAG
 */
export const generateResponse = async (query, document, chatHistory, options = {}) => {
  try {
    // Use the enhanced RAG service with Qdrant
    const response = await ragService.generateResponse(query, document, chatHistory, options);
    
    return {
      content: response.content,
      metadata: {
        ...response.metadata,
        vectorDatabase: 'qdrant'
      }
    };
  } catch (error) {
    console.error('Chat service error:', error);
    throw error;
  }
};

/**
 * Advanced chat features with Qdrant integration
 */
export const generateFollowUpQuestions = async (query, response, document) => {
  try {
    return await ragService.generateFollowUpQuestions(query, response, document);
  } catch (error) {
    console.error('Follow-up generation error:', error);
    return [];
  }
};

export const evaluateResponse = async (query, response, groundTruth = null) => {
  try {
    const evaluation = await ragService.evaluateResponse(query, response, groundTruth);
    return {
      ...evaluation,
      vectorDatabase: 'qdrant'
    };
  } catch (error) {
    console.error('Response evaluation error:', error);
    return null;
  }
};

/**
 * New Qdrant-specific features
 */
export const searchDocument = async (query, document, options = {}) => {
  try {
    const { advancedSearch } = await import('./qdrantService.js');
    return await advancedSearch(query, document.qdrantCollection, {
      documentId: document._id,
      ...options
    });
  } catch (error) {
    console.error('Document search error:', error);
    return [];
  }
};

export const getVectorStats = async (document) => {
  try {
    const { countVectors, getCollectionInfo } = await import('./qdrantService.js');
    const vectorCount = await countVectors(document.qdrantCollection, document._id);
    const collectionInfo = await getCollectionInfo(document.qdrantCollection);
    
    return {
      vectorCount,
      collection: document.qdrantCollection,
      collectionInfo,
      vectorDatabase: 'qdrant'
    };
  } catch (error) {
    console.error('Vector stats error:', error);
    return null;
  }
};