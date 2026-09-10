import { useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { preventTourImageDownloadGesture, showMissingTourImage } from './publicTourImage';

interface PublicTourLightboxProps {
  photos: string[];
  address: string;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
  triggerRef: RefObject<HTMLElement | null>;
  theme: 'homeify' | 'landor';
  className?: string;
}

/** Shared accessible photo viewer; each tour theme supplies only its presentation. */
export function PublicTourLightbox({ photos, address, index, open, onOpenChange, onIndexChange, triggerRef, theme, className }: PublicTourLightboxProps) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const count = photos.length;
  const selected = count ? Math.min(index, count - 1) : 0;
  const move = (direction: number) => {
    if (count > 1) onIndexChange((selected + direction + count) % count);
  };
  const handleKeys = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  };
  const startSwipe = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' || count < 2) return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const endSwipe = (event: PointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(x) > 48 && Math.abs(x) > Math.abs(y) * 1.3) move(x < 0 ? 1 : -1);
  };

  return (
    <Dialog open={open && count > 0} onOpenChange={onOpenChange}>
      <DialogContent className={`${theme}-lightbox${className ? ` ${className}` : ''}`} onKeyDown={handleKeys} onCloseAutoFocus={(event) => { event.preventDefault(); if (triggerRef.current?.isConnected) triggerRef.current.focus(); }}>
        <DialogTitle className="sr-only">Property photos — {address}</DialogTitle>
        <DialogDescription className="sr-only">Use the previous and next buttons, left and right arrow keys, or swipe to browse. Press Escape to close.</DialogDescription>
        <div className={`${theme}-lightbox-stage`} onPointerDown={startSwipe} onPointerUp={endSwipe} onPointerCancel={() => { swipeStart.current = null; }} style={{ touchAction: 'pan-y' }}>
          <img key={photos[selected]} className={`${theme}-lightbox-image`} src={photos[selected]} alt={`${address} — photo ${selected + 1} of ${count}`} draggable={false} onContextMenu={preventTourImageDownloadGesture} onDragStart={preventTourImageDownloadGesture} onError={showMissingTourImage} />
        </div>
        <div className={`${theme}-lightbox-nav`}>
          <button type="button" className={`${theme}-lightbox-arrow ${theme}-prev`} disabled={count < 2} aria-label="Previous photo" onClick={() => move(-1)}><ArrowLeft aria-hidden="true" /></button>
          <p className={`${theme}-lightbox-caption`} aria-live="polite" aria-atomic="true">Photo {selected + 1} of {count}</p>
          <button type="button" className={`${theme}-lightbox-arrow ${theme}-next`} disabled={count < 2} aria-label="Next photo" onClick={() => move(1)}><ArrowRight aria-hidden="true" /></button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
