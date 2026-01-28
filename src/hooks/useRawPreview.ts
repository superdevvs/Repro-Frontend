import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  generateRawPreview,
  generateRawPreviewAsync,
  checkRawPreview,
  isRawFile,
  RawPreviewResult,
} from '@/services/rawPreviewService';

interface UseRawPreviewOptions {
  autoGenerate?: boolean;
  pollInterval?: number;
}

interface UseRawPreviewReturn {
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  isRaw: boolean;
  generate: () => Promise<void>;
  generateAsync: () => Promise<void>;
  checkExists: () => Promise<boolean>;
}

/**
 * Hook for managing RAW image preview generation
 */
export const useRawPreview = (
  filePath: string | null,
  filename: string | null,
  options: UseRawPreviewOptions = {}
): UseRawPreviewReturn => {
  const { session } = useAuth();
  const token = session?.accessToken;
  
  const { autoGenerate = false, pollInterval = 0 } = options;
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isRaw = filename ? isRawFile(filename) : false;

  const checkExists = useCallback(async (): Promise<boolean> => {
    if (!filename || !isRaw) return false;
    
    try {
      const result = await checkRawPreview(filename, token);
      if (result.exists && result.previewUrl) {
        setPreviewUrl(result.previewUrl);
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  }, [filename, isRaw, token]);

  const generate = useCallback(async (): Promise<void> => {
    if (!filePath || !isRaw) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await generateRawPreview(filePath, undefined, token);
      
      if (result.success && result.previewUrl) {
        setPreviewUrl(result.previewUrl);
      } else {
        setError(result.error || result.message || 'Failed to generate preview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [filePath, isRaw, token]);

  const generateAsync = useCallback(async (): Promise<void> => {
    if (!filePath || !isRaw) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await generateRawPreviewAsync(filePath, undefined, undefined, token);
      
      if (!result.success) {
        setError(result.error || result.message || 'Failed to queue preview generation');
      }
      // For async, we'll need to poll for the result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [filePath, isRaw, token]);

  // Auto-generate on mount if enabled
  useEffect(() => {
    if (autoGenerate && filePath && isRaw && !previewUrl) {
      checkExists().then((exists) => {
        if (!exists) {
          generate();
        }
      });
    }
  }, [autoGenerate, filePath, isRaw, previewUrl, checkExists, generate]);

  // Polling for async generation
  useEffect(() => {
    if (!pollInterval || previewUrl || !isRaw || !filename) return;

    const interval = setInterval(async () => {
      const exists = await checkExists();
      if (exists) {
        clearInterval(interval);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval, previewUrl, isRaw, filename, checkExists]);

  return {
    previewUrl,
    isLoading,
    error,
    isRaw,
    generate,
    generateAsync,
    checkExists,
  };
};

/**
 * Hook for batch RAW preview management
 */
export const useRawPreviewBatch = () => {
  const { session } = useAuth();
  const token = session?.accessToken;
  
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateBatch = useCallback(async (files: Array<{ path: string; name: string }>) => {
    setIsLoading(true);
    setError(null);
    
    const rawFiles = files.filter(f => isRawFile(f.name));
    
    if (rawFiles.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      // Generate previews one by one to track progress
      const results: Record<string, string | null> = {};
      
      for (const file of rawFiles) {
        const result = await generateRawPreview(file.path, undefined, token);
        results[file.name] = result.success ? result.previewUrl || null : null;
      }
      
      setPreviews(prev => ({ ...prev, ...results }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const getPreview = useCallback((filename: string): string | null => {
    return previews[filename] || null;
  }, [previews]);

  const clearPreviews = useCallback(() => {
    setPreviews({});
  }, []);

  return {
    previews,
    isLoading,
    error,
    generateBatch,
    getPreview,
    clearPreviews,
  };
};

export default useRawPreview;
