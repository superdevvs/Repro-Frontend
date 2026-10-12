import { useLayoutEffect, useState, type CSSProperties } from 'react';

function readViewport() {
  if (typeof window === 'undefined') return { width: 1200, height: 800, left: 0, top: 0 };
  const viewport = window.visualViewport;
  return { width: viewport?.width || window.innerWidth, height: viewport?.height || window.innerHeight,
    left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0 };
}

// Safari's visible viewport changes with the keyboard and zoom, independently of layout breakpoints.
export function useShootEditorViewport(open: boolean) {
  const [viewport, setViewport] = useState(readViewport);
  useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    const apply = () => {
      const next = readViewport();
      setViewport(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update); window.visualViewport?.removeEventListener('scroll', update); };
  }, [open]);
  return { layout: viewport.width >= 1200 ? 'wide' : viewport.width >= 640 ? 'tablet' : 'phone', short: viewport.height < 600,
    style: { '--shoot-vw': `${viewport.width}px`, '--shoot-vh': `${viewport.height}px`, '--shoot-vleft': `${viewport.left}px`, '--shoot-vtop': `${viewport.top}px` } as CSSProperties };
}
