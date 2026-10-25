import { useRef, useState } from "react";
import { CalendarDays, ChevronRight, List, MoreHorizontal, Plus, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AvailabilityPanelContent } from "./AvailabilityPanelContent";

interface AvailabilityToolsMenuProps {
  canManagePhotographerSelection: boolean;
  canEditAvailability: boolean;
  onTeam: () => void;
  onDetails: () => void;
  onAddSchedule: () => void;
  onDefaultSchedule: () => void;
  onSync: () => void;
}

export function AvailabilityToolsMenu(props: AvailabilityToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const nextAction = useRef<(() => void) | null>(null);
  const actions = [
    ...(props.canEditAvailability ? [
      { label: "Add schedule", detail: "Set availability for specific dates", icon: Plus, tone: "bg-primary/15 text-primary", onSelect: props.onAddSchedule },
      { label: "Default schedule", detail: "Set your recurring weekly hours", icon: CalendarDays, tone: "bg-violet-500/15 text-violet-500 dark:text-violet-300", onSelect: props.onDefaultSchedule },
    ] : []),
    { label: "Schedule details", detail: "Review and edit existing availability", icon: List, tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300", onSelect: props.onDetails },
    ...(props.canManagePhotographerSelection ? [
      { label: "Team availability", detail: "Find and switch photographers", icon: Users, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", onSelect: props.onTeam },
    ] : []),
    { label: "Calendar sync", detail: "Connect or export your calendar", icon: RefreshCw, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", onSelect: props.onSync },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl bg-muted" aria-label="Availability menu" title="Availability menu"><MoreHorizontal className="h-5 w-5" /></Button>
      </DialogTrigger>
      <AvailabilityPanelContent className="max-w-md rounded-3xl" onCloseAutoFocus={event => {
        const action = nextAction.current;
        if (action) { event.preventDefault(); nextAction.current = null; action(); }
      }}>
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle>Calendar tools</DialogTitle>
          <DialogDescription>Schedules, your team, and connected calendars.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pb-1">
          {actions.map(({ label, detail, icon: Icon, tone, onSelect }) => (
            <button key={label} type="button" aria-label={label} className="flex min-h-[68px] w-full items-center gap-3 rounded-2xl border border-border/50 bg-muted/45 px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { nextAction.current = onSelect; setOpen(false); }}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{detail}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </AvailabilityPanelContent>
    </Dialog>
  );
}
