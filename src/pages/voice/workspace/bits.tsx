import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { waveBars } from './callDisplay';

export function CallsAvatar({ initials, size = 36, className }: { initials: string; size?: number; className?: string }) {
  return (
    <span className={cn('calls-avatar', className)} style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

export function CallsWave({ played = 0.35, className }: { played?: number; className?: string }) {
  const bars = waveBars();
  return (
    <div className={cn('calls-wave flex-1', className)} aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={index}
          data-played={index / bars.length < played}
          style={{ height }}
        />
      ))}
    </div>
  );
}

export function MetricDelta({ value, unit = '' }: { value: number | null | undefined; unit?: string }) {
  if (value == null) return <span className="text-xs text-[var(--calls-muted)]">No prior period to compare</span>;
  const positive = value >= 0;
  return (
    <span className={cn('text-xs', positive ? 'text-[var(--calls-brand)]' : 'text-[var(--calls-danger)]')}>
      {positive ? '+' : ''}
      {value}
      {unit}
    </span>
  );
}

export function UnavailableHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[var(--calls-muted)]">{children}</p>;
}

export function EmptyCalls({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
      <h3 className="max-w-sm text-sm font-semibold">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-[var(--calls-muted)]">{description}</p> : null}
      {action}
    </div>
  );
}
