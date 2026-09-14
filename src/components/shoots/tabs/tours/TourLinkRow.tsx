import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type TourLinkAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** Rendered as a destructive button / menu item (remove, delete). */
  destructive?: boolean;
};

type TourLinkRowProps = {
  /** Used for the menu trigger's accessible name: "<label> actions". */
  label: string;
  value: string;
  placeholder?: string;
  actions: TourLinkAction[];
  className?: string;
};

/**
 * A read-only link with its actions.
 *
 * Up to six icon buttons used to sit beside every link. On a phone that left
 * the URL itself a few characters wide, which is the one thing the row is
 * for. Below `sm` the field takes the full width and the actions collapse
 * into a single three-dot menu; from `sm` up the inline buttons remain.
 */
export function TourLinkRow({ label, value, placeholder, actions, className }: TourLinkRowProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Input value={value} readOnly placeholder={placeholder} className="min-w-0 flex-1" aria-label={label} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0 sm:hidden" aria-label={`${label} actions`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {actions.map(({ key, label: actionLabel, icon: Icon, onSelect, disabled, destructive }) => (
            <DropdownMenuItem
              key={key}
              onSelect={onSelect}
              disabled={disabled}
              className={destructive ? 'text-destructive focus:text-destructive' : undefined}
            >
              <Icon className="mr-2 h-4 w-4" />
              {actionLabel}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden items-center gap-2 sm:flex" data-testid="tour-link-inline-actions">
        {actions.map(({ key, label: actionLabel, icon: Icon, onSelect, disabled, destructive }) => (
          <Button
            key={key}
            variant={destructive ? 'destructive' : 'outline'}
            size="sm"
            onClick={onSelect}
            disabled={disabled}
            title={actionLabel}
            aria-label={actionLabel}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
    </div>
  );
}
