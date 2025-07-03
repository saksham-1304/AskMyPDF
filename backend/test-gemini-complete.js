import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testGeminiComplete() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    console.log('🚀 Testing Gemini AI Complete Integration...\n');
    
    // Test 1: Text Generation
    console.log('1️⃣ Testing Text Generation...');
    
    const textResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Explain how AI works in a few words',
    });
    
    console.log('✅ Text Generation successful!');
    console.log('Response:', textResponse.text);
    console.log('');
    
    // Test 2: Embedding
    console.log('2️⃣ Testing Embedding Generation...');
    
    const embeddingResult = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: 'What is the meaning of life?',
    });
    
    console.log('✅ Embedding Generation successful!');
    console.log('Embedding dimensions:', embeddingResult.embeddings[0].values.length);
    console.log('First few embedding values:', embeddingResult.embeddings[0].values.slice(0, 5));
    console.log('');
    
    console.log('🎉 All Gemini AI tests passed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Gemini AI test failed:', error.message);
    
    if (error.message.includes('API key not valid')) {
      console.error('\n🔑 Your Gemini API key appears to be invalid.');
      console.error('Please check your GEMINI_API_KEY in the .env file.');
      console.error('You can get a valid API key from: https://makersuite.google.com/app/apikey');
    } else if (error.message.includes('not found')) {
      console.error('\n🔍 The specified model was not found.');
      console.error('Please check if the model name is correct.');
    }
    
    console.error('\nFull error details:', error);
    process.exit(1);
  }
}

testGeminiComplete();
