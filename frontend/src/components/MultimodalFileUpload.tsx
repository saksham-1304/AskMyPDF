import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, Music, X, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import GlassCard from './ui/GlassCard';
import AnimatedButton from './ui/AnimatedButton';

interface MultimodalFileUploadProps {
  onUploadComplete?: (documentId: string) => void;
}

const MultimodalFileUpload: React.FC<MultimodalFileUploadProps> = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);

  const getFileType = (file: File) => {
    const mimeType = file.type;
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'text';
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return Image;
      case 'audio': return Music;
      default: return FileText;
    }
  };

  const getFileTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'from-green-500 to-emerald-500';
      case 'audio': return 'from-purple-500 to-violet-500';
      default: return 'from-blue-500 to-cyan-500';
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const detectedFileType = getFileType(file);
    setFileType(detectedFileType);
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/multimodal/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        },
      });

      setUploadedFile(file.name);
      toast.success(`${detectedFileType.charAt(0).toUpperCase() + detectedFileType.slice(1)} uploaded successfully! Processing...`);
      
      const documentId = response.data.id;
      pollProcessingStatus(documentId);
      
    } catch (error: any) {
      console.error('Upload failed:', error);
      const errorMessage = error.response?.data?.error || 'Upload failed';
      setError(errorMessage);
      toast.error(errorMessage);
      setUploading(false);
    }
  }, []);

  const pollProcessingStatus = async (documentId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/multimodal/documents/${documentId}/status`);
        const { status, progress } = response.data;

        if (status === 'completed') {
          clearInterval(pollInterval);
          setUploading(false);
          setUploadProgress(100);
          toast.success('Document processed successfully!');
          onUploadComplete?.(documentId);
        } else if (status === 'failed') {
          clearInterval(pollInterval);
          setUploading(false);
          setError('Processing failed. Please try again.');
          toast.error('Document processing failed');
        } else {
          setUploadProgress(Math.max(uploadProgress, progress || 0));
        }
      } catch (error) {
        console.error('Failed to check processing status:', error);
        clearInterval(pollInterval);
        setUploading(false);
        setError('Failed to check processing status');
      }
    }, 2000);

    setTimeout(() => {
      clearInterval(pollInterval);
      if (uploading) {
        setUploading(false);
        setError('Processing is taking longer than expected');
      }
    }, 300000);
  };

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp'],
      'image/webp': ['.webp'],
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/mp4': ['.m4a'],
      'audio/ogg': ['.ogg'],
      'audio/flac': ['.flac']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: uploading,
  });

  const resetUpload = () => {
    setUploading(false);
    setUploadProgress(0);
    setError(null);
    setUploadedFile(null);
    setFileType(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <GlassCard 
          className={`p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragActive
              ? 'border-blue-500/50 bg-blue-500/10 scale-105'
              : uploading
              ? 'cursor-not-allowed opacity-75'
              : 'hover:border-white/30 hover:bg-white/5'
          }`}
          hover={!uploading}
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          
          <AnimatePresence mode="wait">
            {uploading ? (
              <motion.div
                key="uploading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center space-y-6"
              >
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className={`w-20 h-20 border-4 border-gradient-to-r ${fileType ? getFileTypeColor(fileType) : 'from-blue-500 to-purple-600'} rounded-full border-r-transparent`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {fileType && React.createElement(getFileTypeIcon(fileType), { className: "h-8 w-8 text-blue-500" })}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                    {uploadProgress < 100 ? 'Uploading Magic...' : 'Processing with AI...'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {uploadedFile && `Working on: ${uploadedFile}`}
                  </p>
                  {fileType && (
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {fileType === 'image' && '🖼️ Analyzing image and extracting text...'}
                      {fileType === 'audio' && '🎵 Transcribing audio content...'}
                      {fileType === 'text' && '📄 Processing document content...'}
                    </p>
                  )}
                </div>

                <div className="w-full max-w-md">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full bg-gradient-to-r ${fileType ? getFileTypeColor(fileType) : 'from-blue-500 to-purple-600'} rounded-full`}
                    />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {uploadProgress}% complete
                  </p>
                </div>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center space-y-4"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <AlertCircle className="h-16 w-16 text-red-500" />
                </motion.div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-red-600 dark:text-red-400">
                    Upload Failed
                  </h3>
                  <p className="text-red-500 dark:text-red-400 mt-2">{error}</p>
                </div>
                <AnimatedButton variant="secondary" onClick={resetUpload}>
                  Try Again
                </AnimatedButton>
              </motion.div>
            ) : uploadedFile ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center space-y-4"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </motion.div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-green-600 dark:text-green-400">
                    Upload Successful!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">{uploadedFile}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center space-y-6"
              >
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: isDragActive ? [0, 5, -5, 0] : 0
                  }}
                  transition={{ 
                    y: { duration: 2, repeat: Infinity },
                    rotate: { duration: 0.5, repeat: Infinity }
                  }}
                  className="relative"
                >
                  <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
                    <Upload className="h-12 w-12 text-white" />
                  </div>
                  {isDragActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -inset-2 bg-blue-500/20 rounded-3xl blur-xl"
                    />
                  )}
                </motion.div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                    {isDragActive ? 'Drop your file here!' : 'Upload Multimodal Content'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Drag and drop or click to select • Up to 50MB
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 w-full max-w-md">
                  {[
                    { type: 'Documents', icon: FileText, formats: 'PDF, DOCX, TXT', color: 'from-blue-500 to-cyan-500' },
                    { type: 'Images', icon: Image, formats: 'JPG, PNG, GIF', color: 'from-green-500 to-emerald-500' },
                    { type: 'Audio', icon: Music, formats: 'MP3, WAV, M4A', color: 'from-purple-500 to-violet-500' }
                  ].map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.1 }}
                      className="text-center"
                    >
                      <div className={`w-12 h-12 bg-gradient-to-r ${item.color} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                        <item.icon className="h-6 w-6 text-white" />
                      </div>
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">{item.type}</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{item.formats}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Sparkles className="h-4 w-4" />
                  <span>Powered by multimodal AI for cross-format understanding</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>

        {fileRejections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <GlassCard className="p-4 border-red-500/30 bg-red-500/10">
              <div className="flex items-center space-x-2">
                <X className="h-5 w-5 text-red-500" />
                <span className="text-red-600 dark:text-red-400 font-medium">File Rejected</span>
              </div>
              <ul className="mt-2 text-sm text-red-500 dark:text-red-400">
                {fileRejections.map(({ file, errors }) => (
                  <li key={file.name}>
                    {file.name}:
                    <ul className="ml-4">
                      {errors.map((error) => (
                        <li key={error.code}>• {error.message}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 text-center">
              ✨ Multimodal AI Processing
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { 
                  icon: FileText, 
                  title: "Text Analysis", 
                  desc: "Extract and understand text content",
                  features: ["PDF parsing", "DOCX extraction", "Language detection"]
                },
                { 
                  icon: Image, 
                  title: "Visual Understanding", 
                  desc: "Analyze images and extract text",
                  features: ["Image description", "OCR extraction", "Visual analysis"]
                },
                { 
                  icon: Music, 
                  title: "Audio Processing", 
                  desc: "Transcribe and analyze audio",
                  features: ["Speech-to-text", "Audio analysis", "Timestamp tracking"]
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="text-center space-y-3"
                >
                  <div className={`w-12 h-12 bg-gradient-to-r ${getFileTypeColor(index === 0 ? 'text' : index === 1 ? 'image' : 'audio')} rounded-xl flex items-center justify-center mx-auto`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200">{feature.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{feature.desc}</p>
                    <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                      {feature.features.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default MultimodalFileUpload;