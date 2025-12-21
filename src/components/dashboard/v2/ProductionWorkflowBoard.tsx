import React, { useState } from 'react';
import { format } from 'date-fns';
import { DashboardShootSummary, DashboardWorkflow, DashboardWorkflowColumn } from '@/types/dashboard';
import { ArrowRightCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionWorkflowBoardProps {
  workflow: DashboardWorkflow | null;
  onSelectShoot: (shoot: DashboardShootSummary) => void;
  onAdvanceStage?: (shoot: DashboardShootSummary) => void;
  loading?: boolean;
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
  const durations = column.shoots
    .map((shoot) => {
      if (!shoot.startTime || !shoot.deliveryDeadline) return null;
      const start = new Date(shoot.startTime).getTime();
      const end = new Date(shoot.deliveryDeadline).getTime();
      if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
      return (end - start) / (1000 * 60); // minutes
    })
    .filter((value): value is number => value !== null);

  if (!durations.length) return '—';
  const avg = durations.reduce((sum, val) => sum + val, 0) / durations.length;
  return minutesToLabel(avg);
};

export const ProductionWorkflowBoard: React.FC<ProductionWorkflowBoardProps> = ({
  workflow,
  onSelectShoot,
  onAdvanceStage,
  loading,
}) => {
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

  const toggleCard = (id: number) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-3xl text-muted-foreground">
        <p className="text-sm">Loading workflow…</p>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-3xl text-muted-foreground">
        <p className="text-sm">No workflow data available.</p>
      </div>
    );
  }

  const visibleColumns = workflow.columns.filter((column) => column.key !== 'booked');

  return (
    <div className="overflow-x-auto pb-2 -mx-3 sm:mx-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0 sm:min-w-[640px] lg:min-w-[960px] px-3 sm:px-0">
      {visibleColumns.map(column => (
        <div key={column.key} className="bg-card border border-border rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">
                {column.key === 'raw_upload' ? 'Raw uploaded' : column.label}
              </h3>
              <p className="text-xl sm:text-2xl font-semibold" style={{ color: column.accent }}>{column.count}</p>
              <p className="text-[11px] sm:text-[12px] text-muted-foreground/80">{column.count === 1 ? 'Active job' : `${column.count} active jobs`}</p>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Avg</p>
              <p className="text-xs sm:text-sm font-semibold text-foreground">{averageTurnaround(column)}</p>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3 overflow-y-auto pr-1 max-h-[400px] sm:max-h-[500px] custom-scrollbar">
            {column.shoots.slice(0, 6).map(shoot => {
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
                          {shoot.startTime
                            ? `${format(new Date(shoot.startTime), 'MMM d')} • ${shoot.timeLabel || 'TBD'}`
                            : shoot.timeLabel || 'TBD'}
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
            {column.shoots.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-4 border border-dashed border-slate-200 rounded-2xl">
                Empty
              </div>
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
};

