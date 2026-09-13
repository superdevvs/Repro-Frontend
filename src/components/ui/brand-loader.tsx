import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BrandLoaderProps extends LucideProps {
  label?: string;
}

/** The saved RE motion, shared by full-page and inline loading states. */
export const BrandLoader = forwardRef<SVGSVGElement, BrandLoaderProps>(
  ({ className, size = 24, label = 'Loading', absoluteStrokeWidth: _absoluteStrokeWidth,
    'aria-hidden': ariaHidden, 'aria-label': ariaLabel, role, children, ...props }, ref) => {
    const decorative = ariaHidden === true || ariaHidden === 'true';
    // The artwork contains its own animation; legacy icon callers must not rotate it.
    const classes = className?.split(/\s+/).filter(token => !/(^|:)!?animate-spin$/.test(token)).join(' ');
    return (
      <svg
        {...props}
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 512 512"
        className={cn('inline-block shrink-0', classes)}
        role={decorative ? undefined : role ?? 'status'}
        aria-hidden={ariaHidden}
        aria-label={decorative ? undefined : ariaLabel ?? label}
        aria-live={decorative ? undefined : 'polite'}
        focusable="false"
      >
        <image href="/brand/re/loading.svg" width="512" height="512" className="motion-reduce:hidden" aria-hidden="true" />
        <image href="/brand/re/loading-static.svg" width="512" height="512" className="hidden motion-reduce:block" aria-hidden="true" />
        {children}
      </svg>
    );
  },
);

BrandLoader.displayName = 'BrandLoader';
