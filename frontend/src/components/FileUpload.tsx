import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

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
      
      // Poll for processing status
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

    // Cleanup interval after 5 minutes
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
    maxSize: 25 * 1024 * 1024, // 25MB
    disabled: uploading,
  });

  const resetUpload = () => {
    setUploading(false);
    setUploadProgress(0);
    setError(null);
    setUploadedFile(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : uploading
            ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {uploading ? (
            <>
              <div className="w-16 h-16 relative">
                <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
                <div 
                  className="w-16 h-16 border-4 border-blue-600 rounded-full border-r-transparent animate-spin absolute top-0 left-0"
                ></div>
              </div>
              <div className="text-lg font-medium text-gray-700">
                {uploadProgress < 100 ? 'Uploading...' : 'Processing PDF...'}
              </div>
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="text-sm text-gray-500">
                {uploadProgress}% complete
              </div>
              {uploadedFile && (
                <div className="text-sm text-gray-600">
                  Processing: {uploadedFile}
                </div>
              )}
            </>
          ) : error ? (
            <>
              <AlertCircle className="h-12 w-12 text-red-500" />
              <div className="text-lg font-medium text-red-700">Upload Failed</div>
              <div className="text-sm text-red-600">{error}</div>
              <button
                onClick={resetUpload}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </>
          ) : uploadedFile ? (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <div className="text-lg font-medium text-green-700">Upload Successful</div>
              <div className="text-sm text-gray-600">{uploadedFile}</div>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400" />
              <div className="text-lg font-medium text-gray-700">
                {isDragActive ? 'Drop your PDF here' : 'Upload your PDF document'}
              </div>
              <div className="text-sm text-gray-500">
                Drag and drop or click to select • PDF files up to 25MB
              </div>
            </>
          )}
        </div>
      </div>

      {fileRejections.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <X className="h-5 w-5 text-red-500" />
            <span className="text-red-700 font-medium">File Rejected</span>
          </div>
          <ul className="mt-2 text-sm text-red-600">
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
        </div>
      )}

      <div className="mt-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          What happens after upload?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold">1</span>
            </div>
            <span>PDF text extraction</span>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold">2</span>
            </div>
            <span>AI embedding generation</span>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold">3</span>
            </div>
            <span>Ready for chat!</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;