import { useState } from "react";
import { Edit, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { availabilityWeekday, normalizeAvailabilityDate, uiTimeToHhmm } from "@/lib/availability/utils";
import type { BackendSlot, WeeklyScheduleItem } from "@/types/availability";

interface WeeklyScheduleEditorProps {
  editingWeeklySchedule: boolean;
  setEditingWeeklySchedule: (value: boolean) => void;
  getCurrentWeeklySchedule: () => WeeklyScheduleItem[];
  updateCurrentWeeklySchedule: (
    index: number,
    field: keyof WeeklyScheduleItem,
    value: WeeklyScheduleItem[keyof WeeklyScheduleItem]
  ) => void;
  weeklyScheduleNote: string;
  setWeeklyScheduleNote: (value: string) => void;
  handleEditAvailability: () => void;
  saveWeeklySchedule: () => Promise<void>;
  savingWeeklySchedule?: boolean;
  selectedPhotographer: string;
  getPhotographerName: (id: string) => string;
  canEditAvailability: boolean;
  backendSlots: BackendSlot[];
}

export function WeeklyScheduleEditor({
  editingWeeklySchedule,
  setEditingWeeklySchedule,
  getCurrentWeeklySchedule,
  updateCurrentWeeklySchedule,
  weeklyScheduleNote,
  setWeeklyScheduleNote,
  handleEditAvailability,
  saveWeeklySchedule,
  savingWeeklySchedule: savingFromParent,
  selectedPhotographer,
  getPhotographerName,
  canEditAvailability,
  backendSlots,
}: WeeklyScheduleEditorProps) {
  const [savingLocally, setSavingLocally] = useState(false);
  const savingWeeklySchedule = savingFromParent || savingLocally;
  const handleSave = async () => {
    if (savingWeeklySchedule) return;
    setSavingLocally(true);
    try { await saveWeeklySchedule(); } finally { setSavingLocally(false); }
  };
  return (
    <>
      {!editingWeeklySchedule && <div className="flex flex-wrap gap-3 justify-between items-start mb-4 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold mb-1">
            {getPhotographerName(selectedPhotographer)}'s Weekly Schedule
          </h2>
          {!editingWeeklySchedule && (
            <p className="text-xs text-muted-foreground">Regular working hours</p>
          )}
        </div>
        {!editingWeeklySchedule && canEditAvailability && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditAvailability}
            className="h-8 rounded-md"
          >
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        )}
      </div>}

      {editingWeeklySchedule ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <p className="text-sm text-muted-foreground mb-4">Choose working days and set each day’s hours. Existing shoots remain reserved.</p>
          <div className="availability-weekly-rows mb-4">
            {getCurrentWeeklySchedule().map((day, index) => {
              const name = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index];
              return <div className="availability-weekly-row" key={name}>
                <label><input type="checkbox" aria-label={name} checked={day.active} disabled={savingWeeklySchedule}
                  onChange={event => updateCurrentWeeklySchedule(index, 'active', event.target.checked)} />{name.slice(0, 3)}</label>
                <input type="time" aria-label={`${name} start`} value={uiTimeToHhmm(day.startTime) || '09:00'} disabled={!day.active || savingWeeklySchedule}
                  onChange={event => updateCurrentWeeklySchedule(index, 'startTime', event.target.value)} />
                <span aria-hidden="true">–</span>
                <input type="time" aria-label={`${name} end`} value={uiTimeToHhmm(day.endTime) || '17:00'} disabled={!day.active || savingWeeklySchedule}
                  onChange={event => updateCurrentWeeklySchedule(index, 'endTime', event.target.value)} />
              </div>;
            })}
          </div>

          <div className="mb-4 flex-shrink-0">
            <Label className="text-xs uppercase mb-2 block font-semibold text-muted-foreground">NOTE</Label>
            <Textarea
              value={weeklyScheduleNote} maxLength={1000} aria-label="Schedule note" disabled={savingWeeklySchedule}
              onChange={(e) => setWeeklyScheduleNote(e.target.value)}
              placeholder="Add a note about this availability..."
              className="min-h-[80px] rounded-md resize-none"
            />
          </div>

          {(() => {
            if (!editingWeeklySchedule) return null;
            const currentSchedule = getCurrentWeeklySchedule();
            const activeDays = currentSchedule.filter(d => d.active);
            if (activeDays.length === 0) return null;


            const conflicts: Array<{ day: string; count: number }> = [];
            activeDays.forEach((daySchedule) => {
              if (!daySchedule.active) return;
              const startTime = uiTimeToHhmm(daySchedule.startTime);
              const endTime = uiTimeToHhmm(daySchedule.endTime);
              const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
              const dayName = dayNames[currentSchedule.indexOf(daySchedule)];

              const dayBookings = backendSlots.filter(slot => {
                if (slot.status !== 'booked') return false;
                if (slot.date) {
                  const slotDayName = availabilityWeekday(slot.date);
                  return slotDayName === dayName;
                }
                return slot.day_of_week?.toLowerCase() === dayName;
              });

              const overlappingBookings = dayBookings.filter(booking => {
                const bookingStart = booking.start_time;
                const bookingEnd = booking.end_time;
                return (bookingStart < endTime && bookingEnd > startTime);
              });

              if (overlappingBookings.length > 0) {
                conflicts.push({ day: dayName, count: overlappingBookings.length });
              }
            });

            if (conflicts.length === 0) return null;

            const totalConflicts = conflicts.reduce((sum, c) => sum + c.count, 0);
            const conflictDays = conflicts.map(c => c.day.charAt(0).toUpperCase() + c.day.slice(1)).join(', ');

            return (
              <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md flex-shrink-0">
                <div className="flex items-start gap-2">
                  <MoreVertical className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-orange-800 dark:text-orange-200">
                      Scheduled shoots
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                      {totalConflicts} existing booking{totalConflicts > 1 ? 's' : ''} on {conflictDays}. Booked time stays reserved within these hours.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="mt-auto space-y-2 flex-shrink-0 pt-4">
            <Button
              className="w-full h-10 font-semibold rounded-md"
              onClick={handleSave} disabled={savingWeeklySchedule}
            >
              {savingWeeklySchedule ? 'Saving…' : 'Save default schedule'}
            </Button>
            <button
              className="w-full text-sm text-muted-foreground hover:underline text-center py-1.5"
              disabled={savingWeeklySchedule} onClick={() => setEditingWeeklySchedule(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="mb-4 flex-shrink-0">
            <p className="text-xs text-muted-foreground mb-3">Regular working hours</p>
            <div className="space-y-2">
              {getCurrentWeeklySchedule().map((day, index) => {
                const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                const dayName = dayNames[index];
                const daySlots = backendSlots.filter(s =>
                  !normalizeAvailabilityDate(s.date) && s.day_of_week?.toLowerCase() === dayName
                );

                return (
                  <div
                    key={day.day}
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      day.active
                        ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                        : "bg-muted/30 border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center font-semibold text-sm",
                          day.active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {day.day.substring(0, 1)}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{day.day}</div>
                          <div className={cn(
                            "text-xs",
                            day.active ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {day.active
                              ? `${day.startTime} - ${day.endTime}`
                              : 'Not available'}
                          </div>
                        </div>
                      </div>
                      {day.active && daySlots.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {daySlots.length} slot{daySlots.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Summary</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-md bg-muted/50">
                <div className="text-xs text-muted-foreground">Active Days</div>
                <div className="text-sm font-semibold">
                  {getCurrentWeeklySchedule().filter(d => d.active).length}/7
                </div>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <div className="text-xs text-muted-foreground">Total Slots</div>
                <div className="text-sm font-semibold">
                  {backendSlots.filter(s => !s.date).length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
