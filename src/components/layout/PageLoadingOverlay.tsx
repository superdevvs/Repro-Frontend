import { BrandLoader } from '@/components/ui/brand-loader';
import { cn } from '@/lib/utils';

export function PageLoadingOverlay({ className }: { className?: string }) {
  return (
    <div
      className={cn('absolute inset-0 z-40 grid place-items-center overflow-hidden bg-background/45 backdrop-blur-md', className)}
      role="status"
      aria-label="Loading page"
      aria-live="polite"
    >
      <BrandLoader className="h-28 w-28 sm:h-36 sm:w-36" aria-hidden="true" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
