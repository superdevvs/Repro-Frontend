import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { DesktopEditingSettings } from './DesktopEditingSettings';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: api }));
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: { data: { available: false, reason: 'Signing and platform testing are pending.', installers: {}, devices: [] } } }); });
it('does not advertise installation while signing is unavailable and explains manual return', async () => {
  render(<DesktopEditingSettings />); await screen.findByText('Helper release pending');
  expect(screen.queryByRole('link', { name: /installer/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Connect installed helper' })).not.toBeInTheDocument();
  expect(screen.getByText(/For now, download an edited image/)).toBeVisible();
});
it('shows manual default, Photoshop status, and disconnects exactly the chosen device', async () => {
  api.get.mockResolvedValue({ data: { data: { available: false, installers: {}, devices: [{ id: 'own-device', name: 'Office Mac', platform: 'darwin-arm64', photoshop_detected: true, auto_upload: false, expires_at: '2027-01-01' }] } } });
  api.delete.mockResolvedValue({ data: {} }); render(<DesktopEditingSettings />);
  await screen.findByText(/Photoshop detected/); expect(screen.getByText(/Manual upload by default/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect device' }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/desktop-editing/devices/own-device'));
});
