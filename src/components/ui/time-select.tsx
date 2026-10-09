import * as React from 'react';
import { Keyboard, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseTimeInput } from './time-select-utils';

export interface TimeSelectProps {
  value?: string;
  onChange?: (time: string) => void;
  disabled?: boolean;
  availableTimes?: string[];
  className?: string;
  startHour?: number;
  endHour?: number;
  interval?: number;
  placeholder?: string;
  hour24?: boolean;
  autoOpenOnValue?: boolean;
  footerAction?: React.ReactNode;
}

const pad = (n: number) => String(n).padStart(2, '0');
const formatTime = (time: number, hour24: boolean) => {
  const hour = Math.floor(time / 60);
  return `${pad(hour24 ? hour : hour % 12 || 12)}:${pad(time % 60)}${hour24 ? '' : hour >= 12 ? ' PM' : ' AM'}`;
};
type WheelOption = { value: string; label: string; disabled?: boolean };

function WheelColumn({ value, options, onChange, label, disabled }: {
  value: string; options: WheelOption[]; onChange: (value: string) => void; label: string; disabled?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  const current = React.useRef({ value, options, onChange });
  current.current = { value, options, onChange };
  const id = React.useId();
  const programmatic = React.useRef(false);
  const scrollTo = (index: number, smooth = true) => {
    programmatic.current = true;
    ref.current?.scrollTo({ top: index * 40, behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
  };
  const mounted = React.useRef(false);
  const optionKeys = options.map(o => o.value).join(',');
  React.useLayoutEffect(() => {
    const index = options.findIndex(option => option.value === value);
    if (index >= 0 && ref.current && Math.abs(ref.current.scrollTop - index * 40) > 1) scrollTo(index, mounted.current);
    mounted.current = true;
    // Options may be recreated by parents; only their order affects alignment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, optionKeys]);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const choose = (index: number) => {
    if (index < 0 || disabled || options[index].disabled) return;
    onChange(options[index].value);
    scrollTo(index);
  };
  return <div>
    <div className="mb-1 text-center text-[10px] font-medium text-muted-foreground">{label}</div>
    <div ref={ref} data-vaul-no-drag role="listbox" aria-label={`Select ${label.toLowerCase()}`} aria-disabled={disabled}
      aria-activedescendant={value ? `${id}-${value}` : undefined} tabIndex={disabled ? -1 : 0}
      onWheel={() => { programmatic.current = false; }}
      onTouchStart={() => { programmatic.current = false; }}
      onPointerDown={() => { programmatic.current = false; }}
      onScroll={() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (!ref.current || disabled) return;
          if (programmatic.current) { programmatic.current = false; return; }
          const snapshot = current.current;
          const nearest = snapshot.options.reduce((best, option, index) => option.disabled ? best :
            best < 0 || Math.abs(index * 40 - ref.current!.scrollTop) < Math.abs(best * 40 - ref.current!.scrollTop) ? index : best, -1);
          if (nearest < 0) return;
          if (snapshot.options[nearest].value !== snapshot.value) snapshot.onChange(snapshot.options[nearest].value);
          if (Math.abs(ref.current.scrollTop - nearest * 40) > 1) scrollTo(nearest);
        }, 160);
      }}
      onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const enabled = options.map((o, i) => o.disabled ? -1 : i).filter(i => i >= 0);
        const index = options.findIndex(o => o.value === value);
        const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1) :
          event.key === 'ArrowDown' ? enabled.find(i => i > index) : [...enabled].reverse().find(i => i < index);
        if (next !== undefined) choose(next);
      }}
      className={cn("relative h-[120px] snap-y snap-mandatory overflow-y-auto overscroll-contain py-10 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", disabled && "pointer-events-none overflow-y-hidden")}
      style={{ touchAction: 'pan-y', maskImage: 'linear-gradient(transparent, black 28%, black 72%, transparent)' }}>
      {options.map((option, index) => <button key={option.value} id={`${id}-${option.value}`} type="button" role="option"
        aria-selected={option.value === value} disabled={disabled || option.disabled} tabIndex={-1}
        onClick={() => choose(index)}
        className={cn('flex h-10 w-full shrink-0 snap-center items-center justify-center text-[26px] font-semibold tabular-nums transition-[color,transform] duration-200 motion-reduce:transition-none',
          option.value === value ? 'text-primary scale-100' : 'text-muted-foreground/60 scale-90',
          option.disabled && 'opacity-25')}>
        {option.label}
      </button>)}
    </div>
  </div>;
}

