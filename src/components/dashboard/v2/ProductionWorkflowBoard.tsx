import { EmptyState } from '@/components/ui/empty-state';
import React from 'react';
import { formatDashboardShootSchedule } from '@/utils/dashboardShootSchedule';
import { format } from 'date-fns';
import { CameraIcon } from 'lucide-react';
import { DashboardShootSummary, DashboardWorkflow } from '@/types/dashboard';
import { filterPipelineColumnShoots, type PipelineFilter } from '@/features/dashboard/pipelineWorkflow';
import { cn } from '@/lib/utils';
import { hasActiveTextSelection } from '@/lib/textSelection';
import { useMediaQuery } from '@/hooks/use-media-query';
import { ShootActionRequestBadges } from '@/components/shoots/ShootActionRequests';

interface ProductionWorkflowBoardProps {
  workflow: DashboardWorkflow | null;
  onSelectShoot: (shoot: DashboardShootSummary) => void;
  onAdvanceStage?: (shoot: DashboardShootSummary) => void;
  onViewAllDelivered?: () => void;
  loading?: boolean;
  filter?: PipelineFilter;
}

/** Stage cards kept in the column viewport before overflow scroll (all still mounted). */
export const PIPELINE_VISIBLE_CARDS = 6;
/** Compact pipeline card: sm:p-3 + address/date/client/photographer lines. */
export const PIPELINE_CARD_HEIGHT_PX = 100;
/** Matches Tailwind `sm:space-y-3` between stage cards. */
export const PIPELINE_CARD_GAP_PX = 12;
/** Pixel cap so ~6–7 cards fit; remaining jobs scroll inside with no-scrollbar. */
export const PIPELINE_LIST_MAX_HEIGHT_PX =
  PIPELINE_VISIBLE_CARDS * PIPELINE_CARD_HEIGHT_PX +
  (PIPELINE_VISIBLE_CARDS - 1) * PIPELINE_CARD_GAP_PX;

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
  compactViewport?: boolean;
}> = ({
  columnKey,
  columnLabel,
  columnAccent,
  filteredShoots,
  onSelectShoot,
  onViewAllDelivered,
  compactViewport = false,
}) => {
  const isReadyColumn = columnKey === 'ready' || columnKey === 'delivered';
  const count = filteredShoots.length;

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm flex min-h-0 flex-col min-w-0 flex-1',
        // Mobile stacked columns must size to their stage cards (not share 1fr
        // of the tab height), otherwise headers look like stats tiles.
        compactViewport ? 'h-auto' : 'h-full',
      )}
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
      {/* Render ALL stage cards; max-height ≈6 cards + overflow-y/no-scrollbar for inner scroll. */}
      <div
        className="space-y-2 sm:space-y-3 overflow-y-auto min-h-0 flex-1 no-scrollbar"
        style={{ maxHeight: PIPELINE_LIST_MAX_HEIGHT_PX }}
        data-pipeline-column-list={columnKey}
      >
        {filteredShoots.map((shoot) => (
          <div
            key={shoot.id}
            data-pipeline-shoot-card="true"
            className="border border-border rounded-xl sm:rounded-2xl p-2.5 sm:p-3 bg-card hover:border-primary/40 hover:shadow-lg transition-all"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={(event) => {
                if (hasActiveTextSelection(event.currentTarget)) return;
                onSelectShoot(shoot);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectShoot(shoot);
                }
              }}
              className="w-full cursor-pointer text-left"
            >
              <div className="space-y-1">
                <ShootActionRequestBadges shoot={shoot} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="select-text cursor-text text-xs sm:text-sm font-semibold text-foreground truncate">
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
                    <p className="select-text cursor-text text-[10px] sm:text-[11px] text-muted-foreground/70 truncate">{shoot.cityStateZip}</p>
                  )}
                <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  <CameraIcon className="h-3 w-3 flex-shrink-0" />
                  {shoot.photographer?.name || 'Unassigned'}
                </p>
              </div>
            </div>
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
  // Compact dashboard tabs (< lg) stack pipeline stages; equal 1fr rows crush
  // each column to a count header. Use content-sized rows + outer scroll instead.
  const isCompactDashboardViewport = useMediaQuery('(max-width: 1024px)');

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
    <div
      className={cn(
        'flex w-full min-h-0 flex-col',
        isCompactDashboardViewport ? 'flex-none' : 'h-full flex-1',
      )}
      data-pipeline-board={isCompactDashboardViewport ? 'compact' : 'desktop'}
    >
      <div
        className={cn(
          'grid w-full min-h-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4',
          isCompactDashboardViewport
            ? // Stacked/2-col compact: grow with stage cards so shoot rows stay visible.
              'auto-rows-auto'
            : // Desktop footer band: stretch columns to fill remaining height.
              'flex-1 auto-rows-[minmax(0,1fr)]',
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
              compactViewport={isCompactDashboardViewport}
            />
          );
        })}
      </div>
    </div>
  );
};
