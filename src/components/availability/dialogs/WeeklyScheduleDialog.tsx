import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TimeSelect } from "@/components/ui/time-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import API_ROUTES from "@/lib/api";
import {
  availabilityDateButtonClass,
  availabilityDatePopoverClass,
  uiTimeToHhmm,
} from "@/lib/availability/utils";
import type { AvailabilityStatus, AvailabilityToastFn } from "@/types/availability";

export interface NewWeeklyScheduleState {
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
  days: boolean[];
  recurring: boolean;
  note: string;
}

interface WeeklyScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newWeeklySchedule: NewWeeklyScheduleState;
  setNewWeeklySchedule: React.Dispatch<React.SetStateAction<NewWeeklyScheduleState>>;
  specificDateFrom: Date | undefined;
  setSpecificDateFrom: (date: Date | undefined) => void;
  specificDateTo: Date | undefined;
  setSpecificDateTo: (date: Date | undefined) => void;
  specificScheduleDates: Date[];
  selectedPhotographer: string;
  getPhotographerName: (id: string) => string;
  checkTimeOverlap: (
    startTime: string,
    endTime: string,
    dateStr?: string,
    dayOfWeek?: string,
    excludeSlotId?: string
  ) => boolean;
  date: Date | undefined;
  authHeaders: () => Record<string, string>;
  refreshPhotographerSlots: () => Promise<void>;
  toast: AvailabilityToastFn;
}

const DEFAULT_SCHEDULE: NewWeeklyScheduleState = {
  startTime: "09:00",
  endTime: "17:00",
  status: "available",
  days: [true, true, true, true, true, false, false],
  recurring: true,
  note: "",
};

