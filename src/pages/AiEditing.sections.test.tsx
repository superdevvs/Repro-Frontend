import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { V4Media } from '@/components/studio/v4/types';
import AiEditing from './AiEditing';

const fixtures = vi.hoisted(() => ({
  role: 'superadmin',
  capabilities: vi.fn(),
  history: vi.fn(),
  getWorkspace: vi.fn(),
  resolveShoot: vi.fn(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 9, name: 'Editing QA', role: fixtures.role, isActive: true, secondary_roles: [] },
    role: fixtures.role,
    isAuthenticated: true,
    isImpersonating: false,
  }),
}));
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));
vi.mock('./ListingStudioManage', () => ({
  ListingStudioStaffWorkspace: ({ clientId }: { clientId?: string }) => <h1>Client plans & credit{clientId ? ` for ${clientId}` : ''}</h1>,
}));
vi.mock('@/services/studioProviderService', () => ({
  studioProviderService: { capabilities: fixtures.capabilities },
  presetAvailability: () => ({ ready: true }),
}));
vi.mock('@/services/studioWorkspaceService', () => ({
  studioWorkspaceService: { list: fixtures.history, get: fixtures.getWorkspace },
  workspaceSources: { resolveShoot: fixtures.resolveShoot },
  studioError: (error: Error) => error.message,
}));
vi.mock('@/components/studio/v4/MediaPicker', () => ({
  MediaPicker: ({ open, onSelect, onClose }: { open: boolean; onSelect: (media: V4Media[], label: string) => void; onClose: () => void }) => open ? (
    <button type="button" onClick={() => {
      onSelect([{ id: 'fixture-photo', kind: 'image', name: 'Exterior', url: '/exterior.jpg', thumbnailUrl: '/exterior.jpg' }], 'QA shoot');
      onClose();
    }}>Use exterior photo</button>
  ) : null,
}));

function LocationSearch() {
  return <output aria-label="Search parameters">{useLocation().search}</output>;
}

function open(search = '') {
  render(<MemoryRouter initialEntries={[`/ai-editing${search}`]}><AiEditing /><LocationSearch /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.role = 'superadmin';
  fixtures.capabilities.mockResolvedValue({ presets: {} });
  fixtures.history.mockResolvedValue([]);
});
afterEach(cleanup);

describe('AI Editing sections', () => {
  it('loads a managed Listing Studio deep link without starting any AI workspace requests', async () => {
    open('?section=listing-studio&clientId=42&tab=billing');

    expect(screen.getByRole('tab', { name: 'Listing Studio', selected: true })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Client plans & credit for 42' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Studio revisions' })).toHaveAttribute('href', '/dashboard?requests=editing&editingSource=studio');
    expect(fixtures.capabilities).not.toHaveBeenCalled();
    expect(fixtures.history).not.toHaveBeenCalled();
    expect(fixtures.getWorkspace).not.toHaveBeenCalled();
    expect(fixtures.resolveShoot).not.toHaveBeenCalled();
  });

  it('keeps revision access separate from client billing authority', () => {
    fixtures.role = 'editing_manager';
    open('?section=listing-studio&clientId=42');

    expect(screen.getByRole('tab', { name: 'Listing Studio', selected: true })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Studio revisions' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /client plans/i })).not.toBeInTheDocument();
    expect(fixtures.capabilities).not.toHaveBeenCalled();
    expect(fixtures.history).not.toHaveBeenCalled();
  });

  it('retains the media and prompt while switching sections', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByRole('textbox', { name: 'Describe your edit' }), 'Keep the original color');
    await user.click(screen.getByRole('button', { name: /Select shoot/ }));
    await user.click(screen.getByRole('button', { name: 'Use exterior photo' }));

    await user.click(screen.getByRole('tab', { name: 'Video' }));
    expect(screen.getByRole('tab', { name: 'Video', selected: true })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Editing preset' })).toHaveTextContent('Walkthrough');
    expect(screen.getByRole('textbox', { name: 'Describe your edit' })).toHaveValue('Keep the original color');
    expect(screen.getByRole('button', { name: 'View 1 selected files' })).toBeVisible();

    const providerCalls = fixtures.capabilities.mock.calls.length;
    const historyCalls = fixtures.history.mock.calls.length;
    await user.click(screen.getByRole('tab', { name: 'Listing Studio' }));
    await screen.findByRole('heading', { name: 'Client plans & credit' });
    expect(screen.queryByRole('textbox', { name: 'Describe your edit' })).not.toBeInTheDocument();
    expect(fixtures.capabilities).toHaveBeenCalledTimes(providerCalls);
    expect(fixtures.history).toHaveBeenCalledTimes(historyCalls);

    await user.click(screen.getByRole('tab', { name: 'Image' }));
    expect(screen.getByRole('combobox', { name: 'Editing preset' })).toHaveTextContent('Listing ready');
    expect(screen.getByRole('textbox', { name: 'Describe your edit' })).toHaveValue('Keep the original color');
    expect(screen.getByRole('button', { name: 'View 1 selected files' })).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText('Search parameters')).toHaveTextContent('section=image'));
  });
});
