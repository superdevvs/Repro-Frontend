import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfDay, isSameDay, isAfter } from 'date-fns';
import { DashboardShootSummary } from '@/types/dashboard';
import { Card, Avatar } from './SharedComponents';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Flag,
  Sun,
  CloudRain,
  Cloud,
  Snowflake,
  Camera,
  Plane,
  Film,
  Map as MapIcon,
  Home,
  Sparkles,
  Check,
  X,
  Edit,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getWeatherForLocation, WeatherInfo } from '@/services/weatherService';
import { subscribeToWeatherProvider } from '@/state/weatherProviderStore';
import { formatWorkflowStatus } from '@/utils/status';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

interface RequestedShootsSectionProps {
  shoots: DashboardShootSummary[];
  onSelect: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
  onApprove?: (shoot: DashboardShootSummary) => void;
  onDecline?: (shoot: DashboardShootSummary) => void;
  onModify?: (shoot: DashboardShootSummary) => void;
}

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
};

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

const getServiceKey = (label: string, type?: string) => type || label.toLowerCase().replace(/\s+/g, '_');

const groupShootsByDate = (shoots: DashboardShootSummary[]) => {
  const groups: Record<string, DashboardShootSummary[]> = {};
  shoots.forEach((shoot) => {
    const label = shoot.dayLabel || 'Upcoming';
    if (!groups[label]) groups[label] = [];
    groups[label].push(shoot);
  });
  return Object.entries(groups).map(([label, shoots]) => ({ label, shoots }));
};

const isShootInPast = (shoot: DashboardShootSummary) => {
  if (!shoot.startTime) return false;
  const shootDate = new Date(shoot.startTime);
  const today = startOfDay(new Date());
  return !isSameDay(shootDate, today) && !isAfter(shootDate, today);
};

export const RequestedShootsSection: React.FC<RequestedShootsSectionProps> = ({
  shoots,
  onSelect,
  onApprove,
  onDecline,
  onModify,
}) => {
  const { formatTemperature, formatTime } = useUserPreferences();
  const [weatherMap, setWeatherMap] = useState<Record<number, WeatherInfo>>({});
  const weatherMapRef = useRef<Map<number, WeatherInfo>>(new Map());
  const [providerVersion, setProviderVersion] = useState(0);
  const [hoveredShoot, setHoveredShoot] = useState<number | null>(null);
  const [showPastRequests, setShowPastRequests] = useState(false);

  // Separate past and current/upcoming requests
  const { pastRequests, currentRequests, hasPastRequests } = useMemo(() => {
    const past = shoots.filter(isShootInPast);
    const current = shoots.filter(s => !isShootInPast(s));
    return {
      pastRequests: past,
      currentRequests: current,
      hasPastRequests: past.length > 0,
    };
  }, [shoots]);

  // Combine based on toggle state
  const visibleShoots = useMemo(() => {
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

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    if (providerVersion > 0) {
      weatherMapRef.current.clear();
      setWeatherMap({});
    }
    
    const loadWeather = async () => {
      const shootsNeedingWeather = shoots.filter(shoot => 
        !weatherMapRef.current.has(shoot.id) && 
        (shoot.cityStateZip || shoot.addressLine)
      );

      if (shootsNeedingWeather.length === 0) return;

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

  const groups = useMemo(() => groupShootsByDate(visibleShoots), [visibleShoots]);

  // Show nothing if no current requests AND not showing past
  if (currentRequests.length === 0 && !showPastRequests) {
    // But if there are past requests, show a minimal UI to reveal them
    if (hasPastRequests) {
      return (
        <Card className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-foreground">Requested shoots</h2>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                0
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastRequests(true)}
            >
              Previous requests ({pastRequests.length})
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3">No pending requests</p>
        </Card>
      );
    }
    return null;
  }

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-bold text-foreground">Requested shoots</h2>
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {currentRequests.length}
          </Badge>
        </div>
        {hasPastRequests && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs rounded-full border-dashed"
            onClick={() => setShowPastRequests((prev) => !prev)}
          >
            {showPastRequests ? 'Hide previous requests' : `Previous requests (${pastRequests.length})`}
          </Button>
        )}
      </div>

      <div className="space-y-6 overflow-y-auto hidden-scrollbar" style={{ maxHeight: '600px' }}>
        {groups.map((group) => (
          <div key={group.label} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <p className="text-xs font-semibold text-muted-foreground">
                {group.label}
              </p>
            </div>
            {group.shoots.map((shoot) => {
              const statusKey = (shoot.workflowStatus || shoot.status || '').toLowerCase();
              const statusClass = STATUS_COLORS[statusKey] || STATUS_COLORS.requested;
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
                  className="relative border border-blue-400 rounded-3xl p-5 hover:shadow-lg transition-all cursor-pointer bg-blue-50/30 dark:bg-blue-950/20 hover:border-blue-500"
                >
                  {shoot.isFlagged && (
                    <div className="absolute top-3 right-3 text-destructive">
                      <Flag size={14} />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] items-stretch gap-3 sm:gap-4">
                    <div className="flex flex-row sm:flex-col items-center sm:items-center gap-2 sm:gap-2">
                      {/* Status badge above time */}
                      <span
                        className={cn(
                          'px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold border whitespace-nowrap order-first sm:order-first',
                          statusClass,
                        )}
                      >
                        {formatWorkflowStatus(shoot.workflowStatus || shoot.status)}
                      </span>
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
                        <span>Client <span className="font-semibold text-foreground">• {shoot.clientName || 'Client TBD'}</span></span>
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
                      <div className="text-[10px] sm:text-xs text-muted-foreground text-right sm:text-right">
                        Photographer{' '}
                        <span className="font-semibold text-foreground">
                          • {shoot.photographer?.name || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  {(onApprove || onDecline || onModify) && (
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
      </div>
    </Card>
  );
};
