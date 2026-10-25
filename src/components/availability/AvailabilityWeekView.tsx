import React from "react";
import { addDays, format, isSameDay, isToday, startOfWeek } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/utils/defaultAvatars";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Ban, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, normalizeAvailabilityDate, toHhMm, weekViewEndHour, weekViewEndLabel, weekViewLabelHours } from "@/lib/availability/utils";
import { splitAvailableAroundUnavailable } from "./availabilitySlotSegments";
import type { Availability, AvailabilityStatus } from "@/types/availability";
import type { AvailabilityCalendarBodyProps } from "./AvailabilityCalendarBody";
import { AvailabilityWeekGroups } from "./AvailabilityWeekGroups";
import { selectCalendarPhotographer } from "./calendarSelection";
import { weekStartWindows } from "./availabilityWeekGrouping";
import "./availabilityWeek.css";

export function WeekView(props: AvailabilityCalendarBodyProps) {
  const {
    isMobile,
    date,
    setDate,
    selectedPhotographer,
    photographers,
    backendSlots,
    allBackendSlots,
    selectedSlotId,
    setMobileTab,
    to12HourDisplay,
    setRightClickedDate,
    setRightClickedTime,
    setIsWeeklyScheduleDialogOpen,
    setIsBlockDialogOpen,
    setBlockSchedule,
    toast,
  } = props;

  const weekStart = startOfWeek(date || new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getSlotStyle = (startTime: string, endTime: string) => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const slotStart = 8 * 60;
    const slotEnd = weekViewEndHour * 60;
    const totalMinutes = slotEnd - slotStart;
    const leftPercent = ((startMinutes - slotStart) / totalMinutes) * 100;
    const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;
    const durationMinutes = endMinutes - startMinutes;
    return {
      left: `${Math.max(0, Math.min(100, leftPercent))}%`,
      width: `${Math.max(2, Math.min(100 - Math.max(0, leftPercent), widthPercent))}%`,
      isNarrow: durationMinutes < 120,
      isWide: durationMinutes >= 180
    };
  };

  const formatTimeDisplay = (time: string) => to12HourDisplay(time);

  return (
    <div className={cn(
      "availability-week flex flex-col",
      isMobile ? "availability-week--compact" : "w-full h-full flex-1 min-h-0 overflow-hidden"
    )}>
      <div className={isMobile ? "availability-week-scroll" : "flex min-h-0 flex-1 flex-col"} role={isMobile ? "region" : undefined} aria-label={isMobile ? "Weekly availability timeline" : undefined} tabIndex={isMobile ? 0 : undefined}>
      <div className={cn(
        "flex flex-col bg-background",
        isMobile ? "availability-week-canvas" : "flex-1 min-h-0 overflow-hidden"
      )}>
        {isMobile ? <div className="availability-week-header">
          <div className="availability-week-date availability-week-corner">Day</div>
          {selectedPhotographer === 'all' ? <div className="availability-week-start-header">
            {weekStartWindows.map(({start, end}, index) => <div key={start}>{index === 0 ? 'Before ' : <>{formatTimeDisplay(`${start}:00`).replace(':00', '')}&ndash;</>}{formatTimeDisplay(`${end}:00`).replace(':00', '')}</div>)}
          </div> : <div className="relative flex-1">
            {weekViewLabelHours.map(hour => <span key={hour} className="absolute top-1/2 -translate-y-1/2 pl-2 text-[11px] text-muted-foreground"
              style={{left: `${((hour - 8) / (weekViewEndHour - 8)) * 100}%`}}>{formatTimeDisplay(`${hour}:00`).replace(':00', '')}</span>)}
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{formatTimeDisplay(`${weekViewEndHour}:00`).replace(':00', '')}</span>
          </div>}
        </div> : <div className="flex-shrink-0 border-b bg-muted/30">
          <div className="flex">
            <div className={cn(
              "flex-shrink-0 border-r text-muted-foreground",
              isMobile ? "w-14 sm:w-24 p-1.5 sm:p-2 text-[11px] sm:text-xs font-medium" : "w-24 p-2 text-xs font-medium"
            )}>
              Days
            </div>
            <div className={cn("relative flex-1 flex", isMobile ? "pr-12" : "pr-10")}>
              {weekViewLabelHours.map((hour) => {
                const period = hour >= 12 ? 'PM' : 'AM';
                const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                return (
                  <div
                    key={hour}
                    className={cn(
                      "flex-1 border-r last:border-r-0 text-center text-muted-foreground",
                      isMobile
                        ? "min-w-[72px] p-1.5 text-[10px]"
                        : "p-2 text-xs flex flex-col items-center justify-center"
                    )}
                  >
                    {isMobile ? (
                      `${hour.toString().padStart(2, '0')}:00`
                    ) : (
                      <>
                        <span>{hour12}:00</span>
                        <span className="text-[10px] leading-tight">{period}</span>
                      </>
                    )}
                  </div>
                );
              })}
              <div className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground whitespace-nowrap",
                isMobile ? "text-[10px] sm:text-xs" : "text-xs"
              )}>
                {weekViewEndLabel}
              </div>
            </div>
          </div>
        </div>}

        <div className={cn("flex flex-col", !isMobile && "flex-1 min-h-0 overflow-y-auto overscroll-y-contain")}>
          {weekDays.map((day, dayIdx) => {
            const isTodayDate = isToday(day);
            const isSelected = date && isSameDay(day, date);
            const dayStr = format(day, 'yyyy-MM-dd');
            const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const rows = selectedPhotographer === 'all' ? allBackendSlots : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));
            const specific = rows.filter(s => normalizeAvailabilityDate(s.date) === dayStr);
            const weekly = rows.filter(s => !normalizeAvailabilityDate(s.date) && s.day_of_week?.toLowerCase() === dow);
            const bookedSlots = specific.filter(s => s.status === 'booked');
            const nonBookedSpecific = specific.filter(s => s.status !== 'booked');
            const availabilitySlots = nonBookedSpecific.length > 0 ? nonBookedSpecific : weekly;
            const allRelevantSlots = [...bookedSlots, ...availabilitySlots];

            const rawDaySlots = allRelevantSlots.map((s, slotIdx): Availability => ({
              id: String(s.id ?? `${dayStr}-${slotIdx}`),
              photographerId: String(s.photographer_id),
              date: dayStr,
              startTime: toHhMm(s.start_time),
              endTime: toHhMm(s.end_time),
              status: (s.status === 'unavailable' ? 'unavailable' : s.status === 'booked' ? 'booked' : 'available') as AvailabilityStatus,
              origin: specific.some(sp => sp.id === s.id) ? 'specific' : 'weekly',
              shoot_id: s.shoot_id,
              shootDetails: s.shoot_details,
            }));

            // Trim "available" slots so they don't visually run through any
            // overlapping "unavailable" range (e.g. 9–5 available with 10–11
            // unavailable becomes 9–10 available + 10–11 unavailable + 11–5
            // available). Booked + unavailable slots pass through unchanged.
            const daySlots = splitAvailableAroundUnavailable(rawDaySlots);

            const hasBookedSlots = daySlots.some(s => s.status === 'booked');
            const hasAvailableSlots = daySlots.some(s => s.status === 'available');

            return (
              <ContextMenu key={dayIdx}>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      "flex border-b last:border-b-0 relative cursor-context-menu",
                      isMobile
                        ? "availability-week-row"
                        : selectedPhotographer === "all"
                          ? "min-h-[3.5rem] flex-1 basis-0"
                          : "min-h-[3rem] flex-1 basis-0",
                      isTodayDate && "bg-primary/5"
                    )}
                  >
                    <div className={cn(
                      "availability-week-date flex-shrink-0 border-r flex flex-col items-start justify-center",
                      isMobile ? "" : "w-24 p-2",
                      isTodayDate && "bg-primary/10",
                      isSelected && !isTodayDate && "bg-primary/5"
                    )} data-highlight={isTodayDate || isSelected ? "true" : undefined}>
                      <button
                        type="button"
                        aria-label={format(day, 'EEEE, MMMM d')}
                        aria-current={isTodayDate ? "date" : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDate(day);
                          if (selectedPhotographer !== "all" && isMobile && setMobileTab) setMobileTab("details");
                        }}
                        className={cn(
                          "inline-flex w-full justify-start items-baseline gap-1 mt-0.5",
                          !isMobile && "gap-1.5",
                          isTodayDate && "text-primary",
                          isSelected && !isTodayDate && "text-primary"
                        )}
                      >
                        <span className={cn(
                          "availability-week-date-number leading-none font-bold tabular-nums",
                          isMobile ? "text-lg sm:text-xl" : "text-xl"
                        )}>
                          {format(day, 'd')}
                        </span>
                        <span className={cn(
                          "availability-week-date-name uppercase tracking-wide font-medium",
                          isMobile ? "text-[10px] sm:text-xs" : "text-[10px]"
                        )}>
                          {format(day, 'EEE')}
                        </span>
                      </button>
                    </div>

                    {isMobile && selectedPhotographer === 'all' ? <AvailabilityWeekGroups day={day} slots={daySlots} photographers={photographers} formatTime={formatTimeDisplay}
                      onSelect={slot => selectCalendarPhotographer(props, slot.photographerId, day, slot)} /> : <div className="flex-1 relative overflow-hidden">
                      {weekViewLabelHours.map((hour) => (
                        <div
                          key={hour}
                          className="absolute top-0 bottom-0 border-l border-dashed border-muted/30"
                          style={{ left: `${((hour - 8) / (weekViewEndHour - 8)) * 100}%` }}
                        />
                      ))}
                      <div className="absolute top-0 bottom-0 right-0 border-l border-dashed border-muted/30" />

                      {daySlots.map((slot, slotIdx) => {
                        const style = getSlotStyle(slot.startTime, slot.endTime);
                        const overlappingBefore = daySlots.slice(0, slotIdx).filter(s => {
                          const [sStartH, sStartM] = s.startTime.split(':').map(Number);
                          const [sEndH, sEndM] = s.endTime.split(':').map(Number);
                          const [slotStartH, slotStartM] = slot.startTime.split(':').map(Number);
                          const [slotEndH, slotEndM] = slot.endTime.split(':').map(Number);
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
                          const horizontalOffset = overlappingBefore.length * gap;
                          const zIndex = 10 + slotIdx;

                          return (
                            <TooltipProvider key={slot.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" aria-label={`View ${photographer?.name || 'photographer'} schedule on ${format(day, 'MMMM d')}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectCalendarPhotographer(props, slot.photographerId, day, slot);
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
                                      left: `calc(${style.left} + ${horizontalOffset}px)`,
                                      top: isMobile ? '50%' : '8px',
                                      transform: isMobile ? 'translateY(-50%)' : undefined,
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

                        // Desktop-only: booked slots as positioned tiles
                        if (!isMobile && slot.status === 'booked') {
                          return (
                            <TooltipProvider key={slot.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectCalendarPhotographer(props, slot.photographerId, day, slot);
                                    }}
                                    className={cn(
                                      "absolute rounded-md px-1 py-0.5 text-[10px] flex flex-col justify-center border z-20 cursor-pointer hover:opacity-80 transition-opacity shadow-sm",
                                      selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-1",
                                      "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300"
                                    )}
                                    style={{
                                      ...style,
                                      top: '4px',
                                      bottom: hasAvailableSlots ? '14px' : '4px',
                                      minWidth: '40px'
                                    }}
                                  >
                                    <div className="font-medium truncate">Booked</div>
                                    <div className="text-[9px] opacity-80 truncate">
                                      {formatTimeDisplay(slot.startTime)}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs font-medium">
                                    {slot.shootDetails?.title || 'Booked'}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}
                                  </div>
                                  {slot.shootDetails?.client && (
                                    <div className="text-[10px] text-muted-foreground">
                                      Client: {slot.shootDetails.client.name}
                                    </div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }

                        // Desktop-only: available + booked coexists → line
                        if (!isMobile && slot.status === 'available' && hasBookedSlots) {
                          return (
                            <TooltipProvider key={slot.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      selectCalendarPhotographer(props, slot.photographerId, day, slot);
                                    }}
                                    className={cn(
                                      "absolute h-px rounded-full cursor-pointer hover:opacity-80 transition-opacity",
                                      selectedSlotId === slot.id && "ring-1 ring-primary ring-offset-1",
                                      "bg-green-500 dark:bg-green-500"
                                    )}
                                    style={{
                                      left: style.left,
                                      width: style.width,
                                      bottom: '3px',
                                      zIndex: 25
                                    }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs font-medium">Available</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }

                        // Default block rendering
                        const topOffset = overlappingBefore.length * 18;
                        const heightReduction = overlappingBefore.length > 0 ? 2 : 0;
                        return (
                          <TooltipProvider key={slot.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectCalendarPhotographer(props, slot.photographerId, day, slot);
                                  }}
                                  className={cn(
                                    "absolute rounded-md flex flex-col justify-center border z-10 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden",
                                    isMobile ? "px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs" : "px-2 py-1 text-xs",
                                    selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-1",
                                    slot.status === 'available' && "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300",
                                    slot.status === 'booked' && "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300",
                                    slot.status === 'unavailable' && "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
                                  )}
                                  style={{
                                    left: style.left,
                                    width: style.width,
                                    top: `${4 + topOffset}px`,
                                    bottom: `${4 + topOffset + heightReduction}px`
                                  }}
                                >
                                  {style.isNarrow ? (
                                    <div className="flex items-center gap-1">
                                      <span className={cn(
                                        "w-2 h-2 rounded-full flex-shrink-0",
                                        slot.status === 'available' && "bg-green-500",
                                        slot.status === 'booked' && "bg-blue-500",
                                        slot.status === 'unavailable' && "bg-red-500"
                                      )} />
                                      <span className="text-[9px] whitespace-nowrap truncate">{formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}</span>
                                    </div>
                                  ) : (
                                    <>
                                      {style.isWide && <div className="font-medium capitalize truncate">{slot.status}</div>}
                                      <div className={cn("opacity-80 whitespace-nowrap", isMobile ? "text-[9px] sm:text-[10px]" : "text-[10px]")}>
                                        {formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs font-medium capitalize">{slot.status}</div>
                                <div className="text-[10px] text-muted-foreground">{formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>}
                  </div>
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
      </div>
      </div>
      {isMobile && <div className="availability-week-legend">
        <span><i className="bg-green-500" />Available</span><span><i className="bg-blue-500" />Booked</span><span><i className="bg-red-500" />Unavailable</span>
        {selectedPhotographer === 'all' && <p className="availability-week-hint">Grouped by start time &middot; Tap a group for details</p>}
      </div>}
    </div>
  );
}
