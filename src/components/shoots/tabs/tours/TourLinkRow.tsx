import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Copy, MoreVertical } from 'lucide-react';
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
 * On a phone the field stays full width, Copy sits next to a three-dot menu,
 * and extra actions (open, share, QR, edit, remove) live in that menu. From
 * `sm` up the extra buttons are gone: Copy appears as a hover overlay on the
 * right edge of the field, and remaining actions stay in the menu.
 */
export function TourLinkRow({ label, value, placeholder, actions, className }: TourLinkRowProps) {
  const copyAction = actions.find((action) => action.key === 'copy');
  const canCopy = Boolean(copyAction) && !copyAction?.disabled;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="group/link relative min-w-0 flex-1">
        <Input
          value={value}
          readOnly
          placeholder={placeholder}
          className="min-w-0 pr-9"
          aria-label={label}
        />
        {copyAction ? (
          <button
            type="button"
            data-testid="tour-link-hover-copy"
            className="pointer-events-none absolute inset-y-0 right-1 hidden w-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/link:pointer-events-auto group-hover/link:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 sm:flex disabled:opacity-0"
            onClick={copyAction.onSelect}
            disabled={!canCopy}
            aria-label={copyAction.label}
            title={copyAction.label}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {copyAction ? (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 sm:hidden"
          onClick={copyAction.onSelect}
          disabled={!canCopy}
          aria-label={copyAction.label}
          data-testid="tour-link-mobile-copy"
        >
          <Copy className="h-4 w-4" />
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0" aria-label={`${label} actions`}>
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
    </div>
  );
}
