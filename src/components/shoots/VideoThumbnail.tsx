import React, { useEffect, useState } from 'react';

interface VideoThumbnailProps {
  src: string;
  alt?: string;
  className?: string;
  seekTime?: number;
}

const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  src,
  alt = 'Video thumbnail',
  className = '',
  seekTime = 1,
}) => {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (!src || ready || failed) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFailed(true);
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [failed, ready, src]);

  if (!src || failed) return null;

  return (
    <video
      key={src}
      src={src}
      aria-label={alt}
      className={className}
      muted
      playsInline
      preload="metadata"
      tabIndex={-1}
      style={{
        opacity: ready ? 1 : 0,
        pointerEvents: 'none',
      }}
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const safeTime = duration > 0 ? Math.min(seekTime, Math.max(duration - 0.05, 0)) : 0;

        try {
          video.currentTime = Math.max(0, safeTime);
          if (safeTime === 0) {
            setReady(true);
          }
        } catch {
          setReady(true);
        }
      }}
      onLoadedData={() => setReady(true)}
      onCanPlay={() => setReady(true)}
      onSeeked={() => setReady(true)}
      onError={() => setFailed(true)}
    />
  );
};

export default React.memo(VideoThumbnail);
