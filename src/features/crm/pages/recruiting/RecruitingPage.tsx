import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Camera, GripVertical, Plane, Plus, Search, Star, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageSearch } from '@/components/search/PageSearch';
import { useIsLarge } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { crmApi } from '../../api';
import { useCrmMeta, useCrmMutation, useCrmQuery } from '../../hooks';
import { useRobbieWhere } from '../../robbie/useCrmRobbie';
import { Field, FilterSelect, Select, TextInput } from '../../ui/fields';
import { Chip, CrmPage, Empty, ErrorNote, Loading, TabBar } from '../../ui/primitives';
import { type ApplicantCard, type RecruitMeta, ROLE_LABEL } from './recruitingShared';
import { CoverageTab, PostingsTab, RosterTab } from './RecruitingTabs';

type Tab = 'board' | 'postings' | 'coverage' | 'roster';
interface Board { role: string; columns: { stage: string; label: string; cards: ApplicantCard[] }[]; not_moving_forward: number; counts: { photographer: number; sales_rep: number } }

/** Recruiting (frames 10, 12, 15): super admin by default, others by a per-user grant. */
export default function RecruitingPage() {
  useRobbieWhere({ page: 'recruiting' });
  const { data: crmMeta } = useCrmMeta();
  const meta = useCrmQuery<RecruitMeta>(['crm', 'recruit-meta'], '/recruiting/meta', undefined, Boolean(crmMeta?.can.recruiting));
  const [tab, setTab] = useState<Tab>('board');
  const [adding, setAdding] = useState(false);

  if (crmMeta && !crmMeta.can.recruiting) return <CrmPage title="Recruiting"><Empty title="Recruiting is limited to the super admin and people they give access to." /></CrmPage>;

  return (
    <CrmPage
      title="Recruiting"
      description="Photographers and sales reps, from first application to their first day."
      actions={meta.data?.can.manage && tab === 'board' ? <Button size="sm" className="h-8" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add applicant</Button> : undefined}
      tabs={<TabBar<Tab> value={tab} onChange={setTab} tabs={[{ key: 'board', label: 'Applicants' }, { key: 'postings', label: 'Job postings' }, { key: 'coverage', label: 'Coverage map' }, { key: 'roster', label: 'Licences and insurance' }]} />}
    >
      {tab === 'board' && <BoardTab meta={meta.data} />}
      {tab === 'postings' && <PostingsTab canManage={Boolean(meta.data?.can.manage)} states={meta.data?.states ?? {}} />}
      {tab === 'coverage' && <CoverageTab />}
      {tab === 'roster' && <RosterTab />}
      {meta.data && <AddApplicant open={adding} onOpenChange={setAdding} meta={meta.data} />}
    </CrmPage>
  );
}

