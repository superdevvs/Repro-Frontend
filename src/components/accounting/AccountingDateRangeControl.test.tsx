import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { AccountingHeader } from './AccountingHeader';
import { AccountingDateRangeControl } from './AccountingDateRangeControl';

afterEach(cleanup);
describe('Reporting period control', () => {
  it('is reachable for sales without administrator tabs or invoice creation', async () => {
    const onChange = vi.fn();
    render(<AccountingHeader title="Sales" showCreateButton={false} showTabs={false} onCreateInvoice={vi.fn()} reportingControl={<AccountingDateRangeControl value={{ startDate: '2026-08-29', endDate: '2026-09-27' }} period="30" onChange={onChange} />} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Reporting period' }), '7');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }), '7');
    expect(screen.queryByText('Create invoice')).not.toBeInTheDocument();
  });
  it('applies inclusive custom dates and cancel keeps the existing period', async () => {
    const onChange = vi.fn();
    render(<AccountingDateRangeControl value={{ startDate: '2026-08-29', endDate: '2026-09-27' }} period="30" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Reporting period' }), 'custom');
    fireEvent.change(screen.getByLabelText('Reporting start date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Reporting end date'), { target: { value: '2026-09-10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(onChange).toHaveBeenLastCalledWith({ startDate: '2026-09-01', endDate: '2026-09-10' }, 'custom');
    onChange.mockClear();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Reporting period' }), 'custom');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
