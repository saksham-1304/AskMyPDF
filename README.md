# 🤖 AskMyPDF - AI-Powered PDF Chat Application

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-green.svg)](https://mongodb.com/)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-orange.svg)](https://qdrant.tech/)
[![Alchemyst AI](https://img.shields.io/badge/Alchemyst%20AI-Primary%20Engine-purple.svg)](https://alchemyst.ai/)
[![Gemini AI](https://img.shields.io/badge/Gemini%20AI-Fallback-blue.svg)](https://gemini.google.com/)
[![Framer Motion](https://img.shields.io/badge/Framer%20Motion-Animations-ff69b4.svg)](https://www.framer.com/motion/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3+-teal.svg)](https://tailwindcss.com/)

> 🚀 **A cutting-edge full-stack MERN application with TypeScript that revolutionizes PDF interaction through intelligent conversations. Features an advanced dual AI engine architecture (Alchemyst AI with dynamic workflow planning + Google Gemini fallback), sophisticated RAG pipeline, Qdrant vector database, and a stunning glassmorphism UI with real-time streaming responses.**

## 🌟 Features

### 📄 **Advanced Document Processing**
- **Multi-format Support**: PDF document processing with enhanced text extraction
- **Intelligent Chunking**: Multiple strategies (sentence, paragraph, semantic, hybrid)
- **Vector Embeddings**: Google Gemini text-embedding-004 for semantic search
- **Progress Tracking**: Real-time document processing with status updates
- **Metadata Extraction**: Comprehensive document analysis including page count, word count
- **Language Detection**: Automatic text language identification

### 🧠 **Dual AI Engine Architecture with Advanced RAG**
- **Primary Engine**: Alchemyst AI with dynamic workflow planning and Context Lake integration
- **Fallback Engine**: Google Gemini 2.0 Flash for maximum reliability
- **Intelligent Switching**: Automatic failover with real-time health monitoring
- **Advanced RAG Pipeline**: Enhanced Retrieval-Augmented Generation system
- **Query Expansion**: AI-powered query enhancement for better retrieval
- **Context-Aware Responses**: Maintains conversation history and document context
- **Streaming Responses**: Real-time token streaming for instant feedback
- **Engine Status Monitoring**: Live tracking via `/api/chat/engine-status` endpoint

### 🔍 **Enhanced Vector Search & Database**
- **Qdrant Integration**: High-performance vector database with collection management
- **Hybrid Search**: Semantic + keyword search with advanced filtering
- **Batch Operations**: Efficient bulk vector operations
- **Real-time Analytics**: Comprehensive search result evaluation
- **Document-Specific Filtering**: Precise vector search within documents
- **Caching Layer**: Optimized performance with intelligent caching

### 🎨 **Modern Glassmorphism UI/UX**
- **TypeScript React Frontend**: Type-safe React 18 with Vite build system
- **Glassmorphism Design**: Beautiful backdrop-blur effects and transparency
- **Framer Motion Animations**: Smooth, engaging micro-interactions
- **Dark Mode Support**: Adaptive theming with seamless transitions
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Real-time Chat Interface**: Markdown support with syntax highlighting
- **Animated Components**: Custom animated buttons and loading states
- **Floating UI Elements**: Dynamic background animations

### 🔒 **Enterprise-Grade Security & Authentication**
- **JWT Authentication**: Secure token-based user session management
- **User Tiers**: Free (50 messages/month) and Premium (1000 messages/month)
- **Rate Limiting**: API protection against abuse and spam
- **Input Validation**: Comprehensive data sanitization with express-validator
- **Password Security**: bcrypt hashing with salt rounds
- **CORS Protection**: Configurable cross-origin request security
- **Error Handling**: Secure error responses without sensitive data exposure

### 📊 **Advanced Analytics & Monitoring**
- **Processing Metrics**: Detailed performance analytics for all operations
- **AI Engine Health**: Real-time monitoring of both Alchemyst and Gemini engines
- **Token Usage Tracking**: Comprehensive usage analytics per user
- **Response Time Monitoring**: Performance metrics for optimization
- **Error Tracking**: Detailed error logging and reporting
- **User Usage Statistics**: Monthly usage tracking and limits

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[React/TypeScript App] --> B[Authentication Context]
        A --> C[Glassmorphism Dashboard]
        A --> D[Real-time Chat Interface]
        A --> E[Animated File Upload]
        A --> F[Dark Mode Theme]
    end
    
    subgraph "Backend API Layer"
        G[Express.js Server] --> H[JWT Auth Middleware]
        G --> I[Rate Limiting]
        G --> J[Error Handling]
        G --> K[Input Validation]
    end
    
    subgraph "Route Handlers"
        L[Auth Routes] --> M[User Management]
        N[PDF Routes] --> O[Document Processing]
        P[Chat Routes] --> Q[Dual AI RAG Pipeline]
        P --> R[Engine Status Monitor]
    end
    
    subgraph "Dual AI Engine System"
        S[Alchemyst AI Primary] --> T[Dynamic Workflow Planning]
        S --> U[Context Lake Integration]
        V[Google Gemini Fallback] --> W[Reliable Processing]
        X[Engine Health Monitor] --> Y[Automatic Failover]
    end
    
    subgraph "Enhanced RAG Pipeline"
        Z[Query Preprocessing] --> AA[Query Expansion]
        AA --> BB[Hybrid Retrieval]
        BB --> CC[Context Ranking]
        CC --> DD[Response Generation]
        DD --> EE[Streaming Output]
    end
    
    subgraph "Vector Database Layer"
        FF[Qdrant Vector DB] --> GG[Semantic Search]
        FF --> HH[Document Filtering]
        FF --> II[Batch Operations]
        FF --> JJ[Collection Management]
    end
    
    subgraph "Data Layer"
        KK[MongoDB] --> LL[User Profiles]
        KK --> MM[Document Metadata]
        KK --> NN[Chat History]
        KK --> OO[Usage Analytics]
    end
    
    A --> G
    Q --> S
    Q --> V
    BB --> FF
    DD --> KK
```
        S --> V[Dual AI Generation]
        W[Chat Service] --> X[Engine Selection]
        W --> Y[Fallback Management]
    end
    
    subgraph "AI/ML Layer"
        Z[Alchemyst AI - Primary] --> AA[Dynamic Workflows]
        Z --> AB[Context Lake]
        AC[Google Gemini - Fallback] --> AD[Text Generation]
        AC --> AE[Embeddings]
        AF[Qdrant Vector DB] --> AG[Semantic Search]
        AF --> AH[Advanced Filtering]
    end
    
    subgraph "Data Layer"
        AI[MongoDB] --> AJ[User Data]
        AI --> AK[Document Metadata]
        AI --> AL[Chat History]
        AF --> AM[Vector Storage]
        AF --> AN[Document Chunks]
    end
    
    A --> F
    F --> J
    F --> L
    F --> N
    O --> S
    S --> Z
    S --> AC
    S --> AF
    V --> W
    S --> AI
```

## 📊 System Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (React/TS)
    participant B as Backend (Express)
    participant Q as Qdrant Vector DB
    participant A as Alchemyst AI Engine
    participant G as Gemini AI Engine
    participant M as MongoDB
    
    U->>F: Upload PDF document
    F->>B: POST /api/pdf/upload
    B->>B: Advanced PDF processing
    Note over B: Multi-strategy chunking
    B->>Q: Store vector embeddings
    B->>M: Save document metadata
    B->>F: Real-time progress updates
    F->>U: Processing complete notification
    
    U->>F: Initiate chat session
    F->>B: POST /api/chat/start
    B->>M: Create new chat session
    B->>F: Return chat instance
    
    U->>F: Send message query
    F->>B: POST /api/chat/:id/message
    Note over B: Query preprocessing & expansion
    B->>Q: Hybrid vector search with filters
    Q->>B: Return relevant chunks with scores
    
    alt Alchemyst AI Primary Engine
        B->>A: Enhanced RAG with Context Lake
        A-->>B: Streaming response with metadata
        Note over A: Dynamic workflow planning
    else Intelligent Fallback
        B->>G: Standard RAG processing
        G-->>B: Generated response
        Note over B: Automatic engine switching
    end
    
    B->>M: Save conversation history
    B->>F: Stream AI response with metadata
    F->>U: Real-time response display
```
    
    B->>M: Save conversation
    B->>F: Return response with metadata
    F->>U: Display answer with engine info
```

## 🚀 Quick Start

### Prerequisites
- 📦 Node.js 18+
- 🍃 MongoDB 6+
- 🔧 Docker (optional, for Qdrant)
- 🔑 Google Gemini API key
- 🧪 Alchemyst AI API key (optional, for enhanced features)

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/askmypdf.git
cd askmypdf
```

### 2. Install Dependencies
```bash
npm run install:all
```

### 3. Setup Environment Variables

**Backend (.env):**
```bash
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5000

# Database
MONGODB_URI=mongodb://localhost:27017/pdfchat

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Google Gemini API (Required - Fallback Engine)
GEMINI_API_KEY=your-gemini-api-key-here

# Alchemyst AI API (Optional - Primary Engine for Enhanced Features)
ALCHEMYST_API_KEY=your-alchemyst-api-key-here
ALCHEMYST_API_URL=https://platform-backend.getalchemystai.com/api/v1

# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-qdrant-api-key-here
QDRANT_COLLECTION_NAME=pdf_documents
```

**Frontend (.env):**
```bash
VITE_API_URL=http://localhost:5000/api
```

### 4. Start Qdrant Vector Database
```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 5. Start Development Servers
```bash
# Development mode (both frontend and backend)
npm run dev

# Or start separately
npm run dev:backend
npm run dev:frontend
```

### 6. Production Build
```bash
npm run build
npm start
```

## 📁 Project Structure

```
AskMyPDF/
├── 📁 backend/                 # Express.js backend
│   ├── 📁 middleware/          # Authentication, error handling
│   ├── 📁 models/             # MongoDB schemas
│   ├── 📁 routes/             # API route handlers
│   ├── 📁 services/           # Business logic services
│   └── 📄 server.js           # Express server entry point
├── 📁 frontend/               # React frontend
│   ├── 📁 src/
│   │   ├── 📁 components/     # Reusable React components
│   │   ├── 📁 contexts/       # React contexts
│   │   ├── 📁 pages/          # Route components
│   │   └── 📁 services/       # API service layer
│   └── 📄 vite.config.ts      # Vite configuration
├── 📄 package.json            # Root package configuration
└── 📄 README.md              # This file
```

## 🛠️ Technology Stack

### Frontend Technologies
- **⚛️ React 18**: Modern UI library with hooks
- **📘 TypeScript**: Type-safe JavaScript
- **🎨 Tailwind CSS**: Utility-first CSS framework
- **🚀 Vite**: Fast development build tool
- **📱 React Router**: Client-side routing
- **🔄 React Query**: Data fetching and caching
- **📋 React Dropzone**: File upload handling
- **🔥 React Hot Toast**: Notifications

### Backend Technologies
- **🟢 Node.js**: JavaScript runtime
- **⚡ Express.js**: Web application framework
- **🍃 MongoDB**: NoSQL database with Mongoose ODM
- **🔐 JWT**: JSON Web Tokens for authentication
- **🛡️ bcrypt**: Password hashing
- **📊 Multer**: File upload middleware
- **🚦 Rate Limiting**: API protection

### AI/ML Technologies
- **� Alchemyst AI**: Primary AI engine with dynamic workflow planning and Context Lake
- **�🤖 Google Gemini**: Fallback AI model for embeddings and generation
- **🔍 Qdrant**: Vector database for semantic search
- **📄 PDF-Parse**: PDF text extraction
- **🧠 Enhanced RAG Pipeline**: Dual-engine Retrieval-Augmented Generation
- **⚡ Intelligent Fallback**: Automatic engine switching for reliability
- **📊 Engine Monitoring**: Real-time AI engine health tracking

## 🔧 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Document Endpoints
- `POST /api/pdf/upload` - Upload PDF document
- `GET /api/pdf/documents` - List user documents
- `GET /api/pdf/documents/:id` - Get document details
- `DELETE /api/pdf/documents/:id` - Delete document

### Chat Endpoints
- `POST /api/chat/start` - Start new chat session
- `POST /api/chat/:id/message` - Send message with dual AI engine support
- `GET /api/chat/:id` - Get chat history with metadata
- `GET /api/chat/user/chats` - List user chat sessions
- `DELETE /api/chat/:id` - Delete chat session
- `POST /api/chat/:id/follow-up` - Generate AI-powered follow-up questions
- `POST /api/chat/:id/evaluate` - Evaluate response quality metrics
- `POST /api/chat/:id/search` - Advanced search within document using Qdrant
- `GET /api/chat/engine-status` - **NEW**: Real-time AI engine status and health monitoring

## 📈 Performance Optimizations

### Backend Optimizations
- **🚀 Vector Indexing**: Efficient similarity search with Qdrant
- **🧪 Dual AI Engine**: Primary Alchemyst AI with Gemini fallback
- **🔄 Intelligent Fallback**: Automatic engine switching for reliability
- **📊 Database Indexing**: Optimized MongoDB queries
- **🔄 Caching**: Response caching for frequently accessed data
- **⚡ Async Processing**: Background PDF processing
- **📦 Compression**: Response compression middleware
- **🔍 Hybrid Search**: Semantic + keyword search combination

## 🧪 Testing & Development

### Alchemyst AI Testing
```bash
# Test Alchemyst AI integration
cd backend
node test-alchemyst.js
```

This will verify:
- ✅ Service configuration and API key setup
- ✅ Connection to Alchemyst AI platform
- ✅ Health check and response generation
- ✅ Fallback mechanism to Gemini AI

### Development Scripts
```bash
# Install all dependencies
npm run install:all

# Start development servers
npm run dev

# Start backend only
npm run dev:backend

# Start frontend only  
npm run dev:frontend

# Run production build
npm run build
npm start
```

### Performance Optimizations

#### Backend Optimizations
- **🚀 Vector Indexing**: Efficient similarity search with Qdrant
- **📊 Connection Pooling**: MongoDB connection optimization
- **⚡ Batch Processing**: Bulk operations for document processing
- **🔄 Caching**: Intelligent caching for frequently accessed data

#### Frontend Optimizations
- **🎯 Code Splitting**: Lazy loading of route components
- **🔄 React Query**: Intelligent data caching and synchronization
- **📱 Responsive Design**: Mobile-first approach with optimized assets
- **⚡ Bundle Optimization**: Vite's efficient bundling with tree shaking

## 🔒 Security Features

- **🔐 JWT Authentication**: Secure token-based authentication with refresh tokens
- **🛡️ Password Hashing**: bcrypt with configurable salt rounds
- **🚦 Rate Limiting**: Advanced API protection against abuse and DDoS
- **🔍 Input Validation**: Comprehensive Express validator middleware
- **🛡️ Helmet**: Security headers middleware for XSS protection
- **🔒 CORS**: Configurable cross-origin resource sharing
- **🔐 API Key Security**: Secure handling of AI service credentials

## 🌍 Environment Support

- **🔧 Development**: Hot reloading, source maps, debug logging, AI engine monitoring
- **🏭 Production**: Optimized builds, compression, security headers, error tracking
- **🐳 Docker**: Container support with multi-stage builds for easy deployment
- **☁️ Cloud**: AWS, Google Cloud, Azure compatible with environment-specific configs
- **📊 Monitoring**: Real-time AI engine health monitoring and performance metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Alchemyst AI**: For providing advanced AI capabilities with dynamic workflow planning
- **Google Gemini**: For reliable AI capabilities and embeddings
- **Qdrant**: For efficient vector database operations
- **MongoDB**: For flexible document storage
- **React Community**: For excellent documentation and tools

## 🧪 Testing & Development

### Backend Testing
```bash
# Run Alchemyst AI integration test
cd backend
npm run test:alchemyst

# Run all backend tests
npm test
```

### Engine Status Monitoring
The application includes built-in AI engine monitoring:
- Real-time health checks for both AI engines
- Automatic fallback detection
- Performance metrics tracking
- Engine status API endpoint: `GET /api/chat/engine-status`

## 📞 Support & Contact

For support or questions, feel free to reach out:

- 📧 **Email**: [sakshamsinghrathore1304@gmail.com](mailto:sakshamsinghrathore1304@gmail.com)
- 💼 **LinkedIn**: [Saksham Singh Rathore](https://www.linkedin.com/in/saksham-singh-rathore1304/)
- 🐛 **Issues**: Found a bug or have a feature request? Please [open an issue](https://github.com/saksham-1304/AskMyPDF/issues) on GitHub
- 💡 **Discussions**: Join the conversation in our [GitHub Discussions](https://github.com/saksham-1304/AskMyPDF/discussions)

---

<div align="center">
  <strong>🚀 Built with ❤️ using modern web technologies</strong>
</div>
