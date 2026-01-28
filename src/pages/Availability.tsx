import React, { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, getDay, isSameMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarIcon,
  Clock,
  Plus,
  X,
  User,
  Users,
  ChevronDown,
  AlertCircle,
  Edit,
  Save,
  Search,
  LayoutGrid,
  LayoutList,
  MoreVertical,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { addDays, isSameWeek } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { TimeSelect } from "@/components/ui/time-select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import API_ROUTES from "@/lib/api";
import { API_BASE_URL } from "@/config/env";
import { cn } from "@/lib/utils";
import { CalendarSyncModal } from "@/components/availability/CalendarSyncModal";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { useShoots } from "@/context/ShootsContext";
import type { ShootData } from "@/types/shoots";

import { PhotographerList } from "@/components/availability/PhotographerList";
import { ShootDetailsModal } from "@/components/shoots/ShootDetailsModal";

type Photographer = { id: string; name: string; avatar?: string };

type AvailabilityStatus = "available" | "booked" | "unavailable";

interface Availability {
  id: string;
  photographerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
  shootTitle?: string;
  origin?: 'specific' | 'weekly';
  isRandom?: boolean;
  shoot_id?: number;
  shootDetails?: ShootDetails;
}

interface WeeklyScheduleItem {
  day: string;
  active: boolean;
  startTime: string;
  endTime: string;
}

interface ShootDetails {
  id: number;
  title: string;
  address?: string;
  shoot_status: string;
  client?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  services?: Array<{
    id: number;
    name: string;
    price: number;
  }>;
  notes?: string;
  duration_minutes?: number;
}

type BackendSlot = {
  id: number | string;
  photographer_id: number;
  date?: string | null;
  day_of_week?: string | null;
  start_time: string;
  end_time: string;
  status?: string;
  isRandom?: boolean;
  shoot_id?: number;
  shoot_details?: ShootDetails;
};

const normalizePhotographerNumericId = (id: string) => {
  const parsed = Number(id);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return Math.abs(
    id.split('').reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0)
  );
};

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const mapBackendSlots = (data: any[], photographerId: string): BackendSlot[] => {
  const normalizedId = normalizePhotographerNumericId(photographerId);
  return (data || []).map((row, index) => ({
    id:
      typeof row.id === "number"
        ? row.id
        : Number(`${normalizedId}${index}${randomInt(100, 999)}`),
    photographer_id: row.photographer_id ?? normalizedId,
    date: row.date ?? null,
    day_of_week: row.day_of_week ?? null,
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.status,
  }));
};

const createRandomAvailabilitySlots = (photographerId: string): BackendSlot[] => {
  const normalizedId = normalizePhotographerNumericId(photographerId);
  const slots: BackendSlot[] = [];
  const baseDate = new Date();
  const timeString = (hour: number, minute: number) =>
    `${String(hour).padStart(2, "0")}:${minute === 0 ? "00" : "30"}`;

  const dailySlots = randomInt(5, 9);
  for (let i = 0; i < dailySlots; i++) {
    const dayOffset = randomInt(0, 20);
    const slotDate = addDays(baseDate, dayOffset);
    const startHour = randomInt(8, 14);
    const duration = randomInt(2, 4);
    const endHour = Math.min(startHour + duration, 19);
    const startMinute = randomInt(0, 1) * 30;
    const statusRoll = Math.random();
    const status =
      statusRoll > 0.85 ? "booked" : statusRoll > 0.7 ? "unavailable" : "available";

    slots.push({
      id: Number(`${normalizedId}${dayOffset}${i}${randomInt(100, 999)}`),
      photographer_id: normalizedId,
      date: format(slotDate, "yyyy-MM-dd"),
      day_of_week: null,
      start_time: timeString(startHour, startMinute),
      end_time: timeString(endHour, startMinute),
      status,
      isRandom: true,
    });
  }

  const weeklyDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const weeklyCount = randomInt(2, 4);
  const shuffledDays = [...weeklyDays].sort(() => Math.random() - 0.5);
  for (let i = 0; i < weeklyCount; i++) {
    const dayName = shuffledDays[i];
    const startHour = randomInt(9, 13);
    const endHour = Math.min(startHour + 4, 19);
    slots.push({
      id: Number(`${normalizedId}99${i}${randomInt(100, 999)}`),
      photographer_id: normalizedId,
      date: null,
      day_of_week: dayName,
      start_time: `${String(startHour).padStart(2, "0")}:00`,
      end_time: `${String(endHour).padStart(2, "0")}:00`,
      status: "available",
      isRandom: true,
    });
  }

  return slots;
};

