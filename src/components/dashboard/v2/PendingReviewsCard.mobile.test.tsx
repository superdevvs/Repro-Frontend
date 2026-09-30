import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HoldRequestsState } from '@/features/dashboard/hooks/useHoldRequests';
import type { RescheduleRequestsState } from '@/features/dashboard/hooks/useRescheduleRequests';
import { PendingReviewsCard } from './PendingReviewsCard';

vi.mock('@/context/RequestManagerContext', () => ({ useRequestManager: () => ({ openModal: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const holdRequests: HoldRequestsState = {
  shoots: [],
  loading: false,
  error: null,
  refresh: vi.fn(),
  decide: vi.fn(),
  actioning: null,
};

const rescheduleRequests: RescheduleRequestsState = {
  requests: [],
  pendingCount: 2,
  loading: false,
  error: null,
  refresh: vi.fn(),
  decide: vi.fn(),
  actioning: null,
};

function renderCard() {
  return render(
    <PendingReviewsCard
      reviews={[]}
      issues={[]}
      onSelect={vi.fn()}
      showClientTab
      showEditingTab
      showCancellationTab
      holdRequests={holdRequests}
      rescheduleRequests={rescheduleRequests}
    />,
  );
}

describe('PendingReviewsCard request-type list (all breakpoints)', () => {
  afterEach(() => {
    cleanup();
  });

  it('lists request types with counts, drills in, and returns via back', () => {
    renderCard();

    expect(screen.getByRole('button', { name: 'Client' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancellation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reschedule (2)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to Requests' })).not.toBeInTheDocument();
    expect(screen.queryByText('No pending hold requests.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hold' }));
    expect(screen.getByRole('button', { name: 'Back to Requests' })).toBeInTheDocument();
    expect(screen.getByText('No pending hold requests.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reschedule (2)' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Requests' }));
    expect(screen.getByRole('button', { name: 'Reschedule (2)' })).toBeInTheDocument();
    expect(screen.queryByText('No pending hold requests.')).not.toBeInTheDocument();
  });

  it('skips the type list when only one tab is available', () => {
    render(
      <PendingReviewsCard
        reviews={[]}
        issues={[]}
        onSelect={vi.fn()}
        showClientTab
        clientRequests={[]}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Client' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to Requests' })).not.toBeInTheDocument();
    expect(screen.getByText('No active requests.')).toBeInTheDocument();
  });
});
