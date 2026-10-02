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

  it('renders request category count badges red when count > 0 and muted when zero', () => {
    renderCard();

    const rescheduleCount = screen.getByTestId('request-tab-count-reschedule');
    const holdCount = screen.getByTestId('request-tab-count-hold');
    const clientCount = screen.getByTestId('request-tab-count-client');

    expect(rescheduleCount).toHaveTextContent('2');
    expect(holdCount).toHaveTextContent('0');
    expect(clientCount).toHaveTextContent('0');

    expect(rescheduleCount.className).toMatch(/destructive/);
    expect(holdCount.className).not.toMatch(/destructive/);
    expect(holdCount.className).toMatch(/secondary/);
    expect(clientCount.className).not.toMatch(/destructive/);
    expect(clientCount.className).toMatch(/secondary/);
  });

});