export function TimeSelect({ value, onChange, disabled = false, availableTimes, className, startHour = 8,
  endHour = 18, interval = 5, placeholder = 'Select time', hour24 = false, footerAction }: TimeSelectProps) {
  const [local, setLocal] = React.useState(value ?? '');
  const [manual, setManual] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState('');
  const manualId = React.useId();
  React.useEffect(() => { setLocal(value ?? ''); }, [value]);
  const allowed = React.useMemo(() => {
    if (availableTimes !== undefined) return [...new Set(availableTimes.map(parseTimeInput).filter((t): t is number => t !== null))].sort((a, b) => a - b);
    const times: number[] = [];
    const step = Math.max(1, Math.floor(interval));
    for (let h = Math.max(0, startHour); h <= Math.min(23, endHour); h++) {
      for (let m = 0; m < 60; m += step) times.push(h * 60 + m);
    }
    return times;
  }, [availableTimes, interval, startHour, endHour]);
  const selected = parseTimeInput(local);
  const active = selected ?? allowed[0] ?? 480;
  const hour = Math.floor(active / 60);
  const minute = active % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = (h: number) => pad(hour24 ? h : h % 12 || 12);
  const commit = (time: number) => {
    if (disabled || !allowed.includes(time)) return;
    const formatted = formatTime(time, hour24);
    setLocal(formatted);
    setError('');
    if (time !== selected) onChange?.(formatted);
  };
  const nearest = (times: number[], target: number) => times.reduce((best, time) => Math.abs(time - target) < Math.abs(best - target) ? time : best, times[0]);
  const hourValues = [...new Set(allowed.map(t => displayHour(Math.floor(t / 60))))];
  if (selected !== null && !hourValues.includes(displayHour(hour))) hourValues.push(displayHour(hour));
  const minuteValues = [...new Set([...allowed.map(t => t % 60), minute])].sort((a, b) => a - b);
  const empty = allowed.length === 0;
  const sunPosition = Math.min(1, Math.max(0, (hour + minute / 60 - 6) / 14));
  return <div className={cn('w-full rounded-2xl bg-background p-3', className)}>
    <div className="mb-2 flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[.16em] text-muted-foreground">Shoot time</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-foreground" aria-live="polite">
          {selected === null ? placeholder : formatTime(selected, hour24)}
        </p>
      </div>
      <div aria-hidden="true" className="relative h-8 w-14 shrink-0 overflow-hidden">
        <div className="absolute inset-x-0 bottom-1 h-px bg-border" />
        <Sun className="absolute h-4 w-4 text-amber-500 transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `translate(${sunPosition * 38}px, ${13 - Math.sin(sunPosition * Math.PI) * 11}px) rotate(${sunPosition * 90}deg)` }} />
      </div>
    </div>
    {manual ? <div className="flex h-[140px] flex-col justify-center gap-2">
      <label className="text-xs font-medium" htmlFor={manualId}>Exact time</label>
      <div className="flex gap-2">
        <input id={manualId} autoFocus value={draft} disabled={disabled} placeholder="10:30 AM or 14:30" aria-invalid={!!error}
          aria-describedby={`${manualId}-help`} onChange={event => { setDraft(event.target.value); setError(''); }}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setManual(false); }
            if (event.key === 'Enter') { event.preventDefault(); applyManual(); }
          }} className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <button type="button" disabled={disabled} onClick={applyManual} className="rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40">Apply</button>
      </div>
      <p id={`${manualId}-help`} className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')} role={error ? 'alert' : undefined}>
        {error || 'Use a 12-hour or 24-hour time.'}
      </p>
    </div> : <div className="relative rounded-xl bg-muted/35 px-2 pt-1">
      <div className="pointer-events-none absolute inset-x-2 top-[63px] h-10 rounded-lg border border-primary/15 bg-primary/5" />
      <div className={cn('relative grid gap-1', hour24 ? 'grid-cols-2' : 'grid-cols-[1fr_1fr_.85fr]')}>
        <WheelColumn label="Hour" disabled={disabled || empty} value={displayHour(hour)}
          options={hourValues.map(h => ({ value: h, label: String(Number(h)), disabled: !allowed.some(t => displayHour(Math.floor(t / 60)) === h) }))}
          onChange={h => {
            const matches = allowed.filter(t => displayHour(Math.floor(t / 60)) === h);
            const samePeriod = matches.filter(t => (t >= 720 ? 'PM' : 'AM') === period);
            const choices = samePeriod.length ? samePeriod : matches;
            if (choices.length) commit(nearest(choices, Math.floor(choices[0] / 60) * 60 + minute));
          }} />
        <WheelColumn label="Minute" disabled={disabled || empty} value={pad(minute)}
          options={minuteValues.map(m => ({ value: pad(m), label: pad(m), disabled: !allowed.includes(hour * 60 + m) }))}
          onChange={m => commit(hour * 60 + Number(m))} />
        {!hour24 && <WheelColumn label="Period" disabled={disabled || empty} value={period}
          options={['AM', 'PM'].map(ap => ({ value: ap, label: ap, disabled: !allowed.some(t => (t >= 720 ? 'PM' : 'AM') === ap) }))}
          onChange={ap => { const times = allowed.filter(t => (t >= 720 ? 'PM' : 'AM') === ap); if (times.length) commit(nearest(times, active + (ap === 'PM' ? 720 : -720))); }} />}
      </div>
    </div>}
    {empty && <p role="status" className="mt-2 text-xs text-muted-foreground">No available times for this schedule.</p>}
    <div className="mt-2 flex items-center justify-between gap-2">
      <button type="button" disabled={disabled || empty} onClick={() => { setManual(!manual); setDraft(selected === null ? '' : formatTime(selected, hour24)); setError(''); }}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
        <Keyboard className="h-3.5 w-3.5" />{manual ? 'Back to wheels' : 'Type time'}
      </button>
      <div className="flex items-center gap-2">
        <button type="button" disabled={disabled || selected === null} onClick={() => { setLocal(''); setDraft(''); setError(''); onChange?.(''); }} className="h-8 px-1 text-xs text-muted-foreground disabled:opacity-40">Clear</button>
        {footerAction}
      </div>
    </div>
  </div>;
  function applyManual() {
    const time = parseTimeInput(draft);
    if (time === null) { setError('Enter a valid time, like 10:30 AM or 14:30.'); return; }
    if (!allowed.includes(time)) { setError('This time is unavailable. Choose an available time with the wheels.'); return; }
    commit(time);
    setManual(false);
  }
}
export default TimeSelect;
