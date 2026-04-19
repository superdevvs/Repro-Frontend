import { useEffect } from "react";
import { format } from "date-fns";
import { Ban, CalendarIcon, ChevronDown, Loader2, Search } from "lucide-react";
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
import { TimeSelect } from "@/components/ui/time-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/utils/defaultAvatars";
import { cn } from "@/lib/utils";
import API_ROUTES from "@/lib/api";
import {
  availabilityDateButtonClass,
  availabilityDatePopoverClass,
  uiTimeToHhmm,
} from "@/lib/availability/utils";
import type { AvailabilityToastFn, Photographer } from "@/types/availability";

export interface BlockScheduleState {
  date: Date | null;
  startTime: string;
  endTime: string;
}

interface BlockTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockSchedule: BlockScheduleState;
  setBlockSchedule: (value: BlockScheduleState) => void;
  blockPhotographer: string;
  setBlockPhotographer: (value: string) => void;
  blockPhotographerOpen: boolean;
  setBlockPhotographerOpen: (value: boolean) => void;
  blockPhotographerSearch: string;
  setBlockPhotographerSearch: (value: string) => void;
  photographerScopedBlockId: string;
  isPhotographer: boolean;
  user: { id?: number | string; name?: string } | null;
  photographers: Photographer[];
  selectedPhotographer: string;
  getPhotographerName: (id: string) => string;
  authHeaders: () => Record<string, string>;
  refreshPhotographerSlots: () => Promise<void>;
  isBlocking: boolean;
  setIsBlocking: (value: boolean) => void;
  toast: AvailabilityToastFn;
}

export function BlockTimeDialog({
  open,
  onOpenChange,
  blockSchedule,
  setBlockSchedule,
  blockPhotographer,
  setBlockPhotographer,
  blockPhotographerOpen,
  setBlockPhotographerOpen,
  blockPhotographerSearch,
  setBlockPhotographerSearch,
  photographerScopedBlockId,
  isPhotographer,
  user,
  photographers,
  selectedPhotographer,
  getPhotographerName,
  authHeaders,
  refreshPhotographerSlots,
  isBlocking,
  setIsBlocking,
  toast,
}: BlockTimeDialogProps) {
  useEffect(() => {
    if (!open) return;

    if (photographerScopedBlockId) {
      setBlockPhotographer(photographerScopedBlockId);
    } else if (!blockPhotographer) {
      setBlockPhotographer(selectedPhotographer === "all" ? "" : selectedPhotographer);
    }

    if (isPhotographer) {
      setBlockPhotographerOpen(false);
      setBlockPhotographerSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPhotographer, photographerScopedBlockId, selectedPhotographer]);

  const handleDialogChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setBlockPhotographerOpen(false);
      setBlockPhotographerSearch("");
      setBlockPhotographer(photographerScopedBlockId);
      setBlockSchedule({ date: null, startTime: "09:00", endTime: "17:00" });
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setBlockSchedule({ date: null, startTime: "09:00", endTime: "17:00" });
    setBlockPhotographer(photographerScopedBlockId);
    setBlockPhotographerSearch("");
    setBlockPhotographerOpen(false);
  };

  const handleBlock = async () => {
    if (isBlocking) return;
    if (!blockPhotographer) {
      toast({
        title: "Select a photographer",
        description: "Please choose a photographer before blocking time.",
        variant: "destructive"
      });
      return;
    }

    if (!blockSchedule.date) {
      toast({
        title: "Select a date",
        description: "Please select a date to block.",
        variant: "destructive"
      });
      return;
    }

    const startTime = uiTimeToHhmm(blockSchedule.startTime);
    const endTime = uiTimeToHhmm(blockSchedule.endTime);

    if (startTime >= endTime) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time.",
        variant: "destructive"
      });
      return;
    }

    setIsBlocking(true);
    try {
      const dateStr = format(blockSchedule.date, "yyyy-MM-dd");
      const payload = {
        photographer_id: Number(blockPhotographer),
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
        status: "unavailable",
      };

      const res = await fetch(API_ROUTES.photographerAvailability.create, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await refreshPhotographerSlots();
        onOpenChange(false);
        setBlockSchedule({ date: null, startTime: "09:00", endTime: "17:00" });
        setBlockPhotographer(photographerScopedBlockId);
        setBlockPhotographerSearch("");
        setBlockPhotographerOpen(false);
        toast({
          title: "Time blocked",
          description: `Blocked ${startTime} - ${endTime} on ${format(blockSchedule.date, "MMMM d, yyyy")}`,
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description: errorData.message || "Failed to block time. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to block time. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Block Time</DialogTitle>
          <DialogDescription>
            Block a time slot{blockPhotographer ? ` for ${getPhotographerName(blockPhotographer)}` : ""}{blockSchedule.date ? ` on ${format(blockSchedule.date, "MMMM d, yyyy")}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isPhotographer ? (
            <div className="space-y-2">
              <Label>Photographer</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBlockPhotographerOpen(!blockPhotographerOpen)}
                  className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                    !blockPhotographer && "text-muted-foreground"
                  )}
                >
                  <span className="truncate">{blockPhotographer ? getPhotographerName(blockPhotographer) : "Choose Photographer"}</span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </button>
                {blockPhotographerOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                    <div className="p-2">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50">
                        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <input
                          type="text"
                          placeholder="Search photographers..."
                          value={blockPhotographerSearch}
                          onChange={(e) => setBlockPhotographerSearch(e.target.value)}
                          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto px-1 pb-1">
                      {photographers
                        .filter((p) =>
                          p.name.toLowerCase().includes(blockPhotographerSearch.toLowerCase())
                        )
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setBlockPhotographer(p.id);
                              setBlockPhotographerOpen(false);
                              setBlockPhotographerSearch("");
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                              blockPhotographer === p.id && "bg-accent text-accent-foreground"
                            )}
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={getAvatarUrl(p.avatar)} />
                              <AvatarFallback className="text-xs">{p.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{p.name}</span>
                          </button>
                        ))}
                      {photographers.filter((p) =>
                        p.name.toLowerCase().includes(blockPhotographerSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">No photographers found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Photographer</Label>
              <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                {user?.name || getPhotographerName(photographerScopedBlockId)}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    availabilityDateButtonClass,
                    !blockSchedule.date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {blockSchedule.date ? format(blockSchedule.date, "PPP") : "Choose date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={availabilityDatePopoverClass} align="start">
                <Calendar
                  mode="single"
                  selected={blockSchedule.date ?? undefined}
                  onSelect={(nextDate) => {
                    if (!nextDate) return;
                    setBlockSchedule({ ...blockSchedule, date: nextDate });
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <TimeSelect
                value={blockSchedule.startTime}
                onChange={(time) => setBlockSchedule({ ...blockSchedule, startTime: time })}
                placeholder="Select start time"
                startHour={6}
                endHour={21}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <TimeSelect
                value={blockSchedule.endTime}
                onChange={(time) => setBlockSchedule({ ...blockSchedule, endTime: time })}
                placeholder="Select end time"
                startHour={6}
                endHour={21}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-950/40 border border-red-800 text-red-300 text-sm">
            <Ban className="h-4 w-4 shrink-0" />
            This time will be marked as unavailable
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button variant="destructive" disabled={isBlocking} onClick={handleBlock}>
            {isBlocking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
            {isBlocking ? "Blocking..." : "Block Time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
