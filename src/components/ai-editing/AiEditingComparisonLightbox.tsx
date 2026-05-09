import React, { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface AiEditingComparisonLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalUrl?: string | null;
  enhancedUrl?: string | null;
  title?: string;
  subtitle?: string;
}

export const AiEditingComparisonLightbox: React.FC<AiEditingComparisonLightboxProps> = ({
  open,
  onOpenChange,
  originalUrl,
  enhancedUrl,
  title,
  subtitle,
}) => {
  const [position, setPosition] = useState(50);

  useEffect(() => {
    if (open) setPosition(50);
  }, [open]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1 && event.pointerType === 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const next = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(next);
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    onPointerMove(event);
  }, [onPointerMove]);

  const showSlider = Boolean(originalUrl && enhancedUrl);
  const fallbackUrl = enhancedUrl || originalUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden">
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3 border-b bg-background/95 px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-base sm:text-lg font-semibold">{title || 'Result preview'}</h2>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-1">
              {fallbackUrl && (
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <a href={fallbackUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open
                  </a>
                </Button>
              )}
              {fallbackUrl && (
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <a href={fallbackUrl} download target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="bg-black">
            {showSlider ? (
              <div
                className="relative w-full select-none"
                style={{ aspectRatio: '4 / 3' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
              >
                <img
                  src={originalUrl || ''}
                  alt="Original"
                  className="absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />
                <div
                  className="absolute inset-y-0 left-0 overflow-hidden"
                  style={{ width: `${position}%` }}
                >
                  <img
                    src={enhancedUrl || ''}
                    alt="Enhanced"
                    className="h-full w-full object-contain"
                    draggable={false}
                    style={{ width: `${(100 / Math.max(position, 0.0001)) * 100}%`, maxWidth: 'unset' }}
                  />
                </div>
                <div
                  className="absolute inset-y-0 w-0.5 bg-white/80 shadow"
                  style={{ left: `${position}%` }}
                  aria-hidden
                />
                <div
                  className={cn(
                    'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-primary',
                  )}
                  style={{ left: `${position}%` }}
                  aria-hidden
                >
                  <span className="text-[10px] font-bold tracking-wide text-primary">{Math.round(position)}%</span>
                </div>
                <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Enhanced
                </div>
                <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Original
                </div>
              </div>
            ) : fallbackUrl ? (
              <div className="flex w-full items-center justify-center" style={{ minHeight: '60vh' }}>
                <img src={fallbackUrl} alt="Preview" className="max-h-[80vh] w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-[40vh] w-full items-center justify-center text-sm text-muted-foreground">
                Preview unavailable.
              </div>
            )}
          </div>
          {showSlider && (
            <div className="border-t bg-background/95 px-4 py-2 text-xs text-muted-foreground">
              Drag the divider or click to compare original vs enhanced.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AiEditingComparisonLightbox;
