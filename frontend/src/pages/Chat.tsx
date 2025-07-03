import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, FileText, Bot, User, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
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
      // First, get document details
      const docResponse = await api.get(`/pdf/documents/${documentId}`);
      setDocument(docResponse.data);

      if (docResponse.data.processingStatus !== 'completed') {
        toast.error('Document is still processing. Please wait.');
        return;
      }

      // Start or get existing chat
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
      
      // Remove the user message if sending failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (time: number) => {
    return time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(1)}s`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!document || !chat) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">Chat not available</h3>
        <p className="mt-1 text-sm text-gray-500">
          The document might still be processing or there was an error.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="bg-white rounded-t-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-red-500" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {document.originalName}
                </h1>
                <p className="text-sm text-gray-500">
                  {document.metadata?.pages} pages • {document.metadata?.wordCount} words
                </p>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-gray-50 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">
              Start a conversation
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Ask me anything about "{document.originalName}"
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl flex ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                } space-x-3`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-white'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white ml-3'
                      : 'bg-white text-gray-900 shadow-sm border border-gray-200 mr-3'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm">{message.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none">
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
                  
                  {message.metadata && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        {message.metadata.processingTime && (
                          <span>⏱️ {formatTime(message.metadata.processingTime)}</span>
                        )}
                        {message.metadata.relevantChunks && (
                          <span>📄 {message.metadata.relevantChunks.length} sources</span>
                        )}
                      </div>
                      
                      {message.metadata.relevantChunks && message.metadata.relevantChunks.length > 0 && (
                        <div className="mt-2">
                          <details className="cursor-pointer">
                            <summary className="text-xs text-gray-600 hover:text-gray-800">
                              View sources
                            </summary>
                            <div className="mt-2 space-y-2">
                              {message.metadata.relevantChunks.slice(0, 3).map((chunk, i) => (
                                <div key={i} className="text-xs bg-gray-50 p-2 rounded border">
                                  <div className="font-medium text-gray-700">
                                    Page {chunk.pageNumber} (Relevance: {(chunk.score * 100).toFixed(1)}%)
                                  </div>
                                  <div className="text-gray-600 mt-1 line-clamp-3">
                                    {chunk.text}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {sending && (
          <div className="flex justify-start">
            <div className="max-w-3xl flex space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 text-white flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white rounded-b-xl shadow-sm border-t border-gray-200 p-4">
        <form onSubmit={sendMessage} className="flex space-x-4">
          <div className="flex-1">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Ask a question about this document..."
              disabled={sending}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send your message. The AI will search through your document to provide relevant answers.
        </p>
      </div>
    </div>
  );
};

export default Chat;