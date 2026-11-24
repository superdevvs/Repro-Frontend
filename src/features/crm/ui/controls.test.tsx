import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FilterSelect } from './fields';
import { TabBar } from './primitives';

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = vi.fn();
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = vi.fn(() => false);
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = vi.fn();
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = vi.fn();
});

describe('CRM controls', () => {
  it('uses the selected rep ID and clears the filter when All reps is chosen', async () => {
    const user = userEvent.setup();
    const updateFilter = vi.fn();
    function RepFilter() {
      const [rep, setRep] = useState('');
      return <FilterSelect label="Rep" allLabel="All reps" value={rep} options={[{ value: '7', label: 'Maya Torres' }]}
        onChange={(value) => { updateFilter(value); setRep(value); }} />;
    }

    render(<RepFilter />);
    const trigger = screen.getByRole('combobox', { name: 'Rep' });
    expect(trigger).toHaveTextContent('All reps');

    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'Maya Torres' }));
    expect(updateFilter).toHaveBeenLastCalledWith('7');
    expect(trigger).toHaveTextContent('Maya Torres');

    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: 'All reps' }));
    expect(updateFilter).toHaveBeenLastCalledWith('');
    expect(trigger).toHaveTextContent('All reps');
  });

  it('moves selection and focus through page tabs with the keyboard', () => {
    function Tabs() {
      const [tab, setTab] = useState<'leads' | 'duplicates'>('leads');
      return <TabBar ariaLabel="Intake" value={tab} onChange={setTab}
        tabs={[{ key: 'leads', label: 'Leads' }, { key: 'duplicates', label: 'Duplicate attempts' }]} />;
    }

    render(<Tabs />);
    expect(screen.getByRole('tablist', { name: 'Intake' })).toBeInTheDocument();
    const leads = screen.getByRole('tab', { name: 'Leads', selected: true });
    const duplicates = screen.getByRole('tab', { name: 'Duplicate attempts', selected: false });

    leads.focus();
    fireEvent.keyDown(leads, { key: 'ArrowRight' });
    expect(duplicates).toHaveFocus();
    expect(duplicates).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(duplicates, { key: 'Home' });
    expect(leads).toHaveFocus();
    expect(leads).toHaveAttribute('aria-selected', 'true');
  });
});
