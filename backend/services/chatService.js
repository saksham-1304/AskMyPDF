import ragService from './ragService.js';

/**
 * Chat Service - Interface to RAG pipeline
 * Maintains backward compatibility while using enhanced RAG
 */
export const generateResponse = async (query, document, chatHistory) => {
  try {
    // Use the enhanced RAG service
    const response = await ragService.generateResponse(query, document, chatHistory);
    
    return {
      content: response.content,
      metadata: response.metadata
    };
  } catch (error) {
    console.error('Chat service error:', error);
    throw error;
  }
};

/**
 * Advanced chat features
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
    return await ragService.evaluateResponse(query, response, groundTruth);
  } catch (error) {
    console.error('Response evaluation error:', error);
    return null;
  }
};