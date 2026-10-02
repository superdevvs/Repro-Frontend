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
 * and extra actions live in that menu. Copy appears as a hover overlay from
 * `sm` up. On desktop, Open and Edit sit beside the field; remaining actions
 * stay in the menu. The caller supplies only actions permitted for the role.
 */
export function TourLinkRow({ label, value, placeholder, actions, className }: TourLinkRowProps) {
  const copyAction = actions.find((action) => action.key === 'copy');
  const canCopy = Boolean(copyAction) && !copyAction?.disabled;
  const desktopActions = actions.filter(action => action.key === 'open' || action.key === 'edit');

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

      {desktopActions.map(({ key, label: actionLabel, icon: Icon, onSelect, disabled }) => (
        <Button
          key={key}
          variant="outline"
          size="icon"
          className="hidden h-9 w-9 shrink-0 lg:inline-flex"
          onClick={onSelect}
          disabled={disabled}
          aria-label={actionLabel}
          title={actionLabel}
          data-testid={`tour-link-desktop-${key}`}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}

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
              className={cn(destructive && 'text-destructive focus:text-destructive',
                (key === 'open' || key === 'edit') && 'lg:hidden')}
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
