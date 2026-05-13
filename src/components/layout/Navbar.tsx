import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon, SunIcon, MoonIcon, PlusCircleIcon, CloudIcon, HomeIcon, HistoryIcon, CalendarIcon, BarChart3Icon, Settings2Icon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/utils/defaultAvatars';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/auth/AuthProvider';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { getWeatherByCoordinates, WeatherInfo } from '@/services/weatherService';
import { subscribeToWeatherProvider } from '@/state/weatherProviderStore';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { withApiBase } from '@/config/env';
import { cn } from '@/lib/utils';
import { GlobalCommandBar } from '@/components/search/GlobalCommandBar';
import { RobbieInsightStrip } from '@/components/ai/RobbieInsightStrip';
import { usePermission } from '@/hooks/usePermission';

const DEFAULT_WEATHER_COORDS = { lat: 40.7128, lon: -74.006 };
const BROWSER_LOCATION_KEY = 'dashboard.browserLocation.v1';
const IP_LOCATION_KEY = 'dashboard.ipLocation.v6';
const IP_LOCATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
type WeatherCoordSource = 'browser' | 'ip' | 'default';
type IpLocation = {
  lat: number;
  lon: number;
  label?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

const readCachedLocation = (storageKey: string) => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      lat?: number;
      lon?: number;
      ts?: number;
      label?: string | null;
      postalCode?: string | null;
      countryCode?: string | null;
    };
    if (
      typeof parsed.lat === 'number' &&
      typeof parsed.lon === 'number' &&
      typeof parsed.ts === 'number' &&
      Date.now() - parsed.ts < IP_LOCATION_TTL_MS
    ) {
      return {
        lat: parsed.lat,
        lon: parsed.lon,
        label: typeof parsed.label === 'string' ? parsed.label : null,
        postalCode: typeof parsed.postalCode === 'string' ? parsed.postalCode : null,
        countryCode: typeof parsed.countryCode === 'string' ? parsed.countryCode : null,
      };
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

const readCachedBrowserLocation = () => readCachedLocation(BROWSER_LOCATION_KEY);

const readCachedIpLocation = () => readCachedLocation(IP_LOCATION_KEY);

const cacheLocation = (storageKey: string, coords: IpLocation) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({ ...coords, ts: Date.now() })
  );
};

const cacheBrowserLocation = (coords: IpLocation) => cacheLocation(BROWSER_LOCATION_KEY, coords);

const cacheIpLocation = (coords: IpLocation) => cacheLocation(IP_LOCATION_KEY, coords);

const buildIpLocationLabel = (city?: string | null, region?: string | null) => {
  const parts = [city, region].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length > 0 ? parts.join(', ') : null;
};

const refineLocationHint = async (location: IpLocation, signal?: AbortSignal): Promise<IpLocation> => {
  try {
    const params = new URLSearchParams();
    params.set('latitude', String(location.lat));
    params.set('longitude', String(location.lon));
    if (location.postalCode) params.set('postalCode', location.postalCode);
    if (location.countryCode) params.set('countryCode', location.countryCode);
    if (location.label) {
      const [city, region] = location.label.split(',').map((part) => part.trim()).filter(Boolean);
      if (city) params.set('city', city);
      if (region) params.set('region', region);
    }

    const response = await fetch(withApiBase(`/api/ip-location?${params.toString()}`), { signal });
    if (!response.ok) {
      return location;
    }

    const payload = await response.json();
    const data = payload?.data;

    if (
      data &&
      typeof data.latitude === 'number' &&
      typeof data.longitude === 'number'
    ) {
      return {
        lat: data.latitude,
        lon: data.longitude,
        label:
          (typeof data.location === 'string' && data.location.trim())
            ? data.location.trim()
            : location.label,
        postalCode: typeof data.postalCode === 'string' ? data.postalCode : location.postalCode ?? null,
        countryCode: location.countryCode ?? null,
      };
    }
  } catch {
    // ignore refinement failures and use the original location
  }

  return location;
};

