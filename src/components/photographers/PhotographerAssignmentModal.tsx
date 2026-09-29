import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ElementType } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/dashboard/v2/SharedComponents';
import { usePhotographerAssignment } from '@/context/PhotographerAssignmentContext';
import { DashboardPhotographerSummary, DashboardShootSummary } from '@/types/dashboard';
import { API_ROUTES } from '@/lib/api';
import { API_BASE_URL } from '@/config/env';
import { fetchDashboardOverview } from '@/services/dashboardService';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isToday, isTomorrow, addDays, isPast, isSameDay } from 'date-fns';
import { Phone, Mail, Calendar, Clock, CheckCircle2, AlertTriangle, ExternalLink, ChevronRight, Info, ChevronLeft, MapPin, X } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { cn, getInitials } from '@/lib/utils';
import { getDashboardShootDisplayDate, getDashboardShootDisplayTime } from '@/utils/dashboardShootSchedule';
import { formatTimeForDisplay } from '@/utils/availabilityUtils';
import { PhotographerAvailabilityTimeline } from '@/components/photographers/PhotographerAvailabilityTimeline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

interface AvailabilitySlot {
  id: number;
  photographer_id: number;
  date?: string | null;
  day_of_week?: string | null;
  start_time: string;
  end_time: string;
  status: 'available' | 'unavailable' | 'booked';
}

interface TimelineSlot {
  start: string;
  end: string;
  status: 'available' | 'booked' | 'past' | 'unavailable';
  shoot?: {
    id: number;
    address: string;
    client: string;
    time: string;
  };
}

