// SchedulingForm.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { TimeSelect } from "@/components/ui/time-select";
import { format } from "date-fns";
import { MapPin, Calendar as CalendarIcon, User, Package, ChevronRight, Loader2, Search, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { to12Hour } from '@/utils/availabilityUtils';
import API_ROUTES from '@/lib/api';
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { getStateFullName } from '@/utils/stateUtils';

interface SchedulingFormProps {
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  time: string;
  setTime: React.Dispatch<React.SetStateAction<string>>;
  formErrors: Record<string, string>;
  setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSubmit: () => void;
  goBack: () => void;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  setAddress?: React.Dispatch<React.SetStateAction<string>>;
  setCity?: React.Dispatch<React.SetStateAction<string>>;
  setState?: React.Dispatch<React.SetStateAction<string>>;
  setZip?: React.Dispatch<React.SetStateAction<string>>;
  photographer?: string;
  photographers?: Array<{ id: string; name: string; avatar?: string }>;
  setPhotographer?: React.Dispatch<React.SetStateAction<string>>;
}

export const SchedulingForm: React.FC<SchedulingFormProps> = ({
  date,
  setDate,
  time,
  setTime,
  formErrors,
  setFormErrors,
  handleSubmit,
  goBack,
  address = '',
  city = '',
  state = '',
  zip = '',
  bedrooms = '',
  bathrooms = '',
  sqft = '',
  setAddress,
  setCity,
  setState,
  setZip,
  photographer = '',
  photographers = [],
  setPhotographer
}) => {
  const disabledDates = {
    before: new Date(),
  };
  const { toast } = useToast();
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [tempTime, setTempTime] = useState('');
  const [photographerDialogOpen, setPhotographerDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');
  const [showAllPhotographers, setShowAllPhotographers] = useState(false);
  const [photographersWithDistance, setPhotographersWithDistance] = useState<Array<{
    id: string;
    name: string;
    avatar?: string;
    distance?: number;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    distanceFrom?: 'home' | 'previous_shoot';
    previousShootId?: number;
    availabilitySlots?: Array<{ start_time: string; end_time: string }>;
    bookedSlots?: Array<{ shoot_id: number; start_time: string; end_time: string; title: string }>;
    netAvailableSlots?: Array<{ start_time: string; end_time: string }>;
    isAvailableAtTime?: boolean;
    hasAvailability?: boolean;
    shootsCountToday?: number;
  }>>([]);
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  const [photographerAvailability, setPhotographerAvailability] = useState<Map<string | number, {
    isAvailable: boolean;
    nextAvailableTimes: string[];
  }>>(new Map());
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  const onDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      const year = newDate.getFullYear();
      const month = newDate.getMonth();
      const day = newDate.getDate();
      const adjustedDate = new Date(year, month, day, 12, 0, 0); // Set to noon to avoid timezone issues
      setDate(adjustedDate);
    } else {
      setDate(undefined);
    }

    if (newDate && formErrors['date']) {
      const { date, ...rest } = formErrors;
      setFormErrors(rest);
    }
    setDateDialogOpen(false);
  };

  const onTimeChange = (newTime: string) => {
    // Store the time in temp state - will be saved when OK is clicked
    setTempTime(newTime);
  };

  const handleTimeDialogOpen = (open: boolean) => {
    if (open) {
      // Initialize temp time with current time when opening
      setTempTime(time || '');
    }
    setTimeDialogOpen(open);
  };

  const handleTimeConfirm = () => {
    if (tempTime) {
      setTime(tempTime);
      if (formErrors['time']) {
        const { time: _, ...rest } = formErrors;
        setFormErrors(rest);
      }
    }
    setTimeDialogOpen(false);
  };

  const handleGetCurrentLocation = () => {
    if (!setAddress || !setCity || !setState || !setZip) {
      toast({
        title: "Cannot update location",
        description: "The location update functionality is not available.",
        variant: "destructive",
      });
      return;
    }

    setIsLocationLoading(true);

    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive",
      });
      setIsLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );

          if (!response.ok) {
            throw new Error('Failed to fetch address');
          }

          const data = await response.json();

          setAddress(data.principalSubdivision ? `${data.street || ''} ${data.housenumber || ''}`.trim() : 'Address not found');
          setCity(data.city || data.locality || '');
          setState(data.principalSubdivision || '');
          setZip(data.postcode || '');

          toast({
            title: "Location detected",
            description: "Your current location has been filled in the form.",
            variant: "default",
          });
        } catch (error) {
          console.error('Error fetching location data:', error);
          toast({
            title: "Location detection failed",
            description: "Could not retrieve your current location details.",
            variant: "destructive",
          });
        } finally {
          setIsLocationLoading(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = "Could not detect your location.";

        if (error.code === 1) {
          errorMessage = "Location permission denied. Please enable location access.";
        } else if (error.code === 2) {
          errorMessage = "Location unavailable. Please try again later.";
        } else if (error.code === 3) {
          errorMessage = "Location request timed out. Please try again.";
        }

        toast({
          title: "Location error",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const selectedPhotographer = photographers.find(p => p.id === photographer);
  const fullAddress = address && city && state ? `${address}, ${city}, ${state}${zip ? ' ' + zip : ''}` : '';

  // Fetch comprehensive photographer data when booking location, photographers, date, or time change
  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();
    
    const fetchPhotographerData = async () => {
      if (!address || !city || !state || photographers.length === 0 || !date) {
        setPhotographersWithDistance(photographers.map(p => ({ ...p })));
        return;
      }

      // Create a unique key for this request to detect stale data
      const requestKey = `${format(date, 'yyyy-MM-dd')}-${time}-${address}`;
      
      setIsCalculatingDistances(true);
      // Clear old data when date/time changes
      setPhotographersWithDistance([]);
      setPhotographerAvailability(new Map());
      
      try {
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Use the new comprehensive endpoint
        const response = await fetch(API_ROUTES.photographerAvailability.forBooking, {
          method: 'POST',
          headers,
          signal: abortController.signal,
          body: JSON.stringify({
            date: format(date, 'yyyy-MM-dd'),
            time: time || undefined,
            shoot_address: address,
            shoot_city: city,
            shoot_state: state,
            shoot_zip: zip || '',
            photographer_ids: photographers.map(p => Number(p.id)),
          }),
        });
        
        if (isCancelled) return;

        if (!response.ok) {
          throw new Error('Failed to fetch photographer data');
        }

        const json = await response.json();
        const photographerData = json?.data || [];

        // First, show photographers immediately WITHOUT distance (fast)
        const initialPhotographers = photographerData.map((p: any) => {
          const photographer = photographers.find(ph => String(ph.id) === String(p.id));
          return {
            id: String(p.id),
            name: p.name || photographer?.name || '',
            avatar: photographer?.avatar,
            distance: undefined, // Will be calculated async
            address: p.origin_address?.address || '',
            city: p.origin_address?.city || '',
            state: p.origin_address?.state || '',
            zip: p.origin_address?.zip || '',
            distanceFrom: p.distance_from as 'home' | 'previous_shoot',
            previousShootId: p.previous_shoot_id,
            availabilitySlots: p.availability_slots,
            bookedSlots: p.booked_slots,
            netAvailableSlots: p.net_available_slots,
            isAvailableAtTime: p.is_available_at_time,
            hasAvailability: p.has_availability,
            shootsCountToday: p.shoots_count_today,
          };
        });

        setPhotographersWithDistance(initialPhotographers);
        setIsCalculatingDistances(false); // Show list immediately

        // Update availability map
        const availabilityMap = new Map<string | number, { isAvailable: boolean; nextAvailableTimes: string[] }>();
        initialPhotographers.forEach((p: any) => {
          const nextTimes = (p.netAvailableSlots || [])
            .slice(0, 3)
            .map((slot: any) => to12Hour(slot.start_time));
          
          availabilityMap.set(p.id, { isAvailable: p.isAvailableAtTime ?? false, nextAvailableTimes: nextTimes });
          availabilityMap.set(String(p.id), { isAvailable: p.isAvailableAtTime ?? false, nextAvailableTimes: nextTimes });
          availabilityMap.set(Number(p.id), { isAvailable: p.isAvailableAtTime ?? false, nextAvailableTimes: nextTimes });
        });
        setPhotographerAvailability(availabilityMap);
        setIsLoadingAvailability(false);

        // Then calculate distances asynchronously in background
        const bookingCoords = await getCoordinatesFromAddress(address, city, state, zip);
        if (!bookingCoords || isCancelled) return;

        // Calculate distances one by one and update state progressively
        for (const p of photographerData) {
          if (isCancelled) return; // Stop if cancelled
          if (p.origin_address?.address && p.origin_address?.city && p.origin_address?.state) {
            const originCoords = await getCoordinatesFromAddress(
              p.origin_address.address,
              p.origin_address.city,
              p.origin_address.state,
              p.origin_address.zip || ''
            );
            if (originCoords && !isCancelled) {
              const distance = calculateDistance(
                bookingCoords.lat,
                bookingCoords.lon,
                originCoords.lat,
                originCoords.lon
              );
              // Update this photographer's distance
              setPhotographersWithDistance(prev => 
                prev.map(ph => ph.id === String(p.id) ? { ...ph, distance } : ph)
              );
            }
          }
        }

      } catch (error: any) {
        if (error.name === 'AbortError' || isCancelled) return;
        console.error('Error fetching photographer data:', error);
        setPhotographersWithDistance(photographers.map(p => ({ ...p })));
        setIsCalculatingDistances(false);
      }
    };

    fetchPhotographerData();
    
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [address, city, state, zip, photographers, date, time]);

  // Filter and sort photographers
  const filteredAndSortedPhotographers = useMemo(() => {
    // When showAllPhotographers is true, use original photographers list (bypasses availability)
    let filtered = showAllPhotographers 
      ? photographers.map(p => {
          // Try to find enriched data from photographersWithDistance
          const enriched = photographersWithDistance.find(pwd => pwd.id === p.id);
          return enriched || { ...p };
        })
      : photographersWithDistance;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p as any).city?.toLowerCase().includes(query) ||
        (p as any).state?.toLowerCase().includes(query)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'distance') {
        const aDistance = (a as any).distance;
        const bDistance = (b as any).distance;
        if (aDistance === undefined && bDistance === undefined) return 0;
        if (aDistance === undefined) return 1;
        if (bDistance === undefined) return -1;
        return aDistance - bDistance;
      } else {
        return a.name.localeCompare(b.name);
      }
    });

    return sorted;
  }, [photographersWithDistance, photographers, searchQuery, sortBy, showAllPhotographers]);

  // NOTE: Removed redundant fetchAvailability useEffect that was calling a separate API
  // which didn't account for booked slots. The fetchPhotographerData above already 
  // calls the for-booking endpoint which returns correct is_available_at_time 
  // that accounts for existing bookings.
  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      <div className="grid grid-cols-1 gap-6">
        {/* Date Selection Section */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 space-y-2 border border-gray-100 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Date</h2>

          <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
            <DialogTrigger asChild>
              <div className={cn(
                "bg-gray-50 dark:bg-slate-800 rounded-lg p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border border-gray-100 dark:border-slate-700"
              )}>
                <div>
                  <p className="text-xl font-semibold text-slate-900 dark:text-white">
                    {date ? format(date, "MMMM d, yyyy") : "Select a date"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="rounded-lg p-2 text-blue-600 hover:bg-blue-600/10"
                >
                  <CalendarIcon size={28} />
                </Button>
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Select Date</DialogTitle>
                <DialogDescription>
                  Choose a date for the shoot
                </DialogDescription>
              </DialogHeader>
              <Calendar
                mode="single"
                selected={date}
                onSelect={onDateChange}
                disabled={disabledDates}
                className="border rounded-md bg-card p-3 pointer-events-auto"
              />
            </DialogContent>
          </Dialog>

          {formErrors['date'] && (
            <p className="text-sm font-medium text-destructive mt-1">{formErrors['date']}</p>
          )}
        </div>

        {/* Time Selection Section */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 space-y-2 border border-gray-100 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Time</h2>

          <Dialog open={timeDialogOpen} onOpenChange={handleTimeDialogOpen}>
            <DialogTrigger asChild>
              <div className={cn(
                "bg-gray-50 dark:bg-slate-800 rounded-lg p-4 flex justify-between items-center transition-colors border border-gray-100 dark:border-slate-700",
                date ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" : "opacity-60 cursor-not-allowed"
              )} onClick={() => {
                if (!date) {
                  toast({
                    title: "Select date first",
                    description: "Please choose a date before selecting time.",
                    variant: "destructive",
                  });
                  return;
                }
                setTimeDialogOpen(true);
              }}>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">{time || "Select a time"}</p>
                <Button
                  variant="ghost"
                  className="rounded-lg p-2 text-blue-600 hover:bg-blue-600/10"
                >
                  <Clock size={28} />
                </Button>
              </div>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md w-full">
              <DialogHeader>
                <DialogTitle>Select Time</DialogTitle>
                <DialogDescription>
                  Choose a time for the shoot
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 w-full flex justify-center">
                <TimeSelect
                  value={time}
                  onChange={onTimeChange}
                  startHour={6}
                  endHour={21}
                  interval={5}
                  placeholder="Select a time"
                  className="w-full"
                />
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" className="w-full" onClick={handleTimeConfirm}>
                  OK
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {formErrors['time'] && (
            <p className="text-sm font-medium text-destructive mt-1">{formErrors['time']}</p>
          )}
        </div>

        {/* Photographer Section */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 space-y-2 border border-gray-100 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Photographer</h2>

          <Dialog open={photographerDialogOpen} onOpenChange={setPhotographerDialogOpen}>
            <DialogTrigger asChild>
              <div
                className={cn(
                  "bg-gray-50 dark:bg-slate-800 rounded-lg p-4 flex justify-between items-center transition-colors border border-gray-100 dark:border-slate-700",
                  time ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" : "opacity-60 cursor-not-allowed"
                )}
                onClick={() => {
                  if (!time) {
                    toast({
                      title: "Select time first",
                      description: "Please choose a time before selecting a photographer.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setPhotographerDialogOpen(true);
                }}
              >
                <div className="flex items-center">
                  {selectedPhotographer ? (
                    <>
                      <Avatar className="h-12 w-12 mr-4">
                        <AvatarImage src={selectedPhotographer.avatar} alt={selectedPhotographer.name} />
                        <AvatarFallback>{selectedPhotographer.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xl font-semibold text-slate-900 dark:text-white">{selectedPhotographer.name}</span>
                    </>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">Select a photographer</span>
                  )}
                </div>
                <ChevronRight className="text-slate-400" size={24} />
              </div>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md w-full">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-100 dark:border-slate-800">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <DialogHeader>
                      <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">Select Photographer</DialogTitle>
                      <DialogDescription>
                        Choose a photographer for this shoot
                      </DialogDescription>
                    </DialogHeader>
                  </div>
                </div>

                {/* Search and Sort Controls */}
                <div className="space-y-3 mb-4">
                  {/* Search Field with Show All Button */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search photographers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant={showAllPhotographers ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowAllPhotographers(!showAllPhotographers)}
                      className="whitespace-nowrap"
                    >
                      {showAllPhotographers ? "Available" : "Show All"}
                    </Button>
                  </div>

                  {/* Sort Selector */}
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    <Select value={sortBy} onValueChange={(value: 'distance' | 'name') => setSortBy(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distance">Sort by Distance</SelectItem>
                        <SelectItem value="name">Sort by Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {/* Scrollable content area */}
                  <div className="pt-3 max-h-[48vh] overflow-y-auto pr-2">
                    {isCalculatingDistances ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Calculating distances...</span>
                      </div>
                    ) : isLoadingAvailability && date && time ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Checking availability...</span>
                      </div>
                    ) : filteredAndSortedPhotographers.length > 0 ? (
                      <div className="grid gap-3">
                        {filteredAndSortedPhotographers.map((photographerItem) => {
                          // Try multiple key formats to ensure we find the availability
                          const availability = 
                            photographerAvailability.get(photographerItem.id) ||
                            photographerAvailability.get(String(photographerItem.id)) ||
                            photographerAvailability.get(Number(photographerItem.id));
                          const isAvailable = availability?.isAvailable ?? false;
                          const nextTimes = availability?.nextAvailableTimes ?? [];
                          const showAvailability = date && time && !isLoadingAvailability;
                          
                          // Debug log for UI
                          if (showAvailability) {
                            console.debug('[UI Availability Display]', {
                              photographerId: photographerItem.id,
                              photographerIdType: typeof photographerItem.id,
                              photographerName: photographerItem.name,
                              selectedTime: time,
                              isAvailable,
                              nextTimes,
                              availabilityData: availability,
                              mapKeys: Array.from(photographerAvailability.keys()),
                              foundByDirectKey: photographerAvailability.has(photographerItem.id),
                              foundByStringKey: photographerAvailability.has(String(photographerItem.id)),
                              foundByNumberKey: photographerAvailability.has(Number(photographerItem.id))
                            });
                          }

                          return (
                            <div
                              key={photographerItem.id}
                              className={cn(
                                "p-3 bg-gray-50 dark:bg-slate-800 border rounded-xl transition-colors",
                                isAvailable
                                  ? "border-green-200 dark:border-green-800"
                                  : showAvailability && !isAvailable
                                  ? "border-orange-200 dark:border-orange-800"
                                  : "border-gray-100 dark:border-slate-700",
                                "hover:bg-gray-100 dark:hover:bg-slate-700"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <Avatar className="h-10 w-10 flex-shrink-0">
                                    <AvatarImage src={photographerItem.avatar} alt={photographerItem.name} />
                                    <AvatarFallback>{photographerItem.name?.charAt(0)}</AvatarFallback>
                                  </Avatar>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                        {photographerItem.name}
                                      </div>
                                      {showAvailability && (
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          {isAvailable ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div className="space-y-1.5">
                                      {/* Distance Info */}
                                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                                        {photographerItem.distance !== undefined ? (
                                          <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {photographerItem.distance.toFixed(1)} mi
                                            {photographerItem.distanceFrom === 'previous_shoot' && (
                                              <span className="text-blue-500 dark:text-blue-400">(from prev shoot)</span>
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">Distance unavailable</span>
                                        )}
                                        {photographerItem.shootsCountToday !== undefined && photographerItem.shootsCountToday > 0 && (
                                          <span className="text-blue-600 dark:text-blue-400">
                                            • {photographerItem.shootsCountToday} shoot{photographerItem.shootsCountToday > 1 ? 's' : ''} today
                                          </span>
                                        )}
                                      </div>

                                      {/* Booked Slots Info */}
                                      {photographerItem.bookedSlots && photographerItem.bookedSlots.length > 0 && (
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded px-2 py-1">
                                          <span className="font-medium">Booked:</span>{' '}
                                          {photographerItem.bookedSlots.map((slot, idx) => (
                                            <span key={idx}>
                                              {to12Hour(slot.start_time)}-{to12Hour(slot.end_time)}
                                              {idx < (photographerItem.bookedSlots?.length || 0) - 1 ? ', ' : ''}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Net Available Slots */}
                                      {photographerItem.netAvailableSlots && photographerItem.netAvailableSlots.length > 0 && (
                                        <div className="text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded px-2 py-1">
                                          <span className="font-medium">Available:</span>{' '}
                                          {photographerItem.netAvailableSlots.slice(0, 3).map((slot, idx) => (
                                            <span key={idx}>
                                              {to12Hour(slot.start_time)}-{to12Hour(slot.end_time)}
                                              {idx < Math.min((photographerItem.netAvailableSlots?.length || 0), 3) - 1 ? ', ' : ''}
                                            </span>
                                          ))}
                                          {(photographerItem.netAvailableSlots?.length || 0) > 3 && (
                                            <span className="text-muted-foreground"> +{(photographerItem.netAvailableSlots?.length || 0) - 3} more</span>
                                          )}
                                        </div>
                                      )}

                                      {/* Availability Status at Selected Time */}
                                      {showAvailability && (
                                        <div className="text-xs">
                                          {isAvailable ? (
                                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                              <CheckCircle2 className="h-3 w-3" />
                                              <span>Available at {time}</span>
                                            </div>
                                          ) : (photographerItem.netAvailableSlots && photographerItem.netAvailableSlots.length > 0) ? (
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                                <XCircle className="h-3 w-3" />
                                                <span>Not available at {time}</span>
                                              </div>
                                              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 ml-4">
                                                <Clock className="h-3 w-3" />
                                                <span>Available: {photographerItem.netAvailableSlots.slice(0, 2).map(s => `${to12Hour(s.start_time)}-${to12Hour(s.end_time)}`).join(', ')}</span>
                                              </div>
                                            </div>
                                          ) : !photographerItem.hasAvailability ? (
                                            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                              <XCircle className="h-3 w-3" />
                                              <span>No availability set</span>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                              <XCircle className="h-3 w-3" />
                                              <span>Fully booked</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (setPhotographer) {
                                        setPhotographer(photographerItem.id);
                                        setPhotographerDialogOpen(false);
                                      }
                                    }}
                                    className={cn(
                                      "px-3 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors",
                                      photographer === photographerItem.id
                                        ? "bg-blue-600 text-white hover:bg-blue-700"
                                        : showAvailability && !isAvailable
                                        ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                                        : "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600"
                                    )}
                                  >
                                    {photographer === photographerItem.id ? 'Selected' : 'Select'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                        {searchQuery 
                          ? 'No photographers found matching your search.' 
                          : showAllPhotographers 
                            ? 'No photographers found in the system.'
                            : (
                              <div className="space-y-2">
                                <p>No photographers available for the selected date and time.</p>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  onClick={() => setShowAllPhotographers(true)}
                                  className="text-blue-600"
                                >
                                  Show all photographers
                                </Button>
                              </div>
                            )
                        }
                      </div>
                    )}
                  </div>

                  {/* footer actions */}
                  <div className="pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <Button variant="ghost" onClick={() => setPhotographerDialogOpen(false)} className="w-full">
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          // if photographer selected, close; else toast
                          if (!photographer) {
                            toast({
                              title: "No photographer selected",
                              description: "Please select a photographer before continuing.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setPhotographerDialogOpen(false);
                        }}
                        className="w-full"
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>

          </Dialog>
        </div>

      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        className="w-full h-14 text-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
      >
        CONFIRM
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={goBack}
        className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      >
        Back
      </Button>
    </div>
  );
};
