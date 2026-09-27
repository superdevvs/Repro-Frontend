import type { ReactNode } from 'react';

export function AccountingMetricStrip({ metrics, label = 'Accounting summary' }: { label?: string; metrics: { label: string; value: ReactNode; detail: ReactNode }[] }) {
  return <section aria-label={label} className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
    {metrics.map((metric, index) => <div key={metric.label} className={`min-w-0 border-border px-4 py-5 sm:px-6 ${index === 0 ? 'bg-primary/5' : ''} ${index % 2 ? 'border-l' : ''} ${index > 1 ? 'border-t lg:border-t-0 lg:border-l' : ''}`}>
      <p className="text-xs text-muted-foreground">{metric.label}</p>
      <p className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{metric.value}</p>
      <div className="mt-2 text-[11px] text-muted-foreground">{metric.detail}</div>
    </div>)}
  </section>;
}
