import * as React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { InvoiceDateFilterToolbar } from './InvoiceDateFilterToolbar';

vi.mock('@/components/ui/date-range-picker', () => ({
  DateRangePicker: ({
    onChange,
    placeholder,
  }: {
    onChange: (value: { startDate: string; endDate: string }) => void;
    placeholder: string;
  }) => (
    <button
      type="button"
      onClick={() => onChange({ startDate: '2026-08-10', endDate: '2026-08-12' })}
    >
      {placeholder}
    </button>
  ),
}));

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.scrollIntoView) proto.scrollIntoView = vi.fn();
  if (!proto.hasPointerCapture) proto.hasPointerCapture = vi.fn(() => false);
  if (!proto.setPointerCapture) proto.setPointerCapture = vi.fn();
  if (!proto.releasePointerCapture) proto.releasePointerCapture = vi.fn();
});

afterEach(() => cleanup());

const renderToolbar = (overrides: Partial<React.ComponentProps<typeof InvoiceDateFilterToolbar>> = {}) => {
  const props: React.ComponentProps<typeof InvoiceDateFilterToolbar> = {
    filter: { preset: 'all' },
    onFilterChange: vi.fn(),
    resultCount: 18,
    selectedCount: 2,
    onClearSelection: vi.fn(),
    onExport: vi.fn(),
    onBulkPdf: vi.fn(),
    ...overrides,
  };

  render(<InvoiceDateFilterToolbar {...props} />);
  return props;
};

describe('InvoiceDateFilterToolbar', () => {
  it('renders every date preset and reports a controlled preset change', async () => {
    const user = userEvent.setup();
    const { onFilterChange } = renderToolbar({
      filter: {
        preset: 'all',
        customRange: { startDate: '2026-08-01', endDate: '2026-08-20' },
      },
    });

    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Week' }));

    expect(onFilterChange).toHaveBeenCalledWith({
      preset: 'week',
      customRange: { startDate: '2026-08-01', endDate: '2026-08-20' },
    });
  });

  it('reveals the shared date-range picker for Custom and forwards its range', async () => {
    const user = userEvent.setup();
    const { onFilterChange } = renderToolbar({ filter: { preset: 'custom' } });

    await user.click(screen.getByRole('button', { name: 'Choose custom dates' }));

    expect(onFilterChange).toHaveBeenCalledWith({
      preset: 'custom',
      customRange: { startDate: '2026-08-10', endDate: '2026-08-12' },
    });
  });

  it('shows result and selection counts and clears the current selection', async () => {
    const user = userEvent.setup();
    const { onClearSelection } = renderToolbar({ resultCount: 1, selectedCount: 2 });

    expect(screen.getByText('1 invoice')).toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear 2 selected invoices' }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['billing item', 'Filter billing items by date', 'Export billing items', 'Clear 2 selected billing items'],
    ['verification row', 'Filter verification rows by date', 'Export verification rows', 'Clear 2 selected verification rows'],
  ])(
    'uses role-aware accessible labels for %s results',
    (resultNoun, filterLabel, exportLabel, clearLabel) => {
      renderToolbar({ resultNoun });

      expect(screen.getByRole('group', { name: filterLabel })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: exportLabel })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: clearLabel })).toBeInTheDocument();
    },
  );

  it('offers CSV, Excel, PDF, and selected-PDF download callbacks', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onBulkPdf = vi.fn();
    renderToolbar({ onExport, onBulkPdf });

    for (const [label, format] of [
      ['CSV spreadsheet', 'csv'],
      ['Excel workbook', 'excel'],
      ['PDF report', 'pdf'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: 'Export invoices' }));
      await user.click(await screen.findByRole('menuitem', { name: label }));
      expect(onExport).toHaveBeenLastCalledWith(format);
    }

    await user.click(screen.getByRole('button', { name: 'Export invoices' }));
    await user.click(await screen.findByRole('menuitem', { name: /Selected invoice PDFs/ }));
    expect(onBulkPdf).toHaveBeenCalledTimes(1);
  });
});
