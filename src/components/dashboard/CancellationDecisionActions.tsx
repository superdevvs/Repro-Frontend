import React, { useState } from 'react';
import { Check, MoreHorizontal, X } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type CancellationDecision = 'charge_fee' | 'waive_fee' | 'reject';

type CancellationDecisionActionsProps = {
  shootId: number;
  addressLabel?: string;
  /** Prefix used to match loading keys, e.g. `${shootId}:charge_fee`. */
  actionLoading?: string | null;
  disabled?: boolean;
  onCharge: () => void | Promise<void>;
  onWaive: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
  /** Compact sizing for the Requests card; default matches the Pending dialog. */
  density?: 'default' | 'compact';
  className?: string;
};

/**
 * Charge / Waive / Reject for pending cancellations.
 * Desktop: inline row. Mobile: Vaul bottom drawer to avoid overflow.
 */
export function CancellationDecisionActions({
  shootId,
  addressLabel,
  actionLoading = null,
  disabled = false,
  onCharge,
  onWaive,
  onReject,
  density = 'default',
  className,
}: CancellationDecisionActionsProps) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const compact = density === 'compact';

  const chargeKey = `${shootId}:charge_fee`;
  const waiveKey = `${shootId}:waive_fee`;
  const rejectKey = `${shootId}:reject`;
  // PendingReviewsCard historically used :charge / :waive keys — accept both.
  const isChargeLoading =
    actionLoading === chargeKey || actionLoading === `${shootId}:charge`;
  const isWaiveLoading =
    actionLoading === waiveKey || actionLoading === `${shootId}:waive`;
  const isRejectLoading = actionLoading === rejectKey;
  const isActioning = Boolean(actionLoading?.startsWith(`${shootId}:`)) || disabled;

  const runAndClose = async (action: () => void | Promise<void>) => {
    try {
      await action();
    } finally {
      setDrawerOpen(false);
    }
  };

  const stackedButtons = (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className={cn(
          'w-full justify-center gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30',
          compact ? 'h-11 text-sm' : 'h-11 text-sm',
        )}
        disabled={isActioning}
        onClick={() => {
          void runAndClose(onCharge);
        }}
      >
        {isChargeLoading ? <Loader2 aria-hidden="true" className="h-4 w-4" /> : <Check className="h-4 w-4" strokeWidth={2} />}
        Charge $60
      </Button>
      <Button
        type="button"
        variant="outline"
        className={cn(
          'w-full justify-center gap-2 text-sky-600 border-sky-200 hover:bg-sky-50 dark:text-sky-400 dark:border-sky-800 dark:hover:bg-sky-950/30',
          'h-11 text-sm',
        )}
        disabled={isActioning}
        onClick={() => {
          void runAndClose(onWaive);
        }}
      >
        {isWaiveLoading ? <Loader2 aria-hidden="true" className="h-4 w-4" /> : <Check className="h-4 w-4" strokeWidth={2} />}
        Waive fee
      </Button>
      <Button
        type="button"
        variant="outline"
        className={cn(
          'w-full justify-center gap-2 text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-950/30',
          'h-11 text-sm',
        )}
        disabled={isActioning}
        onClick={() => {
          void runAndClose(onReject);
        }}
      >
        {isRejectLoading ? <Loader2 aria-hidden="true" className="h-4 w-4" /> : <X className="h-4 w-4" strokeWidth={2} />}
        Reject
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <div className={cn('pt-0.5', className)}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            'w-full justify-center gap-1.5',
            compact ? 'h-7 text-[10px] px-2' : 'h-8 text-xs',
          )}
          disabled={isActioning && !drawerOpen}
          onClick={() => setDrawerOpen(true)}
          data-testid="cancellation-actions-open"
        >
          {isActioning && !drawerOpen ? (
            <Loader2 aria-hidden="true" className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
          ) : (
            <MoreHorizontal className={compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} strokeWidth={2} />
          )}
          Review cancellation
        </Button>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} shouldScaleBackground={false}>
          <DrawerContent className="max-h-[85dvh]">
            <DrawerHeader className="pb-2 text-left">
              <DrawerTitle className="text-base">Cancellation actions</DrawerTitle>
              <DrawerDescription className="text-xs">
                {addressLabel || `Shoot #${shootId}`}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {stackedButtons}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 pt-0.5', className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          'gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30',
          compact ? 'h-6 text-[10px] px-2' : 'h-7 text-xs',
        )}
        disabled={isActioning}
        onClick={() => {
          void onCharge();
        }}
      >
        {isChargeLoading ? (
          <Loader2 aria-hidden="true" className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
        ) : (
          <Check className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={2} />
        )}
        Charge $60
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          'gap-1 text-sky-600 border-sky-200 hover:bg-sky-50 dark:text-sky-400 dark:border-sky-800 dark:hover:bg-sky-950/30',
          compact ? 'h-6 text-[10px] px-2' : 'h-7 text-xs',
        )}
        disabled={isActioning}
        onClick={() => {
          void onWaive();
        }}
      >
        {isWaiveLoading ? (
          <Loader2 aria-hidden="true" className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
        ) : (
          <Check className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={2} />
        )}
        Waive fee
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          'gap-1 text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-950/30',
          compact ? 'h-6 text-[10px] px-2' : 'h-7 text-xs',
        )}
        disabled={isActioning}
        onClick={() => {
          void onReject();
        }}
      >
        {isRejectLoading ? (
          <Loader2 aria-hidden="true" className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
        ) : (
          <X className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={2} />
        )}
        Reject
      </Button>
    </div>
  );
}
