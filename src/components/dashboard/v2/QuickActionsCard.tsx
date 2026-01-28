import React from 'react';
import { ArrowRight, PencilLine } from 'lucide-react';
import { Card } from './SharedComponents';
import { cn } from '@/lib/utils';

export type QuickActionItem = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent?: string;
  onClick?: () => void;
};

interface QuickActionsCardProps {
  actions: QuickActionItem[];
  title?: string;
  eyebrow?: string;
  columns?: 1 | 2;
  emptyStateText?: string;
  onEdit?: () => void;
  editLabel?: string;
}

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  actions,
  title = 'Quick actions',
  eyebrow,
  columns = 1,
  emptyStateText = 'No quick actions available right now.',
  onEdit,
  editLabel = 'Customize',
}) => (
  <Card className="flex flex-col gap-4 flex-shrink-0">
    <div className="flex items-start justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-semibold">
            {eyebrow}
          </p>
        )}
        <h2 className="text-base sm:text-lg font-bold text-foreground">{title}</h2>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={editLabel}
        >
          <PencilLine size={12} aria-hidden="true" />
          <span className="hidden sm:inline">{editLabel}</span>
        </button>
      )}
    </div>
    {actions.length > 0 ? (
      <div
        className={cn(
          'grid gap-2',
          columns === 2 ? 'grid-cols-2 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-1',
        )}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={cn(
              'rounded-xl sm:rounded-2xl border border-border/60 p-2 sm:p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              action.accent ? `bg-gradient-to-br ${action.accent}` : 'bg-muted/50 text-foreground dark:bg-secondary',
            )}
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-2 sm:gap-3">
              <div className="inline-flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-2xl bg-white/80 dark:bg-black/20 text-foreground shadow-sm flex-shrink-0">
                {action.icon}
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <p className="text-[10px] sm:text-sm font-semibold text-foreground leading-tight">{action.label}</p>
                <p className="text-[9px] sm:text-xs text-muted-foreground hidden sm:block">{action.description}</p>
              </div>
              <ArrowRight size={12} className="text-muted-foreground flex-shrink-0 hidden sm:block sm:w-4 sm:h-4" aria-hidden="true" />
            </div>
          </button>
        ))}
      </div>
    ) : (
      <div className="text-center text-sm text-muted-foreground py-6">{emptyStateText}</div>
    )}
  </Card>
);

