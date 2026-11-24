import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { Calendar, Camera, ChevronRight, EyeOff, GripVertical, Mail, Phone, Plus, Search, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSearch } from '@/components/search/PageSearch';
import { useIsLarge } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { crmApi } from '../api';
import { crmKeys, useCrmMeta, useCrmMutation, useCrmQuery } from '../hooks';
import { useRobbieWhere } from '../robbie/useCrmRobbie';
import type { BoardCard, PipelineStage, Stat } from '../types';
import { FilterSelect } from '../ui/fields';
import { Avatar, Chip, CrmPage, ErrorNote, Loading, StatStrip } from '../ui/primitives';
import { STAGE_DOT } from '../ui/stageDot';
import { ContactFormDialog } from '../components/ContactFormDialog';
import { ImportDialog } from '../components/ImportDialog';

interface Board { columns: { stage: PipelineStage; label: string; count: number; contacts: BoardCard[] }[]; lost_hidden: number; stats: Stat[] }

const FOOT_ICON: Record<string, React.ElementType> = { phone: Phone, mail: Mail, camera: Camera, calendar: Calendar, users: Users };

/** Pipeline board (frame 01; phones M2). Drag a card to another stage to move it. */
export default function PipelinePage() {
  useRobbieWhere({ page: 'pipeline' });
  const { data: meta } = useCrmMeta();
  const navigate = useNavigate();
  const wide = useIsLarge();
  const [view, setView] = useState<'board' | 'list' | null>(null);
  const listView = view ? view === 'list' : !wide;
  const [search, setSearch] = useState('');
  const [rep, setRep] = useState('');
  const [segment, setSegment] = useState('');
  const [market, setMarket] = useState('');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState<BoardCard | null>(null);
  const [mobileStage, setMobileStage] = useState<PipelineStage>('outreach');

  const filters = { search, rep_id: rep, segment, market_state: market };
  const board = useCrmQuery<Board>(crmKeys.board(filters), '/pipeline', filters);
  const move = useCrmMutation(({ id, stage }: { id: number; stage: PipelineStage }) => crmApi.post(`/contacts/${id}/stage`, { stage }), { success: 'Stage updated' });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.card as BoardCard) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const card = e.active.data.current?.card as BoardCard | undefined;
    const to = e.over?.id as PipelineStage | undefined;
    if (card && to && to !== card.stage) move.mutate({ id: card.id, stage: to });
  };

  const currentColumn = board.data?.columns.find((column) => column.stage === mobileStage);
  const stageUrl = (stage: string) => {
    const params = new URLSearchParams({ stage });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return `/crm/contacts?${params}`;
  };
  const total = useMemo(() => board.data?.columns.reduce((n, c) => n + c.count, 0) ?? 0, [board.data]);

  return (
    <CrmPage
      title="Pipeline"
      count={board.data ? total : null}
      description="Every lead from first outreach to first shoot."
      actions={<>
        {meta?.can.import && <Button variant="outline" size="sm" className="h-8" onClick={() => setImporting(true)}><Upload className="mr-1.5 h-3.5 w-3.5" />Import</Button>}
        {meta?.can.create && <Button size="sm" className="h-8" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add contact</Button>}
      </>}
    >
      {board.data && <StatStrip stats={board.data.stats} className="max-md:grid-cols-2" />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex h-8 w-[240px] items-center rounded-lg border bg-background max-md:h-10 max-md:w-full" data-page-search-container>
          <Search className="ml-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <PageSearch searchId="crm-pipeline" scope="crm-contacts" scopeLabel="Pipeline" priority={20} aria-label="Search the pipeline" placeholder="Search name, company, email" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-full border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0" />
        </div>
        {meta?.can.view_all && <FilterSelect label="Rep" allLabel="All reps" value={rep} onChange={setRep} options={[{ value: 'unassigned', label: 'Unassigned' }, ...meta.reps.map((r) => ({ value: String(r.id), label: r.name }))]} />}
        <FilterSelect label="Segment" allLabel="All" value={segment} onChange={setSegment} options={(meta?.segments ?? []).map((s) => ({ value: s.key, label: s.label }))} />
        <FilterSelect label="Market" allLabel="All markets" value={market} onChange={setMarket} options={(meta?.markets ?? []).map((m) => ({ value: m, label: m }))} />
        {board.data && board.data.lost_hidden > 0 && (
          <Link to="/crm/contacts?stage=lost" className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <EyeOff className="h-3.5 w-3.5" />{board.data.lost_hidden} lost contacts hidden <span className="font-medium text-accent-foreground">Show</span>
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Sales stages</h2>
        <div className="flex rounded-lg border bg-secondary/50 p-0.5" role="group" aria-label="Pipeline view">
          {(['board', 'list'] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} aria-pressed={v === (listView ? 'list' : 'board')}
            className={cn('rounded-md px-3 py-1.5 text-[13px] font-medium capitalize', v === (listView ? 'list' : 'board') ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>{v}</button>)}
        </div>
      </div>
      {board.isLoading && <Loading />}
      {board.error && <ErrorNote error={board.error} onRetry={() => board.refetch()} />}

      {board.data && listView && (
        <>
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {board.data.columns.map((c) => (
              <button key={c.stage} role="tab" aria-selected={mobileStage === c.stage} type="button" onClick={() => setMobileStage(c.stage)}
                className={cn('flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium', mobileStage === c.stage ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                {c.label.replace(' / Quoted', '').replace(' 1st shoot', '')}<span className="tabular-nums opacity-80">{c.count}</span>
              </button>
            ))}
          </div>
          <div className="divide-y overflow-hidden rounded-xl border">
            {currentColumn?.contacts.map((card) => (
              <button key={card.id} type="button" onClick={() => navigate(`/crm/contacts/${card.id}`)} className="flex w-full items-center gap-3 bg-card px-4 py-3 text-left">
                <div className="min-w-0 flex-1"><CardBody card={card} /></div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
            {currentColumn && currentColumn.contacts.length === 0 && <p className="p-4 text-sm text-muted-foreground">No contacts in this stage.</p>}
            {currentColumn && currentColumn.count > currentColumn.contacts.length && <Link className="block p-3 text-center font-medium underline" to={stageUrl(mobileStage)}>Show all {currentColumn.count}</Link>}
          </div>
        </>
      )}

      {board.data && !listView && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="grid min-h-[420px] grid-cols-4 gap-3 max-xl:grid-cols-[repeat(4,minmax(240px,1fr))] max-xl:overflow-x-auto">
            {board.data.columns.map((col) => <Column key={col.stage} column={col} stageUrl={stageUrl(col.stage)} canMove={Boolean(meta?.can.update)} />)}
          </div>
          <DragOverlay>{dragging && <div className="w-[260px] rotate-1 rounded-[10px] border bg-card p-3 shadow-xl"><CardBody card={dragging} /></div>}</DragOverlay>
        </DndContext>
      )}

      <ContactFormDialog open={adding} onOpenChange={setAdding} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </CrmPage>
  );
}

function Column({ column, stageUrl, canMove }: { column: Board['columns'][number]; stageUrl: string; canMove: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage, disabled: !canMove });
  return (
    <section ref={setNodeRef} aria-label={`${column.label}, ${column.count} contacts`} className={cn('crm-bg-lane flex min-h-0 flex-col gap-2 rounded-xl p-2 transition-colors', isOver && 'ring-2 ring-primary/40')}>
      <header className="flex items-center gap-2 px-1.5 py-1 text-[13px] font-semibold">
        <span className={cn('h-[7px] w-[7px] rounded-full', STAGE_DOT[column.stage])} aria-hidden="true" />{column.label}
        <span className="ml-auto font-normal text-muted-foreground tabular-nums">{column.count}</span>
      </header>
      {column.contacts.map((card) => <DraggableCard key={card.id} card={card} canMove={canMove} />)}
      {column.contacts.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nobody here yet.</p>}
      {column.count > column.contacts.length && <Link to={stageUrl} className="px-2 py-1 text-center text-xs font-medium text-accent-foreground hover:underline">Show all {column.count}</Link>}
    </section>
  );
}

function DraggableCard({ card, canMove }: { card: BoardCard; canMove: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `card-${card.id}`, data: { card }, disabled: !canMove });
  return (
    <div ref={setNodeRef} className={cn('relative rounded-[10px] border bg-card p-3 shadow-[0_1px_2px_hsl(210_40%_10%/.04)] transition-shadow hover:shadow-md', isDragging && 'opacity-40')}>
      {canMove && <button type="button" {...attributes} {...listeners} aria-label={`Move ${card.name} to another stage`} className="absolute right-1.5 top-1.5 cursor-grab touch-none rounded p-1.5 text-muted-foreground hover:bg-secondary"><GripVertical className="h-4 w-4" /></button>}
      <Link to={`/crm/contacts/${card.id}`} className="block pr-5" draggable={false}>
        <CardBody card={card} />
      </Link>
    </div>
  );
}

function CardBody({ card }: { card: BoardCard }) {
  const Icon = FOOT_ICON[card.footer.icon] ?? Calendar;
  return (
    <>
      <p className="truncate text-[13px] font-semibold">{card.name}</p>
      {card.company && <p className="truncate text-xs text-muted-foreground">{card.company}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip tone="line">{card.segment === 'commercial' ? 'Commercial' : 'Residential'}</Chip>
        {card.market && <span className="text-xs text-muted-foreground">{card.market}</span>}
        {card.is_new_website_lead && <Chip tone="blue">Website inquiry</Chip>}
      </div>
      <div className="mt-2.5 flex items-center gap-2 border-t pt-2 text-xs">
        <Avatar person={card.assigned_rep} size="sm" />
        <Icon className={cn('h-3.5 w-3.5 shrink-0', card.footer.kind === 'overdue' ? 'crm-text-red' : 'text-muted-foreground')} aria-hidden="true" />
        <span className={cn('truncate', card.footer.kind === 'overdue' ? 'crm-text-red font-medium' : 'text-muted-foreground')}>{card.footer.text}</span>
      </div>
    </>
  );
}
