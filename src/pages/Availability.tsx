import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Ban, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { cn } from "@/lib/utils";
import API_ROUTES from "@/lib/api";

import type {
  Availability,
  WeeklyScheduleItem,
} from "@/types/availability";
import { toHhMm, uiTimeToHhmm } from "@/lib/availability/utils";
import {
  buildMonthAvailabilities,
  buildPhotographerAvailabilityLabel,
  buildSelectedDateAvailabilities,
  buildWeekAvailabilities,
  checkTimeOverlap as checkTimeOverlapFn,
} from "@/lib/availability/selectors";

import { useAvailabilityData } from "@/hooks/useAvailabilityData";
import { useGoogleCalendarSync } from "@/hooks/useGoogleCalendarSync";
import { useAvailabilityNavStrips } from "@/hooks/useAvailabilityNavStrips";
import { useDesktopCalendarRowHeight } from "@/hooks/useDesktopCalendarRowHeight";

import { CalendarSyncModal } from "@/components/availability/CalendarSyncModal";
import { ShootDetailsModal } from "@/components/shoots/ShootDetailsModal";
import { PhotographerListPanel } from "@/components/availability/PhotographerListPanel";
import { ScheduleDetailsPanel } from "@/components/availability/ScheduleDetailsPanel";
import { AvailabilityCalendarBody } from "@/components/availability/AvailabilityCalendarBody";
import { EditAvailabilityDialog } from "@/components/availability/dialogs/EditAvailabilityDialog";
import {
  WeeklyScheduleDialog,
  type NewWeeklyScheduleState,
} from "@/components/availability/dialogs/WeeklyScheduleDialog";
import {
  BlockTimeDialog,
  type BlockScheduleState,
} from "@/components/availability/dialogs/BlockTimeDialog";

const DEFAULT_WEEKLY_SCHEDULE: WeeklyScheduleItem[] = [
  { day: 'Mon', active: false, startTime: '9:00', endTime: '17:00' },
  { day: 'Tue', active: false, startTime: '9:00', endTime: '17:00' },
  { day: 'Wed', active: false, startTime: '9:00', endTime: '17:00' },
  { day: 'Thu', active: false, startTime: '9:00', endTime: '17:00' },
  { day: 'Fri', active: false, startTime: '9:00', endTime: '17:00' },
  { day: 'Sat', active: false, startTime: '10:00', endTime: '15:00' },
  { day: 'Sun', active: false, startTime: '10:00', endTime: '15:00' },
];

