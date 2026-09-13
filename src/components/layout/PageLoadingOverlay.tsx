import { BrandLoader } from '@/components/ui/brand-loader';
import { cn } from '@/lib/utils';

interface PageLoadingOverlayProps {
  className?: string;
  bottomInset?: number;
}

export function PageLoadingOverlay({ className, bottomInset = 0 }: PageLoadingOverlayProps) {
  return (
    <div
      className={cn('absolute inset-0 z-40 grid place-items-center overflow-hidden bg-background/45 backdrop-blur-md', className)}
      style={{ paddingBottom: bottomInset }}
      role="status"
      aria-label="Loading page"
      aria-live="polite"
    >
      <BrandLoader className="page-loading-logo" aria-hidden="true" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
