import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Alchemyst AI Service - Advanced AI Engine Integration
 * Implements the Alchemyst AI platform for AskMyPDF with proper streaming support
 */
class AlchemystService {
  constructor() {
    this.baseURL = process.env.ALCHEMYST_API_URL || 'https://platform-backend.getalchemystai.com/api/v1';
    this.apiKey = process.env.ALCHEMYST_API_KEY;
    
    if (!this.apiKey) {
      console.warn('Alchemyst API key not found. Alchemyst service will be disabled.');
      this.enabled = false;
    } else {
      this.enabled = true;
      console.log('✅ Alchemyst AI service initialized');
    }

    // Alchemyst Configuration
    this.config = {
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 180000, // 3 minutes for complex queries
      retryAttempts: 3,
      retryDelay: 2000,
      persona: 'maya' // Alchemyst's default assistant persona
    };
  }

  /**
   * Check if Alchemyst service is available
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Generate response using Alchemyst AI streaming API
   * Following the exact format used in successful implementations
   */
  async generateResponse(messages, options = {}) {
    if (!this.enabled) {
      throw new Error('Alchemyst service is not enabled');
    }

    try {
      console.log('🚀 Generating response using Alchemyst AI');
      
      // Build the request data in the correct format
      const requestData = {
        chat_history: this.formatMessagesForAlchemyst(messages),
        persona: options.persona || this.config.persona
      };

      // Add optional parameters if provided
      if (options.chatId) requestData.chatId = options.chatId;
      if (options.scope) requestData.scope = options.scope;
      if (options.tools) requestData.tools = options.tools;

      const response = await axios.post(`${this.baseURL}/chat/generate/stream`, requestData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AskMyPDF-AlchemystIntegration/1.0'
        },
        timeout: this.config.timeout,
        responseType: 'stream'
      });

