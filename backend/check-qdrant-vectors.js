import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { countVectors, getCollectionInfo } from './services/qdrantService.js';
import Document from './models/Document.js';

// Load environment variables
dotenv.config();

async function checkQdrantVectors() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find processed documents
    const documents = await Document.find({ processingStatus: 'completed' }).limit(5);
    
    if (documents.length === 0) {
      console.log('No processed documents found.');
      return;
    }

    console.log(`Checking vectors for ${documents.length} documents:`);
    console.log('===============================================');

    for (const doc of documents) {
      console.log(`\nDocument: ${doc.originalName}`);
      console.log(`Collection: ${doc.qdrantCollection}`);
      console.log(`MongoDB chunks: ${doc.chunks?.length || 0}`);
      
      try {
        const vectorCount = await countVectors(doc.qdrantCollection, doc._id);
        console.log(`Qdrant vectors: ${vectorCount}`);
        
        if (vectorCount === 0 && doc.chunks && doc.chunks.length > 0) {
          console.log('⚠️  Warning: Document has chunks in MongoDB but no vectors in Qdrant');
        } else if (vectorCount > 0) {
          console.log('✅ Document has vectors in Qdrant');
        }
      } catch (error) {
        console.log(`❌ Error checking vectors: ${error.message}`);
      }
    }

    // Check collection info
    try {
      const collectionName = process.env.QDRANT_COLLECTION_NAME || 'pdf_documents';
      const collectionInfo = await getCollectionInfo(collectionName);
      console.log(`\nCollection Info for ${collectionName}:`);
      console.log(`- Vectors count: ${collectionInfo.vectors_count}`);
      console.log(`- Indexed count: ${collectionInfo.indexed_vectors_count}`);
      console.log(`- Config: ${JSON.stringify(collectionInfo.config.params.vectors, null, 2)}`);
    } catch (error) {
      console.log(`❌ Error getting collection info: ${error.message}`);
    }

  } catch (error) {
    console.error('Error checking Qdrant vectors:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkQdrantVectors();
