import React, { useState, useMemo } from 'react';
import { format, startOfDay, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { DashboardShootSummary, DashboardWorkflow, DashboardWorkflowColumn } from '@/types/dashboard';
import { ArrowRightCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type PipelineFilter = 'today' | 'this_week' | 'month';

interface ProductionWorkflowBoardProps {
  workflow: DashboardWorkflow | null;
  onSelectShoot: (shoot: DashboardShootSummary) => void;
  onAdvanceStage?: (shoot: DashboardShootSummary) => void;
  loading?: boolean;
  filter?: PipelineFilter;
}

const minutesToLabel = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const averageTurnaround = (column: DashboardWorkflowColumn) => {
  try {
    if (!column || !Array.isArray(column.shoots)) return '—';
    
    const durations = column.shoots
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

export const ProductionWorkflowBoard: React.FC<ProductionWorkflowBoardProps> = ({
  workflow,
  onSelectShoot,
  onAdvanceStage,
  loading,
  filter = 'this_week',
}) => {
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

  const toggleCard = (id: number) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[320px] sm:min-h-[16rem] border border-dashed border-border rounded-3xl text-muted-foreground">
        <p className="text-sm">Loading workflow…</p>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full min-h-[320px] sm:min-h-[16rem] border border-dashed border-border rounded-3xl text-muted-foreground">
        <p className="text-sm">No workflow data available.</p>
      </div>
    );
  }

  if (!Array.isArray(workflow.columns)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[320px] sm:min-h-[16rem] border border-dashed border-border rounded-3xl text-muted-foreground">
        <p className="text-sm">Invalid workflow data.</p>
      </div>
    );
  }

  // Filter shoots based on selected date range
  const filterShootsByDate = (shoots: DashboardShootSummary[]): DashboardShootSummary[] => {
    const now = new Date();
    const today = startOfDay(now);
    
    return shoots.filter((shoot) => {
      if (!shoot.startTime) return true; // Include shoots without dates
      const shootDate = new Date(shoot.startTime);
      
      switch (filter) {
        case 'today':
          return startOfDay(shootDate).getTime() === today.getTime();
        case 'this_week': {
          const weekStart = startOfWeek(now, { weekStartsOn: 0 });
          const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
          return shootDate >= weekStart && shootDate <= weekEnd;
        }
        case 'month': {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          return shootDate >= monthStart && shootDate <= monthEnd;
        }
        default:
          return true;
      }
    });
  };

  // Include all columns - booked is renamed to "Scheduled" in the display
  const visibleColumns = workflow.columns.filter((column) => column);

  return (
    <div className="w-full h-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full h-full">
      {visibleColumns.map(column => {
        const safeShoots = Array.isArray(column.shoots) ? column.shoots : [];
        const columnKey = column.key || 'unknown';
        // Only apply date filtering to the scheduled/booked column.
        // Other stages (uploaded, editing, etc.) should show ALL active shoots
        // regardless of when they were originally scheduled.
        const isScheduledColumn = columnKey === 'booked' || columnKey === 'scheduled';
        const filteredShoots = isScheduledColumn ? filterShootsByDate(safeShoots) : safeShoots;
        const count = filteredShoots.length;
        const columnLabel = column.label || columnKey;
        const columnAccent = column.accent || '#6b7280';
        
        return (
        <div key={columnKey} className="bg-card border border-border rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm flex flex-col min-w-0 flex-1 min-h-[320px] sm:min-h-[360px]">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">
                {columnKey === 'booked' ? 'Scheduled' : columnKey === 'raw_upload' ? 'Raw uploaded' : columnLabel}
              </h3>
              <p className="text-xl sm:text-2xl font-semibold" style={{ color: columnAccent }}>{count}</p>
              <p className="text-[11px] sm:text-[12px] text-muted-foreground/80">{count === 1 ? 'Active job' : `${count} active jobs`}</p>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Avg</p>
              <p className="text-xs sm:text-sm font-semibold text-foreground">{averageTurnaround(column)}</p>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3 overflow-y-auto max-h-[400px] sm:max-h-[500px] min-h-0 flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {filteredShoots.slice(0, 6).map(shoot => {
              const expanded = expandedCards[shoot.id];
              return (
              <div
                key={shoot.id}
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
                              if (shoot.startTime) {
                                const date = new Date(shoot.startTime);
                                if (!isNaN(date.getTime())) {
                                  return `${format(date, 'MMM d')} • ${shoot.timeLabel || 'TBD'}`;
                                }
                              }
                              return shoot.timeLabel || 'TBD';
                            } catch {
                              return shoot.timeLabel || 'TBD';
                            }
                          })()}
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                          {shoot.clientName || 'Client TBD'}
                        </p>
                      </div>
                      <span
                        role="button"
                        aria-label="Toggle details"
                        className="text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleCard(shoot.id);
                        }}
                      >
                        {expanded ? <ChevronUp size={14} className="sm:w-4 sm:h-4" /> : <ChevronDown size={14} className="sm:w-4 sm:h-4" />}
                      </span>
                    </div>
                    {shoot.cityStateZip &&
                      shoot.addressLine &&
                      typeof shoot.addressLine === 'string' &&
                      typeof shoot.cityStateZip === 'string' &&
                      !shoot.addressLine.toLowerCase().includes(shoot.cityStateZip.toLowerCase()) && (
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 truncate">{shoot.cityStateZip}</p>
                      )}
                  </div>
                </button>
                {expanded && (
                  <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-foreground">Photographer</span>
                      <span className="text-right">{shoot.photographer?.name || 'Unassigned'}</span>
                    </div>
                    {shoot.adminIssueNotes && (
                      <p className="text-[11px] text-destructive/80">
                        {shoot.adminIssueNotes}
                      </p>
                    )}
                    <div className="flex gap-2">
                      {onAdvanceStage && (
                        <button
                          onClick={() => onAdvanceStage(shoot)}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold rounded-lg py-1.5 border',
                            'text-muted-foreground border-border hover:border-primary/40 hover:text-primary transition-colors',
                          )}
                        >
                          Advance
                          <ArrowRightCircle size={14} />
                        </button>
                      )}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          window.dispatchEvent(
                            new CustomEvent('pipeline:move-back', { detail: shoot }),
                          );
                        }}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold rounded-lg py-1.5 border',
                          'text-muted-foreground border-border hover:border-primary/40 hover:text-primary transition-colors',
                        )}
                      >
                        Back
                        <ArrowRightCircle className="rotate-180" size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
            })}
            {filteredShoots.length === 0 && (
              <div className="text-center text-xs text-slate-400 dark:text-slate-600/80 py-4 border border-dashed border-slate-200/60 dark:border-slate-800/30 rounded-2xl flex items-center justify-center min-h-[180px]">
                Empty
              </div>
            )}
          </div>
        </div>
        );
      })}
      </div>
    </div>
  );
};

