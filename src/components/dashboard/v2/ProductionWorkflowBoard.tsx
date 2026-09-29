import { EmptyState } from '@/components/ui/empty-state';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatDashboardShootSchedule } from '@/utils/dashboardShootSchedule';
import { format } from 'date-fns';
import { CameraIcon } from 'lucide-react';
import { DashboardShootSummary, DashboardWorkflow } from '@/types/dashboard';
import { filterPipelineColumnShoots, type PipelineFilter } from '@/features/dashboard/pipelineWorkflow';
import { resolveAdaptiveDeliveredVisibleCount } from './resolveAdaptiveDeliveredVisibleCount';
import { cn } from '@/lib/utils';

interface ProductionWorkflowBoardProps {
  workflow: DashboardWorkflow | null;
  onSelectShoot: (shoot: DashboardShootSummary) => void;
  onAdvanceStage?: (shoot: DashboardShootSummary) => void;
  onViewAllDelivered?: () => void;
  loading?: boolean;
  filter?: PipelineFilter;
}

const PIPELINE_CARD_GAP_PX = 8;
const PIPELINE_MIN_VISIBLE = 2;
const PIPELINE_PREFERRED_VISIBLE = 6;

const minutesToLabel = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const averageTurnaround = (shoots: DashboardShootSummary[]) => {
  try {
    if (!Array.isArray(shoots)) return '—';

    const durations = shoots
      .map((shoot) => {
        try {
          if (!shoot || !shoot.startTime || !shoot.deliveryDeadline) return null;
          const start = new Date(shoot.startTime).getTime();
          const end = new Date(shoot.deliveryDeadline).getTime();
          if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
          return (end - start) / (1000 * 60); // minutes
        } catch {
          return null;
        }
      })
      .filter((value): value is number => value !== null && Number.isFinite(value));

    if (!durations.length) return '—';
    const avg = durations.reduce((sum, val) => sum + val, 0) / durations.length;
    return minutesToLabel(avg);
  } catch {
    return '—';
  }
};

const columnTitle = (columnKey: string, columnLabel: string) => {
  if (columnKey === 'booked') return 'Scheduled';
  if (columnKey === 'raw_upload') return 'Raw uploaded';
  return columnLabel;
};

