import React,{useEffect,useRef,useState} from 'react';
import {money,useReducedMotion} from './accountingHomeHelpers';
export function HomeAmount({ value, className = "" }: { value: number; className?: string }) {
  const reduced = useReducedMotion(),
    ref = useRef<HTMLSpanElement>(null),
    [amount, set] = useState(value),
    seen = useRef(false);
  useEffect(() => {
    let frame = 0;
    const node = ref.current;
    if (!node) return;
    if (reduced || seen.current) {
      set(value);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        seen.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1100);
          set(Math.round(value * 100 * (1 - Math.pow(1 - t, 3))) / 100);
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        set(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, reduced]);
  return (
    <span ref={ref} className={`home-amount ${className}`} aria-label={money(value)}>
      <span aria-hidden="true">{money(amount)}</span>
    </span>
  );
}
export function Module({
  title,
  context,
  actions,
  children,
  className = "",
}: {
  title: string;
  context?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`home-module ${className}`}>
      <header>
        <h2>{title}</h2>
        {context && <small>{context}</small>}
        {actions}
      </header>
      <div className="home-module-body">{children}</div>
    </section>
  );
}
