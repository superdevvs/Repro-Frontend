import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DashboardClientRequest } from '@/types/dashboard';

import { RequestManagerModal } from './RequestManagerModal';

const requests: DashboardClientRequest[] = [
  {
    id: 'request-1',
    note: 'Replace the twilight hero image',
    status: 'open',
    shootId: 101,
    shoot: {
      id: 101,
      address: '124 Main Street, Ashburn, VA',
      client: { id: 1, name: 'Vicki Harper' },
    },
    raisedBy: { id: '1', name: 'Vicki Harper', role: 'Client' },
    createdAt: '2026-09-01T12:00:00Z',
    updatedAt: '2026-09-03T08:00:00Z',
  },
  {
    id: 'request-2',
    note: 'Remove the car from driveway photo',
    status: 'in-progress',
    shootId: 102,
    shoot: {
      id: 102,
      address: '88 Lake View Drive, Reston, VA',
      client: { id: 2, name: 'Alex Morgan' },
    },
    raisedBy: { id: '2', name: 'Alex Morgan', role: 'Client' },
    createdAt: '2026-09-01T09:00:00Z',
    updatedAt: '2026-09-02T08:00:00Z',
  },
  {
    id: 'request-3',
    note: 'Resolved floor plan label correction',
    status: 'resolved',
    shootId: 103,
    shoot: {
      id: 103,
      address: '9137 Lakeland Valley Court, Springfield, VA',
      client: { id: 3, name: 'Jordan Lee' },
    },
    raisedBy: { id: '3', name: 'Jordan Lee', role: 'Client' },
    createdAt: '2026-08-30T09:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
  },
];

const managerState = vi.hoisted(() => ({
  isOpen: true,
  requests: [] as DashboardClientRequest[],
  selectedRequestId: 'request-1' as string | null,
  closeModal: vi.fn(),
  selectRequest: vi.fn(),
  updateRequest: vi.fn(),
  openRequestShoot: vi.fn().mockResolvedValue('opened'),
}));

vi.mock('@/context/RequestManagerContext', () => ({
  useRequestManager: () => managerState,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('RequestManagerModal', () => {
  beforeEach(() => {
    managerState.isOpen = true;
    managerState.requests = requests;
    managerState.selectedRequestId = 'request-1';
    managerState.closeModal.mockClear();
    managerState.selectRequest.mockClear();
    managerState.updateRequest.mockClear();
  });

  afterEach(() => cleanup());

  it('separates the active queue from resolved history', () => {
    render(<RequestManagerModal />);

    const queue = screen.getByRole('region', { name: 'Request queue' });
    expect(within(queue).getByText('Replace the twilight hero image')).toBeVisible();
    expect(within(queue).getByText('Remove the car from driveway photo')).toBeVisible();
    expect(within(queue).queryByText('Resolved floor plan label correction')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /history\s*1/i }));

    expect(within(queue).getByText('Resolved floor plan label correction')).toBeVisible();
    expect(within(queue).queryByText('Replace the twilight hero image')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  });

  it('filters the queue by note, address, or client while keeping details in place', () => {
    render(<RequestManagerModal />);

    const queue = screen.getByRole('region', { name: 'Request queue' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search requests' }), {
      target: { value: 'Reston' },
    });

    expect(within(queue).getByText('Remove the car from driveway photo')).toBeVisible();
    expect(within(queue).queryByText('Replace the twilight hero image')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Request details' })).toHaveTextContent(
      'Remove the car from driveway photo',
    );
  });
});
