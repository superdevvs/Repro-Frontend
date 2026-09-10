import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ArrowLeft, ArrowRight, Images, ImageOff } from 'lucide-react';
import { PublicTourLightbox } from '../shared/PublicTourLightbox';
import { preventTourImageDownloadGesture as preventImageDownloadGesture, showMissingTourImage as showMissingImage } from '../shared/publicTourImage';
import { trackMediaView } from '@/lib/tourTracking';

export interface HomeifyGalleryProps {
  photos: string[];
  address: string;
  shootId?: number | string;
  tourType: 'branded' | 'mls' | 'generic_mls';
}

export function HomeifyGallery({ photos, address, shootId, tourType }: HomeifyGalleryProps) {
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const selectedThumbnail = useRef<HTMLButtonElement | null>(null);
  const lastVisibleSelection = useRef(0);
  const count = photos.length;
  const index = count ? Math.min(selected, count - 1) : 0;
  const photo = photos[index];

  useEffect(() => {
    // Avoid moving the page on initial load or scrolling behind an open dialog.
    if (open || lastVisibleSelection.current === index) return;
    lastVisibleSelection.current = index;
    const thumbnail = selectedThumbnail.current;
    const strip = thumbnail?.parentElement;
    if (!thumbnail || !strip) return;
    const thumbBounds = thumbnail.getBoundingClientRect();
    const stripBounds = strip.getBoundingClientRect();
    if (thumbBounds.left < stripBounds.left || thumbBounds.right > stripBounds.right) {
      thumbnail.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    }
  }, [index, open]);

  const move = (direction: number) => {
    if (count < 2) return;
    setSelected((current) => (Math.min(current, count - 1) + direction + count) % count);
  };

  const handleKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  };

  const openGallery = (event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setOpen(true);
    if (shootId !== undefined && photo) trackMediaView(shootId, tourType, index, photo);
  };

  if (!count) {
    return (
      <section id="photos" className="homeify-gallery" aria-label="Property photography">
        <div className="homeify-gallery-empty" role="status">
          <ImageOff aria-hidden="true" />
          <p>Property photos are coming soon.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="photos" className="homeify-gallery" aria-label="Property photography" onKeyDown={handleKeys}>
      <div className="homeify-hero">
        <button type="button" className="homeify-hero-photo" onClick={openGallery} aria-label={`Open photo ${index + 1} of ${count}`}>
          <img key={photo} className="homeify-hero-image" src={photo} alt={`${address} — photo ${index + 1}`} loading="eager" decoding="async" draggable={false} onContextMenu={preventImageDownloadGesture} onDragStart={preventImageDownloadGesture} onError={showMissingImage} />
        </button>
        {count > 1 && <>
          <button type="button" className="homeify-gallery-arrow homeify-prev" aria-label="Previous property photo" onClick={() => move(-1)}><ArrowLeft aria-hidden="true" /></button>
          <button type="button" className="homeify-gallery-arrow homeify-next" aria-label="Next property photo" onClick={() => move(1)}><ArrowRight aria-hidden="true" /></button>
        </>}
        <span className="homeify-photo-count" aria-live="polite" aria-atomic="true">{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
        <button type="button" className="homeify-gallery-open" onClick={openGallery}><Images aria-hidden="true" /> See {count === 1 ? 'Photo' : `All ${count} Photos`}</button>
      </div>
      {count > 1 && (
        <div className="homeify-thumbnails" aria-label="Select a property photo">
          {photos.map((url, position) => (
            <button key={`${url}-${position}`} ref={position === index ? selectedThumbnail : undefined} type="button" className={`homeify-thumb${position === index ? ' is-active' : ''}`} aria-label={`Show property photo ${position + 1}`} aria-pressed={position === index} onClick={() => setSelected(position)}>
              <img src={url} alt="" loading="lazy" decoding="async" draggable={false} onContextMenu={preventImageDownloadGesture} onDragStart={preventImageDownloadGesture} onError={showMissingImage} />
            </button>
          ))}
        </div>
      )}
      <PublicTourLightbox photos={photos} address={address} index={index} open={open} onOpenChange={setOpen} onIndexChange={setSelected} triggerRef={opener} theme="homeify" />
    </section>
  );
}

export default HomeifyGallery;
