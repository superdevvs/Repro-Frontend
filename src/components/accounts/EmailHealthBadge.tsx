import { Check, Mail, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { EmailHealth, EmailHealthStatus } from '@/types/auth';
import { getEmailHealthClasses, getEmailHealthLabel } from '@/utils/emailHealth';
import { cn } from '@/lib/utils';

interface EmailHealthBadgeProps {
  emailHealth?: EmailHealth | null;
  verified?: boolean;
  className?: string;
}

function resolveStatus(
  emailHealth?: EmailHealth | null,
  verified?: boolean,
): EmailHealthStatus | undefined {
  if (emailHealth) {
    return emailHealth.status ?? 'unverified';
  }
  if (verified === true) {
    return 'verified';
  }
  if (verified === false) {
    return 'unverified';
  }
  return undefined;
}

export function EmailHealthBadge({ emailHealth, verified, className }: EmailHealthBadgeProps) {
  const status = resolveStatus(emailHealth, verified);
  if (!status) {
    return null;
  }

  const label = getEmailHealthLabel(status);
  const isVerified = status === 'verified';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex h-5 items-center gap-0.5 rounded-full border px-1.5',
              getEmailHealthClasses(status),
              className,
            )}
            aria-label={label}
          >
            <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
            {isVerified ? (
              <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <X className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
