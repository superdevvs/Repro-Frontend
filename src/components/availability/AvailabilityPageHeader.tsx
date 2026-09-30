import { Ban, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AvailabilityViewModeButtons({ variant, viewMode, onChange }: {
  variant: "header" | "compact";
  viewMode: "day" | "week" | "month";
  onChange: (mode: "day" | "week" | "month") => void;
}) {
  return (
    <div className={cn("flex items-center gap-1 bg-muted rounded-md p-1", variant === "compact" && "shadow-sm")}>
      {(["day", "week", "month"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={cn(
            variant === "header"
              ? "px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              : "px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
            viewMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );
}

interface AvailabilityPageHeaderProps {
  isCompactLayout: boolean;
  isDesktop: boolean;
  canEditAvailability: boolean;
  viewMode: "day" | "week" | "month";
  onViewModeChange: (mode: "day" | "week" | "month") => void;
  goToToday: () => void;
  openBlockDialog: () => void;
  onSync: () => void;
}

export function AvailabilityPageHeader({
  isCompactLayout,
  isDesktop,
  canEditAvailability,
  viewMode,
  onViewModeChange,
  goToToday,
  openBlockDialog,
  onSync,
}: AvailabilityPageHeaderProps) {
  return isCompactLayout ? (
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-lg sm:text-xl font-bold truncate">Availability</h1>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Button variant="outline" size="sm" className="rounded-md whitespace-nowrap h-8 px-2.5 text-xs" onClick={goToToday}>Today</Button>
        {canEditAvailability && (
          <Button variant="destructive" className="rounded-md whitespace-nowrap h-8 px-2.5 text-xs" onClick={openBlockDialog} aria-label="Block Calendar">
            <Ban className="h-4 w-4" />
          </Button>
        )}
        <Button variant="outline" size="sm" className="rounded-md whitespace-nowrap h-8 px-2.5 text-xs" aria-label="Sync" title="Sync" onClick={onSync}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex-shrink-0">
      <PageHeader
        badge={isDesktop ? "Availability" : undefined}
        title={isDesktop ? "Photographer Availability" : "Availability"}
        description={isDesktop ? "Manage and schedule photographer availability" : undefined}
        action={
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" className="rounded-md whitespace-nowrap h-9 px-3 text-sm" onClick={goToToday}>Today</Button>
            <AvailabilityViewModeButtons variant="header" viewMode={viewMode} onChange={onViewModeChange} />
            {canEditAvailability && (
              <Button variant="destructive" className="rounded-md whitespace-nowrap h-9 px-3 text-sm" onClick={openBlockDialog}>
                <Ban className="h-4 w-4 mr-2" />
                Block Calendar
              </Button>
            )}
            <Button variant="outline" size="sm" className="rounded-md whitespace-nowrap h-9 px-3 text-sm" onClick={onSync}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync
            </Button>
          </div>
        }
      />
    </div>
  );
}
