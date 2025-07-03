import documentProcessor from './documentProcessor.js';

/**
 * PDF Service - Interface to document processor
 * Maintains backward compatibility
 */
export const processPDF = async (documentId, filePath, strategy = 'hybrid') => {
  try {
    return await documentProcessor.processDocument(documentId, filePath, strategy);
  } catch (error) {
    console.error('PDF service error:', error);
    throw error;
  }
};

// Re-export for backward compatibility
export { documentProcessor };