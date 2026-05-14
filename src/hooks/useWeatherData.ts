import { useEffect, useMemo, useState } from 'react';
import { getWeatherForLocation } from '@/services/weatherService';

interface WeatherDataProps {
  date?: Date;
  time?: string;
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
  /**
   * When false, the hook skips network calls entirely. Useful for viewport-
   * gating so off-screen shoot cards don't fire weather lookups.
   * Defaults to true for backward compatibility.
   */
  enabled?: boolean;
}

interface WeatherData {
  temperature?: string;
  condition?: string;
  distance: string | number;
}

// Weather requests are low-priority. We defer them with this delay so that
// high-priority dashboard API calls (user, shoots, notifications, permissions)
// finish first and don't get queued behind weather preflights.
const WEATHER_FETCH_DELAY_MS = 2500;
// Maximum random jitter added on top of the base delay so a screenful of shoot
// cards doesn't fire weather requests at the exact same instant.
const WEATHER_FETCH_JITTER_MS = 1500;
// Skip weather lookups for shoots more than this far in the past.
const WEATHER_STALE_PAST_MS = 6 * 60 * 60 * 1000; // 6 hours

const scheduleIdle = (cb: () => void, fallbackDelay: number): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const idle = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  });

  if (typeof idle.requestIdleCallback === 'function') {
    const handle = idle.requestIdleCallback(cb, { timeout: fallbackDelay + 4000 });
    return () => {
      if (typeof idle.cancelIdleCallback === 'function') {
        idle.cancelIdleCallback(handle);
      }
    };
  }

  const timeoutId = window.setTimeout(cb, fallbackDelay);
  return () => window.clearTimeout(timeoutId);
};

const buildLocation = ({
  city,
  state,
  zip,
  address,
}: Pick<WeatherDataProps, 'city' | 'state' | 'zip' | 'address'>) =>
  [address, city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ').trim();

const buildDateTime = (date?: Date, time?: string) => {
  if (!date) return null;

  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;

  if (time) {
    const twelveHour = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const twentyFourHour = time.match(/^(\d{1,2}):(\d{2})$/);

    if (twelveHour) {
      let hours = parseInt(twelveHour[1], 10);
      const minutes = parseInt(twelveHour[2], 10);
      const period = twelveHour[3].toUpperCase();

      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      target.setHours(hours, minutes, 0, 0);
    } else if (twentyFourHour) {
      target.setHours(parseInt(twentyFourHour[1], 10), parseInt(twentyFourHour[2], 10), 0, 0);
    } else {
      target.setHours(12, 0, 0, 0);
    }
  } else {
    target.setHours(12, 0, 0, 0);
  }

  return target.toISOString();
};

export function useWeatherData({
  date,
  time,
  city,
  state,
  zip,
  address,
  enabled = true,
}: WeatherDataProps): WeatherData {
  const [weatherData, setWeatherData] = useState<WeatherData>({
    distance: '5',
  });

  const location = useMemo(() => buildLocation({ city, state, zip, address }), [city, state, zip, address]);
  const dateTime = useMemo(() => buildDateTime(date, time), [date, time]);

  // Skip weather lookups for shoots well in the past — weather is meaningless
  // for completed/delivered shoots and these are the bulk of dashboard cards.
  const isStalePastShoot = useMemo(() => {
    if (!date) return false;
    const target = new Date(date);
    if (Number.isNaN(target.getTime())) return false;
    return target.getTime() < Date.now() - WEATHER_STALE_PAST_MS;
  }, [date]);

  useEffect(() => {
    if (!enabled || isStalePastShoot || !date || !location) {
      setWeatherData({ distance: '5' });
      return;
    }

    const controller = new AbortController();
    const jitter = Math.floor(Math.random() * WEATHER_FETCH_JITTER_MS);

    const cancelIdle = scheduleIdle(() => {
      if (controller.signal.aborted) return;
      void (async () => {
        try {
          const info = await getWeatherForLocation(location, dateTime, controller.signal);
          if (!controller.signal.aborted) {
            setWeatherData({
              temperature:
                typeof info?.temperatureC === 'number' ? String(info.temperatureC) : undefined,
              condition: info?.description || undefined,
              distance: '5',
            });
          }
        } catch {
          if (!controller.signal.aborted) {
            setWeatherData({ distance: '5' });
          }
        }
      })();
    }, WEATHER_FETCH_DELAY_MS + jitter);

    return () => {
      controller.abort();
      cancelIdle();
    };
  }, [enabled, isStalePastShoot, date, dateTime, location]);

  return weatherData;
}
