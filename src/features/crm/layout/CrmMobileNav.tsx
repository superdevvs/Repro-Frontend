import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Home, KanbanSquare, Menu, Plus, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useCrmMeta } from '../hooks';
import { useCrmNav } from './crmNav';

const TABS = [
  { to: '/crm', label: 'Home', icon: Home, end: true },
  { to: '/crm/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/crm/contacts', label: 'Contacts', icon: Users },
  { to: '/crm/follow-ups', label: 'Tasks', icon: CalendarCheck },
];

/**
 * Phone navigation for the CRM (frames M1 to M7): a floating tab pill, a
 * "More" sheet with every section, and the add-contact button.
 */
export function CrmMobileNav({ onHeightChange }: { onHeightChange?: (height: number) => void }) {
  const [more, setMore] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const groups = useCrmNav();
  const { data: meta } = useCrmMeta();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onHeightChange) return;
    const report = () => onHeightChange(el.getBoundingClientRect().height + 16);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => { ro.disconnect(); onHeightChange(0); };
  }, [onHeightChange]);

  return (
    <>
      <div ref={ref} className="crm-root pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 px-4 crm-mobile-tabs">
        <nav aria-label="Sales CRM" className="pointer-events-auto flex flex-1 items-center justify-between rounded-full border bg-card/95 p-1 shadow-lg backdrop-blur">
          {TABS.map((t) => {
            const active = t.end ? location.pathname === t.to : location.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <NavLink key={t.to} to={t.to} end={t.end} aria-label={t.label}
                className={cn('flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground', active && 'bg-secondary text-foreground')}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {active && <span>{t.label}</span>}
              </NavLink>
            );
          })}
          <button type="button" onClick={() => setMore(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground" aria-label="More sections">
            <Menu className="h-[18px] w-[18px]" />
          </button>
        </nav>
        {meta?.can.create && <button type="button" onClick={() => navigate('/crm/contacts?new=1')} className="pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg" aria-label="Add contact">
          <Plus className="h-6 w-6" />
        </button>}
      </div>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="crm-root max-h-[80dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>Sales CRM</SheetTitle></SheetHeader>
          <div className="mt-3 flex flex-col gap-1">
            {groups.flatMap((g) => g.items).map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} onClick={() => setMore(false)} className="flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] hover:bg-secondary">
                  <Icon className="h-[18px] w-[18px] text-muted-foreground" />{item.label}
                  {item.count !== undefined && <span className="ml-auto rounded-md bg-secondary px-1.5 text-xs tabular-nums">{item.count}</span>}
                </Link>
              );
            })}
            <Link to="/dashboard" onClick={() => setMore(false)} className="mt-2 flex h-11 items-center gap-3 rounded-lg border-t px-3 pt-2 text-[15px] text-muted-foreground"><ArrowLeft className="h-[18px] w-[18px]" />Back to Dashboard</Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