export default function Availability() {
  const isMobile = useIsMobile();
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1279px)');
  const isCompactLayout = isMobile || isTablet;
  const isDesktop = !isCompactLayout;
  const { toast } = useToast();
  const { user, role, isImpersonating, originalUser } = useAuth();
  const { formatTime: formatTimePreference } = useUserPreferences();

  const isAdmin = role === 'admin' || role === 'superadmin';
  const isSalesRep = role === 'salesRep';
  const canManagePhotographerSelection = isAdmin || isSalesRep;
  const isPhotographer = role === 'photographer';
  const canLaunchGoogleCalendarOAuth = ['photographer', 'admin', 'superadmin', 'editing_manager'].includes(role || '');
  const photographerScopedBlockId = isPhotographer && user?.id ? String(user.id) : "";

  const availabilitySessionScope = useMemo(
    () =>
      [
        role || 'guest',
        user?.id ? String(user.id) : 'guest',
        isImpersonating ? `impersonating:${originalUser?.id ?? 'unknown'}` : 'direct',
      ].join(':'),
    [isImpersonating, originalUser?.id, role, user?.id]
  );

  // Page state
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedPhotographer, setSelectedPhotographer] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("month");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [mobileTab, setMobileTab] = useState<"calendar" | "details">("calendar");
  const [isPhotographerSheetOpen, setIsPhotographerSheetOpen] = useState(false);
  const [editingWeeklySchedule, setEditingWeeklySchedule] = useState(false);
  const [weeklyScheduleNote, setWeeklyScheduleNote] = useState("");
  const [editedAvailability, setEditedAvailability] = useState<Partial<Availability>>({});
  const [isWeeklyScheduleDialogOpen, setIsWeeklyScheduleDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockSchedule, setBlockSchedule] = useState<BlockScheduleState>({ date: null, startTime: "09:00", endTime: "17:00" });
  const [blockPhotographer, setBlockPhotographer] = useState<string>("");
  const [blockPhotographerSearch, setBlockPhotographerSearch] = useState("");
  const [blockPhotographerOpen, setBlockPhotographerOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [expandedBookingDetails, setExpandedBookingDetails] = useState<Set<string>>(new Set());
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [shootDetailsModalOpen, setShootDetailsModalOpen] = useState(false);
  const [selectedShootId, setSelectedShootId] = useState<number | null>(null);
  const [, setRightClickedDate] = useState<Date | null>(null);
  const [, setRightClickedTime] = useState<string | null>(null);
  const [newWeeklySchedule, setNewWeeklySchedule] = useState<NewWeeklyScheduleState>({
    startTime: "09:00",
    endTime: "21:00",
    status: "available",
    days: [true, true, true, true, true, false, false],
    recurring: false,
    note: "",
  });
  const [specificDateFrom, setSpecificDateFrom] = useState<Date | undefined>(date ?? new Date());
  const [specificDateTo, setSpecificDateTo] = useState<Date | undefined>(date ?? new Date());
  const [photographerWeeklySchedules, setPhotographerWeeklySchedules] = useState<Record<string, WeeklyScheduleItem[]>>({});

  // Day view scroll refs
  const dayViewScrollRef = useRef<HTMLDivElement>(null);
  const dayViewTimeScrollRef = useRef<HTMLDivElement>(null);
  const dayViewScrollChanging = useRef<boolean>(false);
  const dayViewScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayViewLastChangeTime = useRef<number>(0);
  const dayViewIsProgrammaticScroll = useRef<boolean>(false);

  // Data hook
  const {
    photographers,
    loadingPhotographers,
    backendSlots,
    allBackendSlots,
    photographerAvailabilityMap,
    authHeaders,
    refreshPhotographerSlots,
  } = useAvailabilityData({
    selectedPhotographer,
    setSelectedPhotographer,
    date,
    viewMode,
    role,
    userId: user?.id,
    isPhotographer,
    canManagePhotographerSelection,
    availabilitySessionScope,
  });

  // Google Calendar hook
  const {
    googleCalendarStatus,
    isGoogleCalendarConnecting,
    isGoogleCalendarStatusLoading,
    fetchGoogleCalendarAuthorizationUrl,
  } = useGoogleCalendarSync({
    canLaunchGoogleCalendarOAuth,
    isPhotographer,
    selectedPhotographer,
    photographers,
    isSyncModalOpen,
    authHeaders,
    toast,
  });

  // Nav strips
  const { months, monthDates, monthNavScrollRef, dateNavScrollRef } = useAvailabilityNavStrips(date, currentMonth);

  // Desktop calendar row height
  const { ref: desktopCalendarRowRef, height: desktopCalendarRowHeight } = useDesktopCalendarRowHeight(isCompactLayout, [
    loadingPhotographers, viewMode, selectedPhotographer,
  ]);

  // Seed specific date range when weekly schedule dialog opens
  useEffect(() => {
    if (!isWeeklyScheduleDialogOpen) return;
    const seedDate = date ?? new Date();
    setSpecificDateFrom(seedDate);
    setSpecificDateTo(seedDate);
  }, [isWeeklyScheduleDialogOpen, date]);

  const specificScheduleDates = useMemo(() => {
    if (!specificDateFrom || !specificDateTo) return [];
    const from = startOfDay(specificDateFrom);
    const to = startOfDay(specificDateTo);
    return eachDayOfInterval({ start: from <= to ? from : to, end: from <= to ? to : from });
  }, [specificDateFrom, specificDateTo]);

  const to12HourDisplay = (t?: string) => (t ? formatTimePreference(t) : '');

  const getPhotographerName = (id: string) => {
    const photographer = photographers.find(p => p.id === id);
    if (!photographer) return "Unknown";
    return photographer.name.split(' ')[0];
  };

  const selectorDeps = useMemo(
    () => ({ selectedPhotographer, backendSlots, allBackendSlots }),
    [selectedPhotographer, backendSlots, allBackendSlots]
  );
  const selectedDateAvailabilities = useMemo(
    () => buildSelectedDateAvailabilities(selectorDeps, date),
    [selectorDeps, date]
  );
  const weekAvailabilities = useMemo(
    () => buildWeekAvailabilities(selectorDeps, date),
    [selectorDeps, date]
  );
  const monthAvailabilities = useMemo(
    () => buildMonthAvailabilities(selectorDeps, date),
    [selectorDeps, date]
  );
  const getSelectedDateAvailabilities = useCallback(
    () => selectedDateAvailabilities,
    [selectedDateAvailabilities]
  );
  const getWeekAvailabilities = useCallback(() => weekAvailabilities, [weekAvailabilities]);
  const getMonthAvailabilities = useCallback(() => monthAvailabilities, [monthAvailabilities]);
  const checkTimeOverlap = useCallback(
    (startTime: string, endTime: string, dateStr?: string, dayOfWeek?: string, excludeSlotId?: string) =>
      checkTimeOverlapFn(selectorDeps, startTime, endTime, dateStr, dayOfWeek, excludeSlotId),
    [selectorDeps]
  );

  const getPhotographerAvailabilityLabel = React.useCallback(
    (photographerId: string) =>
      buildPhotographerAvailabilityLabel(photographerId, date, {
        selectedPhotographer,
        backendSlots,
        photographerAvailabilityMap,
        photographerWeeklySchedules,
      }),
    [backendSlots, date, photographerAvailabilityMap, photographerWeeklySchedules, selectedPhotographer]
  );

  const getCurrentWeeklySchedule = (): WeeklyScheduleItem[] => {
    if (selectedPhotographer === "all") return DEFAULT_WEEKLY_SCHEDULE;
    return photographerWeeklySchedules[selectedPhotographer] || DEFAULT_WEEKLY_SCHEDULE;
  };

  const canEditAvailability = isAdmin || (isPhotographer && user && String(user.id) === String(selectedPhotographer));

  const notifyDemoAvailabilityRestriction = () => {
    toast({
      title: "Demo availability",
      description: "Generated sample availability can't be modified. Create a new slot instead.",
    });
  };

  const handleDeleteAvailability = async (slotId: string, _specificDate?: string) => {
    try {
      const slotToDelete = backendSlots.find(s => String(s.id) === slotId) ||
        allBackendSlots.find(s => String(s.id) === slotId);
      if (slotToDelete?.isRandom) {
        notifyDemoAvailabilityRestriction();
        return;
      }
      if (!slotToDelete || !slotToDelete.id) return;

      const res = await fetch(API_ROUTES.photographerAvailability.delete(slotToDelete.id), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        await refreshPhotographerSlots();
        const isRecurringSlot = !slotToDelete.date && slotToDelete.day_of_week;
        toast({
          title: "Schedule deleted",
          description: isRecurringSlot
            ? "The recurring schedule has been removed."
            : "The schedule has been removed.",
        });
        if (selectedSlotId === slotId) setSelectedSlotId(null);
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast({ title: "Error", description: errorData.message || "Failed to delete schedule.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete schedule.", variant: "destructive" });
    }
  };

  const handleMarkUnavailable = async (slotId: string, specificDate?: string) => {
    try {
      const slot = backendSlots.find(s => String(s.id) === slotId) ||
        allBackendSlots.find(s => String(s.id) === slotId);
      if (slot?.isRandom) {
        notifyDemoAvailabilityRestriction();
        return;
      }
      if (!slot || !slot.id) return;

      const isRecurringSlot = !slot.date && slot.day_of_week;
      if (isRecurringSlot) {
        // For recurring slots, create a per-date unavailability override so
        // the recurring rule remains intact for other weeks.
        const overrideDate = specificDate || (date ? format(date, 'yyyy-MM-dd') : null);
        if (!overrideDate) {
          toast({ title: "Select a date", description: "Choose a date to mark unavailable for the recurring schedule.", variant: "destructive" });
          return;
        }
        const res = await fetch(API_ROUTES.photographerAvailability.create, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            photographer_id: slot.photographer_id,
            date: overrideDate,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            status: 'unavailable',
          }),
        });
        if (res.ok) {
          await refreshPhotographerSlots();
          toast({
            title: "Unavailable for this date",
            description: `Marked as unavailable for ${overrideDate}. Recurring schedule remains for other weeks.`,
          });
          if (selectedSlotId === slotId) setSelectedSlotId(null);
        } else {
          const errorData = await res.json().catch(() => ({}));
          toast({ title: "Error", description: errorData.message || "Failed to mark unavailable.", variant: "destructive" });
        }
        return;
      }

      // For a specific-date slot, update it to unavailable in place.
      const res = await fetch(API_ROUTES.photographerAvailability.update(slot.id), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          photographer_id: slot.photographer_id,
          date: slot.date,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: 'unavailable',
        }),
      });
      if (res.ok) {
        await refreshPhotographerSlots();
        toast({ title: "Marked unavailable", description: "This schedule is now unavailable." });
        if (selectedSlotId === slotId) setSelectedSlotId(null);
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast({ title: "Error", description: errorData.message || "Failed to mark unavailable.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to mark unavailable.", variant: "destructive" });
    }
  };

  const handleEditAvailability = () => setEditingWeeklySchedule(true);

  const saveWeeklySchedule = async () => {
    if (selectedPhotographer === "all") {
      toast({ title: "Select a photographer", description: "Please select a specific photographer before saving schedule.", variant: "destructive" });
      return;
    }
    const currentSchedule = getCurrentWeeklySchedule();
    setPhotographerWeeklySchedules(prev => ({ ...prev, [selectedPhotographer]: currentSchedule }));
    setEditingWeeklySchedule(false);
    toast({
      title: "Schedule saved",
      description: `Weekly schedule for ${getPhotographerName(selectedPhotographer)} has been updated.`,
    });
    try {
      const dayMap: Record<string, string> = {
        Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday',
        Fri: 'friday', Sat: 'saturday', Sun: 'sunday',
      };
      const mapDay = (d: string) => dayMap[d] || d.toLowerCase();
      const payload = {
        photographer_id: Number(selectedPhotographer),
        availabilities: getCurrentWeeklySchedule()
          .filter(day => day.active)
          .map(day => ({
            day_of_week: mapDay(day.day),
            start_time: uiTimeToHhmm(day.startTime),
            end_time: uiTimeToHhmm(day.endTime),
            status: 'available',
          }))
      };
      const res = await fetch(API_ROUTES.photographerAvailability.bulk, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) await refreshPhotographerSlots();
    } catch (error) {
      // silent
    }
  };

  const updateCurrentWeeklySchedule = (
    index: number,
    field: keyof WeeklyScheduleItem,
    value: WeeklyScheduleItem[keyof WeeklyScheduleItem]
  ) => {
    if (selectedPhotographer === "all") return;
    const updatedSchedules = { ...photographerWeeklySchedules };
    if (!updatedSchedules[selectedPhotographer]) {
      updatedSchedules[selectedPhotographer] = DEFAULT_WEEKLY_SCHEDULE;
    }
    updatedSchedules[selectedPhotographer] = [
      ...updatedSchedules[selectedPhotographer].slice(0, index),
      { ...updatedSchedules[selectedPhotographer][index], [field]: value },
      ...updatedSchedules[selectedPhotographer].slice(index + 1)
    ];
    setPhotographerWeeklySchedules(updatedSchedules);
  };

  const filteredPhotographers = useMemo(() => {
    if (!searchQuery) return photographers;
    return photographers.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [photographers, searchQuery]);

  // Update currentMonth when date changes
  useEffect(() => {
    if (date) {
      const dateMonth = startOfMonth(date);
      if (format(dateMonth, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM')) {
        setCurrentMonth(dateMonth);
      }
    }
  }, [date, currentMonth]);

  // Scroll to current time in day view when date changes
  useEffect(() => {
    if (viewMode !== "day" || !dayViewScrollRef.current || !date) return;
    const now = new Date();
    const isTodayDate = isToday(date);
    dayViewIsProgrammaticScroll.current = true;

    const doScroll = (top: number) => {
      requestAnimationFrame(() => {
        if (dayViewScrollRef.current) dayViewScrollRef.current.scrollTop = top;
        if (dayViewTimeScrollRef.current) dayViewTimeScrollRef.current.scrollTop = top;
        dayViewIsProgrammaticScroll.current = false;
      });
    };

    if (isTodayDate) {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const startHour = 8;
      const hourHeight = 64;
      if (currentHour >= startHour && currentHour < 24) {
        const hoursFromStart = currentHour - startHour;
        const minutesOffset = (currentMinute / 60) * hourHeight;
        doScroll((hoursFromStart * hourHeight) + minutesOffset);
      } else {
        doScroll(0);
      }
    } else {
      doScroll(0);
    }
  }, [date, viewMode]);

  const renderViewModeButtons = (variant: "header" | "compact") => (
    <div className={cn("flex items-center gap-1 bg-muted rounded-md p-1", variant === "compact" && "shadow-sm")}>
      {(["day", "week", "month"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => {
            setViewMode(mode);
            setDate(new Date());
            setSelectedSlotId(null);
          }}
          className={cn(
            variant === "header"
              ? "px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              : "px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
            viewMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );

  const navigateDate = (direction: -1 | 1) => {
    if (viewMode === "week") setDate(addDays(date || new Date(), 7 * direction));
    else if (viewMode === "day") setDate(addDays(date || new Date(), direction));
    else if (viewMode === "month") {
      const newDate = direction === -1 ? subMonths(date || new Date(), 1) : addMonths(date || new Date(), 1);
      setDate(newDate);
      setCurrentMonth(startOfMonth(newDate));
    }
  };

  const goToToday = () => {
    const today = new Date();
    setDate(today);
    if (viewMode === "month") setCurrentMonth(startOfMonth(today));
  };

  const openBlockDialog = () => {
    if (!date) {
      toast({ title: "Select a date", description: "Please select a date before blocking calendar.", variant: "destructive" });
      return;
    }
    setBlockSchedule({ date, startTime: "09:00", endTime: "17:00" });
    setBlockPhotographer(selectedPhotographer === "all" ? "" : selectedPhotographer);
    setBlockPhotographerSearch("");
    setIsBlockDialogOpen(true);
  };

  const calendarBodyProps = {
    viewMode, isMobile: isCompactLayout, date, setDate, currentMonth, setCurrentMonth,
    selectedPhotographer, setSelectedPhotographer, photographers, backendSlots, allBackendSlots,
    selectedSlotId, setSelectedSlotId, expandedBookingDetails, setExpandedBookingDetails,
    setMobileTab, getSelectedDateAvailabilities, to12HourDisplay,
    dayViewScrollRef, dayViewTimeScrollRef, dayViewScrollChanging,
    dayViewScrollTimeout, dayViewLastChangeTime, dayViewIsProgrammaticScroll,
    setRightClickedDate, setRightClickedTime, setIsWeeklyScheduleDialogOpen,
    setIsBlockDialogOpen, setBlockSchedule, toast,
  };

  const scheduleDetailsProps = {
    viewMode, date, selectedPhotographer, getPhotographerName,
    getSelectedDateAvailabilities, getWeekAvailabilities, getMonthAvailabilities,
    canEditAvailability, editingWeeklySchedule, setEditingWeeklySchedule,
    getCurrentWeeklySchedule, updateCurrentWeeklySchedule,
    weeklyScheduleNote, setWeeklyScheduleNote,
    handleEditAvailability, saveWeeklySchedule, handleDeleteAvailability,
    handleMarkUnavailable,
    notifyDemoAvailabilityRestriction, backendSlots, allBackendSlots,
    selectedSlotId, setSelectedSlotId, expandedBookingDetails, setExpandedBookingDetails,
    setEditedAvailability, setIsEditDialogOpen, setIsWeeklyScheduleDialogOpen,
    setSelectedShootId, setShootDetailsModalOpen, to12HourDisplay,
  };

  return (
    <>
      <div className={cn("flex-1 flex flex-col min-h-0", isCompactLayout ? "overflow-y-auto overscroll-y-contain pb-6" : "overflow-hidden")}>
        <div className={cn("flex-1 flex flex-col min-h-0", isCompactLayout ? "p-3 sm:p-4 pb-6" : "h-full px-6 pb-6 pt-0 overflow-hidden")}>
          {isCompactLayout ? (
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-lg sm:text-xl font-bold truncate">Photographer Availability</h1>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button variant="outline" size="sm" className="rounded-md whitespace-nowrap h-8 px-2.5 text-xs" onClick={goToToday}>Today</Button>
                {canEditAvailability && (
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md whitespace-nowrap h-8 px-2.5 text-xs" onClick={openBlockDialog}>
                    <Ban className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" className="rounded-md whitespace-nowrap h-8 px-2.5 text-xs" aria-label="Sync" title="Sync" onClick={() => setIsSyncModalOpen(true)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <PageHeader
              badge={isDesktop ? "Availability" : undefined}
              title={isDesktop ? "Photographer Availability" : "Availability"}
              description={isDesktop ? "Manage and schedule photographer availability" : undefined}
              action={
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button variant="outline" size="sm" className="rounded-md whitespace-nowrap h-9 px-3 text-sm" onClick={goToToday}>Today</Button>
                  {renderViewModeButtons("header")}
                  {canEditAvailability && (
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md whitespace-nowrap h-9 px-3 text-sm" onClick={openBlockDialog}>
                      <Ban className="h-4 w-4 mr-2" />
                      Block Calendar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="rounded-md whitespace-nowrap h-9 px-3 text-sm" onClick={() => setIsSyncModalOpen(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync
                  </Button>
                </div>
              }
            />
          )}

          {loadingPhotographers && (
            <div className="py-3">
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                <div className="h-full w-1/3 rounded-full bg-primary/80 animate-pulse" />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Loading photographers...</div>
            </div>
          )}

          {/* Month + Date navigation strips */}
          <div className="mt-3 sm:mt-6 mb-2 sm:mb-4 space-y-2 sm:space-y-3 flex-shrink-0">
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-10 sm:w-24 bg-gradient-to-r from-background via-background/85 via-background/60 to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-10 sm:w-24 bg-gradient-to-l from-background via-background/85 via-background/60 to-transparent z-10 pointer-events-none" />
              <div ref={monthNavScrollRef} className="flex items-center gap-1.5 xl:gap-2 overflow-x-auto pb-1.5 xl:pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-2 xl:px-6">
                {months.map((month, idx) => {
                  const monthName = format(month, 'MMMM');
                  const monthYear = format(month, 'yyyy');
                  const monthKey = format(month, 'yyyy-MM');
                  const isCurrentMonth = monthKey === format(new Date(), 'yyyy-MM');
                  const isSelectedMonth = date && format(date, 'yyyy-MM') === monthKey;
                  const prevMonth = idx > 0 ? months[idx - 1] : null;
                  const showYear = !prevMonth || (format(prevMonth, 'yyyy') !== monthYear);

                  return (
                    <div key={idx} style={{ display: 'contents' }}>
                      {showYear && idx > 0 && (
                        <span className="px-2 text-xs font-semibold text-blue-600 dark:text-blue-400">{monthYear}</span>
                      )}
                      <button
                        data-month={monthKey}
                        onClick={() => {
                          setCurrentMonth(month);
                          if (!date || format(date, 'yyyy-MM') !== monthKey) setDate(startOfMonth(month));
                        }}
                        className={cn(
                          "px-2.5 xl:px-3 py-1 xl:py-1.5 rounded-md whitespace-nowrap font-medium transition-colors text-xs xl:text-sm flex-shrink-0",
                          isCurrentMonth
                            ? "border-2 border-primary font-semibold text-foreground"
                            : isSelectedMonth
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        {monthName}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-10 sm:w-24 bg-gradient-to-r from-background via-background/85 via-background/60 to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-10 sm:w-24 bg-gradient-to-l from-background via-background/85 via-background/60 to-transparent z-10 pointer-events-none" />
              <div ref={dateNavScrollRef} className="flex items-center gap-1.5 xl:gap-2 overflow-x-auto pb-1.5 xl:pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-2 xl:px-6">
                {monthDates.map((day, idx) => {
                  const prevDay = idx > 0 ? monthDates[idx - 1] : null;
                  const currentMonthStr = format(day, 'yyyy-MM');
                  const showMonth = !prevDay || (format(prevDay, 'yyyy-MM') !== currentMonthStr);
                  const isSelected = date && isSameDay(day, date);
                  const isTodayDate = isToday(day);

                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                  const rows = selectedPhotographer === 'all' ? allBackendSlots : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));
                  const specific = rows.filter(s => s.date === dayStr);
                  const weekly = rows.filter(s => !s.date && s.day_of_week?.toLowerCase() === dow);
                  // Apply the "specific overrides weekly" rule PER photographer, so that
                  // one person's specific-date override doesn't swallow everyone else's
                  // weekly/recurring slots on the same day.
                  const specificPhotographerIds = new Set(specific.map((s) => String(s.photographer_id ?? '')));
                  const weeklyWithoutOverrides = weekly.filter(
                    (s) => !specificPhotographerIds.has(String(s.photographer_id ?? ''))
                  );
                  const relevantSlots = [...specific, ...weeklyWithoutOverrides];
                  const availabilityInfo = relevantSlots.length > 0
                    ? relevantSlots.map(s => `${toHhMm(s.start_time)} - ${toHhMm(s.end_time)} (${s.status || 'available'})`).join(', ')
                    : 'No availability';

                  const hasSlots = relevantSlots.length > 0;

                  // Per-photographer roll-up: a photographer is "available" if they have any
                  // available slot that day; otherwise "booked" if they have any booked
                  // slot; otherwise "unavailable". Green wins whenever any photographer is
                  // available. When no one is available, majority between booked and
                  // unavailable wins (ties fall back to booked so fully-booked days appear
                  // blue rather than red).
                  const statusByPhotographer = new Map<string, 'available' | 'booked' | 'unavailable'>();
                  relevantSlots.forEach((s) => {
                    const pid = String(s.photographer_id ?? '');
                    if (!pid) return;
                    const status: 'available' | 'booked' | 'unavailable' =
                      s.status === 'booked'
                        ? 'booked'
                        : s.status === 'unavailable'
                          ? 'unavailable'
                          : 'available';
                    const current = statusByPhotographer.get(pid);
                    const rank = (v: 'available' | 'booked' | 'unavailable') =>
                      v === 'available' ? 3 : v === 'booked' ? 2 : 1;
                    if (!current || rank(status) > rank(current)) {
                      statusByPhotographer.set(pid, status);
                    }
                  });
                  let availableCount = 0;
                  let bookedCount = 0;
                  let unavailableCount = 0;
                  statusByPhotographer.forEach((status) => {
                    if (status === 'available') availableCount += 1;
                    else if (status === 'booked') bookedCount += 1;
                    else unavailableCount += 1;
                  });

                  let availabilityColor = '';
                  if (hasSlots) {
                    if (availableCount > 0) {
                      availabilityColor = 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
                    } else if (bookedCount >= unavailableCount) {
                      availabilityColor = 'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700';
                    } else {
                      availabilityColor = 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
                    }
                  }

                  return (
                    <div key={idx} style={{ display: 'contents' }}>
                      {showMonth && (
                        <span className={cn("px-2 text-xs font-semibold flex-shrink-0",
                          format(day, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM') && "text-muted-foreground")}>
                          {format(day, 'MMMM')}
                        </span>
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              data-date={dayStr}
                              onClick={() => {
                                setDate(day);
                                const dayMonth = startOfMonth(day);
                                if (format(dayMonth, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM')) setCurrentMonth(dayMonth);
                              }}
                              className={cn(
                                "flex h-14 w-14 xl:h-16 xl:w-16 flex-col items-center justify-center rounded-full p-0 transition-all flex-shrink-0 border",
                                isTodayDate
                                  ? "border-2 border-primary font-semibold bg-primary/10"
                                  : isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : availabilityColor ? `${availabilityColor} border` : "bg-transparent border-transparent hover:bg-muted/50"
                              )}
                            >
                              <span className={cn("text-sm font-medium", isTodayDate ? "text-primary" : isSelected ? "text-primary-foreground" : "text-muted-foreground")}>{format(day, 'd')}</span>
                              <span className={cn("text-xs mt-0.5", isTodayDate ? "text-primary" : isSelected ? "text-primary-foreground" : "text-muted-foreground")}>{format(day, 'EEE')}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
                              <div className="font-semibold mb-1">{format(day, 'EEEE, MMMM d, yyyy')}</div>
                              <div className="text-xs text-muted-foreground">{availabilityInfo}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {isCompactLayout ? (
            <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as "calendar" | "details")} className="flex min-h-0 flex-col gap-2">
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted p-1 mb-1 flex-shrink-0">
                <TabsTrigger value="calendar" className="rounded-lg text-xs data-[state=active]:bg-background data-[state=active]:shadow">Calendar</TabsTrigger>
                <TabsTrigger value="details" className="rounded-lg text-xs data-[state=active]:bg-background data-[state=active]:shadow">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="calendar" className="mt-0 flex min-h-0 flex-col gap-2 pb-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canManagePhotographerSelection && (
                      <PhotographerListPanel
                        variant="mobile-sheet"
                        photographers={photographers}
                        filteredPhotographers={filteredPhotographers}
                        selectedPhotographer={selectedPhotographer}
                        setSelectedPhotographer={setSelectedPhotographer}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        setEditingWeeklySchedule={setEditingWeeklySchedule}
                        getPhotographerAvailabilityLabel={getPhotographerAvailabilityLabel}
                        open={isPhotographerSheetOpen}
                        onOpenChange={setIsPhotographerSheetOpen}
                      />
                    )}
                    <Select value={selectedPhotographer} onValueChange={(value) => { setSelectedPhotographer(value); setEditingWeeklySchedule(false); }}>
                      <SelectTrigger className="w-full min-w-0 flex-1">
                        <SelectValue placeholder="Select photographer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Photographers</SelectItem>
                        {photographers.map((photographer) => (
                          <SelectItem key={photographer.id} value={photographer.id}>{photographer.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Card className="p-2 sm:p-3 flex min-h-[360px] sm:min-h-[520px] flex-col border shadow-sm rounded-md">
                  <div className="flex items-start justify-between mb-2 flex-shrink-0 gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xs sm:text-sm font-semibold mb-0.5 truncate">
                        {selectedPhotographer === "all" ? "Calendar" : `${getPhotographerName(selectedPhotographer)}'s Calendar`}
                      </h2>
                      {date && viewMode !== "month" && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                          {viewMode === "day"
                            ? format(date, 'EEEE, MMMM d, yyyy')
                            : viewMode === "week"
                              ? `Week of ${format(startOfWeek(date), 'MMM d')} - ${format(endOfWeek(date), 'MMM d, yyyy')}`
                              : format(date, 'MMMM yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">{renderViewModeButtons("compact")}</div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg" onClick={() => navigateDate(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-lg px-3 sm:px-4 text-xs sm:text-sm" onClick={goToToday}>
                      {viewMode === "month" ? "Current Month" : "Today"}
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg" onClick={() => navigateDate(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-1 min-h-0 flex-col">
                    <AvailabilityCalendarBody {...calendarBodyProps} />
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="details" className="flex flex-col mt-0">
                <ScheduleDetailsPanel variant="mobile" {...scheduleDetailsProps} />
              </TabsContent>
            </Tabs>
          ) : (
            <div
              ref={desktopCalendarRowRef}
              className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 grid-rows-1 gap-4 overflow-hidden"
              style={!isCompactLayout && desktopCalendarRowHeight ? { height: `${desktopCalendarRowHeight}px`, maxHeight: `${desktopCalendarRowHeight}px` } : undefined}
            >
              {canManagePhotographerSelection && (
                <PhotographerListPanel
                  variant="desktop"
                  photographers={photographers}
                  filteredPhotographers={filteredPhotographers}
                  selectedPhotographer={selectedPhotographer}
                  setSelectedPhotographer={setSelectedPhotographer}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  setEditingWeeklySchedule={setEditingWeeklySchedule}
                  getPhotographerAvailabilityLabel={getPhotographerAvailabilityLabel}
                />
              )}

              <div className={cn("flex flex-col min-h-0", canManagePhotographerSelection ? "lg:col-span-5" : "lg:col-span-8")}>
                <Card className="p-4 flex-1 flex flex-col border shadow-sm rounded-md min-h-0 overflow-hidden">
                  <div className="flex items-start justify-between mb-3 flex-shrink-0">
                    <div>
                      <h2 className="text-base font-semibold mb-1">
                        {selectedPhotographer === "all" ? "Calendar" : `${getPhotographerName(selectedPhotographer)}'s Calendar`}
                      </h2>
                      {date && viewMode !== "month" && (
                        <p className="text-xs text-muted-foreground">
                          {viewMode === "day"
                            ? format(date, 'EEEE, MMMM d, yyyy')
                            : viewMode === "week"
                              ? `Week of ${format(startOfWeek(date), 'MMM d')} - ${format(endOfWeek(date), 'MMM d, yyyy')}`
                              : format(date, 'MMMM yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => navigateDate(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-lg px-4" onClick={goToToday}>
                        {viewMode === "month" ? "Current Month" : "Today"}
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => navigateDate(1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <AvailabilityCalendarBody {...calendarBodyProps} />
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center mt-4 pt-3 border-t flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span className="text-xs text-muted-foreground">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="text-xs text-muted-foreground">Booked</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-xs text-muted-foreground">Unavailable</span>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex flex-col min-h-0 lg:col-span-4">
                <ScheduleDetailsPanel variant="desktop" {...scheduleDetailsProps} />
              </div>
            </div>
          )}
        </div>
      </div>

      <EditAvailabilityDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        editedAvailability={editedAvailability}
        setEditedAvailability={setEditedAvailability}
        selectedPhotographer={selectedPhotographer}
        getPhotographerName={getPhotographerName}
        checkTimeOverlap={checkTimeOverlap}
        backendSlots={backendSlots}
        allBackendSlots={allBackendSlots}
        date={date}
        authHeaders={authHeaders}
        refreshPhotographerSlots={refreshPhotographerSlots}
        notifyDemoAvailabilityRestriction={notifyDemoAvailabilityRestriction}
        setSelectedSlotId={setSelectedSlotId}
        toast={toast}
      />

      <WeeklyScheduleDialog
        open={isWeeklyScheduleDialogOpen}
        onOpenChange={setIsWeeklyScheduleDialogOpen}
        newWeeklySchedule={newWeeklySchedule}
        setNewWeeklySchedule={setNewWeeklySchedule}
        specificDateFrom={specificDateFrom}
        setSpecificDateFrom={setSpecificDateFrom}
        specificDateTo={specificDateTo}
        setSpecificDateTo={setSpecificDateTo}
        specificScheduleDates={specificScheduleDates}
        selectedPhotographer={selectedPhotographer}
        getPhotographerName={getPhotographerName}
        checkTimeOverlap={checkTimeOverlap}
        date={date}
        authHeaders={authHeaders}
        refreshPhotographerSlots={refreshPhotographerSlots}
        toast={toast}
      />

      <BlockTimeDialog
        open={isBlockDialogOpen}
        onOpenChange={setIsBlockDialogOpen}
        blockSchedule={blockSchedule}
        setBlockSchedule={setBlockSchedule}
        blockPhotographer={blockPhotographer}
        setBlockPhotographer={setBlockPhotographer}
        blockPhotographerOpen={blockPhotographerOpen}
        setBlockPhotographerOpen={setBlockPhotographerOpen}
        blockPhotographerSearch={blockPhotographerSearch}
        setBlockPhotographerSearch={setBlockPhotographerSearch}
        photographerScopedBlockId={photographerScopedBlockId}
        isPhotographer={isPhotographer}
        user={user}
        photographers={photographers}
        selectedPhotographer={selectedPhotographer}
        getPhotographerName={getPhotographerName}
        authHeaders={authHeaders}
        refreshPhotographerSlots={refreshPhotographerSlots}
        isBlocking={isBlocking}
        setIsBlocking={setIsBlocking}
        toast={toast}
      />

      <CalendarSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onGoogleCalendarConnect={fetchGoogleCalendarAuthorizationUrl}
        isGoogleCalendarConnecting={isGoogleCalendarConnecting}
        googleCalendarStatus={googleCalendarStatus}
        isGoogleCalendarStatusLoading={isGoogleCalendarStatusLoading}
        requiresPhotographerSelection={!isPhotographer && selectedPhotographer === "all"}
        availabilitySlots={(selectedPhotographer === "all" ? allBackendSlots : backendSlots).map(slot => ({
          id: typeof slot.id === 'string' ? parseInt(slot.id, 10) || 0 : slot.id,
          photographer_id: slot.photographer_id,
          date: slot.date,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: slot.status,
        }))}
        photographerName={selectedPhotographer === "all" ? "Your" : photographers.find((p) => p.id === selectedPhotographer)?.name || "Your"}
      />

      {selectedShootId && (
        <ShootDetailsModal
          shootId={selectedShootId}
          isOpen={shootDetailsModalOpen}
          onClose={() => {
            setShootDetailsModalOpen(false);
            setSelectedShootId(null);
          }}
        />
      )}
    </>
  );
}
