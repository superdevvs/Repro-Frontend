import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type VideoVariant = 'branded' | 'mls' | 'generic';

type PublicVideoPageProps = {
  variant: VideoVariant;
};

type ShootData = {
  id?: number | string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
};

type PublicPayload = {
  photos?: string[];
  shoot?: ShootData;
  tour_links?: Record<string, any>;
};

const variantConfig: Record<VideoVariant, { endpoint: string; tourKey: string; title: string }> = {
  branded: {
    endpoint: 'branded',
    tourKey: 'video_branded',
    title: 'Branded Video',
  },
  mls: {
    endpoint: 'mls',
    tourKey: 'video_mls',
    title: 'MLS Video',
  },
  generic: {
    endpoint: 'g-mls',
    tourKey: 'video_generic',
    title: 'Generic Video',
  },
};

const getEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
};

export function PublicVideoPage({ variant }: PublicVideoPageProps) {
  const [loading, setLoading] = useState(true);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string>('');
  const [shoot, setShoot] = useState<ShootData | null>(null);

  const config = variantConfig[variant];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shootId = params.get('shootId');
        const address = params.get('address');
        const city = params.get('city');
        const state = params.get('state');
        const zip = params.get('zip');

        const hasAddressParams = Boolean(address && city && state);
        if (!shootId && !hasAddressParams) {
          setLoading(false);
          return;
        }

        const query = new URLSearchParams();
        if (hasAddressParams) {
          query.set('address', address as string);
          query.set('city', city as string);
          query.set('state', state as string);
          if (zip) query.set('zip', zip);
        }

        const endpoint = query.toString()
          ? `${API_BASE_URL}/api/public/shoots/${config.endpoint}?${query.toString()}`
          : `${API_BASE_URL}/api/public/shoots/${shootId}/${config.endpoint}`;

        const separator = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${endpoint}${separator}t=${Date.now()}`);
        const data: PublicPayload = await res.json();

        setShoot(data?.shoot || null);
        setPoster(Array.isArray(data?.photos) && data.photos.length > 0 ? data.photos[0] : '');
        const nextUrl = data?.tour_links?.[config.tourKey];
        setSourceUrl(typeof nextUrl === 'string' && nextUrl.trim() ? nextUrl.trim() : null);
      } catch (error) {
        console.error('Error loading public video page:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [config.endpoint, config.tourKey]);

  const embedUrl = useMemo(() => (sourceUrl ? getEmbedUrl(sourceUrl) : null), [sourceUrl]);
  const isIframeEmbed = Boolean(embedUrl && (embedUrl.includes('youtube.com') || embedUrl.includes('vimeo.com')));
  const fullAddress = [shoot?.address, shoot?.city, shoot?.state, shoot?.zip].filter(Boolean).join(', ');

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading video...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-auto bg-[#050816] text-white">
      <div className="relative min-h-screen w-full overflow-hidden">
        {poster ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center opacity-25 blur-sm scale-105"
              style={{ backgroundImage: `url(${poster})` }}
            />
            <div className="absolute inset-0 bg-black/70" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_45%),linear-gradient(180deg,_#0b1024,_#02040d)]" />
        )}

        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-6xl">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/60">RepRO Dashboard</p>
                  <h1 className="truncate text-base font-semibold sm:text-lg">{config.title}</h1>
                  {fullAddress ? <p className="truncate text-xs text-white/60 sm:text-sm">{fullAddress}</p> : null}
                </div>
                {sourceUrl ? (
                  <Button variant="outline" size="sm" className="border-white/15 bg-white/5 text-white hover:bg-white/10" asChild>
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Source
                    </a>
                  </Button>
                ) : null}
              </div>

              <div className="p-3 sm:p-5 lg:p-6">
                {sourceUrl ? (
                  <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/50 shadow-inner">
                    <div className="relative aspect-video w-full">
                      {isIframeEmbed && embedUrl ? (
                        <iframe
                          src={embedUrl}
                          className="h-full w-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={config.title}
                        />
                      ) : (
                        <video
                          src={sourceUrl}
                          controls
                          playsInline
                          poster={poster || undefined}
                          className="h-full w-full bg-black object-contain"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-[22px] border border-dashed border-white/15 bg-black/40 px-6 text-center">
                    <div>
                      <h2 className="text-lg font-semibold">Video unavailable</h2>
                      <p className="mt-2 text-sm text-white/60">No video link has been configured for this page yet.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
