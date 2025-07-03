import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testGeminiAPI() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    console.log('Testing Gemini API connection...');
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Hello, this is a test. Please respond with "API is working correctly".',
    });
    
    console.log('✅ Gemini API is working correctly!');
    console.log('Response:', response.text);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Gemini API test failed:', error.message);
    
    if (error.message.includes('API key not valid')) {
      console.error('\n🔑 Your Gemini API key appears to be invalid.');
      console.error('Please check your GEMINI_API_KEY in the .env file.');
      console.error('You can get a valid API key from: https://makersuite.google.com/app/apikey');
    }
    
    process.exit(1);
  }
}

testGeminiAPI();
