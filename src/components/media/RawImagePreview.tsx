import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Image as ImageIcon, Loader2, AlertCircle, FileImage } from 'lucide-react';
import { isRawFile } from '@/services/rawPreviewService';
import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';

interface RawImagePreviewProps {
  src?: string | null;
  filename: string;
  filePath?: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  fallbackIcon?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  showLoadingState?: boolean;
  lazy?: boolean;
}

/**
 * Smart image preview component that handles RAW files
 * - For regular images: displays directly
 * - For RAW files: fetches/generates preview from backend
 */
export const RawImagePreview: React.FC<RawImagePreviewProps> = ({
  src,
  filename,
  filePath,
  alt,
  className,
  containerClassName,
  fallbackIcon,
  onLoad,
  onError,
  showLoadingState = true,
  lazy = true,
}) => {
  const { session } = useAuth();
  const token = session?.accessToken;
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isRaw = isRawFile(filename);

  const fetchRawPreview = useCallback(async () => {
    if (!filePath || !isRaw) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // First check if preview exists
      const checkResponse = await fetch(
        `${API_BASE_URL}/api/raw-preview/check?filename=${encodeURIComponent(filename)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      
      const checkData = await checkResponse.json();
      
      if (checkData.exists && checkData.previewUrl) {
        setPreviewUrl(checkData.previewUrl);
        setIsLoading(false);
        return;
      }

      // Generate preview
      const generateResponse = await fetch(`${API_BASE_URL}/api/raw-preview/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          file_path: filePath,
        }),
      });

      const generateData = await generateResponse.json();
      
      if (generateData.success && generateData.previewUrl) {
        setPreviewUrl(generateData.previewUrl);
      } else {
        setError(generateData.message || 'Failed to generate preview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setIsLoading(false);
    }
  }, [filePath, filename, isRaw, token]);

  useEffect(() => {
    if (isRaw && filePath && !previewUrl) {
      fetchRawPreview();
    }
  }, [isRaw, filePath, previewUrl, fetchRawPreview]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    onLoad?.();
  };

  const handleImageError = () => {
    setError('Failed to load image');
    onError?.();
  };

  // Determine the final URL to display
  const displayUrl = isRaw ? previewUrl : src;

  // Loading state
  if (isLoading && showLoadingState) {
    return (
      <div className={cn(
        'flex items-center justify-center bg-muted',
        containerClassName
      )}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-xs">Loading RAW...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !displayUrl) {
    return (
      <div className={cn(
        'flex items-center justify-center bg-muted',
        containerClassName
      )}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {isRaw ? (
            <>
              <FileImage className="h-6 w-6" />
              <span className="text-xs text-center px-2">RAW File</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-6 w-6" />
              <span className="text-xs">Error</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // No URL available - show fallback
  if (!displayUrl) {
    return (
      <div className={cn(
        'flex items-center justify-center bg-muted',
        containerClassName
      )}>
        {fallbackIcon || (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            {isRaw ? (
              <>
                <FileImage className="h-6 w-6" />
                <span className="text-[10px]">RAW</span>
              </>
            ) : (
              <ImageIcon className="h-6 w-6" />
            )}
          </div>
        )}
      </div>
    );
  }

  // Display image
  return (
    <div className={cn('relative overflow-hidden bg-muted', containerClassName)}>
      {!imageLoaded && showLoadingState && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={displayUrl}
        alt={alt || filename}
        loading={lazy ? 'lazy' : 'eager'}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={cn(
          'object-cover transition-opacity duration-200',
          !imageLoaded && 'opacity-0',
          imageLoaded && 'opacity-100',
          className
        )}
      />
      {isRaw && imageLoaded && (
        <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/60 text-white text-[9px] font-medium rounded">
          RAW
        </div>
      )}
    </div>
  );
};

/**
 * Simple wrapper for thumbnail display
 */
export const MediaThumbnail: React.FC<{
  file: {
    id?: string | number;
    name: string;
    path?: string;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    url?: string | null;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}> = ({ file, size = 'md', className, onClick }) => {
  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
  };

  const src = file.thumbnailUrl || file.previewUrl || file.url;
  
  return (
    <div 
      className={cn(
        'rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all',
        sizeClasses[size],
        className
      )}
      onClick={onClick}
    >
      <RawImagePreview
        src={src}
        filename={file.name}
        filePath={file.path}
        containerClassName="w-full h-full"
        className="w-full h-full"
      />
    </div>
  );
};

export default RawImagePreview;
