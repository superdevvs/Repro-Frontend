import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FreeEditPhotoInput, type FreeEditPhoto } from '@/components/listing-studio/FreeEditPhotoInput';
import { useResendVerificationEmail } from '@/hooks/useResendVerificationEmail';
import { normalizeApiError } from '@/services/apiError';
import { FREE_EDITS_PATH } from '@/config/listingStudio';
import { freeEditsSupportPath, getFreeEditsEligibility, submitFreeEdits, type FreeEditsClaim, type FreeEditsDraft } from '@/services/listingStudioFreeEdits';
import { SupportStatusBadge } from './messaging/SupportPrimitives';

export default function ListingStudioFreeEdits() {
  const { user, isImpersonating } = useAuth();
  return <section className="mx-auto w-full max-w-4xl space-y-6 pb-8">
    <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
    <header className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" />Listing Studio</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your first 3 photo edits are free</h1>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Upload three listing photos and choose an edit for each. Our team will edit them and return the finished photos in your support conversation.</p>
      <p className="text-xs text-muted-foreground">One introductory request per client. No subscription or payment required.</p>
    </header>
    {user?.role === 'client' && !isImpersonating
      ? <FreeEditsWorkspace key={user.id} userId={user.id} />
      : <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Sign in with your client account</h2><p className="mt-2 text-sm text-muted-foreground">This introductory offer is for clients submitting their own photos.</p></section>}
  </section>;
}

