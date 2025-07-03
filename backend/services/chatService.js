import { GoogleGenerativeAI } from '@google/generative-ai';
import { searchSimilarChunks } from './pineconeService.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateResponse = async (query, document, chatHistory) => {
  try {
    const startTime = Date.now();
    
    // Search for relevant chunks
    const relevantChunks = await searchSimilarChunks(
      query, 
      document.pineconeNamespace, 
      5
    );

    // Prepare context from relevant chunks
    const context = relevantChunks
      .map(chunk => `Page ${chunk.pageNumber}: ${chunk.text}`)
      .join('\n\n');

    // Prepare chat history for context
    const recentMessages = chatHistory.slice(-6).map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');

    // Generate response using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
You are a helpful AI assistant that answers questions based on the provided PDF document context. 
Use the following context to answer the user's question. If the answer is not in the context, say so politely.

Context from document:
${context}

Chat history:
${recentMessages}

User question: ${query}

Please provide a helpful and accurate answer based on the document content:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const processingTime = Date.now() - startTime;

    return {
      content: text,
      metadata: {
        relevantChunks: relevantChunks.map(chunk => ({
          text: chunk.text.slice(0, 200) + '...',
          score: chunk.score,
          pageNumber: chunk.pageNumber
        })),
        processingTime,
        tokensUsed: text.length // Approximate
      }
    };
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
};