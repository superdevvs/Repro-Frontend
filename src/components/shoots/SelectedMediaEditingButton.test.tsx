import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SelectedMediaEditingButton } from './SelectedMediaEditingButton';
const mocks = vi.hoisted(() => ({ role: 'editing_manager', send: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: mocks.role }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/shootEditingDispatch', () => ({ sendShootToEditing: mocks.send }));
vi.mock('@/realtime/realtimeRefreshBus', () => ({ triggerShootDetailRefresh: mocks.refresh }));
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'editing_manager'; mocks.send.mockResolvedValue(true); });
it.each(['admin', 'superadmin', 'editing_manager'])('sends only the selected identities for %s and refreshes after confirmation', async role => {
  mocks.role = role;
  render(<SelectedMediaEditingButton shootId={396} ids={new Set(['14', '92'])} />);
  fireEvent.click(screen.getByRole('button', { name: 'Send to editing (2)' }));
  expect(mocks.send).toHaveBeenCalledWith(396, [14, 92]);
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledWith('396'));
});
it.each(['client', 'editor', 'photographer', 'salesRep'])('does not expose dispatch to %s', role => {
  mocks.role = role;
  render(<SelectedMediaEditingButton shootId={396} ids={new Set(['14'])} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('does not refresh for a cancelled request', async () => {
  mocks.send.mockResolvedValue(false);
  render(<SelectedMediaEditingButton shootId={396} ids={new Set(['14'])} />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(mocks.send).toHaveBeenCalled());
  expect(mocks.refresh).not.toHaveBeenCalled();
});
