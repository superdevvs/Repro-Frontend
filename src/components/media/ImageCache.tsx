import React, { useState, useEffect, useRef } from 'react';

interface CachedImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  onLoad?: () => void;
  onError?: () => void;
}

// Simple in-memory cache for images
const imageCache = new Map<string, HTMLImageElement>();
const loadingPromises = new Map<string, Promise<HTMLImageElement>>();

export function CachedImage({ 
  src, 
  alt, 
  className, 
  loading = 'lazy', 
  decoding = 'async',
  onLoad,
  onError
}: CachedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Check if image is already cached
    if (imageCache.has(src)) {
      const cachedImg = imageCache.get(src)!;
      setImageSrc(src);
      setIsLoading(false);
      onLoad?.();
      return;
    }

    // Check if image is currently loading
    if (loadingPromises.has(src)) {
      loadingPromises.get(src)!.then(img => {
        setImageSrc(src);
        setIsLoading(false);
        onLoad?.();
      }).catch(() => {
        onError?.();
      });
      return;
    }

    // Load and cache the image
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageCache.set(src, img);
        loadingPromises.delete(src);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });

    loadingPromises.set(src, loadPromise);
    
    loadPromise.then(() => {
      setImageSrc(src);
      setIsLoading(false);
      onLoad?.();
    }).catch(() => {
      onError?.();
    });
  }, [src, onLoad, onError]);

  return (
    <>
      {isLoading && (
        <div className={`absolute inset-0 bg-muted animate-pulse ${className}`} />
      )}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
        style={{ opacity: isLoading ? 0 : 1 }}
        onLoad={onLoad}
        onError={onError}
      />
    </>
  );
}

// Utility to clear cache if needed
export function clearImageCache() {
  imageCache.clear();
  loadingPromises.clear();
}

// Utility to preload images
export function preloadImages(urls: string[]) {
  urls.forEach(url => {
    if (!imageCache.has(url) && !loadingPromises.has(url)) {
      const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          imageCache.set(url, img);
          loadingPromises.delete(url);
          resolve(img);
        };
        img.onerror = reject;
        img.src = url;
      });
      loadingPromises.set(url, loadPromise);
    }
  });
}