export function WeeklyScheduleDialog({
  open,
  onOpenChange,
  newWeeklySchedule,
  setNewWeeklySchedule,
  specificDateFrom,
  setSpecificDateFrom,
  specificDateTo,
  setSpecificDateTo,
  specificScheduleDates,
  selectedPhotographer,
  getPhotographerName,
  checkTimeOverlap,
  date,
  authHeaders,
  refreshPhotographerSlots,
  toast,
}: WeeklyScheduleDialogProps) {
  const resetState = () => {
    setNewWeeklySchedule(DEFAULT_SCHEDULE);
    const seedDate = date ?? new Date();
    setSpecificDateFrom(seedDate);
    setSpecificDateTo(seedDate);
  };

  const handleCancel = () => {
    onOpenChange(false);
    resetState();
  };

  const handleSave = async () => {
    if (selectedPhotographer === "all") {
      toast({
        title: "Select a photographer",
        description: "Please select a specific photographer before adding schedule.",
        variant: "destructive"
      });
      return;
    }

    const startTime = uiTimeToHhmm(newWeeklySchedule.startTime);
    const endTime = uiTimeToHhmm(newWeeklySchedule.endTime);

    if (startTime >= endTime) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (newWeeklySchedule.recurring) {
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const activeDays = newWeeklySchedule.days
          .map((active, idx) => active ? dayNames[idx] : null)
          .filter(Boolean) as string[];

        if (activeDays.length === 0) {
          toast({
            title: "Select days",
            description: "Please select at least one day for recurring schedule.",
            variant: "destructive"
          });
          return;
        }

        const payload = {
          photographer_id: Number(selectedPhotographer),
          availabilities: activeDays.map(day => ({
            day_of_week: day,
            start_time: startTime,
            end_time: endTime,
            status: newWeeklySchedule.status === 'unavailable' ? 'unavailable' : 'available',
          }))
        };

        const res = await fetch(API_ROUTES.photographerAvailability.bulk, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          await refreshPhotographerSlots();
          onOpenChange(false);
          resetState();
          toast({
            title: "Schedule added",
            description: `Added recurring schedule for ${activeDays.length} day(s).`,
          });
        } else {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage = errorData.errors && errorData.errors.length > 0
            ? errorData.errors.join('. ')
            : errorData.message || "Failed to add schedule. Please try again.";
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive"
          });
        }
      } else {
        if (specificScheduleDates.length === 0) {
          toast({
            title: "Select a date range",
            description: "Please select a start and end date for the schedule.",
            variant: "destructive"
          });
          return;
        }

        const overlappingDate = newWeeklySchedule.status !== 'unavailable'
          ? specificScheduleDates.find((slotDate) => {
              const dateStr = format(slotDate, "yyyy-MM-dd");
              const dayOfWeekForDate = slotDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
              return checkTimeOverlap(
                newWeeklySchedule.startTime,
                newWeeklySchedule.endTime,
                dateStr,
                dayOfWeekForDate
              );
            })
          : undefined;

        if (overlappingDate) {
          toast({
            title: "Time slot overlap",
            description: `This time slot overlaps with an existing availability on ${format(overlappingDate, "MMMM d, yyyy")}. Please choose a different time.`,
            variant: "destructive"
          });
          return;
        }

        const payload = {
          photographer_id: Number(selectedPhotographer),
          availabilities: specificScheduleDates.map((slotDate) => ({
            date: format(slotDate, "yyyy-MM-dd"),
            start_time: startTime,
            end_time: endTime,
            status: newWeeklySchedule.status === 'unavailable' ? 'unavailable' : 'available',
          })),
        };

        const res = await fetch(API_ROUTES.photographerAvailability.bulk, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          await refreshPhotographerSlots();
          onOpenChange(false);
          resetState();
          toast({
            title: "Schedule added",
            description: specificScheduleDates.length === 1
              ? `Added schedule for ${format(specificScheduleDates[0], "MMMM d, yyyy")}`
              : `Added schedule from ${format(specificScheduleDates[0], "MMM d, yyyy")} to ${format(specificScheduleDates[specificScheduleDates.length - 1], "MMM d, yyyy")}`,
          });
        } else {
          const errorData = await res.json().catch(() => ({}));
          toast({
            title: "Error",
            description: errorData.message || "Failed to add schedule. Please try again.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add schedule. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Schedule</DialogTitle>
          <DialogDescription>
            Create availability schedule for {getPhotographerName(selectedPhotographer)}. Choose recurring weekly schedule or specific dates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Schedule Type</Label>
            <Select
              value={newWeeklySchedule.recurring ? "recurring" : "specific"}
              onValueChange={(value) =>
                setNewWeeklySchedule({
                  ...newWeeklySchedule,
                  recurring: value === "recurring"
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select schedule type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recurring">Recurring Weekly</SelectItem>
                <SelectItem value="specific">Specific Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewWeeklySchedule({ ...newWeeklySchedule, status: "available" })}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border",
                  newWeeklySchedule.status === "available"
                    ? "bg-green-950/40 border-green-700 text-green-300 ring-2 ring-green-800"
                    : "bg-muted/50 border-muted text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                Available
              </button>
              <button
                type="button"
                onClick={() => setNewWeeklySchedule({ ...newWeeklySchedule, status: "unavailable" })}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border",
                  newWeeklySchedule.status === "unavailable"
                    ? "bg-red-950/40 border-red-700 text-red-300 ring-2 ring-red-800"
                    : "bg-muted/50 border-muted text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Unavailable
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <TimeSelect
                value={newWeeklySchedule.startTime}
                onChange={(time) => setNewWeeklySchedule({ ...newWeeklySchedule, startTime: time })}
                placeholder="Select start time"
                startHour={6}
                endHour={21}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <TimeSelect
                value={newWeeklySchedule.endTime}
                onChange={(time) => setNewWeeklySchedule({ ...newWeeklySchedule, endTime: time })}
                placeholder="Select end time"
                startHour={6}
                endHour={21}
              />
            </div>
          </div>

          {newWeeklySchedule.recurring && (
            <div className="space-y-2">
              <Label>Repeat Days</Label>
              <div className="flex gap-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const newDays = [...newWeeklySchedule.days];
                      newDays[idx] = !newDays[idx];
                      setNewWeeklySchedule({ ...newWeeklySchedule, days: newDays });
                    }}
                    className={cn(
                      "h-9 w-9 rounded-full font-medium transition-all text-sm",
                      newWeeklySchedule.days[idx]
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!newWeeklySchedule.recurring && (
            <div className="space-y-3">
              <Label>Date Range</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          availabilityDateButtonClass,
                          !specificDateFrom && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {specificDateFrom ? format(specificDateFrom, "PPP") : "Pick a start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className={availabilityDatePopoverClass} align="start">
                      <Calendar
                        mode="single"
                        selected={specificDateFrom}
                        onSelect={(nextDate) => {
                          if (!nextDate) return;
                          setSpecificDateFrom(nextDate);
                          if (!specificDateTo || nextDate > specificDateTo) {
                            setSpecificDateTo(nextDate);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          availabilityDateButtonClass,
                          !specificDateTo && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {specificDateTo ? format(specificDateTo, "PPP") : "Pick an end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className={availabilityDatePopoverClass} align="start">
                      <Calendar
                        mode="single"
                        selected={specificDateTo}
                        onSelect={(nextDate) => {
                          if (!nextDate) return;
                          setSpecificDateTo(nextDate);
                          if (!specificDateFrom || nextDate < specificDateFrom) {
                            setSpecificDateFrom(nextDate);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Pick the same date in both fields for a one-day schedule.
                {specificScheduleDates.length > 0 ? ` ${specificScheduleDates.length} day(s) selected.` : ""}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Note (Optional)</Label>
            <Textarea
              value={newWeeklySchedule.note}
              onChange={(e) => setNewWeeklySchedule({ ...newWeeklySchedule, note: e.target.value })}
              placeholder="Add a note about this schedule..."
              className="min-h-[80px] rounded-md resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave}>Add Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