      return await this.processStreamingResponse(response);

    } catch (error) {
      console.error('Alchemyst response generation error:', error);
      throw error;
    }
  }

  /**
   * Process the streaming response from Alchemyst AI
   */
  async processStreamingResponse(response) {
    return new Promise((resolve, reject) => {
      let finalContent = '';
      let metadata = {};
      let thinkingSteps = [];
      let buffer = '';
      let resolved = false;

      response.data.on('data', (chunk) => {
        if (resolved) return;
        
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'thinking_update') {
                thinkingSteps.push(parsed.content);
              } else if (parsed.type === 'final_response') {
                finalContent = parsed.content;
              } else if (parsed.type === 'metadata') {
                metadata = parsed.content;
              }
            } catch (e) {
              // Ignore JSON parse errors for malformed chunks
            }
          }
        }
      });

      response.data.on('end', () => {
        if (resolved) return;
        resolved = true;

        if (!finalContent) {
          reject(new Error('No final response received from Alchemyst AI'));
          return;
        }

        const estimatedTokens = this.estimateTokens(finalContent);
        const actualTokens = metadata.tokens || estimatedTokens;

        resolve({
          content: finalContent,
          metadata: {
            tokens: actualTokens,
            cost: this.calculateCost(actualTokens),
            thinkingSteps: thinkingSteps,
            processingMetadata: metadata,
            aiEngine: 'alchemyst-ai'
          }
        });
      });

      response.data.on('error', (error) => {
        if (resolved) return;
        resolved = true;
        reject(error);
      });

      // Timeout handler
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Request timeout'));
        }
      }, this.config.timeout);
    });
  }

  /**
   * Generate contextual response for RAG pipeline
   */
  async generateContextualResponse(query, context, chatHistory = [], options = {}) {
    if (!this.enabled) {
      throw new Error('Alchemyst service is not enabled');
    }

    try {
      console.log('🔍 Generating contextual response using Alchemyst AI');

      // Build enhanced messages with context
      const messages = this.buildContextualMessages(query, context, chatHistory);
      
      const response = await this.generateResponse(messages, {
        persona: options.persona || this.config.persona,
        ...options
      });

      return {
        content: response.content,
        metadata: {
          ...response.metadata,
          contextUsed: context.length,
          chatHistoryLength: chatHistory.length,
          vectorDatabase: 'qdrant'
        }
      };

    } catch (error) {
      console.error('Alchemyst contextual response error:', error);
      throw error;
    }
  }

  /**
   * Generate follow-up questions using Alchemyst AI
   */
  async generateFollowUpQuestions(query, response, context) {
    if (!this.enabled) {
      return [];
    }

    try {
      const followUpPrompt = this.buildFollowUpPrompt(query, response, context);
      const messages = [{ role: 'user', content: followUpPrompt }];
      
      const result = await this.generateResponse(messages, {
        temperature: 0.8 // Higher temperature for creative question generation
      });

      return this.parseFollowUpQuestions(result.content);
    } catch (error) {
      console.error('Alchemyst follow-up generation error:', error);
      return [];
    }
  }

  /**
   * Evaluate response quality using Alchemyst AI
   */
  async evaluateResponse(query, response, groundTruth = null) {
    if (!this.enabled) {
      return null;
    }

    try {
      const evaluationPrompt = this.buildEvaluationPrompt(query, response, groundTruth);
      const messages = [{ role: 'user', content: evaluationPrompt }];
      
      const result = await this.generateResponse(messages, {
        temperature: 0.1 // Low temperature for consistent evaluation
      });

      return this.parseEvaluationResponse(result.content);
    } catch (error) {
      console.error('Alchemyst evaluation error:', error);
      return null;
    }
  }

  /**
   * Test connection to Alchemyst AI API
   */
  async testConnection() {
    if (!this.enabled) {
      return { success: false, error: 'Alchemyst service is disabled' };
    }

    try {
      const testMessages = [{ role: 'user', content: 'Hello, please respond with "Connection successful"' }];
      const response = await this.generateResponse(testMessages);
      
      return { 
        success: true, 
        response: response.content,
        metadata: response.metadata
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck() {
    try {
      const connectionTest = await this.testConnection();
      return {
        healthy: connectionTest.success,
        service: 'alchemyst-ai',
        endpoint: this.baseURL,
        timestamp: new Date(),
        details: connectionTest
      };
    } catch (error) {
      return {
        healthy: false,
        service: 'alchemyst-ai',
        endpoint: this.baseURL,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Helper methods for message formatting and processing
   */
  formatMessagesForAlchemyst(messages) {
    if (typeof messages === 'string') {
      return [{ role: 'user', content: messages }];
    }
    
    if (Array.isArray(messages)) {
      return messages.map(msg => ({
        role: msg.role || 'user',
        content: msg.content || msg
      }));
    }
    
    return [{ role: 'user', content: String(messages) }];
  }

  buildContextualMessages(query, context, chatHistory) {
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant specialized in analyzing and answering questions about documents. 
      Use the provided context to give accurate, helpful responses.

Context from document:
${context}

Instructions:
- Answer based primarily on the provided context
- If the context doesn't contain enough information, clearly state this
- Provide specific references to the document when possible
- Be concise but comprehensive in your responses`
    };

    const messages = [systemMessage];
    
    // Add relevant chat history (last 3 interactions)
    if (chatHistory && chatHistory.length > 0) {
      const recentHistory = chatHistory.slice(-6); // Last 3 Q&A pairs
      messages.push(...recentHistory);
    }

    // Add current query
    messages.push({ role: 'user', content: query });

    return messages;
  }

  buildFollowUpPrompt(query, response, context) {
    return `Based on this conversation about a document, generate 3 relevant follow-up questions that a user might want to ask:

Original Question: ${query}
AI Response: ${response}

Document Context: ${context.slice(0, 1000)}...

Generate 3 follow-up questions that:
1. Explore related topics in the document
2. Ask for clarification or more details
3. Connect to practical applications

Format as a JSON array of strings. Example: ["Question 1?", "Question 2?", "Question 3?"]`;
  }

  buildEvaluationPrompt(query, response, groundTruth) {
    let prompt = `Evaluate this AI response for accuracy, relevance, and helpfulness:

Question: ${query}
AI Response: ${response}`;

    if (groundTruth) {
      prompt += `\nExpected Answer: ${groundTruth}`;
    }

    prompt += `

Rate the response on a scale of 1-10 for:
1. Accuracy (factual correctness)
2. Relevance (how well it answers the question)
3. Clarity (how easy it is to understand)
4. Completeness (how thorough the answer is)

Provide scores and brief explanations in JSON format:
{
  "accuracy": 8,
  "relevance": 9,
  "clarity": 7,
  "completeness": 8,
  "overall": 8,
  "explanation": "Brief explanation of the evaluation"
}`;

    return prompt;
  }

  parseFollowUpQuestions(content) {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 3); // Limit to 3 questions
      }
    } catch (e) {
      // Fallback: extract questions from text
      const lines = content.split('\n');
      const questions = lines
        .filter(line => line.includes('?'))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 3);
      return questions;
    }
    return [];
  }

  parseEvaluationResponse(content) {
    try {
      const parsed = JSON.parse(content);
      return {
        accuracy: parsed.accuracy || 0,
        relevance: parsed.relevance || 0,
        clarity: parsed.clarity || 0,
        completeness: parsed.completeness || 0,
        overall: parsed.overall || 0,
        explanation: parsed.explanation || 'No explanation provided'
      };
    } catch (e) {
      // Fallback evaluation
      return {
        accuracy: 5,
        relevance: 5,
        clarity: 5,
        completeness: 5,
        overall: 5,
        explanation: 'Unable to parse evaluation response'
      };
    }
  }

  estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  calculateCost(tokens) {
    // Alchemyst AI token cost (adjust based on actual pricing)
    const tokenCost = 0.001; // $0.001 per token
    return tokens * tokenCost;
  }

  /**
   * Utility methods
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  shouldRetry(error) {
    // Retry on network errors, timeouts, and server errors
    return error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           (error.response && error.response.status >= 500);
  }
}

export default new AlchemystService();
