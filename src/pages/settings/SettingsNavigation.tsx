import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UserRound, Palette, Camera, BriefcaseBusiness, Plug, Bot, Activity } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { visibleSettingsGroups, type SettingsTab, type SettingsGroupId } from './settingsSections';
import styles from './SettingsLayout.module.css';

const icons = { 'my-account': UserRound, branding: Palette, editing: Camera, business: BriefcaseBusiness, integrations: Plug, robbie: Bot };

interface Props {
  availableTabs: SettingsTab[];
  activeTab: SettingsTab;
  onTabChange: (value: string) => void;
  showMonitor: boolean;
  children: ReactNode;
}

export function SettingsNavigation({ availableTabs, activeTab, onTabChange, showMonitor, children }: Props) {
  const groups = visibleSettingsGroups(availableTabs);
  const current = groups.find(group => group.tabs.some(tab => tab.value === activeTab)) ?? groups[0];
  const remembered = useRef<Partial<Record<SettingsGroupId, SettingsTab>>>({});
  remembered.current[current.id] = activeTab;
  const selectGroup = (id: string) => {
    const group = groups.find(item => item.id === id);
    if (!group) return;
    const previous = remembered.current[group.id];
    onTabChange(group.tabs.find(tab => tab.value === previous)?.value ?? group.tabs[0].value);
  };

  return <div className="grid items-start gap-3 md:grid-cols-[172px_minmax(0,1fr)] md:gap-5" data-settings-layout>
    <aside className="min-w-0 md:sticky md:top-4">
      <div className="flex items-center gap-2 md:hidden">
        <label htmlFor="settings-section" className="sr-only">Settings section</label>
        <select id="settings-section" value={current.id} onChange={event => selectGroup(event.target.value)}
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {groups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}
        </select>
        {showMonitor && <Link to="/system-monitor" aria-label="System Monitor" title="System Monitor"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Activity className="h-4 w-4" /></Link>}
      </div>
      <nav aria-label="Settings sections" className="hidden space-y-1 md:block">
        {groups.map(group => {
          const Icon = icons[group.id];
          return <button key={group.id} type="button" onClick={() => selectGroup(group.id)} aria-current={current.id === group.id ? 'page' : undefined}
            className={cn('flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              current.id === group.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <Icon className="h-4 w-4 shrink-0" /><span>{group.label}</span>
          </button>;
        })}

      </nav>
    </aside>
    <div className="min-w-0 space-y-3">
      <header className="hidden md:flex md:flex-wrap md:items-baseline md:gap-x-3">
        <h2 className="text-base font-semibold leading-tight">{current.label}</h2>
        <p className="text-xs text-muted-foreground">{current.description}</p>
      </header>
      <TabsList aria-label={`${current.label} options`} className={cn('flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1', current.tabs.length === 1 && 'sr-only')}>
        {current.tabs.map(tab => <TabsTrigger key={tab.value} value={tab.value} aria-label={tab.label} className="min-h-11 shrink-0 rounded-md px-3 text-xs sm:text-sm md:min-h-9"><span className="md:hidden">{tab.value === 'profile' ? 'Details' : tab.value === 'account' ? 'Security' : tab.label}</span><span className="hidden md:inline">{tab.label}</span></TabsTrigger>)}
      </TabsList>
      {activeTab === 'branding' && <p className="text-xs text-muted-foreground">Your portfolio - Appearance for this account.</p>}
      {activeTab === 'watermark' && <p className="text-xs text-muted-foreground">Shared setting - Watermarks for photos across the dashboard.</p>}
      <div className={styles.content} data-settings-content>{children}</div>
    </div>
  </div>;
}
