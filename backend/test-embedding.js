import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmbeddingAPI() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    console.log('Testing Gemini Embedding API...');
    
    const result = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: 'What is the meaning of life?',
    });
    
    console.log('✅ Gemini Embedding API is working correctly!');
    console.log('Embedding dimensions:', result.embeddings[0].values.length);
    console.log('First few embedding values:', result.embeddings[0].values.slice(0, 5));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Gemini Embedding API test failed:', error.message);
    
    if (error.message.includes('API key not valid')) {
      console.error('\n🔑 Your Gemini API key appears to be invalid.');
      console.error('Please check your GEMINI_API_KEY in the .env file.');
      console.error('You can get a valid API key from: https://makersuite.google.com/app/apikey');
    }
    
    process.exit(1);
  }
}

testEmbeddingAPI();
