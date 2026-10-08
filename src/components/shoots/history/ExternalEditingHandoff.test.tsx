import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext';
import { SharedShootCard } from '../SharedShootCard';
import { CompletedAlbumCard } from './CompletedAlbumCard';
import { CompletedShootListRow } from './CompletedShootListRow';
import { ScheduledShootListRow } from './ScheduledShootListRow';
import type { ShootData } from '@/types/shoots';
import { getShootDetailsCapabilities } from '../modal/shootDetailsCapabilities';

vi.mock('@/hooks/useWeatherData', () => ({ useWeatherData: () => ({}) }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light' }) }));
afterEach(cleanup);

const shoot = {
  id: '2385', status: 'uploaded', workflowStatus: 'uploaded',
  scheduledDate: '2026-10-07', time: '14:30:00', rawPhotoCount: 0,
  location: { address: '5 Sunnydale Way', city: 'Reisterstown', state: 'MD', zip: '21136' },
  client: { name: 'Example Client' }, photographer: { name: 'Example Photographer' },
  services: ['HDR Photos & Video'], payment: { totalQuote: 299, totalPaid: 0 }, files: [],
} as unknown as ShootData;

describe('externally shared editing intake', () => {
  it.each(['shared card', 'album card', 'in-progress row', 'scheduled row'])('opens Send to Editing from %s with no dashboard RAWs', async view => {
    const send = vi.fn();
    const select = vi.fn();
    const props = { shoot, onSelect: select, onSendToEditing: send };
    render(<UserPreferencesProvider>
      {view === 'shared card' ? <SharedShootCard {...props} role="editing_manager" />
        : view === 'album card' ? <CompletedAlbumCard {...props} isEditingManager viewerRole="editing_manager" />
          : view === 'in-progress row' ? <CompletedShootListRow {...props} isEditingManager viewerRole="editing_manager" />
            : <ScheduledShootListRow {...props} isEditingManager viewerRole="editing_manager" />}
    </UserPreferencesProvider>);
    const user = userEvent.setup();
    if (view === 'scheduled row') {
      await user.click(screen.getAllByRole('button', { name: 'More actions' })[0]);
      await user.click(await screen.findByRole('menuitem', { name: 'Send to editing' }));
    } else {
      await user.click(screen.getByTitle('Send to Editing'));
    }
    expect(send).toHaveBeenCalledWith(shoot);
    expect(select).not.toHaveBeenCalled();
  });

  it.each(['admin', 'superadmin', 'editing_manager', 'editor', 'photographer', 'client', 'salesRep'])('keeps the details handoff scoped to staff for %s', role => {
    const staff = ['admin', 'superadmin', 'editing_manager'].includes(role);
    const capabilities = (status: string) => getShootDetailsCapabilities({
      shoot: { ...shoot, status, workflowStatus: status }, currentUserRole: role,
      roleFlags: { isAdmin: staff, isAdminOrRep: staff || role === 'salesRep',
        isEditingManager: role === 'editing_manager', isRep: role === 'salesRep',
        isPhotographer: role === 'photographer', isEditor: role === 'editor', isClient: role === 'client' },
    });
    for (const status of ['requested', 'uploaded', 'raw_uploaded', 'photos_uploaded', 'completed']) expect(capabilities(status).canSendToEditing).toBe(role === 'editing_manager');
    for (const status of ['scheduled', 'booked', 'editing', 'on_hold', 'cancelled', 'declined', 'delivered', 'review']) expect(capabilities(status).canSendToEditing).toBe(false);
  });

  it('keeps a cancelled workflow closed even if the base shoot status is uploaded', () => {
    render(<UserPreferencesProvider><SharedShootCard shoot={{ ...shoot, workflowStatus: 'cancelled' }} role="editing_manager" onSendToEditing={vi.fn()} /></UserPreferencesProvider>);
    expect(screen.queryByTitle('Send to Editing')).not.toBeInTheDocument();
  });

  it.each(['editing', 'scheduled', 'requested'])('hides the card handoff in %s for admins', status => {
    render(<UserPreferencesProvider><SharedShootCard shoot={{ ...shoot, status, workflowStatus: status }} role="admin" onSendToEditing={vi.fn()} /></UserPreferencesProvider>);
    expect(screen.queryByTitle('Send to Editing')).not.toBeInTheDocument();
  });

  it.each(['editing', 'scheduled'])('hides the card handoff in %s for editing managers', status => {
    render(<UserPreferencesProvider><SharedShootCard shoot={{ ...shoot, status, workflowStatus: status }} role="editing_manager" onSendToEditing={vi.fn()} /></UserPreferencesProvider>);
    expect(screen.queryByTitle('Send to Editing')).not.toBeInTheDocument();
  });

  it('opens the requested card handoff for an editing manager without RAWs', async () => {
    const requested = { ...shoot, status: 'requested', workflowStatus: 'requested' };
    const send = vi.fn();
    render(<UserPreferencesProvider><SharedShootCard shoot={requested} role="editing_manager" onSendToEditing={send} /></UserPreferencesProvider>);
    await userEvent.setup().click(screen.getByTitle('Send to Editing'));
    expect(send).toHaveBeenCalledWith(requested);
  });
});
