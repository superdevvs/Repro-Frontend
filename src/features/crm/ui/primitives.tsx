import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Health, Person, StageKey, Stat } from '../types';
import './controls.css';

export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'line';

export function Chip({ tone = 'neutral', className, children, title }: { tone?: Tone; className?: string; children: React.ReactNode; title?: string }) {
  return <span className={cn('crm-chip', className)} data-tone={tone === 'neutral' ? undefined : tone} title={title}>{children}</span>;
}

export function Note({ tone = 'info', icon, children, className }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <div className={cn('crm-note', className)} data-tone={tone} role={tone === 'bad' ? 'alert' : undefined}>{icon}<div className="min-w-0 flex-1">{children}</div></div>;
}

export function Avatar({ person, size = 'md', className }: { person?: Person | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const initials = person?.initials ?? (person?.name ?? '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const dim = size === 'sm' ? 'h-5 w-5 text-[9px]' : size === 'lg' ? 'h-11 w-11 text-[15px]' : 'h-7 w-7 text-[11px]';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground', dim, className)} title={person?.name}>
      {person ? initials : '–'}
    </span>
  );
}

export function StageChip({ stage, label }: { stage: StageKey; label: string }) {
  const tone: Tone = stage === 'client_pool' ? 'green' : stage === 'lost' ? 'red' : stage === 'booked' ? 'violet' : stage === 'estimate' ? 'amber' : stage === 'inquiry' ? 'blue' : 'neutral';
  return <Chip tone={tone}>{label}</Chip>;
}

export function HealthChip({ health }: { health: Health }) {
  if (!health) return <span className="text-muted-foreground">—</span>;
  const map: Record<string, [Tone, string]> = { healthy: ['green', 'Healthy'], slowing: ['amber', 'Slowing'], at_risk: ['red', 'At risk'], new: ['line', 'New'] };
  const [tone, label] = map[health] ?? ['neutral', health];
  return <Chip tone={tone}>{label}</Chip>;
}

export function Sparkline({ points, tone = 'primary' }: { points: number[]; tone?: 'primary' | 'red' }) {
  if (points.length < 2) return null;
  const w = 84;
  const h = 28;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const d = points.map((v, i) => `${((i * w) / (points.length - 1)).toFixed(1)},${(h - 3 - ((v - min) / (max - min || 1)) * (h - 6)).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true" className={tone === 'red' ? 'crm-text-red' : 'text-primary'}>
      <polyline points={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatStrip({ stats, className }: { stats: Stat[]; className?: string }) {
  if (!stats.length) return null;

  return (
    <div className={cn('crm-stats grid gap-px overflow-hidden rounded-xl border bg-border', className)}
      style={{ '--crm-stat-count': stats.length, '--crm-stat-compact-count': Math.min(2, stats.length) } as React.CSSProperties}>
      {stats.map((s) => (
        <div key={s.key} className="flex min-w-0 items-center justify-between gap-2 bg-card px-3.5 py-3 sm:px-4">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
            <div className={cn('mt-1 flex flex-wrap items-baseline gap-x-2 text-[21px] font-semibold leading-7 tracking-tight tabular-nums', s.tone === 'bad' && s.value > 0 && 'crm-text-red')}>
              {s.value.toLocaleString()}
              {s.delta !== null && s.delta !== 0 && (
                <span className={cn('text-xs font-medium tracking-normal', s.key === 'overdue' ? 'crm-text-red' : s.delta > 0 ? 'crm-text-green' : 'crm-text-red')}>
                  {s.delta > 0 ? '+' : ''}{s.delta.toLocaleString()}
                </span>
              )}
            </div>
          </div>
          {s.series && <span className="hidden shrink-0 2xl:block"><Sparkline points={s.series} tone={s.key === 'overdue' ? 'red' : 'primary'} /></span>}
        </div>
      ))}
    </div>
  );
}

/** The floating content panel every CRM screen sits in (design: .panel/.top/.main). */
export function CrmPage({ title, count, description, crumbs, actions, children, className, bodyClassName, tabs }: {
  title: React.ReactNode;
  count?: number | null;
  description?: React.ReactNode;
  crumbs?: { label: string; to?: string }[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  tabs?: React.ReactNode;
}) {
  return (
    <section className={cn('flex min-h-full min-w-0 flex-col overflow-hidden rounded-[14px] border bg-card text-card-foreground crm-page-panel max-md:rounded-none max-md:border-0 max-md:shadow-none', className)}>
      <header className="crm-page-header flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b">
        <div className="min-w-0 max-w-full">
          {crumbs && crumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1 break-words text-xs text-muted-foreground">
              {crumbs.map((c, i) => (
                <React.Fragment key={c.label}>
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
                  {c.to ? <Link to={c.to} className="hover:text-foreground">{c.label}</Link> : <span>{c.label}</span>}
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1 className="break-words text-2xl font-semibold leading-8 tracking-tight">
            {title}{typeof count === 'number' && <span className="ml-2 align-middle text-sm font-medium text-muted-foreground tabular-nums">{count.toLocaleString()}</span>}
          </h1>
          {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {tabs}
      <div className={cn('crm-page-body flex min-w-0 flex-1 flex-col gap-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Card({ title, actions, children, className, bodyClassName }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={cn('min-w-0 rounded-xl border bg-card', className)}>
      {(title || actions) && (
        <div className="crm-card-heading flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b px-4 py-3">
          {typeof title === 'string' ? <h2 className="text-[13px] font-semibold">{title}</h2> : title}
          {actions}
        </div>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="max-w-sm text-xs text-muted-foreground">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground', className)} role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{label}
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = (error as { message?: string })?.message ?? 'This could not load.';
  return (
    <Note tone="bad">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{message}</span>
        {onRetry && <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">Try again</button>}
      </div>
    </Note>
  );
}

/** Small uppercase key/value grid used in record sidebars. */
export function KeyValues({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid crm-key-values gap-x-3 gap-y-2 text-[13px]">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? <span className="text-muted-foreground">—</span>}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function TabBar<T extends string>({ tabs, value, onChange, className, ariaLabel = 'Sections', variant = 'page' }: {
  tabs: { key: T; label: string; count?: number | null }[];
  value: T;
  onChange: (key: NoInfer<T>) => void;
  className?: string;
  ariaLabel?: string;
  variant?: 'page' | 'inline';
}) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const row = rowRef.current;
    const active = row?.querySelector('[aria-selected="true"]');
    if (!row || !active) return;

    const viewport = row.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    if (tab.left < viewport.left) row.scrollLeft += tab.left - viewport.left;
    else if (tab.right > viewport.right) row.scrollLeft += tab.right - viewport.right;
  }, [value, tabs.length]);

  return (
    <div ref={rowRef} className={cn('crm-tab-row', variant === 'page' && 'crm-tab-row-page', className)}>
      <div role="tablist" aria-label={ariaLabel} className="crm-tab-list">
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={value === tab.key}
            tabIndex={value === tab.key ? 0 : -1}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const target = event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              onChange(tabs[target].key);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
            }}
            onClick={() => onChange(tab.key)}
            className="crm-tab"
          >
            {tab.label}
            {typeof tab.count === 'number' && <span className="crm-tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
