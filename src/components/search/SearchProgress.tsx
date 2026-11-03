import { Search } from 'lucide-react';
import './SearchProgress.css';

export function SearchProgress({ compact = false, label = 'Searching…' }: { compact?: boolean; label?: string }) {
  return <div role="status" aria-live="polite" aria-atomic="true" className={`search-progress ${compact ? 'px-4 py-4' : 'rounded-2xl border bg-card p-5 sm:p-6'}`}>
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="search-progress-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Search className="search-progress-lens h-5 w-5" /></div>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">Finding matches in your workspace</p></div>
      <span aria-hidden="true" className="search-progress-dots flex gap-1"><i /><i /><i /></span>
    </div>
    <div aria-hidden="true" className="search-progress-track mt-4 h-0.5 overflow-hidden rounded-full bg-primary/10"><div className="h-full w-1/3 rounded-full bg-primary" /></div>
    <div aria-hidden="true" className="mt-4 space-y-3">
      {Array.from({ length: compact ? 2 : 3 }, (_, index) => <div key={index} className="search-progress-placeholder flex items-center gap-3 rounded-xl border border-border/50 px-3 py-3" style={{ animationDelay: `${index * 90}ms` }}><span className="h-8 w-8 shrink-0 rounded-lg bg-muted" /><span className="flex-1 space-y-2"><span className="block h-2.5 rounded-full bg-muted" style={{ width: `${60 - index * 9}%` }} /><span className="block h-2 rounded-full bg-muted/70" style={{ width: `${82 - index * 13}%` }} /></span></div>)}
    </div>
  </div>;
}
