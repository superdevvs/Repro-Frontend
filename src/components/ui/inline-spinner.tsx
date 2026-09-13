import { forwardRef } from 'react';
import { LoaderCircle, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Compact feedback for buttons, downloads and individual sections. */
export const InlineSpinner = forwardRef<SVGSVGElement, LucideProps & { label?: string }>(
  ({ className, label = 'Loading', 'aria-hidden': ariaHidden, 'aria-label': ariaLabel, role, ...props }, ref) => {
    const decorative = ariaHidden === true || ariaHidden === 'true';
    return (
      <LoaderCircle
        {...props}
        ref={ref}
        className={cn('shrink-0 animate-spin motion-reduce:animate-none', className)}
        aria-hidden={ariaHidden}
        aria-label={decorative ? undefined : ariaLabel ?? label}
        role={decorative ? undefined : role ?? 'status'}
        focusable="false"
      />
    );
  },
);
InlineSpinner.displayName = 'InlineSpinner';
