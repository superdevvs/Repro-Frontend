import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootApprovalModal } from './ShootApprovalModal';
import type { TravelFeasibility } from '@/features/travel/types';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/shoots/ServiceSchedulePicker', () => ({
  ServiceDatePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <input aria-label="Schedule date" value={value} onChange={event => onChange(event.target.value)} />,
  ServiceTimePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <input aria-label="Schedule time" value={value} onChange={event => onChange(event.target.value)} />,
}));

const shoot = { id: 42, client_id: 2, photographer_id: 9, address: '42 Approval Lane',
  status: 'requested', workflow_status: 'requested', timezone: 'America/New_York',
  scheduled_at: '2026-10-22T18:00:00Z',
  service_items: [{ id: 101, service_id: 10, name: 'Photos', price: 100, quantity: 1,
    duration_minutes: 75, photographer_required: true, photographer_id: 9, scheduled_at: '2026-10-22T18:00:00Z' }] };
const hours: TravelFeasibility = { enabled: true, available: false, status: 'conflict',
  reason_codes: ['outside_working_hours'], transitions: [], alternatives: [], can_override: false,
  can_override_working_hours: true, working_hours_confirmation_version: 'signed-pending-hours-v1',
  policy_version: '1', schedule_version: '1', visits: [{ photographer_id: 9, start: '2026-10-22T18:00:00Z',
    end: '2026-10-22T19:15:00Z', scheduled_at: '2026-10-22T18:00:00Z', duration_minutes: 75, timezone: 'America/New_York' }] };
let preview: TravelFeasibility;
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  preview = hours;
  fetcher = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({
    data: String(input).endsWith('/feasibility') ? preview : String(input).includes('/api/shoots/') ? shoot : [],
  })));
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const requests = () => fetcher.mock.calls.filter(([input]) => String(input).endsWith('/42/approve'));
const open = () => render(<ShootApprovalModal isOpen shootId={42} photographers={[{ id: 9, name: 'QA Photographer' }]} onClose={vi.fn()} onApproved={vi.fn()} />);

describe('pending approval warning confirmation', () => {
  it.each(['hours', 'travel'] as const)('clearly reviews and deliberately confirms a signed %s exception before approving', async kind => {
    if (kind === 'travel') preview = { ...hours, status: 'review_required', reason_codes: ['travel_review_required'],
      can_override: true, can_override_working_hours: false, confirmation_version: 'signed-pending-travel-v1' };
    open();
    const approve = await screen.findByRole('button', { name: 'Review and approve' });
    await waitFor(() => expect(approve).toBeEnabled());
    expect(requests()).toHaveLength(0);
    fireEvent.click(approve);
    const dialog = await screen.findByRole('dialog', { name: kind === 'hours' ? 'Approve outside working hours' : 'Confirm travel exception' });
    const confirm = within(dialog).getByRole('button', { name: kind === 'hours' ? 'Confirm and approve outside hours' : 'Confirm travel exception and approve' });
    expect(confirm).toBeDisabled();
    expect(requests()).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(kind === 'hours' ? 'Working-hours exception reason' : 'Travel exception reason'),
      { target: { value: 'Photographer reviewed the 2pm appointment.' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(requests()).toHaveLength(1));
    const body = JSON.parse(String(requests()[0][1]?.body));
    expect(body).toMatchObject(kind === 'hours' ? { working_hours_override: true, working_hours_override_confirmed: true,
      working_hours_override_confirmation_version: 'signed-pending-hours-v1' } : { travel_override: true,
      travel_override_confirmed: true, travel_override_confirmation_version: 'signed-pending-travel-v1' });
    expect(body.scheduled_at).toBe('2026-10-22T18:00:00.000Z');
    expect(body.service_items).toEqual([expect.objectContaining({ service_id: 10, duration_minutes: 75 })]);
  });

  it.each(['overlap', 'permission'] as const)('does not enable approval for %s despite a stale signed offer', async kind => {
    preview = { ...hours, ...(kind === 'overlap' ? { reason_codes: ['outside_working_hours', 'capture_overlap'] } : { can_override_working_hours: false }) };
    open();
    await screen.findByText(kind === 'overlap' ? 'Already booked at this time' : 'Outside working hours');
    expect(screen.getByRole('button', { name: 'Approve Shoot' })).toBeDisabled();
    expect(requests()).toHaveLength(0);
  });
});

