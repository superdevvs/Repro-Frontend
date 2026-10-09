import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { EditorEarningsAdminResponse, EditorEarningsDetail } from '@/services/invoiceService';

const mocks = vi.hoisted(() => ({ summary: vi.fn(), detail: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/ui/date-range-picker', () => ({ DateRangePicker: () => null }));
vi.mock('./EditorSelfEarningsPanel', () => ({ EditorSelfEarningsPanel: () => null }));
vi.mock('./EditorSelfBillingWorkspace', () => ({ EditorSelfBillingWorkspace: () => null }));
vi.mock('@/services/shootMediaService', () => ({ fetchShootMedia: vi.fn() }));
vi.mock('@/utils/accountingExports', () => ({ exportRowsAsCsv: vi.fn(), exportRowsAsExcel: vi.fn(), exportRowsAsPdf: vi.fn() }));
vi.mock('@/services/invoiceService', () => ({
  fetchAdminEditorEarnings: mocks.summary, fetchAdminEditorEarningsDetail: mocks.detail,
  fetchSelfEditorEarnings: vi.fn(), markAdminEditorPayoutsPaid: vi.fn(), sendAdminEditorReport: vi.fn(), sendSelfEditorReport: vi.fn(),
}));
import { EditorEarningsWorkspace } from './EditorEarningsWorkspace';

const editor = { id: 9, name: 'Editor A', email: 'editor-a@example.test' };
const empty: EditorEarningsAdminResponse = { period: {}, data: [], summary: { editor_count: 0, service_count: 0, total_earned: 0, unpaid_amount: 0, paid_amount: 0 } };
const populated: EditorEarningsAdminResponse = { ...empty, data: [{ editor, status: 'unpaid', service_count: 1, shoot_count: 1, total_earned: 20, unpaid_amount: 20, paid_amount: 0 }] };
const detail: EditorEarningsDetail = {
  editor, period: {}, summary: { service_count: 1, shoot_count: 1, total_earned: 20, unpaid_amount: 20, paid_amount: 0 },
  current_rates: { photo_edit_rate: 2, video_edit_rate: 0, floorplan_rate: 0, virtual_staging_rate: 0, other_rate: 0, service_rates: [] },
  line_items: [{ id: 4, shoot_id: 10, service_name: 'Photo editing', quantity_snapshot: 10, rate_snapshot: 2, payout_amount: 20, is_paid: false }], timeline: [],
};

beforeEach(() => { vi.clearAllMocks(); mocks.summary.mockResolvedValue(empty); mocks.detail.mockResolvedValue(detail); });
afterEach(cleanup);

describe('admin editor empty and loading states', () => {
  it('ignores an old-period summary that finishes after the new-period results', async () => {
    let resolveOld!: (value: EditorEarningsAdminResponse) => void;
    mocks.summary.mockReturnValueOnce(new Promise<EditorEarningsAdminResponse>(resolve => { resolveOld = resolve; })).mockResolvedValue(empty);
    const { rerender } = render(<EditorEarningsWorkspace mode="admin" startDate="2026-09-10" endDate="2026-10-09" />);
    await waitFor(() => expect(mocks.summary).toHaveBeenCalled());
    rerender(<EditorEarningsWorkspace mode="admin" startDate="2026-10-01" endDate="2026-10-09" />);
    await screen.findByText('No editor earnings were found for the current filters.');
    await act(async () => { resolveOld(populated); });
    expect(screen.queryByRole('button', { name: /Editor A/ })).not.toBeInTheDocument();
    expect(mocks.detail).not.toHaveBeenCalled();
  });
  it('requests summary and detail for the inherited Home dates when the reporting period changes', async () => {
    mocks.summary.mockResolvedValue(populated);
    const { rerender } = render(<EditorEarningsWorkspace mode="admin" startDate="2026-09-10" endDate="2026-10-09" />);
    await waitFor(() => expect(mocks.summary).toHaveBeenLastCalledWith(expect.objectContaining({ start: '2026-09-10', end: '2026-10-09', status: 'unpaid' })));
    await waitFor(() => expect(mocks.detail).toHaveBeenLastCalledWith(9, expect.objectContaining({ start: '2026-09-10', end: '2026-10-09' })));
    rerender(<EditorEarningsWorkspace mode="admin" startDate="2026-10-01" endDate="2026-10-09" />);
    await waitFor(() => expect(mocks.summary).toHaveBeenLastCalledWith(expect.objectContaining({ start: '2026-10-01', end: '2026-10-09', status: 'unpaid' })));
    await waitFor(() => expect(mocks.detail).toHaveBeenLastCalledWith(9, expect.objectContaining({ start: '2026-10-01', end: '2026-10-09' })));
  });
  it('settles an empty queue without requesting detail or showing a permanent loader', async () => {
    render(<EditorEarningsWorkspace mode="admin" />);
    await waitFor(() => expect(mocks.summary).toHaveBeenCalled());
    expect(screen.getByText('No editor earnings were found for the current filters.')).toBeInTheDocument();
    expect(screen.getByText('No earnings match the current filters.')).toBeInTheDocument();
    expect(screen.queryByText('Loading editor earnings…')).not.toBeInTheDocument();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Mark 0 unpaid earnings paid' })).toBeDisabled();
  });

  it('clears loaded editor detail when the queue becomes empty', async () => {
    mocks.summary.mockResolvedValue(populated);
    render(<EditorEarningsWorkspace mode="admin" />);
    await screen.findByRole('heading', { name: 'Editor A' });
    expect(screen.getByRole('button', { name: 'Mark 1 unpaid earnings paid' })).toBeEnabled();
    mocks.summary.mockResolvedValue(empty);
    fireEvent.change(screen.getByPlaceholderText('Search editor name or email'), { target: { value: 'No match' } });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Editor A' })).not.toBeInTheDocument());
    expect(screen.queryByText('Loading editor earnings…')).not.toBeInTheDocument();
    expect(screen.getByText('No earnings match the current filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark 0 unpaid earnings paid' })).toBeDisabled();
  });

  it('ignores a late detail response after its editor is filtered out', async () => {
    let resolveDetail!: (value: EditorEarningsDetail) => void;
    mocks.summary.mockResolvedValue(populated);
    mocks.detail.mockReturnValue(new Promise<EditorEarningsDetail>((resolve) => { resolveDetail = resolve; }));
    render(<EditorEarningsWorkspace mode="admin" />);
    await waitFor(() => expect(mocks.detail).toHaveBeenCalled());
    expect(screen.getByText('Loading editor earnings…')).toBeInTheDocument();
    mocks.summary.mockResolvedValue(empty);
    fireEvent.change(screen.getByPlaceholderText('Search editor name or email'), { target: { value: 'No match' } });
    await waitFor(() => expect(screen.queryByText('Loading editor earnings…')).not.toBeInTheDocument());
    await act(async () => { resolveDetail(detail); });
    expect(screen.queryByRole('heading', { name: 'Editor A' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark 0 unpaid earnings paid' })).toBeDisabled();
  });

  it('settles a failed detail request instead of treating missing detail as loading', async () => {
    mocks.summary.mockResolvedValue(populated);
    mocks.detail.mockRejectedValue(new Error('Detail unavailable'));
    render(<EditorEarningsWorkspace mode="admin" />);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Failed to load editor detail' })));
    expect(screen.queryByText('Loading editor earnings…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark 0 unpaid earnings paid' })).toBeDisabled();
  });
});
