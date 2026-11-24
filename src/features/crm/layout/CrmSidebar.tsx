import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCrmNav } from './crmNav';

const STORAGE_KEY = 'repro.crm.sidebar.collapsed';


/**
 * The CRM-only sidebar (owner decision 9): CRM sections plus a way back to
 * the Dashboard. Replaces the Dashboard sidebar while under /crm.
 */
export function CrmSidebar() {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true');
  const groups = useCrmNav();
  const location = useLocation();

  const toggle = () => {
    setCollapsed((c) => {
      window.localStorage.setItem(STORAGE_KEY, String(!c));
      return !c;
    });
  };

  return (
    <aside
      aria-label="Sales CRM"
      data-state={collapsed ? 'collapsed' : 'expanded'}
      className={cn('crm-root flex h-full shrink-0 flex-col gap-2.5 bg-secondary px-2.5 pb-2.5 pt-3 transition-[width] duration-200 dark:bg-background', collapsed ? 'w-[60px]' : 'w-[232px]')}
    >
      <div className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5', collapsed && 'justify-center px-0')}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-white"><img src="/REPRO-HQ-icon.png" alt="" className="h-[18px] w-auto" /></span>
        {!collapsed && <div className="min-w-0"><b className="block text-[13px] font-semibold leading-4">R/E Pro Photos</b><span className="block text-[11px] leading-4 text-muted-foreground">Sales CRM</span></div>}
      </div>

      <Link to="/dashboard" className={cn('flex h-[38px] items-center gap-2 border-b px-2 pb-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground', collapsed && 'justify-center px-0')} title="Back to Dashboard">
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!collapsed && 'Back to Dashboard'}
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto">
        {groups.map((group) => (
          <React.Fragment key={group.label ?? 'top'}>
            {group.label && !collapsed && <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] text-muted-foreground">{group.label}</p>}
            {group.label && collapsed && <div className="mx-2 my-1.5 h-px bg-border" />}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn('relative flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-card/70 hover:text-foreground',
                    active && 'bg-accent font-semibold text-accent-foreground crm-active-link hover:bg-accent',
                    collapsed && 'justify-center px-0')}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!collapsed && item.label}
                  {item.count !== undefined && (collapsed
                    ? <span className={cn('absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full', item.hot ? 'bg-rose-500' : 'bg-primary')} aria-label={`${item.count} waiting`} />
                    : <span className={cn('ml-auto rounded-md border px-[5px] text-[11px] font-medium leading-4 tabular-nums', item.hot ? 'border-transparent crm-bg-red crm-text-red' : 'bg-card text-muted-foreground')}>{item.count}</span>)}
                </NavLink>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      <button type="button" onClick={toggle} className={cn('flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px] text-muted-foreground hover:bg-card/70 hover:text-foreground', collapsed && 'justify-center px-0')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" />Collapse</>}
      </button>
    </aside>
  );
}
