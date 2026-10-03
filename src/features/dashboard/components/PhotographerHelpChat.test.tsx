import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiChatResponse, AiMessage } from '@/types/ai';
import { PhotographerHelpChat, usePhotographerHelpChat } from './PhotographerHelpChat';

const mocks = vi.hoisted(() => ({ send: vi.fn(), allowed: true, loading: false }));
vi.mock('@/services/aiService', () => ({ sendAiMessage: mocks.send }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ can: (resource: string, action: string) => mocks.allowed && resource === 'robbie' && action === 'view', isLoading: mocks.loading }) }));

const message = (id: string, sender: AiMessage['sender'], content: string): AiMessage => ({ id, sender, content, createdAt: '2026-10-03T12:00:00Z' });
const firstMessages = [message('1', 'user', 'How do I upload files?'), message('2', 'assistant', 'Open your assigned shoot and choose Media.')];
const reply = (messages = firstMessages, sessionId = 'help-session'): AiChatResponse => ({ sessionId, messages });
const deferred = () => {
  let resolve!: (value: AiChatResponse) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<AiChatResponse>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
};

function Harness({ userId = '42', visible = true, active = true }: { userId?: string; visible?: boolean; active?: boolean }) {
  const chat = usePhotographerHelpChat(userId);
  return visible ? <PhotographerHelpChat chat={chat} active={active} /> : null;
}

const view = (props: Parameters<typeof Harness>[0] = {}) => <MemoryRouter initialEntries={['/dashboard']}><Harness {...props} /></MemoryRouter>;
const composer = () => screen.getByRole('textbox', { name: 'Ask Robbie' });

beforeEach(() => { vi.clearAllMocks(); mocks.allowed = true; mocks.loading = false; mocks.send.mockResolvedValue(reply()); });
afterEach(cleanup);