const normalizeApiLocation = (data: Record<string, unknown>): IpLocation | null => {
  if (
    typeof data.latitude !== 'number' ||
    typeof data.longitude !== 'number'
  ) {
    return null;
  }

  return {
    lat: data.latitude,
    lon: data.longitude,
    label:
      (typeof data.location === 'string' && data.location.trim())
        ? data.location.trim()
        : null,
    postalCode: typeof data.postalCode === 'string' ? data.postalCode : null,
    countryCode: typeof data.countryCode === 'string' ? data.countryCode : null,
  };
};

const fetchBackendIpLocation = async (signal?: AbortSignal): Promise<IpLocation | null> => {
  try {
    const response = await fetch(withApiBase('/api/ip-location'), { signal });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const data = payload?.data;

    if (!data || typeof data !== 'object') {
      return null;
    }

    return normalizeApiLocation(data);
  } catch {
    return null;
  }
};

const fetchIpLocation = async (signal?: AbortSignal): Promise<IpLocation | null> => {
  const backendLocation = await fetchBackendIpLocation(signal);
  if (backendLocation) {
    return backendLocation;
  }

  try {
    const res = await fetch('https://ipapi.co/json/', { signal });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return await refineLocationHint({
          lat: data.latitude,
          lon: data.longitude,
          label: buildIpLocationLabel(
            typeof data.city === 'string' ? data.city : null,
            typeof data.region_code === 'string'
              ? data.region_code
              : (typeof data.region === 'string' ? data.region : null),
          ),
          postalCode: typeof data.postal === 'string' ? data.postal : null,
          countryCode: typeof data.country_code === 'string' ? data.country_code : null,
        });
      }
    }
  } catch {
    // ignore and try fallback
  }

  // Fallback: ipwho.is (HTTPS)
  try {
    const res = await fetch('https://ipwho.is/', { signal });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return await refineLocationHint({
          lat: data.latitude,
          lon: data.longitude,
          label: buildIpLocationLabel(
            typeof data.city === 'string' ? data.city : null,
            typeof data.region === 'string'
              ? data.region
              : null,
          ),
          postalCode: typeof data.postal === 'string' ? data.postal : null,
          countryCode: typeof data.country_code === 'string' ? data.country_code : null,
        });
      }
    }
  } catch {
    // ignore
  }

  return null;
};

const resolveInitialWeatherState = () => {
  const cachedIpCoords = readCachedIpLocation();
  if (cachedIpCoords) {
    return { coords: cachedIpCoords, source: 'ip' as const, label: cachedIpCoords.label ?? null };
  }

  return { coords: DEFAULT_WEATHER_COORDS, source: 'default' as const, label: null };
};

