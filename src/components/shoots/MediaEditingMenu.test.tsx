import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MediaEditingMenu } from './MediaEditingMenu';

const mocks = vi.hoisted(() => ({ get: vi.fn(), versions: vi.fn(), send: vi.fn(), role: 'admin' }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: mocks.role }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/api', () => ({ apiClient: { get: mocks.get } }));
vi.mock('@/services/mediaVersions', () => ({ openMediaVersions: mocks.versions }));
vi.mock('@/services/shootEditingDispatch', () => ({ sendShootToEditing: mocks.send }));
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'admin'; mocks.get.mockResolvedValue({ data: { data: { available: true } } }); });
afterEach(cleanup);

it('offers video versions without Photoshop or photo-editing actions', async () => {
  const user = userEvent.setup();
  render(<MediaEditingMenu shootId={8} file={{ id: '12', filename: 'Listing.mp4', media_type: 'video', workflowStage: 'verified' }} />);
  await user.click(screen.getByRole('button', { name: 'Editing actions for Listing.mp4' }));
  expect(screen.queryByRole('menuitem', { name: /Photoshop/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'Send to editing…' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('menuitem', { name: 'Versions / review replacements…' }));
  expect(mocks.versions).toHaveBeenCalledExactlyOnceWith({ shootId: 8, fileId: '12', name: 'Listing.mp4', mediaType: 'video' });
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});

it('keeps Photoshop and photo-editing choices for image files', async () => {
  const user = userEvent.setup();
  render(<MediaEditingMenu shootId={8} file={{ id: '12', filename: 'Kitchen.jpg', media_type: 'edited', workflowStage: 'verified' }} />);
  await user.click(screen.getByRole('button', { name: 'Editing actions for Kitchen.jpg' }));
  await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Open in Photoshop…' })).toBeInTheDocument());
  expect(screen.getByRole('menuitem', { name: 'Send to editing…' })).toBeInTheDocument();
  await user.click(screen.getByRole('menuitem', { name: 'Versions / upload saved edit…' }));
  expect(mocks.versions).toHaveBeenCalledWith({ shootId: 8, fileId: '12', name: 'Kitchen.jpg', mediaType: 'image' });
});
