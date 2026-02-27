import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfWeek, format, isAfter, isSameDay, isWithinInterval, startOfWeek, startOfDay } from 'date-fns';
import { DashboardShootServiceTag, DashboardShootSummary } from '@/types/dashboard';
import { Card, Avatar } from './SharedComponents';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Flag,
  Sun,
  CloudRain,
  Cloud,
  Snowflake,
  Filter,
  Camera,
  Plane,
  Film,
  Map as MapIcon,
  Home,
  Sparkles,
  Check,
  X,
  Edit,
  Eye,
  MoreVertical,
  ChevronsDown,
} from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getWeatherForLocation, WeatherInfo } from '@/services/weatherService';
import { subscribeToWeatherProvider } from '@/state/weatherProviderStore';
import { formatWorkflowStatus } from '@/utils/status';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

interface ShootsTabsCardProps {
  upcomingShoots: DashboardShootSummary[];
  requestedShoots: DashboardShootSummary[];
  onSelect: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
  onApprove?: (shoot: DashboardShootSummary) => void;
  onDecline?: (shoot: DashboardShootSummary) => void;
  onModify?: (shoot: DashboardShootSummary) => void;
  onViewInvoice?: (shoot: DashboardShootSummary) => void;
}

type TabType = 'upcoming' | 'requested';

const STATUS_COLORS: Record<string, string> = {
  // Main statuses with distinct colors
  requested: 'bg-blue-100 text-blue-700 border-blue-300',
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  booked: 'bg-blue-100 text-blue-700 border-blue-200', // Alias for scheduled
  uploaded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  editing: 'bg-purple-100 text-purple-700 border-purple-200',
  review: 'bg-orange-100 text-orange-700 border-orange-200',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  
  // Legacy/alias statuses
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  in_field: 'bg-sky-100 text-sky-700 border-sky-200',
  uploading: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  photos_uploaded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  raw_uploaded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  completed: 'bg-indigo-100 text-indigo-700 border-indigo-200', // Maps to uploaded
  qc: 'bg-orange-100 text-orange-700 border-orange-200',
  pending_review: 'bg-orange-100 text-orange-700 border-orange-200',
  ready: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ready_for_client: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  admin_verified: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  
  // Other statuses
  declined: 'bg-red-100 text-red-700 border-red-200',
  canceled: 'bg-gray-100 text-gray-700 border-gray-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
  on_hold: 'bg-amber-100 text-amber-700 border-amber-200',
};

const STATUS_FILTERS = [
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'In Field', value: 'in_field' },
  { label: 'Uploading', value: 'uploading' },
  { label: 'Editing', value: 'editing' },
  { label: 'QC', value: 'qc' },
  { label: 'Ready', value: 'ready' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Canceled', value: 'canceled' },
] as const;

const DATE_RANGE_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'Next 7 Days', value: 'next7' },
  { label: 'This Week', value: 'week' },
  { label: 'Custom Range', value: 'custom' },
] as const;

type DateRangeValue = (typeof DATE_RANGE_OPTIONS)[number]['value'];

const SERVICE_LABELS: Record<string, string> = {
  hdr: 'HDR Photos',
  hdr_photos: 'HDR Photos',
  hdr_photo: 'HDR Photos',
  drone: 'Drone Shots',
  drone_shots: 'Drone Shots',
  floorplan: 'Floorplan',
  hd_video: 'HD Video',
  matterport: 'Matterport 3D',
  matterport_3d: 'Matterport 3D',
  virtual_tour: 'Virtual Tour',
  twilight: 'Twilight',
  social_media: 'Social Media Reels',
};

type FiltersState = {
  statuses: string[];
  client: string;
  address: string;
  photographerIds: number[];
  unassignedOnly: boolean;
  services: string[];
  dateRange: DateRangeValue | null;
  customRange: { from: string; to: string };
  flaggedOnly: boolean;
  priority: {
    highPriority: boolean;
    missingRaw: boolean;
    missingEditor: boolean;
    overdue: boolean;
    unpaid: boolean;
  };
};

const defaultFilters: FiltersState = {
  statuses: [],
  client: 'all',
  address: '',
  photographerIds: [],
  unassignedOnly: false,
  services: [],
  dateRange: null,
  customRange: { from: '', to: '' },
  flaggedOnly: false,
  priority: {
    highPriority: false,
    missingRaw: false,
    missingEditor: false,
    overdue: false,
    unpaid: false,
  },
};

const parseShootDate = (shoot: DashboardShootSummary) =>
  shoot.startTime ? new Date(shoot.startTime) : null;

const isOverdue = (shoot: DashboardShootSummary) => {
  if (!shoot.deliveryDeadline) return false;
  const dueDate = new Date(shoot.deliveryDeadline);
  const now = new Date();
  const completed = (shoot.workflowStatus || shoot.status || '').toLowerCase() === 'completed';
  return !completed && isAfter(now, dueDate);
};

