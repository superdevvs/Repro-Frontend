import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import MessagingOverview from './MessagingOverview';

const auth = vi.hoisted(() => ({ role: 'superadmin' }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: vi.fn() }));
vi.mock('@/services/messaging', () => ({
  getMessagingOverview: async () => ({
    total_sent_today: 2, total_scheduled: 1, total_failed_today: 3,
    unread_sms_count: 0, active_automations: 0,
    recent_activity: [{ id: 17, channel: 'SMS', direction: 'OUTBOUND', body_text: 'Overview SMS fixture' }],
  }),
  getEmailMessages: async () => ({ data: [] }),
  getSmsThreads: async () => ({ data: [{ id: '17', contact: { name: 'Fixture SMS' }, lastDirection: 'OUTBOUND', lastMessageSnippet: 'Overview SMS fixture' }] }),
}));

afterEach(() => {
  cleanup();
  auth.role = 'superadmin';
});

describe('messaging overview diagnostics', () => {
  it('removes cached failure counts when the active role changes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = () => <QueryClientProvider client={client}>
      <MemoryRouter><MessagingOverview /></MemoryRouter>
    </QueryClientProvider>;
    const { rerender } = render(page());
    expect(await screen.findByText('Failed')).toBeInTheDocument();
    auth.role = 'admin';
    rerender(page());
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
    expect(screen.getByText('Sent Today')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Overview SMS fixture')).toBeInTheDocument();
  });
});