describe('Photographer help chat', () => {
  it('waits for an explicit question and reuses the returned session without duplicating full history', async () => {
    const user = userEvent.setup();
    render(view());
    expect(mocks.send).not.toHaveBeenCalled();
    await user.type(composer(), 'How do I upload files?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Open your assigned shoot and choose Media.');
    expect(mocks.send).toHaveBeenCalledWith({ sessionId: null, message: 'How do I upload files?', context: { intent: 'support_faq', source: 'photographer_help_hub', page: 'dashboard', route: '/dashboard', role: 'photographer' } });
    expect(composer()).toHaveValue('');
    mocks.send.mockResolvedValue(reply([...firstMessages, message('3', 'user', 'What if a file fails?'), message('4', 'assistant', 'Retry only the failed files.'), message('5', 'system', 'Internal context')]));
    await user.type(composer(), 'What if a file fails?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Retry only the failed files.');
    expect(mocks.send).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: 'help-session', message: 'What if a file fails?' }));
    expect(screen.getAllByText('Open your assigned shoot and choose Media.')).toHaveLength(1);
    expect(screen.queryByText('Internal context')).not.toBeInTheDocument();
  });

  it('retains the question after a failure and retries only when requested', async () => {
    const user = userEvent.setup();
    mocks.send.mockRejectedValueOnce(new Error('Network disconnected'));
    render(view());
    await user.type(composer(), 'How do I upload files?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your question is saved here.');
    expect(composer()).toHaveValue('How do I upload files?');
    expect(screen.queryByText('Open your assigned shoot and choose Media.')).not.toBeInTheDocument();
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Open your assigned shoot and choose Media.');
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(composer()).toHaveValue('');
  });

  it('retains history and an unsent draft when dialog content unmounts and remounts', async () => {
    const user = userEvent.setup();
    const mounted = render(view());
    await user.type(composer(), 'How do I upload files?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Open your assigned shoot and choose Media.');
    await user.type(composer(), 'My next question');
    mounted.rerender(view({ visible: false }));
    mounted.rerender(view({ visible: true }));
    expect(composer()).toHaveValue('My next question');
    expect(screen.getByText('Open your assigned shoot and choose Media.')).toBeInTheDocument();
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('allows a pending response to finish while closed without sending again on reopen', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    mocks.send.mockReturnValue(pending.promise);
    const mounted = render(view());
    await user.type(composer(), 'How do I upload files?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    mounted.rerender(view({ visible: false }));
    await act(async () => { pending.resolve(reply()); await pending.promise; });
    mounted.rerender(view());
    expect(screen.getByText('Open your assigned shoot and choose Media.')).toBeInTheDocument();
    expect(composer()).toHaveValue('');
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('discards a previous account’s pending reply without unlocking the new account’s request', async () => {
    const user = userEvent.setup();
    const first = deferred();
    const second = deferred();
    mocks.send.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const mounted = render(view({ userId: '42' }));
    await user.type(composer(), 'Old account question');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    mounted.rerender(view({ userId: '77' }));
    expect(composer()).toHaveValue('');
    expect(screen.queryByText('Old account question')).not.toBeInTheDocument();
    await user.type(composer(), 'New account question');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await act(async () => { first.resolve(reply([message('old', 'assistant', 'Old account private answer')], 'old-session')); await first.promise; });
    expect(screen.queryByText('Old account private answer')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await act(async () => { second.resolve(reply([message('new', 'assistant', 'New account answer')], 'new-session')); await second.promise; });
    expect(screen.getByText('New account answer')).toBeInTheDocument();
    expect(mocks.send).toHaveBeenLastCalledWith(expect.objectContaining({ sessionId: null }));
    await user.type(composer(), 'New draft');
    mounted.rerender(view({ userId: '42' }));
    expect(composer()).toHaveValue('');
    expect(screen.queryByText('New account answer')).not.toBeInTheDocument();
  });

  it('blocks duplicate submissions even before the pending state renders', async () => {
    const pending = deferred();
    mocks.send.mockReturnValue(pending.promise);
    const { result } = renderHook(() => usePhotographerHelpChat('42'), { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    act(() => result.current.setDraft('How do I upload files?'));
    act(() => { void result.current.send(); void result.current.send(); });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(reply()); await pending.promise; });
    expect(result.current.sending).toBe(false);
  });

  it('sends on Enter but leaves Shift+Enter and IME composition alone', async () => {
    const user = userEvent.setup();
    render(view());
    await user.type(composer(), 'How do I upload');
    await user.keyboard('{Shift>}{Enter}{/Shift}files?');
    expect(composer()).toHaveValue('How do I upload\nfiles?');
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.compositionStart(composer());
    fireEvent.keyDown(composer(), { key: 'Enter', code: 'Enter', keyCode: 13 });
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.compositionEnd(composer());
    fireEvent.keyDown(composer(), { key: 'Enter', code: 'Enter', keyCode: 229 });
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.keyDown(composer(), { key: 'Enter', code: 'Enter', isComposing: true });
    expect(mocks.send).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
  });

  it('shows access loading and denial without offering an unusable composer', () => {
    mocks.loading = true;
    const mounted = render(view());
    expect(screen.getByRole('status')).toHaveTextContent('Checking Robbie access');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    mocks.loading = false;
    mocks.allowed = false;
    mounted.rerender(view());
    expect(screen.getByRole('status')).toHaveTextContent('You can still watch the guides and take the dashboard tour.');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('guards sends after permission is revoked and while the panel is inactive', async () => {
    const { result, rerender } = renderHook(() => usePhotographerHelpChat('42'), { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    act(() => result.current.setDraft('Question'));
    mocks.allowed = false;
    rerender();
    await act(async () => { await result.current.send(); });
    expect(mocks.send).not.toHaveBeenCalled();
    cleanup();
    mocks.allowed = true;
    render(view({ active: false }));
    fireEvent.change(composer(), { target: { value: 'Question' } });
    fireEvent.keyDown(composer(), { key: 'Enter', code: 'Enter' });
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
