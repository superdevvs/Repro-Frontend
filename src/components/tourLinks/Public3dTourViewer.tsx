import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { normalizePublicTourUrl } from './publicIguideModel';

type TourProvider = 'iguide' | 'matterport';

type Public3dTourViewerProps = {
  autoplay?: boolean;
  className?: string;
  heading?: string;
  iguideInlineUrl?: string | null;
  iguideOpenUrl?: string | null;
  initialProvider?: TourProvider;
  matterportUrl?: string | null;
  sectionId?: string;
  showUnavailable?: boolean;
};

const providerLabel: Record<TourProvider, string> = {
  iguide: 'iGUIDE',
  matterport: 'Matterport',
};

const addAutoplay = (value: string, autoplay: boolean) => {
  if (!autoplay || !value) return value;
  try {
    const url = new URL(value);
    if (!url.searchParams.has('autoplay')) url.searchParams.set('autoplay', '1');
    if (!url.searchParams.has('mute')) url.searchParams.set('mute', '1');
    return url.toString();
  } catch {
    return value;
  }
};

/** A single public media surface shared by branded and anonymous MLS tours. */
export function Public3dTourViewer({
  autoplay = false,
  className,
  heading = '3D Tour',
  iguideInlineUrl,
  iguideOpenUrl,
  initialProvider = 'iguide',
  matterportUrl,
  sectionId = 'tour',
  showUnavailable = false,
}: Public3dTourViewerProps) {
  const sources = useMemo(() => {
    const iguideInline = normalizePublicTourUrl(iguideInlineUrl);
    const iguideOpen = normalizePublicTourUrl(iguideOpenUrl) || iguideInline;
    const matterport = normalizePublicTourUrl(matterportUrl);
    return {
      iguide: iguideInline ? { inline: iguideInline, open: iguideOpen } : null,
      matterport: matterport ? { inline: matterport, open: matterport } : null,
    };
  }, [iguideInlineUrl, iguideOpenUrl, matterportUrl]);
  const availableProviders = useMemo(
    () => (['iguide', 'matterport'] as const).filter((provider) => Boolean(sources[provider])),
    [sources],
  );
  const preferredProvider = availableProviders.includes(initialProvider)
    ? initialProvider
    : availableProviders[0] ?? initialProvider;
  const [selectedProvider, setSelectedProvider] = useState<TourProvider>(preferredProvider);
  const activeProvider = availableProviders.includes(selectedProvider)
    ? selectedProvider
    : preferredProvider;
  const activeSource = sources[activeProvider];
  const [frameState, setFrameState] = useState<'error' | 'loading' | 'ready'>('loading');
  const [frameRevision, setFrameRevision] = useState(0);

  useEffect(() => {
    if (activeSource?.inline) setFrameState('loading');
  }, [activeProvider, activeSource?.inline, frameRevision]);

  useEffect(() => {
    if (!activeSource?.inline || frameState !== 'loading') return undefined;
    const timeoutId = window.setTimeout(() => setFrameState('error'), 15_000);
    return () => window.clearTimeout(timeoutId);
  }, [activeProvider, activeSource?.inline, frameRevision, frameState]);

  if (!activeSource && !showUnavailable) return null;

  const retry = () => {
    setFrameRevision((current) => current + 1);
    setFrameState('loading');
  };

  return (
    <section
      id={sectionId}
      className={cn('mx-auto mt-10 max-w-6xl px-6', className)}
      aria-label="3D tour"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-foreground">{heading}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {availableProviders.length === 2 && (
            <div
              className="inline-flex rounded-full border border-border/60 bg-muted/40 p-1"
              role="tablist"
              aria-label="3D tour provider"
            >
              {availableProviders.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  role="tab"
                  aria-selected={activeProvider === provider}
                  onClick={() => setSelectedProvider(provider)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    activeProvider === provider
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {providerLabel[provider]}
                </button>
              ))}
            </div>
          )}
          {activeSource?.open && (
            <a
              href={activeSource.open}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background/80 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Open in new tab <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <div className="relative aspect-[4/3] min-h-[300px] overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-lg sm:aspect-video sm:min-h-[360px]">
        {activeSource?.inline ? (
          <>
            <iframe
              key={`${activeProvider}-${frameRevision}-${activeSource.inline}`}
              src={addAutoplay(activeSource.inline, autoplay)}
              className={cn('h-full w-full border-0 transition-opacity duration-200', frameState === 'ready' ? 'opacity-100' : 'opacity-0')}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; vr; xr-spatial-tracking"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer"
              title={`${providerLabel[activeProvider]} 3D tour`}
              onLoad={() => setFrameState('ready')}
              onError={() => setFrameState('error')}
            />
            {frameState === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-card text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading {providerLabel[activeProvider]}…
              </div>
            )}
            {frameState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card p-6 text-center">
                <div>
                  <p className="text-sm font-medium text-card-foreground">Tour viewer unavailable</p>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Retry here or open the tour in a new tab.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={retry}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Retry viewer
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm font-medium text-card-foreground">3D tour unavailable</p>
            <p className="max-w-md text-xs text-muted-foreground">
              This walkthrough is not available in the public tour yet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
