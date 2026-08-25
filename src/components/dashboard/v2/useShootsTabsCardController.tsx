import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import type { DashboardShootServiceTag, DashboardShootSummary } from '@/types/dashboard';
import { Avatar } from './SharedComponents';
import { ServicePills } from './ServicePills';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Check, Cloud, CloudRain, Edit, Eye, Flag, MapPin, Snowflake, Sun, Upload, X } from 'lucide-react';
import { getIconComponent } from '@/components/scheduling/IconPicker';
import { getWeatherForLocation, type WeatherInfo } from '@/services/weatherService';
import { subscribeToWeatherProvider } from '@/state/weatherProviderStore';
import { formatWorkflowStatus } from '@/utils/status';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { canFilterByPhotographer, normalizeDashboardRole } from '@/utils/dashboardFilterPermissions';
import {
  DATE_RANGE_OPTIONS,
  SERVICE_ICON_MAP,
  SERVICE_LABELS,
  STATUS_COLORS,
  STATUS_FILTERS,
  countActiveFilters,
  defaultFilters,
  getServiceKey,
  getSummaryLocalDate,
  isShootInPast,
  matchesDateRange,
  type FiltersState,
  type ShootsTabsCardProps,
  type TabType,
} from './shootsTabsCardUtils';
export function useShootsTabsCardController({
  upcomingShoots,
  requestedShoots,
  onSelect,
  onApprove,
  onDecline,
  onModify,
  onViewInvoice,
  role,
  mode = 'default',
  customTabs = [],
  title = 'Shoots',
}: ShootsTabsCardProps) {
  const normalizedRole = normalizeDashboardRole(role);
  const isPhotographerRole = normalizedRole === 'photographer';
  const showAssignmentFilters = canFilterByPhotographer(role);
  const isEditingManagerMode = mode === 'editing_manager' && customTabs.length > 0;
  const { formatTemperature, formatTime, formatDate } = useUserPreferences();
  const [activeTab, setActiveTab] = useState<TabType>(() =>
    isEditingManagerMode ? customTabs[0]?.id || 'upcoming' : 'upcoming'
  );
  const [hasUnreadRequests, setHasUnreadRequests] = useState(requestedShoots.length > 0);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<FiltersState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showPastDays, setShowPastDays] = useState(false);
  const [showPastRequests, setShowPastRequests] = useState(false);
  const [weatherMap, setWeatherMap] = useState<Record<number, WeatherInfo>>({});
  const weatherMapRef = useRef<Map<number, WeatherInfo>>(new Map());
  const [providerVersion, setProviderVersion] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCompactMobile, setIsCompactMobile] = useState(false);
  const lastRequestedCountRef = useRef<number>(requestedShoots.length);
  useEffect(() => {
    if (showAssignmentFilters) return;
    const clearRestrictedFilters = (current: FiltersState): FiltersState => {
      if (current.photographerIds.length === 0 && !current.unassignedOnly) return current;
      return { ...current, photographerIds: [], unassignedOnly: false };
    };
    setFilters(clearRestrictedFilters);
    setDraftFilters(clearRestrictedFilters);
  }, [showAssignmentFilters]);
  const SHOOTS_PER_PAGE = 5;
  const [visibleCount, setVisibleCount] = useState(SHOOTS_PER_PAGE);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const filterPanelHostRef = useRef<HTMLDivElement>(null);
  // Dynamic height so the list reveals ~7.5 cards at a time, peeking the 8th
  const [shootCardHeight, setShootCardHeight] = useState<number>(0);
  useEffect(() => {
    if (!isEditingManagerMode) return;
    if (!customTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(customTabs[0]?.id || 'upcoming');
    }
  }, [activeTab, customTabs, isEditingManagerMode]);
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
  const allShoots = useMemo(() => {
    if (isEditingManagerMode) {
      return customTabs.flatMap((tab) => tab.shoots);
    }
    return [...upcomingShoots, ...requestedShoots];
  }, [customTabs, isEditingManagerMode, upcomingShoots, requestedShoots]);
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
    const map = new Map<string, string>();
    allShoots.forEach((shoot) => {
      shoot.services.forEach((service) => {
        map.set(getServiceKey(service.label, service.type), service.label);
      });
    });
    return Array.from(map, ([key, label]) => ({ key, label }));
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
      if (showAssignmentFilters && filters.photographerIds.length) {
        const shootPhotographerId = shoot.photographer?.id ?? null;
        if (!shootPhotographerId || !filters.photographerIds.includes(shootPhotographerId)) {
          return false;
        }
      }
      if (showAssignmentFilters && filters.unassignedOnly && shoot.photographer) return false;
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
      if (!matchesDateRange(shoot, filters)) return false;
      return true;
    });
  }, [filters, showAssignmentFilters]);
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
        (shoot.scheduledLocalDate ? formatDate(shoot.scheduledLocalDate) : 'Upcoming');
      // Group by the intended LOCAL calendar day so the day bucket matches the
      // date shown on each card and never drifts across timezones.
      const shootDate = getSummaryLocalDate(shoot);
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
  const getRelativeGroupLabel = useCallback((group: { label: string; shoots: DashboardShootSummary[]; isToday?: boolean; dayTime?: number }) => {
    const count = group.shoots.length;
    const suffix = count === 1 ? '1 shoot' : `${count} shoots`;
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    if (group.isToday) return `Today \u2022 ${suffix}`;
    if (group.dayTime && Number.isFinite(group.dayTime)) {
      const groupDate = new Date(group.dayTime);
      if (isSameDay(groupDate, tomorrow)) return `Tomorrow \u2022 ${suffix}`;
      const diffMs = startOfDay(groupDate).getTime() - today.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays >= 2 && diffDays <= 6) {
        return `${format(groupDate, 'EEEE')} \u2022 ${suffix}`;
      }
      if (diffDays === -1) return `Yesterday \u2022 ${suffix}`;
      if (diffDays < -1) {
        const absDays = Math.abs(diffDays);
        return absDays > 10
          ? `${Math.round(absDays / 7)} weeks ago \u2022 ${suffix}`
          : `${absDays} days ago \u2022 ${suffix}`;
      }
      return diffDays > 10
        ? `In ${Math.round(diffDays / 7)} weeks \u2022 ${suffix}`
        : `In ${diffDays} days \u2022 ${suffix}`;
    }
    return `${group.label} \u2022 ${suffix}`;
  }, []);
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
  const editingManagerTabs = useMemo(
    () => (isEditingManagerMode ? customTabs : []),
    [customTabs, isEditingManagerMode],
  );
  const activeEditingManagerTab = useMemo(
    () => editingManagerTabs.find((tab) => tab.id === activeTab) ?? editingManagerTabs[0],
    [activeTab, editingManagerTabs],
  );
  const filteredEditingManagerShoots = useMemo(
    () => filterShoots(activeEditingManagerTab?.shoots ?? []),
    [activeEditingManagerTab, filterShoots],
  );
  const { groups: editingManagerGroups, hasPastDays: editingManagerHasPastDays } = useMemo(
    () => groupShootsByDay(filteredEditingManagerShoots),
    [filteredEditingManagerShoots, groupShootsByDay],
  );
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
  const {
    paginatedGroups: editingManagerPaginatedGroups,
    hasMore: editingManagerHasMore,
  } = useMemo(() => {
    const total = editingManagerGroups.flatMap((group) => group.shoots).length;
    const hasMoreShoots = visibleCount < total;
    let shootsRemaining = visibleCount;
    const paginated: typeof editingManagerGroups = [];
    for (const group of editingManagerGroups) {
      if (shootsRemaining <= 0) break;
      const shootsToShow = group.shoots.slice(0, shootsRemaining);
      if (shootsToShow.length > 0) {
        paginated.push({ ...group, shoots: shootsToShow });
        shootsRemaining -= shootsToShow.length;
      }
    }
    return {
      paginatedGroups: paginated,
      totalShootsCount: total,
      hasMore: hasMoreShoots,
    };
  }, [editingManagerGroups, visibleCount]);
  useEffect(() => {
    setVisibleCount(SHOOTS_PER_PAGE);
  }, [filters, activeTab]);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const nearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    if (nearBottom && (hasMore || editingManagerHasMore)) {
      setVisibleCount(prev => prev + SHOOTS_PER_PAGE);
    }
  }, [hasMore, editingManagerHasMore]);
  const loadMoreShoots = useCallback(() => {
    setVisibleCount(prev => prev + SHOOTS_PER_PAGE);
  }, []);
  // Auto-load more when the sentinel scrolls into the viewport. Handles the
  // case where the inner scroll container does not overflow (items fit within
  // its height) and onScroll never fires.
  useEffect(() => {
    const anyMore = hasMore || editingManagerHasMore;
    if (!anyMore) return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount(prev => prev + SHOOTS_PER_PAGE);
        }
      },
      { root: scrollContainerRef.current ?? null, rootMargin: '200px 0px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, editingManagerHasMore, activeTab]);
  // Measure a representative shoot card so the container height shows ~7.5 cards
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const firstCard = container.querySelector<HTMLElement>('[data-shoot-card="true"]');
    if (!firstCard) return;
    const update = () => {
      const height = firstCard.offsetHeight;
      if (height > 0) setShootCardHeight(height);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(firstCard);
    return () => observer.disconnect();
  }, [paginatedGroups, editingManagerPaginatedGroups, activeTab]);
  // ~7.5 cards tall: 7 full + half of 8th, plus gaps (space-y-3 between cards
  // in a group) and a small allowance for the first group label.
  const listMaxHeight = useMemo(() => {
    if (shootCardHeight <= 0) return undefined;
    const inGroupGap = 12; // space-y-3
    const labelAllowance = 40; // first group label + top spacing
    return `${Math.ceil(shootCardHeight * 7.5 + inGroupGap * 7 + labelAllowance)}px`;
  }, [shootCardHeight]);
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
  const getShootDateParts = (shoot: DashboardShootSummary) => {
    const shootDate = getSummaryLocalDate(shoot);
    const validDate = shootDate && !Number.isNaN(shootDate.getTime()) ? shootDate : null;
    const rawTime =
      shoot.timeLabel ||
      (validDate
        ? `${validDate.getHours().toString().padStart(2, '0')}:${validDate.getMinutes().toString().padStart(2, '0')}`
        : null);
    return {
      month: validDate ? validDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '--',
      day: validDate ? String(validDate.getDate()) : '--',
      weekday: validDate ? validDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : '',
      time: rawTime ? formatTime(rawTime) : '--',
    };
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
        return [{ label: service.label.trim(), type: service.type, icon: service.icon }];
      }
      return parts.map((part) => ({ label: part, type: service.type, icon: service.icon }));
    });
    const weather = weatherMap[shoot.id];
    const dateParts = getShootDateParts(shoot);
    const openRawSubmission = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onSelect(shoot, weather);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('shoot-media-open-upload', {
          detail: { shootId: shoot.id, displayTab: 'uploaded' },
        }));
      }, 0);
    };
    return (
      <div
        key={shoot.id}
        data-shoot-card="true"
        onClick={() => onSelect(shoot, weather)}
        className={cn(
          "relative border rounded-3xl px-5 pt-4 pb-3.5 sm:p-5 hover:shadow-lg transition-all cursor-pointer bg-card group",
          isCompactMobile && "px-3 py-2.5 rounded-2xl sm:rounded-2xl sm:px-4 sm:py-3",
          isRequested 
            ? "border-blue-400 bg-blue-50/30 dark:bg-blue-950/20 hover:border-blue-500" 
            : "border-border hover:border-primary/40"
        )}
      >
        {/* ── Compact layout (mobile compact toggle + desktop/tablet compact toggle) ── */}
        {isCompactMobile && (
          <div className="grid grid-cols-[48px,1fr,auto] items-center gap-3 min-h-[62px] sm:grid-cols-[56px,1fr,auto] sm:gap-4 sm:min-h-[68px]">
            <div className="rounded-xl border border-border/80 bg-muted/40 dark:bg-muted/20 px-2 py-2 text-center shadow-sm">
              <p className="text-[9px] font-semibold text-muted-foreground leading-none sm:text-[10px]">{dateParts.month}</p>
              <p className="mt-0.5 text-lg font-bold leading-none text-foreground sm:text-xl">{dateParts.day}</p>
              <p className="mt-1 text-[9px] font-semibold leading-none text-muted-foreground sm:text-[10px]">{dateParts.weekday}</p>
            </div>
            <div className="min-w-0 border-l border-border/60 pl-3">
              <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">{shoot.addressLine}</h3>
              <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground sm:text-xs">
                <MapPin size={10} className="shrink-0" />
                <span className="truncate">{shoot.cityStateZip}</span>
              </p>
              <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground sm:text-xs">
                <span className="shrink-0">Client</span>
                <span className="font-semibold text-foreground truncate">• {shoot.clientName || 'Client TBD'}</span>
                <span className="shrink-0">• #{shoot.id}</span>
              </p>
            </div>
            <div className="flex h-full min-w-[76px] flex-col items-end justify-center gap-2 sm:min-w-[96px]">
              <span className="text-xs font-semibold text-primary sm:text-sm">{dateParts.time}</span>
              <span
                className={cn(
                  'inline-flex max-w-[76px] items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap sm:max-w-[96px] sm:text-[11px]',
                  statusClass,
                )}
              >
                <span className="truncate">{formatWorkflowStatus(shoot.workflowStatus || shoot.status)}</span>
              </span>
            </div>
          </div>
        )}
        <div className={cn("sm:hidden space-y-2.5", isCompactMobile && "hidden")}>
          {/* Row 1: Date+time badge + Weather (right-aligned) */}
          <div className="flex items-start gap-2">
            <div className="rounded-xl border border-border/80 bg-muted/40 dark:bg-muted/20 px-2.5 py-1.5 shadow-sm flex-shrink-0 flex items-center gap-2">
              {(() => {
                const shootDate = getSummaryLocalDate(shoot);
                const monthStr = shootDate ? shootDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '--';
                const dayStr = shootDate ? String(shootDate.getDate()) : '';
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
                  <>
                    <span className="text-[11px] font-bold text-foreground whitespace-nowrap">{monthStr} {dayStr}</span>
                    <span className="text-border/80 text-[10px]">|</span>
                    <span className="text-[11px] font-semibold text-primary whitespace-nowrap">{formattedTime}</span>
                  </>
                );
              })()}
            </div>
            <div className="ml-auto flex flex-col items-end gap-1 flex-shrink-0">
              <div className="inline-flex items-center h-5 gap-1 rounded-full border border-border px-2 text-[10px] font-semibold text-muted-foreground bg-background shadow-sm">
                {renderWeatherIcon(weather?.icon)}
                <span>{getShootTemperatureLabel(shoot, weather)}</span>
              </div>
              {shoot.isFlagged && (
                <span className="inline-flex items-center h-5 gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 text-[10px] font-semibold text-destructive shadow-sm">
                  <Flag size={10} />
                  <span>Flagged</span>
                </span>
              )}
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
          <ServicePills shootId={shoot.id} items={serviceList} variant="compact" preferMappedLabel />
          {/* Row 5: Status left + Photographer right */}
          <hr className="border-border" />
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold border whitespace-nowrap',
                statusClass,
              )}
            >
              {formatWorkflowStatus(shoot.workflowStatus || shoot.status)}
            </span>
            <div className="text-[10px] text-muted-foreground">
              {isPhotographerRole ? (
                <span>Client <span className="font-semibold text-foreground">• {shoot.clientName || 'Client TBD'}</span>
                  {(() => {
                    if (!shoot.clientPhone || !shoot.startTime) return null;
                    const shootStart = new Date(shoot.startTime).getTime();
                    const now = Date.now();
                    const oneHourBefore = shootStart - 60 * 60 * 1000;
                    if (now >= oneHourBefore && now <= shootStart) {
                      return <span className="ml-2 font-semibold text-primary">📞 {shoot.clientPhone}</span>;
                    }
                    return null;
                  })()}
                </span>
              ) : (
                <span>Photographer <span className="font-semibold text-foreground">• {shoot.photographer?.name || 'Unassigned'}</span></span>
              )}
            </div>
          </div>
        </div>
        {/* ── Desktop layout (hidden when compact toggle is on) ── */}
        <div className={cn(
          "hidden sm:grid sm:grid-cols-[auto,1fr,auto] items-stretch gap-4",
          isCompactMobile && "sm:hidden"
        )}>
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
            <div className="w-20 rounded-2xl border border-border/80 bg-muted/40 dark:bg-muted/20 text-center pt-3 pb-2 shadow-sm flex-shrink-0">
              {(() => {
                const shootDate = getSummaryLocalDate(shoot);
                const monthStr = shootDate ? shootDate.toLocaleDateString('en-US', { month: 'short' }) : '--';
                const dayStr = shootDate ? String(shootDate.getDate()) : '';
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
                  <>
                    <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">{monthStr}</p>
                    <p className="text-xl font-bold text-foreground leading-tight tracking-tight">{dayStr}</p>
                    <hr className="my-1.5 border-border/60" />
                    <p className="text-xs font-semibold text-primary">{formattedTime}</p>
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
            <ServicePills shootId={shoot.id} items={serviceList} variant="desktop" preferMappedLabel />
          </div>
          <div className="flex flex-col items-end gap-3 min-w-[120px] justify-between">
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground bg-background shadow-sm">
                {renderWeatherIcon(weather?.icon)}
                <span>{getShootTemperatureLabel(shoot, weather)}</span>
              </div>
              {shoot.isFlagged && (
                <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive shadow-sm">
                  <Flag size={12} />
                  <span>Flagged</span>
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {isPhotographerRole ? (
                <>
                  Client{' '}
                  <span className="font-semibold text-foreground">
                    • {shoot.clientName || 'Client TBD'}
                  </span>
                  {(() => {
                    if (!shoot.clientPhone || !shoot.startTime) return null;
                    const shootStart = new Date(shoot.startTime).getTime();
                    const now = Date.now();
                    const oneHourBefore = shootStart - 60 * 60 * 1000;
                    if (now >= oneHourBefore && now <= shootStart) {
                      return <span className="ml-2 font-semibold text-primary">📞 {shoot.clientPhone}</span>;
                    }
                    return null;
                  })()}
                </>
              ) : (
                <>
                  Photographer{' '}
                  <span className="font-semibold text-foreground">
                    • {shoot.photographer?.name || 'Unassigned'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {isPhotographerRole && shoot.canSubmitRaw && (
          <button
            type="button"
            onClick={openRawSubmission}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70"
          >
            <Upload className="h-3.5 w-3.5" />
            Needs submission
          </button>
        )}
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
      if (activeTab === 'requested') {
        setActiveTab('upcoming');
      }
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
  return {
    upcomingShoots,
    requestedShoots,
    onSelect,
    onApprove,
    onDecline,
    onModify,
    onViewInvoice,
    role,
    mode,
    customTabs,
    title,
    normalizedRole,
    isPhotographerRole,
    showAssignmentFilters,
    isEditingManagerMode,
    formatTemperature,
    formatTime,
    formatDate,
    activeTab,
    setActiveTab,
    hasUnreadRequests,
    setHasUnreadRequests,
    filters,
    setFilters,
    draftFilters,
    setDraftFilters,
    isFilterOpen,
    setIsFilterOpen,
    showPastDays,
    setShowPastDays,
    showPastRequests,
    setShowPastRequests,
    weatherMap,
    providerVersion,
    isMenuOpen,
    setIsMenuOpen,
    isCompactMobile,
    setIsCompactMobile,
    SHOOTS_PER_PAGE,
    visibleCount,
    setVisibleCount,
    scrollContainerRef,
    loadMoreSentinelRef,
    filterPanelHostRef,
    shootCardHeight,
    pastRequests,
    currentRequests,
    hasPastRequests,
    visibleRequestedShoots,
    allShoots,
    clientOptions,
    photographerOptions,
    serviceOptions,
    applyFilters,
    resetFilters,
    cancelFilters,
    filterShoots,
    filteredUpcomingShoots,
    filteredRequestedShoots,
    activeFilterCount,
    groupShootsByDay,
    getRelativeGroupLabel,
    upcomingGroups,
    hasPastDays,
    requestedGroups,
    editingManagerTabs,
    activeEditingManagerTab,
    filteredEditingManagerShoots,
    editingManagerGroups,
    editingManagerHasPastDays,
    paginatedGroups,
    totalShootsCount,
    hasMore,
    editingManagerPaginatedGroups,
    editingManagerHasMore,
    handleScroll,
    loadMoreShoots,
    listMaxHeight,
    renderWeatherIcon,
    getShootTemperatureLabel,
    getShootDateParts,
    renderShootCard,
    upcomingCount,
    requestedCount,
  };
}
