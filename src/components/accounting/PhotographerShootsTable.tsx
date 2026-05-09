import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowUpRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  LayoutGrid,
  List,
  MapPin,
  Wallet,
} from 'lucide-react';
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

const ITEMS_PER_PAGE = 6;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredShoots = useMemo(
    () =>
      shoots
        .filter((shoot) => isShootAssignedToPhotographer(shoot, user))
        .sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a)),
    [shoots, user],
  );

  const totalPages = Math.max(1, Math.ceil(filteredShoots.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedShoots = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredShoots.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredShoots, safePage]);

  const rangeStart = filteredShoots.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ITEMS_PER_PAGE, filteredShoots.length);
  const placeholderImage = getShootPlaceholderSrc(theme);

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/80">
      <div className="border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">My Shoots & Earnings</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Photographer pay, payout state, and shoot context in one place.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-primary/80">Showing</p>
              <p className="mt-1 text-sm font-semibold">
                {rangeStart}-{rangeEnd} of {filteredShoots.length}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-2xl border border-border/70 bg-muted/30 p-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 gap-1 rounded-xl px-3"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 gap-1 rounded-xl px-3"
                >
                  <List className="h-3.5 w-3.5" />
                  List
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage === 1}
                  className="h-9 w-9 rounded-xl p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-[92px] text-center text-sm font-medium">
                  Page {safePage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage >= totalPages}
                  className="h-9 w-9 rounded-xl p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {filteredShoots.length === 0 ? (
        <div className="px-4 py-14 text-center sm:px-5">
          <div className="mx-auto max-w-md rounded-3xl border border-dashed border-border/60 bg-muted/20 px-6 py-10">
            <Wallet className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-semibold">No photographer-assigned shoots yet</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Assigned shoots will appear here with photographer pay and payout details.
            </p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 px-4 py-4 md:grid-cols-2 2xl:grid-cols-3 sm:px-5">
          {paginatedShoots.map((shoot) => (
            <ShootEarningsGridCard
              key={shoot.id}
              shoot={shoot}
              user={user}
              placeholderImage={placeholderImage}
              onViewShoot={onViewShoot}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3 px-4 py-4 sm:px-5">
          {paginatedShoots.map((shoot) => (
            <ShootEarningsListRow
              key={shoot.id}
              shoot={shoot}
              user={user}
              onViewShoot={onViewShoot}
            />
          ))}
        </div>
      )}

      {filteredShoots.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="text-muted-foreground">
            Showing {rangeStart}-{rangeEnd} of {filteredShoots.length} shoot{filteredShoots.length === 1 ? '' : 's'} · Page {safePage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safePage >= totalPages}
            >
              Next
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
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
  const payoutDate = getPhotographerPayoutDate(shoot);
  const payoutStatus = getPhotographerPayoutStatus(shoot);
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
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg disabled:cursor-default disabled:opacity-100 disabled:hover:translate-y-0"
      aria-label={`Open ${shoot.location.address} shoot overview`}
    >
      {/* Hero image (16:10 keeps the card compact while still showing the property well) */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
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

function ShootEarningsListRow({
  shoot,
  user,
  onViewShoot,
}: {
  shoot: ShootData;
  user: ReturnType<typeof useAuth>['user'];
  onViewShoot?: (shoot: ShootData) => void;
}) {
  const pay = getPhotographerPayForShoot(shoot, user);
  const payoutDate = getPhotographerPayoutDate(shoot);
  const payoutStatus = getPhotographerPayoutStatus(shoot);
  const status = shoot.workflowStatus || shoot.status || 'unknown';
  const completedDate = getShootCompletedDate(shoot);
  const scheduledDate = getShootScheduledDate(shoot);

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background/50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-semibold">{shoot.location.address}</p>
          <Badge className={cn('border', getStatusTone(status))}>{status}</Badge>
          <Badge className={cn('border', getPayoutTone(payoutStatus))}>
            {getPayoutLabel(payoutStatus)}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{shoot.client?.name || 'Unknown client'}</span>
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5" />
            {completedDate ? `Completed ${formatDateLabel(completedDate)}` : `Scheduled ${formatDateLabel(scheduledDate)}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {payoutStatus === 'paid' ? `Paid ${formatDateLabel(payoutDate)}` : 'Awaiting payout'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-left sm:min-w-[160px] sm:text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-primary/80">My Pay</p>
          <p className="mt-1 text-xl font-semibold">{formatCurrency(pay)}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => onViewShoot?.(shoot)}
          disabled={!onViewShoot}
          className="rounded-2xl"
        >
          <Eye className="mr-2 h-4 w-4" />
          View Shoot
        </Button>
      </div>
    </div>
  );
}
