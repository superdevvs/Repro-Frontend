import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserData, UserRole } from '@/types/auth';
import { AdminProfile } from './AdminProfile';
import { ClientProfile } from './ClientProfile';
import { EditorProfile } from './EditorProfile';

const mocks = vi.hoisted(() => ({
  user: { id: '1', name: 'Test User', email: 'user@example.com', role: 'client', metadata: {} } as UserData,
  saveProfile: vi.fn(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useSelfProfileSave', () => ({ useSelfProfileSave: () => ({ saveProfile: mocks.saveProfile }) }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('@/contexts/UserPreferencesContext', () => ({ useUserPreferences: () => ({
  preferences: { temperatureUnit: 'fahrenheit', timeFormat: '12h' }, setTemperatureUnit: vi.fn(), setTimeFormat: vi.fn(),
}) }));
vi.mock('@/components/profile/ImageUpload', () => ({ ImageUpload: () => null }));
vi.mock('@/components/profile/ProfileActivityCard', () => ({ ProfileActivityCard: () => null }));
vi.mock('@/components/profile/ProfileSecurityCard', () => ({ ProfileSecurityCard: () => null }));
vi.mock('@/hooks/useEditorDashboardQueue', () => ({ useEditorDashboardQueue: () => ({
  sourceShoots: [], deliveredShoots: [], upcomingShoots: [], isLoading: false, isError: false,
}) }));
vi.mock('@/hooks/useResendVerificationEmail', () => ({ useResendVerificationEmail: () => ({
  isResendingVerification: false, resendVerification: vi.fn(), resendFeedback: null,
}) }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('profile notification settings move', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    mocks.user = { id: '1', name: 'Test User', email: 'user@example.com', role: 'client', metadata: { preferences: {
      notificationEmail: true, notificationSMS: true,
      notifications: { shootReminders: true, paymentReminders: true, weeklySummaries: true },
    } } };
    mocks.saveProfile.mockResolvedValue({ reauthRequired: false, user: mocks.user });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it.each<UserRole>(['client', 'salesRep', 'admin', 'superadmin', 'editing_manager', 'editor'])('%s profile links to settings and cannot overwrite newer notification choices', async (role) => {
    mocks.user.role = role;
    const profile = role === 'client' ? <ClientProfile /> : role === 'editor' ? <EditorProfile /> : <AdminProfile />;
    const view = render(<MemoryRouter>{profile}</MemoryRouter>);
    if (role === 'client') await screen.findByText('No photographers are currently available.');
    expect(screen.getByRole('link', { name: /notification settings/i })).toHaveAttribute('href', '/settings?tab=notifications');
    expect(screen.queryByRole('switch', { name: /email notifications|shoot reminders|payment reminders|weekly summaries/i })).not.toBeInTheDocument();

    mocks.user = { ...mocks.user, metadata: { preferences: {
      notificationEmail: false, notificationSMS: false,
      notifications: { shootReminders: false, paymentReminders: false, weeklySummaries: false },
    } } };
    view.rerender(<MemoryRouter>{profile}</MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Updated Name' } });
    const form = screen.getByLabelText('Full Name').closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalled());
    const payload = mocks.saveProfile.mock.calls[0][0];
    expect(payload.name).toBe('Updated Name');
    expect(payload.preferences).not.toHaveProperty('notificationEmail');
    expect(payload.preferences).not.toHaveProperty('notificationSMS');
    expect(payload.preferences).not.toHaveProperty('smsCategories');
    expect(payload.preferences).not.toHaveProperty('notifications');
  });
});
