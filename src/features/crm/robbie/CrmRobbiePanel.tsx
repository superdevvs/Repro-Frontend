import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, CalendarCheck, Loader2, Phone, Mail, X } from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { crmApi, toApiError } from '../api';
import type { PlanItem, Proposal } from '../types';
import { ProposalCard } from './ProposalCard';
import { useCrmRobbie } from './useCrmRobbie';

type Turn =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; proposals?: Proposal[] }
  | { role: 'plan'; items: PlanItem[] };

const SUGGESTIONS: Record<string, string[]> = {
  contact: ['Brief me on this contact', 'Draft a check-in email', 'Schedule a call for tomorrow 10am'],
  pipeline: ['Plan my day', 'Who is waiting longest for a reply?', 'Which leads went quiet this week?'],
  follow_ups: ['Plan my day', 'Which overdue follow-ups matter most?'],
  default: ['Plan my day', 'Which clients haven’t booked in a while?', 'Who are my newest leads?'],
};

/**
 * Robbie's side panel (frame R1; bottom sheet on phones, M6). Knows the page
 * and record, answers from the CRM tools only, and shows suggestions as
 * cards the user confirms.
 */
export function CrmRobbiePanel({ className, onClose }: { className?: string; onClose?: () => void }) {
  const robbie = useCrmRobbie();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const where = robbie?.where ?? { page: 'home' };

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [turns, busy]);

  // A question queued by the strip or a page button.
  useEffect(() => {
    if (robbie?.pending) {
      const prompt = robbie.pending;
      robbie.clearPending();
      void send(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robbie?.pending]);

  async function planDay() {
    setBusy(true);
    setError(null);
    setTurns((t) => [...t, { role: 'user', content: 'Plan my day' }]);
    try {
      const res = await crmApi.get<{ data: PlanItem[] }>('/robbie/plan-day');
      setTurns((t) => [...t, { role: 'plan', items: res.data }]);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    if (/^plan my day\.?$/i.test(message)) { await planDay(); return; }
    const history = turns.filter((t): t is Extract<Turn, { role: 'user' | 'assistant' }> => t.role !== 'plan').map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: 'user', content: message }]);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await crmApi.post<{ reply: string; proposals: Proposal[] }>('/robbie/chat', {
        message, history, page: where.page, entity_type: where.entityType, entity_id: where.entityId,
      });
      setTurns((t) => [...t, { role: 'assistant', content: res.reply, proposals: res.proposals }]);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = SUGGESTIONS[where.page] ?? SUGGESTIONS.default;

  return (
    <aside aria-label="Robbie" className={cn('flex min-h-0 flex-col overflow-hidden rounded-[14px] border bg-card shadow-[0_8px_24px_-12px_hsl(210_40%_10%/.18)]', className)}>
      <div className="flex min-h-[62px] items-center gap-2.5 border-b px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent"><ReproAiIcon className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-4">Robbie</p>
          <p className="truncate text-[11.5px] text-muted-foreground">{where.label ? `Looking at ${where.label}` : 'Your sales assistant'}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close Robbie" onClick={() => (onClose ? onClose() : robbie?.setOpen(false))}><X className="h-4 w-4" /></Button>
      </div>

      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
        {turns.length === 0 && (
          <div className="flex gap-2.5">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-accent"><ReproAiIcon className="h-4 w-4" /></span>
            <p className="text-[13px] leading-5">I can look up your contacts, plan your day and draft notes, follow-ups and emails. Nothing changes until you confirm it.</p>
          </div>
        )}
        {turns.map((t, i) => {
          if (t.role === 'user') return <p key={i} className="max-w-[280px] self-end rounded-[12px_12px_4px_12px] bg-primary px-3 py-2 text-[13px] leading-[19px] text-primary-foreground">{t.content}</p>;
          if (t.role === 'plan') return <PlanList key={i} items={t.items} onAsk={(q) => void send(q)} />;
          return (
            <div key={i} className="flex flex-col gap-2.5">
              <div className="flex gap-2.5">
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-accent"><ReproAiIcon className="h-4 w-4" /></span>
                <p className="whitespace-pre-wrap text-[13px] leading-5">{t.content}</p>
              </div>
              {t.proposals?.map((p) => <ProposalCard key={p.id} proposal={p} />)}
            </div>
          );
        })}
        {busy && <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" />Robbie is thinking…</p>}
        {error && <p className="crm-text-red text-xs" role="alert">{error}</p>}
      </div>

      <div className="flex flex-col gap-2 border-t px-3.5 pb-3.5 pt-3">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => void send(s)} className="inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium hover:bg-secondary">{s}</button>
            ))}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex min-h-10 items-center gap-2 rounded-[10px] border bg-background pl-3 pr-1.5 focus-within:ring-2 focus-within:ring-primary/20">
          <label htmlFor="crm-robbie-input" className="sr-only">Ask Robbie</label>
          <input id="crm-robbie-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your contacts…" className="min-w-0 flex-1 bg-transparent py-2 text-[13px] outline-none placeholder:text-muted-foreground" autoComplete="off" />
          <Button type="submit" size="icon" className="h-7 w-7 rounded-lg" disabled={busy || !input.trim()} aria-label="Send"><ArrowUp className="h-4 w-4" /></Button>
        </form>
        <p className="text-[11px] leading-[15px] text-muted-foreground">Robbie sees only the contacts you can see. Suggestions wait for your confirmation.</p>
      </div>
    </aside>
  );
}

function PlanList({ items, onAsk }: { items: PlanItem[]; onAsk: (q: string) => void }) {
  if (items.length === 0) {
    return <p className="rounded-[10px] border crm-bg-thead px-3.5 py-3 text-[13px]">Nothing is due today. A good time to check on clients who haven’t booked in a while.</p>;
  }
  return (
    <div className="overflow-hidden rounded-[10px] border">
      <div className="flex items-center gap-2 border-b crm-bg-thead px-3 py-2 text-xs font-semibold"><CalendarCheck className="h-3.5 w-3.5 text-primary" />Your day, in order</div>
      <ol className="divide-y">
        {items.map((item, i) => (
          <li key={`${item.kind}-${item.event_id ?? item.contact?.id ?? i}`} className="flex items-start gap-2.5 px-3 py-2.5">
            <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold', item.kind === 'overdue' || item.kind === 'first_contact' ? 'bg-[hsl(var(--crm-red-soft))] crm-text-red' : 'bg-secondary text-muted-foreground')}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              {item.contact ? <Link to={`/crm/contacts/${item.contact.id}`} className="block truncate text-[12.5px] font-medium hover:underline">{item.title}</Link> : <p className="truncate text-[12.5px] font-medium">{item.title}</p>}
              <p className="text-[11.5px] text-muted-foreground">{item.reason}</p>
            </div>
            {item.contact?.phone && item.action.kind === 'call' && <a href={`tel:${item.contact.phone}`} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Call ${item.contact.name}`}><Phone className="h-3.5 w-3.5" /></a>}
            {item.contact && item.action.kind === 'email' && (
              <button type="button" onClick={() => onAsk(`Draft a check-in email to ${item.contact?.name} (contact ${item.contact?.id})`)} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Draft an email to ${item.contact.name}`}><Mail className="h-3.5 w-3.5" /></button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
