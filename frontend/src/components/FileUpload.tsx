import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import GlassCard from './ui/GlassCard';
import AnimatedButton from './ui/AnimatedButton';

interface FileUploadProps {
  onUploadComplete?: (documentId: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await api.post('/pdf/upload', formData, {
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
      toast.success('PDF uploaded successfully! Processing...');
      
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
        const response = await api.get(`/pdf/documents/${documentId}/status`);
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
    },
    maxFiles: 1,
    maxSize: 25 * 1024 * 1024,
    disabled: uploading,
  });

  const resetUpload = () => {
    setUploading(false);
    setUploadProgress(0);
    setError(null);
    setUploadedFile(null);
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
                    className="w-20 h-20 border-4 border-gradient-to-r from-blue-500 to-purple-600 rounded-full border-r-transparent"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-blue-500" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                    {uploadProgress < 100 ? 'Uploading Magic...' : 'Processing with AI...'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {uploadedFile && `Working on: ${uploadedFile}`}
                  </p>
                </div>

                <div className="w-full max-w-md">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
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
                    {isDragActive ? 'Drop your PDF here!' : 'Upload your PDF document'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Drag and drop or click to select • PDF files up to 25MB
                  </p>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Sparkles className="h-4 w-4" />
                  <span>Powered by AI for intelligent conversations</span>
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
              ✨ What happens after upload?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: FileText, title: "PDF Analysis", desc: "Advanced text extraction" },
                { icon: Sparkles, title: "AI Processing", desc: "Intelligent embedding generation" },
                { icon: CheckCircle, title: "Ready to Chat", desc: "Start conversations instantly" }
              ].map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex flex-col items-center text-center space-y-3"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <step.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-gray-200">{step.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{step.desc}</p>
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

export default FileUpload;