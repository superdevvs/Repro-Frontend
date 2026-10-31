import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, ImageIcon, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { LISTING_STUDIO_WEBSITE_URL } from '@/config/listingStudio';
import { forgetListingStudioClaim, readListingStudioClaim } from '@/lib/listingStudioClaim';
import { normalizeApiError, type PublicApiError } from '@/services/apiError';
import { claimListingStudioTrials, downloadListingStudioTrial, getListingStudioTrials, type ListingStudioTrial } from '@/services/listingStudioTrials';

const labels = { staging: 'Virtual staging', decluttering: 'Digital decluttering', grass: 'Green grass', twilight: 'Digital twilight' };
const terminalClaimErrors = new Set(['claim_expired', 'claim_conflict', 'trial_allowance_used', 'trial_expired']);
const claimMessages: Record<string, string> = {
  claim_expired: 'This download link has expired. Return to Listing Studio and choose Download again.',
  claim_conflict: 'These photos are already saved to another account. Sign in with that account to download them.',
  trial_allowance_used: 'You have already used this free edit. Your saved photos are listed below.',
  trial_expired: 'This photo has expired. Return to Listing Studio to continue.',
  account_ineligible: 'Sign in with your own active client account to save and download these photos.',
};

export default function ListingStudioClaim() {
  const { user, isImpersonating, logout } = useAuth();
  return <main className="dashboard-viewport overflow-y-auto overscroll-y-contain bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
    <div className="mx-auto max-w-3xl space-y-8">
      <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Listing Studio navigation">
        <a href={LISTING_STUDIO_WEBSITE_URL} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to Listing Studio</a>
        <Button variant="ghost" size="sm" onClick={logout}>Switch account</Button>
      </nav>
      <header className="space-y-3 border-b pb-7">
        <p className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" />REPro · Listing Studio</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your edited photos</h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">Save your finished edits to your account and download the full-size photos.</p>
      </header>
      {user?.role === 'client' && !isImpersonating
        ? <ClaimWorkspace key={user.id} />
        : <section className="space-y-2 rounded-2xl border bg-card p-6"><h2 className="font-semibold">Use your client account</h2><p className="text-sm text-muted-foreground">Sign in with your own active client account to save and download your edited photos.</p></section>}
    </div>
  </main>;
}

type LoadResult = { trials: ListingStudioTrial[]; error: PublicApiError | null };

function ClaimWorkspace() {
  const [token] = useState(readListingStudioClaim);
  const [trials, setTrials] = useState<ListingStudioTrial[]>([]);
  const [error, setError] = useState<PublicApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const request = useRef<Promise<LoadResult> | null>(null);
  const claimed = useRef(false);

  useEffect(() => {
    let canceled = false;
    const load = async (): Promise<LoadResult> => {
      if (token && !claimed.current) {
        try {
          const result = await claimListingStudioTrials(token);
          claimed.current = true;
          forgetListingStudioClaim(token);
          return { trials: result, error: null };
        } catch (failure) {
          const details = normalizeApiError(failure);
          if (terminalClaimErrors.has(details.code)) {
            claimed.current = true;
            forgetListingStudioClaim(token);
          }
          // A stale handoff must not hide photos this account already owns.
          const saved = await getListingStudioTrials().catch(() => []);
          return { trials: saved, error: details };
        }
      }
      try { return { trials: await getListingStudioTrials(), error: null }; }
      catch (failure) { return { trials: [], error: normalizeApiError(failure) }; }
    };
    request.current ??= load();
    void request.current.then(result => {
      if (canceled) return;
      setTrials(result.trials);
      setError(result.error);
      setLoading(false);
    });
    return () => { canceled = true; };
  }, [attempt, token]);

  const refresh = () => {
    request.current = null;
    setLoading(true);
    setError(null);
    setAttempt(value => value + 1);
  };
  const download = async (trial: ListingStudioTrial) => {
    if (downloading) return;
    setDownloading(trial.id);
    setDownloadError('');
    try { await downloadListingStudioTrial(trial); }
    catch (failure) { setDownloadError(normalizeApiError(failure).message); }
    finally { setDownloading(null); }
  };

  return <div className="space-y-5">
    {loading && <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />{token && !claimed.current ? 'Saving your photos…' : 'Loading your photos…'}</p>}
    {error && <section role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm">{claimMessages[error.code] || error.message}</p>
      {!terminalClaimErrors.has(error.code) && <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>Try again</Button>}
    </section>}
    {!loading && trials.length === 0 && !error && <section className="space-y-3 rounded-2xl border border-dashed p-8 text-center">
      <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="font-semibold">No edited photos saved yet</h2>
      <p className="text-sm leading-6 text-muted-foreground">Choose Download on your finished photo in Listing Studio to save it here.</p>
      <Button asChild><a href={LISTING_STUDIO_WEBSITE_URL}>Open Listing Studio</a></Button>
    </section>}
    {trials.length > 0 && <div className="space-y-3">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Saved to your account</h2><Button variant="ghost" size="sm" onClick={refresh} disabled={loading}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh</Button></div>
      {trials.map(trial => <article key={trial.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between" aria-label={labels[trial.service]}>
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><ImageIcon className="h-5 w-5" /></div>
          <div className="min-w-0 space-y-1"><h3 className="font-medium">{labels[trial.service]}</h3>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">{trial.downloadAvailable && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}{trial.downloadAvailable ? 'Ready to download' : trial.status === 'failed' ? 'This edit could not be completed' : trial.status === 'expired' ? 'This photo has expired' : 'Your photo is still processing'}</p>
            {trial.error && <p className="text-sm text-destructive">{trial.error}</p>}
          </div>
        </div>
        <Button className="shrink-0" disabled={!trial.downloadAvailable || downloading !== null} onClick={() => void download(trial)} aria-label={`Download ${labels[trial.service]}`}>
          {downloading === trial.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Download className="mr-2 h-4 w-4" />}{downloading === trial.id ? 'Downloading…' : 'Download photo'}
        </Button>
      </article>)}
    </div>}
    {downloadError && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{downloadError}</p>}
    <p className="text-xs leading-5 text-muted-foreground">One free completed edit per service, per account. Your three-photo team editing offer is separate.</p>
  </div>;
}
