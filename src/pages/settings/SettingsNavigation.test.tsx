import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { SettingsNavigation } from './SettingsNavigation';
import { resolveSettingsTab, SETTINGS_GROUPS, visibleSettingsGroups, type SettingsTab } from './settingsSections';

const allTabs = SETTINGS_GROUPS.flatMap(group => group.tabs.map(tab => tab.value));
function Harness({ tabs = allTabs }: { tabs?: SettingsTab[] }) {
  const [active, setActive] = useState<SettingsTab>('profile');
  return <MemoryRouter><Tabs value={active} onValueChange={value => setActive(value as SettingsTab)}>
    <SettingsNavigation activeTab={active} availableTabs={tabs} onTabChange={value => setActive(value as SettingsTab)}>
      {tabs.map(tab => <TabsContent key={tab} value={tab}>{tab} panel</TabsContent>)}
    </SettingsNavigation>
  </Tabs></MemoryRouter>;
}

describe('grouped settings navigation', () => {
  afterEach(cleanup);
  it('has six primary sections and remembers a selected subsection when returning', async () => {
    render(<Harness />);
    expect(within(screen.getByRole('tablist', { name: 'Settings sections' })).getAllByRole('tab')).toHaveLength(6);
    await userEvent.click(screen.getByRole('tab', { name: 'Notifications' }));
    expect(screen.getByText('notifications panel')).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: 'Business' }));
    expect(screen.getByText('coupons panel')).toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: 'My Account' }));
    expect(screen.getByRole('tab', { name: 'Notifications' })).toHaveAttribute('aria-selected', 'true');
  });
  it('filters groups and child controls to the exact available permissions', async () => {
    const available: SettingsTab[] = ['profile', 'account', 'notifications', 'desktop-editing'];
    render(<Harness tabs={available} />);
    expect(screen.queryByRole('tab', { name: 'Business' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'System Monitor' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Editing' }));
    expect(screen.queryByRole('tab', { name: 'AI providers' })).not.toBeInTheDocument();
    expect(screen.getByText('desktop-editing panel')).toBeVisible();
  });
  it('keeps collapsed icons named and expands the selected category', async () => {
    render(<Harness />);
    const branding = screen.getByRole('tab', { name: 'Branding' });
    expect(within(branding).queryByText('Branding')).not.toBeInTheDocument();
    await userEvent.click(branding);
    expect(within(branding).getByText('Branding')).toBeVisible();
    expect(screen.getByText('branding panel')).toBeVisible();
  });
  it('preserves every legacy deep link and resolves new group links only to allowed children', () => {
    for (const tab of allTabs) expect(resolveSettingsTab(tab, allTabs)).toBe(tab);
    expect(resolveSettingsTab('editing', ['profile', 'ai-editing'])).toBe('ai-editing');
    expect(resolveSettingsTab('ai-editing', ['profile', 'desktop-editing'])).toBe('profile');
    expect(resolveSettingsTab('business', ['profile', 'service-areas'])).toBe('service-areas');
    expect(resolveSettingsTab('invalid', allTabs)).toBe('profile');
    expect(visibleSettingsGroups(['profile', 'notifications']).map(group => group.id)).toEqual(['my-account']);
  });
});
