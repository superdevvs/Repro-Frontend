import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRole = vi.fn(() => 'admin');

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ role: mockRole(), user: { id: 1, name: 'AJ' } }),
}));

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

vi.mock('@/config/env', () => ({ API_BASE_URL: '' }));

import { RescheduleRequestsPanel } from './RescheduleRequestsPanel';

/**
 * A1.docx item 4: with submission no longer applying the change, the three
 * request states have to be distinguishable and a reviewer needs to act on them.
 */
const requests = [
  {
    id: 11,
    status: 'pending',
    original_date: '2026-09-10',
    original_time: '10:00 AM',
    requested_date: '2026-09-24',
    requested_time: '02:30 PM',
    reason: 'Sellers need another week.',
    requester: { id: 3, name: 'Test Client' },
  },
  {
    id: 12,
    status: 'approved',
    original_date: '2026-08-01',
    requested_date: '2026-08-08',
    requester: { id: 3, name: 'Test Client' },
  },
  {
    id: 13,
    status: 'rejected',
    original_date: '2026-07-01',
    requested_date: '2026-07-09',
    review_notes: 'Photographer unavailable.',
    requester: { id: 3, name: 'Test Client' },
  },
];

const mockList = (data: unknown[]) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({ message: 'Reschedule request approved and applied.', applied: true }),
        } as Response;
      }

      return { ok: true, json: async () => ({ data }) } as Response;
    }),
  );
};

beforeEach(() => {
  mockRole.mockReturnValue('admin');
  toast.mockClear();
  mockList(requests);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('RescheduleRequestsPanel', () => {
  it('labels pending, approved and rejected requests distinctly', async () => {
    render(<RescheduleRequestsPanel shootId={1} />);

    expect(await screen.findByText('Pending review')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByText('Rejected')).toBeTruthy();
  });

  it('says a pending request has not moved the shoot', async () => {
    render(<RescheduleRequestsPanel shootId={1} />);

    expect(
      await screen.findByText(/keeps its current date until this is approved/i),
    ).toBeTruthy();
  });

  it('shows the requested change against the confirmed one', async () => {
    render(<RescheduleRequestsPanel shootId={1} />);

    expect(await screen.findByText(/Sep 10, 2026 10:00 AM → Sep 24, 2026 02:30 PM/)).toBeTruthy();
  });

  it('offers approve and reject only on the pending request, and only to staff', async () => {
    render(<RescheduleRequestsPanel shootId={1} />);

    await screen.findByText('Pending review');

    // One pending row => exactly one pair of controls.
    expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Reject' })).toHaveLength(1);
  });

  it('hides the review controls from a client', async () => {
    mockRole.mockReturnValue('client');
    render(<RescheduleRequestsPanel shootId={1} />);

    await screen.findByText('Pending review');

    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('sends an approval and tells the parent the shoot changed', async () => {
    const onReviewed = vi.fn();
    render(<RescheduleRequestsPanel shootId={1} onReviewed={onReviewed} />);

    await screen.findByText('Pending review');
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(onReviewed).toHaveBeenCalled();
    });

    const patch = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'PATCH',
    );

    expect(patch?.[0]).toBe('/api/shoots/reschedule-requests/11');
    expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({ status: 'approved' });
  });

  it('does not refresh the shoot after a rejection, because nothing changed', async () => {
    const onReviewed = vi.fn();
    render(<RescheduleRequestsPanel shootId={1} onReviewed={onReviewed} />);

    await screen.findByText('Pending review');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Request rejected' }),
      );
    });

    expect(onReviewed).not.toHaveBeenCalled();
  });

  it('renders nothing when there are no requests', async () => {
    mockList([]);
    const { container } = render(<RescheduleRequestsPanel shootId={1} />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="reschedule-requests-panel"]')).toBeNull();
    });
  });
});