export function Navbar() {
  const { user, logout, role } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const initialWeatherState = useMemo(() => resolveInitialWeatherState(), []);
  const { theme, setTheme } = useTheme();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [providerVersion, setProviderVersion] = useState(0);
  const [weatherCoords, setWeatherCoords] = useState(initialWeatherState.coords);
  const [weatherCoordSource, setWeatherCoordSource] = useState<WeatherCoordSource>(
    initialWeatherState.source,
  );
  const weatherCoordSourceRef = useRef<WeatherCoordSource>(initialWeatherState.source);
  const [weatherLocationLabelOverride, setWeatherLocationLabelOverride] = useState<string | null>(
    initialWeatherState.label,
  );
  const { formatTemperature } = useUserPreferences();
  const [commandOpen, setCommandOpen] = useState(false);
  const weatherLocationLabel = useMemo(() => {
    if (weatherCoordSource === 'default') {
      return null;
    }

    return weatherLocationLabelOverride || weather?.location || null;
  }, [weatherLocationLabelOverride, weather?.location, weatherCoordSource]);

  // Allow client users to create new shoots
  const canBookShoot = can('book-shoot', 'create');
  
  // Photographers and editors get simplified nav with menu in top bar
  const isSimplifiedLayout = role === 'photographer' || role === 'editor';
  const showRobbieStrip = role !== 'photographer' && role !== 'editor';

  useEffect(() => {
    const unsubscribe = subscribeToWeatherProvider(() => {
      setProviderVersion((version) => version + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    weatherCoordSourceRef.current = weatherCoordSource;
  }, [weatherCoordSource]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setWeather(null);

    const loadWeather = async () => {
      try {
        const info = await getWeatherByCoordinates(
          weatherCoords.lat,
          weatherCoords.lon,
          null,
          controller.signal,
        );
        if (!cancelled) {
          setWeather(info);
        }
      } catch {
        // silently ignore
      }
    };

    loadWeather();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [providerVersion, weatherCoords.lat, weatherCoords.lon]);

  const sourcePriority: Record<WeatherCoordSource, number> = {
    default: 0,
    ip: 1,
    browser: 2,
  };

  const applyWeatherCoords = useCallback((coords: IpLocation, source: Exclude<WeatherCoordSource, 'default'>) => {
    if (sourcePriority[source] < sourcePriority[weatherCoordSourceRef.current]) {
      return;
    }

    weatherCoordSourceRef.current = source;
    setWeatherCoords(coords);
    setWeatherCoordSource(source);
    setWeatherLocationLabelOverride(coords.label ?? null);

    if (source === 'browser') {
      cacheBrowserLocation(coords);
    } else {
      cacheIpLocation(coords);
    }
  }, []);

  // Prefer IP-based location (no prompt). Falls back to stored/default.
  useEffect(() => {
    const cachedIp = readCachedIpLocation();
    if (cachedIp) {
      applyWeatherCoords(cachedIp, 'ip');
    }

    const controller = new AbortController();

    fetchIpLocation(controller.signal)
      .then((coords) => {
        if (coords) {
          applyWeatherCoords(coords, 'ip');
        } else if (!cachedIp && weatherCoordSourceRef.current === 'default') {
          setWeatherLocationLabelOverride(null);
        }
      })
      .catch(() => {
        // ignore IP lookup failures
      });

    return () => {
      controller.abort();
    };
  }, [applyWeatherCoords]);

  const requestPreciseWeatherLocation = useCallback(() => {
    const cachedBrowser = readCachedBrowserLocation();
    if (cachedBrowser) {
      applyWeatherCoords(cachedBrowser, 'browser');
      return;
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    const controller = new AbortController();

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords: IpLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };

        const refined = await refineLocationHint(coords, controller.signal);
        applyWeatherCoords(refined, 'browser');
      },
      () => {
        // Keep the current IP-based weather if the user declines or location is unavailable.
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  }, [applyWeatherCoords]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Photographer/Editor nav items (availability only for photographers)
  const simplifiedNavItems = [
    { to: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
    { to: '/shoot-history', icon: HistoryIcon, label: 'Shoot History' },
    { to: '/accounting', icon: BarChart3Icon, label: 'Earnings' },
    ...(role === 'photographer'
      ? [{ to: '/availability', icon: CalendarIcon, label: 'Availability' }]
      : []),
    { to: '/settings', icon: Settings2Icon, label: 'Settings' },
  ];

  return (
    <div className="w-full border-b border-border bg-card dark:bg-background">
      <div className="h-16 flex items-center justify-between px-4">
        <div
          className={cn(
            "flex min-w-0 items-center gap-2 sm:gap-4 pl-0 sm:pl-4",
            showRobbieStrip ? "flex-1 sm:flex-none sm:w-[220px] lg:w-[280px]" : "flex-1"
          )}
        >
        {/* Logo for simplified layout (photographer/editor) */}
        {isSimplifiedLayout && (
          <div className="flex items-center gap-6">
            {/* Dark logo for light mode */}
            <img 
              src="/Repro HQ dark.png" 
              alt="REPRO-HQ" 
              className="h-8 cursor-pointer dark:hidden" 
              onClick={() => navigate('/dashboard')}
            />
            {/* Light logo for dark mode */}
            <img 
              src="/REPRO-HQ.png" 
              alt="REPRO-HQ" 
              className="h-8 cursor-pointer hidden dark:block" 
              onClick={() => navigate('/dashboard')}
            />
            {/* Nav menu items */}
            <nav className="hidden md:flex items-center gap-1">
              {simplifiedNavItems.map((item) => (
                <Button
                  key={item.to}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-9 px-3 text-sm font-medium',
                    pathname === item.to || pathname.startsWith(item.to + '/')
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => navigate(item.to)}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>
        )}
        
        {/* Standard layout - Book shoot button and search */}
        {!isSimplifiedLayout && (
          <>
            {canBookShoot && (
              <Button 
                variant="default" 
                size="sm" 
                className="relative mr-2 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.95)_0%,hsl(var(--primary)/0.78)_52%,hsl(var(--accent)/0.9)_100%)] p-0 text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/20 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25 md:hidden"
                onClick={() => navigate('/book-shoot')}
              >
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_25%_10%,hsl(var(--primary-foreground)/0.24),hsl(var(--primary-foreground)/0)_58%)]" />
                <PlusCircleIcon className="relative z-10 h-4 w-4" />
                <span className="sr-only">New Shoot</span>
              </Button>
            )}
          
            <div className="relative flex min-w-[110px] flex-1 items-center gap-1.5 sm:flex-none sm:min-w-[100px] sm:max-w-[100px] md:min-w-[110px] md:max-w-[110px] lg:min-w-[120px] lg:max-w-[120px]">
              <SearchIcon className="h-4 w-4 text-muted-foreground absolute ml-3" />
              <Input 
                type="search" 
                placeholder="Search..." 
                className="pl-9 bg-transparent border-0 shadow-none focus-visible:ring-primary/20"
                readOnly
                onClick={() => setCommandOpen(true)}
                onFocus={() => setCommandOpen(true)}
              />
            </div>
            <GlobalCommandBar open={commandOpen} onOpenChange={setCommandOpen} />
          </>
        )}
        </div>

        {/* Hide Robbie strip for photographer and editor roles */}
        {showRobbieStrip && (
          <div className="hidden sm:flex flex-[1.6] min-w-0 pl-3 items-center">
            <div className="h-8 w-px shrink-0 bg-border/60" />
            <RobbieInsightStrip
              role={role}
              className="min-w-0 flex-1 border-0 shadow-none px-4 py-1.5 rounded-xl"
            />
          </div>
        )}
      
        <div className="flex items-center gap-4">
        {showRobbieStrip && (
          <div className="hidden sm:block h-8 w-px shrink-0 bg-border/60" />
        )}
        {/* Weather Info */}
        {weather && (
          <button
            type="button"
            onClick={requestPreciseWeatherLocation}
            className="hidden md:flex items-center gap-2 text-sm text-muted-foreground leading-none rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-foreground"
            title="Click to use your exact location"
          >
            {weatherLocationLabel && <span className="shrink-0">{weatherLocationLabel}</span>}
            {weatherLocationLabel && <span className="shrink-0 text-muted-foreground/60">·</span>}
            <CloudIcon className="h-4 w-4 shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0 leading-none">
              <span className="shrink-0">
                {typeof weather.temperatureC === 'number'
                  ? formatTemperature(weather.temperatureC, weather.temperatureF)
                  : weather.temperature || '--°'}
              </span>
              {weather.description && (
                <>
                  <span className="shrink-0 text-muted-foreground/60">·</span>
                  <span className="truncate">{weather.description}</span>
                </>
              )}
            </div>
          </button>
        )}
        
        {/* Theme Toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <SunIcon className="h-5 w-5" />
          ) : (
            <MoonIcon className="h-5 w-5" />
          )}
        </Button>
        
        <NotificationCenter />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={getAvatarUrl(user?.avatar, user?.role, (user as any)?.gender, user?.id)} alt={user?.name} />
                <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
