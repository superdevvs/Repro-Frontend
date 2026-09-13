import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { PageLoadingContext } from '@/hooks/use-page-loading';
import { observePageImages } from '@/lib/observe-page-images';
import { PageLoadingOverlay } from './PageLoadingOverlay';

/** Mount once per route. Keep the page visible beneath its initial loading overlay. */
export function PageLoadingBoundary({ children, bottomInset = 0 }: { children: ReactNode; bottomInset?: number }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const tokens = useRef(new Set<symbol>());
  const completed = useRef(false);
  const pendingImages = useRef(false);
  const [pendingRevision, notifyPendingChange] = useReducer((revision: number) => revision + 1, 0);
  const [ready, setReady] = useState(false);

  const register = useCallback(() => {
    if (completed.current) return () => {};
    const token = Symbol('page-loading');
    tokens.current.add(token);
    notifyPendingChange();
    return () => {
      tokens.current.delete(token);
      notifyPendingChange();
    };
  }, []);
  const registry = useMemo(() => ({ register }), [register]);
  const reportImages = useCallback((pending: boolean) => {
    if (pendingImages.current === pending) return;
    pendingImages.current = pending;
    notifyPendingChange();
  }, []);

  useLayoutEffect(() => {
    if (!ready && contentRef.current) {
      return observePageImages(contentRef.current, reportImages);
    }
  }, [ready, reportImages]);

  useEffect(() => {
    if (ready || tokens.current.size > 0 || pendingImages.current) return;
    // Allow mount effects and chained initial requests to register before uncovering the page.
    const timeout = window.setTimeout(() => {
      if (tokens.current.size > 0 || pendingImages.current) return;
      completed.current = true;
      setReady(true);
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [ready, pendingRevision]);

  useLayoutEffect(() => {
    contentRef.current?.toggleAttribute('inert', !ready);
  }, [ready]);

  return (
    <PageLoadingContext.Provider value={registry}>
      <div className="relative isolate flex min-h-0 min-w-0 flex-1 overflow-hidden" data-page-loading={ready ? 'ready' : 'loading'}>
        <div ref={contentRef} className="flex min-h-0 min-w-0 flex-1" aria-busy={!ready} aria-hidden={!ready || undefined}>
          {children}
        </div>
        {!ready && <PageLoadingOverlay bottomInset={bottomInset} />}
      </div>
    </PageLoadingContext.Provider>
  );
}
