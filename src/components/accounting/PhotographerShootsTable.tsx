import { EmptyState } from '@/components/ui/empty-state';
import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowUpRight, Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutGrid, List, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/components/auth/AuthProvider';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { ShootData } from '@/types/shoots';
import { getShootPlaceholderSrc, resolveShootThumbnail } from '@/components/shoots/history/shootHistoryUtils';
import {
  getPhotographerPayForShoot,
  getPhotographerPayoutDate,
  getPhotographerPayoutStatus,
  getShootCompletedDate,
  getShootScheduledDate,
  isShootAssignedToPhotographer,
} from './photographerEarningsUtils';

interface PhotographerShootsTableProps {
  shoots: ShootData[];
  onViewShoot?: (shoot: ShootData) => void;
}


const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const formatDateLabel = (value?: string | Date | null) => {
  if (!value) return 'TBD';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return format(date, 'MMM d, yyyy');
};

const getStatusTone = (status: string) => {
  const value = status.toLowerCase();
  if (value.includes('deliver')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  if (value.includes('editing')) return 'bg-violet-500/10 text-violet-500 border-violet-500/20';
  if (value.includes('upload')) return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
  if (value.includes('schedule') || value.includes('book')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  return 'bg-muted text-muted-foreground border-border';
};

const getPayoutTone = (status: 'paid' | 'pending' | 'upcoming') => {
  if (status === 'paid') {
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  }

  if (status === 'upcoming') {
    return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
  }

  return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
};

const getPayoutLabel = (status: 'paid' | 'pending' | 'upcoming') => {
  if (status === 'paid') return 'Paid';
  if (status === 'upcoming') return 'Upcoming';
  return 'Pending';
};

const getSortTimestamp = (shoot: ShootData) =>
  getShootCompletedDate(shoot)?.getTime() ??
  getShootScheduledDate(shoot)?.getTime() ??
  0;

export function PhotographerShootsTable({ shoots, onViewShoot }: PhotographerShootsTableProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => window.matchMedia('(max-width: 640px)').matches ? 'grid' : 'list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [search, setSearch] = useState('');
  const [payoutFilter, setPayoutFilter] = useState('all');

  const filteredShoots = useMemo(
    () =>
      shoots
        .filter((shoot) => isShootAssignedToPhotographer(shoot, user))
        .filter((shoot) => payoutFilter === 'all' || getPhotographerPayoutStatus(shoot) === payoutFilter)
        .filter((shoot) => `${shoot.id} ${shoot.location?.address || ''} ${shoot.client?.name || ''} ${(shoot.services || []).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a)),
    [shoots, user, payoutFilter, search],
  );

  const totalPages = Math.max(1, Math.ceil(filteredShoots.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedShoots = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredShoots.slice(start, start + pageSize);
  }, [filteredShoots, safePage, pageSize]);

  const rangeStart = filteredShoots.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filteredShoots.length);
  const placeholderImage = getShootPlaceholderSrc(theme);

  return (
    <Card className="min-w-0 overflow-hidden border-border/70">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold">My shoots &amp; earnings</h2>
        <div className="inline-flex rounded-md border p-0.5">
          <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><List className="mr-1 h-3.5 w-3.5" />List</Button>
          <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')}><LayoutGrid className="mr-1 h-3.5 w-3.5" />Grid</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 pb-3 sm:px-5">
        <input type="search" aria-label="Search photographer shoots" placeholder="Search property, client or shoot" value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-xs sm:max-w-64" />
        <select aria-label="Photographer payout status" value={payoutFilter} onChange={(event) => { setPayoutFilter(event.target.value); setCurrentPage(1); }} className="h-9 max-w-full rounded-md border bg-background px-2 text-xs"><option value="all">All payouts</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="upcoming">Upcoming</option></select>
        <span className="text-[11px] text-muted-foreground">All assigned shoots</span>
      </div>
      <div className="h-[26rem] overflow-auto overscroll-contain [scrollbar-gutter:stable]" tabIndex={0} aria-label="Photographer shoots and earnings">
        {filteredShoots.length === 0 ? <div className="p-8"><EmptyState icon="shoots" title={<>No shoots match these filters</>} size="compact" /></div> : viewMode === 'grid' ? <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {paginatedShoots.map((shoot) => <ShootEarningsGridCard key={shoot.id} shoot={shoot} user={user} placeholderImage={placeholderImage} onViewShoot={onViewShoot} />)}
        </div> : <table className="w-full min-w-[42rem] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-card text-[11px] text-muted-foreground"><tr>{['Shoot / property', 'Workflow', 'My pay', 'Payout', 'Date', 'Action'].map((label) => <th key={label} className="border-b px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{paginatedShoots.map((shoot) => {
            const payout = getPhotographerPayoutStatus(shoot), completed = getShootCompletedDate(shoot), scheduled = getShootScheduledDate(shoot), workflow = shoot.workflowStatus || shoot.status || 'Unknown';
            return <tr key={shoot.id} className="border-b border-border/60">
              <td className="px-4 py-3"><p className="font-medium">{shoot.location?.address || `Shoot #${shoot.id}`}</p><p className="mt-1 text-[11px] text-muted-foreground">#{shoot.id} · {shoot.client?.name || 'Unknown client'}</p><p className="mt-1 text-[11px] text-muted-foreground">{shoot.services?.join(' · ')}</p></td>
              <td className="px-4 py-3"><Badge variant="outline" className={cn('text-[10px]', getStatusTone(workflow))}>{workflow}</Badge></td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">{formatCurrency(getPhotographerPayForShoot(shoot, user))}</td>
              <td className="px-4 py-3"><Badge variant="outline" className={cn('text-[10px]', getPayoutTone(payout))}>{getPayoutLabel(payout)}</Badge><p className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">{payout === 'paid' ? `Paid ${formatDateLabel(getPhotographerPayoutDate(shoot))}` : 'Awaiting payout'}</p></td>
              <td className="whitespace-nowrap px-4 py-3">{formatDateLabel(completed || scheduled)}<p className="mt-1 text-[10px] text-muted-foreground">{completed ? 'Completed' : 'Scheduled'}</p></td>
              <td className="px-4 py-3"><Button variant="ghost" size="sm" disabled={!onViewShoot} aria-label={`View shoot ${shoot.id}`} onClick={() => onViewShoot?.(shoot)}>View<ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Button></td>
            </tr>;
          })}</tbody>
        </table>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
        <span>Showing {rangeStart}–{rangeEnd} of {filteredShoots.length}</span>
        <div className="flex items-center gap-2"><label className="flex items-center gap-2">Rows<select aria-label="Photographer shoots per page" className="h-8 rounded-md border bg-background px-2 text-foreground" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }}><option value={6}>6</option><option value={12}>12</option></select></label><Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous shoots page" aria-disabled={safePage === 1} onClick={() => { if (safePage > 1) setCurrentPage(safePage - 1); }}><ChevronLeft className="h-3.5 w-3.5" /></Button><span>{safePage} / {totalPages}</span><Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next shoots page" aria-disabled={safePage >= totalPages} onClick={() => { if (safePage < totalPages) setCurrentPage(safePage + 1); }}><ChevronRight className="h-3.5 w-3.5" /></Button></div>
      </div>
    </Card>
  );
}

