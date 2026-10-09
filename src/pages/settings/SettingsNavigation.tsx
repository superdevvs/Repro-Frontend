import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UserRound, Palette, Camera, BriefcaseBusiness, Plug, Bot, Activity, Shield, Bell, Droplets, Ticket, MapPin, Sparkles } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { AutoExpandingTabsList } from '@/components/ui/auto-expanding-tabs';
import { visibleSettingsGroups, type SettingsTab, type SettingsGroupId } from './settingsSections';
import styles from './SettingsLayout.module.css';

const icons = { 'my-account': UserRound, branding: Palette, editing: Camera, business: BriefcaseBusiness, integrations: Plug, robbie: Bot };
const childIcons = { profile: UserRound, account: Shield, notifications: Bell, branding: Palette, watermark: Droplets,
  'desktop-editing': Camera, 'ai-editing': Sparkles, coupons: Ticket, 'service-areas': MapPin, integrations: Plug, robbie: Bot };
const navigationSize = 'pb-1 [&_[role=tab]]:h-11 [&_[role=tab]]:min-w-11 md:[&_[role=tab]]:h-10 md:[&_[role=tab]]:min-w-10';

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

  return <Tabs value={current.id} onValueChange={selectGroup} className="min-w-0 space-y-2" data-settings-layout>
    <div className="flex min-w-0 items-start gap-2">
      <AutoExpandingTabsList ariaLabel="Settings sections" value={current.id}
        tabs={groups.map(group => ({ value: group.id, label: group.label, icon: icons[group.id] }))}
        className={`flex-1 ${navigationSize}`} />
      {showMonitor && <Link to="/system-monitor" aria-label="System Monitor" title="System Monitor"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"><Activity className="h-4 w-4" /></Link>}
    </div>
    <TabsContent value={current.id} className="mt-0 min-w-0">
      <Tabs value={activeTab} onValueChange={onTabChange} className="min-w-0 space-y-2">
        <AutoExpandingTabsList ariaLabel={`${current.label} options`} value={activeTab}
          tabs={current.tabs.map(tab => ({ ...tab, icon: childIcons[tab.value] }))}
          className={current.tabs.length === 1 ? 'sr-only' : navigationSize} />
        {activeTab === 'branding' && <p className="text-xs text-muted-foreground">Your portfolio - Appearance for this account.</p>}
        {activeTab === 'watermark' && <p className="text-xs text-muted-foreground">Shared setting - Watermarks for photos across the dashboard.</p>}
        <div className={styles.content} data-settings-content>{children}</div>
      </Tabs>
    </TabsContent>
  </Tabs>;
}
