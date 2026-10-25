import { useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAvatarUrl } from "@/utils/defaultAvatars";
import { getInitials } from "@/lib/availability/utils";
import type { Availability, Photographer } from "@/types/availability";
import { groupWeekStarts } from "./availabilityWeekGrouping";

interface Props {
  day: Date;
  slots: Availability[];
  photographers: Photographer[];
  formatTime: (time: string) => string;
  onSelect: (slot: Availability) => void;
}

function PersonAvatar({ slot, photographers }: Pick<Props, "photographers"> & {slot: Availability}) {
  const person = photographers.find(p => String(p.id) === slot.photographerId);
  return <span className="availability-week-avatar" data-status={slot.status}>
    <Avatar className="h-full w-full">
      <AvatarImage src={getAvatarUrl(person?.avatar, 'photographer', undefined, person?.id)} alt="" />
      <AvatarFallback className="bg-muted text-[10px]">{getInitials(person?.name || "Photographer")}</AvatarFallback>
    </Avatar>
  </span>;
}

function StartGroup({ group, ...props }: Props & {group: ReturnType<typeof groupWeekStarts>[number]}) {
  const [open, setOpen] = useState(false);
  const selected = useRef<Availability | null>(null);
  const count = group.people.length;
  const windowLabel = `${props.formatTime(`${group.start}:00`)}–${props.formatTime(`${group.end}:00`)}`;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="availability-week-stack"
        aria-label={`${format(props.day, 'EEEE, MMM d')}, starts ${windowLabel}, ${count} photographer${count === 1 ? '' : 's'}`}>
        {group.people.slice(0, 3).map(slot => <PersonAvatar key={slot.photographerId} slot={slot} photographers={props.photographers} />)}
        {count > 3 && <span className="availability-week-more">+{count - 3}</span>}
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="z-[90] w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl p-0"
      onCloseAutoFocus={event => {
        if (selected.current) { event.preventDefault(); const slot = selected.current; selected.current = null; props.onSelect(slot); }
      }}>
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{format(props.day, 'EEEE, MMMM d')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Starts {windowLabel} · {count} photographer{count === 1 ? '' : 's'}</p>
      </div>
      <div className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
        {group.entries.map((slot, index) => {
          const name = props.photographers.find(person => String(person.id) === slot.photographerId)?.name || "Photographer";
          return <button type="button" key={`${slot.id}-${index}`} className="flex min-h-16 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => { selected.current = slot; setOpen(false); }}>
            <PersonAvatar slot={slot} photographers={props.photographers} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{props.formatTime(slot.startTime)}–{props.formatTime(slot.endTime)}</span>
              <span className="mt-0.5 block text-[11px] capitalize" data-week-status={slot.status}>{slot.status}</span>
            </span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>;
        })}
      </div>
    </PopoverContent>
  </Popover>;
}

export function AvailabilityWeekGroups(props: Props) {
  return <div className="availability-week-start-groups">
    {groupWeekStarts(props.slots).map(group => <div key={group.start} className="availability-week-start-cell">
      {group.entries.length ? <StartGroup {...props} group={group} /> : <span className="text-muted-foreground/30" aria-hidden="true">—</span>}
    </div>)}
  </div>;
}
