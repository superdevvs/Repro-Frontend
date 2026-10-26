import type { ReactNode } from 'react';
import { Filter, LayoutGrid, List } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UpcomingShootsViewControlsProps {
  showCompact: boolean;
  compactCards: boolean;
  compactHeader: boolean;
  inline: boolean;
  activeFilterCount: number;
  isFilterOpen: boolean;
  onToggleCompact: () => void;
  onToggleFilters: () => void;
  children?: ReactNode;
}

export function UpcomingShootsViewControls({
  showCompact, compactCards, compactHeader, inline, activeFilterCount,
  isFilterOpen, onToggleCompact, onToggleFilters, children,
}: UpcomingShootsViewControlsProps) {
  const compactLabel = compactCards ? 'Show full shoot cards' : 'Show compact shoot cards';

  return <>
    {showCompact && (
      <Button
        type="button" variant="ghost" size="sm"
        aria-label={compactLabel} aria-pressed={compactCards} title={compactLabel}
        className={cn('text-xs rounded-full text-muted-foreground', compactHeader && 'h-9 w-9 shrink-0 p-0', inline && 'h-10 w-10')}
        onClick={onToggleCompact}
      >
        {compactCards ? <LayoutGrid size={15} /> : <List size={15} />}
        {!compactHeader && <span className="ml-1.5">{compactCards ? 'Full cards' : 'Compact'}</span>}
      </Button>
    )}
    {children}
    <Button
      variant="secondary" size="sm"
      className={cn('rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-900', compactHeader && 'relative h-9 w-9 shrink-0 p-0', inline && 'h-10 w-10')}
      aria-label={compactHeader ? `Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}` : undefined}
      title={compactHeader ? 'Filters' : undefined}
      aria-expanded={isFilterOpen}
      onClick={onToggleFilters}
    >
      <Filter size={14} className={compactHeader ? undefined : 'mr-1.5'} />
      {!compactHeader && <>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</>}
      {compactHeader && activeFilterCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[9px] leading-4 text-primary-foreground" aria-hidden="true">{activeFilterCount}</span>}
    </Button>
  </>;
}
