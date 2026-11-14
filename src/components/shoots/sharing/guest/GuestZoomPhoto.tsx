import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { GuestFile } from './guestOverviewTypes';

const limitZoom = (value: number) => Math.min(5, Math.max(1, value));
export function GuestZoomPhoto({ file, zoom, onZoom, onMove }: { file: GuestFile; zoom: number; onZoom: (value: number) => void; onMove: (direction: number) => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState({ width: file.width || 1, height: file.height || 1 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const bounds = useCallback((x: number, y: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    const fit = Math.min(box.width / natural.width, box.height / natural.height);
    const maxX = Math.max(0, (natural.width * fit * zoom - box.width) / 2);
    const maxY = Math.max(0, (natural.height * fit * zoom - box.height) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }, [natural, zoom]);
  useEffect(() => { setPan(previous => bounds(previous.x, previous.y)); }, [bounds]);
  useEffect(() => {
    const element = stage.current;
    const wheel = (event: WheelEvent) => { event.preventDefault(); onZoom(limitZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25))); };
    element?.addEventListener('wheel', wheel, { passive: false });
    return () => element?.removeEventListener('wheel', wheel);
  }, [zoom, onZoom]);
  const distance = () => { const points = [...pointers.current.values()]; return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, a')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (pointers.current.size === 2) { pinch.current = { distance: distance(), zoom }; drag.current = null; }
    else drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size > 1) onZoom(limitZoom(pinch.current.zoom * distance() / Math.max(1, pinch.current.distance)));
    else if (drag.current && zoom > 1) setPan(bounds(drag.current.panX + event.clientX - drag.current.x, drag.current.panY + event.clientY - drag.current.y));
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && zoom === 1 && drag.current && !pinch.current) {
      const dx = event.clientX - drag.current.x; const dy = event.clientY - drag.current.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) onMove(dx < 0 ? 1 : -1);
    }
    pointers.current.delete(event.pointerId); drag.current = null; pinch.current = null;
  };
  return <div ref={stage} className={`relative h-full w-full touch-none overflow-hidden ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { pointers.current.clear(); drag.current = null; pinch.current = null; }}
    onDoubleClick={() => onZoom(zoom > 1 ? 1 : 2)} aria-label="Photo preview">
    {loading && !failed && <p role="status" className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1.5 text-xs text-white">Loading preview…</p>}
    {failed ? <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-300"><p>Preview could not be loaded.</p><Button variant="outline" onClick={() => { setFailed(false); setLoading(true); setRetry(value => value + 1); }}>Retry preview</Button></div>
      : <img key={retry} src={file.preview_url} alt={file.name} draggable={false} className="h-full w-full select-none object-contain"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        onLoad={event => { setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setLoading(false); }} onError={() => { setLoading(false); setFailed(true); }} />}
  </div>;
}
