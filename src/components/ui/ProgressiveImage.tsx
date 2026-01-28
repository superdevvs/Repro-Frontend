import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ProgressiveImageProps {
  src: string;
  placeholderSrc?: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean; // Load immediately if true
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  placeholderSrc,
  alt,
  className,
  onClick,
  onLoad,
  onError,
  priority = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || shouldLoad) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before image comes into view
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [priority, shouldLoad]);

  // Load the main image
  useEffect(() => {
    if (!shouldLoad || !src || isLoaded || hasError) return;

    setIsLoading(true);
    const img = new Image();

    img.onload = () => {
      setIsLoaded(true);
      setIsLoading(false);
      onLoad?.();
    };

    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
      onError?.();
    };

    img.src = src;
  }, [shouldLoad, src, isLoaded, hasError, onLoad, onError]);

  // Generate blur placeholder if none provided
  const blurPlaceholder = placeholderSrc || `data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23e5e7eb'/%3E%3C/svg%3E`;

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-100 text-gray-400',
          className
        )}
        onClick={onClick}
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)} onClick={onClick}>
      {/* Placeholder/Blur image */}
      <img
        ref={imgRef}
        src={blurPlaceholder}
        alt=""
        className={cn(
          'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
          isLoaded ? 'opacity-0' : 'opacity-100',
          !isLoaded && placeholderSrc && 'blur-sm'
        )}
        aria-hidden="true"
      />

      {/* Main image */}
      {shouldLoad && (
        <img
          src={src}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          loading={priority ? 'eager' : 'lazy'}
        />
      )}

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
        </div>
      )}

      {/* Download button overlay for original files */}
      {!isLoaded && !isLoading && shouldLoad && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
          <button
            className="bg-white/90 text-gray-800 px-3 py-1 rounded text-sm font-medium"
            onClick={(e) => {
              e.stopPropagation();
              // Will be handled by parent component
            }}
          >
            Load Full Size
          </button>
        </div>
      )}
    </div>
  );
};

// Hook for image gallery with progressive loading
export const useProgressiveImage = (src: string, placeholderSrc?: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    
    img.onload = () => setIsLoaded(true);
    img.onerror = () => setHasError(true);
    
    img.src = src;
  }, [src]);

  return { isLoaded, hasError, src, placeholderSrc };
};
