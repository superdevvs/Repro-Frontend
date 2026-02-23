import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { DashboardShootSummary } from '@/types/dashboard';
import { withApiBase } from '@/config/env';
import { Card } from './SharedComponents';

interface CompletedShootsCardProps {
  shoots: DashboardShootSummary[];
  title?: string;
  subtitle?: string;
  emptyStateText?: string;
  ctaLabel?: string;
  onSelect?: (shoot: DashboardShootSummary) => void;
  onViewInvoice?: (shoot: DashboardShootSummary) => void;
  onViewAll?: () => void;
}

const resolveImageUrl = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return withApiBase(trimmed);
};

const getShootImages = (shoot: DashboardShootSummary): string[] => {
  const candidates = [
    ...(Array.isArray(shoot.previewImages) ? shoot.previewImages : []),
    shoot.heroImage,
  ];

  const resolved = candidates
    .map(resolveImageUrl)
    .filter((image): image is string => Boolean(image));

  const unique = Array.from(new Set(resolved));
  if (unique.length > 0) {
    return unique.slice(0, 6);
  }

  return ['/no-image-placeholder.svg'];
};

interface SlideshowProps {
  images: string[];
  shootId: number;
  addressLine: string;
  clientName: string | null;
  startTime: string | null;
}

const Slideshow: React.FC<SlideshowProps> = ({ images, shootId, addressLine, clientName, startTime }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (images.length <= 1 || isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3000); // Change image every 3 seconds

    return () => clearInterval(interval);
  }, [images.length, isPaused]);


  return (
    <div
      className="relative h-48 sm:h-56 w-full overflow-hidden group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <img
        src={images[currentIndex]}
        alt={addressLine}
        className="h-full w-full object-cover transition-opacity duration-500"
        loading="lazy"
      />
      {/* Dark gradient from bottom for text readability */}
      <div 
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.8) 15%, rgba(0, 0, 0, 0.6) 30%, rgba(0, 0, 0, 0.3) 45%, rgba(0, 0, 0, 0) 55%)'
        }}
      />
      
      {/* Text content */}
      <div className="absolute left-3 sm:left-4 bottom-3 sm:bottom-4 right-3 sm:right-4 text-white space-y-1 z-10">
        <p className="text-xs sm:text-sm font-semibold truncate">{addressLine}</p>
        <div className="text-[10px] sm:text-[11px] text-white/80 flex flex-col">
          <span>{clientName || 'Client TBD'}</span>
          {startTime && (
            <span className="text-white/60">
              {format(new Date(startTime), 'MMM d • h:mm a')}
            </span>
          )}
        </div>
      </div>
      
      {/* Dots indicator in bottom right corner */}
      {images.length > 1 && (
        <div className="absolute bottom-3 right-3 z-20">
          <div className="flex gap-1.5 items-center bg-black/30 backdrop-blur-sm px-2 py-1.5 rounded-full">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  index === currentIndex ? 'bg-white w-4' : 'bg-white/50'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const CompletedShootsCard: React.FC<CompletedShootsCardProps> = ({
  shoots = [],
  title = 'Delivered shoots',
  subtitle = 'Latest deliveries',
  emptyStateText = 'No delivered shoots yet.',
  ctaLabel = 'View all delivered shoots',
  onSelect,
  onViewInvoice,
  onViewAll,
}) => {
  const safeShoots = Array.isArray(shoots) ? shoots : [];
  
  return (
    <Card className="flex flex-col h-full flex-1 min-h-0">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground">{title}</h2>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="text-[10px] sm:text-xs text-muted-foreground">{safeShoots.length} ready</span>
      </div>
      {safeShoots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0">
          {emptyStateText}
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1 pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0">
          {safeShoots.slice(0, 3).map((shoot, index) => {
            const images = getShootImages(shoot);
            return (
              <div
                key={shoot.id}
                className="rounded-3xl border border-border/60 overflow-hidden hover:border-primary/40 transition-colors bg-card group relative cursor-pointer"
                onClick={() => onSelect?.(shoot)}
              >
                  {/* Invoice available in shoot details modal */}
                <Slideshow
                  images={images}
                  shootId={shoot.id}
                  addressLine={shoot.addressLine}
                  clientName={shoot.clientName}
                  startTime={shoot.startTime}
                />
              </div>
            );
          })}
        </div>
      )}
      <button
        className="mt-4 w-full py-2.5 rounded-2xl border border-border hover:border-primary/40 text-xs font-semibold text-muted-foreground transition-colors"
        onClick={onViewAll}
      >
        {ctaLabel}
      </button>
    </Card>
  );
};

