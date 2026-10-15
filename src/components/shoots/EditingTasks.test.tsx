import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EditingTasks } from './EditingTasks';
const state = vi.hoisted(() => ({ role: 'editor', get: vi.fn(), post: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: state.role, user: { id: 7 } }) }));
vi.mock('@/services/api', () => ({ apiClient: state }));
const item = { id: 'item-1', workflow: 'green-grass', sources: [{ id: 11, name: 'Lawn.jpg', version: 4 }], lane: 'photo', destination: 'human', status: 'assigned' };
beforeEach(() => { vi.clearAllMocks(); state.role = 'editor'; state.get.mockResolvedValue({ data: { data: [{ id: 'dispatch-1', shoot_id: 9, address: 'Fixture', scope: 'selected', instructions: 'Grass only', status: 'assigned', items: [item] }], last_page: 1 } }); state.post.mockResolvedValue({ data: {} }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
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

it.each([true, false, undefined])('limits client context to explicitly authorized video tasks (%s)', async permission => {
  state.get.mockResolvedValue({ data: { data: [{ id: 'dispatch-video', shoot_id: 9, address: 'Fixture', scope: 'selected', status: 'assigned', items: [{ ...item, lane: 'video' }],
    shoot: { clientName: 'Jordan Video Client', companyNotes: 'Include the client branding on the end card.', canViewVideoEditorContext: permission },
  }], last_page: 1 } });
  render(<EditingTasks shootId={9} open hideTrigger />);
  await screen.findByText('Lawn.jpg · v4');
  if (permission) {
    expect(screen.getByText('Jordan Video Client', { exact: false })).toBeVisible();
    expect(screen.getByText('Company Notes')).toBeVisible();
    expect(screen.getByText('Include the client branding on the end card.')).toBeVisible();
  } else {
    expect(screen.queryByText('Jordan Video Client', { exact: false })).toBeNull();
    expect(screen.queryByText('Company Notes')).toBeNull();
    expect(screen.queryByText('Include the client branding on the end card.')).toBeNull();
  }
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  expect(state.post).not.toHaveBeenCalled();
});

it('pauses editing-manager task polling while hidden or offline and refreshes on return', async () => {
  vi.useFakeTimers();
  state.role = 'editing_manager';
  let hidden = false;
  let online = true;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  const { unmount } = render(<EditingTasks open hideTrigger />);
  await act(async () => { await Promise.resolve(); });
  expect(state.get).toHaveBeenCalledTimes(1);
  hidden = true;
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(state.get).toHaveBeenCalledTimes(1);
  hidden = false;
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(state.get).toHaveBeenCalledTimes(2);
  online = false;
  act(() => window.dispatchEvent(new Event('offline')));
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(state.get).toHaveBeenCalledTimes(2);
  online = true;
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(state.get).toHaveBeenCalledTimes(3);
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(state.get).toHaveBeenCalledTimes(3);
});

it('waits for a slow automatic task request before scheduling the next one', async () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  let resolve!: (value: unknown) => void;
  state.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  render(<EditingTasks open hideTrigger />);
  await act(async () => { await vi.advanceTimersByTimeAsync(35_000); });
  expect(state.get).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ data: { data: [], last_page: 1 } }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(9999); });
  expect(state.get).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(state.get).toHaveBeenCalledTimes(2);
});
