/**
 * Test script for Alchemyst AI integration
 * Run this to verify the service is working properly
 */
import alchemystService from './services/alchemystService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAlchemystIntegration() {
  console.log('🧪 Testing Alchemyst AI Integration');
  console.log('=====================================');

  // Test 1: Check if service is enabled
  console.log('\n1. Service Status:');
  console.log('- Enabled:', alchemystService.isEnabled());
  console.log('- API Key configured:', !!process.env.ALCHEMYST_API_KEY);

  if (!alchemystService.isEnabled()) {
    console.log('\n❌ Alchemyst service is not enabled');
    console.log('Please set ALCHEMYST_API_KEY in your .env file');
    return;
  }

  // Test 2: Health check
  console.log('\n2. Health Check:');
  try {
    const health = await alchemystService.healthCheck();
    console.log('- Status:', health.healthy ? '✅ Healthy' : '❌ Unhealthy');
    if (!health.healthy) {
      console.log('- Error:', health.error);
    }
  } catch (error) {
    console.log('- Health check failed:', error.message);
  }

  // Test 3: Connection test (only if API key is configured)
  if (process.env.ALCHEMYST_API_KEY && process.env.ALCHEMYST_API_KEY !== 'your_alchemyst_api_key_here') {
    console.log('\n3. Connection Test:');
    try {
      const connectionTest = await alchemystService.testConnection();
      console.log('- Connection:', connectionTest.success ? '✅ Success' : '❌ Failed');
      if (connectionTest.success) {
        console.log('- Response:', connectionTest.response.slice(0, 100) + '...');
        console.log('- Tokens used:', connectionTest.metadata?.tokens);
      } else {
        console.log('- Error:', connectionTest.error);
      }
    } catch (error) {
      console.log('- Connection test failed:', error.message);
    }
  } else {
    console.log('\n3. Connection Test: Skipped (API key not configured)');
  }

  // Test 4: Message formatting
  console.log('\n4. Message Formatting Test:');
  const testMessages = alchemystService.formatMessagesForAlchemyst('Test message');
  console.log('- Formatted messages:', JSON.stringify(testMessages, null, 2));

  console.log('\n🎉 Integration test completed!');
  console.log('\nNext steps:');
  console.log('1. Add your Alchemyst API key to .env file');
  console.log('2. Start your server to test the full RAG pipeline');
  console.log('3. The system will use Alchemyst as primary and Gemini as fallback');
}

// Run the test
testAlchemystIntegration().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
