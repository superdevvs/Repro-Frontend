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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeSelect } from "@/components/ui/time-select";
import { cn } from "@/lib/utils";
import API_ROUTES from "@/lib/api";
import { uiTimeToHhmm } from "@/lib/availability/utils";
import type { Availability, AvailabilityToastFn, BackendSlot } from "@/types/availability";

interface EditAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editedAvailability: Partial<Availability>;
  setEditedAvailability: (value: Partial<Availability>) => void;
  selectedPhotographer: string;
  getPhotographerName: (id: string) => string;
  checkTimeOverlap: (
    startTime: string,
    endTime: string,
    dateStr?: string,
    dayOfWeek?: string,
    excludeSlotId?: string
  ) => boolean;
  backendSlots: BackendSlot[];
  allBackendSlots: BackendSlot[];
  date: Date | undefined;
  authHeaders: () => Record<string, string>;
  refreshPhotographerSlots: () => Promise<void>;
  notifyDemoAvailabilityRestriction: () => void;
  setSelectedSlotId: (id: string | null) => void;
  toast: AvailabilityToastFn;
}

export function EditAvailabilityDialog({
  open,
  onOpenChange,
  editedAvailability,
  setEditedAvailability,
  selectedPhotographer,
  getPhotographerName,
  checkTimeOverlap,
  backendSlots,
  allBackendSlots,
  date,
  authHeaders,
  refreshPhotographerSlots,
  notifyDemoAvailabilityRestriction,
  setSelectedSlotId,
  toast,
}: EditAvailabilityDialogProps) {
  const handleSave = async () => {
    if (!editedAvailability.id || selectedPhotographer === "all") {
      toast({
        title: "Missing information",
        description: "Please select a specific photographer and availability to edit.",
        variant: "destructive"
      });
      return;
    }

    const startTime = uiTimeToHhmm(editedAvailability.startTime || "09:00");
    const endTime = uiTimeToHhmm(editedAvailability.endTime || "17:00");

    if (startTime >= endTime) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time.",
        variant: "destructive"
      });
      return;
    }

    const originalSlot = backendSlots.find(s => String(s.id) === editedAvailability.id) ||
      allBackendSlots.find(s => String(s.id) === editedAvailability.id);

    if (originalSlot) {
      const dayOfWeek = originalSlot.date
        ? undefined
        : originalSlot.day_of_week
          ? originalSlot.day_of_week
          : date
            ? date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
            : undefined;

      const isUnavailable = editedAvailability.status === 'unavailable';
      if (!isUnavailable && checkTimeOverlap(
        editedAvailability.startTime || "09:00",
        editedAvailability.endTime || "17:00",
        originalSlot.date || undefined,
        dayOfWeek,
        editedAvailability.id
      )) {
        toast({
          title: "Time slot overlap",
          description: "This time slot overlaps with an existing availability. Please choose a different time.",
          variant: "destructive"
        });
        return;
      }
    }

    const slotMeta = backendSlots.find(s => String(s.id) === String(editedAvailability.id)) ||
      allBackendSlots.find(s => String(s.id) === String(editedAvailability.id));
    if (slotMeta?.isRandom) {
      notifyDemoAvailabilityRestriction();
      return;
    }

    try {
      const payload = {
        photographer_id: Number(selectedPhotographer),
        date: editedAvailability.date,
        start_time: startTime,
        end_time: endTime,
        status: editedAvailability.status === 'unavailable' ? 'unavailable' : editedAvailability.status === 'booked' ? 'booked' : 'available',
      };
      const res = await fetch(API_ROUTES.photographerAvailability.update(editedAvailability.id), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await refreshPhotographerSlots();
        onOpenChange(false);
        setSelectedSlotId(null);
        setEditedAvailability({});
        toast({
          title: "Availability updated",
          description: `Updated availability for ${editedAvailability.date ? format(new Date(editedAvailability.date), "MMMM d, yyyy") : "the selected date"}`,
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description: errorData.message || "Failed to update availability. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update availability. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Availability</DialogTitle>
          <DialogDescription>
            Update availability for {getPhotographerName(selectedPhotographer)} on {editedAvailability.date ? format(new Date(editedAvailability.date), "MMMM d, yyyy") : "the selected date"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Status</Label>
            {editedAvailability.status === "booked" ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-blue-50 border border-blue-300 text-blue-700 w-fit">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Booked
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditedAvailability({ ...editedAvailability, status: "available" })}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border",
                    editedAvailability.status === "available"
                      ? "bg-green-50 border-green-300 text-green-700 ring-2 ring-green-200"
                      : "bg-muted/50 border-muted text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  Available
                </button>
                <button
                  type="button"
                  onClick={() => setEditedAvailability({ ...editedAvailability, status: "unavailable" })}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border",
                    editedAvailability.status === "unavailable"
                      ? "bg-red-50 border-red-300 text-red-700 ring-2 ring-red-200"
                      : "bg-muted/50 border-muted text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  Unavailable
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <TimeSelect
                value={editedAvailability.startTime || ""}
                onChange={(time) => setEditedAvailability({ ...editedAvailability, startTime: time })}
                placeholder="Select start time"
                startHour={6}
                endHour={21}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <TimeSelect
                value={editedAvailability.endTime || ""}
                onChange={(time) => setEditedAvailability({ ...editedAvailability, endTime: time })}
                placeholder="Select end time"
                startHour={6}
                endHour={21}
              />
            </div>
          </div>

          {editedAvailability.status === "booked" && (
            <div className="space-y-2">
              <Label>Shoot Title</Label>
              <Input
                placeholder="Enter shoot title or client name"
                value={editedAvailability.shootTitle || ""}
                onChange={e => setEditedAvailability({ ...editedAvailability, shootTitle: e.target.value })}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
