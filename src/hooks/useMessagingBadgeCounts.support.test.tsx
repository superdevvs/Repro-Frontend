import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMessagingBadgeCounts } from './useMessagingBadgeCounts';
import { canAccessNotificationSms, canReceiveEmailInboxNotifications, canReceivePersonalEmailNotifications, getNotificationChannelForRole } from '@/utils/notificationRole';
const state = vi.hoisted(() => ({ role: 'client', permissions: new Set(['messaging-email', 'messaging-overview']), get: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 1, role: state.role } }) }));
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: (resource: string) => state.permissions.has(resource), isLoading: false }) }));
vi.mock('@/services/messaging', () => ({ getMessagingBadgeCounts: state.get }));
beforeEach(() => { state.role = 'client'; state.permissions = new Set(['messaging-email', 'messaging-overview']); state.get.mockReset().mockResolvedValue({ email: 9, sms: 2, call: 3, total: 14 }); });
afterEach(cleanup);
function view() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(useMessagingBadgeCounts, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}
it('does not load email badges for a support-only account even through manual refresh', async () => {
  const { result } = view(); await act(async () => { await result.current.refresh(); });
  expect(state.get).not.toHaveBeenCalled(); expect(result.current.email).toBe(0);
});
it('keeps a rep’s allowed SMS and Calls badges without contributing email or subscribing to the shared email inbox', async () => {
  state.role = 'salesRep'; state.permissions.add('messaging-sms'); state.permissions.add('voice-calls');
  const { result } = view(); await waitFor(() => expect(result.current.total).toBe(5));
  expect(result.current.email).toBe(0); expect(canReceiveEmailInboxNotifications('salesRep')).toBe(false); expect(canAccessNotificationSms('salesRep')).toBe(true);
});
it('keeps authorized editing-manager email badges and shared email notifications', async () => {
  state.role = 'editing_manager'; const { result } = view(); await waitFor(() => expect(result.current.email).toBe(9));
  expect(canReceiveEmailInboxNotifications('editing_manager')).toBe(true);
  expect(canReceivePersonalEmailNotifications('editing_manager')).toBe(true);
});
it.each(['client', 'photographer', 'editor', 'salesRep', 'sales_rep'])('does not subscribe %s to staff personal email channels', role => {
  expect(canReceivePersonalEmailNotifications(role)).toBe(false);
  expect(canReceiveEmailInboxNotifications(role)).toBe(false);
  expect(getNotificationChannelForRole('salesRep', 12)).toBe('admin.notifications');
});
