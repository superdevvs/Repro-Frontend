import { formatAvailabilityDate, uiTimeToHhmm } from "@/lib/availability/utils";
import { useState } from 'react';
import { checkTimeOverlap as overlaps } from '@/lib/availability/selectors';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/availability/AvailabilityDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvailabilityTimeField as TimeSelect } from "../AvailabilityTimeField";
import API_ROUTES from "@/lib/api";
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
  onDelete?: (id: string) => void;
}

export function EditAvailabilityDialog({
  open,
  onOpenChange,
  editedAvailability,
  setEditedAvailability,
  selectedPhotographer,
  getPhotographerName,
  backendSlots,
  allBackendSlots,
  date,
  authHeaders,
  refreshPhotographerSlots,
  notifyDemoAvailabilityRestriction,
  setSelectedSlotId,
  toast,
  onDelete,
}: EditAvailabilityDialogProps) {
  const [saving, setSaving] = useState(false);
  const isBlock = [...backendSlots, ...allBackendSlots].find(slot => String(slot.id) === editedAvailability.id)?.status === 'unavailable';
  const handleSave = async () => {
    if (saving) return;
    const personId = editedAvailability.photographerId || selectedPhotographer;
    if (!editedAvailability.id || personId === "all") {
      toast({
        title: "Missing information",
        description: "Please select a specific photographer and availability to edit.",
        variant: "destructive"
      });
      return;
    }

    const startTime = uiTimeToHhmm(editedAvailability.startTime || "09:00");
    const endTime = uiTimeToHhmm(editedAvailability.endTime || "17:00");

    if (!startTime || !endTime || startTime >= endTime) {
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
      if (!isUnavailable && overlaps({ selectedPhotographer: personId, backendSlots: [...backendSlots, ...allBackendSlots], allBackendSlots: [] },
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

    setSaving(true);
    try {
      const payload = {
        photographer_id: Number(personId),
        date: slotMeta?.date ?? (editedAvailability.origin === 'weekly' ? null : editedAvailability.date),
        ...(slotMeta?.day_of_week ? { day_of_week: slotMeta.day_of_week } : {}),
        note: editedAvailability.note?.trim() || null,
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
          description: `Updated availability for ${editedAvailability.date ? formatAvailabilityDate(editedAvailability.date, "MMMM d, yyyy") : "the selected date"}`,
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
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!saving) onOpenChange(nextOpen); }}>
      <DialogContent className="availability-dialog">
        <DialogHeader>
          <DialogTitle>{isBlock ? "Edit blocked time" : "Edit Availability"}</DialogTitle>
          <DialogDescription>
            Update availability for {getPhotographerName(editedAvailability.photographerId || selectedPhotographer)}{editedAvailability.origin === 'weekly' ? ' in their recurring schedule' : ` on ${editedAvailability.date ? formatAvailabilityDate(editedAvailability.date, 'MMMM d, yyyy') : 'the selected date'}`}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Status</Label>
            {isBlock ? <p className="text-sm text-muted-foreground">Blocked time. Edit the hours or reason, or remove this block.</p> : editedAvailability.status === "booked" ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-blue-50 border border-blue-300 text-blue-700 w-fit">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Booked
              </div>
            ) : (
              <div className="availability-choice status">
                {(['available', 'unavailable'] as const).map(status => <button key={status} type="button"
                  data-status={status} aria-pressed={editedAvailability.status === status}
                  onClick={() => setEditedAvailability({ ...editedAvailability, status })}>
                  {status === 'available' ? 'Available' : 'Unavailable'}
                </button>)}
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

          <div className="space-y-2"><Label htmlFor="availability-edit-note">Note</Label><Textarea id="availability-edit-note" value={editedAvailability.note || ''} maxLength={1000} onChange={event => setEditedAvailability({ ...editedAvailability, note: event.target.value })} /></div>
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
          {isBlock && onDelete && editedAvailability.id && <Button variant="destructive" disabled={saving} onClick={() => { onOpenChange(false); onDelete(editedAvailability.id!); }}>Remove block</Button>}
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
