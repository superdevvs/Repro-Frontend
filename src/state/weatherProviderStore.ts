const STORAGE_KEY = 'dashboard.weatherProvider';

export type WeatherProvider = 'openweather' | 'accuweather' | 'weatherapi';

const DEFAULT_PROVIDER: WeatherProvider = 'openweather';
const listeners = new Set<(provider: WeatherProvider) => void>();

const isValidProvider = (value: string | null): value is WeatherProvider =>
  value === 'openweather' || value === 'accuweather' || value === 'weatherapi';

export const getWeatherProvider = (): WeatherProvider => {
  if (typeof window === 'undefined') {
    return DEFAULT_PROVIDER;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isValidProvider(stored) ? stored : DEFAULT_PROVIDER;
};

const notify = (provider: WeatherProvider) => {
  listeners.forEach((listener) => {
    try {
      listener(provider);
    } catch {
      // swallow listener errors
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<WeatherProvider>('weather-provider-change', { detail: provider }),
    );
  }
};

export const setWeatherProvider = (provider: WeatherProvider) => {
  if (typeof window === 'undefined') return;
  const current = getWeatherProvider();
  if (current === provider) return;
  window.localStorage.setItem(STORAGE_KEY, provider);
  notify(provider);
};

export const subscribeToWeatherProvider = (listener: (provider: WeatherProvider) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