const PipelineColumn: React.FC<{
  columnKey: string;
  columnLabel: string;
  columnAccent: string;
  filteredShoots: DashboardShootSummary[];
  onSelectShoot: (shoot: DashboardShootSummary) => void;
  onViewAllDelivered?: () => void;
}> = ({
  columnKey,
  columnLabel,
  columnAccent,
  filteredShoots,
  onSelectShoot,
  onViewAllDelivered,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PIPELINE_PREFERRED_VISIBLE);
  const isReadyColumn = columnKey === 'ready' || columnKey === 'delivered';

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      setListHeight(list.clientHeight || 0);
      const firstCard = list.querySelector<HTMLElement>('[data-pipeline-shoot-card="true"]');
      if (firstCard && firstCard.offsetHeight > 0) {
        setCardHeight(firstCard.offsetHeight);
      }
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    const firstCard = list.querySelector<HTMLElement>('[data-pipeline-shoot-card="true"]');
    if (firstCard) observer.observe(firstCard);
    return () => observer.disconnect();
  }, [filteredShoots.length]);

  useEffect(() => {
    setVisibleCount(
      resolveAdaptiveDeliveredVisibleCount({
        availableHeight: listHeight,
        itemHeight: cardHeight,
        totalItems: filteredShoots.length,
        gapPx: PIPELINE_CARD_GAP_PX,
        minVisible: PIPELINE_MIN_VISIBLE,
        preferredVisible: PIPELINE_PREFERRED_VISIBLE,
      }),
    );
  }, [listHeight, cardHeight, filteredShoots.length]);

  const visibleShoots = useMemo(
    () => filteredShoots.slice(0, visibleCount),
    [filteredShoots, visibleCount],
  );
  const count = filteredShoots.length;

  return (
    <div
      className="bg-card border border-border rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm flex h-full min-h-0 flex-col min-w-0 flex-1"
      data-pipeline-column={columnKey}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4 shrink-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">
            {columnTitle(columnKey, columnLabel)}
          </h3>
          <p className="text-xl sm:text-2xl font-semibold" style={{ color: columnAccent }}>{count}</p>
          <p className="text-[11px] sm:text-[12px] text-muted-foreground/80">
            {count === 1 ? 'Active job' : `${count} active jobs`}
          </p>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <p className="text-[10px] sm:text-xs text-muted-foreground">Avg</p>
          <p className="text-xs sm:text-sm font-semibold text-foreground">{averageTurnaround(filteredShoots)}</p>
        </div>
      </div>
      <div
        ref={listRef}
        className="space-y-2 sm:space-y-3 overflow-y-auto min-h-0 flex-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {visibleShoots.map((shoot) => (
          <div
            key={shoot.id}
            data-pipeline-shoot-card="true"
            className="border border-border rounded-xl sm:rounded-2xl p-2.5 sm:p-3 bg-card hover:border-primary/40 hover:shadow-lg transition-all"
          >
            <button
              onClick={() => onSelectShoot(shoot)}
              className="w-full text-left"
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                      {shoot.addressLine}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground/80">
                      {(() => {
                        try {
                          let ts: string | null = null;
                          if (columnKey === 'booked' || columnKey === 'scheduled') {
                            return formatDashboardShootSchedule(shoot) || 'TBD';
                          } else if (columnKey === 'raw_upload') {
                            ts = shoot.submittedForReviewAt || null;
                          } else if (columnKey === 'editing') {
                            ts = shoot.submittedForReviewAt || null;
                          } else if (isReadyColumn) {
                            ts = shoot.deliveryDeadline || null;
                          }
                          if (ts) {
                            const date = new Date(ts);
                            if (!isNaN(date.getTime())) {
                              return `${format(date, 'MMM d')} • ${format(date, 'h:mm a')}`;
                            }
                          }
                          return formatDashboardShootSchedule(shoot) || 'TBD';
                        } catch {
                          return formatDashboardShootSchedule(shoot) || 'TBD';
                        }
                      })()}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                      {shoot.clientName || 'Client TBD'}
                    </p>
                  </div>
                </div>
                {shoot.cityStateZip &&
                  shoot.addressLine &&
                  typeof shoot.addressLine === 'string' &&
                  typeof shoot.cityStateZip === 'string' &&
                  !shoot.addressLine.toLowerCase().includes(shoot.cityStateZip.toLowerCase()) && (
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 truncate">{shoot.cityStateZip}</p>
                  )}
                <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  <CameraIcon className="h-3 w-3 flex-shrink-0" />
                  {shoot.photographer?.name || 'Unassigned'}
                </p>
              </div>
            </button>
          </div>
        ))}
        {filteredShoots.length === 0 && (
          <div className="flex min-h-[120px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 text-center">
            <EmptyState icon="clear" title="No shoots in this stage" size="compact" />
            <p className="mt-1 text-xs text-muted-foreground">Work will appear here as shoots move forward.</p>
          </div>
        )}
      </div>
      {isReadyColumn && onViewAllDelivered ? (
        <button
          type="button"
          className="mt-2 w-full shrink-0 py-2 rounded-xl border border-border hover:border-primary/40 text-[11px] font-semibold text-muted-foreground transition-colors"
          onClick={onViewAllDelivered}
        >
          View all delivered
        </button>
      ) : null}
    </div>
  );
};

export const ProductionWorkflowBoard: React.FC<ProductionWorkflowBoardProps> = ({
  workflow,
  onSelectShoot,
  onAdvanceStage: _onAdvanceStage,
  onViewAllDelivered,
  loading,
  filter = 'this_week',
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px] border border-dashed border-border rounded-3xl text-muted-foreground">
        <p className="text-sm">Loading workflow…</p>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px] border border-dashed border-border rounded-3xl text-muted-foreground">
        <p className="text-sm">No workflow data available.</p>
      </div>
    );
  }

  if (!Array.isArray(workflow.columns)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[240px] border border-dashed border-border rounded-3xl text-muted-foreground">
        <p className="text-sm">Invalid workflow data.</p>
      </div>
    );
  }

  const visibleColumns = workflow.columns.filter((column) => column);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <div
        className={cn(
          'grid w-full flex-1 min-h-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4',
          // Fill the pipeline tab / footer band so columns stretch instead of
          // hugging a few cards and leaving a white void under Scheduled/Delivered.
          'auto-rows-[minmax(0,1fr)]',
        )}
      >
        {visibleColumns.map((column) => {
          const safeShoots = Array.isArray(column.shoots) ? column.shoots : [];
          const columnKey = column.key || 'unknown';
          const filteredShoots = filterPipelineColumnShoots(safeShoots, columnKey, filter);
          const columnLabel = column.label || columnKey;
          const columnAccent = column.accent || '#6b7280';

          return (
            <PipelineColumn
              key={columnKey}
              columnKey={columnKey}
              columnLabel={columnLabel}
              columnAccent={columnAccent}
              filteredShoots={filteredShoots}
              onSelectShoot={onSelectShoot}
              onViewAllDelivered={onViewAllDelivered}
            />
          );
        })}
      </div>
    </div>
  );
};
