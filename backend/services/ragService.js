import { GoogleGenerativeAI } from '@google/generative-ai';
import { searchSimilarChunks, generateEmbeddings } from './pineconeService.js';
import Document from '../models/Document.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Enhanced RAG Pipeline Service
 * Implements a complete Retrieval-Augmented Generation system
 */
class RAGService {
  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' });
    
    // RAG Configuration
    this.config = {
      maxContextLength: 4000,
      maxRetrievedChunks: 8,
      minRelevanceScore: 0.7,
      chunkOverlap: 200,
      chunkSize: 1000,
      reranking: true,
      hybridSearch: true
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
      
      // Step 2: Retrieval phase
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
            chunkIndex: chunk.chunkIndex
          })),
          processingTime,
          tokensUsed: response.tokensUsed,
          queryExpansion: processedQuery.expanded,
          contextLength: rankedContext.length,
          retrievalScore: this.calculateRetrievalScore(retrievedChunks)
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

      const result = await this.model.generateContent(expansionPrompt);
      const expandedQuery = await result.response.text();

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
   * Step 2: Enhanced retrieval with hybrid search
   */
  async retrieveRelevantChunks(processedQuery, document, maxChunks) {
    try {
      // Semantic search using embeddings
      const semanticChunks = await searchSimilarChunks(
        processedQuery.expanded,
        document.pineconeNamespace,
        maxChunks
      );

      // Keyword-based search for hybrid approach
      const keywordChunks = this.keywordSearch(
        processedQuery.original,
        document.chunks,
        maxChunks
      );

      // Combine and deduplicate results
      const combinedChunks = this.combineSearchResults(
        semanticChunks,
        keywordChunks,
        maxChunks
      );

      // Filter by relevance threshold
      return combinedChunks.filter(chunk => 
        chunk.score >= this.config.minRelevanceScore
      );
    } catch (error) {
      console.error('Retrieval error:', error);
      // Fallback to basic search
      return await searchSimilarChunks(
        processedQuery.original,
        document.pineconeNamespace,
        maxChunks
      );
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
        source: 'keyword'
      };
    });

    return scoredChunks
      .filter(chunk => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Combine semantic and keyword search results
   */
  combineSearchResults(semanticChunks, keywordChunks, maxResults) {
    const combined = new Map();

    // Add semantic results with higher weight
    semanticChunks.forEach(chunk => {
      const key = `${chunk.chunkIndex}-${chunk.pageNumber}`;
      combined.set(key, {
        ...chunk,
        score: chunk.score * 0.7, // Weight semantic search higher
        source: 'semantic'
      });
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
    if (!retrievedChunks.length) return '';

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
          const result = await this.model.generateContent(relevancePrompt);
          const scoreText = await result.response.text();
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
      
      const result = await this.model.generateContent(prompt);
      const answer = await result.response.text();

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
    return `You are an AI assistant specialized in analyzing and answering questions about documents. You have access to relevant excerpts from "${document.originalName}".

INSTRUCTIONS:
1. Answer the user's question based ONLY on the provided context
2. If the answer isn't in the context, clearly state that the information is not available
3. Cite specific page numbers when referencing information
4. Provide comprehensive but concise answers
5. Maintain conversation continuity with the chat history
6. Use markdown formatting for better readability

DOCUMENT CONTEXT:
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
   * Evaluate RAG pipeline performance
   */
  async evaluateResponse(query, generatedAnswer, groundTruth = null) {
    try {
      const evaluationPrompt = `
Evaluate the quality of this AI-generated answer:

Query: ${query}
Generated Answer: ${generatedAnswer}

Rate the answer on these criteria (0-10 scale):
1. Relevance: How well does it answer the question?
2. Accuracy: Is the information correct based on the context?
3. Completeness: Does it fully address the query?
4. Clarity: Is it well-written and understandable?

Provide scores and brief explanations:`;

      const result = await this.model.generateContent(evaluationPrompt);
      const evaluation = await result.response.text();

      return {
        evaluation,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Evaluation error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const ragService = new RAGService();
export default ragService;