function BoardTab({ meta }: { meta?: RecruitMeta }) {
  const wide = useIsLarge();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') === 'sales_rep' ? 'sales_rep' : 'photographer';
  const setRole = (value: string) => setParams((old) => { const next = new URLSearchParams(old); next.set('role', value); next.delete('page'); return next; });
  const closed = params.get('stage') === 'not_moving_forward';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const q = useCrmQuery<Board>(['crm', 'recruit-board', role, search, state], '/recruiting/board', { role, q: search, state });
  const exits = useCrmQuery<{ data: ApplicantCard[]; meta: { last_page: number } }>(
    ['crm', 'recruit-exits', role, search, state, page], '/recruiting/applicants', { stage: 'not_moving_forward', role, q: search, state, page }, closed,
  );
  const link = (archived: boolean, n = 1) => {
    const next = new URLSearchParams({ role });
    if (archived) next.set('stage', 'not_moving_forward');
    if (n > 1) next.set('page', String(n));
    return `/crm/recruiting?${next}`;
  };
  const move = useCrmMutation(({ id, stage }: { id: number; stage: string }) => crmApi.post(`/recruiting/applicants/${id}/stage`, { stage }), { success: 'Stage updated' });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onDragEnd = (e: DragEndEvent) => {
    const card = e.active.data.current?.card as ApplicantCard | undefined;
    const to = e.over?.id as string | undefined;
    if (!card || !to || to === card.stage) return;
    if (to === 'hired') { toast.info('Open the applicant and use Hire, so their account is set up.'); return; }
    move.mutate({ id: card.id, stage: to });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background p-2.5">
        <div role="group" aria-label="Applicant role" className="flex min-w-0 rounded-lg bg-secondary p-0.5 max-sm:w-full">
          {(['photographer', 'sales_rep'] as const).map((r) => (
            <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={cn('min-h-9 rounded-md px-3 text-[13px] font-medium transition-colors max-sm:flex-1', role === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {ROLE_LABEL[r]}s {q.data && <span className="ml-1 tabular-nums text-muted-foreground">{q.data.counts[r]}</span>}
            </button>
          ))}
        </div>
        <div className="crm-recruit-search relative flex h-9 min-w-0 items-center rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring/40 lg:max-w-64" data-page-search-container>
          <Search className="ml-2.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <PageSearch searchId="crm-recruiting" scope="crm-recruiting" scopeLabel="Applicants" priority={20} aria-label="Search applicants" placeholder="Search applicants" value={search} onChange={(e) => setSearch(e.target.value)} className="h-full border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0" />
        </div>
        <FilterSelect label="State" allLabel="All" value={state} onChange={setState} options={Object.entries(meta?.states ?? {}).map(([code, name]) => ({ value: code, label: name }))} />
        {closed && <Button asChild variant="outline" size="sm" className="sm:ml-auto"><Link to={link(false)}>Back to active applicants</Link></Button>}
        {!closed && q.data && q.data.not_moving_forward > 0 && <Button asChild variant="ghost" size="sm" className="sm:ml-auto"><Link to={link(true)}>{q.data.not_moving_forward} not moving forward</Link></Button>}
      </div>
      {!closed && q.isLoading && <Loading />}
      {!closed && q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {closed && <section className="space-y-3" aria-label="Applicants not moving forward">
        <h2 className="text-lg font-semibold">Not moving forward</h2>
        {exits.isLoading && <Loading />}{exits.error && <ErrorNote error={exits.error} onRetry={() => exits.refetch()} />}
        {exits.data && (exits.data.data.length ? <ul className="divide-y rounded-xl border">
          {exits.data.data.map((applicant) => <li key={applicant.id}><Link className="block p-3 hover:bg-secondary" to={`/crm/recruiting/applicants/${applicant.id}`}>
            <strong>{applicant.name}</strong><span className="block text-muted-foreground">{applicant.exit_reason}</span>
          </Link></li>)}</ul> : <Empty title="No applicants match." />)}
        {exits.data && exits.data.meta.last_page > 1 && <nav className="flex flex-wrap items-center gap-3" aria-label="Applicant pages">
          {page > 1 && <Button asChild variant="outline" size="sm"><Link to={link(true, page - 1)}>Previous</Link></Button>}
          <span className="text-sm text-muted-foreground">Page {page} of {exits.data.meta.last_page}</span>
          {page < exits.data.meta.last_page && <Button asChild variant="outline" size="sm"><Link to={link(true, page + 1)}>Next</Link></Button>}
        </nav>}
      </section>}
      {!closed && q.data && (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {wide ? (
            <div aria-label="Recruiting pipeline" className="grid crm-recruit-board min-w-0 gap-2.5 overflow-x-auto pb-2">
              {q.data.columns.map((col) => <Column key={col.stage} stage={col.stage} label={col.label} cards={col.cards} canMove={Boolean(meta?.can.manage)} board />)}
            </div>
          ) : (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2" aria-label="Applicants by stage">
              {q.data.columns.filter((column) => column.cards.length > 0).map((col) => <Column key={col.stage} stage={col.stage} label={col.label} cards={col.cards} canMove={false} />)}
              {q.data.columns.every((column) => column.cards.length === 0) && (
                <div className="rounded-xl border sm:col-span-2"><Empty icon={<Users className="h-5 w-5" />} title={search || state ? 'No applicants match these filters.' : 'No active applicants yet.'} /></div>
              )}
            </div>
          )}
        </DndContext>
      )}
    </>
  );
}

function Column({ stage, label, cards, canMove, board = false }: { stage: string; label: string; cards: ApplicantCard[]; canMove: boolean; board?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: !canMove });
  return (
    <section ref={setNodeRef} aria-label={`${label}, ${cards.length}`} className={cn('crm-bg-lane flex min-w-0 flex-col gap-2 rounded-xl border border-border/60 p-2', board && 'min-h-64', isOver && 'ring-2 ring-inset ring-primary/40')}>
      <header className="flex items-center justify-between gap-2 px-1.5 py-1">
        <h2 className="text-[13px] font-semibold">{label}</h2>
        <Chip>{cards.length}</Chip>
      </header>
      {cards.map((c) => <Card key={c.id} card={c} canMove={canMove} />)}
      {cards.length === 0 && <p className="px-2 py-5 text-center text-xs text-muted-foreground">No applicants</p>}
    </section>
  );
}

function Card({ card, canMove }: { card: ApplicantCard; canMove: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: `a-${card.id}`, data: { card }, disabled: !canMove });
  return (
    <article ref={setNodeRef} className={cn('relative rounded-lg border bg-card transition-colors hover:border-primary/40', isDragging && 'opacity-40')}>
      <Link to={`/crm/recruiting/applicants/${card.id}`} className={cn('block min-w-0 space-y-2 rounded-lg p-3', canMove && 'pr-9')}>
        <div>
          <p className="break-words text-[13px] font-semibold">{card.name}</p>
          <p className="truncate text-xs text-muted-foreground">{[card.city, card.state].filter(Boolean).join(', ') || card.states.join(', ') || '—'}</p>
        </div>
        {(card.posting || card.flies_drone || card.specialty) && <div className="flex flex-wrap items-center gap-1.5">
          {card.posting && <Chip tone="line" className="max-w-full" title={card.posting.title}><span className="truncate">{card.posting.title}</span></Chip>}
          {card.flies_drone && <Chip tone="blue"><Plane className="h-3 w-3" aria-hidden="true" />Drone</Chip>}
          {card.specialty && card.role === 'photographer' && <Chip><Camera className="h-3 w-3" aria-hidden="true" />{card.specialty}</Chip>}
        </div>}
        {(card.score !== null || card.days_in_stage !== null) && <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
          {card.score !== null && <span className="flex items-center gap-0.5 font-medium text-foreground"><Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />{card.score.toFixed(1)}</span>}
          {card.days_in_stage !== null && <span>{card.days_in_stage === 0 ? 'Today' : `${card.days_in_stage}d in stage`}</span>}
        </div>}
      </Link>
      {canMove && <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Move ${card.name} to another stage`} className="absolute right-1 top-1 cursor-grab touch-none rounded p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><GripVertical className="h-4 w-4" aria-hidden="true" /></button>}
    </article>
  );
}

function AddApplicant({ open, onOpenChange, meta }: { open: boolean; onOpenChange: (o: boolean) => void; meta: RecruitMeta }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ role: 'photographer', name: '', email: '', phone: '', city: '', state: '', source: 'referral', portfolio_url: '' });
  React.useEffect(() => { if (open) setF({ role: 'photographer', name: '', email: '', phone: '', city: '', state: '', source: 'referral', portfolio_url: '' }); }, [open]);
  const save = useCrmMutation(() => crmApi.post<{ applicant: { id: number } }>('/recruiting/applicants', Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v]))), { success: 'Applicant added' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="crm-root max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Add applicant</DialogTitle><DialogDescription>They start in Sourced / Applied. Add documents and details on their record.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Role">{(id) => <Select id={id} value={f.role} onChange={set('role')} options={meta.roles.map((r) => ({ value: r.key, label: r.label }))} />}</Field>
          <Field label="Source">{(id) => <Select id={id} value={f.source} onChange={set('source')} options={meta.sources.map((s) => ({ value: s, label: s.replace('_', ' ') }))} />}</Field>
          <Field label="Full name" required className="sm:col-span-2">{(id) => <TextInput id={id} value={f.name} onChange={set('name')} autoFocus />}</Field>
          <Field label="Email">{(id) => <TextInput id={id} type="email" value={f.email} onChange={set('email')} />}</Field>
          <Field label="Phone">{(id) => <TextInput id={id} value={f.phone} onChange={set('phone')} />}</Field>
          <Field label="City">{(id) => <TextInput id={id} value={f.city} onChange={set('city')} />}</Field>
          <Field label="State">{(id) => <Select id={id} value={f.state} onChange={set('state')} placeholder="—" options={Object.entries(meta.states).map(([code, name]) => ({ value: code, label: name }))} />}</Field>
          <Field label="Portfolio link" className="sm:col-span-2">{(id) => <TextInput id={id} value={f.portfolio_url} onChange={set('portfolio_url')} placeholder="https://" />}</Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate(undefined, { onSuccess: (r) => { onOpenChange(false); navigate(`/crm/recruiting/applicants/${r.applicant.id}`); } })}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
