import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, eachDayOfInterval, format, startOfDay } from 'date-fns';
import { AvailabilitySearchBinding } from '@/components/availability/AvailabilitySearchBinding';
import { ResponsiveAvailabilityCalendar } from '@/components/availability/ResponsiveAvailabilityCalendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePageLoading } from '@/hooks/use-page-loading';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import API_ROUTES from '@/lib/api';
import type { Availability, WeeklyScheduleItem } from '@/types/availability';
import { mapBackendSlots, uiTimeToHhmm } from '@/lib/availability/utils';
import { buildMonthAvailabilities, buildSelectedDateAvailabilities, buildWeekAvailabilities, buildWeeklyScheduleFromSlots, checkTimeOverlap as checkTimeOverlapFn } from '@/lib/availability/selectors';
import { useAvailabilityData } from '@/hooks/useAvailabilityData';
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync';
import { CalendarSyncModal } from '@/components/availability/CalendarSyncModal';
import { ShootDetailsModal } from '@/components/shoots/ShootDetailsModal';
import { AvailabilityPhotographerSelect } from '@/components/availability/AvailabilityPhotographerSelect';
import { ScheduleDetailsPanel } from '@/components/availability/ScheduleDetailsPanel';
import { DEFAULT_WEEKLY_SCHEDULE, DEFAULT_SCHEDULE_STARTER } from '@/components/availability/availabilityDefaults';
import { EditAvailabilityDialog } from '@/components/availability/dialogs/EditAvailabilityDialog';
import { WeeklyScheduleDialog, type NewWeeklyScheduleState } from '@/components/availability/dialogs/WeeklyScheduleDialog';
import { BlockTimeDialog, type BlockScheduleState } from '@/components/availability/dialogs/BlockTimeDialog';

