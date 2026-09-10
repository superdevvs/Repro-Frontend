import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { ArrowLeft, ArrowRight, ImageOff, Maximize2 } from 'lucide-react';
import { trackMediaView } from '@/lib/tourTracking';
import { PublicTourLightbox } from '../shared/PublicTourLightbox';
import { preventTourImageDownloadGesture, showMissingTourImage } from '../shared/publicTourImage';

export interface LandorGalleryProps {
  photos: string[];
  address: string;
  shootId?: number | string;
  tourType: 'branded' | 'mls' | 'generic_mls';
}

export function LandorGallery({ photos, address, shootId, tourType }: LandorGalleryProps) {
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(100);
  const track = useRef<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const masonryHeadingId = useId();
  const count = photos.length;

  const updateProgress = useCallback(() => {
    const gallery = track.current;
    if (!gallery) return;
    const { clientWidth, scrollWidth, scrollLeft } = gallery;
    const percentage = scrollWidth > clientWidth && clientWidth > 0
      ? Math.round(Math.min(1, Math.max(0, (Math.max(0, scrollLeft) + clientWidth) / scrollWidth)) * 100)
      : 100;
    setProgress((current) => current === percentage ? current : percentage);
  }, []);

  useEffect(() => {
    const gallery = track.current;
    if (!gallery) return;
    updateProgress();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateProgress);
    observer?.observe(gallery);
    if (gallery.firstElementChild) observer?.observe(gallery.firstElementChild);
    window.addEventListener('resize', updateProgress);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateProgress);
    };
  }, [count, updateProgress]);

  const openPhoto = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    opener.current = event.currentTarget;
    setSelected(index);
    setOpen(true);
    if (shootId !== undefined) trackMediaView(shootId, tourType, index, photos[index]);
  };

  const scrollPhotos = (direction: number) => {
    const gallery = track.current;
    if (!gallery) return;
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gallery.scrollBy?.({ left: direction * gallery.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  if (!count) {
    return <section className="landor-gallery" aria-label="Property photography"><div className="landor-gallery-empty" role="status"><ImageOff aria-hidden="true" /><p>Property photos are coming soon.</p></div></section>;
  }

  return (
    <section className="landor-gallery" aria-label="Property photography">
      <div ref={track} className="landor-gallery-track" aria-label="Property photos" tabIndex={0} onScroll={updateProgress} onKeyDown={(event) => {
        if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          scrollPhotos(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}>
        {photos.map((photo, index) => (
          <button key={`${photo}-${index}`} type="button" className="landor-gallery-card" aria-label={`Open photo ${index + 1} of ${count}`} onClick={(event) => openPhoto(event, index)}>
            <img src={photo} alt={`${address} — photo ${index + 1}`} loading="lazy" decoding="async" draggable={false} onContextMenu={preventTourImageDownloadGesture} onDragStart={preventTourImageDownloadGesture} onError={showMissingTourImage} />
            <span className="landor-gallery-zoom" aria-hidden="true"><Maximize2 /></span>
          </button>
        ))}
      </div>
      <div className="landor-gallery-progress" role="progressbar" aria-label="Photo carousel progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <span className="landor-gallery-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="landor-gallery-controls">
        <span className="landor-photo-count">{count} {count === 1 ? 'photo' : 'photos'}</span>
        {count > 1 && <div className="landor-gallery-buttons">
          <button type="button" className="landor-gallery-prev" aria-label="Previous property photos" onClick={() => scrollPhotos(-1)}><ArrowLeft aria-hidden="true" /></button>
          <button type="button" className="landor-gallery-next" aria-label="Next property photos" onClick={() => scrollPhotos(1)}><ArrowRight aria-hidden="true" /></button>
        </div>}
      </div>
      <section className="landor-masonry-section" aria-labelledby={masonryHeadingId}>
        <h3 className="landor-masonry-heading" id={masonryHeadingId}>All property photos</h3>
        <div className="landor-masonry">
          {photos.map((photo, index) => (
            <button key={`${photo}-${index}`} type="button" className="landor-masonry-card" aria-label={`Open photo ${index + 1} of ${count}`} onClick={(event) => openPhoto(event, index)}>
              <img src={photo} alt={`${address} — photo ${index + 1}`} loading="lazy" decoding="async" draggable={false} onContextMenu={preventTourImageDownloadGesture} onDragStart={preventTourImageDownloadGesture} onError={showMissingTourImage} />
              <span className="landor-gallery-zoom" aria-hidden="true"><Maximize2 /></span>
            </button>
          ))}
        </div>
      </section>
      <PublicTourLightbox photos={photos} address={address} index={selected} open={open} onOpenChange={setOpen} onIndexChange={setSelected} triggerRef={opener} theme="landor" />
    </section>
  );
}

export default LandorGallery;
