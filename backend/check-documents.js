import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Document from './models/Document.js';

// Load environment variables
dotenv.config();

async function checkDocuments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all documents
    const documents = await Document.find({}).select('originalName processingStatus chunks content metadata');
    
    if (documents.length === 0) {
      console.log('No documents found in database.');
      return;
    }

    console.log(`Found ${documents.length} documents:`);
    console.log('=====================================');

    documents.forEach((doc, index) => {
      console.log(`${index + 1}. Document: ${doc.originalName}`);
      console.log(`   Status: ${doc.processingStatus}`);
      console.log(`   Chunks: ${doc.chunks?.length || 0}`);
      console.log(`   Content Length: ${doc.content?.length || 0}`);
      console.log(`   Pages: ${doc.metadata?.pages || 'N/A'}`);
      console.log(`   Word Count: ${doc.metadata?.wordCount || 'N/A'}`);
      console.log(`   Chunking Strategy: ${doc.metadata?.chunkingStrategy || 'N/A'}`);
      console.log(`   Qdrant Collection: ${doc.qdrantCollection || 'N/A'}`);
      
      if (doc.chunks && doc.chunks.length > 0) {
        console.log(`   First chunk preview: ${doc.chunks[0].text?.substring(0, 100)}...`);
      }
      
      console.log('   ---');
    });

    // Check for problematic documents
    const problematicDocs = documents.filter(doc => 
      doc.processingStatus === 'completed' && 
      (!doc.chunks || doc.chunks.length === 0) && 
      (!doc.content || doc.content.length === 0)
    );

    if (problematicDocs.length > 0) {
      console.log('\n❌ Found problematic documents (completed but no content/chunks):');
      problematicDocs.forEach(doc => {
        console.log(`- ${doc.originalName} (${doc._id})`);
      });
    } else {
      console.log('\n✅ All processed documents appear to have content or chunks.');
    }

  } catch (error) {
    console.error('Error checking documents:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkDocuments();
