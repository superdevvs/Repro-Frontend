import { useEffect, useRef, useState } from 'react';
import { Link, matchPath, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Home, KanbanSquare, Menu, Plus, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useCrmMeta } from '../hooks';
import { crmSelectedNavClass, useCrmNav } from './crmNav';

const TABS = [
  { to: '/crm', label: 'Home', icon: Home, end: true },
  { to: '/crm/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/crm/contacts', label: 'Contacts', icon: Users },
  { to: '/crm/follow-ups', label: 'Tasks', icon: CalendarCheck },
];

const tabClass = 'flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium leading-none text-muted-foreground transition-colors';

export function CrmMobileNav({ onHeightChange }: { onHeightChange?: (height: number) => void }) {
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const groups = useCrmNav();
  const { data: meta } = useCrmMeta();
  const ref = useRef<HTMLDivElement>(null);
  const hasActiveTab = TABS.some((tab) => matchPath({ path: tab.to, end: tab.end === true }, pathname));

  useEffect(() => {
    const el = ref.current;
    if (!el || !onHeightChange) return;
    const report = () => onHeightChange(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => { ro.disconnect(); onHeightChange(0); };
  }, [onHeightChange]);

  return (
    <Sheet open={more} onOpenChange={setMore}>
      <div ref={ref} data-mobile-bottom-nav className="crm-root fixed inset-x-0 bottom-0 z-40 border-t bg-card px-1.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-sm">
        <nav aria-label="Sales CRM" className={cn('mx-auto grid max-w-md gap-0.5', meta?.can.create ? 'grid-cols-6' : 'grid-cols-5')}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => cn(tabClass, isActive && 'bg-accent font-semibold text-accent-foreground')}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
          {meta?.can.create && (
            <button type="button" onClick={() => navigate('/crm/contacts?new=1')} className={cn(tabClass, 'text-primary')} aria-label="Add contact">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>Add</span>
            </button>
          )}
          <SheetTrigger asChild>
            <button type="button" className={cn(tabClass, (more || !hasActiveTab) && 'bg-accent font-semibold text-accent-foreground')} aria-label="More sections">
              <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>More</span>
            </button>
          </SheetTrigger>
        </nav>
      </div>

      <SheetContent side="bottom" className="crm-root max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>Sales CRM</SheetTitle>
          <SheetDescription className="sr-only">Choose a CRM section.</SheetDescription>
        </SheetHeader>
        <nav aria-label="CRM sections" className="mt-3 grid gap-0.5 sm:grid-cols-2">
          {groups.flatMap((group) => group.items).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMore(false)}
                className={({ isActive }) => cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm', isActive ? crmSelectedNavClass : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground')}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {item.label}
                {item.count !== undefined && <span className="ml-auto rounded-full bg-card px-1.5 text-xs tabular-nums">{item.count}</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-3 border-t pt-2">
          <Link to="/dashboard" onClick={() => setMore(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground">
            <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            Back to Dashboard
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
