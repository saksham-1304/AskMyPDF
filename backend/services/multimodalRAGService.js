import ai from './gemini.js';
import alchemystService from './alchemystService.js';
import { searchSimilarChunks, advancedSearch } from './qdrantService.js';
import Document from '../models/Document.js';

/**
 * Multimodal RAG Service
 * Handles cross-modal semantic search and retrieval
 */
class MultimodalRAGService {
  constructor() {
    this.ai = ai;
    this.config = {
      maxContextLength: 6000,
      maxRetrievedChunks: 12,
      minRelevanceScore: 0.1,
      collectionName: process.env.QDRANT_COLLECTION_NAME || 'multimodal_documents',
      modalityWeights: {
        text: 1.0,
        image: 0.9,
        audio: 0.8
      }
    };
  }

  /**
   * Main multimodal RAG pipeline
   */
  async generateMultimodalResponse(query, document, chatHistory = [], options = {}) {
    try {
      const startTime = Date.now();
      
      // Step 1: Query analysis and expansion
      const queryAnalysis = await this.analyzeQuery(query, chatHistory);
      
      // Step 2: Cross-modal retrieval
      const retrievedChunks = await this.retrieveMultimodalChunks(
        queryAnalysis,
        document,
        options.maxChunks || this.config.maxRetrievedChunks
      );
      
      // Step 3: Context preparation with modality awareness
      const multimodalContext = await this.prepareMultimodalContext(retrievedChunks, queryAnalysis);
      
      // Step 4: Generate response with cross-modal citations
      const response = await this.generateContextualAnswer(
        queryAnalysis.original,
        multimodalContext,
        chatHistory,
        document
      );
      
      const processingTime = Date.now() - startTime;
      
      return {
        content: response.answer,
        metadata: {
          relevantChunks: this.formatRelevantChunks(retrievedChunks),
          processingTime,
          tokensUsed: response.tokensUsed,
          queryAnalysis,
          modalitiesUsed: this.getModalitiesUsed(retrievedChunks),
          crossModalLinks: this.extractCrossModalLinks(retrievedChunks),
          citations: this.generateCitations(retrievedChunks),
          vectorDatabase: 'qdrant'
        }
      };
    } catch (error) {
      console.error('Multimodal RAG pipeline error:', error);
      throw error;
    }
  }

  /**
   * Analyze query to understand intent and modality preferences
   */
  async analyzeQuery(query, chatHistory) {
    try {
      const analysisPrompt = `
Analyze this user query to understand what types of content they're looking for:

Query: "${query}"

Recent conversation context:
${chatHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Determine:
1. Primary intent (search, explanation, comparison, etc.)
2. Preferred modalities (text, image, audio, or combination)
3. Temporal references (specific times, dates, sequences)
4. Spatial references (locations, visual elements)
5. Content type preferences (reports, screenshots, recordings, etc.)
6. Expanded query terms for better retrieval

Respond in JSON format:
{
  "intent": "search|explanation|comparison|analysis",
  "preferredModalities": ["text", "image", "audio"],
  "temporalReferences": ["time references found"],
  "spatialReferences": ["spatial references found"],
  "contentTypes": ["document types mentioned"],
  "expandedQuery": "enhanced query with synonyms and context",
  "searchTerms": ["key terms for retrieval"]
}`;

      const result = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: analysisPrompt,
      });

      let analysis;
      try {
        analysis = JSON.parse(result.text);
      } catch (parseError) {
        // Fallback analysis
        analysis = {
          intent: 'search',
          preferredModalities: ['text', 'image', 'audio'],
          temporalReferences: [],
          spatialReferences: [],
          contentTypes: [],
          expandedQuery: query,
          searchTerms: query.split(/\s+/).filter(term => term.length > 2)
        };
      }

