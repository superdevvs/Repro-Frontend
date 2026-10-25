import { useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/availability/utils";
import { getAvatarUrl } from "@/utils/defaultAvatars";
import type { AvailabilityStatus, Photographer } from "@/types/availability";

interface Props {
  day: Date;
  hiddenCount: number;
  isMobile: boolean;
  entries: Array<{ photographerId: string; photographer?: Photographer; status: AvailabilityStatus }>;
  onSelect: (photographerId: string) => void;
}

export function AvailabilityPhotographerOverflow({ day, hiddenCount, isMobile, entries, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const pendingSelection = useRef<string | null>(null);
  return <span className="inline-flex shrink-0" onClick={event => event.stopPropagation()}>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Show ${hiddenCount} more photographers for ${format(day, 'MMMM d')}`}
          className={cn("flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", isMobile ? "h-5 w-5 text-[8px]" : "h-6 w-6 text-[9px]")}>
          +{hiddenCount}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[90] w-72 max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl p-0"
        onCloseAutoFocus={event => {
          if (pendingSelection.current) {
            event.preventDefault();
            const id = pendingSelection.current;
            pendingSelection.current = null;
            onSelect(id);
          }
        }}>
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{format(day, 'EEEE, MMMM d')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Choose a photographer to view their schedule</p>
        </div>
        <div className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
          {entries.map(({ photographerId, photographer, status }) => <button type="button" key={photographerId} aria-label={photographer?.name || "Photographer"}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => { pendingSelection.current = photographerId; setOpen(false); }}>
            <Avatar className={cn("h-8 w-8 shrink-0 border-2", status === 'available' ? 'border-green-500' : status === 'booked' ? 'border-blue-500' : 'border-red-500')}>
              <AvatarImage src={getAvatarUrl(photographer?.avatar, 'photographer', undefined, photographer?.id)} alt="" />
              <AvatarFallback className="text-[10px]">{getInitials(photographer?.name || "Photographer")}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{photographer?.name || "Photographer"}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>)}
        </div>
      </PopoverContent>
    </Popover>
  </span>;
}
