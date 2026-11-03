import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecentSearches } from './RecentSearches';
import { SearchProgress } from './SearchProgress';

afterEach(cleanup);

describe('search feedback and history controls', () => {
  it('reruns searches with the keyboard and removes a term without rerunning it', async () => {
    const onSelect = vi.fn(); const onRemove = vi.fn(); const onClear = vi.fn();
    const entry = { id: '1447', query: '1447', scope: 'shoots', label: 'Shoots', searchedAt: 1 };
    render(<RecentSearches entries={[entry]} onSelect={onSelect} onRemove={onRemove} onClear={onClear} />);
    const user = userEvent.setup();
    screen.getByRole('button', { name: 'Search again for 1447 in Shoots' }).focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(entry);
    await user.click(screen.getByRole('button', { name: 'Remove 1447 from recent searches' }));
    expect(onRemove).toHaveBeenCalledExactlyOnceWith('1447');
    expect(onSelect).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('announces loading once and keeps decorative placeholders hidden from assistive technology', () => {
    render(<SearchProgress />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    expect(screen.getByText('Searching…')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull(); // No invented completion percentage.
    expect(status.querySelectorAll('.search-progress-placeholder')).toHaveLength(3);
    expect(status.querySelector('.search-progress-placeholder')?.parentElement?.getAttribute('aria-hidden')).toBe('true');
  });
});
