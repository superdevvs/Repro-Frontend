import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleUserRound } from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { readTaxDocument } from '@/services/taxDocuments';
import {
  profileCompletionItems,
  profileCompletionSummary,
  type TaxDocumentCompletion,
} from '@/features/dashboard/profileCompletion';

export function ProfileCompletionNotice() {
  const { user, isImpersonating } = useAuth();
  const [taxDocument, setTaxDocument] = useState<TaxDocumentCompletion>('unknown');

  useEffect(() => {
    if (user?.role !== 'photographer' || isImpersonating) {
      setTaxDocument('unknown');
      return;
    }
    const controller = new AbortController();
    setTaxDocument('unknown');
    readTaxDocument(controller.signal).then((summary) => {
      if (!controller.signal.aborted) setTaxDocument(summary ? 'present' : 'missing');
    }).catch(() => {
      if (!controller.signal.aborted) setTaxDocument('unknown');
    });
    return () => controller.abort();
  }, [isImpersonating, user?.id, user?.role]);

  const summary = profileCompletionSummary(profileCompletionItems(user, taxDocument));
  if (!summary.next || summary.done) return null;

  return (
    <section
      aria-label="Finish your profile"
      className="!h-auto w-full self-start rounded-2xl border border-amber-300/70 bg-gradient-to-br from-amber-500/15 via-background to-amber-400/5 px-3 py-2 text-foreground shadow-[0_10px_28px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-center gap-2.5">
        <span className="rounded-lg border border-current/15 bg-background/70 p-1.5 text-amber-700 dark:text-amber-300">
          <CircleUserRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">Finish your profile</p>
          <p className="truncate text-[11px] leading-4 text-muted-foreground">
            {summary.complete} of {summary.total} complete · Next: {summary.next.label}
          </p>
        </div>
        <Button type="button" size="sm" className="h-7 shrink-0 rounded-full px-2.5 text-xs font-semibold" asChild>
          <Link to={summary.next.href}>
            Continue
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