function ShootEarningsGridCard({
  shoot,
  user,
  placeholderImage,
  onViewShoot,
}: {
  shoot: ShootData;
  user: ReturnType<typeof useAuth>['user'];
  placeholderImage: string;
  onViewShoot?: (shoot: ShootData) => void;
}) {
  const heroImage = resolveShootThumbnail(shoot, 'thumb') || placeholderImage;
  const pay = getPhotographerPayForShoot(shoot, user);
  const status = shoot.workflowStatus || shoot.status || 'unknown';
  const completedDate = getShootCompletedDate(shoot);
  const scheduledDate = getShootScheduledDate(shoot);
  const displayDate = completedDate || scheduledDate;

  const primaryService = shoot.services?.[0];

  return (
    <button
      type="button"
      onClick={() => onViewShoot?.(shoot)}
      disabled={!onViewShoot}
      className="group relative flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg disabled:cursor-default disabled:opacity-100 disabled:hover:translate-y-0"
      aria-label={`Open ${shoot.location.address} shoot overview`}
    >
      {/* Hero image (16:10 keeps the card compact while still showing the property well) */}
      <div className="relative h-24 w-full overflow-hidden bg-muted">
        <img
          src={heroImage}
          alt={shoot.location.address}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          loading="lazy"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/30" />

        {/* Top row: status pill (left) + diagonal-arrow icon button (right) */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-2.5 py-0.5 text-[11px] font-medium capitalize text-foreground backdrop-blur-sm">
            <CalendarIcon className="h-3 w-3" />
            {status}
          </span>
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/85 text-foreground backdrop-blur-sm transition-colors',
              onViewShoot && 'group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground',
            )}
            aria-hidden="true"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{shoot.location.address}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {displayDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {formatDateLabel(displayDate)}
              </span>
            )}
            {displayDate && shoot.location.city && (
              <span className="text-border" aria-hidden="true">·</span>
            )}
            {shoot.location.city && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{shoot.location.city}{shoot.location.state ? `, ${shoot.location.state}` : ''}</span>
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-border/60" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          {primaryService ? (
            <Badge variant="outline" className="max-w-[55%] truncate rounded-md px-1.5 py-0 text-[11px] font-normal text-foreground">
              {primaryService}
              {shoot.services && shoot.services.length > 1 && (
                <span className="ml-1 text-muted-foreground">+{shoot.services.length - 1}</span>
              )}
            </Badge>
          ) : (
            <span />
          )}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-muted-foreground">My Pay</span>
            <span className="text-base font-semibold text-primary tabular-nums">{formatCurrency(pay)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
