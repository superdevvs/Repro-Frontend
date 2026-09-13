import React from 'react';
import { BrandLoader } from '@/components/ui/brand-loader';

interface HorizontalLoaderProps {
  message?: string;
  className?: string;
}

export function HorizontalLoader({ message, className = '' }: HorizontalLoaderProps) {
  return (
    <div className={`py-3 ${className}`}>
      <div className="flex justify-center">
        <BrandLoader className="h-8 w-8" />
      </div>
      {message && (
        <div className="mt-2 text-xs text-muted-foreground">{message}</div>
      )}
    </div>
  );
}
