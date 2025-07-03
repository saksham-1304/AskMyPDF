# PDF Chat Application

A full-stack MERN application that allows users to upload PDF documents and have AI-powered conversations with them using Google Gemini AI and Pinecone vector database.

## Features

- **User Authentication**: Secure registration and login system
- **PDF Upload & Processing**: Upload PDFs up to 25MB with automatic text extraction
- **AI-Powered Chat**: Chat with your documents using Google Gemini AI
- **Vector Search**: Intelligent document search using Pinecone embeddings
- **Real-time Processing**: Live progress tracking for document processing
- **Responsive Design**: Modern, mobile-friendly interface
- **Usage Tracking**: Monitor document and message limits

## Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **Google Gemini AI** for chat responses and embeddings
- **Pinecone** for vector storage and similarity search
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
- Google Gemini API key
- Pinecone API key

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
   PINECONE_API_KEY=your-pinecone-api-key-here
   PINECONE_INDEX_NAME=pdf-chat-index
   ```

   **Frontend** - Copy `frontend/.env.example` to `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Build and Start the Application**
   ```bash
   npm run build
   npm start
   ```

   The application will be available at `http://localhost:5000`

### Your Exact Commands

As requested, here are your exact commands:

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

### Development Mode

For development with hot reload:

```bash
# Option 1: Run both frontend and backend in development mode
npm run dev

# Option 2: Run them separately
npm run dev:backend    # Backend with nodemon
npm run dev:frontend   # Frontend with Vite dev server
```

Development URLs:
- Backend: `http://localhost:5000`
- Frontend (dev mode): `http://localhost:5173`

## API Setup Requirements

### Google Gemini AI
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file as `GEMINI_API_KEY`

### Pinecone
1. Sign up at [Pinecone](https://www.pinecone.io/)
2. Create a new index with:
   - Dimensions: 768 (for Gemini embeddings)
   - Metric: cosine
3. Get your API key and index name
4. Add them to your `.env` file

### MongoDB
- **Local**: Install MongoDB locally or use MongoDB Compass
- **Cloud**: Use MongoDB Atlas for a cloud database
- Update `MONGODB_URI` in your `.env` file

## Project Structure

```
pdf-chat-app/
├── package.json            # Root package.json with main scripts
├── backend/
│   ├── middleware/          # Authentication, error handling
│   ├── models/             # MongoDB schemas
│   ├── routes/             # API endpoints
│   ├── services/           # Business logic (PDF, AI, Pinecone)
│   ├── uploads/            # Temporary file storage
│   ├── public/             # Frontend build output (after build)
│   ├── package.json        # Backend dependencies
│   └── server.js           # Express server
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   └── services/       # API client
│   ├── package.json        # Frontend dependencies
│   └── vite.config.ts      # Vite config (builds to ../backend/public)
└── README.md
```

## Available Scripts

### Root Level Scripts
- `npm run install:all` - Install dependencies for both backend and frontend
- `npm run build` - Build the frontend and place it in backend/public
- `npm start` - Start the production server
- `npm run dev` - Run both backend and frontend in development mode
- `npm run dev:backend` - Run only backend in development mode
- `npm run dev:frontend` - Run only frontend in development mode
- `npm run clean` - Clean all node_modules and build directories

### Backend Scripts
- `npm run dev --prefix backend` - Start backend with nodemon
- `npm run start --prefix backend` - Start backend in production mode
- `npm run build:full --prefix backend` - Build frontend from backend directory

### Frontend Scripts
- `npm run dev --prefix frontend` - Start Vite dev server
- `npm run build --prefix frontend` - Build frontend to ../backend/public

## Usage

1. **Register/Login**: Create an account or sign in
2. **Upload PDF**: Drag and drop or select a PDF file (max 25MB)
3. **Wait for Processing**: The system extracts text and generates embeddings
4. **Start Chatting**: Ask questions about your document
5. **View Sources**: See which parts of the document were used for answers

## Features in Detail

### User Plans
- **Free Plan**: 5 documents, 50 messages/month, 10MB max file size
- **Premium Plan**: 50 documents, 1000 messages/month, 25MB max file size

### Document Processing
1. PDF text extraction using pdf-parse
2. Text chunking for optimal processing
3. Embedding generation using Google Gemini
4. Vector storage in Pinecone for fast similarity search

### AI Chat
- Context-aware responses using document content
- Relevant source highlighting
- Processing time and token usage tracking
- Markdown support for formatted responses

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

## Troubleshooting

### Common Issues

1. **Frontend not loading**: Make sure you've built the frontend first
   ```bash
   npm run build
   ```

2. **API calls failing**: Check that the backend is running and environment variables are set

3. **MongoDB connection issues**: Ensure MongoDB is running and the connection string is correct

4. **Missing dependencies**: Run the install command again
   ```bash
   npm run install:all
   ```

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
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.