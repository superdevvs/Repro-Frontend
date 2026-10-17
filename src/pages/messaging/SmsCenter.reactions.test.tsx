import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SmsMessageDetail, SmsThreadDetail, SmsThreadSummary } from '@/types/messaging';
import SmsCenter from './SmsCenter';

const realtime = vi.hoisted(() => ({
  options: undefined as {
    threadId?: string | null;
    onMessage?: (message: SmsMessageDetail) => void;
  } | undefined,
}));

vi.mock('@/hooks/use-sms-realtime', () => ({
  useSmsRealtime: (options: typeof realtime.options) => { realtime.options = options; },
}));

vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => false }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: () => false }));
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
  getSmsGroups: vi.fn().mockResolvedValue([]),
  getSmsRecipients: vi.fn().mockResolvedValue([]),
  saveSmsGroup: vi.fn(),
  deleteSmsGroup: vi.fn(),
  updateSmsContact: vi.fn(),
  updateSmsContactComment: vi.fn(),
  getTemplates: vi.fn().mockResolvedValue([]),
}));

import { getSmsThread, getSmsThreads } from '@/services/messaging';

const thread: SmsThreadSummary = {
  id: 'contact-thread',
  unread: false,
  lastMessageSnippet: 'Your photographer account has been created',
  lastMessageAt: '2026-09-22T15:32:00Z',
  contact: {
    id: 'photographer', name: 'Test Photographer', primaryNumber: '+17035550100', numbers: [],
  },
};

const onboarding: SmsMessageDetail = {
  id: 'onboarding', threadId: thread.id, direction: 'OUTBOUND',
  from: '+17035550999', to: '+17035550100',
  body: thread.lastMessageSnippet, sentAt: thread.lastMessageAt,
};

const original: SmsMessageDetail = {
  id: 'system-reminder', threadId: 'older-system-thread', direction: 'OUTBOUND',
  from: '+17035550999', to: '+17035550100',
  body: 'Shoot reminder\nDetails: https://reprodashboard.com/shoots/2474',
  sentAt: '2026-10-15T14:00:00Z',
};

const incoming: SmsMessageDetail = {
  id: 'incoming-reaction', threadId: thread.id, direction: 'INBOUND',
  from: '+17035550100', to: '+17035550999',
  body: `A aprobat „${original.body}”`, sentAt: '2026-10-15T14:01:00Z',
  reaction: {
    emoji: '👍', label: 'Like', action: 'add',
    targetMessageId: original.id, quotedMessage: original.body!,
  },
};

const detail = (messages: SmsMessageDetail[]): SmsThreadDetail => ({
  thread, contact: thread.contact!, messages,
});

describe('SmsCenter realtime reactions', () => {
  beforeEach(() => {
    realtime.options = undefined;
    vi.mocked(getSmsThread).mockReset();
    vi.mocked(getSmsThreads).mockResolvedValue({
      data: [thread], meta: { current_page: 1, last_page: 1, per_page: 50, total: 1 },
    });
  });

  afterEach(cleanup);

  it.each([true, false])('fetches the original message and attaches a live reaction (annotated event: %s)', async (annotated) => {
    let resolveRefetch!: (value: SmsThreadDetail) => void;
    const refetch = new Promise<SmsThreadDetail>((resolve) => { resolveRefetch = resolve; });
    vi.mocked(getSmsThread)
      .mockResolvedValueOnce(detail([onboarding]))
      .mockImplementation(() => refetch);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { container, unmount } = render(
      <MemoryRouter initialEntries={['/messaging/sms?thread=contact-thread']}>
        <QueryClientProvider client={client}><SmsCenter /></QueryClientProvider>
      </MemoryRouter>,
    );

    await screen.findByPlaceholderText('Write a message to Test Photographer');
    expect(screen.queryByRole('link', { name: 'https://reprodashboard.com/shoots/2474' })).not.toBeInTheDocument();
    expect(realtime.options?.threadId).toBe(thread.id);

    const event = annotated ? incoming : { ...incoming, reaction: undefined };
    act(() => {
      realtime.options?.onMessage?.(event);
      realtime.options?.onMessage?.(event);
    });

    await waitFor(() => expect(vi.mocked(getSmsThread).mock.calls.length).toBeGreaterThan(1));
    const cached = client.getQueryData<SmsThreadDetail>(['sms-thread', thread.id, undefined, 'client']);
    expect(cached?.messages.filter(({ id }) => id === incoming.id)).toHaveLength(1);

    await act(async () => { resolveRefetch(detail([onboarding, original, incoming])); });

    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: 'Like reaction from +17035550100' })).toHaveLength(1);
      expect(container.querySelector('blockquote')).toBeNull();
    });
    expect(screen.getAllByRole('link', { name: 'https://reprodashboard.com/shoots/2474' })).toHaveLength(1);
    expect(container.textContent).not.toContain('A aprobat');
    expect(container.textContent).not.toContain('Liked your message');
    expect(client.getQueryData<SmsThreadDetail>(['sms-thread', thread.id, undefined, 'client'])?.messages.map(({ id }) => id))
      .toEqual([onboarding.id, original.id, incoming.id]);

    unmount();
    client.clear();
  });
});
