import { useEffect, useRef } from 'react';
import { REPRO_AI_ICON_PATH } from '@/components/icons/ReproAiIcon';

interface Particle { x: number; y: number; nx: number; ny: number; silhouette: boolean }

export function PropertyParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const robbie = typeof Path2D === 'undefined' ? null : new Path2D(REPRO_AI_ICON_PATH);
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reducedMotion = motion?.matches ?? false;
    let width = 0, height = 0, frame = 0, previous = 0, inView = true;
    let particles: Particle[] = [];
    const started = performance.now();
    const stars = [[.16, .27, 0], [.83, .24, 1.7], [.8, .76, 3.1], [.21, .77, 4.2]];
    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const strength = .7 + Math.sin(time * .8) * .2;
      for (const particle of particles) {
        const wave = Math.sin(particle.nx * 9 + particle.ny * 6 - time * 1.8);
        const crest = (wave + 1) / 2;
        const lift = particle.silhouette ? strength : .15;
        const x = particle.x + Math.sin(particle.ny * 9 + time) * (1 + lift * 3);
        const y = particle.y + wave * (1.5 + lift * 3) - lift * 3;
        const radius = particle.silhouette ? 1.65 + crest * .9 : .95 + crest * .5;
        context.fillStyle = particle.silhouette ? `rgba(224,246,255,${.72 + crest * .28})` : `rgba(204,230,250,${.24 + crest * .3})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      for (const [nx, ny, delay] of stars) {
        const pulse = .55 + .45 * Math.sin(time * 1.2 + delay);
        const x = nx * width + Math.sin(time * .6 + delay) * 5;
        const y = ny * height + Math.cos(time * .5 + delay) * 7;
        const radius = Math.max(6, Math.min(16, Math.min(width, height) * .035)) * (.7 + pulse * .3);
        context.fillStyle = `rgba(210,239,255,${.35 + pulse * .6})`;
        context.beginPath();
        context.moveTo(x, y - radius);
        context.quadraticCurveTo(x + radius * .18, y - radius * .18, x + radius, y);
        context.quadraticCurveTo(x + radius * .18, y + radius * .18, x, y + radius);
        context.quadraticCurveTo(x - radius * .18, y + radius * .18, x - radius, y);
        context.quadraticCurveTo(x - radius * .18, y - radius * .18, x, y - radius);
        context.fill();
      }
    };
    const canAnimate = () => !reducedMotion && !document.hidden && inView && width > 0 && height > 0;
    const tick = (now: number) => {
      if (!canAnimate()) { frame = 0; canvas.dataset.motion = reducedMotion ? 'reduced' : 'paused'; return; }
      if (now - previous >= 1000 / 30) { draw((now - started) / 1000); previous = now; }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      canvas.dataset.motion = reducedMotion ? 'reduced' : canAnimate() ? 'animated' : 'paused';
      draw(reducedMotion ? 1.2 : (performance.now() - started) / 1000);
      if (canAnimate()) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width; height = rect.height;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
      context.setTransform(1, 0, 0, 1, 0, 0);
      particles = [];
      if (width && height) {
        const columns = Math.min(64, Math.max(20, Math.round(width / 12)));
        const rows = Math.min(48, Math.max(14, Math.round(height / 12)));
        const scale = Math.min(width * .76 / 87, height * .76 / 87);
        for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
          const nx = (col + .5) / columns, ny = (row + .5) / rows;
          const x = nx * width, y = ny * height;
          particles.push({ x, y, nx, ny, silhouette: robbie ? context.isPointInPath(robbie, (x - width / 2) / scale + 43.5, (y - height / 2) / scale + 43.5) : false });
        }
      }
      context.setTransform(density, 0, 0, density, 0, 0);
      sync();
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    const visibility = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { inView = entries.some(entry => entry.isIntersecting); sync(); });
    observer?.observe(canvas);
    visibility?.observe(canvas);
    const onMotionChange = (event: MediaQueryListEvent) => { reducedMotion = event.matches ?? motion?.matches ?? false; sync(); };
    motion?.addEventListener('change', onMotionChange);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect(); visibility?.disconnect();
      motion?.removeEventListener('change', onMotionChange);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={ref} className="v4-property-particles" aria-hidden="true" />;
}
