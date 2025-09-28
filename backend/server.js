import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Import routes
import authRoutes from './routes/auth.js';
import pdfRoutes from './routes/pdf.js';
import chatRoutes from './routes/chat.js';
import multimodalRoutes from './routes/multimodal.js';
import multimodalChatRoutes from './routes/multimodalChat.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for serving React app
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5000',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pdfchat', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pdf', authenticate, pdfRoutes);
app.use('/api/chat', authenticate, chatRoutes);
app.use('/api/multimodal', authenticate, multimodalRoutes);
app.use('/api/multimodal-chat', authenticate, multimodalChatRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files from the React app build
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      error: 'Frontend not built. Please run: npm run build' 
    });
  }
});

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Frontend served from: ${publicPath}`);
  console.log(`🌐 Application URL: http://localhost:${PORT}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('\n📝 Development Notes:');
    console.log('- Make sure to build the frontend first: npm run build');
    console.log('- For development with hot reload, use: npm run dev');
  }
});