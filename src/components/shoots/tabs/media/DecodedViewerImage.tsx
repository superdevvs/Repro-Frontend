import { useLayoutEffect, useRef } from 'react';

/** Mount the already-decoded element itself: protected no-store URLs must not be fetched again. */
export function DecodedViewerImage({ image, filename, className }: {
  image?: HTMLImageElement;
  filename: string;
  className: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const container = host.current;
    if (!container || !image) return;
    image.alt = filename;
    image.className = className;
    image.draggable = false;
    image.loading = 'eager';
    container.appendChild(image);
    return () => { if (image.parentNode === container) container.removeChild(image); };
  }, [image, filename, className]);
  return <span ref={host} className="contents" />;
}
