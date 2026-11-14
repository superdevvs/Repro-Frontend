import { useEffect, useState } from 'react';
import { MailWarning } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// Keep this incident notice temporary, including for clients who leave the dashboard open.
const MICROSOFT_EMAIL_NOTICE_EXPIRES_AT = Date.parse('2026-11-21T00:00:00Z');

export function MicrosoftEmailNotice() {
  const [isActive, setIsActive] = useState(() => Date.now() < MICROSOFT_EMAIL_NOTICE_EXPIRES_AT);

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setTimeout(
      () => setIsActive(false),
      Math.max(0, MICROSOFT_EMAIL_NOTICE_EXPIRES_AT - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <section
      aria-label="Microsoft email delays"
      className="!h-auto w-full self-start rounded-2xl border border-sky-300/70 bg-gradient-to-br from-sky-500/15 via-background to-sky-400/5 px-3 py-2 text-foreground shadow-[0_10px_28px_rgba(15,23,42,0.06)]"
    >
      <Dialog>
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 rounded-lg border border-current/15 bg-background/70 p-1.5 text-sky-700 dark:text-sky-300">
            <MailWarning aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">Microsoft email delays</p>
            <p className="truncate text-[11px] leading-4 text-muted-foreground">
              Check the dashboard for delivery updates.
            </p>
          </div>
          <DialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 rounded-full px-2.5 text-xs font-semibold"
            >
              Details
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Microsoft email delays</DialogTitle>
            <DialogDescription className="pt-2 leading-6">
              If you or your office use Outlook, Microsoft 365, or another Microsoft email service,
              RePro emails may be delayed or may not arrive. Please check your dashboard for the latest
              shoot and delivery updates.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">Got it</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
