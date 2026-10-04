import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { EditingTasks } from './EditingTasks';
const state = vi.hoisted(() => ({ role: 'editor', get: vi.fn(), post: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: state.role, user: { id: 7 } }) }));
vi.mock('@/services/api', () => ({ apiClient: state }));
const item = { id: 'item-1', workflow: 'green-grass', sources: [{ id: 11, name: 'Lawn.jpg', version: 4 }], lane: 'photo', destination: 'human', status: 'assigned' };
beforeEach(() => { vi.clearAllMocks(); state.role = 'editor'; state.get.mockResolvedValue({ data: { data: [{ id: 'dispatch-1', shoot_id: 9, address: 'Fixture', scope: 'selected', instructions: 'Grass only', status: 'assigned', items: [item] }], last_page: 1 } }); state.post.mockResolvedValue({ data: {} }); });
it('shows exact files/instructions and blocks submission until the saved return is processed', async () => {
  render(<EditingTasks />); expect(state.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Editing tasks' }));
  await screen.findByText('Lawn.jpg · v4'); expect(screen.getByText(/Grass only/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Submit this task' })).toBeDisabled();
  const file = new File(['jpeg'], 'Lawn.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText('Return edit for Lawn.jpg'), { target: { files: [file] } });
  state.post.mockRejectedValueOnce(new Error('Response lost'));
  fireEvent.click(screen.getByRole('button', { name: 'Upload saved edit' }));
  await screen.findByRole('alert'); const first = state.post.mock.calls[0][1].get('request_id');
  fireEvent.click(screen.getByRole('button', { name: 'Upload saved edit' }));
  await screen.findByRole('status'); expect(state.post.mock.calls[1][1].get('request_id')).toBe(first);
  state.get.mockResolvedValue({ data: { data: [{ id: 'dispatch-1', shoot_id: 9, address: 'Fixture', scope: 'selected', status: 'assigned', items: [{ ...item, status: 'returned' }] }], last_page: 1 } });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh tasks' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Submit this task' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Submit this task' }));
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/editing-tasks/item-1/submit'));
});
it.each(['client', 'photographer', 'salesRep'])('never fetches editing tasks for %s', role => {
  state.role = role; render(<EditingTasks />); expect(screen.queryByRole('button', { name: 'Editing tasks' })).not.toBeInTheDocument(); expect(state.get).not.toHaveBeenCalled();
});
it('opens queue assignments directly with the selected shoot filter', async () => {
  render(<EditingTasks shootId={379} open hideTrigger onOpenChange={vi.fn()} />);
  await screen.findByText('Lawn.jpg · v4');
  expect(state.get).toHaveBeenCalledWith('/editing-tasks?page=1&shoot_id=379', expect.anything());
  expect(screen.queryByRole('button', { name: 'Editing tasks' })).not.toBeInTheDocument();
});
