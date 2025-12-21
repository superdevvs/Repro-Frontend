import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Card = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'rounded-3xl border border-border/60 bg-card text-card-foreground shadow-md shadow-black/5',
      'dark:shadow-black/30 transition-colors',
      'p-5',
      className,
    )}
  >
    {children}
  </div>
);

const STATUS_COLORS: Record<string, string> = {
  free: 'bg-emerald-500',
  busy: 'bg-amber-500',
  editing: 'bg-sky-500',
  offline: 'bg-muted-foreground/40',
};

export const Avatar = ({
  src,
  initials,
  className,
  status,
}: {
  src?: string | null;
  initials?: string;
  className?: string;
  status?: 'free' | 'busy' | 'editing' | 'offline';
}) => (
  <div className={cn('relative', className)}>
    {src ? (
      <img
        src={src}
        alt={initials}
        className="w-full h-full rounded-2xl object-cover border border-border/60"
      />
    ) : (
      <div className="w-full h-full rounded-2xl bg-muted text-muted-foreground flex items-center justify-center font-semibold">
        {initials || 'N/A'}
      </div>
    )}
    {status && (
      <span
        className={cn(
          'absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-background shadow',
          STATUS_COLORS[status] || 'bg-slate-400',
        )}
      />
    )}
  </div>
);

export const StatBadge = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) => (
  <div className="flex flex-col">
    <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
      {label}
    </span>
    <span
      className="text-2xl font-semibold"
      style={accent ? { color: accent } : undefined}
    >
      {value}
    </span>
  </div>
);

export const SidePanel = ({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-card text-card-foreground shadow-2xl border-l border-border/60 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

