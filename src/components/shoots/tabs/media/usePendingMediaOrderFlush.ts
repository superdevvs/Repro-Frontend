import { useEffect, useRef, type MutableRefObject } from 'react';

/** Flush the final drag when its pane closes before the debounce has elapsed. */
export function usePendingMediaOrderFlush(flush: () => void, mounted: MutableRefObject<boolean>) {
  const latestFlush = useRef(flush);
  useEffect(() => { latestFlush.current = flush; }, [flush]);
  useEffect(() => {
    mounted.current = true;
    const onPageHide = () => latestFlush.current();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      mounted.current = false;
      window.removeEventListener('pagehide', onPageHide);
      latestFlush.current();
    };
  }, [mounted]);
}