const matchesDateRange = (shoot: DashboardShootSummary, filters: FiltersState) => {
  if (!filters.dateRange) return true;
  const shootDate = parseShootDate(shoot);
  if (!shootDate) return false;
  const today = new Date();

  switch (filters.dateRange) {
    case 'today':
      return isSameDay(shootDate, today);
    case 'tomorrow':
      return isSameDay(shootDate, addDays(today, 1));
    case 'next7':
      return isWithinInterval(shootDate, { start: today, end: addDays(today, 7) });
    case 'week':
      return isWithinInterval(shootDate, {
        start: startOfWeek(today, { weekStartsOn: 0 }),
        end: endOfWeek(today, { weekStartsOn: 0 }),
      });
    case 'custom': {
      const { from, to } = filters.customRange;
      if (!from && !to) return true;
      const start = from ? new Date(from) : undefined;
      const end = to ? new Date(to) : undefined;
      if (start && end) return isWithinInterval(shootDate, { start, end });
      if (start) return isAfter(shootDate, start) || isSameDay(shootDate, start);
      if (end) return isAfter(end, shootDate) || isSameDay(shootDate, end);
      return true;
    }
    default:
      return true;
  }
};

const getServiceKey = (label: string, type?: string) => type || label.toLowerCase().replace(/\s+/g, '_');

const SERVICE_ICON_MAP: Record<string, React.ReactNode> = {
  hdr: <Camera size={12} />,
  hdr_photos: <Camera size={12} />,
  hdr_photo: <Camera size={12} />,
  drone: <Plane size={12} />,
  drone_shots: <Plane size={12} />,
  floorplan: <MapIcon size={12} />,
  floor_plan: <MapIcon size={12} />,
  hd_video: <Film size={12} />,
  matterport: <Home size={12} />,
  matterport_3d: <Home size={12} />,
  virtual_tour: <Home size={12} />,
  twilight: <Sparkles size={12} />,
  social_media: <Film size={12} />,
};

const countActiveFilters = (filters: FiltersState) => {
  let count = 0;
  if (filters.statuses.length) count += 1;
  if (filters.client !== 'all') count += 1;
  if (filters.address) count += 1;
  if (filters.photographerIds.length) count += 1;
  if (filters.unassignedOnly) count += 1;
  if (filters.services.length) count += 1;
  if (filters.dateRange || filters.customRange.from || filters.customRange.to) count += 1;
  if (filters.flaggedOnly) count += 1;
  if (filters.priority.highPriority) count += 1;
  if (filters.priority.missingRaw) count += 1;
  if (filters.priority.missingEditor) count += 1;
  if (filters.priority.overdue) count += 1;
  if (filters.priority.unpaid) count += 1;
  return count;
};

const isShootInPast = (shoot: DashboardShootSummary) => {
  if (!shoot.startTime) return false;
  const shootDate = new Date(shoot.startTime);
  const today = startOfDay(new Date());
  return !isSameDay(shootDate, today) && !isAfter(shootDate, today);
};

