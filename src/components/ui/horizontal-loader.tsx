import React from 'react';

interface HorizontalLoaderProps {
  message?: string;
  className?: string;
}

export function HorizontalLoader({ message, className = '' }: HorizontalLoaderProps) {
  return (
    <div className={`py-3 ${className}`}>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
        <div className="h-full w-1/3 rounded-full bg-primary/80 animate-pulse" />
      </div>
      {message && (
        <div className="mt-2 text-xs text-muted-foreground">{message}</div>
      )}
    </div>
  );
}
