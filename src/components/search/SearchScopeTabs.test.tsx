import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchScopeTabs } from './SearchScopeTabs';

const tabs = [{ id: 'everywhere', label: 'All' }, { id: 'shoots', label: 'Shoots' }, { id: 'accounts', label: 'Accounts' }];
const scrollIntoView = vi.fn();
beforeEach(() => { Element.prototype.scrollIntoView = scrollIntoView; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); scrollIntoView.mockClear(); });

describe('search category footer', () => {
  it('changes category with the pointer and preserves controlled selection across rerenders', async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<SearchScopeTabs tabs={tabs} value="shoots" onValueChange={onValueChange} controlsId="search-results" />);
    expect(screen.getByRole('tablist', { name: 'Search categories' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Shoots', selected: true }).tabIndex).toBe(0);
    await userEvent.click(screen.getByRole('tab', { name: 'Accounts' }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('accounts');
    expect(screen.getByRole('tab', { name: 'Shoots', selected: true })).toBeTruthy();
    rerender(<SearchScopeTabs tabs={[...tabs]} value="accounts" onValueChange={onValueChange} controlsId="search-results" />);
    const selected = screen.getByRole('tab', { name: 'Accounts', selected: true });
    expect(selected.tabIndex).toBe(0);
    expect(selected.id).toBe('search-results-tab-accounts');
    expect(selected.getAttribute('aria-controls')).toBe('search-results');
    rerender(<SearchScopeTabs tabs={[...tabs]} value="accounts" onValueChange={onValueChange} controlsId="search-results" />);
    expect(screen.getByRole('tab', { name: 'Accounts', selected: true })).toBeTruthy();
  });

  it('moves focus with arrows, Home and End without changing results until Enter or Space', async () => {
    const onValueChange = vi.fn(); const onParentKey = vi.fn();
    function Controlled() {
      const [value, setValue] = useState('everywhere');
      return <div onKeyDown={onParentKey}><SearchScopeTabs tabs={tabs} value={value} onValueChange={id => { setValue(id); onValueChange(id); }} /></div>;
    }
    render(<Controlled />);
    const user = userEvent.setup();
    const all = screen.getByRole('tab', { name: 'All' });
    all.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Shoots' }));
    expect(screen.getByRole('tab', { name: 'All', selected: true })).toBeTruthy();
    expect(onValueChange).not.toHaveBeenCalled();
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Accounts' }));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(all);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Accounts' }));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tab', { name: 'Accounts', selected: true })).toBeTruthy();
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('accounts');
    await user.keyboard('{Home} ');
    expect(screen.getByRole('tab', { name: 'All', selected: true })).toBeTruthy();
    expect(onValueChange).toHaveBeenLastCalledWith('everywhere');
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onParentKey).not.toHaveBeenCalled();
    expect(screen.getAllByRole('tab').filter(tab => tab.tabIndex === 0)).toHaveLength(1);
  });

  it('preserves search input focus when a category is tapped', async () => {
    const onValueChange = vi.fn();
    render(<><input aria-label="Search" /><SearchScopeTabs tabs={tabs} value="everywhere" onValueChange={onValueChange} /></>);
    const input = screen.getByRole('textbox', { name: 'Search' });
    input.focus();
    await userEvent.click(screen.getByRole('tab', { name: 'Shoots' }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('shoots');
    expect(document.activeElement).toBe(input);
  });

  it('reveals selection and keyboard focus without motion when reduced motion is requested', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    render(<SearchScopeTabs tabs={tabs} value="shoots" onValueChange={vi.fn()} />);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    scrollIntoView.mockClear();
    screen.getByRole('tab', { name: 'Shoots' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  });

  it('does not expose an invalid panel relationship and keeps only permitted categories', () => {
    const { rerender } = render(<SearchScopeTabs tabs={tabs.slice(0, 2)} value="shoots" onValueChange={vi.fn()} controlsId="invalid panel id" />);
    expect(screen.queryByRole('tab', { name: 'Accounts' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Shoots' }).hasAttribute('aria-controls')).toBe(false);
    rerender(<SearchScopeTabs tabs={tabs.slice(0, 1)} value="shoots" onValueChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'All' }).tabIndex).toBe(0);
    rerender(<SearchScopeTabs tabs={[]} value="shoots" onValueChange={vi.fn()} />);
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});
