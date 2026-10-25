import { useState } from "react";
import { endOfWeek, format, startOfWeek } from "date-fns";
import { Ban, ChevronDown, ChevronLeft, ChevronRight, Map, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Photographer } from "@/types/availability";
import { AvailabilityPhotographerSelect } from "./AvailabilityPhotographerSelect";
import { AvailabilityToolsMenu } from "./AvailabilityToolsMenu";

type ViewMode = "day" | "week" | "month";

interface AvailabilityCompactToolbarProps {
  photographers: Photographer[];
  selectedPhotographer: string;
  canManagePhotographerSelection: boolean;
  canEditAvailability: boolean;
  date: Date;
  viewMode: ViewMode;
  showingMap: boolean;
  onSelectPhotographer: (id: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleMap: () => void;
  onDateChange: (date: Date) => void;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  onBlock: () => void;
  onTeam: () => void;
  onDetails: () => void;
  onAddSchedule: () => void;
  onDefaultSchedule: () => void;
  onSync: () => void;
}

export function AvailabilityCompactToolbar(props: AvailabilityCompactToolbarProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { date, viewMode, showingMap, selectedPhotographer, canEditAvailability } = props;
  const weekStart = startOfWeek(date);
  const weekEnd = endOfWeek(date);
  const dateLabel = viewMode === "month"
    ? format(date, "MMMM yyyy")
    : viewMode === "week"
      ? `${format(weekStart, "MMM d")} – ${format(weekEnd, weekStart.getMonth() === weekEnd.getMonth() ? "d" : "MMM d")}`
      : format(date, "EEE, MMM d");

  return (
    <header className="flex shrink-0 flex-col gap-2 pb-2" aria-label="Availability controls">
      <h1 className="sr-only">Photographer availability</h1>
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          {props.canManagePhotographerSelection ? (
            <AvailabilityPhotographerSelect
              canManagePhotographerSelection
              photographers={props.photographers}
              selectedPhotographer={selectedPhotographer}
              onSelect={props.onSelectPhotographer}
              className="h-11 rounded-xl border-transparent bg-muted px-3 font-medium [&>span]:min-w-0 [&>span]:truncate [&>svg]:shrink-0"
            />
          ) : (
            <div className="flex h-11 min-w-0 items-center gap-2 rounded-xl bg-muted px-3 text-sm font-medium">
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{props.photographers.find(person => person.id === selectedPhotographer)?.name || "My availability"}</span>
            </div>
          )}
        </div>
        {canEditAvailability && (
          <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl border-amber-500/20 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300" aria-label="Block time" title="Block time" onClick={props.onBlock}>
            <Ban className="h-[18px] w-[18px]" />
          </Button>
        )}
        <AvailabilityToolsMenu {...props} />
      </div>

      <div className="flex items-center gap-2" role="group" aria-label="Calendar view">
        <div className="grid h-11 min-w-0 flex-1 grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {(["day", "week", "month"] as const).map(mode => (
            <button key={mode} type="button" aria-pressed={!showingMap && viewMode === mode} onClick={() => props.onViewModeChange(mode)} className={cn("rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !showingMap && viewMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <Button variant={showingMap ? "default" : "ghost"} size="icon" className={cn("h-11 w-11 shrink-0 rounded-xl", !showingMap && "bg-muted")} aria-label="Map view" aria-pressed={showingMap} title={showingMap ? "Return to calendar" : "Show shoot locations"} onClick={props.onToggleMap}>
          <Map className="h-[18px] w-[18px]" />
        </Button>
      </div>

      <nav className="flex min-w-0 items-center gap-1" aria-label="Calendar date">
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label={`Previous ${viewMode}`} onClick={() => props.onNavigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-11 min-w-0 flex-1 gap-1 rounded-xl px-1 text-sm" aria-label={`Choose date, ${dateLabel}`}>
              <span className="truncate">{dateLabel}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-[min(320px,calc(100vw-24px))] rounded-xl p-0">
            <Calendar mode="single" selected={date} defaultMonth={date} initialFocus onSelect={next => { if (next) { props.onDateChange(next); setDatePickerOpen(false); } }} />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label={`Next ${viewMode}`} onClick={() => props.onNavigate(1)}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="ghost" className="h-11 shrink-0 rounded-xl px-2.5 text-xs font-medium text-primary" onClick={props.onToday}>Today</Button>
      </nav>
    </header>
  );
}
