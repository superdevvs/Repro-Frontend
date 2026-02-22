import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/dashboard/v2/SharedComponents';
import { usePhotographerAssignment } from '@/context/PhotographerAssignmentContext';
import { DashboardPhotographerSummary, DashboardShootSummary } from '@/types/dashboard';
import { API_ROUTES } from '@/lib/api';
import { API_BASE_URL } from '@/config/env';
import { fetchDashboardOverview } from '@/services/dashboardService';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isToday, isTomorrow, addDays, startOfDay, isPast, isFuture } from 'date-fns';
import { Phone, Mail, Calendar, Clock, CheckCircle2, AlertTriangle, MapPin, ExternalLink, ChevronRight, Info, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [filterType, setFilterType] = useState<'all' | 'compatible' | 'nearby' | 'same-client'>('all');

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

        // Get photographer's assigned shoots (all, not just today)
        const assignedShoots = rawShoots.filter((shoot) => shoot.photographer?.id === photographer.id);
        setPhotographerSchedule(assignedShoots);
        console.log('Assigned shoots:', assignedShoots.length);

        // Filter shoots that don't have a photographer or can be reassigned
        const mappedShoots = rawShoots.filter((shoot) => !shoot.photographer?.id || shoot.photographer.id !== photographer.id);
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
  }, [isOpen, photographer, selectedDate, toast]);

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

      if (!res.ok) throw new Error('Failed to assign photographer');

      const shoot = upcomingShoots.find(s => s.id === shootId);
      toast({
        title: 'Success',
        description: `${photographer.name} assigned to ${shoot?.addressLine || 'shoot'} at ${shoot?.timeLabel || 'scheduled time'}`,
      });

      // Remove from list and add to schedule immediately for UI feedback
      setUpcomingShoots(prev => prev.filter(s => s.id !== shootId));
      if (shoot) {
        setPhotographerSchedule(prev => [...prev, shoot]);
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

        const assignedShoots = rawShoots.filter((s) => s.photographer?.id === photographer.id);
        setPhotographerSchedule(assignedShoots);
        console.log('Refreshed - Assigned shoots:', assignedShoots.length);

        const mappedShoots = rawShoots.filter((s) => !s.photographer?.id || s.photographer.id !== photographer.id);
        setUpcomingShoots(mappedShoots);
        console.log('Refreshed - Assignable shoots:', mappedShoots.length);
      } catch (err) {
        console.error('Error refreshing shoots:', err);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign photographer',
        variant: 'destructive',
      });
    } finally {
      setAssigning(null);
    }
  };

  // Build timeline for selected date
  const timelineSlots = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayName = format(selectedDate, 'EEEE').toLowerCase();
    const slots: TimelineSlot[] = [];
    const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM to 7 PM

    // Get booked slots for this date
    const bookedShoots = photographerSchedule.filter(shoot => {
      if (isToday(selectedDate)) {
        // For today, check if shoot is scheduled for today
        return shoot.dayLabel?.toLowerCase().includes('today') || 
               shoot.dayLabel?.toLowerCase().includes(format(selectedDate, 'MMM d').toLowerCase());
      }
      // For other dates, check if dayLabel matches
      return shoot.dayLabel?.toLowerCase().includes(format(selectedDate, 'MMM d').toLowerCase());
    });

    // Get all slots (available and booked) for this date
    const allSlotsForDate = availabilitySlots.filter(slot => {
      // Show both available and booked slots
      if (slot.status !== 'available' && slot.status !== 'booked') return false;
      
      // Check specific date match
      if (slot.date) {
        return slot.date === dateStr;
      }
      // Check day of week match
      if (slot.day_of_week) {
        return slot.day_of_week.toLowerCase() === dayName;
      }
      return false;
    });

    // Separate available and booked slots
    const availableSlots = allSlotsForDate.filter(slot => slot.status === 'available');
    const bookedSlots = allSlotsForDate.filter(slot => slot.status === 'booked');
    
    // Timeline calculated for selected date

    // Build timeline
    for (let i = 0; i < hours.length - 1; i++) {
      const startHour = hours[i];
      const endHour = hours[i + 1];
      const startTime = `${String(startHour).padStart(2, '0')}:00`;
      const endTime = `${String(endHour).padStart(2, '0')}:00`;

      // Check if this slot is booked (from booked shoots or booked slots from API)
      const bookedShoot = bookedShoots.find(shoot => {
        const shootTime = shoot.startTime || shoot.timeLabel;
        if (!shootTime) return false;
        const [hour] = shootTime.split(':');
        return parseInt(hour) >= startHour && parseInt(hour) < endHour;
      });

      // Also check booked slots from API
      const bookedSlot = bookedSlots.find(slot => {
        const [slotStartHour] = slot.start_time.split(':');
        const [slotEndHour] = slot.end_time.split(':');
        // Check if this hour slot overlaps with booked slot
        return (parseInt(slotStartHour) < endHour && parseInt(slotEndHour) > startHour);
      });

      // Check if this slot is available
      const availableSlot = availableSlots.find(slot => {
        const [slotStartHour] = slot.start_time.split(':');
        return parseInt(slotStartHour) >= startHour && parseInt(slotStartHour) < endHour;
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
          time: bookedShoot.timeLabel || '',
        } : undefined,
      });
    }

    return slots;
  }, [selectedDate, availabilitySlots, photographerSchedule, isToday]);

  // Get next availability
  const nextAvailability = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todaySlots = availabilitySlots.filter(slot => 
      slot.date === today && slot.status === 'available'
    );
    if (todaySlots.length > 0) {
      const sorted = todaySlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
      return {
        date: 'Today',
        time: `${sorted[0].start_time} - ${sorted[0].end_time}`,
        slot: sorted[0],
      };
    }

    // Check next 7 days
    for (let i = 1; i <= 7; i++) {
      const checkDate = addDays(new Date(), i);
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const dayName = format(checkDate, 'EEEE').toLowerCase();
      const daySlots = availabilitySlots.filter(slot => {
        if (slot.date) return slot.date === dateStr && slot.status === 'available';
        if (slot.day_of_week) return slot.day_of_week.toLowerCase() === dayName && slot.status === 'available';
        return false;
      });
      if (daySlots.length > 0) {
        const sorted = daySlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
        return {
          date: isTomorrow(checkDate) ? 'Tomorrow' : format(checkDate, 'MMM d'),
          time: `${sorted[0].start_time} - ${sorted[0].end_time}`,
          slot: sorted[0],
        };
      }
    }
    return null;
  }, [availabilitySlots]);

  // Filter assignable shoots
  const filteredShoots = useMemo(() => {
    let filtered = upcomingShoots;

    // Don't filter by date - show all unassigned shoots
    // The user can see all available shoots and assign them regardless of the selected date

    if (filterType === 'compatible') {
      // Filter by compatible time slots (only if date is selected and has availability)
      if (timelineSlots.some(slot => slot.status === 'available')) {
        filtered = filtered.filter(shoot => {
          const shootTime = shoot.startTime || shoot.timeLabel;
          if (!shootTime) return true; // Include shoots without time
          return timelineSlots.some(slot => {
            if (slot.status !== 'available') return false;
            const [slotStart] = slot.start.split(':');
            const [shootHour] = shootTime.split(':');
            return Math.abs(parseInt(slotStart) - parseInt(shootHour)) <= 1;
          });
        });
      }
    }

    // Remove the showOnlyCompatible filter - show all shoots
    // if (showOnlyCompatible) {
    //   filtered = filtered.filter(shoot => {
    //     const shootTime = shoot.startTime || shoot.timeLabel;
    //     if (!shootTime) return false;
    //     return timelineSlots.some(slot => slot.status === 'available');
    //   });
    // }

    return filtered;
  }, [upcomingShoots, filterType, timelineSlots]);

  // Get today's schedule preview (3-4 items)
  const todaySchedulePreview = useMemo(() => {
    if (!isToday(selectedDate)) return [];
    return photographerSchedule
      .filter(shoot => shoot.timeLabel)
      .sort((a, b) => {
        const timeA = a.startTime || a.timeLabel || '';
        const timeB = b.startTime || b.timeLabel || '';
        return timeA.localeCompare(timeB);
      })
      .slice(0, 4);
  }, [selectedDate, photographerSchedule]);

  // Get upcoming days summary
  const upcomingDaysSummary = useMemo(() => {
    const summary = [];
    for (let i = 1; i <= 3; i++) {
      const checkDate = addDays(selectedDate, i);
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const dayName = format(checkDate, 'EEEE').toLowerCase();
      const daySlots = availabilitySlots.filter(slot => {
        if (slot.date) return slot.date === dateStr && slot.status === 'available';
        if (slot.day_of_week) return slot.day_of_week.toLowerCase() === dayName && slot.status === 'available';
        return false;
      });
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

  return (
    <Dialog open={isOpen} onOpenChange={closeModal}>
      <DialogContent className="w-screen h-[100dvh] max-w-none rounded-none overflow-hidden flex flex-col p-0 sm:max-w-[1100px] sm:max-h-[90vh] sm:h-auto sm:rounded-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Assign Photographer</DialogTitle>
          <DialogDescription>
            Assign a photographer to a shoot and view their availability schedule
          </DialogDescription>
        </DialogHeader>
        {/* Top Bar */}
        <div className="px-3 sm:px-6 pt-3 sm:pt-6 pb-3 sm:pb-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base sm:text-2xl font-bold">Assign Photographer</h2>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 sm:h-9 flex items-center gap-2 text-xs sm:text-sm">
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
            <div className="flex items-center gap-1 ml-auto sm:ml-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedDate(prev => addDays(prev, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setSelectedDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedDate(prev => addDays(prev, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>Changes sync automatically</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
          {/* Left Column - Photographer Summary + Availability (35%) */}
          <div className="w-full sm:w-[35%] sm:border-r border-border flex flex-col bg-muted/20">
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
              {/* Identity Block */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 sm:gap-4">
                  <Avatar
                    src={photographer.avatar}
                    initials={photographer.name.split(' ').map(n => n[0]).join('')}
                    className="w-12 h-12 sm:w-16 sm:h-16"
                    status={photographer.status}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">{photographer.name}</h3>
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
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground mb-1">Jobs today</p>
                  <p className="text-xl font-semibold">{photographer.loadToday} / 5</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Daily capacity</p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground mb-1">Next availability</p>
                  {nextAvailability ? (
                    <>
                      <p className="text-lg font-semibold">{nextAvailability.time.split(' - ')[0]}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{nextAvailability.date}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No availability</p>
                  )}
                </div>
              </div>

              {/* Availability Timeline - MOVED TO LEFT */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Availability Timeline
                </h4>
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                    ))}
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
                          <span className="font-medium whitespace-nowrap">{slot.start} - {slot.end}</span>
                          <Badge
                            variant={slot.status === 'available' ? 'default' : 'secondary'}
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 whitespace-nowrap',
                              slot.status === 'available' && 'bg-emerald-500 text-white',
                              slot.status === 'booked' && 'bg-slate-600 text-white',
                            )}
                          >
                            {slot.status === 'available' ? 'Available' : slot.status === 'booked' ? 'Booked' : 'Unavailable'}
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
              <div className="pt-4 border-t border-border space-y-2">
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
          <div className="flex-1 flex flex-col min-h-0 border-t sm:border-t-0">
            {/* Offline Warning */}
            {photographer.status === 'offline' && (
              <div className="mx-3 sm:mx-6 mt-3 sm:mt-6 p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
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
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:pb-6">

              {/* Assignable Shoots List */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Assignable Shoots ({filteredShoots.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                      <SelectTrigger className="w-full sm:w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="compatible">Compatible</SelectItem>
                        <SelectItem value="nearby">Nearby</SelectItem>
                        <SelectItem value="same-client">Same client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : filteredShoots.length > 0 ? (
                  <div className="space-y-3">
                    {filteredShoots.map((shoot) => {
                      const isCompatible = timelineSlots.some(slot => slot.status === 'available');
                      return (
                        <div
                          key={shoot.id}
                          className="p-4 rounded-lg border bg-card hover:border-primary/40 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-base font-semibold">{shoot.timeLabel}</span>
                                <span className="text-xs text-muted-foreground">{shoot.dayLabel}</span>
                              </div>
                              <p className="text-sm font-medium text-foreground mb-1">{shoot.addressLine}</p>
                              <p className="text-xs text-muted-foreground">{shoot.clientName || 'Client TBD'}</p>
                            </div>
                            <Badge
                              variant={isCompatible ? 'default' : 'secondary'}
                              className={cn(
                                isCompatible && 'bg-emerald-500 text-white',
                              )}
                            >
                              {isCompatible ? 'Fits schedule' : 'Check compatibility'}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAssignPhotographer(shoot.id)}
                            disabled={assigning === shoot.id}
                            className="w-full"
                          >
                            {assigning === shoot.id ? (
                              'Assigning...'
                            ) : (
                              <>
                                Assign {photographer.name.split(' ')[0]}
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
                    <p className="text-sm font-medium mb-1">No shoots available</p>
                    <p className="text-xs text-muted-foreground">No shoots match this photographer for the selected date.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


