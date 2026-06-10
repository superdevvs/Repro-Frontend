import React from 'react';
import { Loader2, RefreshCw, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ScanStatus } from '@/hooks/useShootFiles';

/**
 * Visual mapping for the four canonical scan_status values surfaced by the
 * backend (Req 14/15). `quarantined` is presented as "scanning" because that
 * is the human-facing label for an in-progress scan (per the design doc:
 * `quarantined`→`scanning`, plus `clean`/`infected`/`failed`). Each entry
 * carries the user-facing label, an icon, and a colored Tailwind class set
 * that follows the existing voice/notification badge palette.
 */
const SCAN_STATUS_META: Record<
  ScanStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
    title: string;
  }
> = {
  quarantined: {
    label: 'Scanning',
    icon: Loader2,
    className:
      'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    title: 'Virus scan in progress. File is withheld until scanned.',
  },
  clean: {
    label: 'Clean',
    icon: ShieldCheck,
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    title: 'Virus scan completed. File is clean and released for processing.',
  },
  infected: {
    label: 'Infected',
    icon: ShieldX,
    className:
      'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
    title: 'Virus scan detected an infection. File is blocked.',
  },
  failed: {
    label: 'Scan failed',
    icon: ShieldAlert,
    className:
      'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    title:
      'Virus scan could not complete. File is withheld and a retry can be triggered.',
  },
};

export interface ScanStatusBadgeProps {
  status: ScanStatus | null | undefined;
  /**
   * Optional retry handler. Only invoked for files whose status is `failed`,
   * matching backend behaviour where the rescan endpoint returns 409 for any
   * other status (Req 15.8). When omitted, the badge renders without a retry
   * control.
   */
  onRetry?: () => void;
  /** True while the rescan mutation is in flight; disables the retry button. */
  isRetrying?: boolean;
  /** Additional className applied to the badge wrapper. */
  className?: string;
  /**
   * When true (default), the retry-scan button renders next to the badge for
   * `failed` files. Set to false when a parent already renders the retry
   * action elsewhere (e.g. an action menu).
   */
  showRetryControl?: boolean;
  /**
   * Compact size for use inside grid tiles. Default `default` matches the
   * shadcn Badge sizing; `sm` shrinks padding and text for tile overlays.
   */
  size?: 'default' | 'sm';
}

/**
 * Renders the virus-scan status of a {@link MediaFile} as a colored badge
 * (Req 15.5). For files in the `failed` state, an inline retry-scan button
 * is rendered alongside the badge (Req 15.8) — clicking it invokes
 * `onRetry`, which the parent wires to the rescan mutation. The button is
 * disabled while a retry is in flight to prevent duplicate dispatches.
 *
 * The component is purely presentational: it does not fetch, mutate, or
 * gate on user role. Callers (e.g. MediaGrid) decide whether to render it
 * by consulting the viewer's role (admin-tier per Req 15.5).
 */
export function ScanStatusBadge({
  status,
  onRetry,
  isRetrying = false,
  className,
  showRetryControl = true,
  size = 'default',
}: ScanStatusBadgeProps): React.ReactElement | null {
  if (!status) {
    return null;
  }

  const meta = SCAN_STATUS_META[status];
  if (!meta) {
    return null;
  }

  const Icon = meta.icon;
  const isCompact = size === 'sm';
  const showRetry = showRetryControl && status === 'failed' && Boolean(onRetry);

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <Badge
        variant="outline"
        className={cn(
          'inline-flex items-center gap-1 font-medium',
          isCompact ? 'px-1.5 py-0 text-[10px] leading-4' : 'text-xs',
          meta.className,
        )}
        title={meta.title}
        aria-label={`Scan status: ${meta.label}`}
        data-scan-status={status}
      >
        <Icon
          className={cn(
            isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5',
            status === 'quarantined' ? 'animate-spin' : '',
          )}
          aria-hidden="true"
        />
        <span>{meta.label}</span>
      </Badge>
      {showRetry && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            'h-6 gap-1 px-2 text-[11px]',
            isCompact ? 'h-5 px-1.5 text-[10px]' : '',
          )}
          disabled={isRetrying}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onRetry?.();
          }}
          aria-label="Retry virus scan"
          data-testid="retry-scan-button"
        >
          {isRetrying ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
          )}
          <span>{isRetrying ? 'Retrying…' : 'Retry scan'}</span>
        </Button>
      )}
    </div>
  );
}

export default ScanStatusBadge;
