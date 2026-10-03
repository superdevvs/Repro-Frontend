import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PendingReviewsCard } from './PendingReviewsCard';
import { RequestManagerProvider } from '@/context/RequestManagerContext';
import { RequestManagerModal } from '@/components/requests/RequestManagerModal';

const state = vi.hoisted(() => ({ role: 'editing_manager', get: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: state.role, user: { id: 7 } }) }));
vi.mock('@/services/api', () => ({ apiClient: state }));

beforeEach(() => {
  vi.clearAllMocks();
  state.role = 'editing_manager';
  state.get.mockResolvedValue({ data: { data: [], last_page: 1 } });
});
afterEach(cleanup);

function renderRequests() {
  render(<MemoryRouter><RequestManagerProvider>
    <PendingReviewsCard reviews={[]} issues={[]} onSelect={vi.fn()} showClientTab showEditingTab />
    <RequestManagerModal />
  </RequestManagerProvider></MemoryRouter>);
}

it.each(['editing_manager', 'admin', 'superadmin', 'editor'])('opens tasks through Requests → Editing for %s', async role => {
  state.role = role;
  renderRequests();
  expect(screen.queryByRole('button', { name: 'Editing tasks' })).not.toBeInTheDocument();
  expect(state.get).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Editing' }));
  const requests = screen.getByTestId('pending-reviews-card');
  fireEvent.click(within(requests).getByRole('button', { name: 'Editing tasks' }));
  expect(await screen.findByRole('dialog', { name: 'Editing tasks' })).toBeVisible();
  await screen.findByText('No selected-media editing requests yet.');
  expect(state.get).toHaveBeenCalledWith('/editing-tasks?page=1', expect.objectContaining({ signal: expect.any(AbortSignal) }));

  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to Requests' }));
  expect(screen.queryByRole('button', { name: 'Editing tasks' })).not.toBeInTheDocument();
});

it('keeps the expanded Request Manager accessible after closing editing tasks', async () => {
  renderRequests();
  fireEvent.click(screen.getByRole('button', { name: 'View all requests' }));
  fireEvent.click(screen.getByRole('tab', { name: /Editing/ }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Request Manager' })).getByRole('button', { name: 'Editing tasks' }));
  const tasks = await screen.findByRole('dialog', { name: 'Editing tasks' });
  fireEvent.click(within(tasks).getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('dialog', { name: 'Request Manager' })).toBeVisible();
  expect(screen.getByRole('tab', { name: /Editing/ })).toHaveAttribute('aria-selected', 'true');
});

it.each(['client', 'photographer', 'salesRep'])('does not expose staff tasks to %s', role => {
  state.role = role;
  renderRequests();
  fireEvent.click(screen.getByRole('button', { name: 'Editing' }));
  expect(screen.queryByRole('button', { name: 'Editing tasks' })).not.toBeInTheDocument();
  expect(state.get).not.toHaveBeenCalled();
});
