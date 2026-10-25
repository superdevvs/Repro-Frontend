import { WeekView } from "./AvailabilityWeekView";
import { selectCalendarPhotographer } from "./calendarSelection";
import { AvailabilityPhotographerOverflow } from "./AvailabilityPhotographerOverflow";
import { splitAvailableAroundUnavailable, toMinutesOfDay } from './availabilitySlotSegments';
import React from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/utils/defaultAvatars";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Ban, CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dayViewHourCount,
  dayViewStartHour,
  dayViewTotalMinutes,
  getInitials,
  normalizeAvailabilityDate,
  toHhMm,
} from "@/lib/availability/utils";
import type {
  Availability,
  AvailabilityStatus,
  AvailabilityToastFn,
  BackendSlot,
  Photographer,
} from "@/types/availability";

type ViewMode = "day" | "week" | "month";

export interface AvailabilityCalendarBodyProps {
  viewMode: ViewMode;
  isMobile: boolean;
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  currentMonth: Date;
  setCurrentMonth: (value: Date) => void;
  selectedPhotographer: string;
  setSelectedPhotographer: (id: string) => void;
  photographers: Photographer[];
  backendSlots: BackendSlot[];
  allBackendSlots: BackendSlot[];
  selectedSlotId: string | null;
  setSelectedSlotId: (id: string | null) => void;
  expandedBookingDetails: Set<string>;
  setExpandedBookingDetails: React.Dispatch<React.SetStateAction<Set<string>>>;
  setMobileTab?: (tab: "calendar" | "details") => void;
  getSelectedDateAvailabilities: () => Availability[];
  to12HourDisplay: (t?: string) => string;
  // scroll refs
  dayViewScrollRef: React.RefObject<HTMLDivElement>;
  dayViewTimeScrollRef: React.RefObject<HTMLDivElement>;
  dayViewScrollChanging: React.MutableRefObject<boolean>;
  dayViewScrollTimeout: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  dayViewLastChangeTime: React.MutableRefObject<number>;
  dayViewIsProgrammaticScroll: React.MutableRefObject<boolean>;
  // action openers
  setRightClickedDate: (d: Date | null) => void;
  setRightClickedTime: (t: string | null) => void;
  setIsWeeklyScheduleDialogOpen: (v: boolean) => void;
  setIsBlockDialogOpen: (v: boolean) => void;
  setBlockSchedule: (value: { date: Date | null; startTime: string; endTime: string }) => void;
  toast: AvailabilityToastFn;
}

export function AvailabilityCalendarBody(props: AvailabilityCalendarBodyProps) {
  const { viewMode } = props;
  if (viewMode === "month") return <MonthView {...props} />;
  if (viewMode === "week") return <WeekView {...props} />;
  return <DayView {...props} />;
}

// ============================================================================
// Month View
// ============================================================================

