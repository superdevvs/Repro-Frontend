import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check, Copy, Loader2, Mail, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { isGuestEmail, MAX_GUEST_RECIPIENTS, normalizeGuestEmails, type GuestInvitation, type GuestInviteResult } from './guestShareTypes';

type Props = {
  busy: boolean;
  results: GuestInviteResult[];
  invitations: GuestInvitation[];
  copiedId: number | null;
  onInvite: (emails: string[]) => Promise<GuestInviteResult[] | null>;
  onCopy: (invitation: GuestInvitation) => void;
  onManage: () => void;
};

export function GuestShareInvitePanel({ busy, results, invitations, copiedId, onInvite, onCopy, onManage }: Props) {
  const inputId = useId();
  const reduceMotion = useReducedMotion();
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [inputError, setInputError] = useState('');
  const collect = (value = draft): string[] | null => {
    const additions = normalizeGuestEmails(value);
    const invalid = additions.find(email => !isGuestEmail(email));
    if (invalid) { setInputError(`Check this email address: ${invalid}`); return null; }
    const next = [...new Set([...emails, ...additions])];
    if (next.length > MAX_GUEST_RECIPIENTS) { setInputError('You can invite up to 20 recipients at a time.'); return null; }
    setInputError(''); return next;
  };
  const add = () => { const next = collect(); if (next) { setEmails(next); setDraft(''); } };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); const next = collect();
    if (!next?.length || busy) return;
    setEmails(next); setDraft('');
    const response = await onInvite(next);
    if (response) setEmails(response.filter(result => result.outcome === 'failed').map(result => result.email));
  };
  const pendingCount = new Set([...emails, ...normalizeGuestEmails(draft)]).size;

  return <div className="space-y-3">
    <p className="text-xs leading-relaxed text-muted-foreground">Email verification required · 30-day access</p>
    <form onSubmit={event => void submit(event)} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={inputId} className="text-xs">Send to</Label>
        <div className={cn('rounded-lg border bg-background p-1.5 transition-shadow focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10', inputError && 'border-destructive/60')}>
          <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
            <AnimatePresence initial={false}>
              {emails.map(email => <motion.span key={email} layout initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.15 }} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-primary/15 bg-primary/10 py-1 pl-2.5 pr-1 text-xs">
                <span className="truncate">{email}</span><button type="button" disabled={busy} aria-label={`Remove ${email}`} onClick={() => setEmails(previous => previous.filter(item => item !== email))} className="rounded-md p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"><X className="h-3 w-3" /></button>
              </motion.span>)}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1">
            <input id={inputId} type="text" inputMode="email" autoComplete="off" value={draft} disabled={busy}
              aria-invalid={Boolean(inputError)} aria-describedby={`${inputId}-hint`} placeholder={emails.length ? 'Add another email…' : 'Add email addresses…'}
              onChange={event => { setDraft(event.target.value); setInputError(''); }}
              onKeyDown={event => { if ((event.key === 'Enter' || event.key === ',') && draft.trim()) { event.preventDefault(); add(); } }}
              className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50" />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-md" disabled={busy || !draft.trim()} onClick={add} aria-label="Add recipient"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <p id={`${inputId}-hint`} className={cn('text-[11px] leading-relaxed', inputError ? 'text-destructive' : 'text-muted-foreground')} role={inputError ? 'alert' : undefined}>{inputError || 'Separate emails with commas or spaces · Up to 20'}</p>
      </div>
      <Button type="submit" disabled={busy || pendingCount === 0} className="h-10 w-full gap-2 rounded-lg text-sm font-medium">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{busy ? 'Sending invitations…' : `Send Magic Link${pendingCount === 1 ? '' : 's'}${pendingCount > 0 ? ` · ${pendingCount}` : ''}`}</Button>
    </form>
    {results.length > 0 && <div className="space-y-1 border-t pt-2">
      <div className="flex items-center justify-between"><h3 className="text-[11px] font-medium text-muted-foreground">Latest invitations</h3><button type="button" onClick={onManage} className="flex min-h-8 items-center gap-1 text-[11px] font-medium text-primary">Manage access<ArrowUpRight className="h-3 w-3" /></button></div>
      <div className="max-h-28 divide-y overflow-y-auto">{results.map(result => {
        const share = invitations.find(item => item.id === result.share?.id) ?? result.share;
        return <div key={result.email} className="flex items-center gap-2 py-2"><div className="min-w-0 flex-1"><p className="truncate text-xs" title={result.email}>{result.email}</p><p className={cn('mt-0.5 break-words text-[11px]', result.outcome === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>{result.outcome === 'sent' ? 'Sent' : result.outcome === 'existing' ? 'Already invited' : result.message || 'Could not send. Try again.'}</p></div>{share?.can_copy && <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0 gap-1.5 rounded-md px-2 text-xs" disabled={busy} onClick={() => onCopy(share)} aria-label={`Copy link for ${result.email}`}>{copiedId === share.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{copiedId === share.id ? 'Copied' : 'Copy'}</Button>}</div>;
      })}</div>
    </div>}
  </div>;
}
