import { useId, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { beginStudioAiRevision, forgetStudioAiRevision, readStudioAiRevision } from '@/lib/listingStudioAiRevision';
import { normalizeApiError } from '@/services/apiError';
import { listingStudioClient } from '@/services/listingStudioClientService';
import type { StudioOrder } from '@/types/listingStudioClient';

export function StudioAiRevisions({ accountId, order, onUpdated }: { accountId: string; order: StudioOrder; onUpdated: (order: StudioOrder) => void }) {
  const inputId = useId();
  const [pending, setPending] = useState(() => readStudioAiRevision(accountId, order.id));
  const [instructions, setInstructions] = useState(pending?.instructions || ''); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const lock = useRef(false); const usage = order.aiRevisions;
  const examples = { staging: 'Use a lighter rug and keep the furniture placement.', decluttering: 'Remove the remaining items on the countertop and keep the furniture.', grass: 'Make the lawn a natural, even green and preserve the landscaping.', twilight: 'Add a softer sunset glow and warm window lighting.' };
  if (order.kind !== 'ai_edit' || !usage) return null;
  const request = async () => {
    if (lock.current || (!pending && (!usage.canRequest || instructions.trim().length < 3))) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const attempt = pending || beginStudioAiRevision(accountId, order.id, instructions); setPending(attempt);
      const result = await listingStudioClient.aiRevision(order.id, attempt.instructions, attempt.key);
      forgetStudioAiRevision(accountId, order.id); setPending(null); setInstructions(''); onUpdated(result.order);
    } catch (failure) {
      const details = normalizeApiError(failure);
      if (['ai_revision_limit', 'ai_revision_unavailable', 'ai_revision_active', 'validation_failed', 'validation_error'].includes(details.code)) { forgetStudioAiRevision(accountId, order.id); setPending(null); }
      setError(details.message);
    } finally { lock.current = false; setBusy(false); }
  };
  return <section className="space-y-3 rounded-xl bg-muted/40 p-4" aria-label="Included AI revisions"><div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />Refine your photo</h2><span className="whitespace-nowrap rounded-full border px-2 py-1 text-[10px]">{usage.used} of {usage.limit} used</span></div><p className="text-xs leading-5 text-muted-foreground">Up to {usage.limit} AI revisions are included with this edit. Your previous versions stay available.</p>
    {usage.active ? <p role="status" className="rounded-lg border p-3 text-xs leading-5">{usage.active.status === 'needs_attention' ? usage.active.error : `Revision ${usage.active.number} is ${usage.active.status === 'queued' ? 'queued' : 'processing'}.`}</p> : usage.remaining === 0 ? <p className="text-xs leading-5 text-muted-foreground">All three included revisions have been used. Choose any saved version to download.</p> : <><Label htmlFor={inputId} className="text-xs">What would you like to change?</Label><Textarea id={inputId} value={instructions} onChange={event => setInstructions(event.target.value)} maxLength={1500} disabled={busy || Boolean(pending) || !usage.canRequest} rows={3} placeholder={`For example, ${examples[order.service]}`} className="min-h-20 text-xs" />{!pending && <Button className="w-full" disabled={busy || !usage.canRequest || instructions.trim().length < 3} onClick={() => void request()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}Request AI revision · {usage.remaining} remaining</Button>}</>}
    {!usage.active && usage.remaining > 0 && !usage.canRequest && <p role="status" className="text-xs leading-5 text-muted-foreground">AI revisions are temporarily unavailable. Your saved versions remain available.</p>}
    {pending && <div className="space-y-2"><p className="text-xs leading-5 text-muted-foreground">Check your existing request before submitting another revision.</p><Button variant="outline" className="w-full" disabled={busy} onClick={() => void request()}>{busy ? 'Checking request…' : 'Check existing revision'}</Button></div>}{error && <p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
  </section>;
}