function MonthView(props: AvailabilityCalendarBodyProps) {
  const {
    isMobile,
    date,
    setDate,
    currentMonth,
    setCurrentMonth,
    selectedPhotographer,
    photographers,
    backendSlots,
    allBackendSlots,
    setSelectedSlotId,
    setMobileTab,
    setRightClickedDate,
    setRightClickedTime,
    setIsWeeklyScheduleDialogOpen,
    setIsBlockDialogOpen,
    setBlockSchedule,
    toast,
  } = props;

  const displayDate = date || new Date();
  const monthStart = startOfMonth(displayDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={cn("flex-1 flex flex-col min-h-0 overflow-hidden", isMobile ? "pb-2" : "")}>
      <div className="grid grid-cols-7 border-b flex-shrink-0 bg-muted/30">
        {weekDays.map((dayName) => (
          <div
            key={dayName}
            className={cn(
              "text-center text-xs font-medium text-muted-foreground border-r last:border-r-0",
              isMobile ? "p-1.5 sm:p-2" : "p-2"
            )}
          >
            {dayName}
          </div>
        ))}
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className={cn(
            "grid grid-cols-7 border-b last:border-b-0",
            isMobile ? "min-h-[3rem]" : "flex-1 min-h-0"
          )}>
            {week.map((day, dayIdx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
              const rows = selectedPhotographer === 'all'
                ? allBackendSlots
                : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));

              const specific = rows.filter(s => normalizeAvailabilityDate(s.date) === dayStr);
              const weekly = rows.filter(s => !normalizeAvailabilityDate(s.date) && s.day_of_week?.toLowerCase() === dow);
              const allSlots = [...specific, ...weekly];

              const isSelected = date && isSameDay(day, date);
              const isTodayDate = isToday(day);
              const isCurrentMonth = isSameMonth(day, monthStart);

              const hasSlots = allSlots.length > 0;

              // Build per-cell Availability list and split available bars around
              // overlapping unavailable ranges (mirrors the day/week views).
              const cellAvailabilities: Availability[] = allSlots.map((s, slotIdx) => ({
                id: String(s.id ?? `${dayStr}-${slotIdx}`),
                photographerId: String(s.photographer_id),
                date: dayStr,
                startTime: toHhMm(s.start_time),
                endTime: toHhMm(s.end_time),
                status: (s.status === 'unavailable' ? 'unavailable' : s.status === 'booked' ? 'booked' : 'available') as AvailabilityStatus,
                origin: specific.some((sp) => sp.id === s.id) ? 'specific' : 'weekly',
                shoot_id: s.shoot_id,
                shootDetails: s.shoot_details,
              }));
              const splitCellSlots = splitAvailableAroundUnavailable(cellAvailabilities);

              // Sort by start time so chips render chronologically.
              const cellSlotsSorted = [...splitCellSlots].sort((a, b) =>
                toMinutesOfDay(a.startTime) - toMinutesOfDay(b.startTime),
              );

              // Limit how many event chips render directly; overflow → "+N more".
              const MONTH_VIEW_VISIBLE_CHIPS = isMobile ? 1 : 3;
              const visibleSlots = cellSlotsSorted.slice(0, MONTH_VIEW_VISIBLE_CHIPS);
              const hiddenCount = Math.max(0, cellSlotsSorted.length - visibleSlots.length);

              const formatChipTime = (hhmm: string) => {
                const [hStr, mStr] = hhmm.split(':');
                const h = Number(hStr) || 0;
                const m = Number(mStr) || 0;
                const period = h >= 12 ? 'pm' : 'am';
                const display = h % 12 === 0 ? 12 : h % 12;
                return m === 0 ? `${display}${period}` : `${display}:${mStr}${period}`;
              };

              const chipLabel = (slot: Availability) => {
                if (slot.status === 'booked') {
                  return slot.shootDetails?.address || 'Booked shoot';
                }
                if (slot.status === 'unavailable') {
                  return 'Unavailable';
                }
                return 'Available';
              };

              // In "all photographers" mode show avatars of people working
              // that day (like the week view) instead of per-slot info chips.
              const allMode = selectedPhotographer === 'all';
              const photographerEntries = (() => {
                if (!allMode || !hasSlots) return [] as Array<{
                  photographerId: string;
                  photographer?: Photographer;
                  status: AvailabilityStatus;
                  slots: Availability[];
                }>;
                const map = new Map<string, { photographerId: string; photographer?: Photographer; status: AvailabilityStatus; slots: Availability[] }>();
                cellSlotsSorted.forEach((slot) => {
                  const pid = String(slot.photographerId ?? '');
                  if (!pid) return;
                  const existing = map.get(pid);
                  if (existing) {
                    existing.slots.push(slot);
                    // Promote status: booked > unavailable > available
                    const rank = (s: AvailabilityStatus) =>
                      s === 'booked' ? 3 : s === 'unavailable' ? 2 : 1;
                    if (rank(slot.status) > rank(existing.status)) existing.status = slot.status;
                  } else {
                    map.set(pid, {
                      photographerId: pid,
                      photographer: photographers.find(p => String(p.id) === pid),
                      status: slot.status,
                      slots: [slot],
                    });
                  }
                });
                return Array.from(map.values());
              })();

              const MAX_AVATARS = isMobile ? 2 : 4;
              const visibleAvatars = photographerEntries.slice(0, MAX_AVATARS);
              const hiddenAvatarCount = Math.max(0, photographerEntries.length - visibleAvatars.length);

              const buttonEl = (
                <div role="group" aria-label={format(day, 'EEEE, MMMM d')}
                  onClick={() => {
                    setDate(day);
                    setSelectedSlotId(null);
                    const dayMonth = startOfMonth(day);
                    if (format(dayMonth, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM')) {
                      setCurrentMonth(dayMonth);
                    }
                    if (selectedPhotographer !== "all" && isMobile && setMobileTab) setMobileTab("details");
                  }}
                  className={cn(
                    "relative border-r last:border-r-0 flex flex-col items-stretch justify-start h-full transition-colors hover:bg-muted/50 w-full text-left",
                    isMobile ? "p-1 gap-0.5" : "p-1.5 gap-1",
                    !isCurrentMonth && "opacity-40",
                    isSelected && "bg-primary/10",
                    isTodayDate && !isSelected && "border-2 border-primary bg-primary/5"
                  )}
                >
                  <button type="button" aria-label={format(day, 'EEEE, MMMM d')} className={cn(
                    "self-start text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isMobile ? "text-[10px] sm:text-xs" : "text-xs",
                    isSelected && "text-primary",
                    isTodayDate && !isSelected && "text-primary font-semibold",
                    !isCurrentMonth && "text-muted-foreground"
                  )}>
                    {format(day, 'd')}
                  </button>

                  {allMode && hasSlots && (
                    <div className="flex items-center flex-wrap gap-0.5 w-full overflow-hidden">
                      {visibleAvatars.map(({ photographerId, photographer, status }) => {
                        const initials = photographer ? getInitials(photographer.name) : "??";
                        const selectPhotographer = () => {
                          selectCalendarPhotographer(props, photographerId, day);
                          const dayMonth = startOfMonth(day);
                          if (format(dayMonth, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM')) {
                            setCurrentMonth(dayMonth);
                          }
                        };
                        return (
                          <div
                            key={photographerId}
                            role="button"
                            tabIndex={0}
                            aria-label={`View ${photographer?.name || 'photographer'} schedule on ${format(day, 'MMMM d')}`}
                            title={photographer?.name}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectPhotographer();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                selectPhotographer();
                              }
                            }}
                            className={cn(
                              "relative rounded-full border-2 bg-background flex-shrink-0 cursor-pointer transition-transform hover:scale-110 hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                              isMobile ? "h-5 w-5" : "h-6 w-6",
                              status === 'available' && "border-green-500",
                              status === 'booked' && "border-blue-500",
                              status === 'unavailable' && "border-red-500",
                            )}
                          >
                            <Avatar className="h-full w-full">
                              <AvatarImage
                                src={getAvatarUrl(photographer?.avatar, 'photographer', undefined, photographer?.id)}
                                alt={photographer?.name}
                                className="object-cover"
                              />
                              <AvatarFallback className={cn(isMobile ? "text-[8px]" : "text-[9px]", "bg-muted")}>
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        );
                      })}
                      {hiddenAvatarCount > 0 && (
                        <AvailabilityPhotographerOverflow day={day} hiddenCount={hiddenAvatarCount} isMobile={isMobile} entries={photographerEntries}
                          onSelect={id => { selectCalendarPhotographer(props, id, day); setCurrentMonth(startOfMonth(day)); }} />
                      )}
                    </div>
                  )}

                  {!allMode && hasSlots && (
                    <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                      {visibleSlots.map((slot) => (
                        <div
                          key={slot.id}
                          className={cn(
                            "flex items-center gap-1 truncate rounded-sm border-l-2 px-1 py-0.5 text-[10px] leading-tight",
                            slot.status === 'available' && 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                            slot.status === 'booked' && 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400',
                            slot.status === 'unavailable' && 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400',
                          )}
                          title={`${chipLabel(slot)} · ${formatChipTime(slot.startTime)} – ${formatChipTime(slot.endTime)}`}
                        >
                          <span className="font-semibold">{formatChipTime(slot.startTime)}</span>
                          <span className="truncate">{chipLabel(slot)}</span>
                        </div>
                      ))}
                      {hiddenCount > 0 && (
                        <div className="px-1 text-[9px] text-muted-foreground">+{hiddenCount} more</div>
                      )}
                    </div>
                  )}
                </div>
              );

              return (
                <ContextMenu key={`${weekIdx}-${dayIdx}`}>
                  <ContextMenuTrigger className="block h-full w-full">
                    {!isMobile && selectedPhotographer === 'all' && hasSlots ? (
                      <HoverCard openDelay={120} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          {buttonEl}
                        </HoverCardTrigger>
                        <HoverCardContent className="w-auto min-w-[220px] max-w-xs p-3">
                          <div className="text-xs font-semibold mb-2">{format(day, 'MMM d, yyyy')}</div>
                          <div className="space-y-0.5">
                            {(() => {
                              const photographerMap = new Map<string, Array<typeof allSlots[0]>>();
                              allSlots.forEach(slot => {
                                const photographerId = String(slot.photographer_id);
                                if (!photographerMap.has(photographerId)) {
                                  photographerMap.set(photographerId, []);
                                }
                                photographerMap.get(photographerId)?.push(slot);
                              });

                              return Array.from(photographerMap.entries()).map(([photographerId, slots]) => {
                                const photographer = photographers.find(p => String(p.id) === photographerId);
                                const firstSlot = slots[0];
                                const status = firstSlot.status ?? 'available';
                                const timeRange = `${toHhMm(firstSlot.start_time)} - ${toHhMm(firstSlot.end_time)}`;

                                return (
                                  <button
                                    key={photographerId}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectCalendarPhotographer(props, photographerId, day);
                                      const dayMonth = startOfMonth(day);
                                      if (format(dayMonth, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM')) {
                                        setCurrentMonth(dayMonth);
                                      }
                                    }}
                                    className="flex items-center gap-1.5 w-full text-left rounded-sm px-1.5 py-1 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                  >
                                    <div
                                      className={cn(
                                        "w-2 h-2 rounded-full flex-shrink-0",
                                        status === 'available' && "bg-green-500",
                                        status === 'booked' && "bg-blue-500",
                                        status === 'unavailable' && "bg-red-500"
                                      )}
                                    />
                                    <span className="text-xs font-medium truncate">{photographer?.name || 'Unknown'}</span>
                                    <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">({timeRange})</span>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    ) : (
                      buttonEl
                    )}
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => {
                      setDate(day);
                      setRightClickedDate(day);
                      setRightClickedTime(null);
                      if (selectedPhotographer === "all") {
                        toast({ title: "Select a photographer", description: "Please select a specific photographer before scheduling.", variant: "destructive" });
                        return;
                      }
                      setIsWeeklyScheduleDialogOpen(true);
                    }}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Schedule for {format(day, 'MMM d')}
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => {
                      setDate(day);
                      setRightClickedDate(day);
                      setRightClickedTime(null);
                      if (selectedPhotographer === "all") {
                        toast({ title: "Select a photographer", description: "Please select a specific photographer before scheduling.", variant: "destructive" });
                        return;
                      }
                      setIsWeeklyScheduleDialogOpen(true);
                    }}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Add Weekly Schedule
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => {
                      setDate(day);
                      setRightClickedDate(day);
                      setRightClickedTime(null);
                      if (selectedPhotographer === "all") {
                        toast({ title: "Select a photographer", description: "Please select a specific photographer before blocking.", variant: "destructive" });
                        return;
                      }
                      setBlockSchedule({ date: day, startTime: "09:00", endTime: "17:00" });
                      setIsBlockDialogOpen(true);
                    }}>
                      <Ban className="h-4 w-4 mr-2" />
                      Block Time on {format(day, 'MMM d')}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Week View
// ============================================================================

// ============================================================================
// Day View
// ============================================================================

function DayView(props: AvailabilityCalendarBodyProps) {
  const {
    isMobile,
    date,
    setDate,
    selectedPhotographer,
    photographers,
    selectedSlotId,
    getSelectedDateAvailabilities,
    to12HourDisplay,
    dayViewScrollRef,
    dayViewTimeScrollRef,
    dayViewScrollChanging,
    dayViewScrollTimeout,
    dayViewLastChangeTime,
    dayViewIsProgrammaticScroll,
    setRightClickedDate,
    setRightClickedTime,
    setIsWeeklyScheduleDialogOpen,
    setIsBlockDialogOpen,
    setBlockSchedule,
    toast,
  } = props;

  // Hour clicked via right-click; drives the dynamic "Schedule/Block at HH:00"
  // menu items so right-click works anywhere on the day view (including
  // directly on top of the absolutely-positioned slot bars/avatars).
  const [contextMenuHour, setContextMenuHour] = React.useState<number>(dayViewStartHour);

  if (!date) {
    return <div className="w-full h-full flex flex-col" />;
  }

  const hourHeight = isMobile ? 48 : 64;

  const captureHourFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    // Walk up to the scrollable day-view container so we measure relative to
    // the same element regardless of which child the user right-clicked on.
    const container = dayViewScrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const offsetY = e.clientY - rect.top + container.scrollTop;
    const totalHeight = Math.max(1, container.scrollHeight);
    const ratio = Math.min(1, Math.max(0, offsetY / totalHeight));
    const hourIdx = Math.floor(ratio * dayViewHourCount);
    const clamped = Math.max(0, Math.min(dayViewHourCount - 1, hourIdx));
    setContextMenuHour(dayViewStartHour + clamped);
  };

  const contextTimeStr = `${contextMenuHour.toString().padStart(2, '0')}:00`;
  const contextNextHourStr = `${Math.min(24, contextMenuHour + 1).toString().padStart(2, '0')}:00`;
  const contextTimeDisplay = to12HourDisplay(contextTimeStr);

  const handleContextMenuSchedule = () => {
    if (!date) {
      toast({ title: "Select a date", description: "Please select a date before scheduling.", variant: "destructive" });
      return;
    }
    setRightClickedDate(date);
    setRightClickedTime(contextTimeStr);
    if (selectedPhotographer === "all") {
      toast({ title: "Select a photographer", description: "Please select a specific photographer before scheduling.", variant: "destructive" });
      return;
    }
    setIsWeeklyScheduleDialogOpen(true);
  };

  const handleContextMenuBlock = () => {
    if (!date) {
      toast({ title: "Select a date", description: "Please select a date before blocking.", variant: "destructive" });
      return;
    }
    setRightClickedDate(date);
    setRightClickedTime(contextTimeStr);
    if (selectedPhotographer === "all") {
      toast({ title: "Select a photographer", description: "Please select a specific photographer before blocking.", variant: "destructive" });
      return;
    }
    setBlockSchedule({ date, startTime: contextTimeStr, endTime: contextNextHourStr });
    setIsBlockDialogOpen(true);
  };

  const getSlotPosition = (startTime: string, endTime: string) => {
    const cleanStart = startTime.replace(/\s*(AM|PM)/i, '').trim();
    const cleanEnd = endTime.replace(/\s*(AM|PM)/i, '').trim();
    const [startH, startM] = cleanStart.split(':').map(Number);
    const [endH, endM] = cleanEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const adjustedStartMinutes = startMinutes - (dayViewStartHour * 60);
    const adjustedEndMinutes = endMinutes - (dayViewStartHour * 60);
    const clampedStart = Math.max(0, Math.min(dayViewTotalMinutes, adjustedStartMinutes));
    const clampedEnd = Math.max(clampedStart, Math.min(dayViewTotalMinutes, adjustedEndMinutes));
    const top = `${(clampedStart / dayViewTotalMinutes) * 100}%`;
    const height = `${((clampedEnd - clampedStart) / dayViewTotalMinutes) * 100}%`;
    return { top, height };
  };

  // Same trim as the week view: replace each available slot with its
  // sub-segments around overlapping unavailable ranges so the bar doesn't run
  // straight through a blocked window.
  const daySlots = splitAvailableAroundUnavailable(getSelectedDateAvailabilities());

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (dayViewTimeScrollRef.current) {
      dayViewTimeScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }

    if (dayViewIsProgrammaticScroll.current) {
      dayViewIsProgrammaticScroll.current = false;
      return;
    }

    if (dayViewScrollChanging.current) return;

    const now = Date.now();
    if (now - dayViewLastChangeTime.current < 500) {
      return;
    }

    if (dayViewScrollTimeout.current) {
      clearTimeout(dayViewScrollTimeout.current);
      dayViewScrollTimeout.current = null;
    }

    const scrollTop = e.currentTarget.scrollTop;
    const scrollHeight = e.currentTarget.scrollHeight;
    const clientHeight = e.currentTarget.clientHeight;

    if (scrollTop <= 5 && date && !dayViewScrollChanging.current) {
      dayViewScrollTimeout.current = setTimeout(() => {
        if (dayViewScrollRef.current && dayViewScrollRef.current.scrollTop <= 5 && date && !dayViewScrollChanging.current) {
          const currentTime = Date.now();
          if (currentTime - dayViewLastChangeTime.current < 500) {
            dayViewScrollTimeout.current = null;
            return;
          }
          const prevDay = addDays(date, -1);
          if (!isSameDay(prevDay, date)) {
            dayViewScrollChanging.current = true;
            dayViewLastChangeTime.current = currentTime;
            setDate(prevDay);
            setTimeout(() => {
              if (dayViewScrollRef.current) {
                dayViewIsProgrammaticScroll.current = true;
                dayViewScrollRef.current.scrollTop = hourHeight * Math.max(0, dayViewHourCount - 1);
                dayViewScrollChanging.current = false;
              }
            }, 100);
          }
        }
        dayViewScrollTimeout.current = null;
      }, 300);
    } else if (scrollTop + clientHeight >= scrollHeight - 5 && date && !dayViewScrollChanging.current) {
      dayViewScrollTimeout.current = setTimeout(() => {
        if (dayViewScrollRef.current && date && !dayViewScrollChanging.current) {
          const currentScrollTop = dayViewScrollRef.current.scrollTop;
          const currentScrollHeight = dayViewScrollRef.current.scrollHeight;
          const currentClientHeight = dayViewScrollRef.current.clientHeight;
          if (currentScrollTop + currentClientHeight >= currentScrollHeight - 5) {
            const currentTime = Date.now();
            if (currentTime - dayViewLastChangeTime.current < 500) {
              dayViewScrollTimeout.current = null;
              return;
            }
            const nextDay = addDays(date, 1);
            if (!isSameDay(nextDay, date)) {
              dayViewScrollChanging.current = true;
              dayViewLastChangeTime.current = currentTime;
              setDate(nextDay);
              setTimeout(() => {
                if (dayViewScrollRef.current) {
                  dayViewIsProgrammaticScroll.current = true;
                  dayViewScrollRef.current.scrollTop = 0;
                  dayViewScrollChanging.current = false;
                }
              }, 100);
            }
          }
        }
        dayViewScrollTimeout.current = null;
      }, 300);
    } else if (scrollTop > 5 && scrollTop + clientHeight < scrollHeight - 5) {
      if (dayViewScrollTimeout.current) {
        clearTimeout(dayViewScrollTimeout.current);
        dayViewScrollTimeout.current = null;
      }
    }
  };

  const hoursWithAvailability = new Set<number>();
  daySlots.forEach(slot => {
    const [startH] = slot.startTime.split(':').map(Number);
    const [endH] = slot.endTime.split(':').map(Number);
    for (let h = startH; h < endH; h++) hoursWithAvailability.add(h);
    hoursWithAvailability.add(endH);
  });

  return (
    <div className={cn(
      "w-full flex flex-col",
      !isMobile && "h-full flex-1 min-h-0 overflow-hidden"
    )}>
      <div className={cn(
        "grid grid-cols-5 gap-px border rounded-md overflow-hidden",
        isMobile ? "" : "flex-1 min-h-0"
      )}>
        <div className="bg-muted/50 border-r flex flex-col min-h-0">
          <div className={cn(
            "border-b flex items-center justify-start text-xs font-medium text-muted-foreground flex-shrink-0",
            isMobile ? "h-10 sm:h-12 pl-1.5 sm:pl-2 text-[10px] sm:text-xs" : "h-12 pl-2"
          )}>
            <div className="text-left">
              <div className={cn("font-semibold", isMobile ? "text-xs sm:text-sm" : "")}>
                {isMobile ? format(date, 'EEE') : format(date, 'EEEE')}
              </div>
              <div className={cn(isMobile ? "text-[9px] sm:text-[10px]" : "text-[10px]")}>
                {format(date, isMobile ? 'MMM d' : 'MMMM d, yyyy')}
              </div>
            </div>
          </div>
          <div
            ref={dayViewTimeScrollRef}
            className={cn(
              "flex flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
              !isMobile && "flex-1 min-h-0 overflow-hidden"
            )}
            onScroll={(e) => {
              if (!dayViewScrollRef.current) return;
              const nextScrollTop = e.currentTarget.scrollTop;
              if (dayViewScrollRef.current.scrollTop === nextScrollTop) return;
              dayViewScrollRef.current.scrollTop = nextScrollTop;
            }}
          >
            {Array.from({ length: dayViewHourCount }, (_, i) => i + dayViewStartHour).map((hour) => {
              const hourLabel = to12HourDisplay(`${hour.toString().padStart(2, '0')}:00`);
              return (
                <div
                  key={hour}
                  className={cn(
                    "border-b flex items-start justify-start",
                    isMobile ? "min-h-[3rem] pl-1.5 sm:pl-2 pt-1 text-[10px] sm:text-xs" : "flex-1 min-h-0 pl-2 pt-1 text-xs",
                    hoursWithAvailability.has(hour) ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {hourLabel}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-background flex flex-col relative col-span-4 min-h-0">
          <div className={cn(
            "border-b flex items-center justify-center font-medium flex-shrink-0",
            isMobile ? "h-10 sm:h-12 text-[10px] sm:text-xs" : "h-12 text-xs"
          )}>
            Availability
            {date && isToday(date) && (
              <span className={cn(
                "ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-primary/10 text-primary rounded-md font-semibold",
                isMobile ? "text-[9px] sm:text-[10px]" : "text-[10px]"
              )}>
                Today
              </span>
            )}
          </div>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                ref={dayViewScrollRef}
                className={cn(
                  "relative flex flex-col cursor-context-menu",
                  !isMobile && "flex-1 min-h-0 overflow-hidden"
                )}
                onScroll={handleScroll}
                onContextMenu={captureHourFromEvent}
              >
                {Array.from({ length: dayViewHourCount }, (_, i) => i + dayViewStartHour).map((hour) => (
                  <div
                    key={hour}
                    className={cn(
                      "border-b border-dashed border-muted",
                      isMobile ? "min-h-[3rem]" : "flex-1 min-h-0",
                    )}
                  />
                ))}

            {(() => {
              if (daySlots.length === 0) {
                return (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    No availability scheduled
                  </div>
                );
              }

              const formatTimeDisplay = (time: string) => to12HourDisplay(time);

              return daySlots.map((slot, slotIdx) => {
                const { top, height } = getSlotPosition(slot.startTime, slot.endTime);
                const overlappingSlots = daySlots.filter((s, idx) => {
                  if (idx >= slotIdx) return false;
                  const sStartClean = s.startTime.replace(/\s*(AM|PM)/i, '').trim();
                  const sEndClean = s.endTime.replace(/\s*(AM|PM)/i, '').trim();
                  const slotStartClean = slot.startTime.replace(/\s*(AM|PM)/i, '').trim();
                  const slotEndClean = slot.endTime.replace(/\s*(AM|PM)/i, '').trim();
                  const [sStartH, sStartM] = sStartClean.split(':').map(Number);
                  const [sEndH, sEndM] = sEndClean.split(':').map(Number);
                  const [slotStartH, slotStartM] = slotStartClean.split(':').map(Number);
                  const [slotEndH, slotEndM] = slotEndClean.split(':').map(Number);
                  const sStart = sStartH * 60 + sStartM;
                  const sEnd = sEndH * 60 + sEndM;
                  const slotStart = slotStartH * 60 + slotStartM;
                  const slotEnd = slotEndH * 60 + slotEndM;
                  return sStart < slotEnd && sEnd > slotStart;
                });

                if (selectedPhotographer === 'all') {
                  const photographer = photographers.find(p => String(p.id) === String(slot.photographerId));
                  const initials = photographer ? getInitials(photographer.name) : "??";
                  const avatarSize = isMobile ? 28 : 32;
                  const gap = isMobile ? 30 : 36;
                  const horizontalOffset = overlappingSlots.length * gap;
                  const zIndex = 10 + slotIdx;

                  return (
                    <TooltipProvider key={slot.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" aria-label={`View ${photographer?.name || 'photographer'} schedule on ${format(date || new Date(), 'MMMM d')}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectCalendarPhotographer(props, slot.photographerId, date || new Date(), slot);
                            }}
                            className={cn(
                              "absolute rounded-full border-2 p-0 cursor-pointer transition-transform flex items-center justify-center bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isMobile ? "hover:scale-105" : "hover:scale-110 hover:z-50",
                              selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-2",
                              slot.status === 'available' && "border-green-500",
                              slot.status === 'booked' && "border-blue-500",
                              slot.status === 'unavailable' && "border-red-500"
                            )}
                            style={{
                              left: `${4 + horizontalOffset}px`,
                              top,
                              width: `${avatarSize}px`,
                              height: `${avatarSize}px`,
                              zIndex
                            }}
                          >
                            <Avatar className="h-full w-full">
                              <AvatarImage src={getAvatarUrl(photographer?.avatar, 'photographer', undefined, photographer?.id)} alt={photographer?.name} className="object-cover" />
                              <AvatarFallback className={cn(isMobile ? "text-[9px]" : "text-[10px]", "bg-muted")}>{initials}</AvatarFallback>
                            </Avatar>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs font-medium">{photographer?.name}</div>
                          <div className="text-[10px] text-muted-foreground">{formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}</div>
                          <div className="text-[10px] capitalize">{slot.status}</div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }

                const leftOffset = overlappingSlots.length * 4;
                return (
                  <div
                    key={slot.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectCalendarPhotographer(props, slot.photographerId, date || new Date(), slot);
                    }}
                    className={cn(
                      "absolute z-10 cursor-pointer hover:opacity-80 transition-opacity",
                      isMobile ? "rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs" : "rounded px-2 py-1 text-xs",
                      selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-1",
                      slot.status === 'available' && "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700",
                      slot.status === 'booked' && "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700",
                      slot.status === 'unavailable' && "bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"
                    )}
                    style={{
                      top,
                      height,
                      minHeight: isMobile ? '18px' : '20px',
                      left: `${4 + leftOffset}px`,
                      right: `${4 + leftOffset}px`
                    }}
                  >
                    <div className="font-medium">{formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}</div>
                    <div className={cn("opacity-80 capitalize", isMobile ? "text-[9px] sm:text-[10px]" : "text-[10px]")}>
                      {slot.status}
                    </div>
                    {slot.shootTitle && (
                      <div className={cn("opacity-80 truncate mt-0.5", isMobile ? "text-[9px] sm:text-[10px]" : "text-[10px]")}>
                        {slot.shootTitle}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={handleContextMenuSchedule}>
                <Clock className="h-4 w-4 mr-2" />
                Schedule at {contextTimeDisplay}
              </ContextMenuItem>
              <ContextMenuItem onClick={handleContextMenuBlock}>
                <Ban className="h-4 w-4 mr-2" />
                Block at {contextTimeDisplay}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </div>
    </div>
  );
}
