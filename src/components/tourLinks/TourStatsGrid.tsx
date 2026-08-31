import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type TourStatItem = {
  icon: ReactNode;
  label: string;
  value: string;
};

type TourStatsGridProps = {
  items: TourStatItem[];
};

export function TourStatsGrid({ items }: TourStatsGridProps) {
  const mobileColumnCount = items.length === 4 ? 2 : 3;

  return (
    <div
      role="list"
      aria-label="Property facts"
      className={cn(
        'grid md:flex md:items-stretch border border-border/40 rounded-2xl bg-card overflow-hidden',
        mobileColumnCount === 2 ? 'grid-cols-2' : 'grid-cols-3',
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          role="listitem"
          className={cn(
            'flex flex-col items-center gap-1 py-3 px-1 md:flex-1 md:gap-1.5 md:py-5 md:px-2 md:border-t-0',
            index % mobileColumnCount !== 0 && 'border-l border-border/40',
            index >= mobileColumnCount && 'border-t border-border/40',
            index > 0 && 'md:border-l md:border-border/40',
          )}
        >
          <span className="[&>svg]:w-5 [&>svg]:h-5 md:[&>svg]:w-7 md:[&>svg]:h-7">
            {item.icon}
          </span>
          <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {item.label}
          </span>
          <span className="text-xs md:text-lg font-extrabold text-foreground">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
