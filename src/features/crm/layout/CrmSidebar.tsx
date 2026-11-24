import { Fragment, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { formatBadgeCount } from '@/utils/formatBadgeCount';
import { crmSelectedNavClass, useCrmNav } from './crmNav';

const STORAGE_KEY = 'repro.crm.sidebar.collapsed';

export function CrmSidebar() {
  const compact = useMediaQuery('(max-width: 1219px)');
  const [preference, setPreference] = useState<boolean | null>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    return saved === null ? null : saved === 'true';
  });
  const collapsed = preference ?? compact;
  const groups = useCrmNav();

  const toggle = () => {
    setPreference(!collapsed);
    window.localStorage.setItem(STORAGE_KEY, String(!collapsed));
  };

  return (
    <aside
      aria-label="Sales CRM"
      data-state={collapsed ? 'collapsed' : 'expanded'}
      className={cn('crm-root flex h-full shrink-0 flex-col bg-secondary px-2.5 pb-3 transition-[width] duration-200 motion-reduce:transition-none dark:bg-background', collapsed ? 'w-[60px]' : 'w-[210px]')}
    >
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'px-1')}>
        <Link to="/crm" aria-label="Sales CRM home" className="inline-flex h-10 w-10 items-center justify-center rounded-xl">
          <Logo isCollapsed className="h-7 w-auto" />
        </Link>
      </div>

      <Link to="/dashboard" aria-label="Back to Dashboard" title={collapsed ? 'Back to Dashboard' : undefined} className={cn('flex h-9 shrink-0 items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-foreground', collapsed ? 'justify-center' : 'px-3')}>
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!collapsed && 'Back to Dashboard'}
      </Link>

      <nav id="crm-sections" aria-label="CRM sections" className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto border-t border-sidebar-border/60 px-1 pt-2 pb-1">
        {groups.map((group) => (
          <Fragment key={group.label ?? 'top'}>
            {group.label && !collapsed && <p className="px-3 pb-0.5 pt-3 text-[10px] font-semibold uppercase leading-4 tracking-wide text-muted-foreground">{group.label}</p>}
            {group.label && collapsed && <div className="mx-2 my-1.5 h-px shrink-0 bg-sidebar-border/70" />}
            {group.items.map((item) => {
              const Icon = item.icon;
              const badge = formatBadgeCount(item.count);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  aria-label={badge ? `${item.label}, ${badge}` : item.label}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => cn(
                    'relative flex h-9 shrink-0 items-center gap-3 rounded-xl text-sm transition-colors',
                    collapsed ? 'justify-center' : 'px-3',
                    isActive
                      ? collapsed
                        ? 'bg-sidebar-primary/20 font-medium text-sidebar-primary ring-1 ring-inset ring-sidebar-primary/30 dark:bg-sidebar-primary/40 dark:text-sidebar-primary-foreground dark:ring-sidebar-primary/40'
                        : crmSelectedNavClass
                      : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {badge && (collapsed
                    ? <span aria-hidden="true" className={cn('absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full', item.hot ? 'bg-rose-500' : 'bg-primary')} />
                    : <span aria-hidden="true" className={cn('ml-auto shrink-0 rounded-full px-1.5 text-[11px] font-medium leading-4 tabular-nums', item.hot ? 'crm-bg-red crm-text-red' : 'bg-card text-muted-foreground')}>{badge}</span>)}
                </NavLink>
              );
            })}
          </Fragment>
        ))}
      </nav>

      <button type="button" onClick={toggle} aria-controls="crm-sections" aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={cn('mt-2 flex h-9 shrink-0 items-center gap-3 rounded-xl text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-foreground', collapsed ? 'justify-center' : 'px-3')}>
        {collapsed ? <PanelLeftOpen aria-hidden="true" className="h-4 w-4" /> : <><PanelLeftClose aria-hidden="true" className="h-4 w-4" />Collapse</>}
      </button>
    </aside>
  );
}
