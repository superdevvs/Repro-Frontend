import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  CalendarIcon,
  ChevronRight,
  Clock,
  Edit,
  MoreVertical,
  Plus,
  User,
  Users,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  Availability,
  BackendSlot,
  WeeklyScheduleItem,
} from "@/types/availability";

type ViewMode = "day" | "week" | "month";

interface ScheduleDetailsPanelProps {
  variant: "mobile" | "desktop";
  viewMode: ViewMode;
  date: Date | undefined;
  selectedPhotographer: string;
  getPhotographerName: (id: string) => string;
  getSelectedDateAvailabilities: () => Availability[];
  getWeekAvailabilities: () => Availability[];
  getMonthAvailabilities: () => Availability[];
  canEditAvailability: boolean;
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
  handleDeleteAvailability: (slotId: string, specificDate?: string) => Promise<void>;
  notifyDemoAvailabilityRestriction: () => void;
  backendSlots: BackendSlot[];
  allBackendSlots: BackendSlot[];
  selectedSlotId: string | null;
  setSelectedSlotId: (id: string | null) => void;
  expandedBookingDetails: Set<string>;
  setExpandedBookingDetails: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditedAvailability: (value: Partial<Availability>) => void;
  setIsEditDialogOpen: (value: boolean) => void;
  setIsWeeklyScheduleDialogOpen: (value: boolean) => void;
  setSelectedShootId: (value: number | null) => void;
  setShootDetailsModalOpen: (value: boolean) => void;
  to12HourDisplay: (t?: string) => string;
}

