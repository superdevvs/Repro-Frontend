import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import { EmptyState } from '@/components/ui/empty-state';
import { useEffect, useRef } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { formatAvailabilityDate } from "@/lib/availability/utils";
import { Ban, CalendarDays, CalendarIcon, Clock, Pencil, Plus, Trash2, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  openDefaultSchedule: () => void;
  saveWeeklySchedule: () => Promise<void>;
  savingWeeklySchedule?: boolean;
  handleDeleteAvailability: (slotId: string, specificDate?: string) => Promise<void>;
  handleMarkUnavailable: (slotId: string, specificDate?: string) => Promise<void>;
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
    openDefaultSchedule,
    saveWeeklySchedule, savingWeeklySchedule,
    handleDeleteAvailability,
    handleMarkUnavailable,
    notifyDemoAvailabilityRestriction,
    backendSlots,
    allBackendSlots,
    selectedSlotId,
    setSelectedSlotId,
    setExpandedBookingDetails,
    setEditedAvailability,
    setIsEditDialogOpen,
    setIsWeeklyScheduleDialogOpen,
    setSelectedShootId,
    setShootDetailsModalOpen,
    to12HourDisplay,
  } = props;

  const isMobile = variant === "mobile";
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // When viewing the month and the selected day changes (e.g. clicking a cell
  // in the calendar body), scroll that day's section into view in the right
  // panel so the user can immediately see its schedule.
  useEffect(() => {
    if (viewMode !== "month") return;
    if (!date) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const dateKey = format(date, "yyyy-MM-dd");
    // Small timeout lets the grouped slot list render before we search.
    const handle = window.setTimeout(() => {
      const target = container.querySelector<HTMLElement>(
        `[data-date-key="${dateKey}"]`
      );
      if (!target) return;
      const containerTop = container.getBoundingClientRect().top;
      const targetTop = target.getBoundingClientRect().top;
      const offset = targetTop - containerTop + container.scrollTop - 4;
      container.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [date, viewMode, selectedPhotographer]);

  // Mobile variant with simplified editing
  if (isMobile) {
    return (
      <Card className="availability-schedule-manager p-3 sm:p-4 flex flex-col border shadow-sm rounded-md">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {selectedPhotographer !== "all" ? (
            <>
              {!editingWeeklySchedule ? (
                <>
                  <div className="flex flex-wrap gap-3 justify-between items-start mb-4 flex-shrink-0">
                    <div>
                      <h2 className="text-sm sm:text-base font-semibold mb-1">
                        {viewMode === "day" && date ? format(date, 'EEEE, MMMM d, yyyy') : viewMode === "week" && date ? `Week of ${format(startOfWeek(date), 'MMM d')} - ${format(endOfWeek(date), 'MMM d, yyyy')}` : viewMode === "month" && date ? format(date, 'MMMM yyyy') : "Schedule"}
                      </h2>
                      <p className="text-xs text-muted-foreground">{getPhotographerName(selectedPhotographer)}'s Schedule</p>
                    </div>
                    {canEditAvailability && (
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={openDefaultSchedule} className="h-8 rounded-md">
                          <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                          Default schedule
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setIsWeeklyScheduleDialogOpen(true)} className="h-8 rounded-md">
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
                  <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto">
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
                              data-date-key={slot.date || undefined}
                              ref={selectedSlotId === slot.id ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) : undefined}
                              onClick={() => {
                                setSelectedSlotId(slot.id);
                                if (slot.status === 'booked' && slot.shootDetails) {
                                  setExpandedBookingDetails(prev => new Set(prev).add(slot.id));
                                }
                              }}
                              className={cn("availability-managed-card p-3 rounded-lg border-2 transition-all", selectedSlotId === slot.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}
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
                                  {slot.date && <div className="text-xs text-muted-foreground mt-1">{formatAvailabilityDate(slot.date, 'MMM d, yyyy')}</div>}
                                  {(slot.shootDetails?.address || slot.shootDetails?.title || slot.shootTitle) && (
                                    <div className="text-sm font-semibold mt-1">{slot.shootDetails?.address || slot.shootDetails?.title || slot.shootTitle}</div>
                                  )}
                                  {slot.status === 'booked' && slot.shootDetails && (
                                    <div className="mt-2 space-y-1 text-xs">
                                      {slot.shootDetails.address && (slot.shoot_id ?? slot.shootDetails.id) && <p className="text-muted-foreground">Shoot #{slot.shoot_id ?? slot.shootDetails.id}</p>}
                                      {slot.shootDetails.client && <p className="text-muted-foreground">{slot.shootDetails.client.name}</p>}
                                      <div className="flex flex-wrap gap-1">
                                        {slot.shootDetails.services?.map(service => <Badge key={service.id} variant="outline" className="text-[10px]">{service.name}</Badge>)}
                                      </div>
                                      {(slot.shoot_id ?? slot.shootDetails.id) && <Button variant="link" size="sm" className="h-7 px-0" onClick={event => {
                                        event.stopPropagation();
                                        setSelectedShootId(slot.shoot_id ?? slot.shootDetails!.id);
                                        setShootDetailsModalOpen(true);
                                      }}>Open Shoot →</Button>}
                                    </div>
                                  )}
                                </div>
                                {canEditAvailability && slot.status !== 'booked' && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      aria-label="Edit schedule"
                                      title="Edit"
                                      className="h-8 w-8 rounded-md"
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
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    {slot.status !== 'unavailable' && (
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Mark unavailable"
                                        title="Mark unavailable"
                                        className="h-8 w-8 rounded-md border-amber-400/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white hover:border-amber-500"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMarkUnavailable(slot.id, slot.date);
                                        }}
                                      >
                                        <Ban className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      aria-label="Delete schedule"
                                      title="Delete"
                                      className="h-8 w-8 rounded-md border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAvailability(slot.id, slot.date);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
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
                <WeeklyScheduleEditor
                  editingWeeklySchedule={editingWeeklySchedule}
                  setEditingWeeklySchedule={setEditingWeeklySchedule}
                  getCurrentWeeklySchedule={getCurrentWeeklySchedule}
                  updateCurrentWeeklySchedule={updateCurrentWeeklySchedule}
                  weeklyScheduleNote={weeklyScheduleNote}
                  setWeeklyScheduleNote={setWeeklyScheduleNote}
                  handleEditAvailability={handleEditAvailability}
                  saveWeeklySchedule={saveWeeklySchedule}
                  savingWeeklySchedule={savingWeeklySchedule}
                  selectedPhotographer={selectedPhotographer}
                  getPhotographerName={getPhotographerName}
                  canEditAvailability={canEditAvailability}
                  backendSlots={backendSlots}
                />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">

              <p className="text-sm font-medium text-muted-foreground mb-1">Select a photographer</p>
              <EmptyState icon="availability" title={<>Choose a photographer to view their schedule</>} size="compact" />
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Desktop variant
  return (
    <Card className="p-4 h-full min-h-0 flex-1 flex flex-col border shadow-sm rounded-md overflow-hidden">
      {selectedPhotographer !== "all" ? (
        <>
          {!editingWeeklySchedule ? (
            <>
              <div className="flex justify-between items-start mb-2 flex-shrink-0">
                <div>
                  <h2 className="text-base font-semibold mb-0.5">
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openDefaultSchedule}
                      className="h-8 rounded-md"
                      title="Set a daily recurring window (e.g. 9am–5pm)"
                    >
                      <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                      Default schedule
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsWeeklyScheduleDialogOpen(true)}
                      className="h-8 rounded-md"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add Schedule
                    </Button>
                  </div>
                )}
              </div>

              <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
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
                        <div key={dateKey} data-date-key={dateKey === 'weekly' ? undefined : dateKey}>
                          {viewMode !== "day" && (
                            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                              {dateKey === 'weekly' ? 'Recurring' : formatAvailabilityDate(dateKey, 'EEEE, MMMM d')}
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
                                    {(slot.shootDetails?.address || slot.shootDetails?.title || slot.shootTitle) && (
                                      <div className="text-sm mt-1 font-semibold">{slot.shootDetails?.address || slot.shootDetails?.title || slot.shootTitle}</div>
                                    )}

                                    {slot.status === 'booked' && slot.shootDetails && (
                                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                                        {(
                                          <div className="space-y-2 mt-2">
                                            {slot.shootDetails.address && (slot.shoot_id ?? slot.shootDetails.id) && (
                                              <div className="text-xs text-muted-foreground">Shoot #{slot.shoot_id ?? slot.shootDetails.id}</div>
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
                                            {(slot.shoot_id ?? slot.shootDetails.id) && (
                                              <button
                                                type="button"
                                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedShootId(slot.shoot_id ?? slot.shootDetails!.id);
                                                  setShootDetailsModalOpen(true);
                                                }}
                                              >
                                                Open Shoot →
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {canEditAvailability && slot.status !== 'booked' && (
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        aria-label="Edit schedule"
                                        title="Edit"
                                        className="h-8 px-2.5 gap-1.5"
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
                                        <Pencil className="h-3.5 w-3.5" />
                                        <span className="text-xs font-medium">Edit</span>
                                      </Button>
                                      {slot.status !== 'unavailable' && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          aria-label="Mark unavailable"
                                          title="Mark unavailable"
                                          className="h-8 px-2.5 gap-1.5 border-amber-400/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white hover:border-amber-500"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMarkUnavailable(slot.id, slot.date);
                                          }}
                                        >
                                          <Ban className="h-3.5 w-3.5" />
                                          <span className="text-xs font-medium">Unavailable</span>
                                        </Button>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Delete schedule"
                                        title="Delete"
                                        className="h-8 w-8 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteAvailability(slot.id, slot.date);
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
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
              saveWeeklySchedule={saveWeeklySchedule} savingWeeklySchedule={savingWeeklySchedule}
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

            <h2 className="text-lg font-semibold mb-2">Weekly Schedule</h2>
            <EmptyState icon="availability" title={<>Select a specific photographer to view their weekly schedule</>} size="compact" />
          </div>
        </div>
      )}
    </Card>
  );
}
