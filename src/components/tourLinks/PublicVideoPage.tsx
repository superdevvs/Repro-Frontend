import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { Loader2, Play } from 'lucide-react';

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
  if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
};

const getPlayableVideoUrl = (url: string): string | null => {
  const embedUrl = getEmbedUrl(url);
  if (!embedUrl) return null;

  if (embedUrl.includes('youtube-nocookie.com')) {
    const sep = embedUrl.includes('?') ? '&' : '?';
    return `${embedUrl}${sep}autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }

  if (embedUrl.includes('player.vimeo.com')) {
    const sep = embedUrl.includes('?') ? '&' : '?';
    return `${embedUrl}${sep}autoplay=1&title=0&byline=0&portrait=0`;
  }

  return embedUrl;
};

const isEmbeddedPlayerUrl = (url: string | null): boolean => {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtube-nocookie.com') || url.includes('vimeo.com');
};

export function PublicVideoPage({ variant }: PublicVideoPageProps) {
  const [loading, setLoading] = useState(true);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);

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

  useEffect(() => {
    setIsPlaying(false);
  }, [sourceUrl]);

  const embedUrl = useMemo(() => (sourceUrl ? getEmbedUrl(sourceUrl) : null), [sourceUrl]);
  const playableUrl = useMemo(() => (sourceUrl ? getPlayableVideoUrl(sourceUrl) : null), [sourceUrl]);
  const isIframeEmbed = isEmbeddedPlayerUrl(embedUrl);

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

        <div className="relative z-10 flex min-h-screen items-center justify-center px-[10px] py-[10px]">
          <div className="w-full">
            {sourceUrl ? (
              <div
                className="overflow-hidden rounded-[28px] bg-black/20 shadow-2xl"
                style={{ height: 'calc(100vh - 20px)' }}
              >
                <div className="relative h-full w-full">
                  {!isPlaying ? (
                    <button
                      type="button"
                      onClick={() => setIsPlaying(true)}
                      className="group relative h-full w-full overflow-hidden bg-black"
                      aria-label={`Play ${config.title}`}
                    >
                      {poster ? (
                        <img
                          src={poster}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_45%),linear-gradient(180deg,_#0b1024,_#02040d)]" />
                      )}
                      <div className="absolute inset-0 bg-black/35 transition-colors duration-300 group-hover:bg-black/25" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/12 backdrop-blur-md transition-transform duration-300 group-hover:scale-105">
                          <Play className="ml-1 h-10 w-10 fill-white text-white" />
                        </span>
                      </div>
                    </button>
                  ) : isIframeEmbed && playableUrl ? (
                    <iframe
                      src={playableUrl}
                      className="h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={config.title}
                    />
                  ) : (
                    <video
                      src={sourceUrl}
                      controls
                      autoPlay
                      playsInline
                      poster={poster || undefined}
                      className="h-full w-full bg-black object-contain"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-[28px] border border-dashed border-white/15 bg-black/40 px-6 text-center">
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
  );
}
