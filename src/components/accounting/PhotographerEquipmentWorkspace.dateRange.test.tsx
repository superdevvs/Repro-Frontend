import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { PhotographerEquipment } from '@/services/photographerEquipmentService';

const mocks = vi.hoisted(() => ({ list: vi.fn(), exportCsv: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/api', () => ({ apiClient: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) } }));
vi.mock('@/utils/accountingExports', () => ({ exportRowsAsCsv: mocks.exportCsv }));
vi.mock('@/components/equipment/EquipmentVerificationDialog', () => ({ EquipmentVerificationDialog: () => null }));
vi.mock('@/services/photographerEquipmentService', () => ({
  listAdminPhotographerEquipments: mocks.list,
  equipmentStatusLabel: (status: string) => status,
  approvePhotographerEquipment: vi.fn(), createAdminPhotographerEquipment: vi.fn(), deleteAdminPhotographerEquipment: vi.fn(),
  rejectPhotographerEquipment: vi.fn(), sendPhotographerEquipmentVerificationEmail: vi.fn(), updateAdminPhotographerEquipment: vi.fn(), uploadAdminEquipmentPhotos: vi.fn(),
}));
import { PhotographerEquipmentWorkspace } from './PhotographerEquipmentWorkspace';

const range = { startDate: '2026-10-01', endDate: '2026-10-09' };
const records: PhotographerEquipment[] = Array.from({ length: 9 }, (_, index) => ({
  id: index + 1, name: `Camera ${index + 1}`, photographer_id: 4,
  issue_date: index === 0 ? null : '2026-10-09', created_at: '2026-10-01T14:00:00Z', status: 'pending_verification', photos: [],
}));
beforeEach(() => { vi.clearAllMocks(); mocks.list.mockImplementation((filters) => Promise.resolve(filters ? records : [])); });
afterEach(cleanup);

describe('equipment reporting range', () => {
  it('uses the Home range for requests, paginates, and exports the same filtered records', async () => {
    const { rerender } = render(<PhotographerEquipmentWorkspace reportingRange={range} />);
    await screen.findByText('Camera 1');
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ start_date: range.startDate, end_date: range.endDate }));
    expect(screen.queryByText('Camera 9')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next equipment page' }));
    expect(screen.getByText('Camera 9')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(mocks.exportCsv).toHaveBeenCalledWith('equipment-2026-10-01-2026-10-09', expect.any(Array), expect.arrayContaining([
      expect.objectContaining({ name: 'Camera 1', assignment_date: '2026-10-01', range_start: range.startDate, range_end: range.endDate }),
      expect.objectContaining({ name: 'Camera 9' }),
    ]));
    const nextRange = { startDate: '2026-09-01', endDate: '2026-09-30' };
    rerender(<PhotographerEquipmentWorkspace reportingRange={nextRange} />);
    await waitFor(() => expect(screen.getByText('Page 1 / 2')).toBeInTheDocument());
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ start_date: nextRange.startDate, end_date: nextRange.endDate }));
  });

  it('keeps the dedicated Equipment tab unbounded when no Home range is supplied', async () => {
    render(<PhotographerEquipmentWorkspace />);
    await screen.findByText('Camera 9');
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ start_date: undefined, end_date: undefined }));
    expect(screen.queryByRole('button', { name: 'CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next equipment page' })).not.toBeInTheDocument();
  });

  it('ignores an older request that finishes after the reporting range changes', async () => {
    let resolveOld!: (value: PhotographerEquipment[]) => void;
    mocks.list.mockImplementation((filters) => filters?.start_date === range.startDate
      ? new Promise<PhotographerEquipment[]>((resolve) => { resolveOld = resolve; })
      : Promise.resolve(filters ? [{ ...records[0], name: 'New range camera' }] : []));
    const { rerender } = render(<PhotographerEquipmentWorkspace reportingRange={range} />);
    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ start_date: range.startDate })));
    rerender(<PhotographerEquipmentWorkspace reportingRange={{ startDate: '2026-09-01', endDate: '2026-09-30' }} />);
    await screen.findByText('New range camera');
    await act(async () => resolveOld(records));
    expect(screen.getByText('New range camera')).toBeInTheDocument();
    expect(screen.queryByText('Camera 1')).not.toBeInTheDocument();
  });
});