function FreeEditsWorkspace({ userId }: { userId: string }) {
  const client = useQueryClient();
  const queryKey = ['listing-studio-free-edits', userId];
  const eligibility = useQuery({ queryKey, queryFn: ({ signal }) => getFreeEditsEligibility(signal), retry: false, refetchOnWindowFocus: true, staleTime: 0 });
  const { resendVerification, isResendingVerification } = useResendVerificationEmail();
  const [verificationFeedback, setVerificationFeedback] = useState('');
  const [photos, setPhotos] = useState<FreeEditPhoto[]>(() => Array.from({ length: 3 }, () => ({ file: null, editType: '' })));
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedClaim, setSubmittedClaim] = useState<FreeEditsClaim | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const pending = useRef(false);
  const draft = useRef<FreeEditsDraft | null>(null);
  const data = eligibility.data;
  const claim = data?.claim || submittedClaim;
  const error = eligibility.isError ? normalizeApiError(eligibility.error) : null;
  const needsVerification = verificationRequired || data?.reason === 'email_not_verified' || error?.code === 'email_not_verified' || error?.code === 'email_verification_required';

  const refresh = async () => {
    const result = await eligibility.refetch();
    if (result.data?.email_verified) setVerificationRequired(false);
  };
  const updatePhoto = (index: number, value: FreeEditPhoto) => {
    if (!data || pending.current) return;
    if (value.file && (!data.offer.allowed_mime_types.includes(value.file.type) || value.file.size > data.offer.max_file_size_bytes || value.file.size === 0)) {
      setNotice('Choose a JPEG, PNG or WebP photo, up to 10 MB.'); return;
    }
    if (value.file && photos.some((photo, position) => position !== index && photo.file && photo.file.name === value.file!.name && photo.file.size === value.file!.size && photo.file.lastModified === value.file!.lastModified)) {
      setNotice('Choose three different photos. This photo is already selected.'); return;
    }
    draft.current = null;
    setNotice('');
    setPhotos(previous => previous.map((photo, position) => position === index ? value : photo));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || !data?.eligible || needsVerification) return;
    if (photos.some(photo => !photo.file || !photo.editType)) { setNotice('Choose three photos and an edit for each before submitting.'); return; }
    if (notes.length > 4000) { setNotice('Keep additional notes to 4,000 characters or fewer.'); return; }
    pending.current = true;
    setSubmitting(true);
    setNotice('');
    // Retain the same request key after a lost response; edited drafts get a new key.
    draft.current ??= { request_key: crypto.randomUUID(), attachments: photos.map(photo => photo.file!), edit_types: photos.map(photo => photo.editType as FreeEditsDraft['edit_types'][number]), notes };
    try {
      const result = await submitFreeEdits(draft.current);
      setSubmittedClaim(result);
      setPhotos(Array.from({ length: 3 }, () => ({ file: null, editType: '' })));
      setNotes('');
      void client.invalidateQueries({ queryKey: ['support-tickets'] });
      void client.invalidateQueries({ queryKey });
    } catch (failure) {
      const details = normalizeApiError(failure);
      if (details.code === 'trial_already_claimed') {
        const existing = (failure as { response?: { data?: { data?: FreeEditsClaim } } }).response?.data?.data;
        if (existing?.ticket_id) setSubmittedClaim(existing);
        else await refresh();
      } else if (details.code === 'email_not_verified' || details.code === 'email_verification_required') {
        setVerificationRequired(true);
      }
      setNotice(Object.values(details.errors ?? {}).flat()[0] || details.message);
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  };

  if (claim) return <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-6" aria-label="Your free edit request">
    <div className="flex flex-wrap items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /><h2 className="font-semibold">Your photo edit request is submitted</h2><SupportStatusBadge status={claim.status} /></div>
    <p className="text-sm leading-6 text-muted-foreground">Follow your request, reply to our team, and download the finished photos from the same support conversation.</p>
    <Button asChild className="w-full sm:w-auto"><Link to={freeEditsSupportPath(claim)}>View request and photos</Link></Button>
    <p className="text-xs text-muted-foreground">Your introductory offer has been used. This request remains available in Support.</p>
  </section>;
  if (eligibility.isPending) return <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking your offer…</p>;
  if (needsVerification) return <section className="space-y-3 rounded-xl border bg-card p-5" aria-label="Verify email for free edits">
    <h2 className="font-semibold">Verify your email to submit your photos</h2>
    <p className="text-sm leading-6 text-muted-foreground">Open the verification link sent to your current email address. Then return here to claim your three free edits.</p>
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button disabled={isResendingVerification} onClick={() => void resendVerification(FREE_EDITS_PATH).then(result => setVerificationFeedback(result.message))}>{isResendingVerification ? 'Sending…' : 'Send verification email'}</Button>
      <Button variant="outline" disabled={eligibility.isFetching} onClick={() => void refresh()}>I’ve verified my email</Button>
    </div>
    {verificationFeedback && <p role="status" className="text-sm">{verificationFeedback}</p>}
  </section>;
  if (error) return <section role="alert" className="space-y-3 rounded-xl border p-5"><h2 className="font-semibold">We couldn’t check your offer</h2><p className="text-sm text-muted-foreground">{error.message}</p><Button variant="outline" disabled={eligibility.isFetching} onClick={() => void refresh()}>Try again</Button></section>;
  if (!data?.eligible) return <section className="space-y-3 rounded-xl border p-5"><h2 className="font-semibold">This introductory offer has already been used</h2><p className="text-sm text-muted-foreground">Each client can submit one request for three free edits. If you need help finding your request, contact our team in Support.</p><Button asChild variant="outline"><Link to="/messaging/email/inbox?tab=support">Open Support</Link></Button></section>;
  return <form onSubmit={submit} className="space-y-5" aria-label="Free photo edit request">
    <div><h2 className="font-semibold">Choose your 3 photos</h2><p className="mt-1 text-sm text-muted-foreground">JPEG, PNG or WebP, up to 10 MB each. One edit per photo.</p><p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{photos.filter(photo => photo.file).length} of 3 photos selected</p></div>
    <div className="grid min-w-0 gap-4 md:grid-cols-3">{photos.map((photo, index) => <FreeEditPhotoInput key={index} index={index} value={photo} offer={data.offer} disabled={submitting} onChange={value => updatePhoto(index, value)} />)}</div>
    <div className="space-y-2"><Label htmlFor="free-edit-notes">Additional notes (optional)</Label><Textarea id="free-edit-notes" value={notes} disabled={submitting} maxLength={4000} rows={4} placeholder="Tell us what you’d like for each photo, such as a preferred staging style." onChange={event => { draft.current = null; setNotes(event.target.value); }} /></div>
    {notice && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{notice}</p>}
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Our team receives all three photos together in one request.</p><Button type="submit" disabled={submitting} className="w-full shrink-0 sm:w-auto">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{submitting ? 'Submitting photos…' : 'Submit 3 free photo edits'}</Button></div>
  </form>;
}
