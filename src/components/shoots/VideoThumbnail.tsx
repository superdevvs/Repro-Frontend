import React, { useEffect, useRef, useState } from 'react';

interface VideoThumbnailProps {
  src: string;
  alt?: string;
  className?: string;
  seekTime?: number;
}

/**
 * Renders a thumbnail extracted from a video file using the HTML5 <video> element.
 * Loads the video, seeks to `seekTime` seconds, captures a frame to canvas,
 * and displays the resulting image. Falls back to null if capture fails.
 */
const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  src,
  alt = 'Video thumbnail',
  className = '',
  seekTime = 1,
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!src || attemptedRef.current === src) return;
    attemptedRef.current = src;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', onMetadata);
      video.src = '';
      video.load();
    };

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          if (dataUrl && dataUrl.length > 100) {
            setThumbUrl(dataUrl);
          } else {
            setFailed(true);
          }
        } else {
          setFailed(true);
        }
      } catch {
        setFailed(true);
      }
      cleanup();
    };

    const onMetadata = () => {
      const safeTime = Math.min(seekTime, video.duration * 0.1 || 0.5);
      video.currentTime = Math.max(0.1, safeTime);
    };

    const onError = () => {
      setFailed(true);
      cleanup();
    };

    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.src = src;

    videoRef.current = video;

    // Timeout fallback — if nothing happens in 8s, give up
    const timeout = setTimeout(() => {
      if (!thumbUrl) {
        setFailed(true);
        cleanup();
      }
    }, 8000);

    return () => {
      clearTimeout(timeout);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (failed || !thumbUrl) return null;

  return (
    <img
      src={thumbUrl}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
};

export default React.memo(VideoThumbnail);
