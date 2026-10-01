import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, LifeBuoy, Plus, Search } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createSupportTicket, getSupportTicket, listSupportAssignees, listSupportTickets, replySupportTicket, supportStatusLabel, updateSupportTicket, type SupportStatus, type TicketDraft, type SupportTicket, type TicketDetail } from '@/services/supportTickets';

const categories = ['account', 'booking', 'delivery', 'billing', 'uploads', 'calls', 'other'];
const selectClass = 'h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-sm';
const when = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const errorText = (error: unknown) => {
  const value = error as { response?: { status?: number; data?: { message?: string } } };
  if (value.response?.status === 409) return 'This request changed or was already submitted. Refresh it before trying again. Your draft is still here.';
  return value.response?.data?.message || 'We could not save this change. Your draft is still here. Please try again.';
};
const newDraft = (): TicketDraft => ({ request_key: crypto.randomUUID(), subject: '', body: '', category: 'other' });

export default function Support() {
  const { user } = useAuth();
  return user ? <SupportWorkspace key={`${user.id}:${user.role}`} /> : null;
}

function SupportWorkspace() {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const ticketId = Number(params.get('ticket')) || 0;
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [messagePage, setMessagePage] = useState(1);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const [draft, setDraft] = useState<TicketDraft>(newDraft);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [replyKey, setReplyKey] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState('');
  const client = useQueryClient();
  const identity = [user?.id, user?.role];
  useEffect(() => { const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { setMessagePage(1); setReply(''); setInternal(false); setReplyKey(crypto.randomUUID()); setNotice(''); }, [ticketId, user?.id]);
  const list = useQuery({ queryKey: ['support-tickets', ...identity, query, status, page], queryFn: ({ signal }) => listSupportTickets({ page, query, status: status || undefined }, signal), enabled: Boolean(user), refetchInterval: 30000 });
  const listData = list.isError ? undefined : list.data;
  const detail = useQuery({ queryKey: ['support-ticket', ...identity, ticketId, messagePage], queryFn: ({ signal }) => getSupportTicket(ticketId, messagePage, signal), enabled: Boolean(user && ticketId), retry: false, refetchInterval: 15000 });
  const ticket = detail.isError ? undefined : detail.data?.data;
  const assignees = useQuery({ queryKey: ['support-assignees', ...identity], queryFn: listSupportAssignees, enabled: Boolean(user && !list.isError && listData?.meta.can_manage) });
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['support-tickets'] }), client.invalidateQueries({ queryKey: ['support-ticket'] }), client.invalidateQueries({ queryKey: ['notifications'] })]); };
  const select = (id?: number) => setParams(id ? { ticket: String(id) } : {});
  const cacheTicket = (result: SupportTicket) => client.setQueriesData<TicketDetail>(
    { queryKey: ['support-ticket', ...identity, result.id] },
    current => current ? { ...current, data: result } : current,
  );
  const create = useMutation({ mutationFn: createSupportTicket, onSuccess: (result) => { if (!active.current) return; setCreating(false); setDraft(newDraft()); select(result.id); setNotice('Request saved. The support team can see it in their dashboard.'); void refresh(); } });
  const send = useMutation({ mutationFn: () => replySupportTicket(ticketId, { request_key: replyKey, body: reply.trim(), internal }), onSuccess: (result) => { if (!active.current) return; cacheTicket(result); if (result.id === ticketId) { setReply(''); setReplyKey(crypto.randomUUID()); setMessagePage(1); setNotice(internal ? 'Internal note saved.' : 'Reply saved.'); } void refresh(); } });
  const update = useMutation({ mutationFn: (changes: { status?: SupportStatus; priority?: 'normal' | 'urgent'; assigned_to?: number | null }) => updateSupportTicket(ticketId, { ...changes, version: ticket!.version }), onSuccess: (result) => { if (!active.current) return; cacheTicket(result); if (result.id === ticketId) setNotice('Request updated.'); void refresh(); } });
  const pending = create.isPending || send.isPending || update.isPending;
  const pagination = listData?.meta.pagination;
  const fail = send.error || update.error;

  return <DashboardLayout><div className="mx-auto w-full max-w-7xl space-y-5 px-1 py-4 pb-28 md:px-4 md:pb-8">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 text-sm text-primary"><LifeBuoy className="h-4 w-4" />Support</div><h1 className="text-2xl font-semibold tracking-tight">{listData?.meta.can_manage ? 'Support inbox' : 'Your support requests'}</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Get help, keep the conversation together and follow its progress.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="min-h-11"><Link to="/chat-with-reproai?tab=help"><BookOpen className="mr-2 h-4 w-4" />Help & guides</Link></Button><Button className="min-h-11" onClick={() => { create.reset(); setCreating(true); }}><Plus className="mr-2 h-4 w-4" />New request</Button></div></header>
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(280px,350px)_minmax(0,1fr)]">
      <section aria-label="Support request list" className={`min-w-0 space-y-3 ${ticketId ? 'hidden lg:block' : ''}`}>
        <div className="relative"><Search aria-hidden className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search support requests" placeholder="Search subject or request number" value={search} onChange={e => setSearch(e.target.value)} className="h-11 pl-9" /></div>
        <select aria-label="Request status filter" className={`${selectClass} w-full`} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{(['open', 'in_progress', 'waiting', 'resolved'] as const).map(value => <option key={value} value={value}>{supportStatusLabel(value)}</option>)}</select>
        {list.isLoading && <p role="status">Loading requests…</p>}
        {list.isError && <div role="alert" className="rounded-xl border p-4 text-sm">Could not load requests.<Button className="mt-2 block" variant="outline" onClick={() => void list.refetch()}>Retry requests</Button></div>}
        {!list.isLoading && !list.isError && listData?.data.length === 0 && <div className="rounded-xl border border-dashed p-6 text-sm"><h2 className="font-semibold">No requests found</h2><p className="mt-2 text-muted-foreground">Try a different search or create a request when you need help.</p></div>}
        <div className="max-h-[56dvh] space-y-2 overflow-y-auto overscroll-contain pr-1 lg:max-h-[calc(100dvh-360px)]">{!list.isError && listData?.data.map(item => <button key={item.id} onClick={() => select(item.id)} className={`w-full rounded-xl border bg-card p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${ticketId === item.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{item.reference}</span><span className={item.status === 'resolved' ? 'text-emerald-700 dark:text-emerald-400' : ''}>{supportStatusLabel(item.status)}</span></div><h2 className="mt-2 break-words text-sm font-semibold">{item.subject}</h2><p className="mt-1 text-xs text-muted-foreground">{listData.meta.can_manage ? `${item.requester?.name || 'Account'} · ` : ''}{when(item.updated_at)}</p>{item.priority === 'urgent' && <span className="mt-2 inline-block text-xs font-medium text-amber-700 dark:text-amber-400">Urgent</span>}</button>)}</div>
        {pagination && <nav aria-label="Support request pages" className="flex items-center justify-between gap-2 border-t pt-3"><Button className="min-h-11" variant="outline" disabled={page <= 1 || list.isFetching} onClick={() => setPage(v => v - 1)}>Previous</Button><span className="text-xs text-muted-foreground">{page} / {pagination.last_page} · {pagination.total}</span><Button className="min-h-11" variant="outline" disabled={page >= pagination.last_page || list.isFetching} onClick={() => setPage(v => v + 1)}>Next</Button></nav>}
      </section>
      <section aria-label="Support conversation" className={`min-w-0 ${!ticketId ? 'hidden lg:block' : ''}`}>
        {!ticketId && <div className="rounded-2xl border border-dashed p-10 text-center"><LifeBuoy className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="font-semibold">Choose a request</h2><p className="mt-2 text-sm text-muted-foreground">Replies and status updates stay here.</p></div>}
        {ticketId > 0 && <Button variant="ghost" className="mb-3 min-h-11" onClick={() => select()}><ArrowLeft className="mr-2 h-4 w-4" />All requests</Button>}
        {detail.isLoading && ticketId > 0 && <p role="status">Loading conversation…</p>}
        {detail.isError && <div role="alert" className="rounded-xl border p-5"><h2 className="font-semibold">Request unavailable</h2><p className="mt-2 text-sm text-muted-foreground">You may not have access, or the request could not load.</p><Button variant="outline" className="mt-3" onClick={() => void detail.refetch()}>Retry conversation</Button></div>}
        {ticket && <div className="space-y-5 rounded-2xl border bg-card p-4 md:p-6">
          <header><p className="text-xs text-muted-foreground">{ticket.reference} · {ticket.category}</p><h2 className="mt-2 break-words text-xl font-semibold">{ticket.subject}</h2><p className="mt-2 text-sm text-muted-foreground">{ticket.requester?.name} · {supportStatusLabel(ticket.status)}{ticket.assignee ? ` · With ${ticket.assignee.name}` : ''}</p>{ticket.page_path && <Link className="mt-2 inline-block text-sm text-primary underline" to={ticket.page_path}>Open related page</Link>}</header>
          {ticket.can_manage ? <div className="grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-3"><label className="space-y-1 text-xs">Status<select aria-label="Request status" className={`${selectClass} w-full`} value={ticket.status} disabled={pending} onChange={e => update.mutate({ status: e.target.value as SupportStatus })}>{(['open', 'in_progress', 'waiting', 'resolved'] as const).map(v => <option key={v} value={v}>{supportStatusLabel(v)}</option>)}</select></label><label className="space-y-1 text-xs">Assigned to<select aria-label="Assigned administrator" className={`${selectClass} w-full`} value={ticket.assignee?.id || ''} disabled={pending || assignees.isError} onChange={e => update.mutate({ assigned_to: e.target.value ? Number(e.target.value) : null })}><option value="">Unassigned</option>{assignees.data?.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label className="space-y-1 text-xs">Priority<select aria-label="Request priority" className={`${selectClass} w-full`} value={ticket.priority} disabled={pending} onChange={e => update.mutate({ priority: e.target.value as 'normal' | 'urgent' })}><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label>{assignees.isError && <p className="text-xs text-destructive">Could not load administrators.</p>}</div> : <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => update.mutate({ status: ticket.status === 'resolved' ? 'open' : 'resolved' })}>{ticket.status === 'resolved' ? 'Reopen request' : 'Mark resolved'}</Button>}
          <div aria-label="Request messages" className="max-h-[55dvh] space-y-4 overflow-y-auto overscroll-contain pr-1">{detail.data?.messages.map(item => <article key={item.id} className={`rounded-xl p-4 ${item.internal ? 'border border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100' : item.kind === 'event' ? 'border border-dashed text-muted-foreground' : 'bg-muted/50'}`}><header className="mb-2 flex flex-wrap justify-between gap-1 text-xs"><span className="font-semibold">{item.author?.name || 'Support'}{item.internal ? ' · Internal note' : ''}</span><time dateTime={item.created_at}>{when(item.created_at)}</time></header><p className="whitespace-pre-wrap break-words text-sm leading-6">{item.body}</p></article>)}</div>
          {detail.data && detail.data.meta.last_page > 1 && <nav aria-label="Conversation pages" className="flex items-center justify-between gap-2"><Button variant="outline" disabled={messagePage >= detail.data.meta.last_page || detail.isFetching} onClick={() => setMessagePage(v => v + 1)}>Older messages</Button><span className="text-xs">{messagePage} / {detail.data.meta.last_page}</span><Button variant="outline" disabled={messagePage <= 1 || detail.isFetching} onClick={() => setMessagePage(v => v - 1)}>Newer messages</Button></nav>}
          <form className="space-y-3 border-t pt-4" onSubmit={e => { e.preventDefault(); if (!pending && reply.trim()) send.mutate(); }}><label className="block text-sm font-medium" htmlFor="support-reply">{internal ? 'Internal note' : 'Reply'}</label><Textarea id="support-reply" disabled={pending} value={reply} onChange={e => setReply(e.target.value)} rows={4} maxLength={8000} placeholder="Describe what happened or share an update…" required /><p className="text-xs text-muted-foreground">Keep passwords, card details and property access codes out of your message.</p><div className="flex flex-wrap items-center justify-between gap-3">{ticket.can_manage && <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={pending} checked={internal} onChange={e => setInternal(e.target.checked)} />Internal note · admins only</label>}<Button className="min-h-11" disabled={pending || !reply.trim()} type="submit">{send.isPending ? 'Saving…' : internal ? 'Save internal note' : 'Send reply'}</Button></div></form>
          {fail && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{errorText(fail)}<Button className="ml-2" variant="outline" onClick={() => void refresh()}>Refresh request</Button></div>}
          {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        </div>}
      </section>
    </div>
    <Dialog open={creating} onOpenChange={value => { if (!create.isPending) setCreating(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New support request</DialogTitle><DialogDescription>Tell the team what you need. You can follow replies here.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={e => { e.preventDefault(); create.mutate({ ...draft, subject: draft.subject.trim(), body: draft.body.trim() }); }}><label className="block space-y-2 text-sm">Subject<Input aria-label="Request subject" disabled={create.isPending} value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} minLength={3} maxLength={180} required /></label><label className="block space-y-2 text-sm">Topic<select aria-label="Request topic" disabled={create.isPending} className={`${selectClass} w-full capitalize`} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label className="block space-y-2 text-sm">What happened?<Textarea aria-label="Request details" disabled={create.isPending} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} rows={5} minLength={10} maxLength={8000} required placeholder="What were you trying to do? Which page? What did you see?" /></label><p className="text-xs text-muted-foreground">Do not include passwords, payment card details or property access codes. This sends a dashboard request; it does not place a call or send an email.</p>{create.isError && <p role="alert" className="text-sm text-destructive">{errorText(create.error)}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={create.isPending} onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" className="min-h-11" disabled={create.isPending || draft.subject.trim().length < 3 || draft.body.trim().length < 10}>{create.isPending ? 'Saving…' : 'Submit request'}</Button></div></form></DialogContent></Dialog>
  </div></DashboardLayout>;
}
