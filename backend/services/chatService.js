import ragService from './ragService.js';
import alchemystService from './alchemystService.js';

/**
 * Chat Service - Interface to RAG pipeline with Alchemyst AI primary and Gemini fallback
 * Enhanced with Alchemyst AI's dynamic workflow planning and Context Lake
 */
export const generateResponse = async (query, document, chatHistory, options = {}) => {
  try {
    // Check if Alchemyst AI is available
    if (alchemystService.isEnabled()) {
      console.log('Using Alchemyst AI engine for response generation');
      
      try {
        // Use Alchemyst AI as primary engine
        const response = await ragService.generateResponseWithAlchemyst(query, document, chatHistory, options);
        
        return {
          content: response.content,
          metadata: {
            ...response.metadata,
            aiEngine: 'alchemyst-ai',
            vectorDatabase: 'qdrant'
          }
        };
      } catch (alchemystError) {
        console.warn('Alchemyst AI failed, falling back to Gemini:', alchemystError.message);
        // Fall back to Gemini
      }
    }

    // Use Gemini as fallback or primary if Alchemyst is not available
    console.log('Using Gemini engine for response generation');
    const response = await ragService.generateResponse(query, document, chatHistory, options);
    
    return {
      content: response.content,
      metadata: {
        ...response.metadata,
        aiEngine: 'gemini',
        vectorDatabase: 'qdrant'
      }
    };
  } catch (error) {
    console.error('Chat service error:', error);
    throw error;
  }
};

/**
 * Advanced chat features with Alchemyst AI integration and Gemini fallback
 */
export const generateFollowUpQuestions = async (query, response, document) => {
  try {
    // Try Alchemyst AI first
    if (alchemystService.isEnabled()) {
      try {
        console.log('Generating follow-up questions using Alchemyst AI');
        const context = document.extractedText || document.metadata?.summary || '';
        return await alchemystService.generateFollowUpQuestions(query, response, context);
      } catch (alchemystError) {
        console.warn('Alchemyst AI failed for follow-up questions, falling back to Gemini:', alchemystError.message);
      }
    }
    
    // Fallback to Gemini
    console.log('Generating follow-up questions using Gemini');
    return await ragService.generateFollowUpQuestions(query, response, document);
  } catch (error) {
    console.error('Follow-up generation error:', error);
    return [];
  }
};

export const evaluateResponse = async (query, response, groundTruth = null) => {
  try {
    // Try Alchemyst AI first for evaluation
    if (alchemystService.isEnabled()) {
      try {
        console.log('Evaluating response using Alchemyst AI');
        const evaluation = await alchemystService.evaluateResponse(query, response, groundTruth);
        return {
          ...evaluation,
          aiEngine: 'alchemyst-ai',
          vectorDatabase: 'qdrant'
        };
      } catch (alchemystError) {
        console.warn('Alchemyst AI failed for evaluation, falling back to Gemini:', alchemystError.message);
      }
    }
    
    // Fallback to Gemini
    console.log('Evaluating response using Gemini');
    const evaluation = await ragService.evaluateResponse(query, response, groundTruth);
    return {
      ...evaluation,
      aiEngine: 'gemini',
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