      return {
        original: query,
        ...analysis
      };
    } catch (error) {
      console.error('Query analysis error:', error);
      return {
        original: query,
        intent: 'search',
        preferredModalities: ['text', 'image', 'audio'],
        expandedQuery: query,
        searchTerms: query.split(/\s+/)
      };
    }
  }

  /**
   * Retrieve relevant chunks across all modalities
   */
  async retrieveMultimodalChunks(queryAnalysis, document, maxChunks) {
    try {
      console.log(`Retrieving multimodal chunks for document: ${document._id}`);
      
      const allChunks = [];
      
      // Search with original query
      const primaryResults = await advancedSearch(
        queryAnalysis.expandedQuery,
        this.config.collectionName,
        {
          documentId: document._id,
          topK: maxChunks,
          scoreThreshold: 0.05
        }
      );
      
      allChunks.push(...primaryResults.map(chunk => ({ ...chunk, searchType: 'primary' })));
      
      // Search with individual search terms for broader coverage
      for (const term of queryAnalysis.searchTerms.slice(0, 3)) {
        const termResults = await advancedSearch(
          term,
          this.config.collectionName,
          {
            documentId: document._id,
            topK: Math.ceil(maxChunks / 3),
            scoreThreshold: 0.03
          }
        );
        
        allChunks.push(...termResults.map(chunk => ({ ...chunk, searchType: 'term', searchTerm: term })));
      }
      
      // Modality-specific searches
      for (const modality of queryAnalysis.preferredModalities) {
        const modalityResults = await advancedSearch(
          `[${modality.toUpperCase()}] ${queryAnalysis.expandedQuery}`,
          this.config.collectionName,
          {
            documentId: document._id,
            topK: Math.ceil(maxChunks / 2),
            scoreThreshold: 0.04
          }
        );
        
        allChunks.push(...modalityResults.map(chunk => ({ 
          ...chunk, 
          searchType: 'modality', 
          targetModality: modality 
        })));
      }
      
      // Deduplicate and rank chunks
      const uniqueChunks = this.deduplicateChunks(allChunks);
      const rankedChunks = this.rankMultimodalChunks(uniqueChunks, queryAnalysis);
      
      console.log(`Retrieved ${rankedChunks.length} unique multimodal chunks`);
      return rankedChunks.slice(0, maxChunks);
    } catch (error) {
      console.error('Multimodal retrieval error:', error);
      return [];
    }
  }

  /**
   * Deduplicate chunks based on content and chunk index
   */
  deduplicateChunks(chunks) {
    const seen = new Set();
    return chunks.filter(chunk => {
      const key = `${chunk.chunkIndex}-${chunk.text.slice(0, 100)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Rank chunks considering modality preferences and relevance
   */
  rankMultimodalChunks(chunks, queryAnalysis) {
    return chunks
      .map(chunk => {
        let adjustedScore = chunk.score;
        
        // Apply modality weights
        const modality = this.extractModalityFromChunk(chunk);
        if (this.config.modalityWeights[modality]) {
          adjustedScore *= this.config.modalityWeights[modality];
        }
        
        // Boost preferred modalities
        if (queryAnalysis.preferredModalities.includes(modality)) {
          adjustedScore *= 1.2;
        }
        
        // Boost chunks with temporal references if query has them
        if (queryAnalysis.temporalReferences.length > 0 && chunk.metadata?.startTime) {
          adjustedScore *= 1.1;
        }
        
        // Boost primary search results
        if (chunk.searchType === 'primary') {
          adjustedScore *= 1.15;
        }
        
        return { ...chunk, adjustedScore };
      })
      .sort((a, b) => b.adjustedScore - a.adjustedScore);
  }

  /**
   * Extract modality from chunk metadata
   */
  extractModalityFromChunk(chunk) {
    // Try to get modality from metadata
    if (chunk.metadata?.modality) {
      return chunk.metadata.modality;
    }
    
    // Infer from chunk content
    if (chunk.text.startsWith('[IMAGE]')) return 'image';
    if (chunk.text.startsWith('[AUDIO]')) return 'audio';
    return 'text';
  }

  /**
   * Prepare multimodal context with proper formatting
   */
  async prepareMultimodalContext(chunks, queryAnalysis) {
    if (!chunks.length) {
      return '';
    }

    let context = '';
    let tokenCount = 0;
    const maxTokens = this.config.maxContextLength;
    
    // Group chunks by modality for better organization
    const groupedChunks = this.groupChunksByModality(chunks);
    
    // Add context for each modality
    for (const [modality, modalityChunks] of Object.entries(groupedChunks)) {
      if (tokenCount >= maxTokens) break;
      
      context += `\n=== ${modality.toUpperCase()} CONTENT ===\n`;
      
      for (const chunk of modalityChunks) {
        const chunkText = this.formatChunkForContext(chunk, modality);
        const estimatedTokens = chunkText.length / 4;
        
        if (tokenCount + estimatedTokens > maxTokens) {
          break;
        }
        
        context += chunkText + '\n\n';
        tokenCount += estimatedTokens;
      }
    }
    
    console.log(`Prepared multimodal context with ${tokenCount} estimated tokens`);
    return context.trim();
  }

  /**
   * Group chunks by modality
   */
  groupChunksByModality(chunks) {
    const grouped = {
      text: [],
      image: [],
      audio: []
    };
    
    chunks.forEach(chunk => {
      const modality = this.extractModalityFromChunk(chunk);
      if (grouped[modality]) {
        grouped[modality].push(chunk);
      }
    });
    
    return grouped;
  }

  /**
   * Format chunk for context based on modality
   */
  formatChunkForContext(chunk, modality) {
    let formatted = '';
    
    switch (modality) {
      case 'image':
        formatted = `[IMAGE DESCRIPTION] ${chunk.text}`;
        if (chunk.metadata?.width && chunk.metadata?.height) {
          formatted += ` [Dimensions: ${chunk.metadata.width}x${chunk.metadata.height}]`;
        }
        break;
        
      case 'audio':
        formatted = `[AUDIO TRANSCRIPT] ${chunk.text}`;
        if (chunk.metadata?.startTime && chunk.metadata?.endTime) {
          formatted += ` [Time: ${this.formatTime(chunk.metadata.startTime)} - ${this.formatTime(chunk.metadata.endTime)}]`;
        }
        break;
        
      default:
        formatted = chunk.text;
        if (chunk.pageNumber) {
          formatted = `[Page ${chunk.pageNumber}] ${formatted}`;
        }
    }
    
    return formatted;
  }

  /**
   * Generate contextual answer with multimodal awareness
   */
  async generateContextualAnswer(query, context, chatHistory, document) {
    try {
      const recentHistory = chatHistory
        .slice(-6)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const prompt = this.buildMultimodalPrompt(query, context, recentHistory, document);
      
      const result = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      
      const answer = result.text;

      return {
        answer: answer.trim(),
        tokensUsed: answer.length // Rough estimation
      };
    } catch (error) {
      console.error('Multimodal answer generation error:', error);
      throw error;
    }
  }

  /**
   * Build sophisticated multimodal prompt
   */
  buildMultimodalPrompt(query, context, chatHistory, document) {
    const hasContext = context && context.trim().length > 0;
    
    if (!hasContext) {
      return `You are an AI assistant specialized in analyzing multimodal documents (text, images, audio). 

The document "${document.originalName}" has been uploaded, but I'm unable to access its content properly for your query.

USER QUESTION: ${query}

CONVERSATION HISTORY:
${chatHistory}

Please explain that the content is not accessible and suggest ways to rephrase the query.`;
    }

    return `You are an AI assistant specialized in analyzing multimodal documents containing text, images, and audio content.

INSTRUCTIONS:
1. Answer the user's question based on the provided multimodal content
2. When referencing content, specify the modality (text, image, or audio)
3. For audio content, include timestamps when available
4. For image content, describe visual elements when relevant
5. Provide citations with modality indicators
6. If information spans multiple modalities, explain the connections
7. Use markdown formatting for better readability

MULTIMODAL CONTENT from "${document.originalName}":
${context}

CONVERSATION HISTORY:
${chatHistory}

USER QUESTION: ${query}

ANSWER:`;
  }

  /**
   * Format relevant chunks for response metadata
   */
  formatRelevantChunks(chunks) {
    return chunks.slice(0, 8).map(chunk => ({
      text: chunk.text.slice(0, 200) + '...',
      score: chunk.adjustedScore || chunk.score,
      modality: this.extractModalityFromChunk(chunk),
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      metadata: {
        type: chunk.metadata?.type,
        startTime: chunk.metadata?.startTime,
        endTime: chunk.metadata?.endTime,
        dimensions: chunk.metadata?.width && chunk.metadata?.height 
          ? `${chunk.metadata.width}x${chunk.metadata.height}` 
          : null
      }
    }));
  }

  /**
   * Get list of modalities used in response
   */
  getModalitiesUsed(chunks) {
    const modalities = new Set();
    chunks.forEach(chunk => {
      modalities.add(this.extractModalityFromChunk(chunk));
    });
    return Array.from(modalities);
  }

  /**
   * Extract cross-modal links from chunks
   */
  extractCrossModalLinks(chunks) {
    const links = [];
    
    chunks.forEach(chunk => {
      if (chunk.metadata?.crossModalLinks) {
        links.push(...chunk.metadata.crossModalLinks.map(link => ({
          chunkIndex: chunk.chunkIndex,
          modality: this.extractModalityFromChunk(chunk),
          ...link
        })));
      }
    });
    
    return links;
  }

  /**
   * Generate citations with modality information
   */
  generateCitations(chunks) {
    return chunks.slice(0, 10).map((chunk, index) => ({
      id: index + 1,
      modality: this.extractModalityFromChunk(chunk),
      text: chunk.text.slice(0, 150) + '...',
      source: {
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        timeRange: chunk.metadata?.startTime && chunk.metadata?.endTime
          ? `${this.formatTime(chunk.metadata.startTime)} - ${this.formatTime(chunk.metadata.endTime)}`
          : null,
        type: chunk.metadata?.type
      }
    }));
  }

  /**
   * Format time in MM:SS format
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Search across modalities with specific query
   */
  async searchAcrossModalities(query, documentId, options = {}) {
    try {
      const results = await advancedSearch(
        query,
        this.config.collectionName,
        {
          documentId,
          topK: options.limit || 20,
          scoreThreshold: options.threshold || 0.1
        }
      );

      return results.map(result => ({
        ...result,
        modality: this.extractModalityFromChunk(result),
        formattedContent: this.formatChunkForContext(result, this.extractModalityFromChunk(result))
      }));
    } catch (error) {
      console.error('Cross-modal search error:', error);
      return [];
    }
  }
}

export const multimodalRAGService = new MultimodalRAGService();
export default multimodalRAGService;