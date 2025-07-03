import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, MessageCircle, Trash2, Clock, FileIcon, Plus, Search, Filter, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import FileUpload from '../components/FileUpload';
import LoadingSpinner from '../components/LoadingSpinner';
import GlassCard from '../components/ui/GlassCard';
import AnimatedButton from '../components/ui/AnimatedButton';
import FloatingElements from '../components/ui/FloatingElements';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Document {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  processingStatus: 'uploading' | 'processing' | 'completed' | 'failed';
  processingProgress: number;
  metadata?: {
    pages: number;
    wordCount: number;
  };
  createdAt: string;
}

const Dashboard: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/pdf/documents');
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = async (documentId: string) => {
    setShowUpload(false);
    await fetchDocuments();
    setTimeout(() => {
      navigate(`/chat/${documentId}`);
    }, 1000);
  };

  const handleDeleteDocument = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await api.delete(`/pdf/documents/${id}`);
      setDocuments(documents.filter(doc => doc._id !== id));
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error('Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-500/20 border-green-500/30';
      case 'processing': return 'text-blue-600 bg-blue-500/20 border-blue-500/30';
      case 'uploading': return 'text-yellow-600 bg-yellow-500/20 border-yellow-500/30';
      case 'failed': return 'text-red-600 bg-red-500/20 border-red-500/30';
      default: return 'text-gray-600 bg-gray-500/20 border-gray-500/30';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.originalName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || doc.processingStatus === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (showUpload) {
    return (
      <div className="min-h-screen relative">
        <FloatingElements />
        <div className="relative z-10 max-w-4xl mx-auto pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <AnimatedButton 
              variant="ghost" 
              onClick={() => setShowUpload(false)}
              className="mb-6"
            >
              ← Back to Dashboard
            </AnimatedButton>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Upload New Document
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Upload a PDF to start having intelligent conversations
            </p>
          </motion.div>
          
          <FileUpload onUploadComplete={handleUploadComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <FloatingElements />
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Welcome back, {user?.username}! ✨
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            You have {documents.length} document{documents.length !== 1 ? 's' : ''} ready for intelligent conversations
          </p>
          
          <AnimatedButton
            variant="gradient"
            size="lg"
            onClick={() => setShowUpload(true)}
            icon={<Plus className="h-5 w-5" />}
            className="shadow-2xl"
          >
            Upload New PDF
          </AnimatedButton>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {[
            {
              icon: FileText,
              title: "Total Documents",
              value: documents.length,
              color: "from-blue-500 to-cyan-500",
              bgColor: "bg-blue-500/10"
            },
            {
              icon: MessageCircle,
              title: "Ready to Chat",
              value: documents.filter(doc => doc.processingStatus === 'completed').length,
              color: "from-green-500 to-emerald-500",
              bgColor: "bg-green-500/10"
            },
            {
              icon: Clock,
              title: "Processing",
              value: documents.filter(doc => doc.processingStatus === 'processing').length,
              color: "from-yellow-500 to-orange-500",
              bgColor: "bg-yellow-500/10"
            }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
            >
              <GlassCard className="p-6 hover:scale-105 transition-transform duration-300" gradient>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <GlassCard className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-3 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm text-gray-900 dark:text-white"
              >
                <option value="all">All Documents</option>
                <option value="completed">Ready to Chat</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </GlassCard>
        </motion.div>

        {/* Documents Grid */}
        <AnimatePresence>
          {filteredDocuments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center py-16"
            >
              <GlassCard className="p-12 max-w-md mx-auto" gradient>
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                </motion.div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {documents.length === 0 ? 'No documents yet' : 'No documents match your search'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {documents.length === 0 
                    ? 'Get started by uploading your first PDF document.' 
                    : 'Try adjusting your search or filter criteria.'
                  }
                </p>
                {documents.length === 0 && (
                  <AnimatedButton
                    variant="gradient"
                    onClick={() => setShowUpload(true)}
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Upload your first PDF
                  </AnimatedButton>
                )}
              </GlassCard>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredDocuments.map((document, index) => (
                <motion.div
                  key={document._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  whileHover={{ y: -5 }}
                >
                  <GlassCard
                    className="p-6 h-full cursor-pointer group"
                    onClick={() => document.processingStatus === 'completed' && navigate(`/chat/${document._id}`)}
                    hover={document.processingStatus === 'completed'}
                    gradient
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                            <FileIcon className="h-6 w-6 text-white" />
                          </div>
                          {document.processingStatus === 'completed' && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                            >
                              <Sparkles className="h-2 w-2 text-white" />
                            </motion.div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {document.originalName}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatFileSize(document.size)}
                          </p>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleDeleteDocument(document._id, e)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </motion.button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(document.processingStatus)}`}>
                          {document.processingStatus === 'completed' && '✨ Ready to Chat'}
                          {document.processingStatus === 'processing' && '⚡ Processing...'}
                          {document.processingStatus === 'uploading' && '📤 Uploading...'}
                          {document.processingStatus === 'failed' && '❌ Failed'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(document.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {document.processingStatus === 'processing' && (
                        <div className="space-y-2">
                          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${document.processingProgress}%` }}
                              transition={{ duration: 0.5 }}
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {document.processingProgress}% complete
                          </p>
                        </div>
                      )}

                      {document.metadata && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-4">
                          <span>📄 {document.metadata.pages} pages</span>
                          <span>📝 {document.metadata.wordCount} words</span>
                        </div>
                      )}

                      {document.processingStatus === 'completed' && (
                        <AnimatedButton
                          variant="primary"
                          size="sm"
                          className="w-full mt-4"
                          icon={<MessageCircle className="h-4 w-4" />}
                        >
                          Start Conversation
                        </AnimatedButton>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Dashboard;