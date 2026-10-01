import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Plus, RefreshCw, Search, Send } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { SupportFiles, SupportMessage, SupportStatusBadge } from './messaging/SupportPrimitives';
import { readSupportComposePrefill, readSupportReplyPrefill } from './messaging/messagingSupport';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createSupportTicket, getSupportTicket, listSupportAssignees, listSupportTickets, replySupportTicket, supportStatusLabel, supportTime, updateSupportTicket, type SupportStatus, type TicketDraft, type SupportTicket, type TicketDetail } from '@/services/supportTickets';

const categories = ['account', 'booking', 'delivery', 'billing', 'uploads', 'calls', 'other'];
const selectClass = 'h-9 min-w-0 rounded-lg border border-input bg-background px-3 text-sm';
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
  const messageFeed = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const prefill = readSupportComposePrefill(location.state, user?.id);
  const ticketId = Number(params.get('ticket')) || 0;
  const replyPrefill = readSupportReplyPrefill(location.state, user?.id, ticketId);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [messagePage, setMessagePage] = useState(1);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const [draft, setDraft] = useState<TicketDraft>(() => ({ ...newDraft(), ...(prefill ? { subject: prefill.subject, body: prefill.body } : {}) }));
  const [files, setFiles] = useState<File[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [reply, setReply] = useState(replyPrefill?.body || '');
  const [internal, setInternal] = useState(false);
  const [replyKey, setReplyKey] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState('');
  const client = useQueryClient();
  const identity = [user?.id, user?.role];
  useEffect(() => { if (query === search.trim()) return; const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [search, query]);
  const newRequested = params.get('new') === '1';
  useEffect(() => { if (newRequested) setCreating(true); }, [newRequested]);
  const closeCreate = () => {
    setCreating(false);
    setParams(current => { const next = new URLSearchParams(current); next.delete('new'); return next; }, { replace: true, state: location.state });
  };
  useEffect(() => { setMessagePage(1); followLatest.current = true; setReply(replyPrefill?.body || ''); setReplyFiles([]); setInternal(false); setReplyKey(crypto.randomUUID()); setNotice(''); }, [ticketId, user?.id, replyPrefill?.body]);
  const list = useQuery({ queryKey: ['support-tickets', ...identity, query, status, page], queryFn: ({ signal }) => listSupportTickets({ page, query, status: status || undefined }, signal), enabled: Boolean(user), refetchInterval: 30000 });
  const listData = list.isError ? undefined : list.data;
  const detail = useQuery({ queryKey: ['support-ticket', ...identity, ticketId, messagePage], queryFn: ({ signal }) => getSupportTicket(ticketId, messagePage, signal), enabled: Boolean(user && ticketId), retry: false, refetchInterval: 15000, placeholderData: (previous, previousQuery) => previousQuery?.queryKey[3] === ticketId ? previous : undefined });
  useEffect(() => {
    const feed = messageFeed.current;
    if (feed && messagePage === 1 && followLatest.current) feed.scrollTop = feed.scrollHeight;
  }, [detail.data?.messages, messagePage]);
  const ticket = detail.isError ? undefined : detail.data?.data;
  const assignees = useQuery({ queryKey: ['support-assignees', ...identity], queryFn: listSupportAssignees, enabled: Boolean(user && !list.isError && listData?.meta.can_manage) });
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['support-tickets'] }), client.invalidateQueries({ queryKey: ['support-ticket'] }), client.invalidateQueries({ queryKey: ['notifications'] })]); };
  const select = (id?: number) => setParams(current => {
    const next = new URLSearchParams(current);
    next.set('tab', 'support');
    next.delete('new');
    if (id) next.set('ticket', String(id)); else next.delete('ticket');
    return next;
  });
  const cacheTicket = (result: SupportTicket) => client.setQueriesData<TicketDetail>(
    { queryKey: ['support-ticket', ...identity, result.id] },
    current => current ? { ...current, data: result } : current,
  );
  const create = useMutation({ mutationFn: createSupportTicket, onSuccess: (result) => { if (!active.current) return; setCreating(false); setDraft(newDraft()); setFiles([]); select(result.id); setNotice('Request saved. The support team can see it in their dashboard.'); void refresh(); } });
  const send = useMutation({ mutationFn: () => replySupportTicket(ticketId, { request_key: replyKey, body: reply.trim(), internal, attachments: replyFiles }), onSuccess: (result) => { if (!active.current) return; cacheTicket(result); if (result.id === ticketId) { if (replyPrefill) setParams(current => current, { replace: true, state: null }); followLatest.current = true; setReply(''); setReplyFiles([]); setReplyKey(crypto.randomUUID()); setMessagePage(1); setNotice(internal ? 'Internal note saved.' : 'Reply saved.'); } void refresh(); } });
  const update = useMutation({ mutationFn: (changes: { status?: SupportStatus; priority?: 'normal' | 'urgent'; assigned_to?: number | null }) => updateSupportTicket(ticketId, { ...changes, version: ticket!.version }), onSuccess: (result) => { if (!active.current) return; cacheTicket(result); if (result.id === ticketId) setNotice('Request updated.'); void refresh(); } });
  const pending = create.isPending || send.isPending || update.isPending;
  const pagination = listData?.meta.pagination;
  const fail = send.error || update.error;

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 pt-3">
    <header className="flex shrink-0 items-center justify-between gap-2 px-1">
      <div className="min-w-0"><h1 className="text-lg font-semibold tracking-tight">{listData?.meta.can_manage ? 'Support inbox' : 'Your support requests'}</h1><p className="hidden text-xs text-muted-foreground sm:block">{listData?.meta.can_manage ? 'One place for questions, replies and next steps.' : 'Message the team and follow every update here.'}</p></div>
      <div className="flex shrink-0 items-center gap-1.5"><Button asChild variant="ghost" size="sm" className="h-9 px-2"><Link to="/chat-with-reproai?tab=help" aria-label="Help & guides"><BookOpen className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Help & guides</span></Link></Button><Button size="sm" className="h-9" onClick={() => { create.reset(); setCreating(true); }}><Plus className="mr-1.5 h-4 w-4" />New request</Button></div>
    </header>
    <div className="grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(260px,330px)_minmax(0,1fr)]">
      <section aria-label="Support request list" className={`min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card ${ticketId ? 'hidden lg:flex' : 'flex'}`}>
        <div className="shrink-0 space-y-2 border-b p-3"><div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search aria-hidden className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search support requests" placeholder="Search requests" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-9" /></div><Button variant="ghost" size="icon" className="h-10 w-9 shrink-0" aria-label="Refresh requests" disabled={list.isFetching} onClick={() => void list.refetch()}><RefreshCw className={`h-4 w-4 ${list.isFetching ? 'animate-spin' : ''}`} /></Button></div>
          <select aria-label="Request status filter" className={`${selectClass} w-full`} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{(['open', 'in_progress', 'waiting', 'resolved'] as const).map(value => <option key={value} value={value}>{supportStatusLabel(value)}</option>)}</select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {list.isLoading && <p role="status" className="p-5 text-sm text-muted-foreground">Loading requests…</p>}
          {list.isError && <div role="alert" className="p-5 text-sm">Could not load requests.<Button className="mt-3 block" variant="outline" onClick={() => void list.refetch()}>Retry requests</Button></div>}
          {!list.isLoading && !list.isError && listData?.data.length === 0 && <EmptyState className="min-h-full" size="compact" icon={query || status ? 'search' : 'conversations'} title={query || status ? 'No matching requests' : 'All clear for now'} description={query || status ? 'Try another search or status to find your conversation.' : listData.meta.can_manage ? 'New support requests from every role will appear here.' : 'Need a hand? Start a request and the team will help you here.'} action={query || status ? <Button variant="outline" size="sm" onClick={() => { setSearch(''); setQuery(''); setStatus(''); setPage(1); }}>Clear filters</Button> : <Button variant="outline" size="sm" onClick={() => { create.reset(); setCreating(true); }}>Start a request</Button>} />}
          {!list.isError && listData?.data.map(item => <button key={item.id} onClick={() => select(item.id)} aria-current={ticketId === item.id ? 'true' : undefined} className={`block w-full border-b px-3.5 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${ticketId === item.id ? 'bg-primary/5 shadow-[inset_3px_0_0_hsl(var(--primary))]' : 'hover:bg-muted/50'}`}>
            <div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{item.reference}</span><SupportStatusBadge status={item.status} /></div><h2 className="line-clamp-2 break-words text-sm font-semibold leading-5">{item.subject}</h2>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span className="truncate">{listData.meta.can_manage ? item.requester?.name || 'Account' : item.assignee ? `With ${item.assignee.name}` : 'Support team'}</span>{item.priority === 'urgent' && <span className="font-medium text-amber-700 dark:text-amber-400">Urgent</span>}</div><time className="mt-1 block text-[10px] text-muted-foreground" dateTime={item.updated_at}>{supportTime(item.updated_at)}</time>
          </button>)}
        </div>
        {pagination && <nav aria-label="Support request pages" className="flex shrink-0 items-center justify-between gap-2 border-t bg-card px-3 py-2"><Button size="sm" className="h-9" variant="ghost" disabled={page <= 1 || list.isFetching} onClick={() => setPage(v => v - 1)}>Previous</Button><span className="text-[11px] text-muted-foreground">{page} / {pagination.last_page} · {pagination.total}</span><Button size="sm" className="h-9" variant="ghost" disabled={page >= pagination.last_page || list.isFetching} onClick={() => setPage(v => v + 1)}>Next</Button></nav>}
      </section>
      <section aria-label="Support conversation" className={`min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card ${!ticketId ? 'hidden lg:flex' : 'flex'}`}>
        {!ticketId && <EmptyState className="min-h-0 flex-1" icon="conversations" title="Every conversation, in one place" description="Choose a request to see its messages and progress, or start a new one. Replies stay with the request." />}
        {ticketId > 0 && !ticket && <div className="p-3"><Button variant="ghost" size="sm" onClick={() => select()}><ArrowLeft className="mr-2 h-4 w-4" />All requests</Button></div>}
        {detail.isLoading && ticketId > 0 && <p role="status" className="p-5 text-sm text-muted-foreground">Loading conversation…</p>}
        {detail.isError && <div role="alert" className="p-5"><h2 className="font-semibold">Request unavailable</h2><p className="mt-2 text-sm text-muted-foreground">You may not have access, or the request could not load.</p><Button variant="outline" className="mt-3" onClick={() => void detail.refetch()}>Retry conversation</Button></div>}
        {ticket && <>
          <header className="max-h-[45%] shrink-0 overflow-y-auto border-b px-3 py-2.5 sm:px-4"><div className="mb-1 flex items-center justify-between gap-2"><Button variant="ghost" size="sm" className="-ml-2 h-7 text-xs" onClick={() => select()}><ArrowLeft className="mr-1 h-3.5 w-3.5" />All requests</Button><SupportStatusBadge status={ticket.status} /></div><h2 className="break-words text-base font-semibold leading-5">{ticket.subject}</h2><div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground"><span>{ticket.reference}</span><span className="capitalize">{ticket.category}</span><span>{ticket.requester?.name}</span>{ticket.assignee && <span>With {ticket.assignee.name}</span>}{ticket.page_path?.startsWith('/') && !ticket.page_path.startsWith('//') && <Link className="text-primary underline" to={ticket.page_path}>Open related page</Link>}</div>
            {ticket.can_manage ? <details className="mt-2"><summary className="w-fit cursor-pointer py-1 text-xs font-medium text-primary">Manage request</summary><div className="grid gap-2 pt-2 sm:grid-cols-3"><label className="space-y-1 text-xs">Status<select aria-label="Request status" className={`${selectClass} w-full`} value={ticket.status} disabled={pending} onChange={e => update.mutate({ status: e.target.value as SupportStatus })}>{(['open', 'in_progress', 'waiting', 'resolved'] as const).map(v => <option key={v} value={v}>{supportStatusLabel(v)}</option>)}</select></label><label className="space-y-1 text-xs">Assigned to<select aria-label="Assigned administrator" className={`${selectClass} w-full`} value={ticket.assignee?.id || ''} disabled={pending || assignees.isError} onChange={e => update.mutate({ assigned_to: e.target.value ? Number(e.target.value) : null })}><option value="">Unassigned</option>{assignees.data?.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label className="space-y-1 text-xs">Priority<select aria-label="Request priority" className={`${selectClass} w-full`} value={ticket.priority} disabled={pending} onChange={e => update.mutate({ priority: e.target.value as 'normal' | 'urgent' })}><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label>{assignees.isError && <p className="text-xs text-destructive">Could not load support staff.</p>}</div></details> : <Button variant="link" size="sm" className="mt-1 h-6 px-0 text-xs" disabled={pending} onClick={() => update.mutate({ status: ticket.status === 'resolved' ? 'open' : 'resolved' })}>{ticket.status === 'resolved' ? 'Reopen request' : 'Mark resolved'}</Button>}
          </header>
          <div ref={messageFeed} aria-label="Request messages" onScroll={event => { const feed = event.currentTarget; followLatest.current = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80; }} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-muted/20 p-3 sm:p-4">{detail.data?.messages.map(item => <SupportMessage key={item.id} ticketId={ticket.id} item={item} own={String(item.author?.id) === String(user?.id)} />)}</div>
          {detail.data && detail.data.meta.last_page > 1 && <nav aria-label="Conversation pages" className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-1"><Button size="sm" variant="ghost" disabled={messagePage >= detail.data.meta.last_page || detail.isFetching} onClick={() => setMessagePage(v => v + 1)}>Older messages</Button><span className="text-[11px] text-muted-foreground">{messagePage} / {detail.data.meta.last_page}</span><Button size="sm" variant="ghost" disabled={messagePage <= 1 || detail.isFetching} onClick={() => setMessagePage(v => v - 1)}>Newer messages</Button></nav>}
          <form className="max-h-[45%] shrink-0 space-y-2 overflow-y-auto border-t p-3" onSubmit={e => { e.preventDefault(); if (!pending && reply.trim()) send.mutate(); }}>
            <label className="sr-only" htmlFor="support-reply">{internal ? 'Internal note' : 'Reply'}</label><Textarea id="support-reply" className="min-h-[64px] max-h-32 resize-y text-sm" disabled={pending} value={reply} onChange={e => setReply(e.target.value)} rows={2} maxLength={8000} placeholder={internal ? 'Add a private note for the support team…' : 'Write a reply…'} required />
            <SupportFiles id="support-reply-files" files={replyFiles} onChange={setReplyFiles} disabled={pending} />
            {Boolean(replyPrefill?.attachmentNames.length) && <p className="text-xs text-amber-700 dark:text-amber-300">Attach the files from your previous draft again: {replyPrefill!.attachmentNames.join(', ')}.</p>}
            <div className="flex items-center justify-between gap-2">{ticket.can_manage ? <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" disabled={pending} checked={internal} onChange={e => setInternal(e.target.checked)} />Internal note · staff only</label> : <p className="text-[10px] text-muted-foreground">Visible to you and the support team.</p>}<Button size="sm" className="h-9 shrink-0" disabled={pending || !reply.trim()} type="submit"><Send className="mr-1.5 h-3.5 w-3.5" />{send.isPending ? 'Saving…' : internal ? 'Save internal note' : 'Send reply'}</Button></div>
            {fail && <div role="alert" className="text-xs text-destructive">{errorText(fail)}<Button size="sm" className="ml-2 h-7" variant="outline" onClick={() => void refresh()}>Refresh request</Button></div>}
            {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
          </form>
        </>}
      </section>
    </div>
    <Dialog open={creating} onOpenChange={value => { if (!create.isPending) { if (value) setCreating(true); else closeCreate(); } }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New support request</DialogTitle><DialogDescription>Tell the team what you need. Your request and all replies stay together here.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!create.isPending) create.mutate({ ...draft, subject: draft.subject.trim(), body: draft.body.trim(), attachments: files }); }}><label className="block space-y-2 text-sm">Subject<Input aria-label="Request subject" disabled={create.isPending} value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} minLength={3} maxLength={180} required placeholder="What do you need help with?" /></label><label className="block space-y-2 text-sm">Topic<select aria-label="Request topic" disabled={create.isPending} className={`${selectClass} w-full capitalize`} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label className="block space-y-2 text-sm">What happened?<Textarea aria-label="Request details" disabled={create.isPending} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} rows={5} minLength={10} maxLength={8000} required placeholder="Share the page, shoot or task, and what you need help with." /></label>
        <SupportFiles id="support-create-files" files={files} onChange={setFiles} disabled={create.isPending} />
        {Boolean(prefill?.attachmentNames.length) && <p className="text-xs text-amber-700 dark:text-amber-300">Your previous draft included files. Attach them again before sending: {prefill!.attachmentNames.join(', ')}.</p>}
        <p className="text-xs text-muted-foreground">Keep passwords, payment details and property access codes out of your message.</p>{create.isError && <p role="alert" className="text-sm text-destructive">{errorText(create.error)}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={create.isPending} onClick={closeCreate}>Cancel</Button><Button type="submit" disabled={create.isPending || draft.subject.trim().length < 3 || draft.body.trim().length < 10}>{create.isPending ? 'Saving…' : 'Submit request'}</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>;
}
