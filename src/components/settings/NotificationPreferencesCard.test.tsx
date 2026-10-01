import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserData, UserRole } from '@/types/auth';
import { NotificationPreferencesCard } from './NotificationPreferencesCard';

const mocks = vi.hoisted(() => ({
  user: { id: '1', name: 'Test User', email: 'user@example.com', role: 'client', metadata: {} } as UserData,
  saveProfile: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useSelfProfileSave', () => ({ useSelfProfileSave: () => ({ saveProfile: mocks.saveProfile }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

const categoryLabels = [
  'Booking updates', 'Shoot reminders', 'Media and delivery updates', 'Payments and invoices',
  'Account updates', 'Other text messages',
];
const defaultCategories = {
  bookingUpdates: true, shootReminders: true, deliveryUpdates: true,
  payments: true, accountUpdates: true, other: true,
};

describe('Notification preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
    mocks.user = { id: '1', name: 'Test User', email: 'user@example.com', role: 'client', metadata: {} };
    mocks.saveProfile.mockResolvedValue({ reauthRequired: false });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it.each<UserRole>(['client', 'salesRep', 'admin', 'superadmin', 'editing_manager'])('offers all text controls for %s', (role) => {
    mocks.user.role = role;
    render(<NotificationPreferencesCard />);
    expect(screen.getByRole('switch', { name: 'Allow text messages' })).toBeChecked();
    categoryLabels.forEach((name) => expect(screen.getByRole('switch', { name })).toBeChecked());
    expect(screen.getByRole('switch', { name: 'Email Notifications' })).toBeChecked();
  });

  it('retains each category while all texts are disabled and saves independently of email', async () => {
    render(<NotificationPreferencesCard />);
    fireEvent.click(screen.getByRole('switch', { name: 'Shoot reminders' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Allow text messages' }));
    expect(screen.getByRole('status')).toHaveTextContent('All text messages are turned off.');
    categoryLabels.forEach((name) => expect(screen.getByRole('switch', { name })).toBeDisabled());
    expect(screen.getByRole('switch', { name: 'Shoot reminders' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Booking updates' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Email Notifications' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith({
      preferences: { notificationEmail: true, notificationSMS: false, smsCategories: { ...defaultCategories, shootReminders: false } },
    }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeEnabled());
    fireEvent.click(screen.getByRole('switch', { name: 'Allow text messages' }));
    expect(screen.getByRole('switch', { name: 'Shoot reminders' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Booking updates' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Shoot reminders' })).toBeEnabled();
  });

  it('reads legacy opt-outs and carries them into canonical categories without rewriting unrelated preferences', async () => {
    mocks.user = {
      ...mocks.user, role: 'salesRep', metadata: {
        preferences: {
          notificationSettings: { sms: false }, notificationEmail: false, department: 'Sales',
          notifications: { shootReminders: false, paymentReminders: false, weeklySummaries: false },
        },
      },
    };
    render(<NotificationPreferencesCard />);
    expect(screen.getByRole('switch', { name: 'Allow text messages' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Shoot reminders' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Payments and invoices' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Weekly sales summaries' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Weekly sales summaries' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith({ preferences: {
      notificationEmail: false, notificationSMS: false,
      smsCategories: { ...defaultCategories, shootReminders: false, payments: false },
      notifications: { weeklySummaries: false },
    } }));
  });

  it('prefers explicit new choices over legacy opt-outs', () => {
    mocks.user.metadata = { preferences: {
      notificationSMS: true, notificationSettings: { sms: false },
      notifications: { shootReminders: false, paymentReminders: false },
      smsCategories: { shootReminders: true, payments: true },
    } };
    render(<NotificationPreferencesCard />);
    expect(screen.getByRole('switch', { name: 'Allow text messages' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Shoot reminders' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Payments and invoices' })).toBeChecked();
  });

  it('retains numeric and string opt-outs from older stored settings', () => {
    mocks.user.metadata = { preferences: {
      notificationSMS: null, notificationSettings: { sms: '0' },
      smsCategories: { shootReminders: 0, payments: 'false', other: 'off' },
    } };
    render(<NotificationPreferencesCard />);
    expect(screen.getByRole('switch', { name: 'Allow text messages' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Shoot reminders' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Payments and invoices' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Other text messages' })).not.toBeChecked();
  });

  it('preserves unsaved edits and refreshes untouched fields when profile metadata changes', async () => {
    const view = render(<NotificationPreferencesCard />);
    fireEvent.click(screen.getByRole('switch', { name: 'Booking updates' }));
    mocks.user = { ...mocks.user, metadata: { preferences: { notificationEmail: false, smsCategories: { deliveryUpdates: false } } } };
    view.rerender(<NotificationPreferencesCard />);
    expect(screen.getByRole('switch', { name: 'Booking updates' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Media and delivery updates' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Email Notifications' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith({ preferences: {
      notificationEmail: false, notificationSMS: true,
      smsCategories: { ...defaultCategories, bookingUpdates: false, deliveryUpdates: false },
    } }));
  });

  it('loads fresh settings when the signed-in account changes', () => {
    const view = render(<NotificationPreferencesCard />);
    fireEvent.click(screen.getByRole('switch', { name: 'Allow text messages' }));
    mocks.user = { ...mocks.user, id: '2', metadata: {} };
    view.rerender(<NotificationPreferencesCard />);
    expect(screen.getByRole('switch', { name: 'Allow text messages' })).toBeChecked();
  });

  it('keeps failed changes available for retry and shows the save error', async () => {
    mocks.saveProfile.mockRejectedValueOnce(new Error('Could not save your settings.'));
    render(<NotificationPreferencesCard />);
    fireEvent.click(screen.getByRole('switch', { name: 'Other text messages' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your settings.');
    expect(screen.getByRole('switch', { name: 'Other text messages' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Preferences updated' })));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('locks the form during save and uses the saved response on return', async () => {
    let resolveSave!: (result: unknown) => void;
    mocks.saveProfile.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    const view = render(<NotificationPreferencesCard />);
    fireEvent.click(screen.getByRole('switch', { name: 'Payments and invoices' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    screen.getAllByRole('switch').forEach((control) => expect(control).toBeDisabled());
    mocks.user = { ...mocks.user, metadata: { preferences: {
      notificationEmail: true, notificationSMS: true, smsCategories: { ...defaultCategories, payments: false },
    } } };
    await act(async () => resolveSave({ reauthRequired: false, user: mocks.user }));
    view.unmount();
    render(<NotificationPreferencesCard />);
    expect(screen.getByRole('switch', { name: 'Payments and invoices' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Booking updates' })).toBeChecked();
  });

  it('keeps editor saves scoped to the existing internal-message email preference', async () => {
    mocks.user.role = 'editor';
    render(<NotificationPreferencesCard />);
    expect(screen.queryByRole('switch', { name: 'Allow text messages' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Email Notifications' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith({ preferences: { notificationEmail: false } }));
  });
});
