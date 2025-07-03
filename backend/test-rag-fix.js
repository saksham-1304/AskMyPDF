import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ragService from './services/ragService.js';
import Document from './models/Document.js';

// Load environment variables
dotenv.config();

async function testRAGFix() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find a sample document
    const documents = await Document.find({ processingStatus: 'completed' }).limit(1);
    
    if (documents.length === 0) {
      console.log('No processed documents found. Please upload and process a document first.');
      return;
    }

    const document = documents[0];
    console.log(`Testing with document: ${document.originalName}`);
    console.log(`Document has ${document.chunks?.length || 0} chunks`);
    console.log(`Document content length: ${document.content?.length || 0}`);

    // Test RAG pipeline
    const query = "What is this document about?";
    console.log(`\nTesting query: "${query}"`);

    const response = await ragService.generateResponse(query, document, []);
    
    console.log('\n--- RAG Response ---');
    console.log('Content:', response.content);
    console.log('\nMetadata:');
    console.log('- Relevant chunks:', response.metadata.relevantChunks.length);
    console.log('- Processing time:', response.metadata.processingTime + 'ms');
    console.log('- Context length:', response.metadata.contextLength);
    console.log('- Retrieval score:', response.metadata.retrievalScore);

    // Test another query
    const query2 = "Tell me about the main topics in this document";
    console.log(`\nTesting query: "${query2}"`);

    const response2 = await ragService.generateResponse(query2, document, []);
    
    console.log('\n--- RAG Response 2 ---');
    console.log('Content:', response2.content);
    console.log('\nMetadata:');
    console.log('- Relevant chunks:', response2.metadata.relevantChunks.length);
    console.log('- Processing time:', response2.metadata.processingTime + 'ms');
    console.log('- Context length:', response2.metadata.contextLength);
    console.log('- Retrieval score:', response2.metadata.retrievalScore);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testRAGFix();
