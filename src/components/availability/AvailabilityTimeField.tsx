import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimeSelect, type TimeSelectProps } from "@/components/ui/time-select";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { uiTimeToHhmm } from "@/lib/availability/utils";

/** Keep range forms compact; each picker opens at its full, usable width. */
export function AvailabilityTimeField(props: TimeSelectProps) {
  const [open, setOpen] = useState(false);
  const { formatTime } = useUserPreferences();
  const time = props.value ? uiTimeToHhmm(props.value) : "";
  const display = time ? formatTime(time) : props.placeholder || "Choose time";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={props.disabled}
          className="h-12 w-full min-w-0 justify-start gap-2 rounded-xl px-3 font-normal"
          aria-label={`${props.placeholder || "Choose time"}: ${display}`}
        >
          <Clock className="h-4 w-4 shrink-0" />
          <span className="truncate">{display}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[90] w-[300px] max-w-[calc(100vw-32px)] rounded-2xl p-1"
      >
        <TimeSelect
          {...props}
          startHour={0}
          endHour={23}
          footerAction={
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          }
        />
      </PopoverContent>
    </Popover>
  );
}
