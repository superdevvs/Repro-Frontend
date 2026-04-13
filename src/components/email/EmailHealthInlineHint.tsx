import { Button } from '@/components/ui/button';
import type { EmailHealth } from '@/types/auth';
import type { LocalEmailHealthHint } from '@/utils/emailHealth';
import { cn } from '@/lib/utils';

interface EmailHealthInlineHintProps {
  email?: string;
  localHint?: LocalEmailHealthHint;
  serverEmailHealth?: EmailHealth;
  warningOverride?: boolean;
  onUseSuggestion?: (nextEmail: string) => void;
  onKeepAnyway?: () => void;
  className?: string;
}

const getToneClasses = (status?: string, level?: string) => {
  if (status === 'bounced' || status === 'invalid' || level === 'error') {
    return 'border-rose-300/60 bg-rose-500/10 text-rose-900 dark:text-rose-100';
  }

  if (status === 'risky' || level === 'warning') {
    return 'border-amber-300/60 bg-amber-500/10 text-amber-950 dark:text-amber-100';
  }

  return 'border-sky-300/60 bg-sky-500/10 text-sky-950 dark:text-sky-100';
};

export function EmailHealthInlineHint({
  email,
  localHint,
  serverEmailHealth,
  warningOverride = false,
  onUseSuggestion,
  onKeepAnyway,
  className,
}: EmailHealthInlineHintProps) {
  if (!email?.trim()) {
    return null;
  }

  const message = serverEmailHealth?.warning_message ?? localHint?.message;
  const suggestedCorrection = serverEmailHealth?.suggested_correction ?? localHint?.suggestedCorrection;
  const requiresConfirmation = Boolean(
    serverEmailHealth?.requires_confirmation ?? localHint?.requiresConfirmation,
  );
  const status = serverEmailHealth?.status ?? localHint?.status ?? undefined;
  const level = localHint?.level ?? 'none';

  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm shadow-sm',
        getToneClasses(status ?? undefined, level),
        className,
      )}
    >
      <p className="leading-6">{message}</p>

      {requiresConfirmation && suggestedCorrection && !warningOverride && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onUseSuggestion?.(suggestedCorrection)}
          >
            Use suggested email
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onKeepAnyway?.()}>
            Keep anyway
          </Button>
        </div>
      )}

      {requiresConfirmation && warningOverride && (
        <p className="mt-3 text-xs opacity-80">
          You chose to keep this address. We&apos;ll save it as risky until it&apos;s verified.
        </p>
      )}
    </div>
  );
}
