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

interface UpcomingShootsCardProps {
  shoots: DashboardShootSummary[];
  onSelect: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
  onApprove?: (shoot: DashboardShootSummary) => void;
  onDecline?: (shoot: DashboardShootSummary) => void;
  onModify?: (shoot: DashboardShootSummary) => void;
  onViewInvoice?: (shoot: DashboardShootSummary) => void;
  role?: string;
  title?: string;
  subtitle?: string;
  emptyStateText?: string;
  defaultShowPastDays?: boolean;
}

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

const groupShoots = (shoots: DashboardShootSummary[]) =>
  shoots.reduce<Record<string, DashboardShootSummary[]>>((acc, shoot) => {
    const label = shoot.dayLabel || 'Upcoming';
    if (!acc[label]) acc[label] = [];
    acc[label].push(shoot);
    return acc;
  }, {});

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

const getWeatherIcon = (temperature?: string | null) => {
  if (!temperature) return <Sun size={16} />;
  const tempNum = parseInt(temperature, 10);
  if (Number.isNaN(tempNum)) return <Sun size={16} />;
  if (tempNum <= 32) return <Snowflake size={16} />;
  if (tempNum <= 55) return <Cloud size={16} />;
  if (tempNum >= 90) return <Sun size={16} />;
  return <CloudRain size={16} />;
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

export const UpcomingShootsCard: React.FC<UpcomingShootsCardProps> = React.memo(({
  shoots,
  onSelect,
  onApprove,
  onDecline,
  onModify,
  onViewInvoice,
  role,
  title,
  subtitle,
  emptyStateText,
  defaultShowPastDays,
}) => {
  // Hide client info for photographers and editors
  const hideClientInfo = role === 'photographer' || role === 'editor';
  // Hide weather for editors (they don't need it)
  const hideWeather = role === 'editor';
  const { formatTemperature, formatTime, formatDate } = useUserPreferences();
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<FiltersState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showPastDays, setShowPastDays] = useState(Boolean(defaultShowPastDays));
  const [showRequestsFirst, setShowRequestsFirst] = useState(false);
  const [weatherMap, setWeatherMap] = useState<Record<number, WeatherInfo>>({});
  const weatherMapRef = useRef<Map<number, WeatherInfo>>(new Map());
  const [providerVersion, setProviderVersion] = useState(0);
  const [hoveredShoot, setHoveredShoot] = useState<number | null>(null);
  
  // Pagination state - show 5 shoots at a time
  const SHOOTS_PER_PAGE = 5;
  const [visibleCount, setVisibleCount] = useState(SHOOTS_PER_PAGE);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const displayTitle = title ?? 'Upcoming shoots';
  const filterTitle = title ? `Filter ${title.toLowerCase()}` : 'Filter upcoming shoots';
  const emptyText = emptyStateText ?? 'No upcoming shoots found.';

  // Count requested shoots
  const requestedShootsCount = useMemo(() => 
    shoots.filter(s => s.status?.toLowerCase() === 'requested' || s.workflowStatus?.toLowerCase() === 'requested').length,
    [shoots]
  );

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

  const clientOptions = useMemo(
    () => ['all', ...new Set(shoots.map((shoot) => shoot.clientName).filter(Boolean) as string[])],
    [shoots],
  );

  const photographerOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; avatar?: string | null }>();
    shoots.forEach((shoot) => {
      if (shoot.photographer) {
        map.set(shoot.photographer.id, {
          id: shoot.photographer.id,
          name: shoot.photographer.name,
          avatar: shoot.photographer.avatar,
        });
      }
    });
    return Array.from(map.values());
  }, [shoots]);

  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    shoots.forEach((shoot) => {
      shoot.services.forEach((service) => {
        set.add(getServiceKey(service.label, service.type));
      });
    });
    return Array.from(set);
  }, [shoots]);

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

  const filteredShoots = useMemo(() => {
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
  }, [shoots, filters]);

  const activeFilterCount = countActiveFilters(filters);

  const { visibleGroups, hasPastDays, pastButtonLabel } = useMemo(() => {
    const today = startOfDay(new Date());
    const todayStart = today.getTime();

    const groupsMap = new Map<
      string,
      { label: string; shoots: DashboardShootSummary[]; isPast: boolean; isToday: boolean; dayTime: number }
    >();

    filteredShoots.forEach((shoot) => {
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

    // Include all groups: past (if shown), today, future
    // Also include any groups with requested shoots regardless of date
    const requestedPastGroups = pastGroups.filter(group => 
      group.shoots.some(s => s.status?.toLowerCase() === 'requested' || s.workflowStatus?.toLowerCase() === 'requested')
    );
    
    let finalGroups = [...visiblePastGroups, ...todayGroups, ...futureGroups];
    
    // Add past groups with requested shoots even if showPastDays is false
    if (!showPastDays && requestedPastGroups.length > 0) {
      // Add requested shoots from past groups to the beginning
      const requestedFromPast = requestedPastGroups.flatMap(g => 
        g.shoots.filter(s => s.status?.toLowerCase() === 'requested' || s.workflowStatus?.toLowerCase() === 'requested')
      );
      if (requestedFromPast.length > 0) {
        const requestedPastGroup = {
          label: 'Pending Approval',
          shoots: requestedFromPast,
          isPast: false,
          isToday: false,
          dayTime: 0,
        };
        finalGroups = [requestedPastGroup, ...finalGroups];
      }
    }

    // If showRequestsFirst is enabled, extract ALL requested shoots and show them in a separate group at the top
    if (showRequestsFirst) {
      // Collect all requested shoots from all groups
      const allRequestedShoots: DashboardShootSummary[] = [];
      const groupsWithoutRequested = finalGroups.map(group => {
        const requestedInGroup = group.shoots.filter(s => 
          s.status?.toLowerCase() === 'requested' || s.workflowStatus?.toLowerCase() === 'requested'
        );
        const nonRequestedInGroup = group.shoots.filter(s => 
          s.status?.toLowerCase() !== 'requested' && s.workflowStatus?.toLowerCase() !== 'requested'
        );
        allRequestedShoots.push(...requestedInGroup);
        return {
          ...group,
          shoots: nonRequestedInGroup,
        };
      }).filter(group => group.shoots.length > 0); // Remove empty groups

      // Create a special "Requested" group at the top if there are any requested shoots
      if (allRequestedShoots.length > 0) {
        const requestedGroup = {
          label: 'Pending Approval',
          shoots: allRequestedShoots,
          isPast: false,
          isToday: false,
          dayTime: 0, // Ensure it stays at top
        };
        finalGroups = [requestedGroup, ...groupsWithoutRequested];
      } else {
        finalGroups = groupsWithoutRequested;
      }
    }

    return {
      visibleGroups: finalGroups,
      hasPastDays,
      pastButtonLabel: showPastDays ? 'Hide' : 'Previous shoots',
    };
  }, [filteredShoots, showPastDays, showRequestsFirst]);

  // Calculate total shoots and paginated groups
  const { paginatedGroups, totalShootsCount, hasMore } = useMemo(() => {
    const allShoots = visibleGroups.flatMap(g => g.shoots);
    const total = allShoots.length;
    const hasMoreShoots = visibleCount < total;
    
    // Build paginated groups showing only visibleCount shoots
    let shootsRemaining = visibleCount;
    const paginated: typeof visibleGroups = [];
    
    for (const group of visibleGroups) {
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
  }, [visibleGroups, visibleCount]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(SHOOTS_PER_PAGE);
  }, [filters, showRequestsFirst]);

  // Handle scroll for infinite loading
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
      // Filter shoots that need weather data and have valid locations
      const shootsNeedingWeather = shoots.filter(shoot => 
        !weatherMapRef.current.has(shoot.id) && 
        (shoot.cityStateZip || shoot.addressLine)
      );

      if (shootsNeedingWeather.length === 0) return;

      // Fire all requests in parallel - resultCache in weatherService handles deduplication
      await Promise.all(
        shootsNeedingWeather.map(async (shoot) => {
          const location = shoot.cityStateZip || shoot.addressLine!;
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
  }, [shoots, providerVersion]);

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

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between mb-4 gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{displayTitle}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {requestedShootsCount > 0 && (
            <Button
              variant={showRequestsFirst ? "default" : "outline"}
              size="sm"
              className={`text-xs rounded-full ${showRequestsFirst ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950'}`}
              onClick={() => setShowRequestsFirst((prev) => !prev)}
            >
              Shoot requests +{requestedShootsCount}
            </Button>
          )}
          {hasPastDays && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastDays((prev) => !prev)}
            >
              {pastButtonLabel}
            </Button>
          )}
          <Dialog
            open={isFilterOpen}
            onOpenChange={(open) => {
              setIsFilterOpen(open);
              if (open) {
                setDraftFilters(filters);
              } else {
                setDraftFilters(filters);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-900"
                onClick={() => setIsFilterOpen(true)}
              >
                <Filter size={14} className="mr-1.5" />
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] sm:w-full max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
              <DialogHeader className="mb-2">
                <DialogTitle className="text-base sm:text-lg">{filterTitle}</DialogTitle>
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
        </div>
      </div>

      {paginatedGroups.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="space-y-6 overflow-y-auto hidden-scrollbar"
          style={{ maxHeight: '800px' }}
        >
          {paginatedGroups.map((group) => (
            <div key={group.label} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <p className="text-xs font-semibold text-muted-foreground">
                  {group.label}
                </p>
              </div>
              {group.shoots.map((shoot) => {
                const statusKey = (shoot.workflowStatus || shoot.status || '').toLowerCase();
                const statusClass = STATUS_COLORS[statusKey] || STATUS_COLORS.scheduled;
                const isRequested = statusKey === 'requested';
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
                    <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] items-stretch gap-3 sm:gap-4">
                      <div className="flex flex-row sm:flex-col items-center sm:items-center gap-2 sm:gap-2">
                        {/* For requested shoots, show status ABOVE time */}
                        {isRequested && (
                          <span
                            className={cn(
                              'px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold border whitespace-nowrap order-first sm:order-first',
                              statusClass,
                            )}
                          >
                            {formatWorkflowStatus(shoot.workflowStatus || shoot.status)}
                          </span>
                        )}
                        <div className="w-16 sm:w-20 rounded-xl sm:rounded-2xl border border-border bg-background text-center py-2 sm:py-3 shadow-sm flex-shrink-0">
                          {(() => {
                            const formattedTime = shoot.timeLabel ? formatTime(shoot.timeLabel) : '--';
                            const parts = formattedTime.split(' ');
                            return (
                              <>
                                <p className="text-lg sm:text-xl font-semibold text-foreground leading-none">
                                  {parts[0] || '--'}
                                </p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">
                                  {parts[1] || ''}
                                </p>
                              </>
                            );
                          })()}
                        </div>
                        {/* For non-requested shoots, show status BELOW time */}
                        {!isRequested && (
                          <span
                            className={cn(
                              'px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold border whitespace-nowrap',
                              statusClass,
                            )}
                          >
                            {formatWorkflowStatus(shoot.workflowStatus || shoot.status)}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 sm:space-y-3 min-w-0">
                        <div>
                          <h3 className="text-sm sm:text-base font-semibold text-foreground break-words">{shoot.addressLine}</h3>
                          <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin size={10} className="sm:w-3 sm:h-3" />
                            {shoot.cityStateZip}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] sm:text-xs text-muted-foreground">
                          {!hideClientInfo && (
                            <span>Client <span className="font-semibold text-foreground">• {shoot.clientName || 'Client TBD'}</span></span>
                          )}
                          <span>Shoot ID <span className="font-semibold text-foreground">• #{shoot.id}</span></span>
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 flex-wrap text-[10px] sm:text-xs text-muted-foreground transition-all">
                          {visibleServices.map((tag, index) => {
                            const key = getServiceKey(tag.label, tag.type);
                            const icon = SERVICE_ICON_MAP[key] || <Camera size={10} className="sm:w-3 sm:h-3" />;
                            return (
                              <span
                                key={`${shoot.id}-${key}-${index}`}
                                className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-border/70 bg-background text-[10px] sm:text-[11px] font-semibold text-muted-foreground"
                              >
                                {icon}
                                {SERVICE_LABELS[key] || tag.label}
                              </span>
                            );
                          })}
                          {hidden > 0 && (
                            <Badge
                              variant="outline"
                              className="rounded-full border-dashed text-muted-foreground px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px]"
                            >
                              +{hidden} more
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-3 sm:min-w-[120px] justify-between sm:justify-between">
                        {!hideWeather && (
                          <div className="flex items-center gap-1 rounded-full border border-border px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold text-muted-foreground bg-background shadow-sm">
                            {renderWeatherIcon(weather?.icon)}
                            <span>{(() => {
                              const temp = weather?.temperature ?? shoot.temperature;
                              if (!temp) return '--°';
                              if (typeof temp === 'number') return formatTemperature(temp);
                              const match = String(temp).match(/^(-?\d+)/);
                              if (match) return formatTemperature(parseInt(match[1], 10));
                              return temp;
                            })()}</span>
                          </div>
                        )}
                        <div className="text-[10px] sm:text-xs text-muted-foreground text-right sm:text-right">
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
              })}
            </div>
          ))}
          {/* Scroll indicator */}
          {hasMore && (
            <div className="flex justify-center py-2 text-xs text-muted-foreground">
              Scroll for more
            </div>
          )}
        </div>
      )}
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  if (prevProps.shoots.length !== nextProps.shoots.length) return false;
  if (prevProps.shoots !== nextProps.shoots) {
    // Check if shoot IDs are the same (shallow comparison)
    const prevIds = prevProps.shoots.map(s => s.id).join(',');
    const nextIds = nextProps.shoots.map(s => s.id).join(',');
    if (prevIds !== nextIds) return false;
  }
  return (
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.onApprove === nextProps.onApprove &&
    prevProps.onDecline === nextProps.onDecline &&
    prevProps.onModify === nextProps.onModify &&
    prevProps.onViewInvoice === nextProps.onViewInvoice
  );
});

