import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, FileText, Bot, User, Loader2, AlertCircle, Copy, Sparkles, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import GlassCard from '../components/ui/GlassCard';
import AnimatedButton from '../components/ui/AnimatedButton';
import FloatingElements from '../components/ui/FloatingElements';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast from 'react-hot-toast';

interface Message {
  _id?: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    relevantChunks?: Array<{
      text: string;
      score: number;
      pageNumber: number;
    }>;
    processingTime?: number;
    tokensUsed?: number;
  };
  createdAt?: string;
}

interface Document {
  _id: string;
  originalName: string;
  processingStatus: string;
  metadata?: {
    pages: number;
    wordCount: number;
  };
}

interface Chat {
  _id: string;
  title: string;
  messages: Message[];
  documentId: Document;
}

const Chat: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [document, setDocument] = useState<Document | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (documentId) {
      initializeChat();
    }
  }, [documentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeChat = async () => {
    try {
      const docResponse = await api.get(`/pdf/documents/${documentId}`);
      setDocument(docResponse.data);

      if (docResponse.data.processingStatus !== 'completed') {
        toast.error('Document is still processing. Please wait.');
        return;
      }

      const chatResponse = await api.post('/chat/start', { documentId });
      const chatData = chatResponse.data;
      
      setChat(chatData);
      setMessages(chatData.messages || []);
    } catch (error: any) {
      console.error('Failed to initialize chat:', error);
      toast.error(error.response?.data?.error || 'Failed to start chat');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !chat) return;

    const userMessage: Message = {
      role: 'user',
      content: newMessage.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setSending(true);

    try {
      const response = await api.post(`/chat/${chat._id}/message`, {
        message: userMessage.content
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.message,
        metadata: response.data.metadata,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(error.response?.data?.error || 'Failed to send message');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const formatTime = (time: number) => {
    return time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(1)}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!document || !chat) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GlassCard className="p-8 text-center max-w-md">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Chat not available
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The document might still be processing or there was an error.
          </p>
          <AnimatedButton onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </AnimatedButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <FloatingElements />
      <div className="relative z-10 max-w-6xl mx-auto h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-6 mb-6" gradient>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigate('/dashboard')}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-white/10"
                >
                  <ArrowLeft className="h-5 w-5" />
                </motion.button>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                    >
                      <Sparkles className="h-2 w-2 text-white" />
                    </motion.div>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                      {document.originalName}
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      📄 {document.metadata?.pages} pages • 📝 {document.metadata?.wordCount} words
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {messages.length} message{messages.length !== 1 ? 's' : ''}
                </span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-6 px-2">
          <AnimatePresence>
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <GlassCard className="p-12 max-w-md mx-auto" gradient>
                  <motion.div
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Brain className="mx-auto h-16 w-16 text-blue-500 mb-4" />
                  </motion.div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Start a conversation
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Ask me anything about "{document.originalName}"
                  </p>
                </GlassCard>
              </motion.div>
            ) : (
              messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-4xl flex ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} space-x-4`}>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                          : 'bg-gradient-to-r from-green-500 to-emerald-600'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User className="h-5 w-5 text-white" />
                      ) : (
                        <Bot className="h-5 w-5 text-white" />
                      )}
                    </motion.div>
                    
                    <GlassCard
                      className={`p-4 ${message.role === 'user' ? 'ml-4' : 'mr-4'} group`}
                      gradient
                    >
                      {message.role === 'user' ? (
                        <p className="text-gray-900 dark:text-white">{message.content}</p>
                      ) : (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({node, inline, className, children, ...props}) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <SyntaxHighlighter
                                    style={tomorrow}
                                    language={match[1]}
                                    PreTag="div"
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                      
                      {message.role === 'assistant' && (
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            {message.metadata?.processingTime && (
                              <span className="flex items-center space-x-1">
                                <Sparkles className="h-3 w-3" />
                                <span>{formatTime(message.metadata.processingTime)}</span>
                              </span>
                            )}
                            {message.metadata?.relevantChunks && (
                              <span className="flex items-center space-x-1">
                                <FileText className="h-3 w-3" />
                                <span>{message.metadata.relevantChunks.length} sources</span>
                              </span>
                            )}
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => copyToClipboard(message.content)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-300 rounded"
                          >
                            <Copy className="h-3 w-3" />
                          </motion.button>
                        </div>
                      )}
                      
                      {message.metadata?.relevantChunks && message.metadata.relevantChunks.length > 0 && (
                        <details className="mt-3 cursor-pointer">
                          <summary className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                            🔍 View sources ({message.metadata.relevantChunks.length})
                          </summary>
                          <div className="mt-2 space-y-2">
                            {message.metadata.relevantChunks.slice(0, 3).map((chunk, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="text-xs bg-white/5 p-3 rounded-lg border border-white/10"
                              >
                                <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  📄 Page {chunk.pageNumber} • Relevance: {(chunk.score * 100).toFixed(1)}%
                                </div>
                                <div className="text-gray-600 dark:text-gray-400 line-clamp-3">
                                  {chunk.text}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </details>
                      )}
                    </GlassCard>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
          
          {sending && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-4xl flex space-x-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <GlassCard className="p-4" gradient>
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="h-5 w-5 text-blue-500" />
                    </motion.div>
                    <span className="text-gray-600 dark:text-gray-400">AI is thinking...</span>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <GlassCard className="p-4" gradient>
            <form onSubmit={sendMessage} className="flex space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Ask a question about this document..."
                  disabled={sending}
                  className="w-full px-4 py-3 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50"
                />
              </div>
              <AnimatedButton
                type="submit"
                disabled={!newMessage.trim() || sending}
                variant="gradient"
                icon={sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              >
                {sending ? 'Sending' : 'Send'}
              </AnimatedButton>
            </form>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              ✨ Powered by AI • Press Enter to send your message
            </p>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default Chat;