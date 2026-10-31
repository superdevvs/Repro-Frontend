import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { beginStudioPurchase, forgetStudioPurchase, readStudioPurchase, type StudioPurchaseAttempt } from '@/lib/listingStudioPurchase';
import { normalizeApiError } from '@/services/apiError';
import { listingStudioClient } from '@/services/listingStudioClientService';
import type { StudioAccount, StudioCatalog, StudioFundingMethod, StudioOrder, StudioQuote, StudioService, StudioSource, StudioUpload } from '@/types/listingStudioClient';
import { studioLabels, studioMoney } from './studioPresentation';

export interface StudioRevisionSource { source: StudioSource; service: StudioService }
interface Props {
  accountId: string; account: StudioAccount; catalog: StudioCatalog; revision?: StudioRevisionSource | null;
  onCreated: (order: StudioOrder) => void; onCancelRevision: () => void;
}
const definitivePurchaseErrors = new Set(['quote_expired', 'quote_stale', 'insufficient_credits', 'source_unavailable', 'service_unavailable', 'validation_error', 'validation_failed']);
const selectClass = 'h-11 w-full rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

export function StudioNewEdit({ accountId, account, catalog, revision, onCreated, onCancelRevision }: Props) {
  const [service, setService] = useState<StudioService>(revision?.service ?? 'staging');
  const [roomType, setRoomType] = useState(catalog.stagingOptions.defaults.roomType);
  const [style, setStyle] = useState(catalog.stagingOptions.defaults.style);
  const [instructions, setInstructions] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [upload, setUpload] = useState<StudioUpload | null>(null);
  const [quote, setQuote] = useState<StudioQuote | null>(null);
  const [funding, setFunding] = useState<StudioFundingMethod>('credits');
  const [pending, setPending] = useState<StudioPurchaseAttempt | null>(() => readStudioPurchase(accountId));
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const uploadKey = useRef<string | null>(null);
  const chosenService = catalog.services.find(item => item.id === service);
  const available = revision ? chosenService?.revisionAvailable : chosenService?.aiAvailable;

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const invalidate = () => { setQuote(null); setError(''); };
  const chooseFile = (candidate: File | undefined) => {
    invalidate(); setUpload(null); setFile(null); uploadKey.current = null;
    if (!candidate) return;
    if (!catalog.uploadConstraints.mimeTypes.includes(candidate.type) || candidate.size > catalog.uploadConstraints.maxFileBytes || !candidate.size) {
      setError('Choose one JPEG, PNG or WebP photo up to 10 MiB.'); return;
    }
    setFile(candidate);
  };
  const review = async () => {
    if (inFlight.current || pending) return;
    if (!revision && !file) { setError('Choose a photo first.'); return; }
    if (revision && !instructions.trim()) { setError('Tell our team what you would like changed.'); return; }
    inFlight.current = true; setBusy(true); setError('');
    try {
      let source = revision?.source;
      if (!source && file) {
        setStep('Uploading your photo…');
        uploadKey.current ??= crypto.randomUUID();
        const saved = upload ?? await listingStudioClient.upload(file, uploadKey.current);
        setUpload(saved); source = { kind: 'upload', id: saved.id };
      }
      if (!source) return;
      setStep('Preparing your quote…');
      const result = await listingStudioClient.quote({
        kind: revision ? 'human_revision' : 'ai_edit', service, source,
        options: !revision && service === 'staging' ? { roomType, style } : {},
        ...(revision ? { instructions: instructions.trim() } : {}),
      });
      setQuote(result); setFunding(result.fundingOptions.credits.available ? 'credits' : 'card');
    } catch (failure) {
      const details = normalizeApiError(failure);
      if (!revision && details.code === 'source_unavailable') { setUpload(null); uploadKey.current = null; }
      setError(details.message);
    }
    finally { inFlight.current = false; setBusy(false); setStep(''); }
  };
  const purchase = async () => {
    if (inFlight.current || (!quote && !pending)) return;
    inFlight.current = true; setBusy(true); setError(''); setStep(pending ? 'Checking your existing request…' : 'Creating your order…');
    let attempt = pending;
    try {
      attempt ??= beginStudioPurchase(accountId, quote!.id, funding); setPending(attempt);
      const result = await listingStudioClient.createOrder(attempt.quoteId, attempt.fundingMethod, attempt.key);
      forgetStudioPurchase(accountId, attempt.key); setPending(null); setQuote(null); onCreated(result.order);
    } catch (failure) {
      const details = normalizeApiError(failure);
      if (attempt && definitivePurchaseErrors.has(details.code)) {
        forgetStudioPurchase(accountId, attempt.key); setPending(null); setQuote(null);
        if (!revision && details.code === 'source_unavailable') { setUpload(null); uploadKey.current = null; }
      }
      setError(details.message);
    } finally { inFlight.current = false; setBusy(false); setStep(''); }
  };

  if (pending) return <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
    <h2 className="text-lg font-semibold">Check your existing request</h2>
    <p className="max-w-xl text-sm leading-6 text-muted-foreground">We haven’t confirmed the outcome of your last purchase yet. Recover that request before starting another edit.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button disabled={busy} onClick={() => void purchase()}><RefreshCw className="mr-2 h-4 w-4" />{busy ? step : 'Check existing request'}</Button>
  </section>;

  return <section className="grid gap-6 rounded-2xl border bg-card p-5 sm:p-6 lg:grid-cols-[1fr_0.85fr]">
    <div className="space-y-5">
      <div className="space-y-2"><h2 className="text-lg font-semibold">{revision ? 'Request a team revision' : 'Start a new edit'}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{revision ? 'Our editing team will work from your saved photo. This is a separate order.' : 'Upload one photo, choose an edit, and review the exact price before you continue.'}</p>
      </div>
      {!revision && <div className="space-y-2"><Label htmlFor="studio-client-photo">Your photo</Label><Input id="studio-client-photo" type="file" accept={catalog.uploadConstraints.mimeTypes.join(',')} disabled={busy} onChange={event => chooseFile(event.target.files?.[0])} /><p className="text-xs text-muted-foreground">JPEG, PNG or WebP · Up to 10 MiB · One photo</p></div>}
      {preview && <img src={preview} alt="Selected property photo" className="max-h-60 w-full rounded-xl border object-contain" />}
      {revision ? <p className="rounded-xl bg-muted p-3 text-sm font-medium">{studioLabels[service]} · Saved result</p> : <fieldset className="space-y-2" disabled={busy}>
        <legend className="mb-2 text-sm font-medium">Choose an edit</legend><div className="grid grid-cols-2 gap-2">
          {catalog.services.map(item => <label key={item.id} className={`cursor-pointer rounded-xl border p-3 ${service === item.id ? 'border-primary bg-primary/5' : 'bg-background'} ${!item.aiAvailable ? 'opacity-60' : ''}`}>
            <input className="sr-only peer" type="radio" name="studio-service" value={item.id} checked={service === item.id} onChange={() => { setService(item.id); invalidate(); }} />
            <span className="block rounded text-sm font-medium peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary">{item.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{studioMoney(item.aiPriceCents)} / photo{!item.aiAvailable ? ' · Unavailable' : ''}</span>
          </label>)}
        </div>
      </fieldset>}
      {!revision && service === 'staging' && <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="studio-room">Room</Label><select id="studio-room" className={selectClass} value={roomType} disabled={busy} onChange={event => { setRoomType(event.target.value); invalidate(); }}>{Object.entries(catalog.stagingOptions.rooms).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="studio-style">Style</Label><select id="studio-style" className={selectClass} value={style} disabled={busy} onChange={event => { setStyle(event.target.value); invalidate(); }}>{Object.entries(catalog.stagingOptions.styles).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
      </div>}
      {revision && <div className="space-y-2"><Label htmlFor="studio-revision-instructions">What would you like changed?</Label><Textarea id="studio-revision-instructions" value={instructions} disabled={busy} maxLength={catalog.revisionConstraints.maxInstructionsLength} onChange={event => { setInstructions(event.target.value); invalidate(); }} rows={5} /><Button variant="ghost" size="sm" disabled={busy} onClick={onCancelRevision}>Cancel revision request</Button></div>}
      {!available && <p className="text-sm text-muted-foreground">This service is currently unavailable. Your saved photos remain available.</p>}
      {!account.capabilities.canCreateOrder && <p className="text-sm text-muted-foreground">{account.notice || 'New paid edits are not available right now.'}</p>}
      <Button disabled={busy || !available || !account.capabilities.canCreateOrder || (!revision && !file)} onClick={() => void review()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Upload className="mr-2 h-4 w-4" />}{busy ? step : 'Review price'}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
    <div className="rounded-xl border bg-background p-5">
      {quote ? <div className="space-y-5">
        <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Your quote</p><h3 className="mt-2 text-lg font-semibold">{studioLabels[quote.service]}{quote.kind === 'human_revision' ? ' revision' : ''}</h3></div>
        <dl className="space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>Photo edit</dt><dd>{studioMoney(quote.pricing.basePriceCents)}</dd></div>{quote.pricing.discountCents > 0 && <div className="flex justify-between gap-3 text-emerald-700 dark:text-emerald-400"><dt>Plan discount ({quote.pricing.discountPercent}%)</dt><dd>−{studioMoney(quote.pricing.discountCents)}</dd></div>}<div className="flex justify-between gap-3 border-t pt-3 text-base font-semibold"><dt>Total</dt><dd>{studioMoney(quote.pricing.totalPriceCents)}</dd></div></dl>
        <fieldset disabled={busy} className="space-y-3"><legend className="mb-3 text-sm font-medium">How would you like to pay?</legend>
          <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="radio" name="studio-funding" value="credits" checked={funding === 'credits'} disabled={!quote.fundingOptions.credits.available} onChange={() => setFunding('credits')} /><span>Use {studioMoney(quote.pricing.creditCostCents)} editing credit<span className="block text-xs leading-5 text-muted-foreground">{quote.fundingOptions.credits.available ? `${studioMoney(account.credits.availableCents)} available` : quote.fundingOptions.credits.shortfallCents > 0 ? `${studioMoney(quote.fundingOptions.credits.shortfallCents)} more credit needed` : 'Editing credit is unavailable'}</span></span></label>
          <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="radio" name="studio-funding" value="card" checked={funding === 'card'} disabled={!quote.fundingOptions.card.available} onChange={() => setFunding('card')} /><span>Pay {studioMoney(quote.pricing.totalPriceCents)} by card<span className="block text-xs leading-5 text-muted-foreground">One photo. No subscription required.</span></span></label>
        </fieldset>
        <p className="text-xs leading-5 text-muted-foreground">{funding === 'credits' ? 'Credit is reserved when you confirm and used only after the finished photo is saved. Unused period credit does not roll over.' : 'Continue to Stripe for secure payment. Editing starts after payment is confirmed.'}</p>
        <Button className="w-full" disabled={busy || !(funding === 'credits' ? quote.fundingOptions.credits.available : quote.fundingOptions.card.available)} onClick={() => void purchase()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ArrowRight className="mr-2 h-4 w-4" />}{busy ? step : funding === 'credits' ? `Confirm · use ${studioMoney(quote.pricing.creditCostCents)} credit` : `Continue · pay ${studioMoney(quote.pricing.totalPriceCents)}`}</Button>
      </div> : <div className="space-y-3 py-6"><h3 className="font-semibold">A clear price before you start</h3><p className="text-sm leading-6 text-muted-foreground">Your quote will appear here. Pay with your available editing credit or by card.</p><p className="text-xs leading-5 text-muted-foreground">Instant free trials and the three-photo team offer are separate from paid editing.</p></div>}
    </div>
  </section>;
}
