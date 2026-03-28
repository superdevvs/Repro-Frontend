const STORAGE_KEY = 'dashboard.weatherProvider';

export type WeatherProvider = 'google';

const DEFAULT_PROVIDER: WeatherProvider = 'google';
const listeners = new Set<(provider: WeatherProvider) => void>();

const isValidProvider = (value: string | null): value is WeatherProvider =>
  value === 'google';

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
  window.localStorage.setItem(STORAGE_KEY, provider);
  notify(provider);
};

export const subscribeToWeatherProvider = (listener: (provider: WeatherProvider) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

