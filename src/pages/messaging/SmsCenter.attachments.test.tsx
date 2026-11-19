import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageMediaFile } from '@/services/messageMedia';
import type { SmsMessageDetail, SmsThreadSummary } from '@/types/messaging';
import SmsCenter from './SmsCenter';

const state = vi.hoisted(() => ({ role: 'admin', mobile: false, isImpersonating: false }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: state.role, user: { id: 7 }, isImpersonating: state.isImpersonating }) }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => state.mobile }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: () => false }));
vi.mock('@/hooks/use-sms-realtime', () => ({ useSmsRealtime: () => undefined }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/services/messaging', () => ({
  getSmsThreads: vi.fn(), getSmsThread: vi.fn(), markSmsThreadRead: vi.fn().mockResolvedValue(undefined),
  getSmsSenders: vi.fn().mockResolvedValue([]),
  resumeSmsThreadAi: vi.fn(), sendSms: vi.fn(), sendSmsMessageToThread: vi.fn(),
  getSmsGroups: vi.fn().mockResolvedValue([]), getSmsRecipients: vi.fn().mockResolvedValue([]),
  saveSmsGroup: vi.fn(), deleteSmsGroup: vi.fn(), updateSmsContact: vi.fn(), updateSmsContactComment: vi.fn(),
  getTemplates: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/messageMedia', () => ({
  createMessageUpload: vi.fn(), putMessageUploadChunk: vi.fn(), completeMessageUpload: vi.fn(),
  getMessageUpload: vi.fn(), deleteMessageUpload: vi.fn(), sendSmsWithAttachments: vi.fn(),
  getSmsMessageAttachments: vi.fn(), fetchMessageMediaBlob: vi.fn(),
}));
import { getSmsThread, getSmsThreads, sendSmsMessageToThread } from '@/services/messaging';
import {
  completeMessageUpload, createMessageUpload, deleteMessageUpload, getMessageUpload, getSmsMessageAttachments,
  putMessageUploadChunk, sendSmsWithAttachments,
} from '@/services/messageMedia';
import { toast } from '@/lib/sonner-toast';

