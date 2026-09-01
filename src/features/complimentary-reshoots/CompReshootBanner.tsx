import { AlertTriangle, ExternalLink, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getCompReshootReasonLabel } from './model';
import type { CompReshootBookingController } from './useCompReshootBooking';

type CompReshootBannerProps = {
  controller: CompReshootBookingController;
  onOpenSource: () => void;
  onExit: () => void;
  onConvertToAdditionalWork: () => void;
};

export function CompReshootBanner({
  controller,
  onOpenSource,
  onExit,
  onConvertToAdditionalWork,
}: CompReshootBannerProps) {
  const { template, isLoading, loadError, reasonCode } = controller;
  const reasonLabel = template?.reasonOptions.find((option) => option.code === reasonCode)?.label
    ?? (reasonCode ? getCompReshootReasonLabel(reasonCode) : 'Choose reason in this step');

  return (
    <section
      aria-label="Complimentary reshoot mode"
      className="sticky top-0 z-30 rounded-xl border border-amber-300/70 bg-amber-50/95 px-3 py-2.5 shadow-sm backdrop-blur dark:border-amber-700/60 dark:bg-amber-950/90 sm:px-4"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-2 lg:w-[min(34%,26rem)]">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-200/70 text-amber-800 dark:bg-amber-800/50 dark:text-amber-100">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-50">Comp reshoot</h2>
              <span className="rounded-full border border-amber-300/80 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:border-amber-700 dark:text-amber-100">
                Client $0
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="mt-1 h-3 w-48 bg-amber-200/70 dark:bg-amber-800/50" />
            ) : (
              <button
                type="button"
                onClick={onOpenSource}
                disabled={!template?.source.id}
                className="mt-0.5 flex max-w-full items-center gap-1 text-left text-xs text-amber-800 hover:underline disabled:no-underline disabled:opacity-70 dark:text-amber-200"
                title={template?.source.address || undefined}
              >
                <span className="truncate">
                  {template ? `From #${template.source.id} · ${template.source.address || 'Source shoot'}` : 'Loading source shoot…'}
                </span>
                {template?.source.id && <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>

        {loadError ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-rose-700 dark:text-rose-200" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="truncate">{loadError}</span>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={controller.retry}>Retry</Button>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-amber-900 dark:text-amber-100">
              Reason: {reasonLabel}
            </p>
            {template?.policyVersion && (
              <p className="truncate text-[10px] text-amber-700 dark:text-amber-300">
                Policy {template.policyVersion}
              </p>
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-amber-900 hover:bg-amber-200/60 dark:text-amber-100 dark:hover:bg-amber-900"
            onClick={onConvertToAdditionalWork}
          >
            Additional work instead
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-900 hover:bg-amber-200/60 dark:text-amber-100 dark:hover:bg-amber-900"
            onClick={onExit}
            aria-label="Exit comp reshoot mode"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
