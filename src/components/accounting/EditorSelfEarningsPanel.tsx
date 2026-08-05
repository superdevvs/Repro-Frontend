import type { Dispatch, SetStateAction } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter as FilterIcon,
  LayoutGrid,
  List as ListIcon,
  ListChecks,
  Loader2,
  NotebookPen,
  Receipt,
  RefreshCw,
  Send,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { EditorEarningsDetail } from '@/services/invoiceService';
import type {
  EditorShootActivity,
  EditorShootGroup,
  ResolveEffectiveEditorEarning,
  ShootMediaState,
} from './editorEarningsTypes';
import {
  formatEditorCurrency as formatCurrency,
  formatEditorShortDate as formatShortDate,
  formatEditorTimestamp as formatTimestamp,
} from './editorEarningsUtils';

interface EditorSelfEarningsPanelProps {
  detail: EditorEarningsDetail | null;
  viewMode: 'list' | 'grid';
  setViewMode: Dispatch<SetStateAction<'list' | 'grid'>>;
  shootListRangeLabel: string;
  shootListPage: number;
  setShootListPage: Dispatch<SetStateAction<number>>;
  shootListPageCount: number;
  status: 'paid' | 'unpaid' | '';
  setStatus: Dispatch<SetStateAction<'paid' | 'unpaid' | ''>>;
  serviceType: string;
  setServiceType: Dispatch<SetStateAction<string>>;
  startDate: string;
  setStartDate: Dispatch<SetStateAction<string>>;
  endDate: string;
  setEndDate: Dispatch<SetStateAction<string>>;
  activeFilterCount: number;
  handleResetFilters: () => void;
  loadDetail: () => Promise<void>;
  detailLoading: boolean;
  loading: boolean;
  totalShoots: number;
  totalEarnedForFiltered: number;
  paginatedShoots: EditorShootGroup[];
  selectedShootId: number | null;
  setSelectedShootId: Dispatch<SetStateAction<number | null>>;
  selectedShoot: EditorShootGroup | null;
  shootMediaCache: Record<number, ShootMediaState>;
  selectedShootMedia?: ShootMediaState;
  selectedShootActivity: EditorShootActivity[];
  handleExport: (format: 'csv' | 'excel' | 'pdf') => void;
  handleSendReport: () => Promise<void>;
  sendLoading: boolean;
  resolveEffective: ResolveEffectiveEditorEarning;
}