const conversation: SmsThreadSummary = {
  id: '51', unread: false, inboxScope: 'inbox', lastMessageAt: '2026-11-19T13:39:00Z',
  contact: { id: '9', name: 'Lee Gedansky', primaryNumber: '+12025550144', numbers: [] },
};
const sentMessage: SmsMessageDetail = { id: '900', threadId: '51', direction: 'OUTBOUND', body: 'Here you go' };
const upload = (id: string, change: Partial<MessageMediaFile> = {}): MessageMediaFile => ({
  id, name: 'front.jpg', size: 5, type: 'image/jpeg', status: 'uploading', received_bytes: 0, chunk_bytes: 8388608,
  download_url: `/api/messaging/media/files/${id}`, ...change,
});
const photo = (name = 'front.jpg') => new File(['photo'], name, { type: 'image/jpeg' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const clients: QueryClient[] = [];
async function open(messages: SmsMessageDetail[] = []) {
  vi.mocked(getSmsThread).mockResolvedValue({ thread: conversation, contact: conversation.contact!, messages });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<MemoryRouter initialEntries={['/messaging/sms?thread=51']}><QueryClientProvider client={client}><SmsCenter /></QueryClientProvider></MemoryRouter>);
  return screen.findByPlaceholderText('Write a message to Lee Gedansky');
}
const attach = (user: ReturnType<typeof userEvent.setup>, ...files: File[]) => user.upload(screen.getByTestId('sms-attachment-input'), files);
const tray = () => screen.getByRole('list', { name: 'Attachments' });
const sendButton = () => screen.getByRole('button', { name: 'Send' });

beforeEach(() => {
  state.role = 'admin'; state.mobile = false; state.isImpersonating = false;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
  vi.mocked(getSmsThreads).mockReset().mockResolvedValue({ data: [conversation], meta: {} });
  vi.mocked(createMessageUpload).mockReset().mockImplementation(async data => upload(data.id, { name: data.name, size: data.size }));
  vi.mocked(putMessageUploadChunk).mockReset().mockImplementation(async id => upload(id, { received_bytes: 5 }));
  vi.mocked(completeMessageUpload).mockReset().mockImplementation(async id => upload(id, { status: 'ready', received_bytes: 5 }));
  vi.mocked(deleteMessageUpload).mockReset().mockResolvedValue(undefined);
  vi.mocked(getSmsMessageAttachments).mockReset().mockResolvedValue({});
  vi.mocked(sendSmsWithAttachments).mockReset().mockResolvedValue({ success: true, id: '900', conversation_id: '51', result: { message: sentMessage, thread: conversation } });
  vi.mocked(sendSmsMessageToThread).mockReset().mockResolvedValue({ message: sentMessage, thread: conversation });
  vi.mocked(toast.success).mockReset(); vi.mocked(toast.error).mockReset();
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe('sending photos and files from the SMS inbox', () => {
  it('uploads an attached photo, sends it with the text through the attachment route, then clears the draft', async () => {
    const user = userEvent.setup();
    const input = await open();

    await attach(user, photo());
    expect(await within(tray()).findByText('front.jpg')).toBeInTheDocument();
    expect(screen.getByText('The recipient gets a secure link to these files. It works for 30 days.')).toBeInTheDocument();
    await user.type(input, 'Here you go');
    expect(screen.getByText('11 chars · 1 segment + attachment link')).toBeInTheDocument();
    await waitFor(() => expect(sendButton()).toBeEnabled());
    await user.click(sendButton());

    await waitFor(() => expect(sendSmsWithAttachments).toHaveBeenCalledTimes(1));
    const uploadId = vi.mocked(createMessageUpload).mock.calls[0][0].id;
    expect(vi.mocked(sendSmsWithAttachments).mock.calls[0][0]).toEqual({
      request_key: expect.stringMatching(UUID), conversation_id: '51', body: 'Here you go', sender_id: undefined, attachment_ids: [uploadId],
    });
    expect(sendSmsMessageToThread).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Attachments' })).not.toBeInTheDocument());
    expect(input).toHaveValue('');
    expect(deleteMessageUpload).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Message sent');
  });

  it('sends a photo with no text, and holds Send until the upload has passed the virus scan', async () => {
    const user = userEvent.setup();
    let scanned = false;
    vi.mocked(completeMessageUpload).mockImplementation(async id => upload(id, { status: 'scanning', received_bytes: 5 }));
    vi.mocked(getMessageUpload).mockImplementation(async id => upload(id, { status: scanned ? 'ready' : 'scanning', received_bytes: 5 }));
    await open();

    await attach(user, photo());
    expect(await within(tray()).findByText('Checking for viruses…')).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();

    scanned = true;
    await waitFor(() => expect(sendButton()).toBeEnabled(), { timeout: 5000 });
    await user.click(sendButton());

    await waitFor(() => expect(sendSmsWithAttachments).toHaveBeenCalledWith(expect.objectContaining({ body: '', conversation_id: '51' })));
  });

  it('keeps text-only replies on the existing route', async () => {
    const user = userEvent.setup();
    const input = await open();

    await user.type(input, 'On my way');
    expect(screen.getByText('9 chars · 1 segment')).toBeInTheDocument();
    await user.click(sendButton());

    await waitFor(() => expect(sendSmsMessageToThread).toHaveBeenCalledWith('51', { body: 'On my way', sms_number_id: undefined }));
    expect(sendSmsWithAttachments).not.toHaveBeenCalled();
    expect(createMessageUpload).not.toHaveBeenCalled();
  });

  it('removes an attachment before sending and frees it on the server', async () => {
    const user = userEvent.setup();
    await open();
    await attach(user, photo('a.jpg'), photo('b.jpg'));
    await within(tray()).findByText('b.jpg');

    await user.click(screen.getByRole('button', { name: 'Remove a.jpg' }));

    expect(within(tray()).queryByText('a.jpg')).not.toBeInTheDocument();
    expect(within(tray()).getByText('b.jpg')).toBeInTheDocument();
    expect(deleteMessageUpload).toHaveBeenCalledWith(vi.mocked(createMessageUpload).mock.calls[0][0].id);
  });

  it('names a file that is too large and does not upload it', async () => {
    const user = userEvent.setup();
    await open();
    const huge = photo('walkthrough.mov');
    Object.defineProperty(huge, 'size', { value: 2 * 1024 * 1024 * 1024 });

    await attach(user, huge);

    expect(await screen.findByRole('alert')).toHaveTextContent('walkthrough.mov is 2.0 GB. Attachments can be up to 1 GB each.');
    expect(createMessageUpload).not.toHaveBeenCalled();
    expect(sendButton()).toBeDisabled();
  });

  it('repeats a send that lost its connection with the same key so it cannot go out twice', async () => {
    const user = userEvent.setup();
    vi.mocked(sendSmsWithAttachments).mockRejectedValueOnce(new Error('Network Error'));
    const input = await open();
    await attach(user, photo());
    await user.type(input, 'Here you go');
    await waitFor(() => expect(sendButton()).toBeEnabled());

    await user.click(sendButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Connection lost while sending. Select Send again; the message will not go out twice.'));
    expect(input).toHaveValue('Here you go');
    expect(within(tray()).getByText('front.jpg')).toBeInTheDocument();
    await user.click(sendButton());

    await waitFor(() => expect(sendSmsWithAttachments).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(sendSmsWithAttachments).mock.calls.map(([data]) => data);
    expect(second).toEqual(first);
    expect(createMessageUpload).toHaveBeenCalledTimes(1);
  });

  it('keeps the text and attaches the files again when the carrier send fails', async () => {
    const user = userEvent.setup();
    vi.mocked(sendSmsWithAttachments).mockRejectedValueOnce({ response: { status: 422, data: {
      success: false, id: '900', result: { success: false, error: 'sms_send_failed', message: 'SMS could not be sent. Please try again.' },
    } } });
    const input = await open();
    await attach(user, photo());
    await user.type(input, 'Here you go');
    await waitFor(() => expect(sendButton()).toBeEnabled());

    await user.click(sendButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('SMS could not be sent. Please try again. Check the conversation, then send again once the files finish attaching.'));
    await waitFor(() => expect(createMessageUpload).toHaveBeenCalledTimes(2));
    const [first, again] = vi.mocked(createMessageUpload).mock.calls.map(([data]) => data);
    expect(again).toMatchObject({ name: 'front.jpg', size: first.size });
    expect(again.id).not.toBe(first.id);
    expect(input).toHaveValue('Here you go');

    await waitFor(() => expect(sendButton()).toBeEnabled());
    await user.click(sendButton());
    await waitFor(() => expect(sendSmsWithAttachments).toHaveBeenCalledTimes(2));
    const [failed, retried] = vi.mocked(sendSmsWithAttachments).mock.calls.map(([data]) => data);
    expect(retried.attachment_ids).toEqual([again.id]);
    expect(retried.request_key).not.toBe(failed.request_key);
  });

  it('shows the API reason when a draft is refused and leaves the uploaded files usable', async () => {
    const user = userEvent.setup();
    vi.mocked(sendSmsWithAttachments).mockRejectedValueOnce({ response: { status: 422, data: {
      message: 'Shorten this message before sending. Your text and attachments are still in the draft.', errors: { body: ['Shorten this message before sending.'] },
    } } });
    const input = await open();
    await attach(user, photo());
    await user.type(input, 'Long text');
    await waitFor(() => expect(sendButton()).toBeEnabled());

    await user.click(sendButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Shorten this message before sending. Your text and attachments are still in the draft.'));
    expect(createMessageUpload).toHaveBeenCalledTimes(1);
    expect(within(tray()).getByText('front.jpg')).toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  it('turns attaching off, with the reason, while viewing as another user', async () => {
    state.isImpersonating = true;
    await open();

    const button = screen.getByRole('button', { name: 'Attach photos or files' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Attachments are unavailable while you are viewing as another user.');
  });

  it('offers attaching in the phone layout too', async () => {
    state.mobile = true;
    const user = userEvent.setup();
    await open();

    await attach(user, photo());

    expect(await within(tray()).findByText('front.jpg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attach photos or files' })).toBeEnabled();
  });
});

describe('received and sent media in the open conversation', () => {
  it('asks for attachments of exactly the messages in view and lists a received file', async () => {
    const received: SmsMessageDetail = { id: '880', threadId: '51', direction: 'INBOUND', body: '' };
    vi.mocked(getSmsMessageAttachments).mockResolvedValue({ '880': [upload('m1', { name: 'Survey.pdf', type: 'application/pdf', size: 412_000, status: 'ready' })] });

    await open([received, { id: '881', threadId: '51', direction: 'OUTBOUND', body: 'Thanks' }]);

    expect(await screen.findByRole('button', { name: 'Download Survey.pdf' })).toBeInTheDocument();
    expect(getSmsMessageAttachments).toHaveBeenCalledWith(['880', '881']);
  });

  it('still opens the conversation when attachments cannot be loaded', async () => {
    vi.mocked(getSmsMessageAttachments).mockRejectedValue({ response: { status: 404 } });

    await open([{ id: '881', threadId: '51', direction: 'OUTBOUND', body: 'Thanks' }]);

    expect(await screen.findByText('Thanks')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
