import { AlertCircle, ArrowRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ClientPropertyFormActionsProps = {
  submitAttemptNotice: string | null;
  showClearSavedData: boolean;
  onClearSavedData?: () => void;
  onBack?: () => void;
};

export function ClientPropertyFormActions({
  submitAttemptNotice,
  showClearSavedData,
  onClearSavedData,
  onBack,
}: ClientPropertyFormActionsProps) {
  return (
    <div className="mt-6 flex flex-col gap-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:pb-0">
      {submitAttemptNotice && (
        <div
          id="property-continue-warning"
          role="alert"
          className="w-full rounded-xl border border-amber-300/70 bg-amber-50/95 px-3 py-2.5 text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 sm:mr-auto sm:max-w-md"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700/90 dark:text-amber-200/90">
                Action required
              </p>
              <p className="mt-0.5 text-sm leading-snug">{submitAttemptNotice}</p>
            </div>
          </div>
        </div>
      )}
      {showClearSavedData && onClearSavedData && (
        <Button type="button" variant="outline" onClick={onClearSavedData} className="w-full sm:hidden">
          Clear saved data
        </Button>
      )}
      {onBack && (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="w-full sm:h-14 sm:w-auto sm:min-w-[150px] sm:border-slate-200 sm:bg-white sm:text-base sm:font-semibold sm:text-slate-700 sm:hover:bg-slate-50 dark:sm:border-muted/40 dark:sm:bg-card/60 dark:sm:text-slate-300"
        >
          <ChevronLeft className="mr-2 hidden h-5 w-5 sm:inline" />
          Back
        </Button>
      )}
      <Button
        type="submit"
        className="w-full sm:h-14 sm:w-auto sm:min-w-[200px] sm:bg-blue-600 sm:text-xl sm:font-bold sm:text-white sm:hover:bg-blue-700"
      >
        Continue
        <ArrowRight className="ml-2 hidden h-5 w-5 sm:inline" />
      </Button>
    </div>
  );
}
