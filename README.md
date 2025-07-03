# PDF Chat Application with Qdrant Vector Database

A full-stack MERN application that allows users to upload PDF documents and have AI-powered conversations with them using Google Gemini AI and **Qdrant vector database** for enhanced semantic search.

## Features

- **User Authentication**: Secure registration and login system
- **PDF Upload & Processing**: Upload PDFs up to 25MB with automatic text extraction
- **AI-Powered Chat**: Chat with your documents using Google Gemini AI
- **Qdrant Vector Search**: High-performance vector similarity search using Qdrant
- **Advanced RAG Pipeline**: Enhanced Retrieval-Augmented Generation with multiple chunking strategies
- **Real-time Processing**: Live progress tracking for document processing
- **Responsive Design**: Modern, mobile-friendly interface
- **Usage Tracking**: Monitor document and message limits

## Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **Google Gemini AI** for chat responses and embeddings
- **Qdrant** for vector storage and similarity search
- **JWT** for authentication
- **Multer** for file uploads
- **PDF-Parse** for text extraction

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **React Query** for state management
- **Axios** for API calls
- **React Dropzone** for file uploads
- **React Markdown** for message rendering

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or cloud)
- Qdrant (local or cloud)
- Google Gemini API key

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pdf-chat-app
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Environment Configuration**
   
   **Backend** - Copy `backend/.env.example` to `backend/.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5000
   MONGODB_URI=mongodb://localhost:27017/pdfchat
   JWT_SECRET=your-super-secret-jwt-key-here
   GEMINI_API_KEY=your-gemini-api-key-here
   QDRANT_URL=http://localhost:6333
   QDRANT_API_KEY=your-qdrant-api-key-here
   QDRANT_COLLECTION_NAME=pdf_documents
   ```

   **Frontend** - Copy `frontend/.env.example` to `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Setup Qdrant Vector Database**
   
   **Option 1: Local Qdrant (Docker)**
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```
   
   **Option 2: Qdrant Cloud**
   - Sign up at [Qdrant Cloud](https://cloud.qdrant.io/)
   - Create a cluster and get your URL and API key
   - Update `QDRANT_URL` and `QDRANT_API_KEY` in your `.env`

5. **Build and Start the Application**
   ```bash
   npm run build
   npm start
   ```

   The application will be available at `http://localhost:5000`

### Your Exact Commands

```bash
# Install dependencies for both backend and frontend
npm install --prefix backend && npm install --prefix frontend

# Build frontend and place it in backend/public
npm run build:full --prefix backend

# Start the combined server
npm run start --prefix backend
```

Or using the root package.json scripts:

```bash
# Install all dependencies
npm run install:all

# Build the application
npm run build

# Start the application
npm start
```

## Qdrant Integration Features

### 🚀 **Enhanced Vector Search**
- **High Performance**: Qdrant's optimized vector search engine
- **Flexible Filtering**: Advanced filtering by document, page, strategy, language
- **Batch Operations**: Efficient bulk vector operations
- **Real-time Updates**: Dynamic vector management

### 🔍 **Advanced RAG Pipeline**
```javascript
// Hybrid search combining semantic + keyword + advanced filtering
const results = await advancedSearch(query, collection, {
  documentId: document._id,
  pageNumbers: [1, 2, 3],
  strategies: ['semantic', 'hybrid'],
  languages: ['en'],
  topK: 10,
  scoreThreshold: 0.7
});
```

### 📊 **Vector Analytics**
- Collection statistics and health monitoring
- Vector count per document
- Performance metrics and search quality scores

## API Setup Requirements

### Google Gemini AI
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file as `GEMINI_API_KEY`

### Qdrant Setup Options

#### **Option 1: Local Qdrant (Recommended for Development)**
```bash
# Using Docker
docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant

# Using Docker Compose
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - ./qdrant_storage:/qdrant/storage
```

#### **Option 2: Qdrant Cloud (Recommended for Production)**
1. Sign up at [Qdrant Cloud](https://cloud.qdrant.io/)
2. Create a new cluster
3. Get your cluster URL and API key
4. Update your `.env` file:
   ```env
   QDRANT_URL=https://your-cluster-url.qdrant.tech:6333
   QDRANT_API_KEY=your-qdrant-cloud-api-key
   ```

### MongoDB
- **Local**: Install MongoDB locally or use MongoDB Compass
- **Cloud**: Use MongoDB Atlas for a cloud database
- Update `MONGODB_URI` in your `.env` file

## Enhanced RAG Pipeline Features

### **1. Multiple Chunking Strategies**
- **Sentence-based**: Preserves sentence boundaries
- **Paragraph-based**: Maintains paragraph structure  
- **Semantic**: Groups content by topics/themes
- **Hybrid**: Combines multiple approaches for optimal results

### **2. Advanced Retrieval**
```javascript
// Semantic search with Qdrant
const semanticResults = await searchWithFilter(query, collection, documentId);

// Advanced search with multiple filters
const advancedResults = await advancedSearch(query, collection, {
  documentId: document._id,
  pageNumbers: [1, 2, 3],
  strategies: ['semantic', 'hybrid'],
  scoreThreshold: 0.7
});
```

### **3. Enhanced Generation**
- Context-aware prompting with conversation history
- Automatic citation with page numbers
- Markdown formatting for rich responses
- Quality evaluation and feedback system

## New API Endpoints

### **Vector Search**
```bash
POST /api/chat/:chatId/search
{
  "query": "search term",
  "options": {
    "limit": 10,
    "threshold": 0.7,
    "pageNumbers": [1, 2, 3]
  }
}
```

### **Vector Analytics**
```bash
GET /api/pdf/documents/:id/vector-info
```

### **Document Analytics**
```bash
GET /api/pdf/documents/:id/analytics
```

## Project Structure

```
pdf-chat-app/
├── package.json            # Root package.json with main scripts
├── backend/
│   ├── services/
│   │   ├── qdrantService.js     # Qdrant vector database operations
│   │   ├── ragService.js        # Enhanced RAG pipeline
│   │   ├── documentProcessor.js # Advanced document processing
│   │   └── chatService.js       # Chat interface
│   ├── models/
│   │   └── Document.js          # Updated with Qdrant fields
│   ├── routes/              # API endpoints with Qdrant integration
│   └── server.js           # Express server
├── frontend/               # React frontend (unchanged)
└── README.md
```

## Migration Benefits

### **Why Qdrant over Pinecone?**

1. **🆓 Open Source**: No vendor lock-in, full control
2. **⚡ Performance**: Optimized for high-throughput vector operations
3. **🔧 Flexibility**: Advanced filtering and search capabilities
4. **💰 Cost-Effective**: Self-hosted option available
5. **🛠️ Developer-Friendly**: Excellent documentation and tooling
6. **🔍 Advanced Features**: Rich filtering, batch operations, real-time updates

### **Performance Improvements**
- Faster vector search with optimized indexing
- Better memory management for large document collections
- Advanced filtering reduces irrelevant results
- Batch operations improve processing speed

## Usage

1. **Register/Login**: Create an account or sign in
2. **Upload PDF**: Drag and drop or select a PDF file (max 25MB)
3. **Choose Strategy**: Select chunking strategy (hybrid recommended)
4. **Wait for Processing**: The system extracts text and generates embeddings
5. **Start Chatting**: Ask questions about your document
6. **View Sources**: See which parts of the document were used for answers
7. **Advanced Search**: Use the search endpoint for specific queries

## Development Mode

For development with hot reload:

```bash
# Option 1: Run both frontend and backend in development mode
npm run dev

# Option 2: Run them separately
npm run dev:backend    # Backend with nodemon
npm run dev:frontend   # Frontend with Vite dev server
```

## Deployment

The application is configured to serve the frontend from the backend server:

1. **Build the frontend**: `npm run build`
2. **Start the server**: `npm start`
3. **Access the app**: Visit `http://localhost:5000`

For production deployment:
- Set `NODE_ENV=production`
- Use a process manager like PM2
- Configure reverse proxy (nginx)
- Set up SSL certificates
- Use Qdrant Cloud for production vector database

## Troubleshooting

### Common Issues

1. **Qdrant connection issues**: 
   - Ensure Qdrant is running on the correct port
   - Check QDRANT_URL and QDRANT_API_KEY in .env
   - Verify network connectivity

2. **Vector search not working**: 
   - Check if documents are properly processed
   - Verify embeddings are generated correctly
   - Ensure collection exists in Qdrant

3. **Performance issues**: 
   - Monitor Qdrant memory usage
   - Consider adjusting batch sizes
   - Use appropriate filtering to reduce search space

### Clean Installation
If you encounter issues, try a clean installation:
```bash
npm run clean
npm run install:all
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with Qdrant
5. Submit a pull request

## License

This project is licensed under the MIT License.

---

**🎉 Successfully migrated from Pinecone to Qdrant!** 

The application now uses Qdrant's powerful vector database for enhanced performance, flexibility, and cost-effectiveness while maintaining all existing functionality.