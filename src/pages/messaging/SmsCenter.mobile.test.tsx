import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SmsThreadDetail, SmsThreadSummary } from '@/types/messaging';
import SmsCenter from './SmsCenter';

const media = vi.hoisted(() => ({ mobile: true }));

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => media.mobile,
}));

vi.mock('@/hooks/use-page-loading', () => ({
  usePageLoading: () => false,
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/messaging', () => ({
  getSmsThreads: vi.fn(),
  getSmsThread: vi.fn(),
  markSmsThreadRead: vi.fn().mockResolvedValue(undefined),
  resumeSmsThreadAi: vi.fn(),
  sendSms: vi.fn(),
  sendSmsMessageToThread: vi.fn(),
  updateSmsContact: vi.fn(),
  updateSmsContactComment: vi.fn(),
  getTemplates: vi.fn().mockResolvedValue([]),
}));

import { getSmsThread, getSmsThreads } from '@/services/messaging';

const lee: SmsThreadSummary = {
  id: 'thread-lee',
  unread: false,
  lastMessageSnippet: 'Your Client account has been created',
  lastMessageAt: '2026-09-22T15:32:00.000Z',
  contact: {
    id: 'contact-lee',
    name: 'Lee Gedansky',
    email: 'gedansky@netscape.net',
    primaryNumber: '+15551212',
    numbers: [],
  },
};

const alex: SmsThreadSummary = {
  id: 'thread-alex',
  unread: true,
  lastMessageSnippet: 'See you Thursday',
  lastMessageAt: '2026-09-23T15:00:00.000Z',
  contact: {
    id: 'contact-alex',
    name: 'Alex Morgan',
    email: 'alex@example.com',
    primaryNumber: '+15550000',
    numbers: [],
  },
};

const detail = (thread: SmsThreadSummary, body: string): SmsThreadDetail => ({
  thread,
  contact: thread.contact!,
  messages: [
    {
      id: `${thread.id}-m1`,
      threadId: thread.id,
      direction: 'OUTBOUND',
      body,
      sentAt: thread.lastMessageAt,
    },
  ],
});

const renderSms = (path = '/messaging/sms') => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <SmsCenter />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('SmsCenter mobile', () => {
  beforeEach(() => {
    media.mobile = true;
    vi.mocked(getSmsThreads).mockResolvedValue({
      data: [lee, alex],
      meta: { current_page: 1, last_page: 1, per_page: 50, total: 2 },
    });
    vi.mocked(getSmsThread).mockImplementation(async (id) => {
      const thread = id === alex.id ? alex : lee;
      return detail(thread, thread.lastMessageSnippet ?? '');
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('opens on the conversation list instead of the first thread', async () => {
    renderSms();

    expect(await screen.findByRole('button', { name: /Lee Gedansky/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alex Morgan/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Write a message to Lee Gedansky')).not.toBeInTheDocument();
  });

  it('returns to the conversation list from an open thread', async () => {
    const user = userEvent.setup();
    renderSms();

    await user.click(await screen.findByRole('button', { name: /Alex Morgan/i }));
    expect(await screen.findByPlaceholderText('Write a message to Alex Morgan')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to messages' }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Write a message to Alex Morgan')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Lee Gedansky/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alex Morgan/i })).toBeInTheDocument();
  });

  it('keeps a desktop split view on the first thread', async () => {
    media.mobile = false;
    renderSms();

    expect(await screen.findByPlaceholderText('Write a message to Lee Gedansky')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alex Morgan/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to messages' })).not.toBeInTheDocument();
  });
});
