import { AlertTriangle, Loader2, MailCheck, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmailHealthBadge } from '@/components/accounts/EmailHealthBadge';
import type { EmailHealth } from '@/types/auth';
import { cn } from '@/lib/utils';

interface ClientEmailHealthNoticeProps {
  email?: string | null;
  emailHealth?: EmailHealth;
  onManageEmail?: () => void;
  onResendVerification?: () => void;
  resendPending?: boolean;
  className?: string;
  variant?: 'card' | 'banner';
}

type NoticeConfig = {
  title: string;
  description: string;
  compactTitle: string;
  compactDescription: string;
  accentClasses: string;
  showResend: boolean;
};

const buildNoticeConfig = (email: string, emailHealth?: EmailHealth): NoticeConfig | null => {
  const status = emailHealth?.status;
  if (!status || status === 'verified') {
    return null;
  }

  if (status === 'bounced' || status === 'invalid') {
    return {
      title: 'Update your email before we send anything else',
      description:
        emailHealth?.bounce_reason
          ? `We could not deliver mail to ${email}. Reason: ${emailHealth.bounce_reason}. Automated emails and portal invites are blocked until you fix it.`
          : `We could not deliver mail to ${email}. Automated emails and portal invites are blocked until you fix it.`,
      compactTitle: 'Email delivery failed',
      compactDescription: 'Update this address to restore booking, invoice, and portal emails.',
      accentClasses:
        'border-rose-300/60 bg-gradient-to-br from-rose-500/15 via-background to-rose-400/5 text-foreground',
      showResend: false,
    };
  }

  if (status === 'risky') {
    return {
      title: 'Double-check this email address',
      description:
        emailHealth?.warning_message
          ? `${emailHealth.warning_message} We will keep important automated emails limited until the address is verified.`
          : `We flagged ${email} as risky. Review it now so booking, invoice, and delivery emails reach the right inbox.`,
      compactTitle: 'Possible delivery risk',
      compactDescription: 'Review this address now. Important automated emails stay limited until it is verified.',
      accentClasses:
        'border-amber-300/60 bg-gradient-to-br from-amber-500/15 via-background to-amber-400/5 text-foreground',
      showResend: true,
    };
  }

  return {
    title: 'Check your inbox to verify your email',
    description: `We sent a verification email to ${email}. Verify it so booking, invoice, and delivery emails can reach you normally.`,
    compactTitle: 'Verify your email',
    compactDescription: 'Check your inbox so booking, invoice, and delivery emails work normally.',
    accentClasses:
      'border-sky-300/60 bg-gradient-to-br from-sky-500/15 via-background to-sky-400/5 text-foreground',
    showResend: true,
  };
};

export function ClientEmailHealthNotice({
  email,
  emailHealth,
  onManageEmail,
  onResendVerification,
  resendPending = false,
  className,
  variant = 'card',
}: ClientEmailHealthNoticeProps) {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) {
    return null;
  }

  const config = buildNoticeConfig(normalizedEmail, emailHealth);
  if (!config) {
    return null;
  }

  if (variant === 'banner') {
    return (
      <section
        className={cn(
          'w-full rounded-2xl border px-3.5 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.07)] backdrop-blur-sm sm:max-w-[34rem]',
          config.accentClasses,
          className,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-current/15 bg-background/70 p-2">
              {emailHealth?.status === 'unverified' ? (
                <MailCheck className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold tracking-tight">{config.compactTitle}</p>
                <EmailHealthBadge emailHealth={emailHealth} />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">{config.compactDescription}</p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {config.showResend && onResendVerification && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 rounded-full px-3 text-xs font-semibold"
                onClick={onResendVerification}
                disabled={resendPending}
              >
                {resendPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {resendPending ? 'Sending' : 'Resend'}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full px-3 text-xs font-semibold"
              onClick={onManageEmail}
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Update
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'rounded-3xl border p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]',
        config.accentClasses,
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl border border-current/15 bg-background/60 p-2.5">
            {emailHealth?.status === 'unverified' ? (
              <MailCheck className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg">{config.title}</h2>
              <EmailHealthBadge emailHealth={emailHealth} />
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{config.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {config.showResend && onResendVerification && (
            <Button type="button" variant="secondary" onClick={onResendVerification} disabled={resendPending}>
              {resendPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {resendPending ? 'Sending...' : 'Resend verification'}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onManageEmail}>
            <Settings2 className="mr-2 h-4 w-4" />
            Update email
          </Button>
        </div>
      </div>
    </section>
  );
}
