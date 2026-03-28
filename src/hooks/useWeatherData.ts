import { useEffect, useMemo, useState } from 'react';
import { getWeatherForLocation } from '@/services/weatherService';

interface WeatherDataProps {
  date?: Date;
  time?: string;
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
}

interface WeatherData {
  temperature?: string;
  condition?: string;
  distance: string | number;
}

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
}: WeatherDataProps): WeatherData {
  const [weatherData, setWeatherData] = useState<WeatherData>({
    distance: '5',
  });

  const location = useMemo(() => buildLocation({ city, state, zip, address }), [city, state, zip, address]);
  const dateTime = useMemo(() => buildDateTime(date, time), [date, time]);

  useEffect(() => {
    if (date && location) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(async () => {
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
      }, 300);

      return () => {
        controller.abort();
        window.clearTimeout(timeoutId);
      };
    }

    setWeatherData({ distance: '5' });
  }, [date, dateTime, location]);

  return weatherData;
}
