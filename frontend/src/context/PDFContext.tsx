import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

interface PDF {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  uploadDate: string;
  pages?: number;
  contentLength?: number;
}

interface PDFContextType {
  pdfs: PDF[];
  loading: boolean;
  error: string | null;
  uploadPDF: (file: File) => Promise<PDF>;
  deletePDF: (id: string) => Promise<void>;
  refreshPDFs: () => Promise<void>;
}

const PDFContext = createContext<PDFContextType | undefined>(undefined);

export const usePDF = () => {
  const context = useContext(PDFContext);
  if (!context) {
    throw new Error('usePDF must be used within a PDFProvider');
  }
  return context;
};

export const PDFProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPDFs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/pdfs');
      setPdfs(response.data);
    } catch (err) {
      setError('Failed to fetch PDFs');
      console.error('Error fetching PDFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const uploadPDF = async (file: File): Promise<PDF> => {
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      setLoading(true);
      setError(null);
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      await refreshPDFs();
      return response.data;
    } catch (err) {
      setError('Failed to upload PDF');
      console.error('Error uploading PDF:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deletePDF = async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await api.delete(`/pdfs/${id}`);
      await refreshPDFs();
    } catch (err) {
      setError('Failed to delete PDF');
      console.error('Error deleting PDF:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPDFs();
  }, []);

  return (
    <PDFContext.Provider value={{
      pdfs,
      loading,
      error,
      uploadPDF,
      deletePDF,
      refreshPDFs
    }}>
      {children}
    </PDFContext.Provider>
  );
};