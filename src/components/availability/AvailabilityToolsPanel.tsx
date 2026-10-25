import { useId, useState } from "react";
import { Ban, CalendarDays, Camera, ChevronLeft, ChevronRight, Clock, MapPin, Plus, RefreshCw, Settings2, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./AvailabilityDialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { CalendarFilters } from "./AvailabilityDayCards";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: string;
  canEdit: boolean;
  mapOpen: boolean;
  filters: CalendarFilters;
  onFilters: (filters: CalendarFilters) => void;
  onAdd: () => void;
  onBlock: () => void;
  onDefault: () => void;
  onManage: () => void;
  onMap: () => void;
  onSync: () => void;
}
function Tool({ icon: Icon, title, description, onClick, amber = false }: {
  icon: LucideIcon; title: string; description: string; onClick: () => void; amber?: boolean;
}) {
  const descriptionId = useId();
  return <button type="button" aria-label={title} aria-describedby={descriptionId} className="availability-tool-row" data-tone={amber ? "amber" : undefined} onClick={onClick}>
    <Icon aria-hidden="true" /><span><strong>{title}</strong><small id={descriptionId}>{description}</small></span><ChevronRight aria-hidden="true" />
  </button>;
}
export function AvailabilityToolsPanel(props: Props) {
  const [filterView, setFilterView] = useState(false);
  const openChange = (open: boolean) => { props.onOpenChange(open); if (!open) setFilterView(false); };
  const launch = (action: () => void) => () => { openChange(false); action(); };
  return <Dialog open={props.open} onOpenChange={openChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{filterView ? "Filter availability" : "Calendar tools"}</DialogTitle>
        <DialogDescription>{props.context}</DialogDescription>
      </DialogHeader>
      {filterView ? <>
        <button className="flex items-center gap-2 text-sm text-muted-foreground" onClick={() => setFilterView(false)}><ChevronLeft size={16} />Calendar tools</button>
        <div className="availability-tool-list">
          {([
            ["open", "Available time", "Open windows for new bookings", Clock],
            ["booked", "Shoots", "Scheduled appointments and shoot details", Camera],
            ["blocked", "Blocked time", "Time off and other unavailable hours", Ban],
          ] as const).map(([key, label, description, Icon]) => <label key={key} className="availability-tool-row" htmlFor={`availability-filter-${key}`}>
            <Icon /><span><strong>{label}</strong><small>{description}</small></span>
            <Switch id={`availability-filter-${key}`} checked={props.filters[key]} onCheckedChange={checked => props.onFilters({ ...props.filters, [key]: checked })} />
          </label>)}
        </div>
        <p className="availability-panel-note">Filters change the day details. Calendar totals always include all scheduled time.</p>
        <DialogFooter><Button onClick={() => openChange(false)}>Done</Button></DialogFooter>
      </> : <>
        {props.canEdit && <div className="availability-tool-list">
          <Tool icon={Plus} title="Add schedule" description="One date or a weekly repeat" onClick={launch(props.onAdd)} />
          <Tool icon={Ban} title="Block time" description="Protect time in a photographer’s schedule" amber onClick={launch(props.onBlock)} />
          <Tool icon={CalendarDays} title="Default schedule" description="Set the regular working week" onClick={launch(props.onDefault)} />
          <Tool icon={Settings2} title="Manage schedules" description="Edit, mark unavailable or delete" onClick={launch(props.onManage)} />
        </div>}
        <section className="availability-tool-section">
          <h3>View &amp; connect</h3>
          <div className="availability-tool-list">
            <Tool icon={SlidersHorizontal} title="Filter availability" description="Open time, shoots and blocks" onClick={() => setFilterView(true)} />
            <Tool icon={MapPin} title={props.mapOpen ? "Calendar view" : "Map view"} description="See scheduled locations for the selected day" onClick={launch(props.onMap)} />
            <Tool icon={RefreshCw} title="Calendar sync" description="Google connection · Apple / Outlook export" onClick={launch(props.onSync)} />
          </div>
        </section>
      </>}
    </DialogContent>
  </Dialog>;
}
