import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Check, GitBranch, Mail, Repeat, StickyNote, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { crmApi } from '../api';
import { useCrmMutation } from '../hooks';
import { toLocalInput, when } from '../format';
import type { Proposal } from '../types';

const ICONS = { note: StickyNote, event: CalendarPlus, stage: GitBranch, email: Mail, drip: Repeat } as const;
const TITLES = { note: 'Add a note', event: 'Schedule a follow-up', stage: 'Change stage', email: 'Send an email', drip: 'Enrol in a drip' } as const;

/**
 * One Robbie suggestion. Nothing happens until the owner presses Confirm;
 * editable fields can be changed first. Emails still go through the content
 * check and the approved-signature rules on the server.
 */
export function ProposalCard({ proposal, onDone }: { proposal: Proposal; onDone?: (p: Proposal) => void }) {
  const Icon = ICONS[proposal.kind];
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [state, setState] = useState(proposal);
  const p = state.payload as Record<string, string | number | undefined>;
  const value = (k: string) => edits[k] ?? String(p[k] ?? '');

  const confirm = useCrmMutation(
    () => crmApi.post<{ proposal: Proposal }>(`/robbie/proposals/${proposal.id}/confirm`, { edits: Object.keys(edits).length ? normalise(edits) : undefined }),
    { success: 'Done' },
  );
  const dismiss = useCrmMutation(() => crmApi.post<{ proposal: Proposal }>(`/robbie/proposals/${proposal.id}/dismiss`), { invalidate: [] });

  const finish = (r: { proposal: Proposal }) => { setState(r.proposal); setEditing(false); onDone?.(r.proposal); };
  const decided = state.status !== 'pending';

  return (
    <div className={cn('overflow-hidden rounded-[10px] border bg-card', decided && 'opacity-80')}>
      <div className="flex items-center gap-2 border-b crm-bg-thead px-3 py-2 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {TITLES[proposal.kind]}
        {proposal.contact && <Link to={`/crm/contacts/${proposal.contact.id}`} className="ml-auto truncate font-medium text-muted-foreground hover:text-foreground">{proposal.contact.name}</Link>}
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-2.5 text-[13px] leading-[18px]">
        {!editing && <Summary proposal={state} />}
        {editing && (
          <div className="flex flex-col gap-2">
            {proposal.editable.includes('body') && <Textarea aria-label="Note" rows={3} value={value('body')} onChange={(e) => setEdits({ ...edits, body: e.target.value })} />}
            {proposal.editable.includes('starts_at') && <Input aria-label="When" type="datetime-local" value={edits.starts_at ?? toLocalInput(String(p.starts_at ?? ''))} onChange={(e) => setEdits({ ...edits, starts_at: e.target.value })} />}
            {proposal.editable.includes('note') && <Input aria-label="Note for the follow-up" value={value('note')} onChange={(e) => setEdits({ ...edits, note: e.target.value })} />}
            {proposal.editable.includes('subject') && <Input aria-label="Subject" value={value('subject')} onChange={(e) => setEdits({ ...edits, subject: e.target.value })} />}
            {proposal.editable.includes('body_html') && <Textarea aria-label="Email body" rows={6} value={value('body_html')} onChange={(e) => setEdits({ ...edits, body_html: e.target.value })} />}
          </div>
        )}
        {confirm.error && <p className="crm-text-red text-xs" role="alert">{confirm.error.message}</p>}
      </div>
      <div className="flex items-center gap-1.5 border-t px-3 py-2">
        {state.status === 'pending' ? (
          <>
            <Button size="sm" className="h-7 px-2.5 text-xs" disabled={confirm.isPending} onClick={() => confirm.mutate(undefined, { onSuccess: finish })}>
              <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />{proposal.kind === 'email' ? 'Send' : 'Confirm'}
            </Button>
            {proposal.editable.length > 0 && <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setEditing((e) => !e)}>{editing ? 'Done editing' : 'Edit'}</Button>}
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs text-muted-foreground" disabled={dismiss.isPending} onClick={() => dismiss.mutate(undefined, { onSuccess: finish })}>
              <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />Dismiss
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{state.status === 'confirmed' ? 'Done · logged via Robbie' : state.status === 'dismissed' ? 'Dismissed' : 'Expired'}</span>
        )}
      </div>
    </div>
  );
}

function Summary({ proposal }: { proposal: Proposal }) {
  const p = proposal.payload as Record<string, string | undefined>;
  switch (proposal.kind) {
    case 'note':
      return <p className="whitespace-pre-wrap">{p.body}</p>;
    case 'event':
      return <p><span className="font-medium capitalize">{String(p.type ?? 'follow-up').replace('_', ' ')}</span> · {when(p.starts_at)}{p.note ? <><br /><span className="text-muted-foreground">{p.note}</span></> : null}</p>;
    case 'email':
      return <><p className="font-medium">{p.subject ?? 'From the template'}</p>{p.body_html && <div className="line-clamp-4 text-muted-foreground crm-draft-preview" dangerouslySetInnerHTML={{ __html: sanitise(p.body_html) }} />}</>;
    default:
      return <p>{proposal.summary}</p>;
  }
}

/** The server re-sanitises before sending; this only keeps the preview to simple markup. */
function sanitise(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,img,form').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => [...el.attributes].forEach((a) => { if (a.name !== 'href') el.removeAttribute(a.name); }));
  doc.querySelectorAll('a').forEach((a) => { if (!/^https?:/i.test(a.getAttribute('href') ?? '')) a.removeAttribute('href'); });
  return doc.body.innerHTML;
}

function normalise(edits: Record<string, string>) {
  const out: Record<string, string> = { ...edits };
  if (out.starts_at && !out.starts_at.includes('Z') && out.starts_at.length <= 16) out.starts_at = new Date(out.starts_at).toISOString();
  return out;
}
