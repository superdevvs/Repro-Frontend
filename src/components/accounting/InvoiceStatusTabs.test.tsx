import { useState } from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceStatusTabs, type InvoiceStatus } from './InvoiceStatusTabs';

afterEach(cleanup);

const setup = (initial: InvoiceStatus = 'all') => {
  const onChange = vi.fn();
  function Controlled() {
    const [value, setValue] = useState(initial);
    return <>
      <InvoiceStatusTabs value={value} onValueChange={(next) => { onChange(next); setValue(next); }} />
      <button type="button">Outside</button>
    </>;
  }
  render(<Controlled />);
  const root = screen.getByRole('tablist', { name: 'Invoice status' }).parentElement!;
  return { root, onChange };
};

const tabLabels = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

describe('InvoiceStatusTabs', () => {
  it.each(['all', 'pending', 'paid', 'overdue'] as const)('keeps %s visible when collapsed without hidden focusable options', (initial) => {
    setup(initial);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent(initial === 'all' ? 'All' : initial[0].toUpperCase() + initial.slice(1));
    expect(screen.getByRole('tab')).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(1);
    expect(screen.queryByText('All Invoices')).not.toBeInTheDocument();
  });

  it('reveals statuses on hover without selecting and collapses on pointer exit', async () => {
    const { root, onChange } = setup();
    const user = userEvent.setup();
    await user.hover(root);
    expect(tabLabels()).toEqual(['All', 'Pending', 'Paid', 'Overdue']);
    const paid = screen.getByRole('tab', { name: 'Paid' });
    fireEvent.pointerOut(root, { relatedTarget: paid });
    fireEvent.pointerOver(paid, { relatedTarget: root });
    expect(tabLabels()).toHaveLength(4);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    await user.unhover(root);
    expect(tabLabels()).toEqual(['All']);
  });

  it('selects on click, retains target order while expanded, then collapses despite mouse focus', async () => {
    const { root, onChange } = setup('paid');
    // Test pointer movement separately: jsdom's synthetic click hover omits
    // relatedTarget and otherwise reports leaving the whole tab group.
    const user = userEvent.setup({ skipHover: true });
    await user.hover(root);
    const initialOrder = ['Paid', 'All', 'Pending', 'Overdue'];
    expect(tabLabels()).toEqual(initialOrder);
    await user.click(screen.getByRole('tab', { name: 'Pending' }));
    expect(onChange).toHaveBeenCalledWith('pending');
    expect(tabLabels()).toEqual(initialOrder);
    expect(screen.getByRole('tab', { name: 'Pending' })).toHaveFocus();
    await user.unhover(root);
    expect(tabLabels()).toEqual(['Pending']);
    await user.hover(root);
    expect(tabLabels()).toEqual(['Pending', 'All', 'Paid', 'Overdue']);
  });

  it('supports manual keyboard selection and Escape without focus-driven changes', async () => {
    const { root, onChange } = setup();
    const user = userEvent.setup();
    await user.tab();
    expect(tabLabels()).toHaveLength(4);
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Pending' })).toHaveFocus());
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('pending');
    fireEvent.pointerLeave(root);
    expect(tabLabels()).toHaveLength(4);
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Paid' })).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(tabLabels()).toEqual(['Pending']);
    expect(screen.getByRole('tab', { name: 'Pending' })).toHaveFocus();
    expect(onChange).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
    expect(tabLabels()).toEqual(['Pending']);
  });

  it('allows touch to reveal choices, activate one and dismiss with an outside press', async () => {
    const { root, onChange } = setup();
    const user = userEvent.setup();
    await user.pointer([{ keys: '[TouchA>]', target: screen.getByRole('tab', { name: 'All' }) }, { keys: '[/TouchA]' }]);
    expect(tabLabels()).toHaveLength(4);
    expect(onChange).not.toHaveBeenCalled();
    const paid = screen.getByRole('tab', { name: 'Paid' });
    await user.pointer([{ keys: '[TouchA>]', target: paid }, { keys: '[/TouchA]' }]);
    expect(onChange).toHaveBeenCalledWith('paid');
    fireEvent.pointerLeave(root);
    expect(tabLabels()).toHaveLength(4);
    await user.pointer([{ keys: '[TouchA>]', target: screen.getByRole('button', { name: 'Outside' }) }, { keys: '[/TouchA]' }]);
    expect(tabLabels()).toEqual(['Paid']);
  });
});
