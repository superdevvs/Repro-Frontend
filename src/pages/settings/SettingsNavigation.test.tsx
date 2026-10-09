import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { SettingsNavigation } from './SettingsNavigation';
import { resolveSettingsTab, SETTINGS_GROUPS, visibleSettingsGroups, type SettingsTab } from './settingsSections';

const allTabs = SETTINGS_GROUPS.flatMap(group => group.tabs.map(tab => tab.value));
function Harness({ tabs = allTabs, monitor = true }: { tabs?: SettingsTab[]; monitor?: boolean }) {
  const [active, setActive] = useState<SettingsTab>('profile');
  return <MemoryRouter><Tabs value={active} onValueChange={value => setActive(value as SettingsTab)}>
    <SettingsNavigation activeTab={active} availableTabs={tabs} onTabChange={value => setActive(value as SettingsTab)} showMonitor={monitor}>
      {tabs.map(tab => <TabsContent key={tab} value={tab}>{tab} panel</TabsContent>)}
    </SettingsNavigation>
  </Tabs></MemoryRouter>;
}

describe('grouped settings navigation', () => {
  afterEach(cleanup);
  it('has six primary sections and remembers a selected subsection when returning', async () => {
    render(<Harness />);
    expect(within(screen.getByRole('navigation', { name: 'Settings sections' })).getAllByRole('button')).toHaveLength(6);
    await userEvent.click(screen.getByRole('tab', { name: 'Notifications' }));
    expect(screen.getByText('notifications panel')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Business' }));
    expect(screen.getByText('coupons panel')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'My Account' }));
    expect(screen.getByRole('tab', { name: 'Notifications' })).toHaveAttribute('aria-selected', 'true');
  });
  it('filters groups and child controls to the exact available permissions', () => {
    const available: SettingsTab[] = ['profile', 'account', 'notifications', 'desktop-editing'];
    render(<Harness tabs={available} monitor={false} />);
    expect(screen.queryByRole('button', { name: 'Business' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'System Monitor' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editing' }));
    expect(screen.queryByRole('tab', { name: 'AI providers' })).not.toBeInTheDocument();
    expect(screen.getByText('desktop-editing panel')).toBeVisible();
  });
  it('switches through the mobile section selector', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Settings section', { exact: true }), { target: { value: 'branding' } });
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
