import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CallsPagination({ page, pages = 1, total = 0, perPage = 20, count = 0, pending = false, error = false, onChange, label = 'Results' }: {
  page: number; pages?: number; total?: number; perPage?: number; count?: number; pending?: boolean; error?: boolean; onChange: (page: number) => void; label?: string;
}) {
  const start = count ? (page - 1) * perPage + 1 : 0;
  return <nav aria-label={`${label} pages`} className="calls-pagination">
    <span className="text-xs text-[var(--calls-muted)]" aria-live="polite">{start}–{count ? start + count - 1 : 0} of {total} <span className="hidden sm:inline">· {perPage} per page</span></span>
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" className="h-11 w-11 p-0" disabled={page <= 1 || pending} onClick={() => onChange(page - 1)} aria-label={`Previous ${label.toLowerCase()}`}><ChevronLeft className="h-4 w-4" /></Button>
      <Button variant="ghost" className="h-11 w-11 p-0" disabled={page >= pages || pending || error} onClick={() => onChange(page + 1)} aria-label={`Next ${label.toLowerCase()}`}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  </nav>;
}
