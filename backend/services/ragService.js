import ai from './gemini.js';
import alchemystService from './alchemystService.js';
import { searchSimilarChunks, searchWithFilter, generateEmbeddings, advancedSearch } from './qdrantService.js';
import Document from '../models/Document.js';

/**
 * Enhanced RAG Pipeline Service with Qdrant Integration
 * Implements a complete Retrieval-Augmented Generation system
 */
class RAGService {
  constructor() {
    this.ai = ai;
    
    // RAG Configuration
    this.config = {
      maxContextLength: 4000,
      maxRetrievedChunks: 8,
      minRelevanceScore: 0.1, // Lowered from 0.3 to 0.1 for better recall
      chunkOverlap: 200,
      chunkSize: 1000,
      reranking: true,
      hybridSearch: true,
      collectionName: process.env.QDRANT_COLLECTION_NAME || 'pdf_documents'
    };
  }

  /**
   * Main RAG pipeline entry point
   */
  async generateResponse(query, document, chatHistory = [], options = {}) {
    try {
      const startTime = Date.now();
      
      // Step 1: Query preprocessing and expansion
      const processedQuery = await this.preprocessQuery(query, chatHistory);
      
      // Step 2: Retrieval phase with Qdrant
      const retrievedChunks = await this.retrieveRelevantChunks(
        processedQuery, 
        document, 
        options.maxChunks || this.config.maxRetrievedChunks
      );
      
      // Step 3: Context preparation and ranking
      const rankedContext = await this.prepareContext(retrievedChunks, processedQuery);
      
      // Step 4: Generation phase
      const response = await this.generateAnswer(
        processedQuery.original, 
        rankedContext, 
        chatHistory,
        document
      );
      
      const processingTime = Date.now() - startTime;
      
      return {
        content: response.answer,
        metadata: {
          relevantChunks: retrievedChunks.slice(0, 5).map(chunk => ({
            text: chunk.text.slice(0, 200) + '...',
            score: chunk.score,
            pageNumber: chunk.pageNumber,
            chunkIndex: chunk.chunkIndex,
            strategy: chunk.strategy
          })),
          processingTime,
          tokensUsed: response.tokensUsed,
          queryExpansion: processedQuery.expanded,
          contextLength: rankedContext.length,
          retrievalScore: this.calculateRetrievalScore(retrievedChunks),
          vectorDatabase: 'qdrant'
        }
      };
    } catch (error) {
      console.error('RAG pipeline error:', error);
      throw error;
    }
  }

  /**
   * Step 1: Query preprocessing and expansion
   */
  async preprocessQuery(query, chatHistory) {
    try {
      // Extract context from recent chat history
      const recentContext = chatHistory
        .slice(-4)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      // Generate query expansion using AI
      const expansionPrompt = `
Given the conversation context and user query, expand the query to include related terms and concepts that would help find relevant information.

Conversation context:
${recentContext}

User query: ${query}

Provide an expanded query that includes:
1. Synonyms and related terms
2. Context from the conversation
3. Potential sub-questions

Expanded query:`;

      const result = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: expansionPrompt,
      });
      const expandedQuery = result.text;

