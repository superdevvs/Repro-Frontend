import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Camera, Plane, Plus, Search, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageSearch } from '@/components/search/PageSearch';
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const card = e.active.data.current?.card as ApplicantCard | undefined;
    const to = e.over?.id as string | undefined;
    if (!card || !to || to === card.stage) return;
    if (to === 'hired') { toast.info('Open the applicant and use Hire, so their account is set up.'); return; }
    move.mutate({ id: card.id, stage: to });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex rounded-lg border p-0.5">
          {(['photographer', 'sales_rep'] as const).map((r) => (
            <button key={r} type="button" role="tab" aria-selected={role === r} onClick={() => setRole(r)} className={cn('h-7 rounded-md px-3 text-[13px] font-medium', role === r ? 'bg-secondary text-foreground' : 'text-muted-foreground')}>
              {ROLE_LABEL[r]}s <span className="tabular-nums text-muted-foreground">{q.data?.counts[r] ?? ''}</span>
            </button>
          ))}
        </div>
        <div className="relative flex h-8 w-[220px] items-center rounded-lg border bg-background" data-page-search-container>
          <Search className="ml-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <PageSearch searchId="crm-recruiting" scope="crm-recruiting" scopeLabel="Applicants" priority={20} aria-label="Search applicants" placeholder="Search applicants" value={search} onChange={(e) => setSearch(e.target.value)} className="h-full border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0" />
        </div>
        <FilterSelect label="State" allLabel="All" value={state} onChange={setState} options={Object.entries(meta?.states ?? {}).map(([code, name]) => ({ value: code, label: name }))} />
        {closed && <Link className="ml-auto underline" to={link(false)}>Return to board</Link>}
        {!closed && q.data && q.data.not_moving_forward > 0 && <Link to={link(true)} className="ml-auto text-xs text-muted-foreground">{q.data.not_moving_forward} not moving forward</Link>}
      </div>
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {closed && <section className="space-y-3" aria-label="Applicants not moving forward">
        <h2 className="text-lg font-semibold">Not moving forward</h2>
        {exits.isLoading && <Loading />}{exits.error && <ErrorNote error={exits.error} onRetry={() => exits.refetch()} />}
        {exits.data && (exits.data.data.length ? <ul className="divide-y rounded-xl border">
          {exits.data.data.map((applicant) => <li key={applicant.id}><Link className="block p-3 hover:bg-secondary" to={`/crm/recruiting/applicants/${applicant.id}`}>
            <strong>{applicant.name}</strong><span className="block text-muted-foreground">{applicant.exit_reason}</span>
          </Link></li>)}</ul> : <Empty title="No applicants match." />)}
        {exits.data && exits.data.meta.last_page > 1 && <nav className="flex gap-3" aria-label="Applicant pages">
          {page > 1 && <Link to={link(true, page - 1)}>Previous</Link>}Page {page} of {exits.data.meta.last_page}{page < exits.data.meta.last_page && <Link to={link(true, page + 1)}>Next</Link>}
        </nav>}
      </section>}
      {!closed && q.data && (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-[repeat(6,minmax(160px,1fr))] gap-2.5 overflow-x-auto pb-2">
            {q.data.columns.map((col) => <Column key={col.stage} stage={col.stage} label={col.label} cards={col.cards} canMove={Boolean(meta?.can.manage)} />)}
          </div>
        </DndContext>
      )}
    </>
  );
}

function Column({ stage, label, cards, canMove }: { stage: string; label: string; cards: ApplicantCard[]; canMove: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: !canMove });
  return (
    <section ref={setNodeRef} aria-label={`${label}, ${cards.length}`} className={cn('crm-bg-lane flex min-h-[360px] flex-col gap-2 rounded-xl p-2', isOver && 'ring-2 ring-primary/40')}>
      <header className="flex items-center px-1.5 py-1 text-[13px] font-semibold">{label}<span className="ml-auto font-normal text-muted-foreground">{cards.length}</span></header>
      {cards.map((c) => <Card key={c.id} card={c} canMove={canMove} />)}
    </section>
  );
}

function Card({ card, canMove }: { card: ApplicantCard; canMove: boolean }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `a-${card.id}`, data: { card }, disabled: !canMove });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => navigate(`/crm/recruiting/applicants/${card.id}`)} role="link" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/crm/recruiting/applicants/${card.id}`)}
      className={cn('cursor-pointer touch-none rounded-[10px] border bg-card p-3 hover:shadow-md', isDragging && 'opacity-40')}>
      <p className="truncate text-[13px] font-semibold">{card.name}</p>
      <p className="truncate text-xs text-muted-foreground">{[card.city, card.state].filter(Boolean).join(', ') || card.states.join(', ') || '—'}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.posting && <Chip tone="line" className="max-w-full" title={card.posting.title}><span className="truncate">{card.posting.title}</span></Chip>}
        {card.flies_drone && <Chip tone="blue"><Plane className="h-3 w-3" />Drone</Chip>}
        {card.specialty && card.role === 'photographer' && <Chip><Camera className="h-3 w-3" />{card.specialty}</Chip>}
      </div>
      <div className="mt-2 flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
        {card.score !== null && <span className="flex items-center gap-0.5 font-medium text-foreground"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{card.score.toFixed(1)}</span>}
        <span>{card.days_in_stage === 0 ? 'today' : `${card.days_in_stage}d in stage`}</span>
      </div>
    </div>
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
      <DialogContent className="crm-root sm:max-w-[520px]">
        <DialogHeader><DialogTitle>Add applicant</DialogTitle><DialogDescription>They start in Sourced / Applied. Add documents and details on their record.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">{(id) => <Select id={id} value={f.role} onChange={set('role')} options={meta.roles.map((r) => ({ value: r.key, label: r.label }))} />}</Field>
          <Field label="Source">{(id) => <Select id={id} value={f.source} onChange={set('source')} options={meta.sources.map((s) => ({ value: s, label: s.replace('_', ' ') }))} />}</Field>
          <Field label="Full name" required className="col-span-2">{(id) => <TextInput id={id} value={f.name} onChange={set('name')} autoFocus />}</Field>
          <Field label="Email">{(id) => <TextInput id={id} type="email" value={f.email} onChange={set('email')} />}</Field>
          <Field label="Phone">{(id) => <TextInput id={id} value={f.phone} onChange={set('phone')} />}</Field>
          <Field label="City">{(id) => <TextInput id={id} value={f.city} onChange={set('city')} />}</Field>
          <Field label="State">{(id) => <Select id={id} value={f.state} onChange={set('state')} placeholder="—" options={Object.entries(meta.states).map(([code, name]) => ({ value: code, label: name }))} />}</Field>
          <Field label="Portfolio link" className="col-span-2">{(id) => <TextInput id={id} value={f.portfolio_url} onChange={set('portfolio_url')} placeholder="https://" />}</Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate(undefined, { onSuccess: (r) => { onOpenChange(false); navigate(`/crm/recruiting/applicants/${r.applicant.id}`); } })}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
