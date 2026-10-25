import { useRef, useState } from "react";
import { Ban, CalendarDays, ChevronRight, List, Map, MoreHorizontal, Plus, RefreshCw, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AvailabilityPanelContent } from "./AvailabilityPanelContent";

interface AvailabilityToolsMenuProps {
  canManagePhotographerSelection: boolean;
  canEditAvailability: boolean;
  context?: string;
  showingMap?: boolean;
  onBlock?: () => void;
  onToggleMap?: () => void;
  onTeam: () => void;
  onDetails: () => void;
  onAddSchedule: () => void;
  onDefaultSchedule: () => void;
  onSync: () => void;
}
type ToolAction = { label: string; detail: string; icon: LucideIcon; onSelect: () => void };

/** Availability Flow's grouped tools, wired to the current production workflows. */
export function AvailabilityToolsMenu(props: AvailabilityToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const nextAction = useRef<(() => void) | null>(null);
  const schedules: ToolAction[] = [
    ...(props.canEditAvailability ? [
      { label: "Add schedule", detail: "One date or a weekly repeat", icon: Plus, onSelect: props.onAddSchedule },
      ...(props.onBlock ? [{ label: "Block time", detail: "Protect time in a photographer's schedule", icon: Ban, onSelect: props.onBlock }] : []),
      { label: "Default schedule", detail: "Set the regular working week", icon: CalendarDays, onSelect: props.onDefaultSchedule },
    ] : []),
    { label: "Manage schedules", detail: props.canEditAvailability ? "Edit, mark unavailable or delete" : "Review existing availability", icon: List, onSelect: props.onDetails },
  ];
  const connections: ToolAction[] = [
    ...(props.canManagePhotographerSelection ? [{ label: "Team availability", detail: "Find and switch photographers", icon: Users, onSelect: props.onTeam }] : []),
    ...(props.onToggleMap ? [{ label: props.showingMap ? "Calendar view" : "Map view", detail: "See the team's scheduled locations", icon: Map, onSelect: props.onToggleMap }] : []),
    { label: "Calendar sync", detail: "Google connection · Apple / Outlook export", icon: RefreshCw, onSelect: props.onSync },
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
          <DialogDescription>{props.context || "Schedules, your team, and connected calendars."}</DialogDescription>
        </DialogHeader>
        {[schedules, connections].map((group, index) => (
          <section key={index} className="availability-tool-section">
            {index === 1 && <h3>View &amp; connect</h3>}
            <div className="availability-tool-list">
              {group.map(({ label, detail, icon: Icon, onSelect }) => (
                <button key={label} type="button" aria-label={label} className="availability-tool-row" data-tone={label === "Block time" ? "amber" : undefined} onClick={() => { nextAction.current = onSelect; setOpen(false); }}>
                  <Icon aria-hidden="true" /><span><strong>{label}</strong><small>{detail}</small></span><ChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </AvailabilityPanelContent>
    </Dialog>
  );
}