export function ScheduleDetailsPanel(props: ScheduleDetailsPanelProps) {
  const {
    variant,
    viewMode,
    date,
    selectedPhotographer,
    getPhotographerName,
    getSelectedDateAvailabilities,
    getWeekAvailabilities,
    getMonthAvailabilities,
    canEditAvailability,
    editingWeeklySchedule,
    setEditingWeeklySchedule,
    getCurrentWeeklySchedule,
    updateCurrentWeeklySchedule,
    weeklyScheduleNote,
    setWeeklyScheduleNote,
    handleEditAvailability,
    saveWeeklySchedule,
    handleDeleteAvailability,
    notifyDemoAvailabilityRestriction,
    backendSlots,
    allBackendSlots,
    selectedSlotId,
    setSelectedSlotId,
    expandedBookingDetails,
    setExpandedBookingDetails,
    setEditedAvailability,
    setIsEditDialogOpen,
    setIsWeeklyScheduleDialogOpen,
    setSelectedShootId,
    setShootDetailsModalOpen,
    to12HourDisplay,
  } = props;

  const isMobile = variant === "mobile";

  // Mobile variant with simplified editing
  if (isMobile) {
    return (
      <Card className="p-3 sm:p-4 flex flex-col border shadow-sm rounded-md">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {selectedPhotographer !== "all" ? (
            <>
              {!editingWeeklySchedule ? (
                <>
                  <div className="flex justify-between items-start mb-4 flex-shrink-0">
                    <div>
                      <h2 className="text-sm sm:text-base font-semibold mb-1">
                        {viewMode === "day" && date ? format(date, 'EEEE, MMMM d, yyyy') : viewMode === "week" && date ? `Week of ${format(startOfWeek(date), 'MMM d')} - ${format(endOfWeek(date), 'MMM d, yyyy')}` : viewMode === "month" && date ? format(date, 'MMMM yyyy') : "Schedule"}
                      </h2>
                      <p className="text-xs text-muted-foreground">{getPhotographerName(selectedPhotographer)}'s Schedule</p>
                    </div>
                    {canEditAvailability && (
                      <Button variant="outline" size="sm" onClick={() => setIsWeeklyScheduleDialogOpen(true)} className="h-8 rounded-md">
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Add Schedule
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {(() => {
                      let slots: Availability[] = [];
                      if (viewMode === "day") slots = getSelectedDateAvailabilities();
                      else if (viewMode === "week") slots = getWeekAvailabilities();
                      else if (viewMode === "month") slots = getMonthAvailabilities();
                      const daySlots = slots;
                      if (daySlots.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-sm font-medium text-muted-foreground mb-1">No schedules</p>
                            <p className="text-xs text-muted-foreground">No availability scheduled for this {viewMode === "day" ? "day" : viewMode === "week" ? "week" : "month"}</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {daySlots.map((slot) => (
                            <div
                              key={slot.id}
                              data-slot-id={slot.id}
                              ref={selectedSlotId === slot.id ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) : undefined}
                              onClick={() => {
                                setSelectedSlotId(slot.id);
                                if (slot.status === 'booked' && slot.shootDetails) {
                                  setExpandedBookingDetails(prev => new Set(prev).add(slot.id));
                                }
                              }}
                              className={cn("p-3 rounded-lg border-2 transition-all", selectedSlotId === slot.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={slot.status === 'available' ? 'default' : slot.status === 'booked' ? 'secondary' : 'destructive'} className="text-xs">{slot.status}</Badge>
                                    {slot.origin === 'weekly' && <Badge variant="outline" className="text-xs">Recurring</Badge>}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    {to12HourDisplay(slot.startTime)} - {to12HourDisplay(slot.endTime)}
                                  </div>
                                  {slot.date && <div className="text-xs text-muted-foreground mt-1">{format(new Date(slot.date), 'MMM d, yyyy')}</div>}
                                  {slot.shootTitle && <div className="text-xs text-muted-foreground mt-1">{slot.shootTitle}</div>}
                                </div>
                                {canEditAvailability && (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (slot.isRandom) {
                                          notifyDemoAvailabilityRestriction();
                                          return;
                                        }
                                        setEditedAvailability(slot);
                                        setIsEditDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAvailability(slot.id, slot.date);
                                      }}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Edit Weekly Schedule</h3>
                    <Button variant="ghost" size="sm" onClick={() => setEditingWeeklySchedule(false)}>Cancel</Button>
                  </div>
                  {/* Weekly schedule editing UI */}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground mb-1">Select a photographer</p>
              <p className="text-xs text-muted-foreground">Choose a photographer to view their schedule</p>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Desktop variant
  return (
    <Card className="p-4 flex-1 flex flex-col border shadow-sm rounded-md min-h-0 overflow-hidden">
      {selectedPhotographer !== "all" ? (
        <>
          {!editingWeeklySchedule ? (
            <>
              <div className="flex justify-between items-start mb-4 flex-shrink-0">
                <div>
                  <h2 className="text-base font-semibold mb-1">
                    {viewMode === "day" && date
                      ? format(date, 'EEEE, MMMM d, yyyy')
                      : viewMode === "week" && date
                        ? `Week of ${format(startOfWeek(date), 'MMM d')} - ${format(endOfWeek(date), 'MMM d, yyyy')}`
                        : viewMode === "month" && date
                          ? format(date, 'MMMM yyyy')
                          : "Schedule"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {getPhotographerName(selectedPhotographer)}'s Schedule
                  </p>
                </div>
                {canEditAvailability && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsWeeklyScheduleDialogOpen(true)}
                    className="h-8 rounded-md"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Schedule
                  </Button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {(() => {
                  let slots: Availability[] = [];
                  if (viewMode === "day") slots = getSelectedDateAvailabilities();
                  else if (viewMode === "week") slots = getWeekAvailabilities();
                  else if (viewMode === "month") slots = getMonthAvailabilities();

                  const daySlots = slots;

                  if (daySlots.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-center py-8">
                        <CalendarIcon className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium mb-1">No schedules for this day</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Add availability slots to manage this day
                        </p>
                      </div>
                    );
                  }

                  const formatTimeDisplay = (time: string) => to12HourDisplay(time);

                  const groupedSlots = daySlots.reduce((acc, slot) => {
                    const dateKey = slot.date || 'weekly';
                    if (!acc[dateKey]) acc[dateKey] = [];
                    acc[dateKey].push(slot);
                    return acc;
                  }, {} as Record<string, Availability[]>);

                  return (
                    <div className="space-y-4">
                      {Object.entries(groupedSlots).map(([dateKey, dateSlots]) => (
                        <div key={dateKey}>
                          {viewMode !== "day" && (
                            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                              {dateKey === 'weekly' ? 'Recurring' : format(new Date(dateKey), 'EEEE, MMMM d')}
                            </h3>
                          )}
                          <div className="space-y-2">
                            {dateSlots.map((slot) => (
                              <div
                                key={slot.id}
                                data-slot-id={slot.id}
                                ref={selectedSlotId === slot.id ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) : undefined}
                                className={cn(
                                  "p-3 rounded-lg border transition-all cursor-pointer hover:opacity-90",
                                  selectedSlotId === slot.id && "border-primary border-2",
                                  slot.status === 'available' && "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800",
                                  slot.status === 'booked' && "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800",
                                  slot.status === 'unavailable' && "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                                )}
                                onClick={() => {
                                  setSelectedSlotId(slot.id);
                                  if (slot.status === 'booked' && slot.shootDetails) {
                                    setExpandedBookingDetails(prev => new Set(prev).add(slot.id));
                                  }
                                }}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={cn(
                                        "text-xs font-semibold px-2 py-0.5 rounded capitalize",
                                        slot.status === 'available' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                                        slot.status === 'booked' && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                                        slot.status === 'unavailable' && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                      )}>
                                        {slot.status}
                                      </span>
                                      {slot.origin === 'weekly' && (
                                        <span className="text-xs text-muted-foreground">Recurring</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                      {formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}
                                    </div>
                                    {slot.shootTitle && (
                                      <div className="text-sm mt-1 font-medium">{slot.shootTitle}</div>
                                    )}

                                    {slot.status === 'booked' && slot.shootDetails && (
                                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                                        <button
                                          type="button"
                                          className="flex items-center justify-between w-full text-left text-sm font-semibold text-blue-800 dark:text-blue-200 hover:opacity-80"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedBookingDetails(prev => {
                                              const next = new Set(prev);
                                              if (next.has(slot.id)) {
                                                next.delete(slot.id);
                                              } else {
                                                next.add(slot.id);
                                              }
                                              return next;
                                            });
                                          }}
                                        >
                                          <span>{slot.shootDetails.title}</span>
                                          <ChevronRight className={cn("h-4 w-4 transition-transform", expandedBookingDetails.has(slot.id) && "rotate-90")} />
                                        </button>
                                        {expandedBookingDetails.has(slot.id) && (
                                          <div className="space-y-2 mt-2">
                                            {slot.shootDetails.address && (
                                              <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                                                <CalendarIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                <span>{slot.shootDetails.address}</span>
                                              </div>
                                            )}
                                            {slot.shootDetails.client && (
                                              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                <User className="h-3 w-3 flex-shrink-0" />
                                                <span>{slot.shootDetails.client.name}</span>
                                                {slot.shootDetails.client.phone && (
                                                  <span className="text-muted-foreground/60">• {slot.shootDetails.client.phone}</span>
                                                )}
                                              </div>
                                            )}
                                            {slot.shootDetails.services && slot.shootDetails.services.length > 0 && (
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {slot.shootDetails.services.map((service) => (
                                                  <span
                                                    key={service.id}
                                                    className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded"
                                                  >
                                                    {service.name}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                            {slot.shootDetails.shoot_status && (
                                              <div className="text-[10px] text-muted-foreground capitalize">
                                                Status: {slot.shootDetails.shoot_status.replace(/_/g, ' ')}
                                              </div>
                                            )}
                                            {slot.shoot_id && (
                                              <button
                                                type="button"
                                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedShootId(slot.shoot_id!);
                                                  setShootDetailsModalOpen(true);
                                                }}
                                              >
                                                View Shoot Details →
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {canEditAvailability && slot.status !== 'booked' && (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const slotToEdit = backendSlots.find(s => String(s.id) === slot.id) ||
                                            allBackendSlots.find(s => String(s.id) === slot.id);
                                          if (slotToEdit?.isRandom) {
                                            notifyDemoAvailabilityRestriction();
                                            return;
                                          }
                                          if (slotToEdit) {
                                            setEditedAvailability({
                                              id: slot.id,
                                              photographerId: slot.photographerId,
                                              date: slot.date,
                                              startTime: slot.startTime,
                                              endTime: slot.endTime,
                                              status: slot.status,
                                              shootTitle: slot.shootTitle
                                            });
                                            setIsEditDialogOpen(true);
                                          }
                                        }}
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteAvailability(slot.id, slot.date);
                                        }}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            <WeeklyScheduleEditor
              editingWeeklySchedule={editingWeeklySchedule}
              setEditingWeeklySchedule={setEditingWeeklySchedule}
              getCurrentWeeklySchedule={getCurrentWeeklySchedule}
              updateCurrentWeeklySchedule={updateCurrentWeeklySchedule}
              weeklyScheduleNote={weeklyScheduleNote}
              setWeeklyScheduleNote={setWeeklyScheduleNote}
              handleEditAvailability={handleEditAvailability}
              saveWeeklySchedule={saveWeeklySchedule}
              selectedPhotographer={selectedPhotographer}
              getPhotographerName={getPhotographerName}
              canEditAvailability={canEditAvailability}
              backendSlots={backendSlots}
            />
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-2">Weekly Schedule</h2>
            <p className="text-muted-foreground">
              Select a specific photographer to view their weekly schedule
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

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
  selectedPhotographer: string;
  getPhotographerName: (id: string) => string;
  canEditAvailability: boolean;
  backendSlots: BackendSlot[];
}

function WeeklyScheduleEditor({
  editingWeeklySchedule,
  setEditingWeeklySchedule,
  getCurrentWeeklySchedule,
  updateCurrentWeeklySchedule,
  weeklyScheduleNote,
  setWeeklyScheduleNote,
  handleEditAvailability,
  saveWeeklySchedule,
  selectedPhotographer,
  getPhotographerName,
  canEditAvailability,
  backendSlots,
}: WeeklyScheduleEditorProps) {
  return (
    <>
      <div className="flex justify-between items-start mb-4 flex-shrink-0">
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
      </div>

      {editingWeeklySchedule ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="mb-4 flex-shrink-0">
            <h3 className="text-lg font-semibold mb-1">Edit Availability</h3>
            <p className="text-xs text-muted-foreground">
              Managing {getPhotographerName(selectedPhotographer)}
            </p>
          </div>

          <div className="mb-4 flex-shrink-0">
            <Label className="text-xs uppercase mb-2 block font-semibold text-muted-foreground">TIME RANGE</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                <Input
                  type="text"
                  value={getCurrentWeeklySchedule()[0]?.startTime || "09:00 AM"}
                  onChange={(e) => {
                    getCurrentWeeklySchedule().forEach((_, idx) => {
                      updateCurrentWeeklySchedule(idx, 'startTime', e.target.value);
                    });
                  }}
                  className="pl-10 h-10 rounded-md"
                  placeholder="09:00 AM"
                />
              </div>
              <span className="text-muted-foreground font-medium">-</span>
              <div className="flex-1 relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                <Input
                  type="text"
                  value={getCurrentWeeklySchedule()[0]?.endTime || "05:00 PM"}
                  onChange={(e) => {
                    getCurrentWeeklySchedule().forEach((_, idx) => {
                      updateCurrentWeeklySchedule(idx, 'endTime', e.target.value);
                    });
                  }}
                  className="pl-10 h-10 rounded-md"
                  placeholder="05:00 PM"
                />
              </div>
            </div>
          </div>

          <div className="mb-4 flex-shrink-0">
            <Label className="text-xs uppercase mb-2 block font-semibold text-muted-foreground">REPEAT</Label>
            <div className="flex gap-2">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
                const scheduleDay = getCurrentWeeklySchedule()[idx];
                return (
                  <button
                    key={idx}
                    onClick={() => updateCurrentWeeklySchedule(idx, 'active', !scheduleDay.active)}
                    className={cn(
                      "h-9 w-9 rounded-full font-medium transition-all text-sm",
                      scheduleDay.active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-4 flex-shrink-0">
            <Label className="text-xs uppercase mb-2 block font-semibold text-muted-foreground">NOTE</Label>
            <Textarea
              value={weeklyScheduleNote}
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

            const startTime = currentSchedule[0]?.startTime || '09:00';
            const endTime = currentSchedule[0]?.endTime || '17:00';

            const conflicts: Array<{ day: string; count: number }> = [];
            activeDays.forEach((daySchedule, idx) => {
              if (!daySchedule.active) return;
              const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
              const dayName = dayNames[idx];

              const dayBookings = backendSlots.filter(slot => {
                if (slot.status !== 'booked') return false;
                if (slot.date) {
                  const slotDate = new Date(slot.date);
                  const slotDayName = slotDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
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
                      Conflicts found
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                      This schedule overlaps with {totalConflicts} existing booking{totalConflicts > 1 ? 's' : ''} on {conflictDays}.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="mt-auto space-y-2 flex-shrink-0 pt-4">
            <Button
              className="w-full h-10 font-semibold rounded-md"
              onClick={saveWeeklySchedule}
            >
              Save Changes
            </Button>
            <button
              className="w-full text-sm text-destructive hover:underline text-center py-1.5"
              onClick={() => setEditingWeeklySchedule(false)}
            >
              Delete Slot
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
                  !s.date && s.day_of_week?.toLowerCase() === dayName
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
