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
  variant?: 'inline' | 'floating';
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

const getSuggestionLabel = (suggestedCorrection?: string | null) => {
  if (!suggestedCorrection) {
    return 'Use suggested email';
  }

  const suggestedDomain = suggestedCorrection.split('@')[1];
  return suggestedDomain ? `Use ${suggestedDomain}` : 'Use suggested email';
};

const getCompactMessage = ({
  message,
  suggestedCorrection,
  requiresConfirmation,
  status,
}: {
  message?: string;
  suggestedCorrection?: string | null;
  requiresConfirmation: boolean;
  status?: string;
}) => {
  if (requiresConfirmation && suggestedCorrection) {
    const suggestedDomain = suggestedCorrection.split('@')[1];
    return suggestedDomain ? `Possible typo. Use ${suggestedDomain}?` : 'Possible typo. Use suggested email?';
  }

  if (status === 'risky') {
    return 'Unusual email domain. Please confirm.';
  }

  if (status === 'unverified') {
    return 'Email will need verification.';
  }

  return message;
};

export function EmailHealthInlineHint({
  email,
  localHint,
  serverEmailHealth,
  warningOverride = false,
  onUseSuggestion,
  onKeepAnyway,
  variant = 'inline',
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
  const displayMessage =
    variant === 'floating'
      ? getCompactMessage({
          message,
          suggestedCorrection,
          requiresConfirmation,
          status,
        })
      : message;

  if (!displayMessage) {
    return null;
  }

  return (
    <div
      className={cn(
        variant === 'floating'
          ? 'absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 rounded-2xl border px-3 py-3 text-sm shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/95 md:left-auto md:right-0 md:w-[19rem]'
          : 'rounded-2xl border px-4 py-3 text-sm shadow-sm',
        getToneClasses(status ?? undefined, level),
        className,
      )}
    >
      <p className={cn('leading-6', variant === 'floating' && 'text-sm font-medium leading-5')}>
        {displayMessage}
      </p>

      {requiresConfirmation && suggestedCorrection && !warningOverride && (
        <div className={cn('mt-3 flex flex-wrap gap-2', variant === 'floating' && 'mt-2')}>
          <Button
            type="button"
            size={variant === 'floating' ? 'sm' : 'sm'}
            variant="secondary"
            onClick={() => onUseSuggestion?.(suggestedCorrection)}
            className={cn(variant === 'floating' && 'h-8 rounded-xl px-3 text-xs font-semibold')}
          >
            {getSuggestionLabel(suggestedCorrection)}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onKeepAnyway?.()}
            className={cn(variant === 'floating' && 'h-8 rounded-xl px-3 text-xs font-semibold')}
          >
            {variant === 'floating' ? 'Keep' : 'Keep anyway'}
          </Button>
        </div>
      )}

      {requiresConfirmation && warningOverride && (
        <p className={cn('mt-3 text-xs opacity-80', variant === 'floating' && 'mt-2 leading-5')}>
          {variant === 'floating'
            ? 'Keeping this as risky until verified.'
            : "You chose to keep this address. We'll save it as risky until it's verified."}
        </p>
      )}
    </div>
  );
}
