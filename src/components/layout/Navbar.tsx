import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
const IP_LOCATION_KEY = 'dashboard.ipLocation.v5';
const IP_LOCATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
type WeatherCoordSource = 'ip' | 'default';
type IpLocation = {
  lat: number;
  lon: number;
  label?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
};

const readCachedIpLocation = () => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(IP_LOCATION_KEY);
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

const cacheIpLocation = (coords: IpLocation) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    IP_LOCATION_KEY,
    JSON.stringify({ ...coords, ts: Date.now() })
  );
};

const buildIpLocationLabel = (city?: string | null, region?: string | null) => {
  const parts = [city, region].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length > 0 ? parts.join(', ') : null;
};

const fetchIpLocation = async (signal?: AbortSignal): Promise<IpLocation | null> => {
  const refineIpLocation = async (location: IpLocation): Promise<IpLocation> => {
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
          // Keep the visible label tied to the direct IP provider result.
          label: location.label ?? (typeof data.location === 'string' ? data.location : null),
          postalCode: typeof data.postalCode === 'string' ? data.postalCode : location.postalCode ?? null,
          countryCode: location.countryCode ?? null,
        };
      }
    } catch {
      // ignore refinement failures and use provider location
    }

    return location;
  };

  try {
    const res = await fetch('https://ipapi.co/json/', { signal });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return await refineIpLocation({
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
        return await refineIpLocation({
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
    return { coords: cachedIpCoords, source: 'ip' as const, ipLabel: cachedIpCoords.label ?? null };
  }

  return { coords: DEFAULT_WEATHER_COORDS, source: 'default' as const, ipLabel: null };
};

export function Navbar() {
  const { user, logout, role } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [providerVersion, setProviderVersion] = useState(0);
  const [weatherCoords, setWeatherCoords] = useState(() => resolveInitialWeatherState().coords);
  const [weatherCoordSource, setWeatherCoordSource] = useState<WeatherCoordSource>(
    () => resolveInitialWeatherState().source,
  );
  const [ipWeatherLocationLabel, setIpWeatherLocationLabel] = useState<string | null>(
    () => resolveInitialWeatherState().ipLabel,
  );
  const { formatTemperature } = useUserPreferences();
  const [commandOpen, setCommandOpen] = useState(false);
  const weatherLocationLabel = useMemo(() => {
    if (weatherCoordSource === 'ip') {
      return ipWeatherLocationLabel || weather?.location || null;
    }

    return null;
  }, [ipWeatherLocationLabel, weather?.location, weatherCoordSource]);

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

  const storeIpWeatherCoords = useCallback((coords: IpLocation) => {
    setWeatherCoords(coords);
    setWeatherCoordSource('ip');
    setIpWeatherLocationLabel(coords.label ?? null);
    cacheIpLocation(coords);
  }, []);

  // Prefer IP-based location (no prompt). Falls back to stored/default.
  useEffect(() => {
    const cached = readCachedIpLocation();
    if (cached) {
      setWeatherCoords(cached);
      setWeatherCoordSource('ip');
      setIpWeatherLocationLabel(cached.label ?? null);
    }

    const controller = new AbortController();

    fetchIpLocation(controller.signal)
      .then((coords) => {
        if (coords) {
          storeIpWeatherCoords(coords);
        } else if (!cached) {
          setIpWeatherLocationLabel(null);
        }
      })
      .catch(() => {
        // ignore IP lookup failures
      });

    return () => {
      controller.abort();
    };
  }, [storeIpWeatherCoords]);

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
            showRobbieStrip ? "flex-1 lg:flex-none lg:w-[280px]" : "flex-1"
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
                className="mr-2 shrink-0 flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => navigate('/book-shoot')}
              >
                <PlusCircleIcon className="h-4 w-4" />
                <span className="hidden sm:inline">New Shoot</span>
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
          <div className="hidden lg:flex flex-[1.6] min-w-0 px-3 items-center">
            <div className="h-8 w-px bg-border/60" />
            <RobbieInsightStrip
              role={role}
              className="w-full border-0 shadow-none px-4 py-1.5 rounded-xl"
            />
            <div className="h-8 w-px bg-border/60" />
          </div>
        )}
      
        <div className="flex items-center gap-4">
        {/* Weather Info */}
        {weather && (
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground leading-none">
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
          </div>
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
