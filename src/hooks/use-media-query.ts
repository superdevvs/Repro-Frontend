
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

// Predefined breakpoint hooks
export function useIsXXSmall() {
  return useMediaQuery('(min-width: 360px)');
}

export function useIsXSmall() {
  return useMediaQuery('(min-width: 480px)');
}

export function useIsSmall() {
  return useMediaQuery('(min-width: 640px)');
}

export function useIsMedium() {
  return useMediaQuery('(min-width: 768px)');
}

export function useIsLarge() {
  return useMediaQuery('(min-width: 1024px)');
}

export function useIsXLarge() {
  return useMediaQuery('(min-width: 1280px)');
}