export default function Availability() {
  const isMobile = useIsMobile();
  const [date, setDate] = useState<Date | undefined>(new Date()); // Auto-select current date
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [backendSlots, setBackendSlots] = useState<BackendSlot[]>([]);
  const [allBackendSlots, setAllBackendSlots] = useState<BackendSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPhotographers, setLoadingPhotographers] = useState(true);
  const randomAvailabilityCacheRef = React.useRef<Record<string, BackendSlot[]>>({});
  const bookedSlotsCacheRef = React.useRef<Map<string, BackendSlot[]>>(new Map());
  const bulkAvailabilityCacheRef = React.useRef<{ key: string; data: BackendSlot[]; timestamp: number } | null>(null);
  const [selectedPhotographer, setSelectedPhotographer] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [mobileTab, setMobileTab] = useState<"calendar" | "details">("calendar");
  const [isPhotographerSheetOpen, setIsPhotographerSheetOpen] = useState(false);
  const [editingWeeklySchedule, setEditingWeeklySchedule] = useState(false);
  const [weeklyScheduleNote, setWeeklyScheduleNote] = useState("");
  const [editingAvailability, setEditingAvailability] = useState<string | null>(null);
  const [editedAvailability, setEditedAvailability] = useState<Partial<Availability>>({});
    const [isWeeklyScheduleDialogOpen, setIsWeeklyScheduleDialogOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [expandedBookingDetails, setExpandedBookingDetails] = useState<Set<string>>(new Set());
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [shootDetailsModalOpen, setShootDetailsModalOpen] = useState(false);
  const [selectedShootId, setSelectedShootId] = useState<number | null>(null);
  const [rightClickedDate, setRightClickedDate] = useState<Date | null>(null);
  const [rightClickedTime, setRightClickedTime] = useState<string | null>(null);
  const [newAvailability, setNewAvailability] = useState<Partial<Availability>>({
    status: "available",
    startTime: "09:00",
    endTime: "17:00"
  });
  const [newWeeklySchedule, setNewWeeklySchedule] = useState({
    startTime: "09:00",
    endTime: "17:00",
    status: "available" as AvailabilityStatus,
    days: [true, true, true, true, true, false, false] as boolean[], // Mon-Fri by default
    recurring: true,
    note: ""
  });
  const dayViewScrollRef = React.useRef<HTMLDivElement>(null);
  const dayViewTimeScrollRef = React.useRef<HTMLDivElement>(null);
  const dayViewScrollChanging = React.useRef<boolean>(false);
  const dayViewScrollTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const dayViewLastChangeTime = React.useRef<number>(0);
  const dayViewIsProgrammaticScroll = React.useRef<boolean>(false);

  const { toast } = useToast();
  const { user, role } = useAuth();
  const { formatTime: formatTimePreference, preferences } = useUserPreferences();

  const isAdmin = role === 'admin' || role === 'superadmin';
  const isPhotographer = role === 'photographer';

  const authHeaders = () => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  };

  const uiTimeToHhmm = (t?: string): string => {
    if (!t) return "";
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      const [h, m] = t.split(":");
      return `${String(parseInt(h, 10)).padStart(2, '0')}:${m}`;
    }
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return t;
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const mer = m[3].toUpperCase();
    if (mer === 'PM' && hh !== 12) hh += 12;
    if (mer === 'AM' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${mm}`;
  };

  const ensureSlotsWithFallback = React.useCallback((photographerId: string, slots: BackendSlot[]) => {
    // Return actual slots only - no fake data generation
    return slots || [];
  }, []);

  const fetchBookedSlotsForDate = React.useCallback(
    async (photographerId: string | number, dateStr: string, headers: Record<string, string>) => {
      const cacheKey = `${photographerId}|${dateStr}`;
      if (bookedSlotsCacheRef.current.has(cacheKey)) {
        return bookedSlotsCacheRef.current.get(cacheKey) || [];
      }

      try {
        const response = await fetch(API_ROUTES.photographerAvailability.check, {
          method: "POST",
          headers,
          body: JSON.stringify({ photographer_id: photographerId, date: dateStr })
        });

        if (!response.ok) {
          bookedSlotsCacheRef.current.set(cacheKey, []);
          return [];
        }

        const json = await response.json();
        const booked = (json?.data || [])
          .filter((slot: any) => slot.status === 'booked')
          .map((slot: any) => ({
            ...slot,
            photographer_id: photographerId
          }));

        bookedSlotsCacheRef.current.set(cacheKey, booked);
        return booked;
      } catch (error) {
        bookedSlotsCacheRef.current.set(cacheKey, []);
        return [];
      }
    },
    []
  );

  const invalidatePhotographerBookedCache = React.useCallback((photographerId: string | number) => {
    const prefix = `${photographerId}|`;
    bookedSlotsCacheRef.current.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        bookedSlotsCacheRef.current.delete(key);
      }
    });
  }, []);

  const refreshPhotographerSlots = React.useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loading) return;
    
    setLoading(true);
    try {
      if (!selectedPhotographer) {
        setBackendSlots([]);
        setAllBackendSlots([]);
        setLoading(false);
        return;
      }

      const anchorDate = date || new Date();
      const weekStart = startOfWeek(anchorDate);
      const weekEnd = addDays(weekStart, 6);
      const monthStart = startOfMonth(anchorDate);
      const monthEnd = endOfMonth(anchorDate);
      
      // Calculate date range based on view mode
      const fromDate = viewMode === 'day' 
        ? format(anchorDate, 'yyyy-MM-dd')
        : viewMode === 'week'
        ? format(weekStart, 'yyyy-MM-dd')
        : format(monthStart, 'yyyy-MM-dd');
      
      const toDate = viewMode === 'day'
        ? format(anchorDate, 'yyyy-MM-dd')
        : viewMode === 'week'
        ? format(weekEnd, 'yyyy-MM-dd')
        : format(monthEnd, 'yyyy-MM-dd');

      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      if (selectedPhotographer === 'all') {
        if (!photographers || photographers.length === 0) {
          setAllBackendSlots([]);
          setBackendSlots([]);
          setLoading(false);
          return;
        }

        // Use bulk endpoint to fetch all photographers' availability in ONE call
        let usedBulkEndpoint = false;
        const CACHE_TTL = 60 * 1000; // 1 minute cache
        const cacheKey = `all_${fromDate}_${toDate}`;
        
        // Check cache first
        const cached = bulkAvailabilityCacheRef.current;
        if (cached && cached.key === cacheKey && (Date.now() - cached.timestamp) < CACHE_TTL) {
          setAllBackendSlots(cached.data);
          setBackendSlots([]);
          setLoading(false);
          return;
        }
        
        try {
          const photographerIds = photographers.map(p => Number(p.id));
          const bulkResponse = await fetch(API_ROUTES.photographerAvailability.bulkIndex, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              photographer_ids: photographerIds,
              from_date: fromDate,
              to_date: toDate,
            }),
          });

          if (bulkResponse.ok) {
            const bulkJson = await bulkResponse.json();
            const groupedData = bulkJson?.data || {};
            
            // Flatten grouped data into a single array
            const allSlots: BackendSlot[] = [];
            for (const [photographerId, slots] of Object.entries(groupedData)) {
              const mappedSlots = mapBackendSlots(slots as any[], photographerId);
              allSlots.push(...mappedSlots);
            }
            
            // Add fallback slots for ALL photographers (ensure everyone has data)
            const photographersWithData = new Set(Object.keys(groupedData).map(id => String(id)));
            photographers.forEach(p => {
              if (!photographersWithData.has(String(p.id))) {
                allSlots.push(...ensureSlotsWithFallback(String(p.id), []));
              }
            });
            
            // Cache the result
            bulkAvailabilityCacheRef.current = { key: cacheKey, data: allSlots, timestamp: Date.now() };
            
            setAllBackendSlots(allSlots);
            setBackendSlots([]);
            usedBulkEndpoint = true;
          }
        } catch (bulkError) {
          console.warn('Bulk endpoint failed, falling back to individual calls:', bulkError);
        }

        if (!usedBulkEndpoint) {
          // Fallback: individual API calls (for backwards compatibility)
          const batchSize = 10;
          const results: Array<{ id: string; slots: BackendSlot[] }> = [];
          
          for (let i = 0; i < photographers.length; i += batchSize) {
            const batch = photographers.slice(i, i + batchSize);
            const batchResults = await Promise.all(
              batch.map(async (p) => {
                try {
                  const response = await fetch(API_ROUTES.photographerAvailability.list(p.id));
                  if (!response.ok) throw new Error('Failed to load availability');
                  const json = await response.json();
                  return { id: p.id, slots: mapBackendSlots(json?.data || [], p.id) };
                } catch {
                  return { id: p.id, slots: [] as BackendSlot[] };
                }
              })
            );
            results.push(...batchResults);
          }
          
          const merged = results.flatMap(({ id, slots }) => ensureSlotsWithFallback(id, slots));
          setAllBackendSlots(merged);
          setBackendSlots([]);
        }
        
        setLoading(false);
        return;
      }

      // Single photographer selected - fetch availability and booked slots in parallel
      const [availabilityResponse, bookedResponse] = await Promise.all([
        fetch(API_ROUTES.photographerAvailability.list(selectedPhotographer)),
        fetch(API_ROUTES.photographerAvailability.bookedSlots, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            photographer_id: Number(selectedPhotographer),
            from_date: fromDate,
            to_date: toDate,
          }),
        }).catch(() => null), // Don't fail if booked slots endpoint fails
      ]);

      if (!availabilityResponse.ok) {
        throw new Error('Failed to load availability');
      }
      
      const availabilityJson = await availabilityResponse.json();
      const availabilitySlots = mapBackendSlots(availabilityJson?.data || [], selectedPhotographer);

      // Process booked slots with shoot details
      let bookedSlots: BackendSlot[] = [];
      if (bookedResponse && bookedResponse.ok) {
        const bookedJson = await bookedResponse.json();
        bookedSlots = (bookedJson?.data || []).map((slot: any) => ({
          ...slot,
          id: slot.id || `shoot_${slot.shoot_id}`,
          photographer_id: Number(selectedPhotographer),
        }));
      }

      // Merge availability and booked slots
      const allSlots = [...availabilitySlots, ...bookedSlots];
      setBackendSlots(ensureSlotsWithFallback(selectedPhotographer, allSlots));
      setAllBackendSlots([]);
      setLoading(false);
    } catch (error) {
      console.error('Error refreshing photographer slots:', error);
      if (selectedPhotographer === 'all') {
        if (!photographers || photographers.length === 0) {
          setAllBackendSlots([]);
          setBackendSlots([]);
        } else {
          const fallback = photographers.flatMap((p) => ensureSlotsWithFallback(p.id, []));
          setAllBackendSlots(fallback);
          setBackendSlots([]);
        }
      } else if (selectedPhotographer) {
        setBackendSlots(ensureSlotsWithFallback(selectedPhotographer, []));
        setAllBackendSlots([]);
      } else {
        setBackendSlots([]);
        setAllBackendSlots([]);
      }
      setLoading(false);
    }
  }, [selectedPhotographer, photographers, ensureSlotsWithFallback, date, viewMode, loading]);

  // Listen for availability updates from other components (e.g., PhotographerAssignmentModal)
  useEffect(() => {
    const handleAvailabilityUpdate = (event: CustomEvent) => {
      const { photographerId } = event.detail || {};
      // If the updated photographer is currently selected, refresh their slots
      if (photographerId) {
        invalidatePhotographerBookedCache(photographerId);
      }
      if (selectedPhotographer === photographerId || selectedPhotographer === 'all') {
        refreshPhotographerSlots();
      }
    };

    window.addEventListener('availability-updated', handleAvailabilityUpdate as EventListener);
    return () => {
      window.removeEventListener('availability-updated', handleAvailabilityUpdate as EventListener);
    };
  }, [selectedPhotographer, invalidatePhotographerBookedCache]); // refreshPhotographerSlots intentionally excluded

  // Load photographers with client-side caching
  useEffect(() => {
    // Check sessionStorage cache first
    const cachedPhotographers = sessionStorage.getItem('photographers_cache');
    const cacheTimestamp = sessionStorage.getItem('photographers_cache_time');
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
    if (cachedPhotographers && cacheTimestamp) {
      const cacheAge = Date.now() - parseInt(cacheTimestamp, 10);
      if (cacheAge < CACHE_TTL) {
        try {
          const list = JSON.parse(cachedPhotographers);
          setPhotographers(list);
          setLoadingPhotographers(false);
          return;
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }
    }
    
    setLoadingPhotographers(true);
    const publicUrl = (API_ROUTES as any)?.people?.photographers || `${API_BASE_URL}/api/photographers`;
    fetch(publicUrl)
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then(json => {
        const list = (json?.data || json || []).map((u: any) => ({
          id: String(u.id),
          name: u.name || u.email || `User ${u.id}`,
          avatar: u.avatar || u.profile_photo_url
        }));
        setPhotographers(list);
        setLoadingPhotographers(false);
        // Cache the result
        sessionStorage.setItem('photographers_cache', JSON.stringify(list));
        sessionStorage.setItem('photographers_cache_time', String(Date.now()));
      })
      .catch(() => {
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        if (!token) {
          setLoadingPhotographers(false);
          return;
        }
        const adminUrl = (API_ROUTES as any)?.people?.adminPhotographers || `${API_BASE_URL}/api/admin/photographers`;
        fetch(adminUrl, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => (r.ok ? r.json() : Promise.reject(r)))
          .then(json => {
            const list = (json?.data || json?.users || json || []).map((u: any) => ({
              id: String(u.id),
              name: u.name || u.full_name || u.email || `User ${u.id}`,
              avatar: u.avatar || u.profile_photo_url
            }));
            setPhotographers(list);
            setLoadingPhotographers(false);
            // Cache the result
            sessionStorage.setItem('photographers_cache', JSON.stringify(list));
            sessionStorage.setItem('photographers_cache_time', String(Date.now()));
          })
          .catch(() => {
            setLoadingPhotographers(false);
          });
      });
  }, []);

  // Auto-select photographer if user is photographer
  useEffect(() => {
    if (isPhotographer && user && selectedPhotographer === "all") {
      setSelectedPhotographer(String(user.id));
    }
  }, [isPhotographer, user, selectedPhotographer]);

  // Load slots when photographer or date changes (debounced)
  useEffect(() => {
    if (!selectedPhotographer || loadingPhotographers) return;
    
    const timeoutId = setTimeout(() => {
      refreshPhotographerSlots();
    }, 300); // Debounce by 300ms

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhotographer, date, currentMonth, viewMode, loadingPhotographers]); // loadingPhotographers added to trigger after photographers load

  const dateStr = useMemo(() => date ? format(date, 'yyyy-MM-dd') : undefined, [date]);
  const dayOfWeek = useMemo(() => date ? date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() : undefined, [date]);
  // Get time in 24-hour format (HH:MM) for calculations
  const toHhMm = (t?: string) => {
    if (!t) return '';
    // If already in AM/PM format, convert to 24-hour first
    if (t.includes('AM') || t.includes('PM')) {
      const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const period = match[3].toUpperCase();
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}:${minutes}`;
      }
    }
    return t.slice(0, 5); // Get HH:MM format
  };

  // Convert time to display format based on user preference
  const to12HourDisplay = (t?: string) => {
    if (!t) return '';
    // Use the user preference formatter
    return formatTimePreference(t);
  };

  // Check if a time slot overlaps with existing slots
  const checkTimeOverlap = (startTime: string, endTime: string, dateStr?: string, dayOfWeek?: string, excludeSlotId?: string): boolean => {
    const start = uiTimeToHhmm(startTime);
    const end = uiTimeToHhmm(endTime);

    if (!start || !end) return false;

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Get relevant slots to check against
    const rows = selectedPhotographer === 'all'
      ? allBackendSlots
      : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));

    // Filter slots based on date or day of week
    let relevantSlots = rows.filter(slot => {
      // Exclude the slot being edited
      if (excludeSlotId && String(slot.id) === excludeSlotId) return false;

      if (dateStr) {
        // For specific date slots, check exact date match
        // Also check weekly recurring slots that would apply to this date
        if (slot.date === dateStr) return true;

        // Check if this is a weekly slot that applies to this date
        if (!slot.date && slot.day_of_week && dayOfWeek) {
          return slot.day_of_week.toLowerCase() === dayOfWeek.toLowerCase();
        }

        return false;
      } else if (dayOfWeek) {
        // For weekly slots, check day of week match
        return !slot.date && slot.day_of_week?.toLowerCase() === dayOfWeek.toLowerCase();
      }
      return false;
    });

    // Check for overlap with any existing slot
    return relevantSlots.some(slot => {
      const slotStart = uiTimeToHhmm(slot.start_time);
      const slotEnd = uiTimeToHhmm(slot.end_time);

      if (!slotStart || !slotEnd) return false;

      const [slotStartH, slotStartM] = slotStart.split(':').map(Number);
      const [slotEndH, slotEndM] = slotEnd.split(':').map(Number);
      const slotStartMinutes = slotStartH * 60 + slotStartM;
      const slotEndMinutes = slotEndH * 60 + slotEndM;

      // Check if time ranges overlap
      // Two ranges overlap if: start1 < end2 && start2 < end1
      // But we need to handle edge cases: if one range ends exactly when another starts, they don't overlap
      // e.g., 09:00-12:00 and 12:00-17:00 should NOT overlap (they're adjacent)
      // Adjacent ranges (touching at boundaries) are allowed
      const isAdjacent = (startMinutes === slotEndMinutes) || (slotStartMinutes === endMinutes);
      if (isAdjacent) return false; // Adjacent ranges don't overlap

      // Check for actual overlap
      return startMinutes < slotEndMinutes && slotStartMinutes < endMinutes;
    });
  };

  const [photographerWeeklySchedules, setPhotographerWeeklySchedules] = useState<Record<string, WeeklyScheduleItem[]>>({});
  const [photographerAvailabilityMap, setPhotographerAvailabilityMap] = useState<Record<string, BackendSlot[]>>({});

  // Populate photographerAvailabilityMap from allBackendSlots when it changes
  useEffect(() => {
    if (allBackendSlots.length > 0) {
      const map: Record<string, BackendSlot[]> = {};
      allBackendSlots.forEach(slot => {
        const pid = String(slot.photographer_id);
        if (!map[pid]) map[pid] = [];
        map[pid].push(slot);
      });
      setPhotographerAvailabilityMap(map);
    }
  }, [allBackendSlots]);

  // Remove duplicate loading - refreshPhotographerSlots already handles this
  // This useEffect was causing duplicate API calls

  const getCurrentWeeklySchedule = () => {
    if (selectedPhotographer === "all") {
      return [
        { day: 'Mon', active: false, startTime: '9:00', endTime: '17:00' },
        { day: 'Tue', active: false, startTime: '9:00', endTime: '17:00' },
        { day: 'Wed', active: false, startTime: '9:00', endTime: '17:00' },
        { day: 'Thu', active: false, startTime: '9:00', endTime: '17:00' },
        { day: 'Fri', active: false, startTime: '9:00', endTime: '17:00' },
        { day: 'Sat', active: false, startTime: '10:00', endTime: '15:00' },
        { day: 'Sun', active: false, startTime: '10:00', endTime: '15:00' },
      ];
    }
    return photographerWeeklySchedules[selectedPhotographer] || [
      { day: 'Mon', active: false, startTime: '9:00', endTime: '17:00' },
      { day: 'Tue', active: false, startTime: '9:00', endTime: '17:00' },
      { day: 'Wed', active: false, startTime: '9:00', endTime: '17:00' },
      { day: 'Thu', active: false, startTime: '9:00', endTime: '17:00' },
      { day: 'Fri', active: false, startTime: '9:00', endTime: '17:00' },
      { day: 'Sat', active: false, startTime: '10:00', endTime: '15:00' },
      { day: 'Sun', active: false, startTime: '10:00', endTime: '15:00' },
    ];
  };

  const getSelectedDateAvailabilities = (): Availability[] => {
    if (!dateStr || !selectedPhotographer) return [];
    const rows = selectedPhotographer === 'all' ? allBackendSlots : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));

    // Get specific date slots (including booked slots)
    const specific = rows.filter(s => s.date === dateStr);

    // Get weekly recurring slots matching the day of week
    const weekly = rows.filter(s =>
      !s.date &&
      s.day_of_week &&
      s.day_of_week.toLowerCase() === dayOfWeek
    );

    // Separate booked slots from other specific slots
    const bookedSlots = specific.filter(s => s.status === 'booked');
    const nonBookedSpecific = specific.filter(s => s.status !== 'booked');
    
    // If there are non-booked specific slots, use those; otherwise use weekly recurring
    // Always include booked slots on top
    const availabilitySlots = nonBookedSpecific.length > 0 ? nonBookedSpecific : weekly;
    const allSlots = [...bookedSlots, ...availabilitySlots];

    return allSlots.map((s, idx): Availability => ({
      id: String(s.id ?? `${dateStr}-${idx}`),
      photographerId: String(s.photographer_id),
      date: dateStr,
      startTime: toHhMm(s.start_time),
      endTime: toHhMm(s.end_time),
      status: (s.status === 'unavailable' ? 'unavailable' : s.status === 'booked' ? 'booked' : 'available') as AvailabilityStatus,
      origin: specific.some(sp => sp.id === s.id) ? 'specific' : 'weekly',
      isRandom: Boolean(s.isRandom),
      shoot_id: s.shoot_id,
      shootDetails: s.shoot_details,
    }));
  };

  // Get availabilities for week view
  const getWeekAvailabilities = (): Availability[] => {
    if (!date || !selectedPhotographer) return [];
    const weekStart = startOfWeek(date);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const rows = selectedPhotographer === 'all' ? allBackendSlots : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));

    const weekSlots: Availability[] = [];
    weekDays.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const specific = rows.filter(s => s.date === dayStr);
      const weekly = rows.filter(s => !s.date && s.day_of_week?.toLowerCase() === dow);
      // Separate booked slots from other specific slots
      const bookedSlots = specific.filter(s => s.status === 'booked');
      const nonBookedSpecific = specific.filter(s => s.status !== 'booked');
      // If there are non-booked specific slots, use those; otherwise use weekly recurring
      // Always include booked slots on top
      const availabilitySlots = nonBookedSpecific.length > 0 ? nonBookedSpecific : weekly;
      const allSlots = [...bookedSlots, ...availabilitySlots];

      allSlots.forEach((s, idx) => {
        weekSlots.push({
          id: String(s.id ?? `${dayStr}-${idx}`),
          photographerId: String(s.photographer_id),
          date: dayStr,
          startTime: toHhMm(s.start_time),
          endTime: toHhMm(s.end_time),
          status: (s.status === 'unavailable' ? 'unavailable' : s.status === 'booked' ? 'booked' : 'available') as AvailabilityStatus,
          origin: specific.some(sp => sp.id === s.id) ? 'specific' : 'weekly',
          isRandom: Boolean(s.isRandom),
          shoot_id: s.shoot_id,
          shootDetails: s.shoot_details,
        });
      });
    });

    return weekSlots;
  };

  // Get availabilities for month view
  const getMonthAvailabilities = (): Availability[] => {
    if (!date || !selectedPhotographer) return [];
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const rows = selectedPhotographer === 'all' ? allBackendSlots : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));

    const monthSlots: Availability[] = [];
    monthDays.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const specific = rows.filter(s => s.date === dayStr);
      const weekly = rows.filter(s => !s.date && s.day_of_week?.toLowerCase() === dow);
      // Specific date slots override recurring slots
      const allSlots = specific.length > 0 ? specific : weekly;

      allSlots.forEach((s, idx) => {
        monthSlots.push({
          id: String(s.id ?? `${dayStr}-${idx}`),
          photographerId: String(s.photographer_id),
          date: dayStr,
          startTime: toHhMm(s.start_time),
          endTime: toHhMm(s.end_time),
          status: (s.status === 'unavailable' ? 'unavailable' : s.status === 'booked' ? 'booked' : 'available') as AvailabilityStatus,
          origin: specific.some(sp => sp.id === s.id) ? 'specific' : 'weekly',
          isRandom: Boolean(s.isRandom),
          shoot_id: s.shoot_id,
          shootDetails: s.shoot_details,
        });
      });
    });

    return monthSlots;
  };

  const selectedDateAvailabilities = getSelectedDateAvailabilities();

  const getAvailabilityIndicator = (day: Date) => {
    const dStr = format(day, 'yyyy-MM-dd');
    // Backend stores day_of_week as lowercase full name: "monday", "tuesday", etc.
    const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Get slots for the selected photographer(s)
    const rows = selectedPhotographer === 'all'
      ? allBackendSlots
      : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));

    // Check for specific date slots first (these override weekly slots)
    const specificSlots = rows.filter(s => s.date === dStr);

    // If no specific slots, check for weekly recurring slots matching the day of week
    const weeklySlots = rows.filter(s =>
      !s.date &&
      s.day_of_week &&
      s.day_of_week.toLowerCase() === dow
    );

    // Use specific slots if available, otherwise use weekly slots
    const relevantSlots = specificSlots.length > 0 ? specificSlots : weeklySlots;

    // Only show as available if there are actual slots AND at least one is available (not unavailable)
    const hasSlots = relevantSlots.length > 0;
    const hasAvailable = hasSlots && relevantSlots.some(s => {
      const status = s.status ?? 'available';
      return status !== 'unavailable';
    });
    const hasUnavailable = relevantSlots.some(s => s.status === 'unavailable');

    return { hasAvailable, hasUnavailable, hasSlots };
  };

  const getPhotographerName = (id: string) => {
    const photographer = photographers.find(p => p.id === id);
    if (!photographer) return "Unknown";
    // Return only first name
    return photographer.name.split(' ')[0];
  };

  const canEditAvailability = isAdmin || (isPhotographer && user && String(user.id) === String(selectedPhotographer));

  const notifyDemoAvailabilityRestriction = () => {
    toast({
      title: "Demo availability",
      description: "Generated sample availability can't be modified. Create a new slot instead.",
    });
  };

  // Handle delete availability
  const handleDeleteAvailability = async (slotId: string) => {
    try {
      const slotToDelete = backendSlots.find(s => String(s.id) === slotId) ||
        allBackendSlots.find(s => String(s.id) === slotId);
      if (slotToDelete?.isRandom) {
        notifyDemoAvailabilityRestriction();
        return;
      }
      if (slotToDelete && slotToDelete.id) {
        const res = await fetch(API_ROUTES.photographerAvailability.delete(slotToDelete.id), {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.ok) {
          await refreshPhotographerSlots();
          toast({
            title: "Schedule deleted",
            description: "The schedule has been removed.",
          });
          if (selectedSlotId === slotId) {
            setSelectedSlotId(null);
          }
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete schedule.",
        variant: "destructive"
      });
    }
  };

  // Filter photographers by search
  const filteredPhotographers = useMemo(() => {
    if (!searchQuery) return photographers;
    return photographers.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [photographers, searchQuery]);

  // Update currentMonth when date changes
  useEffect(() => {
    if (date) {
      const dateMonth = startOfMonth(date);
      const currentMonthStr = format(currentMonth, 'yyyy-MM');
      const dateMonthStr = format(dateMonth, 'yyyy-MM');
      if (dateMonthStr !== currentMonthStr) {
        setCurrentMonth(dateMonth);
      }
    }
  }, [date, currentMonth]);

  // Scroll to current time in day view when date changes
  useEffect(() => {
    if (viewMode === "day" && dayViewScrollRef.current && date) {
      const now = new Date();
      const isTodayDate = isToday(date);

      // Mark as programmatic scroll to prevent day switching
      dayViewIsProgrammaticScroll.current = true;

      if (isTodayDate) {
        // Scroll to current time
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const startHour = 8; // 8 AM
        const hourHeight = 64; // h-16 = 64px

        // Only scroll if current time is between 8 AM and 11 PM
        if (currentHour >= startHour && currentHour < 24) {
          const hoursFromStart = currentHour - startHour;
          const minutesOffset = (currentMinute / 60) * hourHeight;
          const scrollPosition = (hoursFromStart * hourHeight) + minutesOffset;

          requestAnimationFrame(() => {
            if (dayViewScrollRef.current) {
              dayViewScrollRef.current.scrollTop = scrollPosition;
            }
            if (dayViewTimeScrollRef.current) {
              dayViewTimeScrollRef.current.scrollTop = scrollPosition;
            }
            dayViewIsProgrammaticScroll.current = false;
          });
        } else {
          // If before 8 AM, scroll to top (8 AM)
          requestAnimationFrame(() => {
            if (dayViewScrollRef.current) {
              dayViewScrollRef.current.scrollTop = 0;
            }
            if (dayViewTimeScrollRef.current) {
              dayViewTimeScrollRef.current.scrollTop = 0;
            }
            dayViewIsProgrammaticScroll.current = false;
          });
        }
      } else {
        // For other days, scroll to 8 AM (top)
        requestAnimationFrame(() => {
          if (dayViewScrollRef.current) {
            dayViewScrollRef.current.scrollTop = 0;
          }
          if (dayViewTimeScrollRef.current) {
            dayViewTimeScrollRef.current.scrollTop = 0;
          }
          dayViewIsProgrammaticScroll.current = false;
        });
      }
    }
  }, [date, viewMode]);

  // Generate months for horizontal navigation - centered around currentMonth
  const months = useMemo(() => {
    const monthsList = [];
    const start = subMonths(currentMonth, 3);
    for (let i = 0; i < 12; i++) {
      monthsList.push(addMonths(start, i));
    }
    return monthsList;
  }, [currentMonth]);

  // Generate dates for multiple months (like month navigation) - centered around currentMonth
  const monthDates = useMemo(() => {
    const datesList: Date[] = [];
    // Generate dates for 3 months before and 3 months after current month
    const startMonth = subMonths(currentMonth, 3);
    const endMonth = addMonths(currentMonth, 3);

    let current = startOfMonth(startMonth);
    const end = endOfMonth(endMonth);

    while (current <= end) {
      datesList.push(current);
      current = addDays(current, 1);
    }

    return datesList;
  }, [currentMonth]);

  // Handle edit availability click
  const handleEditAvailability = () => {
    setEditingWeeklySchedule(true);
    setEditingAvailability(null);
  };

  const saveWeeklySchedule = async () => {
    if (selectedPhotographer === "all") {
      toast({
        title: "Select a photographer",
        description: "Please select a specific photographer before saving schedule.",
        variant: "destructive"
      });
      return;
    }
    const currentSchedule = getCurrentWeeklySchedule();
    setPhotographerWeeklySchedules(prev => ({
      ...prev,
      [selectedPhotographer]: currentSchedule
    }));
    setEditingWeeklySchedule(false);
    toast({
      title: "Schedule saved",
      description: `Weekly schedule for ${getPhotographerName(selectedPhotographer)} has been updated.`,
    });
    try {
      const mapDay = (d: string) => ({ 'Mon': 'monday', 'Tue': 'tuesday', 'Wed': 'wednesday', 'Thu': 'thursday', 'Fri': 'friday', 'Sat': 'saturday', 'Sun': 'sunday' } as any)[d] || d.toLowerCase();
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
      if (res.ok) {
        await refreshPhotographerSlots();
      }
    } catch (error) {
      // Error handling is silent
    }
  };

  const updateCurrentWeeklySchedule = (index: number, field: keyof WeeklyScheduleItem, value: any) => {
    if (selectedPhotographer === "all") return;
    const updatedSchedules = { ...photographerWeeklySchedules };
    if (!updatedSchedules[selectedPhotographer]) {
      updatedSchedules[selectedPhotographer] = [
        { day: 'Mon', active: false, startTime: '9:00', endTime: '17:00' },
        { day: 'Tue', active: false, startTime: '9:00', endTime: '17:00' },
        { day: 'Wed', active: false, startTime: '9:00', endTime: '17:00' },
        { day: 'Thu', active: false, startTime: '9:00', endTime: '17:00' },
        { day: 'Fri', active: false, startTime: '9:00', endTime: '17:00' },
        { day: 'Sat', active: false, startTime: '10:00', endTime: '15:00' },
        { day: 'Sun', active: false, startTime: '10:00', endTime: '15:00' },
      ];
    }
    updatedSchedules[selectedPhotographer] = [
      ...updatedSchedules[selectedPhotographer].slice(0, index),
      {
        ...updatedSchedules[selectedPhotographer][index],
        [field]: value
      },
      ...updatedSchedules[selectedPhotographer].slice(index + 1)
    ];
    setPhotographerWeeklySchedules(updatedSchedules);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const isDesktop = !isMobile;
  const calendarMinHeight = isDesktop ? 500 : undefined;
  const calendarBodyHeight = isDesktop ? 460 : undefined;
  const [hasInitializedMobileSelection, setHasInitializedMobileSelection] = useState(false);

  const renderViewModeButtons = (variant: "header" | "compact") => (
    <div
      className={cn(
        "flex items-center gap-1 bg-muted rounded-md p-1",
        variant === "header" ? "" : "shadow-sm"
      )}
    >
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
            viewMode === mode
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );

  useEffect(() => {
    if (
      isMobile &&
      selectedPhotographer === "all" &&
      photographers.length > 0 &&
      !hasInitializedMobileSelection
    ) {
      setSelectedPhotographer(photographers[0].id);
      setHasInitializedMobileSelection(true);
    }

    if (!isMobile && hasInitializedMobileSelection) {
      setHasInitializedMobileSelection(false);
    }
  }, [
    isMobile,
    selectedPhotographer,
    photographers,
    hasInitializedMobileSelection,
    setSelectedPhotographer
  ]);

  return (
    <DashboardLayout>
      <div className={cn("h-full flex flex-col overflow-hidden", isMobile && "pb-6")}>
        <div className={cn("flex-1 flex flex-col", isMobile ? "p-3 sm:p-4 overflow-y-auto" : "min-h-0 p-6")}>
          <PageHeader
            badge={isDesktop ? "Availability" : undefined}
            title="Photographer Availability"
            description="Manage and schedule photographer availability"
            action={
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {!isMobile && renderViewModeButtons("header")}
                {canEditAvailability && (
                  <Button
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md whitespace-nowrap h-9 px-3 text-sm"
                    onClick={() => {
                      if (!date) {
                        toast({
                          title: "Select a date",
                          description: "Please select a date before blocking calendar.",
                          variant: "destructive"
                        });
                        return;
                      }
                      if (selectedPhotographer === "all") {
                        toast({
                          title: "Select a photographer",
                          description: "Please select a specific photographer before blocking calendar.",
                          variant: "destructive"
                        });
                        return;
                      }
                      setIsWeeklyScheduleDialogOpen(true);
                    }}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Block Calendar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md whitespace-nowrap h-9 px-3 text-sm"
                  onClick={() => setIsSyncModalOpen(true)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync
                </Button>
              </div>
            }
          />
          {/* Loading Indicator */}
          {loadingPhotographers && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">Loading photographers...</span>
            </div>
          )}

          {/* Top Section: Date Selection and Layout Controls */}
          <div className="mt-6 mb-4 space-y-3 flex-shrink-0">

            {/* Month Navigation with Gradient Fade */}
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background via-background/90 via-background/70 to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background via-background/90 via-background/70 to-transparent z-10 pointer-events-none" />
              <div
                ref={(el) => {
                  if (el && date) {
                    // Scroll to selected month
                    const selectedMonth = format(date, 'yyyy-MM');
                    const selectedButton = el.querySelector(`[data-month="${selectedMonth}"]`) as HTMLElement;
                    if (selectedButton) {
                      selectedButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }
                  }
                }}
                className="flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-8 scroll-smooth"
              >
                {months.map((month, idx) => {
                  const monthName = format(month, 'MMMM');
                  const monthYear = format(month, 'yyyy');
                  const prevMonth = idx > 0 ? months[idx - 1] : null;
                  const prevYear = prevMonth ? format(prevMonth, 'yyyy') : null;
                  const showYear = !prevMonth || (prevYear !== monthYear);

                  return (
                    <div key={idx} style={{ display: 'contents' }}>
                      {showYear && idx > 0 && (
                        <span className="px-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {monthYear}
                        </span>
                      )}
                      <button
                        data-month={format(month, 'yyyy-MM')}
                        onClick={() => {
                          setCurrentMonth(month);
                          if (!date || format(date, 'yyyy-MM') !== format(month, 'yyyy-MM')) {
                            setDate(startOfMonth(month));
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-md whitespace-nowrap font-medium transition-colors text-sm flex-shrink-0",
                          format(month, 'yyyy-MM') === format(new Date(), 'yyyy-MM')
                            ? "border-2 border-primary font-semibold"
                            : date && format(date, 'yyyy-MM') === format(month, 'yyyy-MM')
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "bg-transparent hover:bg-muted text-foreground"
                        )}
                      >
                        {monthName}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Date Navigation with Gradient Fade */}
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background via-background/90 via-background/70 to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background via-background/90 via-background/70 to-transparent z-10 pointer-events-none" />
              <div
                ref={(el) => {
                  if (el && date) {
                    // Scroll to selected date
                    const selectedButton = el.querySelector(`[data-date="${format(date, 'yyyy-MM-dd')}"]`) as HTMLElement;
                    if (selectedButton) {
                      selectedButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }
                  }
                }}
                className="flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-8 scroll-smooth"
              >
                {monthDates.map((day, idx) => {
                  // Show month indicator when month changes
                  const prevDay = idx > 0 ? monthDates[idx - 1] : null;
                  const currentMonthStr = format(day, 'yyyy-MM');
                  const prevMonthStr = prevDay ? format(prevDay, 'yyyy-MM') : null;
                  const showMonth = !prevDay || (prevMonthStr !== currentMonthStr);
                  const monthName = format(day, 'MMMM');
                  const monthYear = format(day, 'yyyy');
                  const indicators = getAvailabilityIndicator(day);
                  const isSelected = date && isSameDay(day, date);
                  const isTodayDate = isToday(day);
                  const dayName = format(day, 'EEE');
                  const dayNum = format(day, 'd');

                  // Get availability info for tooltip and determine color
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                  const rows = selectedPhotographer === 'all' ? allBackendSlots : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));
                  const specific = rows.filter(s => s.date === dayStr);
                  const weekly = rows.filter(s => !s.date && s.day_of_week?.toLowerCase() === dow);
                  const relevantSlots = specific.length > 0 ? specific : weekly;
                  const availabilityInfo = relevantSlots.length > 0
                    ? relevantSlots.map(s => `${toHhMm(s.start_time)} - ${toHhMm(s.end_time)} (${s.status || 'available'})`).join(', ')
                    : 'No availability';

                  // Determine availability color based on slots
                  const hasBooked = relevantSlots.some(s => s.status === 'booked');
                  const hasAvailable = relevantSlots.some(s => (s.status ?? 'available') !== 'unavailable' && s.status !== 'booked');
                  const hasUnavailable = relevantSlots.some(s => s.status === 'unavailable');
                  const hasSlots = relevantSlots.length > 0;

                  // Priority: unavailable > booked > available
                  let availabilityColor = '';
                  if (hasUnavailable && hasSlots) {
                    availabilityColor = 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
                  } else if (hasBooked && hasSlots) {
                    availabilityColor = 'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700';
                  } else if (hasAvailable && hasSlots) {
                    availabilityColor = 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
                  }

                  return (
                    <div key={idx} style={{ display: 'contents' }}>
                      {showMonth && (() => {
                        // Check if this is a different month from currentMonth
                        const isDifferentMonth = format(day, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM');
                        return (
                          <span className={cn(
                            "px-2 text-xs font-semibold flex-shrink-0",
                            isDifferentMonth && "text-muted-foreground"
                          )}>
                            {monthName}
                          </span>
                        );
                      })()}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              data-date={format(day, 'yyyy-MM-dd')}
                              onClick={() => {
                                setDate(day);
                                // Update currentMonth when date changes
                                const dayMonth = startOfMonth(day);
                                if (format(dayMonth, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM')) {
                                  setCurrentMonth(dayMonth);
                                }
                              }}
                              className={cn(
                                "flex flex-col items-center justify-center min-w-[56px] p-2 rounded-full transition-all flex-shrink-0 border",
                                isTodayDate
                                  ? "border-2 border-primary font-semibold bg-primary/10"
                                  : isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : availabilityColor
                                      ? `${availabilityColor} border`
                                      : "bg-transparent border-transparent hover:bg-muted/50"
                              )}
                            >
                              <span className={cn(
                                "text-sm font-medium",
                                isTodayDate ? "text-primary" : isSelected ? "text-primary-foreground" : ""
                              )}>{dayNum}</span>
                              <span className={cn(
                                "text-xs mt-0.5",
                                isTodayDate ? "text-primary" : isSelected ? "text-primary-foreground" : "text-muted-foreground"
                              )}>{dayName}</span>
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

          {/* Mobile: Tabs Layout | Desktop: Three Column Layout */}
          {isMobile ? (
            <Tabs
              value={mobileTab}
              onValueChange={(v) => setMobileTab(v as "calendar" | "details")}
              className="flex flex-col gap-3"
            >
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted p-1 mb-3 flex-shrink-0">
                <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="details" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
                  Details
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calendar" className="flex flex-col gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedPhotographer}
                      onValueChange={(value) => {
                        setSelectedPhotographer(value);
                        setEditingWeeklySchedule(false);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select photographer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Photographers</SelectItem>
                        {photographers.map((photographer) => (
                          <SelectItem key={photographer.id} value={photographer.id}>
                            {photographer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isAdmin && (
                      <Sheet open={isPhotographerSheetOpen} onOpenChange={setIsPhotographerSheetOpen}>
                        <SheetTrigger asChild>
                          <Button variant="outline" size="icon">
                            <Users className="h-4 w-4" />
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[85vw] sm:w-[400px]">
                          <SheetHeader>
                            <SheetTitle>Select Photographer</SheetTitle>
                          </SheetHeader>
                          <div className="mt-4 space-y-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Search team..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                              />
                            </div>
                            <div className="overflow-y-auto space-y-3 max-h-[calc(100vh-200px)]">
                              {filteredPhotographers.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                  <p className="text-sm">No photographers found</p>
                                </div>
                              )}
                              {filteredPhotographers.map((photographer) => {
                                const isSelected = selectedPhotographer === photographer.id;
                                return (
                                  <div
                                    key={photographer.id}
                                    onClick={() => {
                                      setSelectedPhotographer(photographer.id);
                                      setEditingWeeklySchedule(false);
                                      setIsPhotographerSheetOpen(false);
                                    }}
                                    className={cn(
                                      "p-4 rounded-md cursor-pointer transition-all border-2",
                                      isSelected
                                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                                        : "bg-card border-border hover:border-primary/50"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-12 w-12">
                                        <AvatarImage src={undefined} alt={photographer.name} />
                                        <AvatarFallback
                                          className={cn(
                                            isSelected
                                              ? "bg-primary-foreground/20 text-primary-foreground"
                                              : "bg-muted text-foreground"
                                          )}
                                        >
                                          {getInitials(photographer.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <p className={cn("font-medium truncate", isSelected ? "text-primary-foreground" : "")}>
                                          {photographer.name}
                                        </p>
                                        <p
                                          className={cn(
                                            "text-xs",
                                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                                          )}
                                        >
                                          {(() => {
                                            let photographerSlots: BackendSlot[] = [];
                                            if (selectedPhotographer === "all") {
                                              photographerSlots = photographerAvailabilityMap[photographer.id] || [];
                                            } else {
                                              photographerSlots = backendSlots.filter(
                                                (s) => Number(s.photographer_id) === Number(photographer.id)
                                              );
                                            }
                                            if (photographerSlots.length > 0) {
                                              const weeklySlots = photographerSlots.filter(
                                                (s) => !s.date && s.day_of_week && (s.status ?? "available") !== "unavailable"
                                              );
                                              if (weeklySlots.length > 0) {
                                                const firstSlot = weeklySlots[0];
                                                return `Available (${toHhMm(firstSlot.start_time)} - ${toHhMm(firstSlot.end_time)})`;
                                              }
                                              const availableSlots = photographerSlots.filter(
                                                (s) => (s.status ?? "available") !== "unavailable"
                                              );
                                              if (availableSlots.length > 0) {
                                                const firstSlot = availableSlots[0];
                                                return `Available (${toHhMm(firstSlot.start_time)} - ${toHhMm(firstSlot.end_time)})`;
                                              }
                                            }
                                            const schedule = photographerWeeklySchedules[photographer.id];
                                            if (schedule && schedule.length > 0) {
                                              const activeDays = schedule.filter((d) => d.active);
                                              if (activeDays.length > 0) {
                                                const firstActive = activeDays[0];
                                                return `Available (${firstActive.startTime} - ${firstActive.endTime})`;
                                              }
                                            }
                                            return "Not available";
                                          })()}
                                        </p>
                                      </div>
                                      {isSelected && (
                                        <div className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-primary-foreground/20" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </SheetContent>
                      </Sheet>
                    )}
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-1 px-1 py-1">
                    {photographers.map((photographer) => {
                      const isActive = selectedPhotographer === photographer.id;
                      return (
                        <button
                          key={photographer.id}
                          onClick={() => {
                            setSelectedPhotographer(photographer.id);
                            setEditingWeeklySchedule(false);
                          }}
                          className={cn(
                            "flex-shrink-0 w-12 h-12 rounded-full border border-border bg-muted/40 flex items-center justify-center text-xs font-semibold transition-all",
                            isActive && "border-primary bg-primary/10 text-primary"
                          )}
                        >
                          {getInitials(photographer.name)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Card className="p-2 flex-1 flex flex-col border shadow-sm rounded-md overflow-hidden">
                  <div className="flex items-start justify-between mb-2 flex-shrink-0 gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xs sm:text-sm font-semibold mb-0.5 truncate">
                        {selectedPhotographer === "all"
                          ? "Calendar"
                          : `${getPhotographerName(selectedPhotographer)}'s Calendar`}
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
                    <div className="flex-shrink-0">
                      {renderViewModeButtons("compact")}
                    </div>
                  </div>
                  {/* Navigation buttons */}
                  {(viewMode === "week" || viewMode === "day" || viewMode === "month") && (
                    <div className="flex items-center gap-2 mb-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg"
                        onClick={() => {
                          if (viewMode === "week") {
                            setDate(addDays(date || new Date(), -7));
                          } else if (viewMode === "day") {
                            setDate(addDays(date || new Date(), -1));
                          } else if (viewMode === "month") {
                            const newDate = subMonths(date || new Date(), 1);
                            setDate(newDate);
                            setCurrentMonth(startOfMonth(newDate));
                          }
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg px-3 sm:px-4 text-xs sm:text-sm"
                        onClick={() => {
                          const today = new Date();
                          setDate(today);
                          if (viewMode === "month") {
                            setCurrentMonth(startOfMonth(today));
                          }
                        }}
                      >
                        {viewMode === "month" ? "Current Month" : "Today"}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg"
                        onClick={() => {
                          if (viewMode === "week") {
                            setDate(addDays(date || new Date(), 7));
                          } else if (viewMode === "day") {
                            setDate(addDays(date || new Date(), 1));
                          } else if (viewMode === "month") {
                            const newDate = addMonths(date || new Date(), 1);
                            setDate(newDate);
                            setCurrentMonth(startOfMonth(newDate));
                          }
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {/* Calendar content - shared between mobile and desktop */}
                  {(() => {
                    // Render calendar based on viewMode - this is the same content as desktop
                    if (selectedPhotographer === "all" && viewMode !== "month") {
                      return (
                        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                          <div className="flex-1 flex items-center justify-center">
                            <PhotographerList
                              photographers={photographers}
                              onSelect={(id) => setSelectedPhotographer(id)}
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        className="flex-1 overflow-y-auto"
                        style={calendarMinHeight ? { minHeight: `${calendarMinHeight}px` } : undefined}
                      >
                        {viewMode === "month" ? (
                          <div className="w-full flex flex-col min-h-0 pb-2">
                            {/* Month Grid - same as desktop */}
                            {(() => {
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
                                <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ minHeight: isMobile ? '300px' : '400px' }}>
                                  <div className="grid grid-cols-7 border-b flex-shrink-0 bg-muted/30">
                                    {weekDays.map((dayName) => (
                                      <div key={dayName} className="p-1.5 sm:p-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0">
                                        {dayName}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="grid grid-rows-6 flex-1 min-h-0" style={{ minHeight: isMobile ? '250px' : '350px' }}>
                                    {weeks.map((week, weekIdx) => (
                                      <div key={weekIdx} className="grid grid-cols-7 border-b last:border-b-0">
                                        {week.map((day, dayIdx) => {
                                          const dayStr = format(day, 'yyyy-MM-dd');
                                          const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                                          const rows = selectedPhotographer === 'all' ? allBackendSlots : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));
                                          const specific = rows.filter(s => s.date === dayStr);
                                          const weekly = rows.filter(s => !s.date && s.day_of_week?.toLowerCase() === dow);
                                          const allSlots = [...specific, ...weekly];
                                          const isSelected = date && isSameDay(day, date);
                                          const isTodayDate = isToday(day);
                                          const isCurrentMonth = isSameMonth(day, monthStart);
                                          const hasBooked = allSlots.some(s => s.status === 'booked');
                                          const hasAvailable = allSlots.some(s => (s.status ?? 'available') !== 'unavailable' && s.status !== 'booked');
                                          const hasUnavailable = allSlots.some(s => s.status === 'unavailable');
                                          const hasSlots = allSlots.length > 0;
                                          let availabilityColor = '';
                                          if (hasUnavailable && hasSlots) {
                                            availabilityColor = 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
                                          } else if (hasBooked && hasSlots) {
                                            availabilityColor = 'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700';
                                          } else if (hasAvailable && hasSlots) {
                                            availabilityColor = 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
                                          }
                                          return (
                                            <ContextMenu key={`${weekIdx}-${dayIdx}`}>
                                              <ContextMenuTrigger asChild>
                                                <button
                                                  onClick={() => {
                                                    setDate(day);
                                                    setSelectedSlotId(null);
                                                    const dayMonth = startOfMonth(day);
                                                    if (format(dayMonth, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM')) {
                                                      setCurrentMonth(dayMonth);
                                                    }
                                                    if (isMobile) setMobileTab("details");
                                                  }}
                                                  className={cn(
                                                    "relative p-1 sm:p-1.5 border-r last:border-r-0 flex flex-col items-start justify-start h-full transition-colors hover:bg-muted/50",
                                                    !isCurrentMonth && "opacity-40",
                                                    isSelected && "bg-primary text-primary-foreground",
                                                    isTodayDate && !isSelected && "border-2 border-primary bg-primary/5",
                                                    !isSelected && !isTodayDate && availabilityColor && `${availabilityColor} border`
                                                  )}
                                                >
                                                  <span className={cn(
                                                    "text-[10px] sm:text-xs font-medium mb-0.5",
                                                    isSelected && "text-primary-foreground",
                                                    isTodayDate && !isSelected && "text-primary font-semibold",
                                                    !isCurrentMonth && "text-muted-foreground"
                                                  )}>
                                                    {format(day, 'd')}
                                                  </span>
                                                  {hasSlots && (
                                                    <div className="flex flex-col gap-0.5 w-full mt-0.5">
                                                      {hasAvailable && <div className="h-0.5 w-full rounded-full bg-green-500" />}
                                                      {hasBooked && <div className="h-0.5 w-full rounded-full bg-blue-500" />}
                                                      {hasUnavailable && <div className="h-0.5 w-full rounded-full bg-red-500" />}
                                                      {allSlots.length > 3 && (
                                                        <div className="text-[7px] text-muted-foreground leading-tight">+{allSlots.length - 3}</div>
                                                      )}
                                                    </div>
                                                  )}
                                                </button>
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
                                              </ContextMenuContent>
                                            </ContextMenu>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : viewMode === "week" ? (
                          <div
                            className="w-full flex flex-col border rounded-md overflow-hidden bg-background"
                            style={calendarMinHeight ? { minHeight: `${calendarMinHeight}px` } : undefined}
                          >
                            <div className="flex-shrink-0 border-b bg-muted/30">
                              <div className="flex">
                                <div className="w-14 sm:w-24 flex-shrink-0 border-r p-1.5 sm:p-2 text-[11px] sm:text-xs font-medium text-muted-foreground">Days</div>
                                <div className={cn("flex-1 flex", !isMobile && "overflow-x-auto")}>
                                  {Array.from({ length: 7 }, (_, i) => {
                                    const hour = 8 + (i * 2);
                                    return (
                                      <div
                                        key={hour}
                                        className={cn(
                                          "flex-1 border-r last:border-r-0 text-center text-muted-foreground",
                                          isMobile ? "min-w-0 p-1 text-[10px]" : "min-w-[60px] p-1.5 sm:p-2 text-xs"
                                        )}
                                      >
                                        {hour.toString().padStart(2, '0')}:00
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            <div
                              className="flex-1 flex flex-col overflow-y-auto"
                              style={calendarBodyHeight ? { minHeight: `${calendarBodyHeight}px` } : undefined}
                            >
                                {(() => {
                                  const weekStart = startOfWeek(date || new Date());
                                  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                                  return weekDays.map((day, dayIdx) => {
                                    const isTodayDate = isToday(day);
                                    const isSelected = date && isSameDay(day, date);
                                    const dayStr = format(day, 'yyyy-MM-dd');
                                    const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                                    const rows = selectedPhotographer === 'all' ? allBackendSlots : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));
                                    const specific = rows.filter(s => s.date === dayStr);
                                    const weekly = rows.filter(s => !s.date && s.day_of_week?.toLowerCase() === dow);
                                    // Separate booked slots from other specific slots
                                    const bookedSlots = specific.filter(s => s.status === 'booked');
                                    const nonBookedSpecific = specific.filter(s => s.status !== 'booked');
                                    // If there are non-booked specific slots, use those; otherwise use weekly recurring
                                    // Always include booked slots on top
                                    const availabilitySlots = nonBookedSpecific.length > 0 ? nonBookedSpecific : weekly;
                                    const allRelevantSlots = [...bookedSlots, ...availabilitySlots];
                                    const daySlots = allRelevantSlots.map((s, slotIdx): Availability => ({
                                      id: String(s.id ?? `${dayStr}-${slotIdx}`),
                                      photographerId: String(s.photographer_id),
                                      date: dayStr,
                                      startTime: toHhMm(s.start_time),
                                      endTime: toHhMm(s.end_time),
                                      status: (s.status === 'unavailable' ? 'unavailable' : s.status === 'booked' ? 'booked' : 'available') as AvailabilityStatus,
                                      origin: specific.some(sp => sp.id === s.id) ? 'specific' : 'weekly',
                                      shootDetails: s.shoot_details
                                    }));
                                    const getSlotStyle = (startTime: string, endTime: string) => {
                                      const [startH, startM] = startTime.split(':').map(Number);
                                      const [endH, endM] = endTime.split(':').map(Number);
                                      const startMinutes = startH * 60 + startM;
                                      const endMinutes = endH * 60 + endM;
                                      const slotStart = 8 * 60;
                                      const slotEnd = 20 * 60;
                                      const totalMinutes = slotEnd - slotStart;
                                      const leftPercent = ((startMinutes - slotStart) / totalMinutes) * 100;
                                      const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;
                                      return {
                                        left: `${Math.max(0, Math.min(100, leftPercent))}%`,
                                        width: `${Math.max(2, Math.min(100 - Math.max(0, leftPercent), widthPercent))}%`
                                      };
                                    };
                                    const formatTimeDisplay = (time: string) => to12HourDisplay(time);
                                    return (
                                      <ContextMenu key={dayIdx}>
                                        <ContextMenuTrigger asChild>
                                          <div className={cn("flex border-b last:border-b-0 flex-1 min-h-[80px] relative cursor-context-menu", isTodayDate && "bg-primary/5")} style={{ minHeight: isMobile ? '80px' : '100px' }} onContextMenu={(e) => e.stopPropagation()}>
                                            <div className={cn("w-14 sm:w-24 flex-shrink-0 border-r p-1.5 sm:p-2 flex flex-col items-center justify-center", isTodayDate && "bg-primary/10", isSelected && !isTodayDate && "bg-primary/5")}>
                                              <div className={cn("text-xs font-medium", isTodayDate && "text-primary font-semibold", isSelected && !isTodayDate && "text-primary")}>{format(day, 'EEE')}</div>
                                              <button onClick={(e) => { e.stopPropagation(); setDate(day); if (isMobile) setMobileTab("details"); }} onContextMenu={(e) => e.stopPropagation()} className={cn("text-sm font-semibold mt-1", isTodayDate && "text-primary", isSelected && !isTodayDate && "text-primary")}>{format(day, 'd')}</button>
                                            </div>
                                            <div className={cn("flex-1 relative overflow-hidden", !isMobile && "overflow-x-auto")} style={{ minHeight: isMobile ? '80px' : '100px' }}>
                                              {Array.from({ length: 7 }, (_, i) => {
                                                const hour = 8 + (i * 2);
                                                return <div key={hour} className="absolute top-0 bottom-0 border-l border-dashed border-muted/30" style={{ left: `${(i / 7) * 100}%` }} />;
                                              })}
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
                                                const topOffset = overlappingBefore.length * 18;
                                                const heightReduction = overlappingBefore.length > 0 ? 2 : 0;
                                                return (
                                                  <div key={slot.id} onClick={(e) => { e.stopPropagation(); setSelectedSlotId(slot.id); setDate(day); if (slot.status === 'booked' && slot.shootDetails) { setExpandedBookingDetails(prev => new Set(prev).add(slot.id)); } if (isMobile) setMobileTab("details"); }} onContextMenu={(e) => e.stopPropagation()} className={cn("absolute rounded-md px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs flex flex-col justify-center border z-10 cursor-pointer hover:opacity-80 transition-opacity", selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-1", slot.status === 'available' && "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300", slot.status === 'booked' && "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300", slot.status === 'unavailable' && "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300")} style={{ ...style, top: `${4 + topOffset}px`, bottom: `${4 + topOffset + heightReduction}px` }}>
                                                    <div className="font-medium capitalize">{slot.status}</div>
                                                    <div className="text-[9px] sm:text-[10px] opacity-80">{formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}</div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent>
                                          <ContextMenuItem onClick={() => { setDate(day); setRightClickedDate(day); setRightClickedTime(null); if (selectedPhotographer === "all") { toast({ title: "Select a photographer", description: "Please select a specific photographer before scheduling.", variant: "destructive" }); return; } setIsWeeklyScheduleDialogOpen(true); }}>
                                            <CalendarIcon className="h-4 w-4 mr-2" />
                                            Schedule for {format(day, 'MMM d')}
                                          </ContextMenuItem>
                                          <ContextMenuItem onClick={() => { setDate(day); setRightClickedDate(day); setRightClickedTime(null); if (selectedPhotographer === "all") { toast({ title: "Select a photographer", description: "Please select a specific photographer before scheduling.", variant: "destructive" }); return; } setIsWeeklyScheduleDialogOpen(true); }}>
                                            <CalendarIcon className="h-4 w-4 mr-2" />
                                            Add Weekly Schedule
                                          </ContextMenuItem>
                                        </ContextMenuContent>
                                      </ContextMenu>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                        ) : (
                          <div
                            className="w-full flex flex-col"
                            style={calendarMinHeight ? { minHeight: `${calendarMinHeight}px` } : undefined}
                          >
                            {date && (
                              <div className="flex-1 grid grid-cols-5 gap-px border rounded-md overflow-hidden" style={{ minHeight: isMobile ? '350px' : '450px' }}>
                                <div className="bg-muted/50 border-r flex flex-col min-h-0">
                                  <div className="h-10 sm:h-12 border-b flex items-center justify-center text-[10px] sm:text-xs font-medium text-muted-foreground flex-shrink-0">
                                    <div>
                                      <div className="font-semibold text-xs sm:text-sm">{format(date, 'EEE')}</div>
                                      <div className="text-[9px] sm:text-[10px]">{format(date, 'MMM d')}</div>
                                    </div>
                                  </div>
                                  <div ref={dayViewTimeScrollRef} className="flex-1 overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                    {(() => {
                                      const daySlots = getSelectedDateAvailabilities();
                                      const hoursWithAvailability = new Set<number>();
                                      daySlots.forEach(slot => {
                                        const [startH] = slot.startTime.split(':').map(Number);
                                        const [endH] = slot.endTime.split(':').map(Number);
                                        for (let h = startH; h < endH; h++) hoursWithAvailability.add(h);
                                        hoursWithAvailability.add(endH);
                                      });
                                      return Array.from({ length: 16 }, (_, i) => i + 8).map((hour) => (
                                        <div key={hour} className={cn("h-12 sm:h-16 border-b flex items-start justify-end pr-1 sm:pr-2 pt-1 text-[10px] sm:text-xs", hoursWithAvailability.has(hour) ? "text-foreground font-medium" : "text-muted-foreground")}>
                                          {hour.toString().padStart(2, '0')}:00
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                </div>
                                <div className="bg-background flex flex-col relative col-span-4 min-h-0">
                                  <div className="h-10 sm:h-12 border-b flex items-center justify-center text-[10px] sm:text-xs font-medium flex-shrink-0">
                                    Availability
                                    {date && isToday(date) && <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-primary/10 text-primary text-[9px] sm:text-[10px] rounded-md font-semibold">Today</span>}
                                  </div>
                                  <div ref={dayViewScrollRef} className="flex-1 relative overflow-y-auto" onContextMenu={(e) => e.stopPropagation()} onScroll={(e) => {
                                    if (dayViewTimeScrollRef.current) dayViewTimeScrollRef.current.scrollTop = e.currentTarget.scrollTop;
                                    if (dayViewIsProgrammaticScroll.current) { dayViewIsProgrammaticScroll.current = false; return; }
                                    if (dayViewScrollChanging.current) return;
                                    const now = Date.now();
                                    if (now - dayViewLastChangeTime.current < 500) return;
                                    if (dayViewScrollTimeout.current) { clearTimeout(dayViewScrollTimeout.current); dayViewScrollTimeout.current = null; }
                                    const scrollTop = e.currentTarget.scrollTop;
                                    const scrollHeight = e.currentTarget.scrollHeight;
                                    const clientHeight = e.currentTarget.clientHeight;
                                    const hourHeight = 48; // Smaller on mobile
                                    if (scrollTop <= 5 && date && !dayViewScrollChanging.current) {
                                      dayViewScrollTimeout.current = setTimeout(() => {
                                        if (dayViewScrollRef.current && dayViewScrollRef.current.scrollTop <= 5 && date && !dayViewScrollChanging.current) {
                                          const currentTime = Date.now();
                                          if (currentTime - dayViewLastChangeTime.current < 500) { dayViewScrollTimeout.current = null; return; }
                                          const prevDay = addDays(date, -1);
                                          if (!isSameDay(prevDay, date)) {
                                            dayViewScrollChanging.current = true;
                                            dayViewLastChangeTime.current = currentTime;
                                            setDate(prevDay);
                                            setTimeout(() => {
                                              if (dayViewScrollRef.current) {
                                                dayViewIsProgrammaticScroll.current = true;
                                                dayViewScrollRef.current.scrollTop = hourHeight * 15;
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
                                            if (currentTime - dayViewLastChangeTime.current < 500) { dayViewScrollTimeout.current = null; return; }
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
                                      if (dayViewScrollTimeout.current) { clearTimeout(dayViewScrollTimeout.current); dayViewScrollTimeout.current = null; }
                                    }
                                  }}>
                                    {Array.from({ length: 16 }, (_, i) => i + 8).map((hour) => {
                                      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                                      return (
                                        <ContextMenu key={hour}>
                                          <ContextMenuTrigger asChild>
                                            <div className="h-12 sm:h-16 border-b border-dashed border-muted cursor-context-menu" style={{ minHeight: '48px' }} />
                                          </ContextMenuTrigger>
                                          <ContextMenuContent>
                                            <ContextMenuItem onClick={() => {
                                              if (!date) { toast({ title: "Select a date", description: "Please select a date before scheduling.", variant: "destructive" }); return; }
                                              setRightClickedDate(date);
                                              setRightClickedTime(timeStr);
                                              if (selectedPhotographer === "all") { toast({ title: "Select a photographer", description: "Please select a specific photographer before scheduling.", variant: "destructive" }); return; }
                                              setIsWeeklyScheduleDialogOpen(true);
                                            }}>
                                              <Clock className="h-4 w-4 mr-2" />
                                              Schedule at {timeStr}
                                            </ContextMenuItem>
                                          </ContextMenuContent>
                                        </ContextMenu>
                                      );
                                    })}
                                    {(() => {
                                      const daySlots = getSelectedDateAvailabilities();
                                      if (daySlots.length === 0) {
                                        return <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No availability scheduled</div>;
                                      }
                                      // Format time for display in day view
                                      const formatTimeDisplay = (time: string) => to12HourDisplay(time);
                                      const getSlotPosition = (startTime: string, endTime: string) => {
                                        // Clean times for calculation (remove AM/PM if present)
                                        const cleanStart = startTime.replace(/\s*(AM|PM)/i, '').trim();
                                        const cleanEnd = endTime.replace(/\s*(AM|PM)/i, '').trim();
                                        const [startH, startM] = cleanStart.split(':').map(Number);
                                        const [endH, endM] = cleanEnd.split(':').map(Number);
                                        const startMinutes = startH * 60 + startM;
                                        const endMinutes = endH * 60 + endM;
                                        const startHour = 8;
                                        const adjustedStartMinutes = startMinutes - (startHour * 60);
                                        const adjustedEndMinutes = endMinutes - (startHour * 60);
                                        const hourHeight = isMobile ? 48 : 64;
                                        const top = (adjustedStartMinutes / 60) * hourHeight;
                                        const height = ((adjustedEndMinutes - adjustedStartMinutes) / 60) * hourHeight;
                                        return { top, height };
                                      };
                                      return daySlots.map((slot, slotIdx) => {
                                        const { top, height } = getSlotPosition(slot.startTime, slot.endTime);
                                        const overlappingSlots = daySlots.filter((s, idx) => {
                                          if (idx >= slotIdx) return false;
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
                                        const leftOffset = overlappingSlots.length * 4;
                                        return (
                                          <div key={slot.id} onClick={(e) => { e.stopPropagation(); setSelectedSlotId(slot.id); if (slot.status === 'booked' && slot.shootDetails) { setExpandedBookingDetails(prev => new Set(prev).add(slot.id)); } if (isMobile) setMobileTab("details"); }} className={cn("absolute rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs z-10 cursor-pointer hover:opacity-80 transition-opacity", selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-1", slot.status === 'available' && "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700", slot.status === 'booked' && "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700", slot.status === 'unavailable' && "bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700")} style={{ top: `${top}px`, height: `${Math.max(height, 20)}px`, left: `${4 + leftOffset}px`, right: `${4 + leftOffset}px` }}>
                                            <div className="font-medium">{formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}</div>
                                            <div className="text-[9px] sm:text-[10px] opacity-80 capitalize">{slot.status}</div>
                                            {slot.shootTitle && <div className="text-[9px] sm:text-[10px] opacity-80 truncate mt-0.5">{slot.shootTitle}</div>}
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </Card>
              </TabsContent>

              <TabsContent value="details" className="flex-1 flex flex-col min-h-0 mt-0">
                {/* Details View - Right Panel Content - Mobile */}
                <Card className="p-3 sm:p-4 flex-1 flex flex-col border shadow-sm rounded-md min-h-0 overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {/* Right panel content - we'll render the same content as desktop but optimized for mobile */}
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
                                      <div key={slot.id} data-slot-id={slot.id} ref={selectedSlotId === slot.id ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) : undefined} onClick={() => { setSelectedSlotId(slot.id); if (slot.status === 'booked' && slot.shootDetails) { setExpandedBookingDetails(prev => new Set(prev).add(slot.id)); } }} className={cn("p-3 rounded-lg border-2 transition-all", selectedSlotId === slot.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
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
                                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteAvailability(slot.id); }}>
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
              </TabsContent>
            </Tabs>
          ) : (
            /* Desktop: Three Column Layout */
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
              {/* Left Column: Search and Select Photographer (Admin only) */}
              {isAdmin && (
                <div className="lg:col-span-3 flex flex-col min-h-0">
                  <Card className="p-4 flex flex-col h-full border shadow-sm rounded-md min-h-0 overflow-hidden">
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search team..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 border-muted"
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3">
                      {filteredPhotographers.map((photographer) => {
                        const isSelected = selectedPhotographer === photographer.id;
                        return (
                          <div
                            key={photographer.id}
                            onClick={() => {
                              setSelectedPhotographer(photographer.id);
                              setEditingWeeklySchedule(false);
                            }}
                            className={cn(
                              "p-4 rounded-md cursor-pointer transition-all border-2",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-md"
                                : "bg-card border-border hover:border-primary/50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={undefined} alt={photographer.name} />
                                <AvatarFallback className={cn(
                                  isSelected
                                    ? "bg-primary-foreground/20 text-primary-foreground"
                                    : "bg-muted text-foreground"
                                )}>
                                  {getInitials(photographer.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "font-medium truncate",
                                  isSelected ? "text-primary-foreground" : ""
                                )}>{photographer.name}</p>
                                <p className={cn(
                                  "text-xs",
                                  isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                                )}>
                                  {(() => {
                                    let photographerSlots: Array<{ start_time: string; end_time: string; status?: string; date?: string | null; day_of_week?: string | null }> = [];
                                    if (selectedPhotographer === 'all') {
                                      photographerSlots = photographerAvailabilityMap[photographer.id] || [];
                                    } else {
                                      photographerSlots = backendSlots.filter(s => Number(s.photographer_id) === Number(photographer.id));
                                    }
                                    if (photographerSlots.length > 0) {
                                      const weeklySlots = photographerSlots.filter(s => !s.date && s.day_of_week && (s.status ?? 'available') !== 'unavailable');
                                      if (weeklySlots.length > 0) {
                                        const firstSlot = weeklySlots[0];
                                        return `Available (${toHhMm(firstSlot.start_time)} - ${toHhMm(firstSlot.end_time)})`;
                                      }
                                      const availableSlots = photographerSlots.filter(s => (s.status ?? 'available') !== 'unavailable');
                                      if (availableSlots.length > 0) {
                                        const firstSlot = availableSlots[0];
                                        return `Available (${toHhMm(firstSlot.start_time)} - ${toHhMm(firstSlot.end_time)})`;
                                      }
                                    }
                                    const schedule = photographerWeeklySchedules[photographer.id];
                                    if (schedule && schedule.length > 0) {
                                      const activeDays = schedule.filter(d => d.active);
                                      if (activeDays.length > 0) {
                                        const firstActive = activeDays[0];
                                        return `Available (${firstActive.startTime} - ${firstActive.endTime})`;
                                      }
                                    }
                                    return 'Not available';
                                  })()}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="h-2 w-2 rounded-full bg-green-500 ring-2 ring-primary-foreground/20" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {filteredPhotographers.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="text-sm">No photographers found</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {/* Middle Column: Calendar */}
              <div className={cn(
                "flex flex-col min-h-0",
                isAdmin ? "lg:col-span-5" : "lg:col-span-8"
              )}>
                <Card className="p-4 flex-1 flex flex-col border shadow-sm rounded-md min-h-0 overflow-hidden">
                  <div className="flex items-start justify-between mb-3 flex-shrink-0">
                    <div>
                      <h2 className="text-base font-semibold mb-1">
                        {selectedPhotographer === "all"
                          ? "Calendar"
                          : `${getPhotographerName(selectedPhotographer)}'s Calendar`}
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
                    {/* Navigation buttons for week, day, and month view */}
                    {(viewMode === "week" || viewMode === "day" || viewMode === "month") && (
                      <div className="flex items-center gap-2 mb-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-lg"
                          onClick={() => {
                            if (viewMode === "week") {
                              setDate(addDays(date || new Date(), -7));
                            } else if (viewMode === "day") {
                              setDate(addDays(date || new Date(), -1));
                            } else if (viewMode === "month") {
                              const newDate = subMonths(date || new Date(), 1);
                              setDate(newDate);
                              setCurrentMonth(startOfMonth(newDate));
                            }
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg px-4"
                          onClick={() => {
                            const today = new Date();
                            setDate(today);
                            if (viewMode === "month") {
                              setCurrentMonth(startOfMonth(today));
                            }
                          }}
                        >
                          {viewMode === "month" ? "Current Month" : "Today"}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-lg"
                          onClick={() => {
                            if (viewMode === "week") {
                              setDate(addDays(date || new Date(), 7));
                            } else if (viewMode === "day") {
                              setDate(addDays(date || new Date(), 1));
                            } else if (viewMode === "month") {
                              const newDate = addMonths(date || new Date(), 1);
                              setDate(newDate);
                              setCurrentMonth(startOfMonth(newDate));
                            }
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {viewMode === "month" ? (
                      <div className="h-full w-full flex flex-col min-h-0">
                        {/* Month Grid */}
                        {(() => {
                          // Use date to determine which month to display
                          const displayDate = date || new Date();
                          const monthStart = startOfMonth(displayDate);
                          const monthEnd = endOfMonth(monthStart);
                          const calendarStart = startOfWeek(monthStart);
                          const calendarEnd = endOfWeek(monthEnd);
                          const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

                          // Group days into weeks (7 days per week)
                          const weeks: Date[][] = [];
                          for (let i = 0; i < days.length; i += 7) {
                            weeks.push(days.slice(i, i + 7));
                          }

                          const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                          return (
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                              {/* Day headers */}
                              <div className="grid grid-cols-7 border-b flex-shrink-0 bg-muted/30">
                                {weekDays.map((dayName) => (
                                  <div
                                    key={dayName}
                                    className="p-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
                                  >
                                    {dayName}
                                  </div>
                                ))}
                              </div>

                              {/* Calendar grid - 6 rows to fit all weeks */}
                              <div className="grid grid-rows-6 flex-1 min-h-0">
                                {weeks.map((week, weekIdx) => (
                                  <div key={weekIdx} className="grid grid-cols-7 border-b last:border-b-0">
                                    {week.map((day, dayIdx) => {
                                      const dayStr = format(day, 'yyyy-MM-dd');
                                      const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                                      const rows = selectedPhotographer === 'all'
                                        ? allBackendSlots
                                        : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));

                                      const specific = rows.filter(s => s.date === dayStr);
                                      const weekly = rows.filter(s => !s.date && s.day_of_week?.toLowerCase() === dow);
                                      const allSlots = [...specific, ...weekly];

                                      const isSelected = date && isSameDay(day, date);
                                      const isTodayDate = isToday(day);
                                      const isCurrentMonth = isSameMonth(day, monthStart);

                                      // Determine availability color
                                      const hasBooked = allSlots.some(s => s.status === 'booked');
                                      const hasAvailable = allSlots.some(s => (s.status ?? 'available') !== 'unavailable' && s.status !== 'booked');
                                      const hasUnavailable = allSlots.some(s => s.status === 'unavailable');
                                      const hasSlots = allSlots.length > 0;

                                      let availabilityColor = '';
                                      if (hasUnavailable && hasSlots) {
                                        availabilityColor = 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
                                      } else if (hasBooked && hasSlots) {
                                        availabilityColor = 'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700';
                                      } else if (hasAvailable && hasSlots) {
                                        availabilityColor = 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
                                      }

                                      return (
                                        <ContextMenu key={`${weekIdx}-${dayIdx}`}>
                                          <ContextMenuTrigger asChild>
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <button
                                                    onClick={() => {
                                                      setDate(day);
                                                      setSelectedSlotId(null);
                                                      const dayMonth = startOfMonth(day);
                                                      if (format(dayMonth, 'yyyy-MM') !== format(currentMonth, 'yyyy-MM')) {
                                                        setCurrentMonth(dayMonth);
                                                      }
                                                    }}
                                                    className={cn(
                                                      "relative p-1.5 border-r last:border-r-0 flex flex-col items-start justify-start h-full transition-colors hover:bg-muted/50 w-full",
                                                      !isCurrentMonth && "opacity-40",
                                                      isSelected && "bg-primary text-primary-foreground",
                                                      isTodayDate && !isSelected && "border-2 border-primary bg-primary/5",
                                                      !isSelected && !isTodayDate && availabilityColor && `${availabilityColor} border`
                                                    )}
                                                  >
                                                    <span className={cn(
                                                      "text-xs font-medium mb-0.5",
                                                      isSelected && "text-primary-foreground",
                                                      isTodayDate && !isSelected && "text-primary font-semibold",
                                                      !isCurrentMonth && "text-muted-foreground"
                                                    )}>
                                                      {format(day, 'd')}
                                                    </span>

                                                    {/* Availability indicators - always show bars */}
                                                    {hasSlots && (
                                                      <div className="flex flex-col gap-0.5 w-full mt-0.5">
                                                        {hasAvailable && (
                                                          <div className="h-0.5 w-full rounded-full bg-green-500" title="Available" />
                                                        )}
                                                        {hasBooked && (
                                                          <div className="h-0.5 w-full rounded-full bg-blue-500" title="Booked" />
                                                        )}
                                                        {hasUnavailable && (
                                                          <div className="h-0.5 w-full rounded-full bg-red-500" title="Unavailable" />
                                                        )}
                                                        {allSlots.length > 3 && (
                                                          <div className="text-[7px] text-muted-foreground leading-tight">
                                                            +{allSlots.length - 3}
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}
                                                  </button>
                                                </TooltipTrigger>
                                                {selectedPhotographer === 'all' && hasSlots && (
                                                  <TooltipContent className="max-w-xs">
                                                    <div className="text-xs font-semibold mb-1">{format(day, 'MMM d, yyyy')}</div>
                                                    <div className="space-y-1">
                                                      {(() => {
                                                        // Group by photographer
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
                                                            <div key={photographerId} className="flex items-center gap-1.5">
                                                              <div
                                                                className={cn(
                                                                  "w-2 h-2 rounded-full",
                                                                  status === 'available' && "bg-green-500",
                                                                  status === 'booked' && "bg-blue-500",
                                                                  status === 'unavailable' && "bg-red-500"
                                                                )}
                                                              />
                                                              <span className="text-[10px]">{photographer?.name || 'Unknown'}</span>
                                                              <span className="text-[9px] text-muted-foreground">({timeRange})</span>
                                                            </div>
                                                          );
                                                        });
                                                      })()}
                                                    </div>
                                                  </TooltipContent>
                                                )}
                                              </Tooltip>
                                            </TooltipProvider>
                                          </ContextMenuTrigger>
                                          <ContextMenuContent>
                                            <ContextMenuItem
                                              onClick={() => {
                                                setDate(day);
                                                setRightClickedDate(day);
                                                setRightClickedTime(null);
                                                if (selectedPhotographer === "all") {
                                                  toast({
                                                    title: "Select a photographer",
                                                    description: "Please select a specific photographer before scheduling.",
                                                    variant: "destructive"
                                                  });
                                                  return;
                                                }
                                                setIsWeeklyScheduleDialogOpen(true);
                                              }}
                                            >
                                              <CalendarIcon className="h-4 w-4 mr-2" />
                                              Schedule for {format(day, 'MMM d')}
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                              onClick={() => {
                                                setDate(day);
                                                setRightClickedDate(day);
                                                setRightClickedTime(null);
                                                if (selectedPhotographer === "all") {
                                                  toast({
                                                    title: "Select a photographer",
                                                    description: "Please select a specific photographer before scheduling.",
                                                    variant: "destructive"
                                                  });
                                                  return;
                                                }
                                                setIsWeeklyScheduleDialogOpen(true);
                                              }}
                                            >
                                              <CalendarIcon className="h-4 w-4 mr-2" />
                                              Add Weekly Schedule
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
                        })()}
                      </div>
                    ) : viewMode === "week" ? (
                      <div className="w-full h-full flex flex-col min-h-0">
                        {/* Week view: Days vertical on left, time slots horizontal on top, availability blocks spanning time slots */}
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                          {/* Time slots header - horizontal */}
                          <div className="flex-shrink-0 border-b">
                            <div className="flex">
                              <div className="w-24 flex-shrink-0 border-r p-2 text-xs font-medium text-muted-foreground">
                                Days
                              </div>
                              <div className="flex-1 flex">
                                {Array.from({ length: 7 }, (_, i) => {
                                  const hour = 8 + (i * 2);
                                  const period = hour >= 12 ? 'PM' : 'AM';
                                  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                                  return (
                                    <div
                                      key={hour}
                                      className="flex-1 border-r last:border-r-0 p-2 text-center text-xs text-muted-foreground flex flex-col items-center justify-center"
                                    >
                                      <span>{hour12}:00</span>
                                      <span className="text-[10px] leading-tight">{period}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Days rows with availability blocks */}
                          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            {(() => {
                              const weekStart = startOfWeek(date || new Date());
                              const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

                              return weekDays.map((day, dayIdx) => {
                                const isTodayDate = isToday(day);
                                const isSelected = date && isSameDay(day, date);

                                // Get slots for this specific day - get ALL slots (both specific and weekly)
                                const dayStr = format(day, 'yyyy-MM-dd');
                                const dow = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                                const rows = selectedPhotographer === 'all' ? allBackendSlots : backendSlots.filter(s => Number(s.photographer_id) === Number(selectedPhotographer));
                                const specific = rows.filter(s => s.date === dayStr);
                                const weekly = rows.filter(s => !s.date && s.day_of_week?.toLowerCase() === dow);
                                
                                // Separate booked slots from other specific slots
                                const bookedSlots = specific.filter(s => s.status === 'booked');
                                const nonBookedSpecific = specific.filter(s => s.status !== 'booked');
                                
                                // If there are non-booked specific slots, use those; otherwise use weekly recurring
                                // Always include booked slots on top
                                const availabilitySlots = nonBookedSpecific.length > 0 ? nonBookedSpecific : weekly;
                                const allRelevantSlots = [...bookedSlots, ...availabilitySlots];
                                
                                const daySlots = allRelevantSlots.map((s, slotIdx): Availability => ({
                                  id: String(s.id ?? `${dayStr}-${slotIdx}`),
                                  photographerId: String(s.photographer_id),
                                  date: dayStr,
                                  startTime: toHhMm(s.start_time),
                                  endTime: toHhMm(s.end_time),
                                  status: (s.status === 'unavailable' ? 'unavailable' : s.status === 'booked' ? 'booked' : 'available') as AvailabilityStatus,
                                  origin: specific.some(sp => sp.id === s.id) ? 'specific' : 'weekly',
                                  shoot_id: s.shoot_id,
                                  shootDetails: s.shoot_details
                                }));

                                // Calculate position and width for each slot
                                // Time slots are every 2 hours: 8:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00
                                const getSlotStyle = (startTime: string, endTime: string) => {
                                  const [startH, startM] = startTime.split(':').map(Number);
                                  const [endH, endM] = endTime.split(':').map(Number);
                                  const startMinutes = startH * 60 + startM;
                                  const endMinutes = endH * 60 + endM;

                                  // Time slots start at 8:00 (480 minutes) and go to 20:00 (1200 minutes)
                                  const slotStart = 8 * 60; // 8:00 AM
                                  const slotEnd = 20 * 60; // 8:00 PM
                                  const totalMinutes = slotEnd - slotStart; // 720 minutes (12 hours)

                                  // Calculate left position (percentage from start)
                                  const leftPercent = ((startMinutes - slotStart) / totalMinutes) * 100;
                                  // Calculate width (percentage of total)
                                  const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;

                                  return {
                                    left: `${Math.max(0, Math.min(100, leftPercent))}%`,
                                    width: `${Math.max(2, Math.min(100 - Math.max(0, leftPercent), widthPercent))}%`
                                  };
                                };

                                // Format time for display - time is in 24-hour format (HH:MM) from toHhMm
                                const formatTimeDisplay = (time: string) => to12HourDisplay(time);

                                return (
                                  <ContextMenu key={dayIdx}>
                                    <ContextMenuTrigger asChild>
                                      <div
                                        className={cn(
                                          "flex border-b last:border-b-0 flex-1 min-h-0 relative cursor-context-menu",
                                          isTodayDate && "bg-primary/5"
                                        )}
                                        onContextMenu={(e) => {
                                          // Ensure context menu works
                                          e.stopPropagation();
                                        }}
                                      >
                                        {/* Day label */}
                                        <div className={cn(
                                          "w-24 flex-shrink-0 border-r p-2 flex flex-col items-center justify-center",
                                          isTodayDate && "bg-primary/10",
                                          isSelected && !isTodayDate && "bg-primary/5"
                                        )}>
                                          <div className={cn(
                                            "text-xs font-medium",
                                            isTodayDate && "text-primary font-semibold",
                                            isSelected && !isTodayDate && "text-primary"
                                          )}>
                                            {format(day, 'EEE')}
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDate(day);
                                            }}
                                            onContextMenu={(e) => {
                                              e.stopPropagation();
                                            }}
                                            className={cn(
                                              "text-sm font-semibold mt-1",
                                              isTodayDate && "text-primary",
                                              isSelected && !isTodayDate && "text-primary"
                                            )}
                                          >
                                            {format(day, 'd')}
                                          </button>
                                        </div>

                                        {/* Availability blocks area */}
                                        <div className="flex-1 relative overflow-hidden">
                                          {/* Hour markers - every 2 hours */}
                                          {Array.from({ length: 7 }, (_, i) => {
                                            const hour = 8 + (i * 2);
                                            return (
                                              <div
                                                key={hour}
                                                className="absolute top-0 bottom-0 border-l border-dashed border-muted/30"
                                                style={{ left: `${(i / 7) * 100}%` }}
                                              />
                                            );
                                          })}

                                          {/* Availability blocks - show all slots */}
                                          {daySlots.map((slot, slotIdx) => {
                                            const style = getSlotStyle(slot.startTime, slot.endTime);

                                            // Check for overlapping slots to offset them slightly
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

                                            // If showing all photographers, render avatars horizontally
                                            if (selectedPhotographer === 'all') {
                                              const photographer = photographers.find(p => String(p.id) === String(slot.photographerId));
                                              const initials = photographer ? getInitials(photographer.name) : "??";
                                              // Use horizontal offset instead of vertical to prevent UI breaking
                                              const horizontalOffset = overlappingBefore.length * 36; // 32px avatar + 4px gap
                                              const zIndex = 10 + slotIdx;

                                              return (
                                                <TooltipProvider key={slot.id}>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <div
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setSelectedSlotId(slot.id);
                                                          setDate(day);
                                                        }}
                                                        className={cn(
                                                          "absolute rounded-full border-2 cursor-pointer hover:scale-110 transition-transform hover:z-50 flex items-center justify-center bg-background",
                                                          selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-2",
                                                          slot.status === 'available' && "border-green-500",
                                                          slot.status === 'booked' && "border-blue-500",
                                                          slot.status === 'unavailable' && "border-red-500"
                                                        )}
                                                        style={{
                                                          left: `calc(${style.left} + ${horizontalOffset}px)`,
                                                          top: '8px',
                                                          width: '32px',
                                                          height: '32px',
                                                          zIndex
                                                        }}
                                                      >
                                                        <Avatar className="h-full w-full">
                                                          <AvatarImage src={photographer?.avatar} alt={photographer?.name} className="object-cover" />
                                                          <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                                                        </Avatar>
                                                      </div>
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

                                            // Check if this day has both available and booked slots
                                            const hasBookedSlots = daySlots.some(s => s.status === 'booked');
                                            const hasAvailableSlots = daySlots.some(s => s.status === 'available');

                                            // For booked slots, show as positioned tiles based on time
                                            if (slot.status === 'booked') {
                                              return (
                                                <TooltipProvider key={slot.id}>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <div
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setSelectedSlotId(slot.id);
                                                          setDate(day);
                                                          // Auto-expand booking details when clicking on booked tile
                                                          if (slot.shootDetails) {
                                                            setExpandedBookingDetails(prev => new Set(prev).add(slot.id));
                                                          }
                                                          // Switch to details tab on mobile
                                                          if (isMobile) setMobileTab("details");
                                                        }}
                                                        onContextMenu={(e) => {
                                                          e.stopPropagation();
                                                        }}
                                                        className={cn(
                                                          "absolute rounded-md px-1 py-0.5 text-[10px] flex flex-col justify-center border z-20 cursor-pointer hover:opacity-80 transition-opacity shadow-sm",
                                                          selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-1",
                                                          "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300"
                                                        )}
                                                        style={{
                                                          ...style,
                                                          top: '4px',
                                                          bottom: hasAvailableSlots ? '14px' : '4px', // Leave space for availability line if present
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

                                            // For available slots when there are also booked slots, show as horizontal line at bottom
                                            if (slot.status === 'available' && hasBookedSlots) {
                                              return (
                                                <TooltipProvider key={slot.id}>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <div
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setSelectedSlotId(slot.id);
                                                          setDate(day);
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

                                            // Default rendering for available/unavailable slots (Full blocks) when no booked slots
                                            const topOffset = overlappingBefore.length * 18;
                                            const heightReduction = overlappingBefore.length > 0 ? 2 : 0;

                                            return (
                                              <div
                                                key={slot.id}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedSlotId(slot.id);
                                                  setDate(day);
                                                }}
                                                onContextMenu={(e) => {
                                                  e.stopPropagation();
                                                }}
                                                className={cn(
                                                  "absolute rounded-md px-2 py-1 text-xs flex flex-col justify-center border z-10 cursor-pointer hover:opacity-80 transition-opacity",
                                                  selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-1",
                                                  slot.status === 'available' && "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300",
                                                  slot.status === 'unavailable' && "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
                                                )}
                                                style={{
                                                  ...style,
                                                  top: `${4 + topOffset}px`,
                                                  bottom: `${4 + topOffset + heightReduction}px`
                                                }}
                                              >
                                                <div className="font-medium capitalize">{slot.status}</div>
                                                <div className="text-[10px] opacity-80">
                                                  {formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                      <ContextMenuItem
                                        onClick={() => {
                                          setDate(day);
                                          setRightClickedDate(day);
                                          setRightClickedTime(null);
                                          if (selectedPhotographer === "all") {
                                            toast({
                                              title: "Select a photographer",
                                              description: "Please select a specific photographer before scheduling.",
                                              variant: "destructive"
                                            });
                                            return;
                                          }
                                          setIsWeeklyScheduleDialogOpen(true);
                                        }}
                                      >
                                        <CalendarIcon className="h-4 w-4 mr-2" />
                                        Schedule for {format(day, 'MMM d')}
                                      </ContextMenuItem>
                                      <ContextMenuItem
                                        onClick={() => {
                                          setDate(day);
                                          setRightClickedDate(day);
                                          setRightClickedTime(null);
                                          if (selectedPhotographer === "all") {
                                            toast({
                                              title: "Select a photographer",
                                              description: "Please select a specific photographer before scheduling.",
                                              variant: "destructive"
                                            });
                                            return;
                                          }
                                          setIsWeeklyScheduleDialogOpen(true);
                                        }}
                                      >
                                        <CalendarIcon className="h-4 w-4 mr-2" />
                                        Add Weekly Schedule
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col min-h-0">
                        {date && (
                          <div className="flex-1 grid grid-cols-5 gap-px border rounded-md overflow-hidden min-h-0 h-full">
                            {/* Time column - 20% */}
                            <div className="bg-muted/50 border-r flex flex-col min-h-0">
                              <div className="h-12 border-b flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                                <div>
                                  <div className="font-semibold">{format(date, 'EEEE')}</div>
                                  <div className="text-[10px]">{format(date, 'MMMM d, yyyy')}</div>
                                </div>
                              </div>
                              <div
                                ref={dayViewTimeScrollRef}
                                className="flex-1 overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                              >
                                {(() => {
                                  const daySlots = getSelectedDateAvailabilities();
                                  // Get all hours that have availability or show all hours if no availability
                                  const hoursWithAvailability = new Set<number>();
                                  daySlots.forEach(slot => {
                                    const [startH] = slot.startTime.split(':').map(Number);
                                    const [endH] = slot.endTime.split(':').map(Number);
                                    for (let h = startH; h < endH; h++) {
                                      hoursWithAvailability.add(h);
                                    }
                                    hoursWithAvailability.add(endH);
                                  });

                                  // Show hours 8-23 (8 AM to 11 PM)
                                  return Array.from({ length: 16 }, (_, i) => i + 8).map((hour) => (
                                    <div
                                      key={hour}
                                      className={cn(
                                        "h-16 border-b flex items-start justify-end pr-2 pt-1 text-xs",
                                        hoursWithAvailability.has(hour)
                                          ? "text-foreground font-medium"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      {hour.toString().padStart(2, '0')}:00
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>

                            {/* Availability column - 80% */}
                            <div className="bg-background flex flex-col relative col-span-4 min-h-0">
                              <div className="h-12 border-b flex items-center justify-center text-xs font-medium flex-shrink-0">
                                Availability
                                {date && isToday(date) && (
                                  <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-md font-semibold">
                                    Today
                                  </span>
                                )}
                              </div>
                              <div
                                ref={dayViewScrollRef}
                                className="flex-1 relative overflow-y-auto"
                                onContextMenu={(e) => {
                                  // Allow context menu to work in the scroll container
                                  e.stopPropagation();
                                }}
                                onScroll={(e) => {
                                  // Sync time column scroll position (but don't show scrollbar on time column)
                                  if (dayViewTimeScrollRef.current) {
                                    dayViewTimeScrollRef.current.scrollTop = e.currentTarget.scrollTop;
                                  }

                                  // Skip if this is a programmatic scroll (from day change)
                                  if (dayViewIsProgrammaticScroll.current) {
                                    dayViewIsProgrammaticScroll.current = false;
                                    return;
                                  }

                                  // Skip if we're already changing days
                                  if (dayViewScrollChanging.current) return;

                                  // Check cooldown period - prevent day switching if recently changed (< 500ms)
                                  const now = Date.now();
                                  if (now - dayViewLastChangeTime.current < 500) {
                                    return;
                                  }

                                  // Clear any existing timeout
                                  if (dayViewScrollTimeout.current) {
                                    clearTimeout(dayViewScrollTimeout.current);
                                    dayViewScrollTimeout.current = null;
                                  }

                                  // Detect scrolling past boundaries to change day
                                  const scrollTop = e.currentTarget.scrollTop;
                                  const scrollHeight = e.currentTarget.scrollHeight;
                                  const clientHeight = e.currentTarget.clientHeight;

                                  // Each hour is 64px (h-16 = 4rem = 64px)
                                  const hourHeight = 64;

                                  // If scrolled to the very top (at 8 AM) and trying to scroll up, go to previous day
                                  if (scrollTop <= 5 && date && !dayViewScrollChanging.current) {
                                    // Use a delay to detect if user is actively trying to scroll past
                                    dayViewScrollTimeout.current = setTimeout(() => {
                                      if (dayViewScrollRef.current && dayViewScrollRef.current.scrollTop <= 5 && date && !dayViewScrollChanging.current) {
                                        // Double-check cooldown period
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
                                          // Scroll to 11 PM of previous day after a brief delay
                                          setTimeout(() => {
                                            if (dayViewScrollRef.current) {
                                              dayViewIsProgrammaticScroll.current = true;
                                              dayViewScrollRef.current.scrollTop = hourHeight * 15; // Scroll to 11 PM (23:00 - 8 = 15)
                                              dayViewScrollChanging.current = false;
                                            }
                                          }, 100);
                                        }
                                      }
                                      dayViewScrollTimeout.current = null;
                                    }, 300);
                                  }

                                  // If scrolled to the very bottom (past 11 PM), go to next day
                                  else if (scrollTop + clientHeight >= scrollHeight - 5 && date && !dayViewScrollChanging.current) {
                                    dayViewScrollTimeout.current = setTimeout(() => {
                                      if (dayViewScrollRef.current && date && !dayViewScrollChanging.current) {
                                        const currentScrollTop = dayViewScrollRef.current.scrollTop;
                                        const currentScrollHeight = dayViewScrollRef.current.scrollHeight;
                                        const currentClientHeight = dayViewScrollRef.current.clientHeight;

                                        if (currentScrollTop + currentClientHeight >= currentScrollHeight - 5) {
                                          // Double-check cooldown period
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
                                            // Scroll to 8 AM of next day after a brief delay
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
                                  }
                                  // If scroll position is away from boundaries, clear any pending timeouts
                                  else if (scrollTop > 5 && scrollTop + clientHeight < scrollHeight - 5) {
                                    if (dayViewScrollTimeout.current) {
                                      clearTimeout(dayViewScrollTimeout.current);
                                      dayViewScrollTimeout.current = null;
                                    }
                                  }
                                }}
                              >
                                {Array.from({ length: 16 }, (_, i) => i + 8).map((hour) => {
                                  const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                                  return (
                                    <ContextMenu key={hour}>
                                      <ContextMenuTrigger asChild>
                                        <div
                                          className="h-16 border-b border-dashed border-muted cursor-context-menu"
                                          style={{ minHeight: '64px' }}
                                        />
                                      </ContextMenuTrigger>
                                      <ContextMenuContent>
                                        <ContextMenuItem
                                          onClick={() => {
                                            if (!date) {
                                              toast({
                                                title: "Select a date",
                                                description: "Please select a date before scheduling.",
                                                variant: "destructive"
                                              });
                                              return;
                                            }
                                            setRightClickedDate(date);
                                            setRightClickedTime(timeStr);
                                            if (selectedPhotographer === "all") {
                                              toast({
                                                title: "Select a photographer",
                                                description: "Please select a specific photographer before scheduling.",
                                                variant: "destructive"
                                              });
                                              return;
                                            }
                                            setIsWeeklyScheduleDialogOpen(true);
                                          }}
                                        >
                                          <Clock className="h-4 w-4 mr-2" />
                                          Schedule at {timeStr}
                                        </ContextMenuItem>
                                      </ContextMenuContent>
                                    </ContextMenu>
                                  );
                                })}

                                {/* Availability slots */}
                                {(() => {
                                  const daySlots = getSelectedDateAvailabilities();
                                  if (daySlots.length === 0) {
                                    return (
                                      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                                        No availability scheduled
                                      </div>
                                    );
                                  }

                                  const getSlotPosition = (startTime: string, endTime: string) => {
                                    // Clean times for calculation (remove AM/PM if present)
                                    const cleanStart = startTime.replace(/\s*(AM|PM)/i, '').trim();
                                    const cleanEnd = endTime.replace(/\s*(AM|PM)/i, '').trim();
                                    const [startH, startM] = cleanStart.split(':').map(Number);
                                    const [endH, endM] = cleanEnd.split(':').map(Number);
                                    const startMinutes = startH * 60 + startM;
                                    const endMinutes = endH * 60 + endM;
                                    // Adjust for 8 AM start (subtract 8 hours = 480 minutes)
                                    const startHour = 8;
                                    const adjustedStartMinutes = startMinutes - (startHour * 60);
                                    const adjustedEndMinutes = endMinutes - (startHour * 60);
                                    const top = (adjustedStartMinutes / 60) * 64;
                                    const height = ((adjustedEndMinutes - adjustedStartMinutes) / 60) * 64;
                                    return { top, height };
                                  };

                                  // Format time for display in month view
                                  const formatTimeDisplay = (time: string) => to12HourDisplay(time);
                                  return daySlots.map((slot, slotIdx) => {
                                    const { top, height } = getSlotPosition(slot.startTime, slot.endTime);
                                    // Check for overlapping slots
                                    const overlappingSlots = daySlots.filter((s, idx) => {
                                      if (idx >= slotIdx) return false;
                                      // Clean times for comparison
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

                                    // If showing all photographers, render avatars horizontally
                                    if (selectedPhotographer === 'all') {
                                      const photographer = photographers.find(p => String(p.id) === String(slot.photographerId));
                                      const initials = photographer ? getInitials(photographer.name) : "??";
                                      const horizontalOffset = overlappingSlots.length * 36; // 32px avatar + 4px gap
                                      const zIndex = 10 + slotIdx;

                                      return (
                                        <TooltipProvider key={slot.id}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedSlotId(slot.id);
                                                }}
                                                className={cn(
                                                  "absolute rounded-full border-2 cursor-pointer hover:scale-110 transition-transform hover:z-50 flex items-center justify-center bg-background",
                                                  selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-2",
                                                  slot.status === 'available' && "border-green-500",
                                                  slot.status === 'booked' && "border-blue-500",
                                                  slot.status === 'unavailable' && "border-red-500"
                                                )}
                                                style={{
                                                  left: `${4 + horizontalOffset}px`,
                                                  top: `${top}px`,
                                                  width: '32px',
                                                  height: '32px',
                                                  zIndex
                                                }}
                                              >
                                                <Avatar className="h-full w-full">
                                                  <AvatarImage src={photographer?.avatar} alt={photographer?.name} className="object-cover" />
                                                  <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                                                </Avatar>
                                              </div>
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

                                    // Default rendering for specific photographer
                                    const leftOffset = overlappingSlots.length * 4;
                                    return (
                                      <div
                                        key={slot.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedSlotId(slot.id);
                                        }}
                                        className={cn(
                                          "absolute rounded px-2 py-1 text-xs z-10 cursor-pointer hover:opacity-80 transition-opacity",
                                          selectedSlotId === slot.id && "ring-2 ring-primary ring-offset-1",
                                          slot.status === 'available' && "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700",
                                          slot.status === 'booked' && "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700",
                                          slot.status === 'unavailable' && "bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"
                                        )}
                                        style={{
                                          top: `${top}px`,
                                          height: `${Math.max(height, 20)}px`,
                                          left: `${4 + leftOffset}px`,
                                          right: `${4 + leftOffset}px`
                                        }}
                                      >
                                        <div className="font-medium">{formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}</div>
                                        <div className="text-[10px] opacity-80 capitalize">{slot.status}</div>
                                        {slot.shootTitle && (
                                          <div className="text-[10px] opacity-80 truncate mt-0.5">{slot.shootTitle}</div>
                                        )}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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

              {/* Right Column: Day Schedules / Weekly Schedule */}
              <div className={cn(
                "flex flex-col min-h-0",
                isAdmin ? "lg:col-span-4" : "lg:col-span-4"
              )}>
                <Card className="p-4 flex-1 flex flex-col border shadow-sm rounded-md min-h-0 overflow-hidden">
                  {selectedPhotographer !== "all" ? (
                    <>
                      {/* Show Schedules based on view mode */}
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
                                onClick={() => {
                                  setIsWeeklyScheduleDialogOpen(true);
                                }}
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
                              if (viewMode === "day") {
                                slots = getSelectedDateAvailabilities();
                              } else if (viewMode === "week") {
                                slots = getWeekAvailabilities();
                              } else if (viewMode === "month") {
                                slots = getMonthAvailabilities();
                              }

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

                              // Format time for display in details panel
                              const formatTimeDisplay = (time: string) => to12HourDisplay(time);

                              // Group slots by date for better organization
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
                                            onClick={() => { setSelectedSlotId(slot.id); if (slot.status === 'booked' && slot.shootDetails) { setExpandedBookingDetails(prev => new Set(prev).add(slot.id)); } }}
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
                                                
                                                {/* Booking Details Section - Collapsible */}
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
                                                      handleDeleteAvailability(slot.id);
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
                        <>
                          {/* Weekly Schedule View */}
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

                              {/* Time Range */}
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

                              {/* Repeat Days */}
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

                              {/* Note Section */}
                              <div className="mb-4 flex-shrink-0">
                                <Label className="text-xs uppercase mb-2 block font-semibold text-muted-foreground">NOTE</Label>
                                <Textarea
                                  value={weeklyScheduleNote}
                                  onChange={(e) => setWeeklyScheduleNote(e.target.value)}
                                  placeholder="Add a note about this availability..."
                                  className="min-h-[80px] rounded-md resize-none"
                                />
                              </div>

                              {/* Conflicts Warning - Only show if there are actual time overlaps when editing */}
                              {(() => {
                                // Only show conflicts when actively editing and there are actual time overlaps
                                if (!editingWeeklySchedule) return null;

                                // Check if the current schedule time range overlaps with existing bookings
                                const currentSchedule = getCurrentWeeklySchedule();
                                const activeDays = currentSchedule.filter(d => d.active);
                                if (activeDays.length === 0) return null;

                                // Get the time range from the schedule
                                const startTime = currentSchedule[0]?.startTime || '09:00';
                                const endTime = currentSchedule[0]?.endTime || '17:00';

                                // Check for overlapping bookings on active days
                                const conflicts: Array<{ day: string; count: number }> = [];
                                activeDays.forEach((daySchedule, idx) => {
                                  if (!daySchedule.active) return;

                                  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                                  const dayName = dayNames[idx];

                                  // Get bookings for this day of week
                                  const dayBookings = backendSlots.filter(slot => {
                                    if (slot.status !== 'booked') return false;
                                    if (slot.date) {
                                      const slotDate = new Date(slot.date);
                                      const slotDayName = slotDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                                      return slotDayName === dayName;
                                    }
                                    return slot.day_of_week?.toLowerCase() === dayName;
                                  });

                                  // Check for time overlaps
                                  const overlappingBookings = dayBookings.filter(booking => {
                                    const bookingStart = booking.start_time;
                                    const bookingEnd = booking.end_time;
                                    // Simple overlap check
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

                              {/* Action Buttons */}
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
                                    // Get actual slots for this day from backend
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

                              {/* Quick Stats */}
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Availability Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Availability</DialogTitle>
            <DialogDescription>
              Update availability for {getPhotographerName(selectedPhotographer)} on {editedAvailability.date ? format(new Date(editedAvailability.date), "MMMM d, yyyy") : "the selected date"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editedAvailability.status}
                onValueChange={(value) =>
                  setEditedAvailability({
                    ...editedAvailability,
                    status: value as AvailabilityStatus
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <TimeSelect
                  value={editedAvailability.startTime || ""}
                  onChange={(time) => setEditedAvailability({ ...editedAvailability, startTime: time })}
                  placeholder="Select start time"
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <TimeSelect
                  value={editedAvailability.endTime || ""}
                  onChange={(time) => setEditedAvailability({ ...editedAvailability, endTime: time })}
                  placeholder="Select end time"
                />
              </div>
            </div>

            {editedAvailability.status === "booked" && (
              <div className="space-y-2">
                <Label>Shoot Title</Label>
                <Input
                  placeholder="Enter shoot title or client name"
                  value={editedAvailability.shootTitle || ""}
                  onChange={e => setEditedAvailability({ ...editedAvailability, shootTitle: e.target.value })}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!editedAvailability.id || selectedPhotographer === "all") {
                toast({
                  title: "Missing information",
                  description: "Please select a specific photographer and availability to edit.",
                  variant: "destructive"
                });
                return;
              }

              // Validate time range
              const startTime = uiTimeToHhmm(editedAvailability.startTime || "09:00");
              const endTime = uiTimeToHhmm(editedAvailability.endTime || "17:00");

              if (startTime >= endTime) {
                toast({
                  title: "Invalid time range",
                  description: "End time must be after start time.",
                  variant: "destructive"
                });
                return;
              }

              // Get the original slot to determine if it's date-specific or weekly
              const originalSlot = backendSlots.find(s => String(s.id) === editedAvailability.id) ||
                allBackendSlots.find(s => String(s.id) === editedAvailability.id);

              if (originalSlot) {
                const dayOfWeek = originalSlot.date
                  ? undefined
                  : originalSlot.day_of_week
                    ? originalSlot.day_of_week
                    : date
                      ? date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
                      : undefined;

                // Check for overlaps (excluding the current slot being edited)
                if (checkTimeOverlap(
                  editedAvailability.startTime || "09:00",
                  editedAvailability.endTime || "17:00",
                  originalSlot.date || undefined,
                  dayOfWeek,
                  editedAvailability.id
                )) {
                  toast({
                    title: "Time slot overlap",
                    description: "This time slot overlaps with an existing availability. Please choose a different time.",
                    variant: "destructive"
                  });
                  return;
                }
              }

              const slotMeta = backendSlots.find(s => String(s.id) === String(editedAvailability.id)) ||
                allBackendSlots.find(s => String(s.id) === String(editedAvailability.id));
              if (slotMeta?.isRandom) {
                notifyDemoAvailabilityRestriction();
                return;
              }

              try {
                const payload = {
                  photographer_id: Number(selectedPhotographer),
                  date: editedAvailability.date,
                  start_time: startTime,
                  end_time: endTime,
                  status: editedAvailability.status === 'unavailable' ? 'unavailable' : editedAvailability.status === 'booked' ? 'booked' : 'available',
                };
                const res = await fetch(API_ROUTES.photographerAvailability.update(editedAvailability.id), {
                  method: 'PUT',
                  headers: authHeaders(),
                  body: JSON.stringify(payload),
                });
                if (res.ok) {
                  await refreshPhotographerSlots();
                  setIsEditDialogOpen(false);
                  setSelectedSlotId(null);
                  setEditedAvailability({});
                  toast({
                    title: "Availability updated",
                    description: `Updated availability for ${editedAvailability.date ? format(new Date(editedAvailability.date), "MMMM d, yyyy") : "the selected date"}`,
                  });
                } else {
                  const errorData = await res.json().catch(() => ({}));
                  toast({
                    title: "Error",
                    description: errorData.message || "Failed to update availability. Please try again.",
                    variant: "destructive"
                  });
                }
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to update availability. Please try again.",
                  variant: "destructive"
                });
              }
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weekly/Recurring Schedule Dialog */}
      <Dialog open={isWeeklyScheduleDialogOpen} onOpenChange={setIsWeeklyScheduleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Schedule</DialogTitle>
            <DialogDescription>
              Create availability schedule for {getPhotographerName(selectedPhotographer)}. Choose recurring weekly schedule or specific dates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Recurring Option */}
            <div className="space-y-2">
              <Label>Schedule Type</Label>
              <Select
                value={newWeeklySchedule.recurring ? "recurring" : "specific"}
                onValueChange={(value) =>
                  setNewWeeklySchedule({
                    ...newWeeklySchedule,
                    recurring: value === "recurring"
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recurring Weekly</SelectItem>
                  <SelectItem value="specific">Specific Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={newWeeklySchedule.status}
                onValueChange={(value) =>
                  setNewWeeklySchedule({
                    ...newWeeklySchedule,
                    status: value as AvailabilityStatus
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <TimeSelect
                  value={newWeeklySchedule.startTime}
                  onChange={(time) => setNewWeeklySchedule({ ...newWeeklySchedule, startTime: time })}
                  placeholder="Select start time"
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <TimeSelect
                  value={newWeeklySchedule.endTime}
                  onChange={(time) => setNewWeeklySchedule({ ...newWeeklySchedule, endTime: time })}
                  placeholder="Select end time"
                />
              </div>
            </div>

            {/* Days Selection - Only for recurring */}
            {newWeeklySchedule.recurring && (
              <div className="space-y-2">
                <Label>Repeat Days</Label>
                <div className="flex gap-2">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const newDays = [...newWeeklySchedule.days];
                        newDays[idx] = !newDays[idx];
                        setNewWeeklySchedule({ ...newWeeklySchedule, days: newDays });
                      }}
                      className={cn(
                        "h-9 w-9 rounded-full font-medium transition-all text-sm",
                        newWeeklySchedule.days[idx]
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Specific Date - Only for specific */}
            {!newWeeklySchedule.recurring && (
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date ? format(date, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDate(new Date(e.target.value));
                    }
                  }}
                  className="rounded-md"
                />
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Textarea
                value={newWeeklySchedule.note}
                onChange={(e) => setNewWeeklySchedule({ ...newWeeklySchedule, note: e.target.value })}
                placeholder="Add a note about this schedule..."
                className="min-h-[80px] rounded-md resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsWeeklyScheduleDialogOpen(false);
              setNewWeeklySchedule({
                startTime: "09:00",
                endTime: "17:00",
                status: "available",
                days: [true, true, true, true, true, false, false],
                recurring: true,
                note: ""
              });
            }}>Cancel</Button>
            <Button onClick={async () => {
              if (selectedPhotographer === "all") {
                toast({
                  title: "Select a photographer",
                  description: "Please select a specific photographer before adding schedule.",
                  variant: "destructive"
                });
                return;
              }

              // Validate time range
              const startTime = uiTimeToHhmm(newWeeklySchedule.startTime);
              const endTime = uiTimeToHhmm(newWeeklySchedule.endTime);

              if (startTime >= endTime) {
                toast({
                  title: "Invalid time range",
                  description: "End time must be after start time.",
                  variant: "destructive"
                });
                return;
              }

              try {
                if (newWeeklySchedule.recurring) {
                  // Create recurring weekly schedule
                  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                  const activeDays = newWeeklySchedule.days
                    .map((active, idx) => active ? dayNames[idx] : null)
                    .filter(Boolean) as string[];

                  if (activeDays.length === 0) {
                    toast({
                      title: "Select days",
                      description: "Please select at least one day for recurring schedule.",
                      variant: "destructive"
                    });
                    return;
                  }

                  const payload = {
                    photographer_id: Number(selectedPhotographer),
                    availabilities: activeDays.map(day => ({
                      day_of_week: day,
                      start_time: startTime,
                      end_time: endTime,
                      status: newWeeklySchedule.status === 'unavailable' ? 'unavailable' : 'available',
                    }))
                  };

                  const res = await fetch(API_ROUTES.photographerAvailability.bulk, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify(payload),
                  });

                  if (res.ok) {
                    await refreshPhotographerSlots();
                    setIsWeeklyScheduleDialogOpen(false);
                    setNewWeeklySchedule({
                      startTime: "09:00",
                      endTime: "17:00",
                      status: "available",
                      days: [true, true, true, true, true, false, false],
                      recurring: true,
                      note: ""
                    });
                    toast({
                      title: "Schedule added",
                      description: `Added recurring schedule for ${activeDays.length} day(s).`,
                    });
                  } else {
                    const errorData = await res.json().catch(() => ({}));
                    const errorMessage = errorData.errors && errorData.errors.length > 0
                      ? errorData.errors.join('. ')
                      : errorData.message || "Failed to add schedule. Please try again.";
                    toast({
                      title: "Error",
                      description: errorMessage,
                      variant: "destructive"
                    });
                  }
                } else {
                  // Create specific date schedule
                  if (!date) {
                    toast({
                      title: "Select a date",
                      description: "Please select a date for the schedule.",
                      variant: "destructive"
                    });
                    return;
                  }

                  const dateStr = format(date, "yyyy-MM-dd");
                  const dayOfWeekForDate = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

                  if (checkTimeOverlap(
                    newWeeklySchedule.startTime,
                    newWeeklySchedule.endTime,
                    dateStr,
                    dayOfWeekForDate
                  )) {
                    toast({
                      title: "Time slot overlap",
                      description: "This time slot overlaps with an existing availability. Please choose a different time.",
                      variant: "destructive"
                    });
                    return;
                  }

                  const payload = {
                    photographer_id: Number(selectedPhotographer),
                    date: dateStr,
                    start_time: startTime,
                    end_time: endTime,
                    status: newWeeklySchedule.status === 'unavailable' ? 'unavailable' : 'available',
                  };

                  const res = await fetch(API_ROUTES.photographerAvailability.create, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify(payload),
                  });

                  if (res.ok) {
                    await refreshPhotographerSlots();
                    setIsWeeklyScheduleDialogOpen(false);
                    setNewWeeklySchedule({
                      startTime: "09:00",
                      endTime: "17:00",
                      status: "available",
                      days: [true, true, true, true, true, false, false],
                      recurring: true,
                      note: ""
                    });
                    toast({
                      title: "Schedule added",
                      description: `Added schedule for ${format(date, "MMMM d, yyyy")}`,
                    });
                  } else {
                    const errorData = await res.json().catch(() => ({}));
                    toast({
                      title: "Error",
                      description: errorData.message || "Failed to add schedule. Please try again.",
                      variant: "destructive"
                    });
                  }
                }
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to add schedule. Please try again.",
                  variant: "destructive"
                });
              }
            }}>Add Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendar Sync Modal */}
      <CalendarSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        availabilitySlots={
          (selectedPhotographer === "all" ? allBackendSlots : backendSlots).map(slot => ({
            ...slot,
            id: typeof slot.id === 'string' ? parseInt(slot.id, 10) || 0 : slot.id
          })) as any
        }
        photographerName={
          selectedPhotographer === "all"
            ? "Your"
            : photographers.find((p) => p.id === selectedPhotographer)?.name || "Your"
        }
      />

      {/* Shoot Details Modal */}
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
    </DashboardLayout>
  );
}
