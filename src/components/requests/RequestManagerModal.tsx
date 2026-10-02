import { useEffect, useRef } from 'react';
import { CalendarClock, CircleAlert, Inbox, MessageSquare, PauseCircle, Pencil, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRequestManager, type RequestCategoryId } from '@/context/RequestManagerContext';
import { cn } from '@/lib/utils';
import { ClientRequestManagerContent } from './ClientRequestManagerContent';

const icons = { client: MessageSquare, editing: Pencil, cancellation: XCircle, hold: PauseCircle, reschedule: CalendarClock, overdue: CircleAlert };
const descriptions: Record<RequestCategoryId, string> = {
  client: 'Review client feedback and follow each request through to resolution.',
  editing: 'Review editing requests and open their full brief to coordinate the team.',
  cancellation: 'Review cancellation reasons and decide how each shoot should be closed.',
  hold: 'Review requested holds and choose who should receive an update.',
  reschedule: 'Review schedule changes. Expand a request to see its reason and decision history.',
  overdue: 'Review outstanding balances and expand a client to see their overdue shoots.',
};

export function RequestManagerModal() {
  const { isOpen, closeModal, category = 'client', categories = [], selectCategory, requests } = useRequestManager();
  const tabs = categories.length ? categories : [{ id: 'client' as const, label: 'Client', count: requests.filter((request) => !['resolved', 'dismissed'].includes(request.status || '')).length, renderContent: () => null }];
  const active = tabs.find((tab) => tab.id === category) || tabs[0];
  const total = tabs.reduce((sum, tab) => sum + tab.count, 0);
  const Icon = icons[active.id];
  const activeTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isOpen) activeTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [active.id, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
      <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); activeTabRef.current?.focus(); }} className="flex h-[92dvh] w-[calc(100vw-1rem)] min-w-0 max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-[86dvh] sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-border/60 bg-muted/20 px-4 py-4 pr-12 text-left sm:px-6 sm:py-5 sm:pr-14">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Inbox className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg tracking-tight sm:text-2xl">Request Manager</DialogTitle>
              <DialogDescription className="mt-1 text-xs sm:text-sm">One place for requests, decisions, and follow-ups.</DialogDescription>
            </div>
            <span className="hidden rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground sm:block"><span className="mr-1.5 font-semibold tabular-nums text-foreground">{total}</span>awaiting attention</span>
          </div>
        </DialogHeader>
        <div role="tablist" aria-label="Request categories" className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border/60 bg-muted/10 px-4 py-3 sm:px-6">
          {tabs.map((tab) => {
            const TabIcon = icons[tab.id];
            const selected = active.id === tab.id;
            return <button key={tab.id} ref={selected ? activeTabRef : null} type="button" role="tab" tabIndex={selected ? 0 : -1} id={`manager-tab-${tab.id}`} aria-selected={selected} aria-controls="manager-category-panel" onClick={() => selectCategory(tab.id)} onKeyDown={(event) => {
              const current = tabs.findIndex((item) => item.id === tab.id);
              const next = event.key === 'ArrowRight' ? (current + 1) % tabs.length : event.key === 'ArrowLeft' ? (current + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              selectCategory(tabs[next].id);
              const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
              buttons?.[next].focus();
            }} className={cn('inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-sm', selected ? 'border-primary/30 bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground')}>
              <TabIcon className="h-3.5 w-3.5" aria-hidden="true" />{tab.label}<span className={cn('rounded-md px-1.5 py-0.5 text-[10px] tabular-nums', selected ? 'bg-primary/15' : 'bg-muted')}>{tab.count}</span>
            </button>;
          })}
        </div>
        <div role="tabpanel" id="manager-category-panel" aria-labelledby={`manager-tab-${active.id}`} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {active.id === 'client' && active.label !== 'Issues' ? <ClientRequestManagerContent /> : <>
            <div className="flex shrink-0 items-start gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div><h2 className="text-sm font-semibold">{active.label} requests</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descriptions[active.id]}</p></div>
            </div>
            <div key={active.id} className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:px-6 sm:py-4">{active.renderContent()}</div>
          </>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