      return {
        original: query,
        expanded: expandedQuery.trim(),
        context: recentContext
      };
    } catch (error) {
      console.error('Query preprocessing error:', error);
      return {
        original: query,
        expanded: query,
        context: ''
      };
    }
  }

  /**
   * Step 2: Enhanced retrieval with hybrid search using Qdrant
   */
  async retrieveRelevantChunks(processedQuery, document, maxChunks) {
    try {
      console.log(`Retrieving chunks for document: ${document._id}, query: ${processedQuery.original}`);
      console.log(`Document has ${document.chunks?.length || 0} chunks and ${document.content?.length || 0} content length`);
      
      // Primary semantic search using Qdrant with document filter
      let semanticChunks = [];
      try {
        semanticChunks = await searchWithFilter(
          processedQuery.expanded,
          this.config.collectionName,
          document._id,
          maxChunks
        );
        console.log(`Semantic search returned ${semanticChunks.length} chunks`);
      } catch (error) {
        console.error('Semantic search error:', error);
      }

      // Advanced search with multiple strategies if available
      let advancedChunks = [];
      try {
        advancedChunks = await advancedSearch(
          processedQuery.original,
          this.config.collectionName,
          {
            documentId: document._id,
            topK: maxChunks,
            scoreThreshold: 0.05 // Even lower threshold for advanced search
          }
        );
        console.log(`Advanced search returned ${advancedChunks.length} chunks`);
      } catch (error) {
        console.error('Advanced search error:', error);
      }

      // Keyword-based search for hybrid approach (fallback to document chunks)
      let keywordChunks = [];
      if (document.chunks && document.chunks.length > 0) {
        keywordChunks = this.keywordSearch(
          processedQuery.original,
          document.chunks,
          maxChunks
        );
        console.log(`Keyword search returned ${keywordChunks.length} chunks`);
      }

      // Combine and deduplicate results
      const combinedChunks = this.combineSearchResults(
        semanticChunks,
        keywordChunks,
        advancedChunks,
        maxChunks
      );

      console.log(`Combined search returned ${combinedChunks.length} chunks`);

      // Filter by relevance threshold, but be more lenient
      let filteredChunks = combinedChunks.filter(chunk => 
        chunk.score >= this.config.minRelevanceScore
      );

      // Fallback: if no chunks meet threshold, use top chunks regardless of score
      if (filteredChunks.length === 0 && combinedChunks.length > 0) {
        console.log('No chunks met relevance threshold, using top chunks as fallback');
        filteredChunks = combinedChunks.slice(0, Math.min(maxChunks, 5));
      }

      // Additional fallback: if still no chunks, use any available chunks with lower threshold
      if (filteredChunks.length === 0) {
        filteredChunks = combinedChunks.filter(chunk => chunk.score >= 0.05);
        if (filteredChunks.length === 0) {
          filteredChunks = combinedChunks.slice(0, Math.min(maxChunks, 3));
        }
      }

      // Final fallback: use document chunks directly if available
      if (filteredChunks.length === 0 && document.chunks && document.chunks.length > 0) {
        console.log('Using document chunks as final fallback');
        filteredChunks = document.chunks.slice(0, Math.min(maxChunks, 5)).map((chunk, index) => ({
          text: chunk.text,
          score: 0.5, // Default score
          pageNumber: chunk.metadata?.pageNumber || Math.floor(index / 5) + 1,
          chunkIndex: index,
          strategy: chunk.metadata?.strategy || 'fallback',
          source: 'document'
        }));
      }

      console.log(`Final result: ${filteredChunks.length} chunks for retrieval`);
      return filteredChunks;
    } catch (error) {
      console.error('Retrieval error:', error);
      // Ultimate fallback: use document chunks if available
      if (document.chunks && document.chunks.length > 0) {
        console.log('Using document chunks as error fallback');
        return document.chunks.slice(0, Math.min(maxChunks, 5)).map((chunk, index) => ({
          text: chunk.text,
          score: 0.5,
          pageNumber: chunk.metadata?.pageNumber || Math.floor(index / 5) + 1,
          chunkIndex: index,
          strategy: chunk.metadata?.strategy || 'fallback',
          source: 'document'
        }));
      }
      
      // If no chunks available, at least try to use some document content
      if (document.content) {
        console.log('Using document content as final fallback');
        const contentChunks = document.content.match(/.{1,1000}/g) || [];
        return contentChunks.slice(0, Math.min(maxChunks, 3)).map((chunk, index) => ({
          text: chunk,
          score: 0.3,
          pageNumber: Math.floor(index / 5) + 1,
          chunkIndex: index,
          strategy: 'content-fallback',
          source: 'document-content'
        }));
      }
      
      return [];
    }
  }

  /**
   * Keyword-based search for hybrid retrieval
   */
  keywordSearch(query, chunks, maxResults) {
    const queryTerms = query.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2);

    const scoredChunks = chunks.map((chunk, index) => {
      const chunkText = chunk.text.toLowerCase();
      let score = 0;

      // Calculate TF-IDF-like score
      queryTerms.forEach(term => {
        const termFreq = (chunkText.match(new RegExp(term, 'g')) || []).length;
        if (termFreq > 0) {
          score += termFreq * Math.log(chunks.length / (chunks.filter(c => 
            c.text.toLowerCase().includes(term)
          ).length + 1));
        }
      });

      return {
        text: chunk.text,
        score: score / queryTerms.length,
        pageNumber: chunk.metadata?.pageNumber || Math.floor(index / 5) + 1,
        chunkIndex: index,
        source: 'keyword',
        strategy: chunk.metadata?.strategy || 'unknown'
      };
    });

    return scoredChunks
      .filter(chunk => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Combine semantic, advanced, and keyword search results
   */
  combineSearchResults(semanticChunks, keywordChunks, advancedChunks = [], maxResults) {
    const combined = new Map();

    // Add semantic results with higher weight
    semanticChunks.forEach(chunk => {
      const key = `${chunk.chunkIndex}-${chunk.pageNumber}`;
      combined.set(key, {
        ...chunk,
        score: chunk.score * 0.6, // Weight semantic search
        source: 'semantic'
      });
    });

    // Add advanced search results
    advancedChunks.forEach(chunk => {
      const key = `${chunk.chunkIndex}-${chunk.pageNumber}`;
      if (combined.has(key)) {
        const existing = combined.get(key);
        existing.score = (existing.score + chunk.score * 0.7) / 2;
        existing.source = 'hybrid';
      } else {
        combined.set(key, {
          ...chunk,
          score: chunk.score * 0.7,
          source: 'advanced'
        });
      }
    });

    // Add keyword results, boosting score if already exists
    keywordChunks.forEach(chunk => {
      const key = `${chunk.chunkIndex}-${chunk.pageNumber}`;
      if (combined.has(key)) {
        const existing = combined.get(key);
        existing.score = (existing.score + chunk.score * 0.3) / 2;
        existing.source = 'hybrid';
      } else {
        combined.set(key, {
          ...chunk,
          score: chunk.score * 0.3,
          source: 'keyword'
        });
      }
    });

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Step 3: Context preparation and ranking
   */
  async prepareContext(retrievedChunks, processedQuery) {
    console.log(`Preparing context with ${retrievedChunks.length} chunks`);
    
    if (!retrievedChunks.length) {
      console.log('No chunks retrieved, returning empty context');
      return '';
    }

    // Log chunk details for debugging
    retrievedChunks.forEach((chunk, index) => {
      console.log(`Chunk ${index}: score=${chunk.score}, source=${chunk.source}, strategy=${chunk.strategy}`);
    });

    // Re-rank chunks based on query relevance
    const rerankedChunks = this.config.reranking 
      ? await this.rerankChunks(retrievedChunks, processedQuery.original)
      : retrievedChunks;

    // Build context with token limit consideration
    let context = '';
    let tokenCount = 0;
    const maxTokens = this.config.maxContextLength;

    for (const chunk of rerankedChunks) {
      const chunkText = `[Page ${chunk.pageNumber}] ${chunk.text}\n\n`;
      const estimatedTokens = chunkText.length / 4; // Rough token estimation

      if (tokenCount + estimatedTokens > maxTokens) {
        break;
      }

      context += chunkText;
      tokenCount += estimatedTokens;
    }

    console.log(`Context prepared with ${tokenCount} estimated tokens from ${rerankedChunks.length} chunks`);
    return context.trim();
  }

  /**
   * Re-rank chunks using cross-encoder approach
   */
  async rerankChunks(chunks, query) {
    try {
      // Simple re-ranking based on query-chunk similarity
      const rerankedChunks = [];

      for (const chunk of chunks) {
        const relevancePrompt = `
Rate the relevance of this text chunk to the query on a scale of 0-1:

Query: ${query}

Text chunk: ${chunk.text.slice(0, 500)}

Relevance score (0-1):`;

        try {
          const result = await this.ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: relevancePrompt,
          });
          const scoreText = result.text;
          const relevanceScore = parseFloat(scoreText.match(/[\d.]+/)?.[0] || chunk.score);
          
          rerankedChunks.push({
            ...chunk,
            rerankScore: relevanceScore,
            finalScore: (chunk.score + relevanceScore) / 2
          });
        } catch (error) {
          // Fallback to original score
          rerankedChunks.push({
            ...chunk,
            rerankScore: chunk.score,
            finalScore: chunk.score
          });
        }
      }

      return rerankedChunks.sort((a, b) => b.finalScore - a.finalScore);
    } catch (error) {
      console.error('Re-ranking error:', error);
      return chunks;
    }
  }

  /**
   * Step 4: Answer generation with enhanced prompting
   */
  async generateAnswer(query, context, chatHistory, document) {
    try {
      const recentHistory = chatHistory
        .slice(-6)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const prompt = this.buildGenerationPrompt(query, context, recentHistory, document);
      
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
      console.error('Answer generation error:', error);
      throw error;
    }
  }

  /**
   * Build sophisticated generation prompt
   */
  buildGenerationPrompt(query, context, chatHistory, document) {
    const hasContext = context && context.trim().length > 0;
    
    if (!hasContext) {
      // If no context from vector search, try to use document content directly
      let documentContent = '';
      if (document.content) {
        documentContent = document.content.slice(0, 3000); // Use first 3000 chars as fallback
      } else if (document.chunks && document.chunks.length > 0) {
        documentContent = document.chunks.slice(0, 3).map(chunk => chunk.text).join('\n\n');
      }
      
      if (documentContent) {
        return `You are an AI assistant specialized in analyzing and answering questions about documents. 

The vector search didn't find specific relevant sections, but here's content from the document "${document.originalName}":

DOCUMENT CONTENT:
${documentContent}

INSTRUCTIONS:
1. Answer the user's question based on the document content provided above
2. If the answer isn't in the content, clearly state that the specific information is not available in the provided content
3. Be helpful and provide any related information that might be useful
4. Suggest specific ways the user could rephrase their question

USER QUESTION: ${query}

CONVERSATION HISTORY:
${chatHistory}

ANSWER:`;
      } else {
        return `You are an AI assistant specialized in analyzing and answering questions about documents. 

IMPORTANT: The document "${document.originalName}" has been uploaded, but I'm unable to access its content properly. This could be due to:
1. Technical issues with the document processing system
2. The document not being fully processed yet
3. Issues with the vector search system

Please try:
1. Rephrasing your question with different keywords
2. Asking about a different aspect of the document
3. Checking if the document finished processing

USER QUESTION: ${query}

CONVERSATION HISTORY:
${chatHistory}

ANSWER:`;
      }
    }

    return `You are an AI assistant specialized in analyzing and answering questions about documents. You have access to relevant excerpts from "${document.originalName}" retrieved using Qdrant vector database.

INSTRUCTIONS:
1. Answer the user's question based ONLY on the provided context
2. If the answer isn't in the context, clearly state that the information is not available in the provided excerpts
3. Cite specific page numbers when referencing information
4. Provide comprehensive but concise answers
5. Maintain conversation continuity with the chat history
6. Use markdown formatting for better readability

DOCUMENT CONTEXT (Retrieved via Qdrant Vector Search):
${context}

CONVERSATION HISTORY:
${chatHistory}

USER QUESTION: ${query}

ANSWER:`;
  }

  /**
   * Calculate retrieval quality score
   */
  calculateRetrievalScore(chunks) {
    if (!chunks.length) return 0;
    
    const avgScore = chunks.reduce((sum, chunk) => sum + chunk.score, 0) / chunks.length;
    const coverage = Math.min(chunks.length / this.config.maxRetrievedChunks, 1);
    
    return (avgScore * 0.7 + coverage * 0.3);
  }

  /**
   * Generate follow-up questions based on context
   */
  async generateFollowUpQuestions(query, response, document) {
    try {
      const prompt = `
Based on the user's question and the AI response about "${document.originalName}", generate 3 relevant follow-up questions that would help the user explore the document further.

User Question: ${query}
AI Response: ${response}

Generate 3 follow-up questions:`;

      const result = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      const questions = result.text;
      
      return questions.split('\n')
        .filter(q => q.trim().length > 0)
        .map(q => q.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 3);
    } catch (error) {
      console.error('Follow-up generation error:', error);
      return [];
    }
  }

  /**
   * Evaluate RAG pipeline performance
   */
  async evaluateResponse(query, generatedAnswer, groundTruth = null) {
    try {
      const evaluationPrompt = `
Evaluate the quality of this AI-generated answer using Qdrant vector database:

Query: ${query}
Generated Answer: ${generatedAnswer}

Rate the answer on these criteria (0-10 scale):
1. Relevance: How well does it answer the question?
2. Accuracy: Is the information correct based on the context?
3. Completeness: Does it fully address the query?
4. Clarity: Is it well-written and understandable?

Provide scores and brief explanations:`;

      const result = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: evaluationPrompt,
      });
      const evaluation = result.text;

      return {
        evaluation,
        timestamp: new Date().toISOString(),
        vectorDatabase: 'qdrant'
      };
    } catch (error) {
      console.error('Evaluation error:', error);
      return null;
    }
  }

  /**
   * Enhanced RAG pipeline using Alchemyst AI with Context Lake
   * Provides advanced dynamic workflow planning and context processing
   */
  async generateResponseWithAlchemyst(query, document, chatHistory = [], options = {}) {
    try {
      const startTime = Date.now();
      
      // Step 1: Enhanced query preprocessing with Alchemyst AI
      console.log('Processing query with Alchemyst AI dynamic workflow planning');
      
      // Step 2: Hybrid retrieval using both Qdrant and Alchemyst Context Lake
      const retrievedChunks = await this.retrieveRelevantChunks(
        { original: query, expanded: query }, 
        document, 
        options.maxChunks || this.config.maxRetrievedChunks
      );
      
      // Step 3: Build rich context for Alchemyst AI
      const contextText = retrievedChunks
        .map(chunk => `[Page ${chunk.pageNumber}] ${chunk.text}`)
        .join('\n\n');
      
      // Step 4: Generate response using Alchemyst AI with Context Lake
      const alchemystResponse = await alchemystService.generateContextualResponse(
        query,
        contextText,
        chatHistory,
        {
          ...options,
          responseStyle: 'comprehensive',
          domain: 'document-qa',
          contextPathways: true,
          workflowOptimization: 'rag'
        }
      );
      
      const processingTime = Date.now() - startTime;
      
      return {
        content: alchemystResponse.content,
        metadata: {
          relevantChunks: retrievedChunks.slice(0, 5).map(chunk => ({
            text: chunk.text.slice(0, 200) + '...',
            score: chunk.score,
            pageNumber: chunk.pageNumber,
            chunkIndex: chunk.chunkIndex,
            strategy: chunk.strategy
          })),
          processingTime,
          tokensUsed: alchemystResponse.metadata?.usage?.total_tokens || 0,
          contextLength: contextText.length,
          retrievalScore: this.calculateRetrievalScore(retrievedChunks),
          vectorDatabase: 'qdrant',
          aiEngine: 'alchemyst-ai',
          contextPathways: alchemystResponse.metadata?.contextPathways,
          workflowSteps: alchemystResponse.metadata?.workflowSteps,
          dynamicWorkflow: true
        }
      };
    } catch (error) {
      console.error('Alchemyst RAG pipeline error:', error);
      throw error;
    }
  }

  /**
   * Get AI engine health status for monitoring
   */
  async getEngineStatus() {
    const status = {
      gemini: { status: 'unknown', lastChecked: null },
      alchemyst: { status: 'unknown', lastChecked: null },
      qdrant: { status: 'unknown', lastChecked: null }
    };

    try {
      // Check Alchemyst AI
      if (alchemystService.isEnabled()) {
        const alchemystHealth = await alchemystService.healthCheck();
        status.alchemyst = {
          status: alchemystHealth.status,
          lastChecked: new Date().toISOString(),
          details: alchemystHealth
        };
      } else {
        status.alchemyst = {
          status: 'disabled',
          lastChecked: new Date().toISOString(),
          reason: 'API key not configured'
        };
      }

      // Check Gemini AI (basic test)
      try {
        await this.ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: 'test'
        });
        status.gemini = {
          status: 'healthy',
          lastChecked: new Date().toISOString()
        };
      } catch (geminiError) {
        status.gemini = {
          status: 'unhealthy',
          lastChecked: new Date().toISOString(),
          error: geminiError.message
        };
      }

      // Qdrant status would be checked via qdrantService
      status.qdrant = {
        status: 'assumed-healthy',
        lastChecked: new Date().toISOString(),
        note: 'Qdrant health check not implemented in this context'
      };

    } catch (error) {
      console.error('Engine status check error:', error);
    }

    return status;
  }
}

// Export singleton instance
export const ragService = new RAGService();
export default ragService;