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

const getPayoutTone = (status: 'paid' | 'pending') =>
  status === 'paid'
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    : 'bg-amber-500/10 text-amber-500 border-amber-500/20';

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

      {filteredShoots.length > ITEMS_PER_PAGE && (
        <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="text-muted-foreground">
            Showing {rangeStart}-{rangeEnd} of {filteredShoots.length} shoots
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safePage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safePage >= totalPages}
            >
              Next
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

  return (
    <div className="overflow-hidden rounded-[28px] border border-border/70 bg-background/60 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
      <div className="relative h-44 overflow-hidden border-b border-border/60 bg-muted/40">
        <img src={heroImage} alt={shoot.location.address} className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent p-4">
          <div className="flex items-center justify-between gap-3">
            <Badge className={cn('border', getStatusTone(status))}>
              {status}
            </Badge>
            <Badge className={cn('border', getPayoutTone(payoutStatus))}>
              {payoutStatus === 'paid' ? 'Paid' : 'Pending'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className="truncate text-lg font-semibold">{shoot.location.address}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {shoot.client?.name || 'Unknown client'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary/80">Photographer Pay</p>
            <p className="mt-2 text-xl font-semibold">{formatCurrency(pay)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {payoutStatus === 'paid' ? 'Payout Date' : 'Shoot Date'}
            </p>
            <p className="mt-2 text-sm font-semibold">
              {formatDateLabel(payoutStatus === 'paid' ? payoutDate : displayDate)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              {completedDate ? `Completed ${formatDateLabel(completedDate)}` : `Scheduled ${formatDateLabel(scheduledDate)}`}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {shoot.location.city}, {shoot.location.state}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {shoot.services.slice(0, 3).map((service) => (
              <Badge key={`${shoot.id}-${service}`} variant="outline" className="max-w-full truncate rounded-full">
                {service}
              </Badge>
            ))}
            {shoot.services.length > 3 && (
              <Badge variant="outline" className="rounded-full">
                +{shoot.services.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => onViewShoot?.(shoot)}
          disabled={!onViewShoot}
          className="w-full justify-between rounded-2xl"
        >
          <span className="inline-flex items-center gap-2">
            <Eye className="h-4 w-4" />
            View Shoot
          </span>
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
            {payoutStatus === 'paid' ? 'Paid' : 'Pending'}
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
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-left sm:min-w-[180px] sm:text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-primary/80">Photographer Pay</p>
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