export const ShootsTabsCard: React.FC<ShootsTabsCardProps> = ({
  upcomingShoots,
  requestedShoots,
  onSelect,
  onApprove,
  onDecline,
  onModify,
  onViewInvoice,
}) => {
  const { formatTemperature, formatTime, formatDate } = useUserPreferences();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [hasUnreadRequests, setHasUnreadRequests] = useState(requestedShoots.length > 0);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<FiltersState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showPastDays, setShowPastDays] = useState(false);
  const [showPastRequests, setShowPastRequests] = useState(false);
  const [weatherMap, setWeatherMap] = useState<Record<number, WeatherInfo>>({});
  const weatherMapRef = useRef<Map<number, WeatherInfo>>(new Map());
  const [providerVersion, setProviderVersion] = useState(0);
  const [hoveredShoot, setHoveredShoot] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const lastRequestedCountRef = useRef<number>(requestedShoots.length);
  
  const SHOOTS_PER_PAGE = 5;
  const [visibleCount, setVisibleCount] = useState(SHOOTS_PER_PAGE);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Separate past and current requests
  const { pastRequests, currentRequests, hasPastRequests } = useMemo(() => {
    const past = requestedShoots.filter(isShootInPast);
    const current = requestedShoots.filter(s => !isShootInPast(s));
    return {
      pastRequests: past,
      currentRequests: current,
      hasPastRequests: past.length > 0,
    };
  }, [requestedShoots]);

  const visibleRequestedShoots = useMemo(() => {
    if (showPastRequests) {
      return [...currentRequests, ...pastRequests];
    }
    return currentRequests;
  }, [showPastRequests, currentRequests, pastRequests]);

  useEffect(() => {
    const unsubscribe = subscribeToWeatherProvider(() =>
      setProviderVersion((version) => version + 1),
    );
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const allShoots = useMemo(() => [...upcomingShoots, ...requestedShoots], [upcomingShoots, requestedShoots]);

  const clientOptions = useMemo(
    () => ['all', ...new Set(allShoots.map((shoot) => shoot.clientName).filter(Boolean) as string[])],
    [allShoots],
  );

  const photographerOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; avatar?: string | null }>();
    allShoots.forEach((shoot) => {
      if (shoot.photographer) {
        map.set(shoot.photographer.id, {
          id: shoot.photographer.id,
          name: shoot.photographer.name,
          avatar: shoot.photographer.avatar,
        });
      }
    });
    return Array.from(map.values());
  }, [allShoots]);

  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    allShoots.forEach((shoot) => {
      shoot.services.forEach((service) => {
        set.add(getServiceKey(service.label, service.type));
      });
    });
    return Array.from(set);
  }, [allShoots]);

  const applyFilters = () => {
    setFilters(draftFilters);
    setIsFilterOpen(false);
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setFilters(defaultFilters);
    setIsFilterOpen(false);
  };

  const cancelFilters = () => {
    setDraftFilters(filters);
    setIsFilterOpen(false);
  };

  const filterShoots = useCallback((shoots: DashboardShootSummary[]) => {
    return shoots.filter((shoot) => {
      const statusKey = (shoot.workflowStatus || shoot.status || '').toLowerCase();
      if (filters.statuses.length && !filters.statuses.includes(statusKey)) return false;

      if (filters.client !== 'all' && (shoot.clientName || '').toLowerCase() !== filters.client.toLowerCase()) {
        return false;
      }

      if (filters.address) {
        const addressTarget = `${shoot.addressLine} ${shoot.cityStateZip}`.toLowerCase();
        if (!addressTarget.includes(filters.address.toLowerCase())) return false;
      }

      if (filters.photographerIds.length) {
        const shootPhotographerId = shoot.photographer?.id ?? null;
        if (!shootPhotographerId || !filters.photographerIds.includes(shootPhotographerId)) {
          return false;
        }
      }

      if (filters.unassignedOnly && shoot.photographer) return false;

      if (filters.services.length) {
        const serviceMatch = shoot.services.some((service) =>
          filters.services.includes(getServiceKey(service.label, service.type)),
        );
        if (!serviceMatch) return false;
      }

      if (filters.flaggedOnly && !shoot.isFlagged) return false;

      if (filters.priority.highPriority && !shoot.isFlagged) return false;

      if (filters.priority.missingRaw) {
        const note = shoot.adminIssueNotes?.toLowerCase() || '';
        if (!note.includes('raw')) return false;
      }

      if (filters.priority.missingEditor) {
        const note = shoot.adminIssueNotes?.toLowerCase() || '';
        if (!note.includes('editor')) return false;
      }

      if (filters.priority.overdue && !isOverdue(shoot)) return false;

      if (filters.priority.unpaid) {
        const status = (shoot.status || shoot.workflowStatus || '').toLowerCase();
        if (!status.includes('payment') && !status.includes('unpaid')) return false;
      }

      if (!matchesDateRange(shoot, filters)) return false;

      return true;
    });
  }, [filters]);

  const filteredUpcomingShoots = useMemo(() => filterShoots(upcomingShoots), [filterShoots, upcomingShoots]);
  const filteredRequestedShoots = useMemo(() => filterShoots(visibleRequestedShoots), [filterShoots, visibleRequestedShoots]);

  const activeFilterCount = countActiveFilters(filters);

  // Group shoots by day
  const groupShootsByDay = useCallback((shoots: DashboardShootSummary[]) => {
    const today = startOfDay(new Date());
    const todayStart = today.getTime();

    const groupsMap = new Map<
      string,
      { label: string; shoots: DashboardShootSummary[]; isPast: boolean; isToday: boolean; dayTime: number }
    >();

    shoots.forEach((shoot) => {
      const normalizedLabel = (shoot.dayLabel || '').toLowerCase();
      const label =
        shoot.dayLabel ||
        (shoot.startTime ? formatDate(new Date(shoot.startTime)) : 'Upcoming');

      const shootDate = shoot.startTime ? new Date(shoot.startTime) : null;
      const derivedDate =
        shootDate ||
        (normalizedLabel.includes('today')
          ? today
          : normalizedLabel.includes('tomorrow')
            ? addDays(today, 1)
            : null);

      const timestamp = derivedDate ? derivedDate.getTime() : Number.POSITIVE_INFINITY;
      const dayStart = derivedDate ? startOfDay(derivedDate).getTime() : Number.POSITIVE_INFINITY;
      const isToday =
        (derivedDate ? isSameDay(derivedDate, today) : false) || normalizedLabel.includes('today');
      const isPast =
        derivedDate
          ? !isToday && dayStart < todayStart
          : normalizedLabel.includes('yesterday');

      const existing = groupsMap.get(label);
      if (existing) {
        existing.shoots.push(shoot);
        if (timestamp < existing.dayTime) {
          existing.dayTime = timestamp;
        }
        if (existing.isPast && !isPast) {
          existing.isPast = false;
        }
        if (!existing.isToday && isToday) {
          existing.isToday = true;
        }
        return;
      }

      groupsMap.set(label, {
        label,
        shoots: [shoot],
        isPast,
        isToday,
        dayTime: timestamp,
      });
    });

    const allGroups = Array.from(groupsMap.values());
    const pastGroups = allGroups
      .filter((group) => group.isPast)
      .sort((a, b) => (b.dayTime || 0) - (a.dayTime || 0));
    const todayGroups = allGroups
      .filter((group) => group.isToday)
      .sort((a, b) => (a.dayTime || Number.POSITIVE_INFINITY) - (b.dayTime || Number.POSITIVE_INFINITY));
    const futureGroups = allGroups
      .filter((group) => !group.isPast && !group.isToday)
      .sort((a, b) => (a.dayTime || Number.POSITIVE_INFINITY) - (b.dayTime || Number.POSITIVE_INFINITY));

    const visiblePastGroups = showPastDays ? pastGroups.slice(0, 3) : [];
    const hasPastDays = pastGroups.length > 0;

    return {
      groups: [...visiblePastGroups, ...todayGroups, ...futureGroups],
      hasPastDays,
    };
  }, [formatDate, showPastDays]);

  const { groups: upcomingGroups, hasPastDays } = useMemo(
    () => groupShootsByDay(filteredUpcomingShoots),
    [groupShootsByDay, filteredUpcomingShoots]
  );

  const requestedGroups = useMemo(() => {
    const groups: Record<string, DashboardShootSummary[]> = {};
    filteredRequestedShoots.forEach((shoot) => {
      const label = shoot.dayLabel || 'Upcoming';
      if (!groups[label]) groups[label] = [];
      groups[label].push(shoot);
    });
    return Object.entries(groups).map(([label, shoots]) => ({ label, shoots }));
  }, [filteredRequestedShoots]);

  // Pagination for upcoming shoots
  const { paginatedGroups, totalShootsCount, hasMore } = useMemo(() => {
    const allShoots = upcomingGroups.flatMap(g => g.shoots);
    const total = allShoots.length;
    const hasMoreShoots = visibleCount < total;
    
    let shootsRemaining = visibleCount;
    const paginated: typeof upcomingGroups = [];
    
    for (const group of upcomingGroups) {
      if (shootsRemaining <= 0) break;
      
      const shootsToShow = group.shoots.slice(0, shootsRemaining);
      if (shootsToShow.length > 0) {
        paginated.push({
          ...group,
          shoots: shootsToShow,
        });
        shootsRemaining -= shootsToShow.length;
      }
    }
    
    return {
      paginatedGroups: paginated,
      totalShootsCount: total,
      hasMore: hasMoreShoots,
    };
  }, [upcomingGroups, visibleCount]);

  useEffect(() => {
    setVisibleCount(SHOOTS_PER_PAGE);
  }, [filters, activeTab]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const nearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    if (nearBottom && hasMore) {
      setVisibleCount(prev => prev + SHOOTS_PER_PAGE);
    }
  }, [hasMore]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    if (providerVersion > 0) {
      weatherMapRef.current.clear();
      setWeatherMap({});
    }
    
    const loadWeather = async () => {
      const shootsNeedingWeather = allShoots.filter(shoot => 
        !weatherMapRef.current.has(shoot.id) && 
        (shoot.cityStateZip || shoot.addressLine)
      );

      if (shootsNeedingWeather.length === 0) return;

      await Promise.all(
        shootsNeedingWeather.map(async (shoot) => {
          const location = [shoot.addressLine, shoot.cityStateZip]
            .filter((part): part is string => Boolean(part && part.trim()))
            .join(', ');
          if (!location) return;
          try {
            const info = await getWeatherForLocation(location, shoot.startTime, controller.signal);
            if (info && isMounted) {
              weatherMapRef.current.set(shoot.id, info);
              setWeatherMap((prev) => ({ ...prev, [shoot.id]: info }));
            }
          } catch {
            // swallow network errors for weather
          }
        })
      );
    };
    
    loadWeather();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [allShoots, providerVersion]);

  const renderWeatherIcon = (icon?: WeatherInfo['icon']) => {
    switch (icon) {
      case 'sunny':
        return <Sun size={14} />;
      case 'rainy':
        return <CloudRain size={14} />;
      case 'snowy':
        return <Snowflake size={14} />;
      default:
        return <Cloud size={14} />;
    }
  };

  const getShootTemperatureLabel = (shoot: DashboardShootSummary, weather?: WeatherInfo) => {
    // Prefer explicit C/F pair from WeatherInfo
    if (weather && typeof weather.temperatureC === 'number') {
      return formatTemperature(weather.temperatureC, weather.temperatureF);
    }

    const nestedWeather = (shoot as DashboardShootSummary & {
      weather?: {
        temperature?: string | number | null;
        temp?: string | number | null;
        temp_f?: string | number | null;
        temp_c?: string | number | null;
      } | null;
    }).weather;

    // Fallback: try nested weather C/F pair
    if (nestedWeather?.temp_c != null && nestedWeather?.temp_f != null) {
      const c = Number(nestedWeather.temp_c);
      const f = Number(nestedWeather.temp_f);
      if (Number.isFinite(c) && Number.isFinite(f)) return formatTemperature(c, f);
    }

    // Last resort: raw temperature string (treat as Celsius — weather service default)
    const candidates: Array<string | number | null | undefined> = [
      weather?.temperature,
      shoot.temperature,
      nestedWeather?.temperature,
      nestedWeather?.temp,
      nestedWeather?.temp_c,
    ];

    const value = candidates.find((candidate) => candidate !== null && candidate !== undefined && String(candidate).trim() !== '');
    if (value === undefined) return '--°';

    const num = typeof value === 'number' ? value : Number(String(value).match(/-?\d+(?:\.\d+)?/)?.[0]);
    if (typeof num === 'number' && Number.isFinite(num)) {
      return formatTemperature(num);
    }

    return String(value).trim();
  };

  const renderShootCard = (shoot: DashboardShootSummary, isRequested: boolean) => {
    const statusKey = (shoot.workflowStatus || shoot.status || '').toLowerCase();
    const statusClass = STATUS_COLORS[statusKey] || STATUS_COLORS.scheduled;
    const serviceList = shoot.services.flatMap((service) => {
      const parts = service.label
        .split(/[,•|]+/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length <= 1) {
        return [{ label: service.label.trim(), type: service.type }];
      }
      return parts.map((part) => ({ label: part, type: service.type }));
    });
    const isHovered = hoveredShoot === shoot.id;
    const visibleServices = isHovered ? serviceList : serviceList.slice(0, 3);
    const hidden = isHovered ? 0 : serviceList.length - visibleServices.length;
    const weather = weatherMap[shoot.id];

    return (
      <div
        key={shoot.id}
        onClick={() => onSelect(shoot, weather)}
        onMouseEnter={() => setHoveredShoot(shoot.id)}
        onMouseLeave={() => setHoveredShoot(null)}
        className={cn(
          "relative border rounded-3xl p-5 hover:shadow-lg transition-all cursor-pointer bg-card group",
          isRequested 
            ? "border-blue-400 bg-blue-50/30 dark:bg-blue-950/20 hover:border-blue-500" 
            : "border-border hover:border-primary/40"
        )}
      >
        {/* Top right actions - flag only (invoice available in shoot details modal) */}
        {shoot.isFlagged && (
          <div className="absolute top-3 right-3 text-destructive">
            <Flag size={14} />
          </div>
        )}

        {/* ── Mobile layout ── */}
        <div className="sm:hidden space-y-2.5">
          {/* Row 1: Time + Status pill + Weather (right-aligned) */}
          <div className="flex items-center gap-2 -ml-1.5">
            <div className="rounded-xl border border-border/80 bg-muted/40 dark:bg-muted/20 px-4 py-2 shadow-sm flex-shrink-0">
              {(() => {
                const rawTime =
                  shoot.timeLabel ||
                  (shoot.startTime
                    ? (() => {
                        const date = new Date(shoot.startTime);
                        if (isNaN(date.getTime())) return null;
                        const hh = date.getHours().toString().padStart(2, '0');
                        const mm = date.getMinutes().toString().padStart(2, '0');
                        return `${hh}:${mm}`;
                      })()
                    : null);
                const formattedTime = rawTime ? formatTime(rawTime) : '--';
                return (
                  <p className="text-[15px] font-bold text-foreground leading-none tracking-tight whitespace-nowrap">
                    {formattedTime}
                  </p>
                );
              })()}
            </div>
            <span
              className={cn(
                'inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold border whitespace-nowrap',
                statusClass,
              )}
            >
              {formatWorkflowStatus(shoot.workflowStatus || shoot.status)}
            </span>
            <div className="ml-auto inline-flex items-center h-5 gap-1 rounded-full border border-border px-2 text-[10px] font-semibold text-muted-foreground bg-background shadow-sm flex-shrink-0">
              {renderWeatherIcon(weather?.icon)}
              <span>{getShootTemperatureLabel(shoot, weather)}</span>
            </div>
          </div>

          {/* Row 2: Full address */}
          <div>
            <h3 className="text-sm font-semibold text-foreground break-words">{shoot.addressLine}</h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <MapPin size={10} />
              {shoot.cityStateZip}
            </p>
          </div>

          {/* Row 3: Client + Shoot ID */}
          <div className="flex items-center gap-x-3 flex-wrap text-[10px] text-muted-foreground">
            <span>Client <span className="font-semibold text-foreground">• {shoot.clientName || 'Client TBD'}</span></span>
            <span>Shoot ID <span className="font-semibold text-foreground">• #{shoot.id}</span></span>
          </div>

          {/* Row 4: Service tags + Photographer bottom-right */}
          <div className="flex gap-1.5 flex-wrap">
            {visibleServices.map((tag, index) => {
              const key = getServiceKey(tag.label, tag.type);
              const icon = SERVICE_ICON_MAP[key] || <Camera size={10} />;
              return (
                <span
                  key={`${shoot.id}-${key}-${index}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border/70 bg-muted/30 text-[10px] font-semibold text-muted-foreground"
                >
                  {icon}
                  {SERVICE_LABELS[key] || tag.label}
                </span>
              );
            })}
            {hidden > 0 && (
              <Badge
                variant="outline"
                className="rounded-full border-dashed text-muted-foreground px-2 py-0.5 text-[10px]"
              >
                +{hidden} more
              </Badge>
            )}
          </div>

          {/* Row 5: Photographer — bottom right */}
          <div className="flex justify-end text-[10px] text-muted-foreground">
            <span>Photographer <span className="font-semibold text-foreground">• {shoot.photographer?.name || 'Unassigned'}</span></span>
          </div>
        </div>

        {/* ── Desktop layout (unchanged) ── */}
        <div className="hidden sm:grid sm:grid-cols-[auto,1fr,auto] items-stretch gap-4">
          <div className="flex flex-col items-center gap-2">
            {isRequested && (
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap',
                  statusClass,
                )}
              >
                {formatWorkflowStatus(shoot.workflowStatus || shoot.status)}
              </span>
            )}
            <div className="w-20 rounded-2xl border border-border/80 bg-muted/40 dark:bg-muted/20 text-center py-3 shadow-sm flex-shrink-0">
              {(() => {
                const rawTime =
                  shoot.timeLabel ||
                  (shoot.startTime
                    ? (() => {
                        const date = new Date(shoot.startTime);
                        if (isNaN(date.getTime())) return null;
                        const hh = date.getHours().toString().padStart(2, '0');
                        const mm = date.getMinutes().toString().padStart(2, '0');
                        return `${hh}:${mm}`;
                      })()
                    : null);

                const formattedTime = rawTime ? formatTime(rawTime) : '--';
                const parts = formattedTime.split(' ');
                return (
                  <>
                    <p className="text-xl font-bold text-foreground leading-tight tracking-tight">
                      {parts[0] || '--'}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">
                      {parts[1] || ''}
                    </p>
                  </>
                );
              })()}
            </div>
            {!isRequested && (
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap',
                  statusClass,
                )}
              >
                {formatWorkflowStatus(shoot.workflowStatus || shoot.status)}
              </span>
            )}
          </div>

          <div className="space-y-3 min-w-0">
            <div>
              <h3 className="text-base font-semibold text-foreground break-words">{shoot.addressLine}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin size={12} />
                {shoot.cityStateZip}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Client <span className="font-semibold text-foreground">• {shoot.clientName || 'Client TBD'}</span></span>
              <span>Shoot ID <span className="font-semibold text-foreground">• #{shoot.id}</span></span>
            </div>
            <div className="flex gap-2 flex-wrap text-xs text-muted-foreground transition-all">
              {visibleServices.map((tag, index) => {
                const key = getServiceKey(tag.label, tag.type);
                const icon = SERVICE_ICON_MAP[key] || <Camera size={12} />;
                return (
                  <span
                    key={`${shoot.id}-${key}-${index}`}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-border/70 bg-background text-[11px] font-semibold text-muted-foreground"
                  >
                    {icon}
                    {SERVICE_LABELS[key] || tag.label}
                  </span>
                );
              })}
              {hidden > 0 && (
                <Badge
                  variant="outline"
                  className="rounded-full border-dashed text-muted-foreground px-3 py-1 text-[11px]"
                >
                  +{hidden} more
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 min-w-[120px] justify-between">
            <div className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground bg-background shadow-sm">
              {renderWeatherIcon(weather?.icon)}
              <span>{getShootTemperatureLabel(shoot, weather)}</span>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              Photographer{' '}
              <span className="font-semibold text-foreground">
                • {shoot.photographer?.name || 'Unassigned'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Action buttons for requested shoots */}
        {isRequested && (onApprove || onDecline || onModify) && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
            {onApprove && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(shoot);
                }}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
            )}
            {onModify && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onModify(shoot);
                }}
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                Modify
              </Button>
            )}
            {onDecline && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onDecline(shoot);
                }}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Decline
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const upcomingCount = totalShootsCount;
  const requestedCount = currentRequests.length;

  useEffect(() => {
    if (requestedCount === 0) {
      setHasUnreadRequests(false);
      lastRequestedCountRef.current = requestedCount;
      return;
    }

    if (requestedCount > lastRequestedCountRef.current) {
      setHasUnreadRequests(activeTab !== 'requested');
    }

    lastRequestedCountRef.current = requestedCount;
  }, [requestedCount, activeTab]);

  useEffect(() => {
    if (activeTab === 'requested' && hasUnreadRequests) {
      setHasUnreadRequests(false);
    }
  }, [activeTab, hasUnreadRequests]);

  return (
    <Card className="flex flex-col h-full flex-1 relative">
      {/* 3-dot / chevron menu toggle — top-right corner on mobile */}
      <button
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className="sm:hidden absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
        aria-label="Toggle menu"
      >
        {isMenuOpen ? <ChevronsDown size={16} /> : <MoreVertical size={16} />}
      </button>

      {/* Header with static "Shoots" title and inline tabs */}
      <div className="flex flex-wrap items-center justify-between mb-2 gap-3 pr-10 sm:pr-0">
        <div className="flex items-center gap-4">
          <h2 className="hidden sm:block text-lg font-bold text-foreground">Shoots</h2>
          <div className="flex items-center gap-1 border-b border-transparent pl-1 sm:pl-0">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={cn(
                'px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
                activeTab === 'upcoming'
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              Upcoming ({upcomingCount})
            </button>
            <button
              onClick={() => setActiveTab('requested')}
              className={cn(
                'px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
                activeTab === 'requested'
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              <span className="flex items-center gap-2">
                Requested
                {requestedCount > 0 && (
                  <span
                    className={cn(
                      'ml-1 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-semibold transition-colors',
                      hasUnreadRequests
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {requestedCount}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
        {/* Desktop: inline filter/previous buttons */}
        <div className="hidden sm:flex items-center gap-2">
          {activeTab === 'upcoming' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastDays((prev) => !prev)}
              disabled={!hasPastDays}
            >
              {hasPastDays ? (showPastDays ? 'Hide past' : 'Previous shoots') : 'Previous shoots'}
            </Button>
          )}
          {activeTab === 'requested' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastRequests((prev) => !prev)}
              disabled={!hasPastRequests}
            >
              {hasPastRequests
                ? (showPastRequests ? 'Hide past' : `Previous requests (${pastRequests.length})`)
                : 'Previous requests'}
            </Button>
          )}
          {activeTab !== 'requested' && (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-900"
              onClick={() => { setDraftFilters(filters); setIsFilterOpen(true); }}
            >
              <Filter size={14} className="mr-1.5" />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: expandable menu row (shown when 3-dot is tapped) */}
      {isMenuOpen && (
        <div className="sm:hidden flex items-center gap-2 mb-3 -mt-1">
          {activeTab === 'upcoming' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastDays((prev) => !prev)}
              disabled={!hasPastDays}
            >
              {hasPastDays ? (showPastDays ? 'Hide past' : 'Previous shoots') : 'Previous shoots'}
            </Button>
          )}
          {activeTab === 'requested' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastRequests((prev) => !prev)}
              disabled={!hasPastRequests}
            >
              {hasPastRequests
                ? (showPastRequests ? 'Hide past' : `Previous requests (${pastRequests.length})`)
                : 'Previous requests'}
            </Button>
          )}
          {activeTab !== 'requested' && (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-900"
              onClick={() => { setDraftFilters(filters); setIsFilterOpen(true); }}
            >
              <Filter size={14} className="mr-1.5" />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
          )}
        </div>
      )}

      {/* Shared filter dialog (used by both mobile and desktop) */}
      <Dialog
        open={isFilterOpen}
        onOpenChange={(open) => {
          setIsFilterOpen(open);
          if (!open) setDraftFilters(filters);
        }}
      >
        <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] sm:w-full max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
              <DialogHeader className="mb-2">
                <DialogTitle className="text-base sm:text-lg">Filter shoots</DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Narrow the list by status, assignments, services, and priority.
                </p>
              </DialogHeader>

              <div className="space-y-4 sm:space-y-6">
                <section>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Status</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {STATUS_FILTERS.map((status) => {
                      const active = draftFilters.statuses.includes(status.value);
                      return (
                        <button
                          key={status.value}
                          onClick={() =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              statuses: active
                                ? prev.statuses.filter((s) => s !== status.value)
                                : [...prev.statuses, status.value],
                            }))
                          }
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                            active
                              ? 'bg-primary/10 border-primary/40 text-primary'
                              : 'border-border text-muted-foreground',
                          )}
                        >
                          {status.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-3 sm:gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Client</p>
                      <Select
                        value={draftFilters.client}
                        onValueChange={(value) =>
                          setDraftFilters((prev) => ({ ...prev, client: value }))
                        }
                      >
                        <SelectTrigger className="rounded-xl border-border bg-muted/40">
                          <SelectValue placeholder="All clients" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientOptions.map((client) => (
                            <SelectItem key={client} value={client}>
                              {client === 'all' ? 'All clients' : client}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Search address, zip</p>
                      <Input
                        value={draftFilters.address}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({ ...prev, address: event.target.value }))
                        }
                        placeholder="City, street, zip"
                        className="rounded-xl border-border bg-muted/40"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Photographer</p>
                  <div className="rounded-2xl border border-border/60 bg-muted/30">
                    <ScrollArea className="max-h-64">
                      <div className="p-3 space-y-2">
                        {photographerOptions.map((photographer) => {
                          const checked = draftFilters.photographerIds.includes(photographer.id);
                          return (
                            <label
                              key={photographer.id}
                              className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-background/60"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) =>
                                  setDraftFilters((prev) => ({
                                    ...prev,
                                    photographerIds: value
                                      ? [...prev.photographerIds, photographer.id]
                                      : prev.photographerIds.filter((id) => id !== photographer.id),
                                  }))
                                }
                              />
                              <Avatar
                                src={photographer.avatar}
                                initials={photographer.name[0]}
                                className="w-8 h-8 rounded-full"
                              />
                              <span className="text-sm font-medium">{photographer.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <label className="flex items-center gap-2 px-4 py-3 border-t border-border/60 text-sm text-muted-foreground">
                      <Checkbox
                        checked={draftFilters.unassignedOnly}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({ ...prev, unassignedOnly: Boolean(value) }))
                        }
                      />
                      Unassigned only
                    </label>
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Services</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {serviceOptions.map((serviceKey) => {
                      const active = draftFilters.services.includes(serviceKey);
                      const label = SERVICE_LABELS[serviceKey] || serviceKey.replace(/_/g, ' ');
                      return (
                        <button
                          key={serviceKey}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                            active
                              ? 'bg-primary/10 border-primary/40 text-primary'
                              : 'border-border text-muted-foreground',
                          )}
                          onClick={() =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              services: active
                                ? prev.services.filter((s) => s !== serviceKey)
                                : [...prev.services, serviceKey],
                            }))
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                    {serviceOptions.length === 0 && (
                      <span className="text-sm text-muted-foreground">No services detected</span>
                    )}
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Date range</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {DATE_RANGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                          draftFilters.dateRange === option.value
                            ? 'bg-primary/10 border-primary/40 text-primary'
                            : 'border-border text-muted-foreground',
                        )}
                        onClick={() =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            dateRange: prev.dateRange === option.value ? null : option.value,
                          }))
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {draftFilters.dateRange === 'custom' && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Input
                        type="date"
                        value={draftFilters.customRange.from}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            customRange: { ...prev.customRange, from: event.target.value },
                          }))
                        }
                      />
                      <Input
                        type="date"
                        value={draftFilters.customRange.to}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            customRange: { ...prev.customRange, to: event.target.value },
                          }))
                        }
                      />
                    </div>
                  )}
                </section>

                <section>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Priority & flags</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={draftFilters.flaggedOnly}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({ ...prev, flaggedOnly: Boolean(value) }))
                        }
                      />
                      Only flagged
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={draftFilters.priority.highPriority}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            priority: { ...prev.priority, highPriority: Boolean(value) },
                          }))
                        }
                      />
                      High priority
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={draftFilters.priority.missingRaw}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            priority: { ...prev.priority, missingRaw: Boolean(value) },
                          }))
                        }
                      />
                      Missing RAW
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={draftFilters.priority.missingEditor}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            priority: { ...prev.priority, missingEditor: Boolean(value) },
                          }))
                        }
                      />
                      Missing editor
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={draftFilters.priority.overdue}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            priority: { ...prev.priority, overdue: Boolean(value) },
                          }))
                        }
                      />
                      Overdue
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={draftFilters.priority.unpaid}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            priority: { ...prev.priority, unpaid: Boolean(value) },
                          }))
                        }
                      />
                      Unpaid
                    </label>
                  </div>
                </section>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button variant="ghost" className="flex-1" onClick={cancelFilters}>
                  Cancel
                </Button>
                <Button variant="outline" className="flex-1" onClick={resetFilters}>
                  Reset all filters
                </Button>
                <Button className="flex-1" onClick={applyFilters}>
                  Apply filters
                </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Content based on active tab - flex-1 to fill remaining space */}
      <div className="flex-1 flex flex-col">
        {activeTab === 'upcoming' ? (
          paginatedGroups.length === 0 ? (
            <div className="flex-1 w-full min-h-[120px] flex items-center justify-center text-center text-sm text-slate-500">
              No upcoming shoots found.
            </div>
          ) : (
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 space-y-6 overflow-y-auto hidden-scrollbar pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0"
            >
              {paginatedGroups.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <p className="text-xs font-semibold text-muted-foreground">
                      {group.label}
                    </p>
                  </div>
                  {group.shoots.map((shoot) => renderShootCard(shoot, false))}
                </div>
              ))}
              {hasMore && (
                <div className="flex justify-center py-2 text-xs text-muted-foreground">
                  Scroll for more
                </div>
              )}
            </div>
          )
        ) : (
          filteredRequestedShoots.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center text-sm text-slate-500 pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0">
              No pending requests.
            </div>
          ) : (
            <div 
              className="flex-1 min-h-0 space-y-6 overflow-y-auto hidden-scrollbar pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0"
            >
              {requestedGroups.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <p className="text-xs font-semibold text-muted-foreground">
                      {group.label}
                    </p>
                  </div>
                  {group.shoots.map((shoot) => renderShootCard(shoot, true))}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </Card>
  );
};