export default function Availability() {
  const { toast } = useToast();
  const { user, role, isImpersonating, originalUser } = useAuth();
  const { formatTime: formatTimePreference } = useUserPreferences();

  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'editing_manager';
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
  const [selectedPhotographer, setSelectedPhotographer] = useState<string>(
    () => (role === "photographer" && user?.id ? String(user.id) : "all"),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("month");
  const [manageOpen, setManageOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingWeeklySchedule, setEditingWeeklySchedule] = useState(false);
  const [savingWeeklySchedule, setSavingWeeklySchedule] = useState(false);
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

  // Data hook
  const {
    photographers,
    loadingPhotographers, loading: availabilityLoading,
    backendSlots,
    allBackendSlots,
    error: availabilityError, retry: retryAvailability,
    authHeaders,
    refreshPhotographerSlots,
  } = useAvailabilityData({
    selectedPhotographer,
    setSelectedPhotographer,
    date,
    viewMode,
    role,
    userId: user?.id,
    viewerName: user?.name,
    isPhotographer,
    canManagePhotographerSelection,
    availabilitySessionScope,
  });
  usePageLoading(loadingPhotographers || availabilityLoading);
  const loadExportSlots = useCallback(async (from: Date, to: Date, signal: AbortSignal) => {
    if (selectedPhotographer === 'all') return {rows:[],timezone:''};
    const headers = authHeaders();
    const [hours, bookings] = await Promise.all([
      fetch(API_ROUTES.photographerAvailability.list(selectedPhotographer), {headers,signal}),
      fetch(API_ROUTES.photographerAvailability.bookedSlots, {method:'POST',headers,signal,
        body:JSON.stringify({photographer_id:Number(selectedPhotographer),from_date:format(from,'yyyy-MM-dd'),to_date:format(to,'yyyy-MM-dd')})}),
    ]);
    if (!hours.ok || !bookings.ok) throw new Error('Unable to load complete export');
    const [hoursData, bookingsData] = await Promise.all([hours.json(),bookings.json()]);
    if (!hoursData.timezone) throw new Error('Schedule timezone is unavailable');
    return {rows:[...mapBackendSlots(hoursData.data,selectedPhotographer),...mapBackendSlots(bookingsData.data,selectedPhotographer)],timezone:String(hoursData.timezone)};
  }, [authHeaders, selectedPhotographer]);
  // Google Calendar hook
  const {
    googleCalendarStatus,
    isGoogleCalendarConnecting,
    isGoogleCalendarStatusLoading,
    isGoogleCalendarDisconnecting,
    fetchGoogleCalendarAuthorizationUrl,
    disconnectGoogleCalendar,
  } = useGoogleCalendarSync({
    canLaunchGoogleCalendarOAuth,
    isPhotographer,
    selectedPhotographer,
    photographers,
    isSyncModalOpen,
    authHeaders,
    toast,
  });

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

  const getCurrentWeeklySchedule = (): WeeklyScheduleItem[] => {
    if (selectedPhotographer === "all") return DEFAULT_WEEKLY_SCHEDULE;
    return photographerWeeklySchedules[selectedPhotographer] || DEFAULT_WEEKLY_SCHEDULE;
  };

  const canEditAvailability = Boolean(isAdmin || (isPhotographer && user && String(user.id) === String(selectedPhotographer)));

  const notifyDemoAvailabilityRestriction = () => {
    toast({
      title: "Demo availability",
      description: "Generated sample availability can't be modified. Create a new slot instead.",
    });
  };

  const handleDeleteAvailability = async (slotId: string) => { setDeleteId(slotId); };
  const performDeleteAvailability = async (slotId: string) => {
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

  /** Open the reusable weekly/recurring editor, hydrated from existing dateless available slots. */
  const openDefaultSchedule = () => {
    setManageOpen(true);
    if (selectedPhotographer === "all") {
      toast({
        title: "Select a photographer",
        description: "Choose a team member before editing their default schedule.",
        variant: "destructive",
      });
      return;
    }
    const hydrated = buildWeeklyScheduleFromSlots(backendSlots, DEFAULT_SCHEDULE_STARTER);
    setWeeklyScheduleNote(backendSlots.find(slot => !slot.date && slot.status === 'available')?.note || '');
    const hasRecurring = hydrated.some((day) => day.active);
    setPhotographerWeeklySchedules((prev) => ({
      ...prev,
      [selectedPhotographer]: hasRecurring ? hydrated : DEFAULT_SCHEDULE_STARTER,
    }));
    setEditingWeeklySchedule(true);
  };

  const saveWeeklySchedule = async () => {
    if (savingWeeklySchedule) return;
    if (selectedPhotographer === "all") {
      toast({ title: "Select a photographer", description: "Please select a specific photographer before saving schedule.", variant: "destructive" });
      return;
    }
    const currentSchedule = getCurrentWeeklySchedule();
    const dayMap: Record<string, string> = {
      Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday',
      Fri: 'friday', Sat: 'saturday', Sun: 'sunday',
    };
    const mapDay = (d: string) => dayMap[d] || d.toLowerCase();
    const activeDays = currentSchedule.filter((day) => day.active);
    for (const day of activeDays) {
      const start = uiTimeToHhmm(day.startTime);
      const end = uiTimeToHhmm(day.endTime);
      if (!start || !end || start >= end) {
        toast({
          title: "Invalid time range",
          description: `End time must be after start time for ${day.day}.`,
          variant: "destructive",
        });
        return;
      }
    }

    const payload = {
      photographer_id: Number(selectedPhotographer),
      availabilities: activeDays.map((day) => ({
        day_of_week: mapDay(day.day),
        start_time: uiTimeToHhmm(day.startTime),
        end_time: uiTimeToHhmm(day.endTime),
        status: 'available' as const,
        note: weeklyScheduleNote.trim() || null,
      })),
    };

    setSavingWeeklySchedule(true);
    try {
      const res = await fetch(API_ROUTES.photographerAvailability.replaceWeekly, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description: errorData.message || "Failed to save default schedule.",
          variant: "destructive",
        });
        return;
      }
      setPhotographerWeeklySchedules((prev) => ({ ...prev, [selectedPhotographer]: currentSchedule }));
      setEditingWeeklySchedule(false);
      await refreshPhotographerSlots();
      toast({
        title: "Default schedule saved",
        description: activeDays.length === 0
          ? `Cleared recurring availability for ${getPhotographerName(selectedPhotographer)}.`
          : `Recurring ${uiTimeToHhmm(activeDays[0].startTime)}–${uiTimeToHhmm(activeDays[0].endTime)} on ${activeDays.length} day(s) for ${getPhotographerName(selectedPhotographer)}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save default schedule.",
        variant: "destructive",
      });
    } finally {
      setSavingWeeklySchedule(false);
    }
  };

  const updateCurrentWeeklySchedule = (
    index: number,
    field: keyof WeeklyScheduleItem,
    value: WeeklyScheduleItem[keyof WeeklyScheduleItem]
  ) => {
    if (selectedPhotographer === "all") return;
    setPhotographerWeeklySchedules(previous => ({
      ...previous,
      [selectedPhotographer]: (previous[selectedPhotographer] || DEFAULT_WEEKLY_SCHEDULE)
        .map((day, dayIndex) => dayIndex === index ? { ...day, [field]: value } : day),
    }));
  };

  const filteredPhotographers = useMemo(() => {
    if (!searchQuery) return photographers;
    return photographers.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [photographers, searchQuery]);

  const changeViewMode = (mode: "day" | "week" | "month") => {
    setViewMode(mode);
    setSelectedSlotId(null);
  };

  const navigateDate = (direction: -1 | 1) => {
    setDate(viewMode === 'month' ? addMonths(date || new Date(), direction) : addDays(date || new Date(), direction * (viewMode === 'week' ? 7 : 1)));
  };
  const goToToday = () => setDate(new Date());

  const openBlockDialog = (personId?: string, startTime = "09:00", endTime = "17:00") => {
    if (!date) {
      toast({ title: "Select a date", description: "Please select a date before blocking calendar.", variant: "destructive" });
      return;
    }
    setBlockSchedule({ date, startTime, endTime });
    setBlockPhotographer(personId || (selectedPhotographer === "all" ? "" : selectedPhotographer));
    setBlockPhotographerSearch("");
    setIsBlockDialogOpen(true);
  };

  const scheduleDetailsProps = {
    viewMode, date, selectedPhotographer, getPhotographerName,
    getSelectedDateAvailabilities, getWeekAvailabilities, getMonthAvailabilities,
    canEditAvailability, editingWeeklySchedule, setEditingWeeklySchedule, savingWeeklySchedule,
    getCurrentWeeklySchedule, updateCurrentWeeklySchedule,
    weeklyScheduleNote, setWeeklyScheduleNote,
    handleEditAvailability, openDefaultSchedule, saveWeeklySchedule, handleDeleteAvailability,
    handleMarkUnavailable,
    notifyDemoAvailabilityRestriction, backendSlots, allBackendSlots,
    selectedSlotId, setSelectedSlotId, expandedBookingDetails, setExpandedBookingDetails,
    setEditedAvailability, setIsEditDialogOpen, setIsWeeklyScheduleDialogOpen,
    setSelectedShootId, setShootDetailsModalOpen, to12HourDisplay,
  };

  return (
    <>
      <AvailabilitySearchBinding photographers={filteredPhotographers} query={searchQuery} onQueryChange={setSearchQuery} onSelect={id => { setSelectedPhotographer(id); setEditingWeeklySchedule(false); }} />
      <ResponsiveAvailabilityCalendar
        date={date || new Date()} viewMode={viewMode} photographers={photographers}
        selectedPhotographer={selectedPhotographer} slots={selectorDeps}
        canSelect={canManagePhotographerSelection} canEdit={canEditAvailability}
        loading={loadingPhotographers || availabilityLoading} error={availabilityError} searchQuery={searchQuery}
        formatTime={to12HourDisplay} onDate={setDate} onView={changeViewMode}
        onSelect={id => { setSelectedPhotographer(id); setEditingWeeklySchedule(false); }}
        onNavigate={navigateDate} onToday={goToToday} onRetry={retryAvailability}
        onAdd={() => setIsWeeklyScheduleDialogOpen(true)} onBlock={openBlockDialog}
        onManage={id => { if (id) setSelectedPhotographer(id); setEditingWeeklySchedule(false); setManageOpen(true); }}
        onDefault={openDefaultSchedule} onSync={() => setIsSyncModalOpen(true)}
        onShoot={id => { setSelectedShootId(id); setShootDetailsModalOpen(true); }}
        onEdit={slot => { setEditedAvailability(slot); setIsEditDialogOpen(true); }}
      />
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="availability-dialog max-w-3xl"><DialogHeader><DialogTitle>Manage schedules</DialogTitle><DialogDescription>Edit availability and recurring hours. Booked shoots keep their own schedule.</DialogDescription></DialogHeader>
          <AvailabilityPhotographerSelect canManagePhotographerSelection={canManagePhotographerSelection} photographers={photographers} selectedPhotographer={selectedPhotographer} onSelect={id => { setSelectedPhotographer(id); setEditingWeeklySchedule(false); }} />
          {availabilityLoading ? <p role="status">Loading schedules…</p> : availabilityError ? <p role="alert">{availabilityError}</p> : <ScheduleDetailsPanel variant="mobile" {...scheduleDetailsProps} />}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(deleteId)} onOpenChange={open => { if (!open && !deleting) setDeleteId(null); }}><DialogContent className="availability-dialog"><DialogHeader><DialogTitle>Delete this schedule?</DialogTitle><DialogDescription>Recurring schedules are removed from every matching weekday. Date-specific schedules are removed only for that date. Existing shoots remain unchanged.</DialogDescription></DialogHeader><div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={deleting} onClick={() => setDeleteId(null)}>Keep schedule</Button><Button variant="destructive" disabled={deleting} onClick={async () => { if (!deleteId || deleting) return; setDeleting(true); try { await performDeleteAvailability(deleteId); setDeleteId(null); } finally { setDeleting(false); } }}>{deleting ? 'Deleting…' : 'Delete schedule'}</Button></div></DialogContent></Dialog>

      <EditAvailabilityDialog
        onDelete={setDeleteId}
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
        photographers={photographers}
        canSelectPhotographer={canManagePhotographerSelection}
        onSelectPhotographer={setSelectedPhotographer}
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
        onSaved={setDate}
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
        loadSlots={loadExportSlots}
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onGoogleCalendarConnect={fetchGoogleCalendarAuthorizationUrl}
        allowGoogleCalendarReconnect={new URLSearchParams(window.location.search).get("calendar_scope_preview") === "owned"}
        isGoogleCalendarConnecting={isGoogleCalendarConnecting}
        onGoogleCalendarDisconnect={isPhotographer ? disconnectGoogleCalendar : undefined}
        isGoogleCalendarDisconnecting={isGoogleCalendarDisconnecting}
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
