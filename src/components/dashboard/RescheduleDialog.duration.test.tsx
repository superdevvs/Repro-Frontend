import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { RescheduleDialog } from './RescheduleDialog';

const mocks = vi.hoisted(() => ({ role: 'superadmin', post: vi.fn(), fetchShoots: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: mocks.role, user: { role: mocks.role } }) }));
vi.mock('@/context/shootsContextState', () => ({ useShoots: () => ({ fetchShoots: mocks.fetchShoots }) }));
vi.mock('axios', () => ({ default: { post: mocks.post, isAxiosError: () => false } }));
vi.mock('@/components/ui/time-select', () => ({ TimeSelect: () => <span>Time picker</span> }));
const shoot = { id: '42', scheduled_at: '2026-10-08T10:00:00', serviceObjects: [
  { id: '10', name: 'Photos', duration_minutes: 30 }, { id: '11', name: 'Video', duration_minutes: 90 },
] } as unknown as ShootData;
beforeEach(() => { mocks.role = 'superadmin'; mocks.post.mockResolvedValue({ data: { applied: true } }); localStorage.setItem('authToken', 'test'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });
describe('rescheduling service duration', () => {
  it('submits only changed duration and resets it on reopen', async () => {
    const props = { shoot, isOpen: true, onClose: vi.fn() };
    const view = render(<RescheduleDialog {...props} />);
    expect(screen.getByLabelText('Shoot duration for Photos')).toHaveValue('30');
    fireEvent.change(screen.getByLabelText('Shoot duration for Photos'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule Shoot' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    expect(mocks.post.mock.calls[0][1]).toMatchObject({ services: [{ id: 10, duration_minutes: 120 }] });
    view.rerender(<RescheduleDialog {...props} isOpen={false} />);
    view.rerender(<RescheduleDialog {...props} />);
    expect(screen.getByLabelText('Shoot duration for Photos')).toHaveValue('30');
  });
  it.each(['client', 'photographer', 'editor'])('keeps %s reschedule requests date/time only', async role => {
    mocks.role = role;
    render(<RescheduleDialog shoot={shoot} isOpen onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Shoot duration for Photos')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('services');
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('service_lines');
  });
  it('identifies repeated services by booked line for a multi-unit reschedule', async () => {
    render(<RescheduleDialog shoot={{ ...shoot, units_revision: 4,
      units: [{ id: 1, label: '101', kind: 'unit', sqft: 900 }, { id: 2, label: '102', kind: 'unit', sqft: 900 }],
      service_lines: [{ id: '10', shoot_service_id: '51', service_id: '10', name: 'Photos', unit_label: '101', duration_minutes: 30 },
        { id: '10', shoot_service_id: '52', service_id: '10', name: 'Photos', unit_label: '102', duration_minutes: 90 }],
    } as ShootData} isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Shoot duration for Photos · 102'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule Shoot' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    expect(mocks.post.mock.calls[0][1]).toMatchObject({ expected_units_revision: 4, service_lines: [{ shoot_service_id: 52, duration_minutes: 60 }] });
  });
});
