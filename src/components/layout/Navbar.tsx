import React, { useEffect, useState } from 'react';
import { BellIcon, SearchIcon, SunIcon, MoonIcon, PlusCircleIcon, CloudIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth/AuthProvider';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { getWeatherByCoordinates, WeatherInfo } from '@/services/weatherService';
import { subscribeToWeatherProvider } from '@/state/weatherProviderStore';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';

export function Navbar() {
  const { user, logout, role } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [providerVersion, setProviderVersion] = useState(0);
  const { formatTemperature } = useUserPreferences();

  // Allow client users to create new shoots
  const canBookShoot = ['admin', 'superadmin', 'client'].includes(role);

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

    const loadWeather = async (lat: number, lon: number) => {
      try {
        const info = await getWeatherByCoordinates(lat, lon, null, controller.signal);
        if (!cancelled) {
          setWeather(info);
        }
      } catch {
        // silently ignore
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          loadWeather(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          loadWeather(40.7128, -74.006);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 },
      );
    } else {
      loadWeather(40.7128, -74.006);
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [providerVersion]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <motion.div 
      className="w-full h-16 border-b border-border flex items-center justify-between px-4 bg-background/95 backdrop-blur-md"
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className="flex items-center gap-4 pl-4">
        {canBookShoot && (
          <Button 
            variant="default" 
            size="sm" 
            className="mr-2 flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => navigate('/book-shoot')}
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">New Shoot</span>
          </Button>
        )}
      
        <div className="flex w-full max-w-sm items-center gap-1.5 relative">
          <SearchIcon className="h-4 w-4 text-muted-foreground absolute ml-3" />
          <Input 
            type="search" 
            placeholder="Search..." 
            className="pl-9 bg-secondary/50 border-none focus-visible:ring-primary/20"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Weather Info */}
        {weather && (
          <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            <span>
              {weather.location ? `${weather.location} · ` : ''}
            </span>
            <CloudIcon className="h-4 w-4" />
            <span>
              {typeof weather.temperatureF === 'number'
                ? formatTemperature(weather.temperatureF)
                : weather.temperature || '--°'}
              {weather.description ? ` · ${weather.description}` : ''}
            </span>
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
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <BellIcon className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[300px]">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-[300px] overflow-auto">
              {Array.from({ length: 3 }).map((_, i) => (
                <DropdownMenuItem key={i} className="cursor-pointer py-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">New shoot booked</p>
                    <p className="text-xs text-muted-foreground">123 Main St, Anytown USA</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatar} alt={user?.name} />
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
    </motion.div>
  );
}

