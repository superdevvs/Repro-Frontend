import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { Calendar, Camera, ChevronRight, EyeOff, GripVertical, KanbanSquare, List, Mail, Phone, Plus, Search, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSearch } from '@/components/search/PageSearch';
import { useIsLarge } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { crmApi } from '../api';
import { crmKeys, useCrmMeta, useCrmMutation, useCrmQuery } from '../hooks';
import { useRobbieWhere } from '../robbie/useCrmRobbie';
import type { BoardCard, PipelineStage, Stat } from '../types';
import { FilterSelect } from '../ui/fields';
import { Avatar, Chip, CrmPage, Empty, ErrorNote, Loading, StatStrip, TabBar } from '../ui/primitives';
import { STAGE_DOT } from '../ui/stageDot';
import { ContactFormDialog } from '../components/ContactFormDialog';
import { ImportDialog } from '../components/ImportDialog';

interface Board { columns: { stage: PipelineStage; label: string; count: number; contacts: BoardCard[] }[]; lost_hidden: number; stats: Stat[] }

const FOOT_ICON: Record<string, React.ElementType> = { phone: Phone, mail: Mail, camera: Camera, calendar: Calendar, users: Users };

/** Pipeline board (frame 01; phones M2). Drag a card to another stage to move it. */
export default function PipelinePage() {
  useRobbieWhere({ page: 'pipeline' });
  const { data: meta } = useCrmMeta();
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
  const hasFilters = Boolean(rep || segment || market);

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
      {board.data && <StatStrip stats={board.data.stats} />}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="crm-list-search crm-pipeline-search" data-page-search-container>
          <Search className="ml-2.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <PageSearch searchId="crm-pipeline" scope="crm-contacts" scopeLabel="Pipeline" priority={20} aria-label="Search the pipeline" placeholder="Search pipeline" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-full min-w-0 border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0" />
        </div>
        <div className="crm-pipeline-filters flex min-w-0 flex-wrap items-center gap-2">
          {meta?.can.view_all && <FilterSelect label="Rep" allLabel="All reps" value={rep} onChange={setRep} options={[{ value: 'unassigned', label: 'Unassigned' }, ...meta.reps.map((r) => ({ value: String(r.id), label: r.name }))]} />}
          <FilterSelect label="Segment" allLabel="All" value={segment} onChange={setSegment} options={(meta?.segments ?? []).map((s) => ({ value: s.key, label: s.label }))} />
          <FilterSelect label="Market" allLabel="All markets" value={market} onChange={setMarket} options={(meta?.markets ?? []).map((m) => ({ value: m, label: m }))} />
          {hasFilters && <Button size="sm" variant="ghost" onClick={() => { setRep(''); setSegment(''); setMarket(''); }}>Clear filters</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Sales stages</h2>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {board.data && board.data.lost_hidden > 0 && (
            <Link to={stageUrl('lost')} className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />Lost ({board.data.lost_hidden.toLocaleString()})
            </Link>
          )}
          <div className="crm-view-switch" role="group" aria-label="Pipeline view">
            {([{ value: 'board', label: 'Board', Icon: KanbanSquare }, { value: 'list', label: 'List', Icon: List }] as const).map(({ value, label, Icon }) => (
              <button key={value} type="button" onClick={() => setView(value)} aria-pressed={value === (listView ? 'list' : 'board')}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {board.isLoading && <Loading />}
      {board.error && <ErrorNote error={board.error} onRetry={() => board.refetch()} />}

      {board.data && listView && (
        <>
          <TabBar<PipelineStage>
            ariaLabel="Sales stages"
            variant="inline"
            value={mobileStage}
            onChange={setMobileStage}
            tabs={board.data.columns.map((c) => ({ key: c.stage, label: c.label.replace(' / Quoted', '').replace(' 1st shoot', ''), count: c.count }))}
          />
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {currentColumn?.contacts.map((card) => (
              <Link key={card.id} to={`/crm/contacts/${card.id}`} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/60">
                <div className="min-w-0 flex-1"><CardBody card={card} /></div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {currentColumn && currentColumn.contacts.length === 0 && <Empty icon={<Users className="h-5 w-5" />} title="No contacts in this stage." />}
            {currentColumn && currentColumn.count > currentColumn.contacts.length && <Link className="block p-3 text-center text-sm font-medium text-accent-foreground hover:underline" to={stageUrl(mobileStage)}>Show all {currentColumn.count.toLocaleString()}</Link>}
          </div>
        </>
      )}

      {board.data && !listView && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="crm-stage-board grid min-w-0 gap-3 overflow-x-auto pb-2">
            {board.data.columns.map((col) => <Column key={col.stage} column={col} stageUrl={stageUrl(col.stage)} canMove={Boolean(meta?.can.update)} />)}
          </div>
          <DragOverlay>{dragging && <div className="w-64 rotate-1 rounded-[10px] border bg-card p-3 shadow-xl"><CardBody card={dragging} /></div>}</DragOverlay>
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
    <section ref={setNodeRef} aria-label={`${column.label}, ${column.count} contacts`} className={cn('crm-bg-lane flex min-w-0 flex-col gap-2 rounded-xl border p-2 transition-colors', isOver && 'border-primary/60 ring-2 ring-inset ring-primary/30')}>
      <header className="flex min-h-9 items-center gap-2 px-1.5 text-[13px] font-semibold">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', STAGE_DOT[column.stage])} aria-hidden="true" />
        <h3 className="min-w-0 flex-1">{column.label}</h3>
        <span className="shrink-0 rounded-md border bg-card px-1.5 text-xs font-medium text-muted-foreground tabular-nums">{column.count.toLocaleString()}</span>
      </header>
      {column.contacts.map((card) => <DraggableCard key={card.id} card={card} canMove={canMove} />)}
      {column.contacts.length === 0 && <p className="rounded-lg border border-dashed px-2 py-5 text-center text-xs text-muted-foreground">No contacts</p>}
      {column.count > column.contacts.length && <Link to={stageUrl} className="rounded-md px-2 py-2 text-center text-xs font-medium text-accent-foreground hover:bg-card">Show all {column.count.toLocaleString()}</Link>}
    </section>
  );
}

function DraggableCard({ card, canMove }: { card: BoardCard; canMove: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `card-${card.id}`, data: { card }, disabled: !canMove });
  return (
    <div ref={setNodeRef} className={cn('relative rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 focus-within:border-primary/60', isDragging && 'opacity-40')}>
      {canMove && <button type="button" {...attributes} {...listeners} aria-label={`Move ${card.name} to another stage`} className="absolute right-1.5 top-1.5 cursor-grab touch-none rounded p-1.5 text-muted-foreground hover:bg-secondary"><GripVertical className="h-4 w-4" /></button>}
      <Link to={`/crm/contacts/${card.id}`} className={cn('block rounded-sm', canMove && 'pr-5')} draggable={false}>
        <CardBody card={card} />
      </Link>
    </div>
  );
}

function CardBody({ card }: { card: BoardCard }) {
  const Icon = FOOT_ICON[card.footer.icon] ?? Calendar;
  return (
    <>
      <p className="truncate text-sm font-semibold" title={card.name}>{card.name}</p>
      {card.company && <p className="truncate text-xs text-muted-foreground" title={card.company}>{card.company}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Chip tone="line">{card.segment === 'commercial' ? 'Commercial' : 'Residential'}</Chip>
        {card.market && <span className="text-xs text-muted-foreground">{card.market}</span>}
        {card.is_new_website_lead && <Chip tone="blue">Website inquiry</Chip>}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        {card.assigned_rep && <Avatar person={card.assigned_rep} size="sm" />}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', card.footer.kind === 'overdue' ? 'crm-text-red' : 'text-muted-foreground')} aria-hidden="true" />
        <span title={card.footer.text} className={cn('min-w-0 truncate', card.footer.kind === 'overdue' ? 'crm-text-red font-medium' : 'text-muted-foreground')}>{card.footer.text}</span>
      </div>
    </>
  );
}