export const PhotographerAssignmentModal: React.FC = () => {
  const { isOpen, photographer, closeModal } = usePhotographerAssignment();
  const { toast } = useToast();
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [upcomingShoots, setUpcomingShoots] = useState<DashboardShootSummary[]>([]);
  const [photographerSchedule, setPhotographerSchedule] = useState<DashboardShootSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<'all' | 'compatible'>('all');
  const isMobile = useIsMobile();

  const parseShootDate = (shoot: DashboardShootSummary): Date | null => {
    const parsed = getDashboardShootDisplayDate(shoot);
    const minutes = timeToMinutes(getDashboardShootDisplayTime(shoot));
    if (parsed && minutes !== null) parsed.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return parsed;
  };

  const formatSlotTime = (value?: string | null) => {
    if (!value) return 'TBD';
    const [hours, minutes] = value.split(':');
    const hour = Number(hours);
    if (!Number.isFinite(hour)) return value;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes || '00'} ${suffix}`;
  };

  const normalizeStatus = (value?: string | null) => String(value || '').toLowerCase();

  const isAssignableShoot = (shoot: DashboardShootSummary) => {
    const status = normalizeStatus(shoot.workflowStatus || shoot.status);
    if (['completed', 'delivered', 'cancelled', 'editing', 'uploaded'].includes(status)) return false;
    return Boolean(parseShootDate(shoot));
  };

  const timeToMinutes = (value?: string | null) => {
    if (!value) return null;
    if (value.includes('T')) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.getHours() * 60 + parsed.getMinutes();
    }
    const match = value.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridian = match[3]?.toUpperCase();
    if (meridian === 'PM' && hours !== 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  };

  const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) => startA < endB && endA > startB;

  const slotAppliesToDate = (slot: AvailabilitySlot, targetDate: Date) => {
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    if (slot.date) return String(slot.date).slice(0, 10) === dateStr;
    if (slot.day_of_week) return slot.day_of_week.toLowerCase() === format(targetDate, 'EEEE').toLowerCase();
    return false;
  };

  const getAvailabilitySlotsForDate = (targetDate: Date, status?: AvailabilitySlot['status']) => availabilitySlots
    .filter((slot) => slotAppliesToDate(slot, targetDate))
    .filter((slot) => (status ? slot.status === status : true))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const isShootCompatibleWithDate = (shoot: DashboardShootSummary, targetDate: Date) => {
    const shootDate = parseShootDate(shoot);
    if (!shootDate || !isSameDay(shootDate, targetDate)) return false;
    const shootStart = timeToMinutes(getDashboardShootDisplayTime(shoot));
    if (shootStart === null) return false;
    const shootEnd = shootStart + 120;
    return getAvailabilitySlotsForDate(targetDate, 'available').some((slot) => {
      const slotStart = timeToMinutes(slot.start_time);
      const slotEnd = timeToMinutes(slot.end_time);
      return slotStart !== null && slotEnd !== null && rangesOverlap(shootStart, shootEnd, slotStart, slotEnd);
    });
  };

  // Fetch availability and shoots when modal opens
  useEffect(() => {
    if (!isOpen || !photographer) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        // Fetch availability
        const availabilityRes = await fetch(API_ROUTES.photographerAvailability.list(photographer.id), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        if (availabilityRes.ok) {
          const availabilityData = await availabilityRes.json();
          const slots = availabilityData?.data || [];
          setAvailabilitySlots(slots);
          console.log('Fetched availability slots:', slots.length, slots);
          
          // Dispatch event to sync with availability page
          window.dispatchEvent(new CustomEvent('availability-updated', {
            detail: { photographerId: String(photographer.id) }
          }));
        } else {
          console.error('Failed to fetch availability:', availabilityRes.status, availabilityRes.statusText);
        }

        // Fetch dashboard overview for shoots (normalized, includes workflow shoots)
        const dashboardData = await fetchDashboardOverview(token || undefined);
        const rawShoots = dashboardData?.upcomingShoots ?? [];

        console.log('Fetched shoots:', rawShoots.length, rawShoots);

        const sortedShoots = [...rawShoots].sort((a, b) => {
          const aDate = parseShootDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bDate = parseShootDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aDate - bDate;
        });

        // Get photographer's assigned scheduled shoots (all, not just today)
        const assignedShoots = sortedShoots.filter((shoot) => shoot.photographer?.id === photographer.id && isAssignableShoot(shoot));
        setPhotographerSchedule(assignedShoots);
        console.log('Assigned shoots:', assignedShoots.length);

        // Filter shoots that need assignment or can be reassigned
        const mappedShoots = sortedShoots.filter((shoot) => isAssignableShoot(shoot) && (!shoot.photographer?.id || shoot.photographer.id !== photographer.id));
        setUpcomingShoots(mappedShoots);
        console.log('Assignable shoots:', mappedShoots.length);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load photographer data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // The fetched data (availability list + dashboard overview) does not depend on
    // `selectedDate` — only the memoized timeline rendering does. Including it here
    // would retrigger a full network round-trip every time the date picker changes.
  }, [isOpen, photographer, toast]);

  const handleAssignPhotographer = async (shootId: number) => {
    if (!photographer) return;
    
    setAssigning(shootId);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shootId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ photographer_id: photographer.id }),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null);
        throw new Error(errorPayload?.message || errorPayload?.error || 'Failed to assign photographer');
      }

      const shoot = upcomingShoots.find(s => s.id === shootId);
      toast({
        title: 'Success',
        description: `${photographer.name} assigned to ${shoot?.addressLine || 'shoot'} at ${shoot?.timeLabel || 'scheduled time'}`,
      });

      // Remove from list and add to schedule immediately for UI feedback
      setUpcomingShoots(prev => prev.filter(s => s.id !== shootId));
      if (shoot) {
        setPhotographerSchedule(prev => [...prev, {
          ...shoot,
          photographer: {
            id: photographer.id,
            name: photographer.name,
            avatar: photographer.avatar,
          },
        }]);
      }

      // Refresh availability and shoots data from API (reuse existing token)
      
      // Refresh availability
      try {
        const availabilityRes = await fetch(API_ROUTES.photographerAvailability.list(photographer.id), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });
        if (availabilityRes.ok) {
          const availabilityData = await availabilityRes.json();
          const slots = availabilityData?.data || [];
          setAvailabilitySlots(slots);
          console.log('Refreshed - Availability slots:', slots.length);
          
          // Dispatch custom event to notify availability page to refresh
          // Convert to string to match availability page format
          window.dispatchEvent(new CustomEvent('availability-updated', {
            detail: { photographerId: String(photographer.id) }
          }));
        }
      } catch (err) {
        console.error('Error refreshing availability:', err);
      }

      // Refresh shoots
      try {
        const dashboardData = await fetchDashboardOverview(token || undefined);
        const rawShoots = dashboardData?.upcomingShoots ?? [];

        const sortedShoots = [...rawShoots].sort((a, b) => {
          const aDate = parseShootDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const bDate = parseShootDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return aDate - bDate;
        });

        const assignedShoots = sortedShoots.filter((s) => s.photographer?.id === photographer.id && isAssignableShoot(s));
        setPhotographerSchedule(assignedShoots);
        console.log('Refreshed - Assigned shoots:', assignedShoots.length);

        const mappedShoots = sortedShoots.filter((s) => isAssignableShoot(s) && (!s.photographer?.id || s.photographer.id !== photographer.id));
        setUpcomingShoots(mappedShoots);
        console.log('Refreshed - Assignable shoots:', mappedShoots.length);
      } catch (err) {
        console.error('Error refreshing shoots:', err);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign photographer',
        variant: 'destructive',
      });
    } finally {
      setAssigning(null);
    }
  };

  const timelineSlots = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const slots: TimelineSlot[] = [];
    const hours = Array.from({ length: 13 }, (_, i) => i + 7);
    const bookedShoots = photographerSchedule.filter((shoot) => {
      const shootDate = parseShootDate(shoot);
      return shootDate ? isSameDay(shootDate, selectedDate) : false;
    });
    const availableSlots = getAvailabilitySlotsForDate(selectedDate, 'available');
    const bookedSlots = getAvailabilitySlotsForDate(selectedDate, 'booked');

    for (let i = 0; i < hours.length - 1; i++) {
      const startHour = hours[i];
      const endHour = hours[i + 1];
      const startTime = `${String(startHour).padStart(2, '0')}:00`;
      const endTime = `${String(endHour).padStart(2, '0')}:00`;
      const slotStartMinutes = startHour * 60;
      const slotEndMinutes = endHour * 60;

      const bookedShoot = bookedShoots.find(shoot => {
        const shootStart = timeToMinutes(getDashboardShootDisplayTime(shoot));
        if (shootStart === null) return false;
        return rangesOverlap(slotStartMinutes, slotEndMinutes, shootStart, shootStart + 120);
      });

      const bookedSlot = bookedSlots.find(slot => {
        const slotStart = timeToMinutes(slot.start_time);
        const slotEnd = timeToMinutes(slot.end_time);
        return slotStart !== null && slotEnd !== null && rangesOverlap(slotStartMinutes, slotEndMinutes, slotStart, slotEnd);
      });

      const availableSlot = availableSlots.find(slot => {
        const slotStart = timeToMinutes(slot.start_time);
        const slotEnd = timeToMinutes(slot.end_time);
        return slotStart !== null && slotEnd !== null && rangesOverlap(slotStartMinutes, slotEndMinutes, slotStart, slotEnd);
      });

      const isPastTime = isPast(parseISO(`${dateStr}T${endTime}`));
      const isBooked = bookedShoot || bookedSlot;
      slots.push({
        start: startTime,
        end: endTime,
        status: isPastTime ? 'past' : isBooked ? 'booked' : availableSlot ? 'available' : 'unavailable',
        shoot: bookedShoot ? {
          id: bookedShoot.id,
          address: bookedShoot.addressLine,
          client: bookedShoot.clientName || 'Client TBD',
          time: formatTimeForDisplay(getDashboardShootDisplayTime(bookedShoot)),
        } : undefined,
      });
    }

    return slots;
  }, [selectedDate, availabilitySlots, photographerSchedule]);

  const nextAvailability = useMemo(() => {
    for (let i = 0; i <= 14; i++) {
      const checkDate = addDays(new Date(), i);
      const daySlots = getAvailabilitySlotsForDate(checkDate, 'available');
      if (daySlots.length > 0) {
        const sorted = [...daySlots].sort((a, b) => a.start_time.localeCompare(b.start_time));
        return {
          date: isToday(checkDate) ? 'Today' : isTomorrow(checkDate) ? 'Tomorrow' : format(checkDate, 'MMM d'),
          time: `${formatSlotTime(sorted[0].start_time)} - ${formatSlotTime(sorted[0].end_time)}`,
          slot: sorted[0],
        };
      }
    }
    return null;
  }, [availabilitySlots]);

  const filteredShoots = useMemo(() => {
    let filtered = upcomingShoots;

    if (filterType === 'compatible') {
      filtered = filtered.filter(shoot => {
        const shootDate = parseShootDate(shoot);
        return shootDate ? isShootCompatibleWithDate(shoot, shootDate) : false;
      });
    }

    return filtered;
  }, [upcomingShoots, filterType, availabilitySlots]);

  const upcomingDaysSummary = useMemo(() => {
    const summary = [];
    for (let i = 1; i <= 3; i++) {
      const checkDate = addDays(selectedDate, i);
      const daySlots = getAvailabilitySlotsForDate(checkDate, 'available');
      summary.push({
        date: checkDate,
        label: isTomorrow(checkDate) ? 'Tomorrow' : format(checkDate, 'EEE'),
        slots: daySlots.length,
        fullyBooked: daySlots.length === 0,
      });
    }
    return summary;
  }, [selectedDate, availabilitySlots]);

  if (!photographer) return null;

  const AssignRoot: ElementType = isMobile ? Drawer : Dialog;
  const AssignContent: ElementType = isMobile ? DrawerContent : DialogContent;
  const AssignHeader: ElementType = isMobile ? DrawerHeader : DialogHeader;
  const AssignTitle: ElementType = isMobile ? DrawerTitle : DialogTitle;
  const AssignDescription: ElementType = isMobile ? DrawerDescription : DialogDescription;
  const handleOpenChange = (open: boolean) => {
    if (!open) closeModal();
  };

  const statusColors = {
    free: 'bg-emerald-500',
    busy: 'bg-amber-500',
    editing: 'bg-sky-500',
    offline: 'bg-muted-foreground/40',
  };

  const statusLabels = {
    free: 'Online',
    busy: 'On shoot',
    editing: 'Editing',
    offline: 'Offline',
  };

  const selectedDateAssignedShoots = photographerSchedule.filter((shoot) => {
    const shootDate = parseShootDate(shoot);
    return shootDate ? isSameDay(shootDate, selectedDate) : false;
  });
  const selectedDateAvailableSlots = getAvailabilitySlotsForDate(selectedDate, 'available');
  const selectedDateLabel = isToday(selectedDate)
    ? 'Today'
    : isTomorrow(selectedDate)
      ? 'Tomorrow'
      : format(selectedDate, 'MMM d');

  return (
    <AssignRoot
      {...(isMobile ? { shouldScaleBackground: false } : {})}
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <AssignContent
        className={
          isMobile
            ? 'z-[190] flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-border bg-background p-0'
            : 'flex h-auto max-h-[90vh] w-[92vw] max-w-[1100px] flex-col gap-0 overflow-hidden rounded-lg p-0'
        }
      >
        {isMobile ? (
          <AssignHeader className="relative shrink-0 space-y-0.5 border-b px-4 pb-2 pt-1 text-left">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-0.5 h-8 w-8 rounded-full"
              onClick={() => handleOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
            <AssignTitle className="pr-10 text-base font-semibold">
              Assign {photographer.name.split(' ')[0]}
            </AssignTitle>
            <AssignDescription className="text-[11px] text-muted-foreground">
              Pick a date, review availability, assign a shoot
            </AssignDescription>
          </AssignHeader>
        ) : (
          <AssignHeader className="sr-only">
            <AssignTitle>Assign Photographer</AssignTitle>
            <AssignDescription>
              Assign a photographer to a shoot and view their availability schedule
            </AssignDescription>
          </AssignHeader>
        )}
        {/* Date controls — toolbar on desktop; compact strip under drawer title on mobile */}
        <div className="flex shrink-0 items-center gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-6 sm:pb-4 sm:pt-6">
          {!isMobile && <h2 className="text-2xl font-bold">Assign Photographer</h2>}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:ml-auto sm:flex-none sm:gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs sm:h-9 sm:gap-2 sm:px-3 sm:text-sm">
                  <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="font-medium">
                    {isToday(selectedDate) ? 'Today' : isTomorrow(selectedDate) ? 'Tomorrow' : format(selectedDate, 'EEE, MMM d')}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <div className="ml-auto flex items-center gap-0.5 sm:ml-0 sm:gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={() => setSelectedDate(prev => addDays(prev, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-xs sm:h-8 sm:px-2"
                onClick={() => setSelectedDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={() => setSelectedDate(prev => addDays(prev, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <Info className="h-3 w-3" />
              <span>Changes sync automatically</span>
            </div>
          </div>
        </div>

        <div
          className={
            isMobile
              ? 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain'
              : 'flex min-h-0 flex-1 flex-row overflow-hidden'
          }
        >
          {/* Left Column - Photographer Summary + Availability (35%) */}
          <div className={isMobile ? 'flex w-full flex-col bg-muted/20' : 'flex w-[35%] flex-col border-r border-border bg-muted/20'}>
            <div className={isMobile ? 'space-y-3 p-3' : 'flex-1 space-y-6 overflow-y-auto p-6'}>
              {/* Identity Block */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-start gap-2.5 sm:gap-4">
                  <Avatar
                    src={photographer.avatar}
                    initials={getInitials(photographer.name)}
                    className="h-10 w-10 sm:h-16 sm:w-16"
                    status={photographer.status}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2 sm:mb-1">
                      <h3 className="truncate text-sm font-semibold text-foreground sm:text-lg">{photographer.name}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs px-2 py-0.5',
                          photographer.status === 'free' && 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400',
                          photographer.status === 'busy' && 'border-amber-500/50 text-amber-700 dark:text-amber-400',
                          photographer.status === 'editing' && 'border-sky-500/50 text-sky-700 dark:text-sky-400',
                          photographer.status === 'offline' && 'border-muted-foreground/50 text-muted-foreground',
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 inline-block', statusColors[photographer.status])} />
                        {statusLabels[photographer.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{photographer.region}</p>
                  </div>
                </div>
              </div>

              {/* Metrics Strip */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                <div className="rounded-lg border bg-card p-2 sm:p-3">
                  <p className="mb-0.5 text-[10px] text-muted-foreground sm:mb-1 sm:text-xs">Jobs on {selectedDateLabel}</p>
                  <p className="text-lg font-semibold sm:text-xl">{selectedDateAssignedShoots.length}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1">{photographer.loadToday} scheduled today</p>
                </div>
                <div className="rounded-lg border bg-card p-2 sm:p-3">
                  <p className="mb-0.5 text-[10px] text-muted-foreground sm:mb-1 sm:text-xs">Available windows</p>
                  {nextAvailability ? (
                    <>
                      <p className="text-lg font-semibold">{selectedDateAvailableSlots.length}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Next: {nextAvailability.date} · {nextAvailability.time.split(' - ')[0]}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-semibold">0</p>
                      <p className="text-[10px] text-muted-foreground mt-1">No availability loaded</p>
                    </>
                  )}
                </div>
              </div>

              {/* Availability Timeline - MOVED TO LEFT */}
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold sm:mb-3 sm:gap-2 sm:text-sm">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {selectedDateLabel} timeline
                </h4>
                <PhotographerAvailabilityTimeline
                  className="mb-2 sm:mb-3"
                  availableSlots={getAvailabilitySlotsForDate(selectedDate, 'available')}
                  bookedSlots={getAvailabilitySlotsForDate(selectedDate, 'booked')}
                  unavailableSlots={getAvailabilitySlotsForDate(selectedDate, 'unavailable')}
                  loadingHint={loading ? 'Loading availability...' : null}
                />
                {loading ? (
                  <div className="relative">
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 rounded-lg bg-muted" />
                      ))}
                    </div>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-10 w-10" label="Loading photographer availability" />
                    </div>
                  </div>
                ) : timelineSlots.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {timelineSlots.map((slot, idx) => (
                      <div
                        key={`${slot.start}-${idx}`}
                        className={cn(
                          'rounded-md border px-2 py-1.5 text-xs transition-all',
                          slot.status === 'available' && 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
                          slot.status === 'booked' && 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
                          slot.status === 'past' && 'bg-muted/50 border-border opacity-60',
                          slot.status === 'unavailable' && 'bg-muted/30 border-border',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium whitespace-nowrap">{formatSlotTime(slot.start)} - {formatSlotTime(slot.end)}</span>
                          <Badge
                            variant={slot.status === 'available' ? 'default' : 'secondary'}
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 whitespace-nowrap',
                              slot.status === 'available' && 'bg-emerald-500 text-white',
                              slot.status === 'booked' && 'bg-slate-600 text-white',
                            )}
                          >
                            {slot.status === 'available' ? 'Open' : slot.status === 'booked' ? 'Booked' : slot.status === 'past' ? 'Past' : 'Closed'}
                          </Badge>
                        </div>
                        {slot.shoot && (
                          <div className="mt-1 text-[10px] text-muted-foreground truncate">
                            {slot.shoot.client} · {slot.shoot.address}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border bg-muted/30 text-center">
                    <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs font-medium mb-1">Fully Booked</p>
                    <p className="text-[10px] text-muted-foreground mb-2">No availability for {isToday(selectedDate) ? 'today' : format(selectedDate, 'MMM d')}</p>
                    {nextAvailability && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          if (nextAvailability.slot.date) {
                            setSelectedDate(parseISO(nextAvailability.slot.date));
                          } else {
                            for (let i = 1; i <= 7; i++) {
                              const checkDate = addDays(new Date(), i);
                              const dayName = format(checkDate, 'EEEE').toLowerCase();
                              const daySlots = availabilitySlots.filter(slot => 
                                slot.day_of_week?.toLowerCase() === dayName && slot.status === 'available'
                              );
                              if (daySlots.length > 0) {
                                setSelectedDate(checkDate);
                                break;
                              }
                            }
                          }
                        }}
                      >
                        Jump to {nextAvailability.date}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Next Free Window */}
              {nextAvailability && (
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground mb-1">Next free window</p>
                  <p className="text-sm font-semibold">{nextAvailability.time}</p>
                  <p className="text-xs text-muted-foreground">{nextAvailability.date}</p>
                </div>
              )}

              {/* Upcoming Days Status */}
              {upcomingDaysSummary.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming days</p>
                  {upcomingDaysSummary.map((day) => (
                    <div key={format(day.date, 'yyyy-MM-dd')} className="p-2 rounded-lg border bg-card">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{day.label}</span>
                        <span className={cn(
                          'text-xs',
                          day.fullyBooked ? 'text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400'
                        )}>
                          {day.fullyBooked ? 'Fully booked' : `${day.slots} slot${day.slots !== 1 ? 's' : ''} free`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Contact & Actions */}
              <div className="space-y-1.5 border-t border-border pt-2 sm:space-y-2 sm:pt-4">
                {(photographer.phone || photographer.email) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {photographer.phone && (
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <a href={`tel:${photographer.phone}`}>
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </a>
                      </Button>
                    )}
                    {photographer.email && (
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <a href={`mailto:${photographer.email}`}>
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </a>
                      </Button>
                    )}
                  </div>
                )}
                <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                  <a href="/availability">
                    View full profile
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column - Assignable Shoots (65%) */}
          <div className={isMobile ? 'flex flex-col border-t border-border' : 'flex min-h-0 flex-1 flex-col'}>
            {/* Offline Warning */}
            {photographer.status === 'offline' && (
              <div className="mx-2.5 mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950/20 sm:mx-6 sm:mt-6 sm:p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Photographer is currently offline
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      You can still schedule them for future shoots.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className={isMobile ? 'p-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]' : 'flex-1 overflow-y-auto p-6'}>

              {/* Assignable Shoots List */}
              <div>
                <div className="mb-2 flex flex-col gap-1.5 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold sm:gap-2 sm:text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Assignable Shoots ({filteredShoots.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <Select value={filterType} onValueChange={(v) => setFilterType(v as 'all' | 'compatible')}>
                      <SelectTrigger className="w-full sm:w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="compatible">Compatible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {loading ? (
                  <div className="relative">
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-lg bg-muted" />
                      ))}
                    </div>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-10 w-10" label="Loading shoots" />
                    </div>
                  </div>
                ) : filteredShoots.length > 0 ? (
                  <div className="space-y-2 sm:space-y-3">
                    {filteredShoots.map((shoot) => {
                      const shootDate = parseShootDate(shoot);
                      const isCompatible = shootDate ? isShootCompatibleWithDate(shoot, shootDate) : false;
                      const isReassignment = Boolean(shoot.photographer?.id);
                      return (
                        <div
                          key={shoot.id}
                          className={cn(
                            "rounded-xl border bg-card p-3 transition-all hover:border-primary/40 sm:p-4",
                            isCompatible && "border-emerald-200 dark:border-emerald-900/70",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="gap-1 text-[11px]">
                                  <Calendar className="h-3 w-3" />
                                  {shootDate ? format(shootDate, 'EEE, MMM d') : shoot.dayLabel}
                                </Badge>
                                <Badge variant="outline" className="gap-1 text-[11px]">
                                  <Clock className="h-3 w-3" />
                                  {getDashboardShootDisplayTime(shoot) ? formatTimeForDisplay(getDashboardShootDisplayTime(shoot)) : 'Time TBD'}
                                </Badge>
                                {isReassignment && (
                                  <Badge variant="secondary" className="text-[11px]">
                                    Reassign from {shoot.photographer?.name}
                                  </Badge>
                                )}
                              </div>
                              <p className="mb-1 flex items-start gap-1.5 text-sm font-medium text-foreground">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span>{shoot.addressLine}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {shoot.clientName || 'Client TBD'}
                                {shoot.services.length > 0 && ` · ${shoot.services.map(service => service.label).join(', ')}`}
                              </p>
                            </div>
                            <Badge
                              variant={isCompatible ? 'default' : 'secondary'}
                              className={cn(
                                isCompatible && 'bg-emerald-500 text-white',
                              )}
                            >
                              {isCompatible ? 'Fits schedule' : 'Outside availability'}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAssignPhotographer(shoot.id)}
                            disabled={assigning !== null}
                            className="w-full"
                          >
                            {assigning === shoot.id ? (
                              <>
                                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" />
                                Assigning...
                              </>
                            ) : (
                              <>
                                {isReassignment ? 'Reassign' : 'Assign'} {photographer.name.split(' ')[0]}
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg border bg-muted/30 text-center">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium mb-1">
                      {filterType === 'compatible' ? 'No compatible scheduled shoots' : 'No assignable scheduled shoots'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {filterType === 'compatible'
                        ? 'Try All to include shoots outside this photographer’s availability windows.'
                        : 'All scheduled shoots are already assigned to this photographer or are no longer assignable.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </AssignContent>
    </AssignRoot>
  );
};