export function EditorSelfEarningsPanel({
  detail,
  viewMode,
  setViewMode,
  shootListRangeLabel,
  shootListPage,
  setShootListPage,
  shootListPageCount,
  status,
  setStatus,
  serviceType,
  setServiceType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  activeFilterCount,
  handleResetFilters,
  loadDetail,
  detailLoading,
  loading,
  totalShoots,
  totalEarnedForFiltered,
  paginatedShoots,
  selectedShootId,
  setSelectedShootId,
  selectedShoot,
  shootMediaCache,
  selectedShootMedia,
  selectedShootActivity,
  handleExport,
  handleSendReport,
  sendLoading,
  resolveEffective,
}: EditorSelfEarningsPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold tracking-tight">My Shoots &amp; Earnings</h2>
          <p className="text-sm text-muted-foreground">
            {detail?.editor?.name
              ? `${detail.editor.name} \u00B7 editor pay, payout state, and shoot context in one place.`
              : 'Editor pay, payout state, and shoot context in one place.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-border/70 bg-background p-0.5">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              className="h-8 rounded-lg px-3"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
              Grid
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              className="h-8 rounded-lg px-3"
              onClick={() => setViewMode('list')}
            >
              <ListIcon className="mr-1.5 h-3.5 w-3.5" />
              List
            </Button>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background px-2 py-1 text-xs text-muted-foreground">
            <span className="px-1">{shootListRangeLabel}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={shootListPage <= 1}
              onClick={() => setShootListPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={shootListPage >= shootListPageCount}
              onClick={() => setShootListPage((current) => Math.min(shootListPageCount, current + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardContent className="flex flex-wrap items-center gap-2 px-3 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm">
            <FilterIcon className="h-4 w-4 text-muted-foreground" />
            <span>Filters</span>
            {activeFilterCount > 0 ? (
              <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">
                {activeFilterCount}
              </Badge>
            ) : null}
          </div>
          <select
            className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as 'paid' | 'unpaid' | '')}
          >
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>
          <select
            className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm"
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value)}
          >
            <option value="">All services</option>
            <option value="photo">Photo</option>
            <option value="video">Video</option>
            <option value="virtual_staging">Virtual Staging</option>
            <option value="floorplan">Floorplan</option>
          </select>
          <DateRangePicker
            value={{ startDate, endDate }}
            onChange={({ startDate: nextStartDate, endDate: nextEndDate }) => {
              setStartDate(nextStartDate);
              setEndDate(nextEndDate);
            }}
          />
          <div className="ml-auto flex items-center gap-2">
            {activeFilterCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                Reset
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => loadDetail()} disabled={detailLoading}>
              {detailLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
        <Card className="flex flex-col border-border/70 bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">
                {totalShoots} Shoot{totalShoots === 1 ? '' : 's'}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Total earned {formatCurrency(totalEarnedForFiltered)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-2 px-2 pb-3">
            {totalShoots === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
                No shoots match the current filters.
              </div>
            ) : (
              paginatedShoots.map((row) => {
                const isSelected = row.shootId === selectedShootId;
                const dateLabel = formatShortDate(row.scheduledDate) || 'Date TBD';
                const serviceLabel = row.services[0]
                  ? row.services.length > 1
                    ? `${row.services[0]} +${row.services.length - 1}`
                    : row.services[0]
                  : null;
                const mediaState = shootMediaCache[row.shootId];
                const coverThumb = mediaState?.items.find((m) => m.thumbnail_link)?.thumbnail_link || null;
                return (
                  <button
                    key={row.shootId}
                    type="button"
                    onClick={() => setSelectedShootId(row.shootId)}
                    className={cn(
                      'flex items-stretch gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/70 hover:border-border hover:bg-muted/30',
                    )}
                  >
                    <div
                      className={cn(
                        'relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[11px] font-semibold uppercase tracking-wider',
                        coverThumb
                          ? 'bg-muted'
                          : isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gradient-to-br from-muted to-muted/40 text-muted-foreground',
                      )}
                    >
                      {coverThumb ? (
                        <img
                          src={coverThumb}
                          alt={row.address}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : mediaState?.status === 'loading' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>#{row.shootId}</>
                      )}
                      {isSelected ? (
                        <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{row.address}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'rounded-full px-1.5 py-0 text-[10px] font-semibold',
                            row.hasUnpaid
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
                          )}
                        >
                          {row.hasUnpaid ? 'Unpaid' : 'Paid'}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {dateLabel}
                        {row.city ? ` \u00B7 ${row.city}` : ''}
                      </div>
                      {serviceLabel ? (
                        <Badge
                          variant="outline"
                          className="w-fit truncate rounded-full border-border/60 bg-muted/40 px-2 py-0 text-[10px] font-normal text-muted-foreground"
                        >
                          {serviceLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <span className="text-sm font-semibold text-primary">
                        {formatCurrency(row.totalPayout)}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
          {totalShoots > 0 ? (
            <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
              <span>{shootListRangeLabel}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={shootListPage <= 1}
                  onClick={() => setShootListPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={shootListPage >= shootListPageCount}
                  onClick={() => setShootListPage((current) => Math.min(shootListPageCount, current + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="border-border/70 bg-card/80">
          {!selectedShoot ? (
            <CardContent className="flex min-h-[24rem] items-center justify-center text-center text-sm text-muted-foreground">
              {detailLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading earnings detail...
                </span>
              ) : totalShoots === 0 ? (
                'No editor earnings were found for the selected filters.'
              ) : (
                'Select a shoot to see its details.'
              )}
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b border-border/70 pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {(() => {
                      const heroThumb = selectedShootMedia?.items.find((m) => m.thumbnail_link)?.thumbnail_link || null;
                      return (
                        <div
                          className={cn(
                            'flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-semibold uppercase tracking-wider text-primary',
                            heroThumb ? 'bg-muted' : 'bg-gradient-to-br from-primary/15 to-muted',
                          )}
                        >
                          {heroThumb ? (
                            <img
                              src={heroThumb}
                              alt={selectedShoot.address}
                              className="h-full w-full object-cover"
                            />
                          ) : selectedShootMedia?.status === 'loading' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>#{selectedShoot.shootId}</>
                          )}
                        </div>
                      );
                    })()}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold">{selectedShoot.address}</h3>
                        <Badge
                          variant="outline"
                          className={cn(
                            'rounded-full px-2 py-0 text-[10px] font-semibold',
                            selectedShoot.hasUnpaid
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
                          )}
                        >
                          {selectedShoot.hasUnpaid ? 'Unpaid' : 'Paid'}
                        </Badge>
                      </div>
                      <div className="mt-1 truncate text-sm text-muted-foreground">
                        {formatShortDate(selectedShoot.scheduledDate) || 'Date TBD'}
                        {selectedShoot.city ? ` \u00B7 ${selectedShoot.city}` : ''}
                        {selectedShoot.client ? ` \u00B7 ${selectedShoot.client}` : ''}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedShoot.services.map((service) => (
                          <Badge
                            key={service}
                            variant="outline"
                            className="rounded-full border-border/60 bg-muted/40 px-2 py-0 text-[11px] font-normal"
                          >
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('excel')}>Excel</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" onClick={handleSendReport} disabled={sendLoading}>
                      {sendLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send Report
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <ListChecks className="h-3.5 w-3.5" />
                      Shoots
                    </div>
                    <div className="mt-1 text-xl font-semibold">1</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <ListChecks className="h-3.5 w-3.5" />
                      Services
                    </div>
                    <div className="mt-1 text-xl font-semibold">{selectedShoot.services.length}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" />
                      Total Earned
                    </div>
                    <div className="mt-1 text-xl font-semibold">{formatCurrency(selectedShoot.totalPayout)}</div>
                  </div>
                  <div
                    className={cn(
                      'rounded-xl border px-4 py-3',
                      selectedShoot.hasUnpaid
                        ? 'border-amber-500/30 bg-amber-500/[0.06]'
                        : 'border-border/70 bg-muted/15',
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]',
                        selectedShoot.hasUnpaid ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
                      )}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      Unpaid
                    </div>
                    <div
                      className={cn(
                        'mt-1 text-xl font-semibold',
                        selectedShoot.hasUnpaid ? 'text-amber-700 dark:text-amber-300' : '',
                      )}
                    >
                      {formatCurrency(selectedShoot.unpaidPayout)}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col gap-5 pt-5">
                <section>
                  <h4 className="mb-2 text-sm font-semibold">
                    Photos
                    {selectedShootMedia?.status === 'loaded' ? ` (${selectedShootMedia.items.length})` : ''}
                  </h4>
                  {selectedShootMedia?.status === 'loading' ? (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading edited photos...
                    </div>
                  ) : selectedShootMedia?.status === 'error' ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                      Couldn&apos;t load edited photos for this shoot.
                    </div>
                  ) : selectedShootMedia?.items?.length ? (() => {
                    const totalCount = selectedShootMedia.items.length;
                    const previewLimit = totalCount > 6 ? 5 : 6;
                    const previewItems = selectedShootMedia.items.slice(0, previewLimit);
                    const overflowCount = totalCount - previewLimit;
                    return (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {previewItems.map((file) => (
                        <div
                          key={file.id}
                          className="aspect-square overflow-hidden rounded-lg bg-muted"
                          title={file.name}
                        >
                          {file.thumbnail_link ? (
                            <img
                              src={file.thumbnail_link}
                              alt={file.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                              No preview
                            </div>
                          )}
                        </div>
                      ))}
                      {overflowCount > 0 ? (
                        <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/30 text-xs font-semibold text-muted-foreground">
                          +{overflowCount} more
                        </div>
                      ) : null}
                    </div>
                    );
                  })() : (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                      No edited photos uploaded for this shoot yet.
                    </div>
                  )}
                </section>

                <section>
                  <h4 className="mb-2 text-sm font-semibold">Service / Shoot Details</h4>
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            <th className="px-3 py-2 text-left">Service</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Rate</th>
                            <th className="px-3 py-2 text-right">Payout</th>
                            <th className="px-3 py-2 text-right">Completed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedShoot.lineItems.map((item) => (
                            <tr key={item.id} className="border-t border-border/70 align-top">
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{item.service_name}</span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'rounded-full px-1.5 py-0 text-[10px] font-semibold',
                                      item.is_paid
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                        : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
                                    )}
                                  >
                                    {item.is_paid ? 'Paid' : 'Unpaid'}
                                  </Badge>
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  Shoot #{item.shoot_id}
                                  {item.client?.name ? ` \u00B7 ${item.client.name}` : ''}
                                </div>
                                {item.shoot?.address ? (
                                  <div className="text-xs text-muted-foreground">{item.shoot.address}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-3 text-right">{item.quantity_snapshot}</td>
                              {(() => {
                                const eff = resolveEffective(item);
                                return (
                                  <>
                                    <td className="px-3 py-3 text-right">
                                      <span className={cn(eff.isFallback && 'text-amber-600 dark:text-amber-300')}>
                                        {formatCurrency(eff.rate)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 text-right font-semibold">
                                      <div className="flex flex-col items-end">
                                        <span className={cn(eff.isFallback && 'text-amber-600 dark:text-amber-300')}>
                                          {formatCurrency(eff.payout)}
                                        </span>
                                        {eff.isFallback ? (
                                          <span className="mt-0.5 text-[10px] font-normal uppercase tracking-wider text-amber-600/80 dark:text-amber-300/80">
                                            at current rate
                                          </span>
                                        ) : null}
                                      </div>
                                    </td>
                                  </>
                                );
                              })()}
                              <td className="px-3 py-3 text-right text-muted-foreground">
                                {formatShortDate(item.completed_at) || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <NotebookPen className="h-4 w-4 text-muted-foreground" />
                      Notes
                    </div>
                    <div className="rounded-lg border border-dashed border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                      No notes available.
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Activity Timeline
                    </div>
                    {selectedShootActivity.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/70 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                        No activity recorded for this shoot.
                      </div>
                    ) : (
                      <ol className="relative space-y-3 border-l border-border/60 pl-5">
                        {selectedShootActivity.slice(0, 8).map((entry) => (
                          <li key={entry.id} className="relative">
                            <span className="absolute -left-[7px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                            <div className="text-sm font-medium">
                              {formatShortDate(entry.timestamp) || formatTimestamp(entry.timestamp)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.label}
                              {entry.meta ? ` \u00B7 ${entry.meta}` : ''}
                              {entry.actor ? ` \u00B7 ${entry.actor}` : ''}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </section>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );

}

